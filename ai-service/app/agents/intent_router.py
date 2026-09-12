"""Structured intent router for the EcoTrace AI Copilot.

Classifies a user message into one of the supported intents and decides the
minimum workflow needed to answer it.

Classification is two-stage:
1. Deterministic keyword rules — fast, free, and reproducible for the common
   phrasings ("what should I fix first?", "generate an action plan").
2. LLM structured output — only when the rules are inconclusive.

If neither stage is confident, the router falls back to the safe
GENERAL_CARBON_QUESTION path and flags that a clarifying question is needed.

The router sees ONLY the user's message — never factory data — so it cannot
make factory-specific claims while classifying.
"""

import logging
import re
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field

logger = logging.getLogger("ecotrace.ai.intent_router")


class Intent(str, Enum):
    FACTORY_OVERVIEW = "FACTORY_OVERVIEW"
    HOTSPOT_ANALYSIS = "HOTSPOT_ANALYSIS"
    RECOMMENDATION = "RECOMMENDATION"
    SCENARIO = "SCENARIO"
    ACTION_PLAN = "ACTION_PLAN"
    GENERAL_CARBON_QUESTION = "GENERAL_CARBON_QUESTION"


class IntentSource(str, Enum):
    RULES = "RULES"
    LLM = "LLM"
    FALLBACK = "FALLBACK"


class IntentClassification(BaseModel):
    """Structured output of the intent router."""

    intent: Intent
    confidence: float = Field(..., ge=0.0, le=1.0)
    # When True the response node should ask the user to clarify before analysing.
    needs_clarification: bool = False
    source: IntentSource
    # Generic reason for the choice — describes the message, never the factory.
    rationale: str = ""


