"""Run from ai-service/: python -m unittest discover -s tests -t ."""

import unittest
from unittest.mock import patch

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.agents.intent_router import (
    GENERATE_RESPONSE,
    LOAD_FACTORY_DATA,
    Intent,
    IntentClassification,
    IntentSource,
    classify_message,
    last_user_message,
    route_intent,
)


class FakeStructuredLLM:
    """Stands in for the LangChain chat model; records what it was sent."""

    def __init__(self, output=None, error=None):
        self.output = output
        self.error = error
        self.calls = []
        self.schema = None

    def with_structured_output(self, schema):
        self.schema = schema
        return self

    def invoke(self, messages):
        self.calls.append(messages)
        if self.error:
            raise self.error
        return self.output


class SpecExampleTest(unittest.TestCase):
    """The examples listed in docs/phase-wise-prompts.md Phase 15."""

    CASES = [
        ("Why is my furnace a hotspot?", Intent.HOTSPOT_ANALYSIS),
        ("What should I fix first?", Intent.RECOMMENDATION),
        ("What happens if I use 30% recycled material?", Intent.SCENARIO),
        ("Generate an action plan.", Intent.ACTION_PLAN),
        ("What industry is my factory in?", Intent.FACTORY_OVERVIEW),
    ]

    def test_spec_examples(self):
        for message, expected in self.CASES:
            with self.subTest(message=message):
                result = classify_message(message)
                self.assertEqual(result.intent, expected)
                self.assertEqual(result.source, IntentSource.RULES)
                self.assertFalse(result.needs_clarification)


class RuleClassificationTest(unittest.TestCase):
    CASES = [
        # Hotspots
        ("Which process is the biggest emitter?", Intent.HOTSPOT_ANALYSIS),
        ("Where are most of our emissions coming from?", Intent.HOTSPOT_ANALYSIS),
        ("What is the root cause of the high boiler emissions?", Intent.HOTSPOT_ANALYSIS),
        # Recommendations
        ("How can we reduce emissions by 20%?", Intent.RECOMMENDATION),
        ("Recommend circular alternatives for our slag waste", Intent.RECOMMENDATION),
        ("What should we change in the dyeing line?", Intent.RECOMMENDATION),
        # Scenarios
        ("What if we switch 40% of grid power to solar?", Intent.SCENARIO),
        ("Simulate replacing diesel with CNG", Intent.SCENARIO),
        ("Suppose recycled content goes up to 50 percent", Intent.SCENARIO),
        # Action plans
        ("Create a decarbonization roadmap", Intent.ACTION_PLAN),
        ("Give me a sustainability plan for next year", Intent.ACTION_PLAN),
        # Factory overview
        ("Tell me about my factory", Intent.FACTORY_OVERVIEW),
        ("What are our total emissions?", Intent.FACTORY_OVERVIEW),
        # General carbon knowledge
        ("What is Scope 2?", Intent.GENERAL_CARBON_QUESTION),
        ("Explain what CO2e means", Intent.GENERAL_CARBON_QUESTION),
    ]

    def test_rule_cases(self):
        for message, expected in self.CASES:
            with self.subTest(message=message):
                self.assertEqual(classify_message(message).intent, expected)

    def test_more_specific_workflow_wins(self):
        # Mentions hotspots but asks for a plan → ACTION_PLAN.
        self.assertEqual(
            classify_message("Build an action plan to tackle our hotspots").intent,
            Intent.ACTION_PLAN,
        )
        # Mentions the factory but asks what to fix → RECOMMENDATION.
        self.assertEqual(
            classify_message("What should I fix first in my factory?").intent,
            Intent.RECOMMENDATION,
        )

    def test_case_insensitive(self):
        self.assertEqual(classify_message("GENERATE AN ACTION PLAN").intent, Intent.ACTION_PLAN)

    def test_rules_do_not_call_llm(self):
        llm = FakeStructuredLLM()
        classify_message("What should I fix first?", llm=llm)
        self.assertEqual(llm.calls, [])


class FallbackTest(unittest.TestCase):
    def test_empty_message_uses_clarification_path(self):
        for message in ["", "   ", None]:
            with self.subTest(message=message):
                result = classify_message(message)
                self.assertEqual(result.intent, Intent.GENERAL_CARBON_QUESTION)
                self.assertTrue(result.needs_clarification)
                self.assertEqual(result.source, IntentSource.FALLBACK)

    def test_unmatched_message_without_llm_uses_clarification_path(self):
        result = classify_message("hmm, not sure")
        self.assertEqual(result.intent, Intent.GENERAL_CARBON_QUESTION)
        self.assertTrue(result.needs_clarification)
        self.assertEqual(result.confidence, 0.0)


