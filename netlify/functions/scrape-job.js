const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  };
}

function cleanText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isBlockedHost(hostname) {
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(lower))
  );
}

function validateUrl(urlInput) {
  let target;
  try {
    target = new URL(urlInput);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error("Only HTTP(S) URLs are allowed.");
  }

  if (isBlockedHost(target.hostname)) {
    throw new Error("This host is not allowed.");
  }

  return target;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: DEFAULT_HEADERS };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const { url } = JSON.parse(event.body || "{}");
    const target = validateUrl(url);

    const response = await fetch(target, {
      method: "GET",
      headers: {
        "User-Agent": "JobMachineBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return json(response.status, { error: "The site blocked scraping or the page was unavailable." });
    }

    const html = await response.text();
    const text = cleanText(html).slice(0, 20000);

    if (!text) {
      return json(422, { error: "Could not extract readable job text from that page." });
    }

    return json(200, { text });
  } catch (error) {
    return json(400, { error: error.message || "Unable to scrape this URL." });
  }
}