class _LLMIntentOutput(BaseModel):
    """Schema the LLM must fill via structured output."""

    intent: Intent = Field(..., description="The single best-matching intent label.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="0-1 confidence in the label.")
    rationale: str = Field(
        default="",
        description="One short sentence about the wording of the message. No factory facts or numbers.",
    )


# Below this confidence the router does not trust a classification.
MIN_CONFIDENCE = 0.6

RULE_CONFIDENCE = 0.9

# ---------------------------------------------------------------------------
# Workflow routing — the minimum set of steps each intent needs
# ---------------------------------------------------------------------------
LOAD_FACTORY_DATA = "load_factory_data"
GENERATE_RESPONSE = "generate_response"

# General questions (and clarification requests) need no factory data at all.
INTENT_ROUTES: Dict[Intent, str] = {
    Intent.FACTORY_OVERVIEW: LOAD_FACTORY_DATA,
    Intent.HOTSPOT_ANALYSIS: LOAD_FACTORY_DATA,
    Intent.RECOMMENDATION: LOAD_FACTORY_DATA,
    Intent.SCENARIO: LOAD_FACTORY_DATA,
    Intent.ACTION_PLAN: LOAD_FACTORY_DATA,
    Intent.GENERAL_CARBON_QUESTION: GENERATE_RESPONSE,
}

# ---------------------------------------------------------------------------
# Stage 1: deterministic keyword rules
# ---------------------------------------------------------------------------
# Checked in priority order: the most specific workflow wins when several
# patterns match (e.g. "action plan to reduce hotspots" → ACTION_PLAN).
_RULES: List[Tuple[Intent, List[str]]] = [
    (
        Intent.ACTION_PLAN,
        [
            r"\baction\s+plan\b",
            r"\broad\s?map\b",
            r"\b(sustainability|decarboni[sz]ation|reduction|implementation)\s+plan\b",
        ],
    ),
    (
        Intent.SCENARIO,
        [
            r"\bwhat\s+(happens|would\s+happen|if)\b",
            r"\bwhat[- ]if\b",
            r"\bsimulat(e|ion)\b",
            r"\bscenario\b",
            r"\b(if|suppose|assuming)\b.*\d+(\.\d+)?\s*(%|percent)",
            r"\b(switch|increase|decrease|replace|substitute|use)\b.*\d+(\.\d+)?\s*(%|percent)",
        ],
    ),
    (
        Intent.RECOMMENDATION,
        [
            r"\b(fix|improve|tackle|prioriti[sz]e|address)\b.*\bfirst\b",
            r"\bwhat\s+should\s+(i|we)\s+(do|fix|change|improve)\b",
            r"\brecommend(ation|ations|ed)?\b",
            r"\bsuggest(ion|ions)?\b",
            r"\bintervention(s)?\b",
            r"\bcircular\s+(alternative|option|economy|solution)s?\b",
            r"\bhow\s+(can|do|could)\s+(i|we)\s+(reduce|lower|cut)\b",
        ],
    ),
    (
        Intent.HOTSPOT_ANALYSIS,
        [
            r"\bhot\s?spots?\b",
            r"\b(biggest|largest|highest|top|main)\s+(emitter|source|contributor|polluter)s?\b",
            r"\bwhere\s+(are|do|does)\b.*\bemissions?\b",
            r"\broot\s+cause\b",
            r"\bwhy\s+(is|are|does|do)\b.*\b(high|so\s+much|emit|emitting|emissions?)\b",
        ],
    ),
    (
        Intent.FACTORY_OVERVIEW,
        [
            r"\b(my|our|the)\s+(factory|plant|facility|site)\b",
            r"\bwhat\s+industry\b",
            r"\b(my|our)\s+(processes|machines|equipment|production)\b",
            r"\b(total|overall)\s+(emissions?|footprint)\b",
            r"\bfactory\s+(profile|overview|summary|details)\b",
        ],
    ),
    (
        Intent.GENERAL_CARBON_QUESTION,
        [
            r"\bwhat\s+(is|are|does)\b.*\b(scope\s*[123]|co2e|carbon\s+footprint|emission\s+factor|ghg|greenhouse|net[- ]zero|carbon\s+neutral)\b",
            r"\b(explain|define|meaning\s+of)\b.*\b(scope\s*[123]|co2e|carbon|emission|ghg|circular\s+economy)\b",
        ],
    ),
]

_COMPILED_RULES = [
    (intent, [re.compile(p, re.IGNORECASE) for p in patterns]) for intent, patterns in _RULES
]


def classify_by_rules(message: str) -> Optional[IntentClassification]:
    """Return a rule-based classification, or None if no rule matches."""
    for intent, patterns in _COMPILED_RULES:
        for pattern in patterns:
            if pattern.search(message):
                return IntentClassification(
                    intent=intent,
                    confidence=RULE_CONFIDENCE,
                    source=IntentSource.RULES,
                    rationale=f"Message wording matches the {intent.value} pattern.",
                )
    return None


# ---------------------------------------------------------------------------
# Stage 2: LLM structured classification
# ---------------------------------------------------------------------------
INTENT_CLASSIFICATION_PROMPT = """You are an intent classifier for EcoTrace AI, a carbon-footprint analysis system.

Classify the user message into exactly one of these intents:
- FACTORY_OVERVIEW — questions about the user's own factory profile, industry, processes, or totals
- HOTSPOT_ANALYSIS — questions about emission hotspots, biggest sources, or why something emits a lot
- RECOMMENDATION — requests for what to fix, interventions, or circular alternatives
- SCENARIO — what-if questions about changing a parameter (e.g. a percentage of material or energy)
- ACTION_PLAN — requests to generate a full sustainability / reduction action plan
- GENERAL_CARBON_QUESTION — general carbon or sustainability questions not about the user's factory

Rules:
- You are only classifying. Do NOT answer the question.
- You have no factory data. Never state or guess facts about the user's factory, equipment, or numbers.
- If the message is ambiguous, off-topic, or too vague, choose GENERAL_CARBON_QUESTION with a low confidence."""


def classify_by_llm(message: str, llm: Any) -> Optional[IntentClassification]:
    """Ask the LLM for a structured classification. Returns None on any failure."""
    try:
        structured_llm = llm.with_structured_output(_LLMIntentOutput)
        result = structured_llm.invoke(
            [SystemMessage(content=INTENT_CLASSIFICATION_PROMPT), HumanMessage(content=message)]
        )
        output = result if isinstance(result, _LLMIntentOutput) else _LLMIntentOutput.model_validate(result)
    except Exception as exc:
        logger.warning("LLM intent classification failed: %s", exc)
        return None

    return IntentClassification(
        intent=output.intent,
        confidence=output.confidence,
        source=IntentSource.LLM,
        rationale=output.rationale,
    )


def _fallback(rationale: str) -> IntentClassification:
    return IntentClassification(
        intent=Intent.GENERAL_CARBON_QUESTION,
        confidence=0.0,
        needs_clarification=True,
        source=IntentSource.FALLBACK,
        rationale=rationale,
    )


def classify_message(message: str, llm: Any = None) -> IntentClassification:
    """Classify a single user message into a structured intent.

    `llm` is optional; without it only the deterministic rules are used.
    """
    text = (message or "").strip()
    if not text:
        return _fallback("Empty message.")

    rule_result = classify_by_rules(text)
    if rule_result is not None:
        return rule_result

    if llm is not None:
        llm_result = classify_by_llm(text, llm)
        if llm_result is not None:
            if llm_result.confidence >= MIN_CONFIDENCE:
                return llm_result
            # Low confidence — keep the safe general path and ask for clarification.
            return _fallback(f"Low-confidence LLM classification ({llm_result.intent.value}).")

    return _fallback("Message did not match any known intent.")


def last_user_message(messages: List[BaseMessage]) -> str:
    """Return the content of the most recent HumanMessage, or an empty string."""
    return next((m.content for m in reversed(messages) if isinstance(m, HumanMessage)), "")


def route_intent(intent: Optional[str]) -> str:
    """Map an intent label to the name of the next graph node."""
    try:
        return INTENT_ROUTES[Intent(intent)]
    except ValueError:
        return INTENT_ROUTES[Intent.GENERAL_CARBON_QUESTION]