class LLMClassificationTest(unittest.TestCase):
    AMBIGUOUS = "The kiln numbers look off lately"

    def test_confident_llm_result_is_used(self):
        llm = FakeStructuredLLM(
            output={"intent": "HOTSPOT_ANALYSIS", "confidence": 0.8, "rationale": "Asks about a high reading."}
        )
        result = classify_message(self.AMBIGUOUS, llm=llm)
        self.assertEqual(result.intent, Intent.HOTSPOT_ANALYSIS)
        self.assertEqual(result.source, IntentSource.LLM)
        self.assertFalse(result.needs_clarification)
        self.assertIsNotNone(llm.schema)

    def test_low_confidence_llm_result_falls_back(self):
        llm = FakeStructuredLLM(output={"intent": "SCENARIO", "confidence": 0.3, "rationale": ""})
        result = classify_message(self.AMBIGUOUS, llm=llm)
        self.assertEqual(result.intent, Intent.GENERAL_CARBON_QUESTION)
        self.assertTrue(result.needs_clarification)
        self.assertEqual(result.source, IntentSource.FALLBACK)

    def test_llm_error_falls_back(self):
        llm = FakeStructuredLLM(error=RuntimeError("quota exceeded"))
        result = classify_message(self.AMBIGUOUS, llm=llm)
        self.assertEqual(result.intent, Intent.GENERAL_CARBON_QUESTION)
        self.assertTrue(result.needs_clarification)

    def test_invalid_llm_label_falls_back(self):
        llm = FakeStructuredLLM(output={"intent": "WEATHER", "confidence": 0.99})
        result = classify_message(self.AMBIGUOUS, llm=llm)
        self.assertEqual(result.intent, Intent.GENERAL_CARBON_QUESTION)
        self.assertTrue(result.needs_clarification)

    def test_llm_sees_only_the_user_message(self):
        llm = FakeStructuredLLM(output={"intent": "FACTORY_OVERVIEW", "confidence": 0.9})
        classify_message(self.AMBIGUOUS, llm=llm)

        sent = llm.calls[0]
        self.assertEqual(len(sent), 2)
        self.assertIsInstance(sent[0], SystemMessage)
        self.assertIn("Never state or guess facts about the user's factory", sent[0].content)
        self.assertIsInstance(sent[1], HumanMessage)
        self.assertEqual(sent[1].content, self.AMBIGUOUS)


class StructuredOutputTest(unittest.TestCase):
    def test_output_is_structured_and_serialisable(self):
        result = classify_message("What should I fix first?")
        self.assertIsInstance(result, IntentClassification)
        self.assertEqual(
            result.model_dump(mode="json"),
            {
                "intent": "RECOMMENDATION",
                "confidence": 0.9,
                "needs_clarification": False,
                "source": "RULES",
                "rationale": "Message wording matches the RECOMMENDATION pattern.",
            },
        )

    def test_rationale_makes_no_factory_claims(self):
        result = classify_message("Why is my furnace a hotspot?")
        self.assertNotIn("furnace", result.rationale.lower())


class RoutingTest(unittest.TestCase):
    def test_factory_intents_load_factory_data(self):
        for intent in [
            Intent.FACTORY_OVERVIEW,
            Intent.HOTSPOT_ANALYSIS,
            Intent.RECOMMENDATION,
            Intent.SCENARIO,
            Intent.ACTION_PLAN,
        ]:
            with self.subTest(intent=intent):
                self.assertEqual(route_intent(intent.value), LOAD_FACTORY_DATA)

    def test_general_and_unknown_intents_skip_factory_data(self):
        for intent in ["GENERAL_CARBON_QUESTION", "NOT_AN_INTENT", None]:
            with self.subTest(intent=intent):
                self.assertEqual(route_intent(intent), GENERATE_RESPONSE)

    def test_last_user_message(self):
        messages = [HumanMessage(content="first"), AIMessage(content="reply"), HumanMessage(content="second")]
        self.assertEqual(last_user_message(messages), "second")
        self.assertEqual(last_user_message([AIMessage(content="only ai")]), "")


class GraphIntegrationTest(unittest.TestCase):
    def test_router_node_writes_structured_intent(self):
        from app.agents import nodes

        with patch.object(nodes, "get_llm", side_effect=RuntimeError("no key")):
            update = nodes.classify_intent({"messages": [HumanMessage(content="Generate an action plan.")]})

        self.assertEqual(update["intent"], "ACTION_PLAN")
        self.assertEqual(update["intent_classification"]["source"], "RULES")

    def test_graph_has_conditional_routes(self):
        from app.agents.graph import ecotrace_graph

        edges = {(e.source, e.target) for e in ecotrace_graph.get_graph().edges}
        self.assertIn(("__start__", "intent_router"), edges)
        self.assertIn(("intent_router", LOAD_FACTORY_DATA), edges)
        self.assertIn(("intent_router", GENERATE_RESPONSE), edges)
        self.assertIn((LOAD_FACTORY_DATA, GENERATE_RESPONSE), edges)


if __name__ == "__main__":
    unittest.main()
