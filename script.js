const state = {
  parsedJob: null,
  matchResult: null,
};

const STOP_WORDS = new Set([
  "about", "after", "also", "been", "being", "build", "built", "company", "could", "data",
  "from", "into", "more", "must", "need", "role", "team", "their", "them", "they", "with",
  "work", "your", "years", "will", "have", "this", "that", "than", "such", "able", "using",
  "our", "you", "are", "the", "for", "and", "not", "all", "who", "how", "what", "where",
]);

const PHRASE_EXCLUSIONS = new Set([
  "about the role",
  "responsibilities",
  "required skills",
  "preferred skills",
  "what you ll do",
  "what you'll do",
  "qualifications",
]);

const SAMPLE_DATA = {
  jobUrl: "https://example.com/jobs/senior-product-manager",
  jobDescription: `Senior Product Manager

About the role
We are hiring a Senior Product Manager to lead roadmap strategy for our AI-powered hiring platform. You will partner with design, engineering, analytics, and go-to-market teams to define product direction and launch customer-facing features.

Responsibilities
- Own product strategy, roadmap planning, and prioritization
- Translate customer and market research into product requirements
- Collaborate with engineering and design on execution
- Define success metrics, analyze experiments, and communicate results
- Work cross-functionally with stakeholders across operations, sales, and customer success

Required skills
- Product management
- Roadmapping
- User research
- SQL
- Analytics
- Experimentation
- Stakeholder management
- Agile
- SaaS
- AI products`,
  resumeText: `JAY PATEL
Toronto, ON

SUMMARY
Product-minded operator with experience in SaaS workflows, customer discovery, analytics, and cross-functional execution. Comfortable translating user needs into requirements, improving internal tools, and supporting feature launches.

EXPERIENCE
Operations and Product Analyst
- Partnered with engineering and design to improve workflow tooling for internal teams
- Gathered user feedback, documented requirements, and prioritized fixes
- Built reporting views to track adoption and operational performance
- Coordinated launches with cross-functional stakeholders across support and operations

Business Systems Coordinator
- Maintained SaaS systems and improved process reliability
- Created dashboards and reports for leadership using spreadsheet and BI tools
- Supported experiment tracking and post-launch analysis

SKILLS
Product operations, stakeholder management, analytics, SaaS, agile workflows, SQL, dashboarding, user feedback, process improvement

EDUCATION
Bachelor of Commerce`,
};

