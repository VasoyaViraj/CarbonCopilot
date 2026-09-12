import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const toCamel = (key) => key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());

/** Converts the AI service's snake_case JSON keys to this API's camelCase convention. */
export function camelizeKeys(value) {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [toCamel(key), camelizeKeys(item)]));
  }
  return value;
}

const list = (value) => (Array.isArray(value) ? value : []);

/** Only the stable copilot contract (API_CONTRACT §10) reaches the browser. */
function toCopilotResponse(body) {
  const data = camelizeKeys(body ?? {});
  return {
    answer: typeof data.answer === 'string' ? data.answer : '',
    toolsUsed: list(data.toolsUsed),
    recommendations: list(data.recommendations),
    scenario: data.scenario ?? null,
    assumptions: list(data.assumptions),
    confidence: data.confidence ?? 'UNAVAILABLE',
    intent: data.intent ?? null,
    actionPlan: data.actionPlan ?? null,
  };
}

const timeoutError = () =>
  new ApiError(504, 'AI_TIMEOUT', 'The AI Copilot took too long to respond. Please try again.');
const aiError = () => new ApiError(502, 'AI_ERROR', 'The AI Copilot could not answer this request.');

/**
 * Forwards an authorized question to the AI service. Only the factory id, the message and
 * the acting user's id leave this process; the service token is never returned to clients.
 */
export async function askCopilot({ user, factory, message, conversationId }) {
  if (!env.AI_SERVICE_TOKEN) throw ApiError.serviceUnavailable('The AI Copilot is not configured on this server.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch(`${env.AI_SERVICE_URL.replace(/\/+$/, '')}/copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Service-Token': env.AI_SERVICE_TOKEN,
          'X-Acting-User-Id': String(user.id),
        },
        body: JSON.stringify({ factoryId: factory.id, conversationId: conversationId ?? null, message }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted || err?.name === 'AbortError') throw timeoutError();
      console.error('AI service unreachable:', err?.message);
      throw ApiError.serviceUnavailable('The AI Copilot is unavailable right now. Please try again later.');
    }

    if (!response.ok) {
      console.error(`AI service responded ${response.status} for factory ${factory.id}`);
      if (response.status === 503) {
        throw ApiError.serviceUnavailable('The AI Copilot could not complete this request. Please try again later.');
      }
      throw aiError();
    }
    return toCopilotResponse(await response.json());
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (controller.signal.aborted || err?.name === 'AbortError') throw timeoutError();
    throw aiError();
  } finally {
    clearTimeout(timer);
  }
}
