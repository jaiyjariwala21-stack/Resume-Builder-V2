const jobDescription = `Senior Product Manager

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
- AI products`;

const resumes = [
  {
    name: "Sample A - Weak ATS alignment",
    resume: `JAY PATEL
Toronto, ON

SUMMARY
Business operations professional supporting internal workflows and reporting.

EXPERIENCE
Operations Coordinator
- Helped different teams complete tasks on time
- Supported internal requests and updates
- Built reports for leadership

SKILLS
Operations, communication, reporting, spreadsheets

EDUCATION
Bachelor of Commerce`,
  },
  {
    name: "Sample B - Good ATS alignment",
    resume: `JAY PATEL
Toronto, ON

SUMMARY
Product-minded operations and analytics professional with SaaS experience, cross-functional stakeholder management, SQL reporting, and user-feedback-driven workflow improvement.

EXPERIENCE
Operations and Product Analyst
- Partnered with engineering and design to improve workflow tooling for internal teams
- Gathered user feedback, documented product requirements, and prioritized fixes
- Built SQL-backed reporting views to track adoption and operational performance
- Coordinated launches with cross-functional stakeholders across support and operations

Business Systems Coordinator
- Improved SaaS process reliability and supported analytics reporting for leadership
- Supported experiment tracking and post-launch analysis for operational changes

SKILLS
Product operations, stakeholder management, SQL, analytics, SaaS, agile workflows, user research, experimentation

EDUCATION
Bachelor of Commerce`,
  },
  {
    name: "Sample C - Strong ATS alignment",
    resume: `JAY PATEL
Toronto, ON

SUMMARY
ATS-friendly product and analytics professional with experience supporting SaaS and AI-adjacent workflow products. Brings strength in roadmap support, stakeholder management, user research synthesis, SQL analysis, experimentation, and cross-functional execution with engineering and design teams.

EXPERIENCE
Operations and Product Analyst
- Partnered with engineering, design, and operations stakeholders to shape product requirements and prioritize workflow improvements
- Synthesized user feedback and market research themes into structured requirements for internal SaaS tooling
- Built SQL reporting and analytics dashboards to measure adoption, workflow efficiency, and launch performance
- Supported roadmap planning, release coordination, and communication across cross-functional teams
- Helped evaluate experiments, document success metrics, and summarize launch outcomes

Business Systems Coordinator
- Maintained SaaS systems and improved process reliability for customer-facing and internal operations
- Supported stakeholder alignment across support, operations, and leadership during rollout planning
- Produced recurring analytics and performance summaries for decision-making

SKILLS
Product management support, roadmapping, stakeholder management, user research, SQL, analytics, experimentation, agile, SaaS, AI products

EDUCATION
Bachelor of Commerce`,
  },
];

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

function sanitizeText(input) {
  return String(input || "").replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
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
    const cleaned = line.replace(/^[-*]\s*/, "").replace(/[^a-zA-Z0-9+#/,& -]/g, " ").trim();
    if (!cleaned || cleaned.length < 4) {
      return;
    }
    const normalizedPhrase = cleaned.toLowerCase().replace(/\s+/g, " ").trim();
    if (PHRASE_EXCLUSIONS.has(normalizedPhrase)) {
      return;
    }
    if (normalizedPhrase.length <= 48 && normalizedPhrase.split(/\s+/).length <= 5) {
      phrases.push(normalizedPhrase);
    }
  });
  return uniqueTerms(phrases);
}

function buildLocalJobSummary(jobText) {
  const keywords = extractKeywords(jobText);
  return {
    title: "Senior Product Manager",
    company: "Example Company",
    responsibilities: jobText.split(/\n+/).filter(Boolean).slice(0, 10),
    skills: keywords.slice(0, 12),
    keywords: keywords.slice(0, 18),
  };
}

function keywordCovered(keyword, normalizedResumeText, resumeWords) {
  if (normalizedResumeText.includes(keyword)) {
    return true;
  }
  return keyword.split(" ").every((part) => resumeWords.has(part));
}

function computeMatchScore(resumeText, parsedJob, rawJobText) {
  const normalizedResumeText = sanitizeText(resumeText).toLowerCase();
  const resumeWords = new Set(wordsFromText(resumeText));
  const jobKeywords = uniqueTerms([
    ...(parsedJob.skills || []),
    ...(parsedJob.keywords || []),
    ...extractKeywordPhrases(rawJobText),
    ...extractKeywords(
      [
        parsedJob.title,
        parsedJob.company,
        ...(parsedJob.responsibilities || []),
        sanitizeText(rawJobText),
      ].join(" "),
    ),
  ]).filter((keyword) => keyword.length > 2 && !STOP_WORDS.has(keyword));

  const overlapping = jobKeywords.filter((keyword) => keywordCovered(keyword, normalizedResumeText, resumeWords));
  const missing = jobKeywords.filter((keyword) => !overlapping.includes(keyword));
  const mustHaveTerms = uniqueTerms([...(parsedJob.skills || []), ...extractKeywordPhrases(rawJobText).slice(0, 8)]);
  const mustHaveHits = mustHaveTerms.filter((keyword) => keywordCovered(keyword, normalizedResumeText, resumeWords));
  const coverageScore = jobKeywords.length ? (overlapping.length / jobKeywords.length) * 100 : 0;
  const mustHaveScore = mustHaveTerms.length ? (mustHaveHits.length / mustHaveTerms.length) * 100 : 0;
  const score = Math.max(18, Math.min(100, Math.round((coverageScore * 0.65) + (mustHaveScore * 0.35))));

  return {
    score,
    overlapping: overlapping.slice(0, 12),
    missing: missing.slice(0, 12),
  };
}

const parsedJob = buildLocalJobSummary(jobDescription);
const results = resumes.map((item) => ({
  name: item.name,
  ...computeMatchScore(item.resume, parsedJob, jobDescription),
}));

console.log(JSON.stringify(results, null, 2));
