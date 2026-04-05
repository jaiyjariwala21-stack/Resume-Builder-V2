const APP_URL = "https://resume-builder-v2-jaiyjariwala21.netlify.app/";
const STORAGE_KEYS = {
  billingEmail: "jobMachineExtensionBillingEmail",
  defaultResume: "jobMachineExtensionDefaultResume",
  provider: "jobMachineExtensionProvider",
};

const elements = {
  billingEmail: document.getElementById("billingEmail"),
  provider: document.getElementById("provider"),
  defaultResume: document.getElementById("defaultResume"),
  saveResumeBtn: document.getElementById("saveResumeBtn"),
  openGeneratorBtn: document.getElementById("openGeneratorBtn"),
  autoGenerateBtn: document.getElementById("autoGenerateBtn"),
  status: document.getElementById("status"),
};

bootstrap();

elements.saveResumeBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.defaultResume]: sanitize(elements.defaultResume.value),
    [STORAGE_KEYS.billingEmail]: sanitize(elements.billingEmail.value),
    [STORAGE_KEYS.provider]: elements.provider.value,
  });
  setStatus("Default resume saved inside the extension.");
});

elements.openGeneratorBtn.addEventListener("click", () => captureAndOpen(false));
elements.autoGenerateBtn.addEventListener("click", () => captureAndOpen(true));

async function bootstrap() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.billingEmail,
    STORAGE_KEYS.defaultResume,
    STORAGE_KEYS.provider,
  ]);

  elements.billingEmail.value = stored[STORAGE_KEYS.billingEmail] || "";
  elements.defaultResume.value = stored[STORAGE_KEYS.defaultResume] || "";
  elements.provider.value = stored[STORAGE_KEYS.provider] || "google";
}

async function captureAndOpen(autoGenerate) {
  setStatus("Capturing the current job page...");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab found.");
    return;
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const title = document.querySelector("h1")?.textContent?.trim() || document.title || "";
      const description = Array.from(document.querySelectorAll("main, article, section, body"))
        .map((node) => node.innerText || "")
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 6000);
      return {
        title,
        pageText: description,
        sourceUrl: window.location.href,
      };
    },
  });

  if (!result?.pageText) {
    setStatus("Could not capture enough job text from this page.");
    return;
  }

  const payload = {
    sourceUrl: result.sourceUrl,
    jobUrl: result.sourceUrl,
    jobDescription: result.pageText,
    title: result.title,
    billingEmail: sanitize(elements.billingEmail.value),
    provider: elements.provider.value,
    resumeText: sanitize(elements.defaultResume.value),
    capturedAt: new Date().toISOString(),
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.billingEmail]: payload.billingEmail,
    [STORAGE_KEYS.defaultResume]: payload.resumeText,
    [STORAGE_KEYS.provider]: payload.provider,
  });

  const url = new URL(APP_URL);
  url.searchParams.set("payload", encodeURIComponent(JSON.stringify(payload)));
  if (autoGenerate) {
    url.searchParams.set("autogen", "1");
  }
  await chrome.tabs.create({ url: url.toString() });
  setStatus(autoGenerate ? "Opening Job Machine and triggering generation..." : "Opening Job Machine...");
}

function sanitize(value) {
  return String(value || "").replace(/\u0000/g, "").trim();
}

function setStatus(message) {
  elements.status.textContent = message;
}
