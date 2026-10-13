/**
 * Embeddings + cosine similarity for RAG retrieval (Gemini or OpenAI).
 * Provider: HAWKCHAT_AI_PROVIDER. After switching providers, re-index documents
 * (restart with auto-seed / re-upload) — old vectors are not compatible.
 */
import OpenAI from "openai";
import {
  getAiProvider,
  getOpenAiEmbeddingModel,
} from "./ai-provider";
import { geminiEmbedTexts } from "./gemini";

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required when HAWKCHAT_AI_PROVIDER=openai.",
    );
  }
  return new OpenAI({ apiKey });
}

async function openAiEmbedTexts(texts: string[]): Promise<number[][]> {
  const client = getOpenAiClient();
  const response = await client.embeddings.create({
    model: getOpenAiEmbeddingModel(),
    input: texts,
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Embed many strings in one API call (order preserved). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (getAiProvider() === "gemini") {
    return geminiEmbedTexts(texts, "RETRIEVAL_DOCUMENT");
  }
  return openAiEmbedTexts(texts);
}

/** Embed a single query string (uses RETRIEVAL_QUERY task for Gemini). */
export async function embedText(text: string): Promise<number[]> {
  if (getAiProvider() === "gemini") {
    const [embedding] = await geminiEmbedTexts([text], "RETRIEVAL_QUERY");
    return embedding;
  }
  const [embedding] = await openAiEmbedTexts([text]);
  return embedding;
}

/** Cosine similarity in [-1, 1]; used to rank retrieved chunks. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
