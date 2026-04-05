export const DEFAULT_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...DEFAULT_HEADERS,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function sanitize(input) {
  return String(input || "").replace(/\u0000/g, "").trim();
}

export function formBody(values) {
  return new URLSearchParams(values).toString();
}

export function parseJsonBody(body) {
  try {
    return JSON.parse(body || "{}");
  } catch {
    return {};
  }
}

export function parseCookies(cookieHeader) {
  const cookies = {};
  String(cookieHeader || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) {
        return;
      }
      const key = item.slice(0, separatorIndex);
      const value = item.slice(separatorIndex + 1);
      cookies[key] = decodeURIComponent(value);
    });
  return cookies;
}
