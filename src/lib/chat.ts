import OpenAI from "openai";
import {
  buildContextBlock,
  chunksToCitations,
  retrieveChunks,
} from "./rag";
import type { Citation } from "./db";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are HawkChat, a strict document Q&A assistant (like NotebookLM).

CRITICAL RULES:
1. Answer ONLY from the numbered source excerpts in the user message. Never use outside knowledge.
2. Every sentence with a factual claim MUST end with a citation like [1] or [2] matching the excerpt numbers.
3. Prefer direct quotes or close paraphrase from the excerpts. Name specific details (dates, roles, procedures, names) when they appear in the text.
4. If the excerpts do not contain the answer, say exactly: "I could not find that in your documents." Then stop. Do not guess.
5. Do not give generic overviews. Answer the specific question asked.
6. Use short markdown bullets when listing multiple points.`;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required. Copy .env.example to .env and add your key.",
    );
  }
  return new OpenAI({ apiKey });
}

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

  const client = getClient();

  const historyText =
    history.length > 0
      ? `\n\nPrior conversation (for context only — still answer from excerpts):\n${history
          .slice(-4)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}`
      : "";

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `SOURCE EXCERPTS (your only allowed facts):\n\n${context}${historyText}\n\n---\n\nQUESTION: ${userMessage}\n\nAnswer using only the excerpts. Cite with [1], [2], etc.`,
    },
  ];

  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages,
    temperature: 0.1,
    max_tokens: 2048,
  });

  const content =
    response.choices[0]?.message?.content?.trim() ??
    "Sorry, I couldn't generate a response.";

  return { content, citations };
}
