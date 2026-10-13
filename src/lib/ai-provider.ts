/**
 * Which LLM provider HawkChat uses for chat + embeddings.
 * Set HAWKCHAT_AI_PROVIDER=gemini|openai (default: gemini when GEMINI_API_KEY is set).
 * Keep the unused provider's key in .env for an easy switch later.
 */
export type AiProvider = "gemini" | "openai";

export function getAiProvider(): AiProvider {
  const raw = process.env.HAWKCHAT_AI_PROVIDER?.trim().toLowerCase();
  if (raw === "openai" || raw === "gemini") return raw;

  // Sensible default: prefer Gemini if its key is present.
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return "openai";
}

/** True when the active provider has a usable API key. */
export function hasActiveAiKey(): boolean {
  const provider = getAiProvider();
  if (provider === "gemini") {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function missingAiKeyMessage(): string {
  const provider = getAiProvider();
  if (provider === "gemini") {
    return "GEMINI_API_KEY is missing. Add it to .env (HAWKCHAT_AI_PROVIDER=gemini).";
  }
  return "OPENAI_API_KEY is missing. Add it to .env (or set HAWKCHAT_AI_PROVIDER=gemini).";
}

export function getGeminiChatModel(): string {
  return process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-2.0-flash";
}

export function getGeminiEmbeddingModel(): string {
  return (
    process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001"
  );
}

export function getOpenAiChatModel(): string {
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
}

export function getOpenAiEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
}
