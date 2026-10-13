/**
 * Google Gemini REST helpers (chat + embeddings).
 * Look here when HAWKCHAT_AI_PROVIDER=gemini fails: key, model name, or quota.
 */
import {
  getGeminiChatModel,
  getGeminiEmbeddingModel,
} from "./ai-provider";

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

function requireGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is required when HAWKCHAT_AI_PROVIDER=gemini.",
    );
  }
  return key;
}

type GeminiPart = { text?: string };
type GeminiContent = { role?: string; parts: GeminiPart[] };

type GenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { message?: string };
};

type EmbedContentResponse = {
  embedding?: { values?: number[] };
  error?: { message?: string };
};

type BatchEmbedResponse = {
  embeddings?: Array<{ values?: number[] }>;
  error?: { message?: string };
};

async function geminiFetch<T>(
  model: string,
  method: string,
  body: unknown,
): Promise<T> {
  const key = requireGeminiKey();
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:${method}?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(
      data.error?.message ||
        `Gemini ${method} failed (${res.status}) for model ${model}`,
    );
  }
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  return data;
}

/** Grounded chat completion via Gemini generateContent. */
export async function geminiGenerateReply(opts: {
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const model = getGeminiChatModel();
  const data = await geminiFetch<GenerateContentResponse>(
    model,
    "generateContent",
    {
      systemInstruction: {
        parts: [{ text: opts.systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: opts.userPrompt }],
        } satisfies GeminiContent,
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    },
  );

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();

  return text || "Sorry, I couldn't generate a response.";
}

const EMBED_BATCH_SIZE = 50;

/** Embed many strings with Gemini (order preserved). */
export async function geminiEmbedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = getGeminiEmbeddingModel();
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);

    if (batch.length === 1) {
      const data = await geminiFetch<EmbedContentResponse>(
        model,
        "embedContent",
        {
          content: { parts: [{ text: batch[0] }] },
          taskType,
        },
      );
      const values = data.embedding?.values;
      if (!values?.length) {
        throw new Error("Gemini embedContent returned an empty embedding.");
      }
      out.push(values);
      continue;
    }

    const data = await geminiFetch<BatchEmbedResponse>(
      model,
      "batchEmbedContents",
      {
        requests: batch.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType,
        })),
      },
    );

    const embeddings = data.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      // Fallback: one-by-one if batch shape is unexpected
      for (const text of batch) {
        const single = await geminiFetch<EmbedContentResponse>(
          model,
          "embedContent",
          {
            content: { parts: [{ text }] },
            taskType,
          },
        );
        const values = single.embedding?.values;
        if (!values?.length) {
          throw new Error("Gemini embedContent returned an empty embedding.");
        }
        out.push(values);
      }
      continue;
    }

    for (const emb of embeddings) {
      const values = emb.values;
      if (!values?.length) {
        throw new Error("Gemini batchEmbedContents returned an empty vector.");
      }
      out.push(values);
    }
  }

  return out;
}
