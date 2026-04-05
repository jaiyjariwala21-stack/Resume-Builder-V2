const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  };
}

function sanitize(input) {
  return String(input || "").replace(/\u0000/g, "").trim();
}

function buildPrompt({ resume, job, parsedJob, matchResult }) {
  return [
    "You are an expert resume editor and cover letter writer.",
    "Use ONLY the facts already present in the resume.",
    "Do not fabricate achievements, metrics, employers, dates, or responsibilities.",
    "You may rephrase, reorganize, condense, and emphasize relevant existing experience.",
    "Return JSON only with this exact shape:",
    '{"resume":"","coverLetter":""}',
    "",
    "Target job summary:",
    JSON.stringify(parsedJob || {}, null, 2),
    "",
    "Current match insight:",
    JSON.stringify(matchResult || {}, null, 2),
    "",
    "Original resume:",
    resume,
    "",
    "Job description:",
    job,
    "",
    "Output requirements:",
    "- Resume should stay ATS-friendly with plain text section headings and bullets.",
    "- Cover letter should be concise, factual, and aligned to the job.",
    "- Keep a professional tone and preserve honesty constraints.",
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
          name: "resume_package",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["resume", "coverLetter"],
            properties: {
              resume: { type: "string" },
              coverLetter: { type: "string" },
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
      max_tokens: 2200,
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
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
    const { resume, job, provider, apiKey, parsedJob, matchResult } = JSON.parse(event.body || "{}");
    const safeResume = sanitize(resume).slice(0, 24000);
    const safeJob = sanitize(job).slice(0, 16000);
    const safeProvider = sanitize(provider).toLowerCase();
    const safeApiKey = sanitize(apiKey);

    if (!safeResume || !safeJob || !safeProvider || !safeApiKey) {
      return json(400, { error: "resume, job, provider, and apiKey are required." });
    }

    const prompt = buildPrompt({
      resume: safeResume,
      job: safeJob,
      parsedJob: parsedJob || {},
      matchResult: matchResult || {},
    });

    let result;
    if (safeProvider === "openai") {
      result = await callOpenAI(safeApiKey, prompt);
    } else if (safeProvider === "anthropic") {
      result = await callAnthropic(safeApiKey, prompt);
    } else if (safeProvider === "google") {
      result = await callGemini(safeApiKey, prompt);
    } else {
      return json(400, { error: "Unsupported provider." });
    }

    return json(200, {
      resume: sanitize(result.resume),
      coverLetter: sanitize(result.coverLetter),
    });
  } catch (error) {
    return json(500, { error: error.message || "Unable to generate documents." });
  }
}