const elements = {
  jobUrl: document.getElementById("jobUrl"),
  scrapeJobBtn: document.getElementById("scrapeJobBtn"),
  jobDescription: document.getElementById("jobDescription"),
  jobMeta: document.getElementById("jobMeta"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  resumeFile: document.getElementById("resumeFile"),
  resumeText: document.getElementById("resumeText"),
  summaryField: document.getElementById("summaryField"),
  experienceField: document.getElementById("experienceField"),
  skillsField: document.getElementById("skillsField"),
  educationField: document.getElementById("educationField"),
  syncResumeBtn: document.getElementById("syncResumeBtn"),
  provider: document.getElementById("provider"),
  apiKey: document.getElementById("apiKey"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  generateBtn: document.getElementById("generateBtn"),
  matchScore: document.getElementById("matchScore"),
  overlapSkills: document.getElementById("overlapSkills"),
  missingKeywords: document.getElementById("missingKeywords"),
  improvements: document.getElementById("improvements"),
  resumeOutput: document.getElementById("resumeOutput"),
  coverLetterOutput: document.getElementById("coverLetterOutput"),
  downloadResumeBtn: document.getElementById("downloadResumeBtn"),
  downloadCoverBtn: document.getElementById("downloadCoverBtn"),
  statusMessage: document.getElementById("statusMessage"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  scoreRing: document.querySelector(".score-ring"),
};

if (globalThis.pdfjsLib) {
  globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
}

elements.scrapeJobBtn.addEventListener("click", handleScrapeJob);
elements.loadSampleBtn.addEventListener("click", loadSampleData);
elements.clearAllBtn.addEventListener("click", clearAllFields);
elements.resumeFile.addEventListener("change", handleResumeUpload);
elements.resumeText.addEventListener("input", () => populateStructuredFields(elements.resumeText.value));
elements.syncResumeBtn.addEventListener("click", syncStructuredFieldsIntoResume);
elements.analyzeBtn.addEventListener("click", handleAnalyze);
elements.generateBtn.addEventListener("click", handleGenerate);
elements.downloadResumeBtn.addEventListener("click", () => exportPdf("resume"));
elements.downloadCoverBtn.addEventListener("click", () => exportPdf("cover"));
elements.tabs.forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function sanitizeText(input) {
  return String(input || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function loadSampleData() {
  elements.jobUrl.value = SAMPLE_DATA.jobUrl;
  elements.jobDescription.value = SAMPLE_DATA.jobDescription;
  elements.resumeText.value = SAMPLE_DATA.resumeText;
  elements.resumeOutput.value = "";
  elements.coverLetterOutput.value = "";
  state.parsedJob = null;
  state.matchResult = null;
  populateStructuredFields(elements.resumeText.value);
  renderJobMeta(buildLocalJobSummary(SAMPLE_DATA.jobDescription), true);
  updateMatchUI({
    score: 0,
    overlapping: [],
    missing: [],
    suggestions: [
      "Sample data loaded. Click Analyze match to generate a realistic ATS-style score.",
    ],
  });
  setStatus("Sample resume and job description loaded.");
}

function clearAllFields() {
  [
    "jobUrl",
    "jobDescription",
    "resumeText",
    "summaryField",
    "experienceField",
    "skillsField",
    "educationField",
    "resumeOutput",
    "coverLetterOutput",
    "apiKey",
  ].forEach((key) => {
    elements[key].value = "";
  });

  state.parsedJob = null;
  state.matchResult = null;
  elements.jobMeta.textContent = "No structured job summary yet.";
  updateMatchUI({
    score: 0,
    overlapping: [],
    missing: [],
    suggestions: [
      "Add a resume and job description to analyze fit and generate tailored outputs.",
    ],
  });
  setStatus("Cleared all fields.");
}

function wordsFromText(text) {
  return sanitizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function uniqueTerms(items) {
  return [...new Set(items.map((item) => sanitizeText(item).toLowerCase()).filter(Boolean))];
}

function extractKeywords(text) {
  const frequency = new Map();
  wordsFromText(text).forEach((word) => {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  });

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word]) => word);
}

function extractKeywordPhrases(text) {
  const lines = sanitizeText(text).split("\n");
  const phrases = [];

  lines.forEach((line) => {
    const cleaned = line
      .replace(/^[-*]\s*/, "")
      .replace(/[^a-zA-Z0-9+#/,& -]/g, " ")
      .trim();

    if (!cleaned || cleaned.length < 4) {
      return;
    }

    const normalizedPhrase = cleaned
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

    if (PHRASE_EXCLUSIONS.has(normalizedPhrase)) {
      return;
    }

    if (normalizedPhrase.length <= 48 && normalizedPhrase.split(/\s+/).length <= 5) {
      phrases.push(normalizedPhrase);
    }
  });

  return uniqueTerms(phrases);
}

function keywordCovered(keyword, normalizedResumeText, resumeWords) {
  if (normalizedResumeText.includes(keyword)) {
    return true;
  }

  return keyword.split(" ").every((part) => resumeWords.has(part));
}

function computeMatchScore(resumeText, parsedJob) {
  const normalizedResumeText = sanitizeText(resumeText).toLowerCase();
  const resumeWords = new Set(wordsFromText(resumeText));
  const jobKeywords = uniqueTerms([
    ...(parsedJob.skills || []),
    ...(parsedJob.keywords || []),
    ...extractKeywordPhrases(sanitizeText(elements.jobDescription.value)),
    ...extractKeywords(
      [
        parsedJob.title,
        parsedJob.company,
        ...(parsedJob.responsibilities || []),
        sanitizeText(elements.jobDescription.value),
      ].join(" "),
    ),
  ]).filter((keyword) => keyword.length > 2 && !STOP_WORDS.has(keyword));

  const overlapping = jobKeywords.filter((keyword) => keywordCovered(keyword, normalizedResumeText, resumeWords));
  const missing = jobKeywords.filter((keyword) => !overlapping.includes(keyword));
  const mustHaveTerms = uniqueTerms([...(parsedJob.skills || []), ...extractKeywordPhrases(sanitizeText(elements.jobDescription.value)).slice(0, 8)]);
  const mustHaveHits = mustHaveTerms.filter((keyword) => keywordCovered(keyword, normalizedResumeText, resumeWords));
  const coverageScore = jobKeywords.length ? (overlapping.length / jobKeywords.length) * 100 : 0;
  const mustHaveScore = mustHaveTerms.length ? (mustHaveHits.length / mustHaveTerms.length) * 100 : 0;
  const score = Math.max(18, Math.min(100, Math.round((coverageScore * 0.65) + (mustHaveScore * 0.35))));

  const suggestions = [
    missing.length ? `Add or surface evidence for: ${missing.slice(0, 5).join(", ")}.` : "Your resume already reflects most high-value target terms.",
    "Keep standard ATS headings like SUMMARY, EXPERIENCE, SKILLS, and EDUCATION.",
    "Mirror the employer's language where truthful, and place the strongest role-relevant bullets near the top.",
  ];

  return {
    score,
    overlapping,
    missing,
    suggestions,
    mustHaveHits,
  };
}

function updateMatchUI(result) {
  elements.matchScore.textContent = String(result.score);
  elements.overlapSkills.textContent = result.overlapping.length
    ? result.overlapping.join(" • ")
    : "No obvious overlap found yet.";
  elements.missingKeywords.textContent = result.missing.length
    ? result.missing.join(" • ")
    : "No major keyword gaps detected.";
  elements.improvements.textContent = result.suggestions.join(" ");
  elements.scoreRing.style.background = `radial-gradient(circle at center, #fffdf8 0 56%, transparent 57%), conic-gradient(#df5d2e ${result.score * 3.6}deg, rgba(30, 36, 48, 0.08) 0deg)`;
}

function splitResumeIntoSections(text) {
  const normalized = sanitizeText(text);
  const sectionPatterns = [
    { key: "summary", regex: /(summary|profile|professional summary)/i },
    { key: "experience", regex: /(experience|employment|work history)/i },
    { key: "skills", regex: /(skills|tools|technologies|competencies)/i },
    { key: "education", regex: /(education|certifications|training)/i },
  ];

  const lines = normalized.split("\n");
  const buckets = { summary: [], experience: [], skills: [], education: [] };
  let current = "summary";

  for (const line of lines) {
    const nextSection = sectionPatterns.find((section) => section.regex.test(line.trim()));
    if (nextSection) {
      current = nextSection.key;
      continue;
    }
    buckets[current].push(line);
  }

  return {
    summary: buckets.summary.join("\n").trim(),
    experience: buckets.experience.join("\n").trim(),
    skills: buckets.skills.join("\n").trim(),
    education: buckets.education.join("\n").trim(),
  };
}

function populateStructuredFields(resumeText) {
  const sections = splitResumeIntoSections(resumeText);
  elements.summaryField.value = sections.summary;
  elements.experienceField.value = sections.experience;
  elements.skillsField.value = sections.skills;
  elements.educationField.value = sections.education;
}

function syncStructuredFieldsIntoResume() {
  const composed = [
    "SUMMARY",
    sanitizeText(elements.summaryField.value),
    "",
    "EXPERIENCE",
    sanitizeText(elements.experienceField.value),
    "",
    "SKILLS",
    sanitizeText(elements.skillsField.value),
    "",
    "EDUCATION",
    sanitizeText(elements.educationField.value),
  ]
    .join("\n")
    .trim();

  elements.resumeText.value = composed;
  setStatus("Resume text rebuilt from editable sections.");
}

async function handleResumeUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  setStatus(`Parsing ${file.name} in the browser...`);

  try {
    const text = file.name.toLowerCase().endsWith(".pdf")
      ? await extractTextFromPdf(file)
      : await extractTextFromDocx(file);

    elements.resumeText.value = sanitizeText(text);
    populateStructuredFields(elements.resumeText.value);
    setStatus(`Loaded ${file.name}. You can edit the sections inline now.`);
  } catch (error) {
    console.error(error);
    setStatus("Could not parse that file. Paste the resume text manually and try again.");
  }
}

async function extractTextFromPdf(file) {
  const data = await file.arrayBuffer();
  const pdf = await globalThis.pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }

  return pages.join("\n");
}

async function extractTextFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await globalThis.mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function handleScrapeJob() {
  const url = sanitizeText(elements.jobUrl.value);
  if (!url) {
    setStatus("Add a job URL first, or paste the description manually.");
    return;
  }

  toggleBusy(true);
  setStatus("Fetching job description through the Netlify function...");

  try {
    const response = await fetch("/.netlify/functions/scrape-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to fetch job description.");
    }

    elements.jobDescription.value = payload.text || "";
    setStatus("Job description fetched. You can review or edit it before analysis.");
    await ensureParsedJob();
  } catch (error) {
    console.error(error);
    setStatus("Scrape blocked or unavailable. Paste the job description manually to continue.");
  } finally {
    toggleBusy(false);
  }
}

async function ensureParsedJob() {
  const jobText = sanitizeText(elements.jobDescription.value);
  const apiKey = sanitizeText(elements.apiKey.value);
  const provider = elements.provider.value;

  if (!jobText) {
    throw new Error("Add a job description first.");
  }

  if (!apiKey) {
    state.parsedJob = buildLocalJobSummary(jobText);
    renderJobMeta(state.parsedJob, true);
    return state.parsedJob;
  }

  const response = await fetch("/.netlify/functions/parse-job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobText, provider, apiKey }),
  });
  const payload = await response.json();

  if (!response.ok) {
    state.parsedJob = buildLocalJobSummary(jobText);
    renderJobMeta(state.parsedJob, true);
    return state.parsedJob;
  }

  state.parsedJob = payload.job;
  renderJobMeta(state.parsedJob, false);
  return state.parsedJob;
}

function buildLocalJobSummary(jobText) {
  const keywords = extractKeywords(jobText);
  return {
    title: "Pasted Job Description",
    company: "Unknown Company",
    responsibilities: jobText.split(/\n+/).filter(Boolean).slice(0, 6),
    skills: keywords.slice(0, 10),
    keywords: keywords.slice(0, 15),
  };
}

function renderJobMeta(job, isFallback) {
  const label = isFallback ? "Local fallback summary" : "AI-extracted job summary";
  elements.jobMeta.textContent = `${label}: ${job.title || "Untitled role"} at ${job.company || "Unknown"} | Skills: ${(job.skills || []).slice(0, 8).join(", ") || "N/A"}`;
}

async function handleAnalyze() {
  const resumeText = sanitizeText(elements.resumeText.value);
  const jobText = sanitizeText(elements.jobDescription.value);

  if (!resumeText || !jobText) {
    setStatus("Add both resume text and job description before running analysis.");
    return;
  }

  toggleBusy(true);
  setStatus("Analyzing job requirements and resume overlap...");

  try {
    const parsedJob = await ensureParsedJob();
    state.matchResult = computeMatchScore(resumeText, parsedJob);
    updateMatchUI(state.matchResult);
    setStatus("Match analysis complete.");
  } catch (error) {
    console.error(error);
    setStatus("Could not analyze the match. Check your job description and try again.");
  } finally {
    toggleBusy(false);
  }
}

async function handleGenerate() {
  const resume = sanitizeText(elements.resumeText.value);
  const jobText = sanitizeText(elements.jobDescription.value);
  const provider = elements.provider.value;
  const apiKey = sanitizeText(elements.apiKey.value);

  if (!resume || !jobText) {
    setStatus("Resume and job description are required. API key can be blank only if server-side provider keys are configured.");
    return;
  }

  toggleBusy(true);
  setStatus(`Generating tailored resume and cover letter with ${provider}...`);

  try {
    const parsedJob = state.parsedJob || (await ensureParsedJob());
    if (!state.matchResult) {
      state.matchResult = computeMatchScore(resume, parsedJob);
      updateMatchUI(state.matchResult);
    }

    const response = await fetch("/.netlify/functions/generate-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume,
        job: sanitizeText(jobText),
        provider,
        apiKey,
        matchResult: state.matchResult,
        parsedJob,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Generation failed.");
    }

    elements.resumeOutput.value = payload.resume || "";
    elements.coverLetterOutput.value = payload.coverLetter || "";
    setActiveTab("resumeOutput");
    setStatus("Documents generated. Review and edit before exporting.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Document generation failed.");
  } finally {
    toggleBusy(false);
  }
}

function setActiveTab(targetId) {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === targetId);
  });
  elements.resumeOutput.classList.toggle("hidden", targetId !== "resumeOutput");
  elements.coverLetterOutput.classList.toggle("hidden", targetId !== "coverLetterOutput");
}

function exportPdf(kind) {
  const source = kind === "resume" ? elements.resumeOutput.value : elements.coverLetterOutput.value;
  if (!sanitizeText(source)) {
    setStatus(`Generate a ${kind === "resume" ? "resume" : "cover letter"} first.`);
    return;
  }

  const { jsPDF } = globalThis.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const lines = pdf.splitTextToSize(source, width);
  let cursorY = margin;

  lines.forEach((line) => {
    if (cursorY > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      cursorY = margin;
    }
    pdf.text(line, margin, cursorY);
    cursorY += 16;
  });

  pdf.save(kind === "resume" ? "tailored-resume.pdf" : "cover-letter.pdf");
  setStatus(`${kind === "resume" ? "Resume" : "Cover letter"} PDF downloaded.`);
}

function toggleBusy(isBusy) {
  [elements.scrapeJobBtn, elements.analyzeBtn, elements.generateBtn].forEach((button) => {
    button.disabled = isBusy;
  });
}
