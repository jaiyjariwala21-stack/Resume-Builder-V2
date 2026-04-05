import { DEFAULT_HEADERS, json, parseCookies, parseJsonBody, sanitize } from "./lib/http.js";
import { getSessionCookieName, verifySignedSession } from "./lib/app-session.js";
import { consumeResumeCredit, canGenerateWithEntitlement, isFirestoreConfigured } from "./lib/firebase-firestore.js";

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

function buildPrompt({ resume, job, parsedJob, matchResult }) {
  return [
    "You are an expert ATS resume editor and cover letter writer.",
    "Use ONLY the facts already present in the resume.",
    "Do not fabricate achievements, metrics, employers, dates, or responsibilities.",
    "You may rephrase, reorganize, condense, and emphasize relevant existing experience.",
    "Optimize for ATS readability and keyword alignment without keyword stuffing.",
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
    "- Resume should stay ATS-friendly with plain text section headings like SUMMARY, EXPERIENCE, SKILLS, and EDUCATION.",
    "- Resume should avoid tables, columns, icons, text boxes, and decorative formatting.",
    "- Resume should naturally include relevant job keywords only when supported by the existing resume facts.",
    "- Resume bullets should begin with strong verbs and remain plain-text friendly.",
    "- Cover letter should be concise, factual, aligned to the job, and easy to scan.",
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
    const { resume, job, provider, apiKey, parsedJob, matchResult } = parseJsonBody(event.body);
    const safeResume = sanitize(resume).slice(0, 24000);
    const safeJob = sanitize(job).slice(0, 16000);
    const safeProvider = sanitize(provider).toLowerCase();
    const safeApiKey = getProviderKey(safeProvider, apiKey);

    if (!safeResume || !safeJob || !safeProvider) {
      return json(400, { error: "resume, job, and provider are required." });
    }

    if (!safeApiKey) {
      return json(400, { error: "No provider key is configured for the selected model." });
    }

    const cookies = parseCookies(event.headers.cookie || event.headers.Cookie);
    const session = verifySignedSession(cookies[getSessionCookieName()]);
    const usingOwnerManagedKey = !sanitize(apiKey);

    if (usingOwnerManagedKey) {
      if (!session?.email) {
        return json(401, { error: "A paid session is required to use site billing." });
      }

      if (isFirestoreConfigured()) {
        const entitlement = await canGenerateWithEntitlement(session.email);
        if (!entitlement.allowed) {
          return json(402, { error: entitlement.reason || "No paid entitlement found." });
        }
        await consumeResumeCredit(session.email);
      }
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
