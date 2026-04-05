import { DEFAULT_HEADERS, json, parseJsonBody, sanitize } from "./lib/http.js";

function getProviderKey(provider, apiKey) {
  const directKey = sanitize(apiKey);
  if (directKey) {
    return directKey;
  }

  if (provider === "openai") {
    return sanitize(process.env.OPENAI_API_KEY);
  }

  if (provider === "anthropic") {
    return sanitize(process.env.ANTHROPIC_API_KEY);
  }

  if (provider === "google") {
    return sanitize(process.env.GOOGLE_API_KEY);
  }

  return "";
}

function buildPrompt(jobText) {
  return [
    "Extract structured hiring data from the job description.",
    "Return JSON only with this shape:",
    '{"title":"","company":"","responsibilities":[],"skills":[],"keywords":[]}',
    "Keep arrays concise and deduplicated.",
    "Do not add commentary or markdown.",
    "",
    jobText,
  ].join("\n");
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "job_parse",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "company", "responsibilities", "skills", "keywords"],
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              responsibilities: { type: "array", items: { type: "string" } },
              skills: { type: "array", items: { type: "string" } },
              keywords: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI request failed.");
  }

  return JSON.parse(payload.output_text);
}

async function callAnthropic(apiKey, prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 800,
      system: "Return JSON only.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "Anthropic request failed.");
  }

  return JSON.parse(payload.content?.[0]?.text || "{}");
}

async function callGemini(apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: "application/json",
        },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || "Gemini request failed.");
  }

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text);
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: DEFAULT_HEADERS };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const { jobText, provider, apiKey } = parseJsonBody(event.body);
    const safeJobText = sanitize(jobText).slice(0, 16000);
    const safeProvider = sanitize(provider).toLowerCase();
    const safeApiKey = getProviderKey(safeProvider, apiKey);

    if (!safeJobText || !safeProvider || !safeApiKey) {
      return json(400, { error: "jobText and provider are required, plus either an apiKey or a configured server-side provider key." });
    }

    const prompt = buildPrompt(safeJobText);
    let job;

    if (safeProvider === "openai") {
      job = await callOpenAI(safeApiKey, prompt);
    } else if (safeProvider === "anthropic") {
      job = await callAnthropic(safeApiKey, prompt);
    } else if (safeProvider === "google") {
      job = await callGemini(safeApiKey, prompt);
    } else {
      return json(400, { error: "Unsupported provider." });
    }

    return json(200, { job });
  } catch (error) {
    return json(500, { error: error.message || "Unable to parse the job description." });
  }
}
