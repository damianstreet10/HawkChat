/**
 * RAG chat completion: retrieve chunks, call Gemini or OpenAI, return answer + citations.
 * Provider: HAWKCHAT_AI_PROVIDER=gemini|openai. Look here for empty citations,
 * wrong provider key, or model env vars (GEMINI_CHAT_MODEL / OPENAI_CHAT_MODEL).
 */
import OpenAI from "openai";
import {
  getAiProvider,
  getOpenAiChatModel,
} from "./ai-provider";
import { geminiGenerateReply } from "./gemini";
import {
  buildContextBlock,
  chunksToCitations,
  retrieveChunks,
} from "./rag";
import type { Citation } from "./db";

const SYSTEM_PROMPT = `You are HawkChat, a strict document Q&A assistant (like NotebookLM).

CRITICAL RULES:
1. Answer ONLY from the numbered source excerpts in the user message. Never use outside knowledge.
2. Every sentence with a factual claim MUST end with a citation like [1] or [2] matching the excerpt numbers.
3. Prefer direct quotes or close paraphrase from the excerpts. Name specific details (dates, roles, procedures, names) when they appear in the text.
4. If the excerpts do not contain the answer, say exactly: "I could not find that in your documents." Then stop. Do not guess.
5. Do not give generic overviews. Answer the specific question asked.
6. Use short markdown bullets when listing multiple points.`;

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required when HAWKCHAT_AI_PROVIDER=openai.",
    );
  }
  return new OpenAI({ apiKey });
}

async function openAiGenerateReply(userPrompt: string): Promise<string> {
  const client = getOpenAiClient();
  const response = await client.chat.completions.create({
    model: getOpenAiChatModel(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    "Sorry, I couldn't generate a response."
  );
}

/** Retrieve notebook context and ask the chat model; returns markdown + citations. */
export async function generateGroundedReply(
  notebookId: string,
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<{ content: string; citations: Citation[] }> {
  const chunks = await retrieveChunks(notebookId, userMessage);
  if (chunks.length === 0) {
    return {
      content:
        "I could not find relevant passages in this notebook for that question. Try rephrasing or ask about topics covered in its documents.",
      citations: [],
    };
  }

  const context = buildContextBlock(chunks);
  const citations = chunksToCitations(chunks);

  const historyText =
    history.length > 0
      ? `\n\nPrior conversation (for context only — still answer from excerpts):\n${history
          .slice(-4)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}`
      : "";

  const userPrompt = `SOURCE EXCERPTS (your only allowed facts):\n\n${context}${historyText}\n\n---\n\nQUESTION: ${userMessage}\n\nAnswer using only the excerpts. Cite with [1], [2], etc.`;

  const provider = getAiProvider();
  const content =
    provider === "gemini"
      ? await geminiGenerateReply({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
        })
      : await openAiGenerateReply(userPrompt);

  return { content, citations };
}
