/**
 * Public entry point for the service assistant. The engine lives in
 * src/assistant/ (knowledge.ts = what it knows, engine.ts = how it decides).
 */
export { assistantReply, classify, localReply, normalise } from './assistant/engine';
export type { AssistantAction, AssistantContext, AssistantReply, ChatTurn } from './assistant/engine';
