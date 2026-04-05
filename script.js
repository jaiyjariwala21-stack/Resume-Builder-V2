const FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyBlqsUErm4_xrDmDOa7esIsXJqxJdlEh3Q",
  authDomain: "resume-builder-v2-c132b.firebaseapp.com",
  projectId: "resume-builder-v2-c132b",
  storageBucket: "resume-builder-v2-c132b.firebasestorage.app",
  messagingSenderId: "814881794647",
  appId: "1:814881794647:web:1d78caf85eb3c513c05112",
  measurementId: "G-V2NGRRMV8K",
};

const WORKSPACE_STORAGE_KEY = "job-machine-workspace-v1";
const DEFAULT_RESUME_STORAGE_KEY = "job-machine-default-resume-v1";

const state = {
  parsedJob: null,
  matchResult: null,
  accessStatus: null,
  currentUser: null,
  accountBusy: false,
  firebaseReady: false,
  firebaseFailed: false,
  savedRecords: [],
  billingHistory: [],
  firebase: null,
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
  billingEmail: document.getElementById("billingEmail"),
  buySingleBtn: document.getElementById("buySingleBtn"),
  buyMonthlyBtn: document.getElementById("buyMonthlyBtn"),
  refreshAccessBtn: document.getElementById("refreshAccessBtn"),
  manageBillingBtn: document.getElementById("manageBillingBtn"),
  accessStatus: document.getElementById("accessStatus"),
  accountEmail: document.getElementById("accountEmail"),
  accountPassword: document.getElementById("accountPassword"),
  signUpBtn: document.getElementById("signUpBtn"),
  signInBtn: document.getElementById("signInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  saveResumeBtn: document.getElementById("saveResumeBtn"),
  saveOutputBtn: document.getElementById("saveOutputBtn"),
  accountStatus: document.getElementById("accountStatus"),
  savedResumes: document.getElementById("savedResumes"),
  billingHistory: document.getElementById("billingHistory"),
  saveDefaultResumeBtn: document.getElementById("saveDefaultResumeBtn"),
  useDefaultResumeBtn: document.getElementById("useDefaultResumeBtn"),
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
elements.saveDefaultResumeBtn.addEventListener("click", saveDefaultResume);
elements.useDefaultResumeBtn.addEventListener("click", loadDefaultResumeIntoEditor);
elements.analyzeBtn.addEventListener("click", handleAnalyze);
elements.generateBtn.addEventListener("click", handleGenerate);
elements.buySingleBtn.addEventListener("click", () => startCheckout("single"));
elements.buyMonthlyBtn.addEventListener("click", () => startCheckout("subscription"));
elements.refreshAccessBtn.addEventListener("click", loadAccessStatus);
elements.manageBillingBtn.addEventListener("click", openBillingPortal);
elements.signUpBtn.addEventListener("click", handleSignUp);
elements.signInBtn.addEventListener("click", handleSignIn);
elements.signOutBtn.addEventListener("click", handleSignOut);
elements.saveResumeBtn.addEventListener("click", () => saveWorkspaceRecord("resume"));
elements.saveOutputBtn.addEventListener("click", () => saveWorkspaceRecord("draft"));
elements.downloadResumeBtn.addEventListener("click", () => exportPdf("resume"));
elements.downloadCoverBtn.addEventListener("click", () => exportPdf("cover"));
elements.tabs.forEach((tab) => tab.addEventListener("click", () => setActiveTab(tab.dataset.tab)));
[
  elements.jobUrl,
  elements.jobDescription,
  elements.resumeText,
  elements.summaryField,
  elements.experienceField,
  elements.skillsField,
  elements.educationField,
  elements.provider,
  elements.billingEmail,
  elements.resumeOutput,
  elements.coverLetterOutput,
].forEach((element) => {
  element.addEventListener("input", persistWorkspaceSnapshot);
  element.addEventListener("change", persistWorkspaceSnapshot);
});

renderSavedRecords();
renderBillingHistory();
renderAccountState();
restoreWorkspaceSnapshot();
bootstrapBillingState();
initOptionalAccount();

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function setAccountStatus(message) {
  elements.accountStatus.textContent = message;
}

async function bootstrapBillingState() {
  restoreExtensionPrefill();
  const params = new URLSearchParams(window.location.search);
  const checkoutStatus = params.get("checkout");
  const sessionId = params.get("session_id");
  const autoGenerate = params.get("autogen");

  if (checkoutStatus === "success" && sessionId) {
    await finalizeCheckout(sessionId);
    params.delete("checkout");
    params.delete("session_id");
    params.delete("billing");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  } else if (checkoutStatus === "cancelled") {
    setStatus("Checkout was cancelled. You can try again anytime.");
  }

  await loadAccessStatus();

  if (autoGenerate === "1" && sanitizeText(elements.resumeText.value) && sanitizeText(elements.jobDescription.value)) {
    await handleGenerate();
    params.delete("autogen");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }
}

async function initOptionalAccount() {
  setAccountStatus("Loading optional account tools...");

  try {
    const [
      appModule,
      authModule,
      firestoreModule,
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"),
    ]);

    const app = appModule.initializeApp(FIREBASE_WEB_CONFIG);
    const auth = authModule.getAuth(app);
    const db = firestoreModule.getFirestore(app);

    state.firebase = {
      auth,
      db,
      createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
      signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
      signOut: authModule.signOut,
      onAuthStateChanged: authModule.onAuthStateChanged,
      doc: firestoreModule.doc,
      setDoc: firestoreModule.setDoc,
      addDoc: firestoreModule.addDoc,
      getDocs: firestoreModule.getDocs,
      collection: firestoreModule.collection,
      query: firestoreModule.query,
      where: firestoreModule.where,
      serverTimestamp: firestoreModule.serverTimestamp,
    };

    state.firebaseReady = true;
    state.firebase.onAuthStateChanged(auth, async (user) => {
      state.currentUser = user || null;
      renderAccountState();

      if (!user) {
        state.savedRecords = [];
        state.billingHistory = [];
        renderSavedRecords();
        renderBillingHistory();
        return;
      }

      if (!sanitizeText(elements.billingEmail.value)) {
        elements.billingEmail.value = user.email || "";
      }
      elements.accountEmail.value = user.email || "";
      await Promise.all([loadSavedRecords(), loadBillingHistory()]);
    });
  } catch (error) {
    console.error(error);
    state.firebaseFailed = true;
    setAccountStatus("Optional account tools could not load. Guest mode and billing still work.");
    renderAccountState();
  }
}

function renderAccountState() {
  const signedIn = Boolean(state.currentUser);
  elements.signOutBtn.disabled = state.accountBusy || !signedIn;
  elements.saveResumeBtn.disabled = state.accountBusy || !signedIn;
  elements.saveOutputBtn.disabled = state.accountBusy || !signedIn;

  if (state.firebaseFailed) {
    elements.signUpBtn.disabled = true;
    elements.signInBtn.disabled = true;
    return;
  }

  if (!state.firebaseReady) {
    elements.signUpBtn.disabled = true;
    elements.signInBtn.disabled = true;
    return;
  }

  elements.signUpBtn.disabled = state.accountBusy || signedIn;
  elements.signInBtn.disabled = state.accountBusy || signedIn;

  if (signedIn) {
    const email = state.currentUser.email || "account user";
    setAccountStatus(`Signed in as ${email}. You can now save resumes, drafts, and review billing history.`);
    return;
  }

  setAccountStatus(
    state.firebaseReady
      ? "Guest mode active. Sign in only if you want saved history."
      : "Loading optional account tools...",
  );
}

function getWorkspaceSnapshot() {
  return {
    jobUrl: elements.jobUrl.value,
    jobDescription: elements.jobDescription.value,
    resumeText: elements.resumeText.value,
    summary: elements.summaryField.value,
    experience: elements.experienceField.value,
    skills: elements.skillsField.value,
    education: elements.educationField.value,
    provider: elements.provider.value,
    billingEmail: elements.billingEmail.value,
    resumeOutput: elements.resumeOutput.value,
    coverLetterOutput: elements.coverLetterOutput.value,
  };
}

function persistWorkspaceSnapshot() {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(getWorkspaceSnapshot()));
  } catch (error) {
    console.error(error);
  }
}

function restoreWorkspaceSnapshot() {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const snapshot = JSON.parse(raw);
    applyWorkspaceSnapshot(snapshot, false);
  } catch (error) {
    console.error(error);
  }
}

function applyWorkspaceSnapshot(snapshot, announce = true) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  if (typeof snapshot.jobUrl === "string") elements.jobUrl.value = snapshot.jobUrl;
  if (typeof snapshot.jobDescription === "string") elements.jobDescription.value = snapshot.jobDescription;
  if (typeof snapshot.resumeText === "string") elements.resumeText.value = snapshot.resumeText;
  if (typeof snapshot.summary === "string") elements.summaryField.value = snapshot.summary;
  if (typeof snapshot.experience === "string") elements.experienceField.value = snapshot.experience;
  if (typeof snapshot.skills === "string") elements.skillsField.value = snapshot.skills;
  if (typeof snapshot.education === "string") elements.educationField.value = snapshot.education;
  if (typeof snapshot.provider === "string") elements.provider.value = snapshot.provider;
  if (typeof snapshot.billingEmail === "string") elements.billingEmail.value = snapshot.billingEmail;
  if (typeof snapshot.resumeOutput === "string") elements.resumeOutput.value = snapshot.resumeOutput;
  if (typeof snapshot.coverLetterOutput === "string") elements.coverLetterOutput.value = snapshot.coverLetterOutput;

  if (!elements.summaryField.value && elements.resumeText.value) {
    populateStructuredFields(elements.resumeText.value);
  }

  persistWorkspaceSnapshot();
  if (announce) {
    setStatus("Workspace restored.");
  }
}

function saveDefaultResume() {
  const resumeText = sanitizeText(elements.resumeText.value);
  if (!resumeText) {
    setStatus("Add resume text before saving a default resume.");
    return;
  }

  const payload = {
    resumeText,
    summary: elements.summaryField.value,
    experience: elements.experienceField.value,
    skills: elements.skillsField.value,
    education: elements.educationField.value,
    savedAt: new Date().toISOString(),
  };

  localStorage.setItem(DEFAULT_RESUME_STORAGE_KEY, JSON.stringify(payload));
  persistWorkspaceSnapshot();
  setStatus("Default resume saved for quick reuse.");
}

function loadDefaultResumeIntoEditor() {
  try {
    const raw = localStorage.getItem(DEFAULT_RESUME_STORAGE_KEY);
    if (!raw) {
      setStatus("No default resume saved yet.");
      return;
    }
    const payload = JSON.parse(raw);
    applyWorkspaceSnapshot(payload, false);
    setStatus("Default resume loaded.");
  } catch (error) {
    console.error(error);
    setStatus("Could not load the default resume.");
  }
}

function restoreExtensionPrefill() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encodedPayload = params.get("payload");
    if (!encodedPayload) {
      return;
    }

    const payload = JSON.parse(decodeURIComponent(encodedPayload));
    const defaultResumeRaw = localStorage.getItem(DEFAULT_RESUME_STORAGE_KEY);
    const defaultResume = defaultResumeRaw ? JSON.parse(defaultResumeRaw) : null;

    applyWorkspaceSnapshot({
      jobUrl: payload.jobUrl || payload.sourceUrl || "",
      jobDescription: payload.jobDescription || payload.pageText || "",
      provider: payload.provider || elements.provider.value,
      billingEmail: payload.billingEmail || elements.billingEmail.value,
      resumeText: payload.resumeText || defaultResume?.resumeText || elements.resumeText.value,
      summary: defaultResume?.summary || elements.summaryField.value,
      experience: defaultResume?.experience || elements.experienceField.value,
      skills: defaultResume?.skills || elements.skillsField.value,
      education: defaultResume?.education || elements.educationField.value,
    }, false);

    if (payload.jobDescription || payload.pageText) {
      state.parsedJob = buildLocalJobSummary(payload.jobDescription || payload.pageText || "");
      renderJobMeta(state.parsedJob, true);
    }

    params.delete("payload");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
    setStatus("Job details imported from the browser extension.");
  } catch (error) {
    console.error(error);
  }
}

function sanitizeText(input) {
  return String(input || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

async function ensureFirebaseClient() {
  if (state.firebaseReady && state.firebase) {
    return state.firebase;
  }

  if (state.firebaseFailed) {
    throw new Error("Firebase account tools are unavailable right now.");
  }

  throw new Error("Firebase account tools are still loading. Try again in a moment.");
}

async function handleSignUp() {
  const firebase = await ensureFirebaseClient().catch((error) => {
    setStatus(error.message);
    throw error;
  });
  const email = sanitizeText(elements.accountEmail.value).toLowerCase();
  const password = sanitizeText(elements.accountPassword.value);

  if (!email || !password) {
    setStatus("Enter an account email and password first.");
    return;
  }

  toggleAccountBusy(true);
  setStatus("Creating your account...");

  try {
    const credential = await firebase.createUserWithEmailAndPassword(firebase.auth, email, password);
    await firebase.setDoc(firebase.doc(firebase.db, "users", credential.user.uid), {
      email,
      createdAt: firebase.serverTimestamp(),
      updatedAt: firebase.serverTimestamp(),
    }, { merge: true });
    elements.billingEmail.value = email;
    setStatus("Account created. You can now save resumes and drafts.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to create account.");
  } finally {
    toggleAccountBusy(false);
  }
}

async function handleSignIn() {
  const firebase = await ensureFirebaseClient().catch((error) => {
    setStatus(error.message);
    throw error;
  });
  const email = sanitizeText(elements.accountEmail.value).toLowerCase();
  const password = sanitizeText(elements.accountPassword.value);

  if (!email || !password) {
    setStatus("Enter your account email and password first.");
    return;
  }

  toggleAccountBusy(true);
  setStatus("Signing you in...");

  try {
    await firebase.signInWithEmailAndPassword(firebase.auth, email, password);
    elements.billingEmail.value = email;
    setStatus("Signed in successfully.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to sign in.");
  } finally {
    toggleAccountBusy(false);
  }
}

async function handleSignOut() {
  const firebase = await ensureFirebaseClient().catch((error) => {
    setStatus(error.message);
    throw error;
  });

  toggleAccountBusy(true);
  setStatus("Signing out...");

  try {
    await firebase.signOut(firebase.auth);
    elements.accountPassword.value = "";
    setStatus("Signed out. Guest mode is still available.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to sign out.");
  } finally {
    toggleAccountBusy(false);
  }
}

async function saveWorkspaceRecord(recordType) {
  const firebase = await ensureFirebaseClient().catch((error) => {
    setStatus(error.message);
    throw error;
  });
  const user = state.currentUser;
  if (!user) {
    setStatus("Sign in first if you want to save resumes or generated drafts.");
    return;
  }

  const resumeText = sanitizeText(elements.resumeText.value);
  const resumeOutput = sanitizeText(elements.resumeOutput.value);
  const coverLetterOutput = sanitizeText(elements.coverLetterOutput.value);

  if (recordType === "resume" && !resumeText) {
    setStatus("Add resume text before saving a resume snapshot.");
    return;
  }

  if (recordType === "draft" && !resumeOutput && !coverLetterOutput) {
    setStatus("Generate content first, then save the draft.");
    return;
  }

  toggleAccountBusy(true);
  setStatus(recordType === "resume" ? "Saving resume snapshot..." : "Saving generated draft...");

  const titleSource = recordType === "resume" ? resumeText : resumeOutput || coverLetterOutput;
  const title = inferRecordTitle(titleSource, recordType);

  try {
    await firebase.addDoc(firebase.collection(firebase.db, "savedResumes"), {
      ownerUid: user.uid,
      ownerEmail: user.email || "",
      recordType,
      title,
      resumeText,
      summary: sanitizeText(elements.summaryField.value),
      experience: sanitizeText(elements.experienceField.value),
      skills: sanitizeText(elements.skillsField.value),
      education: sanitizeText(elements.educationField.value),
      jobDescription: sanitizeText(elements.jobDescription.value),
      parsedJobTitle: sanitizeText(state.parsedJob?.title),
      parsedJobCompany: sanitizeText(state.parsedJob?.company),
      generatedResume: resumeOutput,
      generatedCoverLetter: coverLetterOutput,
      createdAt: firebase.serverTimestamp(),
      updatedAt: firebase.serverTimestamp(),
    });

    await loadSavedRecords();
    setStatus(recordType === "resume" ? "Resume snapshot saved." : "Generated draft saved.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to save this record.");
  } finally {
    toggleAccountBusy(false);
  }
}

function inferRecordTitle(text, recordType) {
  const firstLine = sanitizeText(text).split("\n").find(Boolean) || "";
  if (firstLine) {
    return firstLine.slice(0, 72);
  }
  return recordType === "resume" ? "Resume snapshot" : "Generated draft";
}

async function loadSavedRecords() {
  const firebase = await ensureFirebaseClient();
  const user = state.currentUser;
  if (!user) {
    state.savedRecords = [];
    renderSavedRecords();
    return;
  }

  try {
    const snapshot = await firebase.getDocs(
      firebase.query(
        firebase.collection(firebase.db, "savedResumes"),
        firebase.where("ownerUid", "==", user.uid),
      ),
    );

    state.savedRecords = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .sort((left, right) => getComparableTime(right.updatedAt || right.createdAt) - getComparableTime(left.updatedAt || left.createdAt));
    renderSavedRecords();
  } catch (error) {
    console.error(error);
    elements.savedResumes.textContent = "Could not load saved resumes yet. Check your Firestore rules.";
  }
}

async function loadBillingHistory() {
  const firebase = await ensureFirebaseClient();
  const user = state.currentUser;
  if (!user?.email) {
    state.billingHistory = [];
    renderBillingHistory();
    return;
  }

  try {
    const snapshot = await firebase.getDocs(
      firebase.query(
        firebase.collection(firebase.db, "billingHistory"),
        firebase.where("email", "==", user.email.toLowerCase()),
      ),
    );

    state.billingHistory = snapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      .sort((left, right) => getComparableTime(right.createdAt) - getComparableTime(left.createdAt));
    renderBillingHistory();
  } catch (error) {
    console.error(error);
    elements.billingHistory.textContent = "Could not load billing history yet. Check your Firestore rules.";
  }
}

function renderSavedRecords() {
  elements.savedResumes.innerHTML = "";

  if (!state.currentUser) {
    elements.savedResumes.textContent = "Sign in to save and load resume versions.";
    return;
  }

  if (!state.savedRecords.length) {
    elements.savedResumes.textContent = "No saved resumes yet. Save a resume snapshot or generated draft to build your library.";
    return;
  }

  state.savedRecords.forEach((record) => {
    const card = document.createElement("article");
    card.className = "saved-card";

    const heading = document.createElement("h4");
    heading.textContent = `${record.recordType === "draft" ? "Draft" : "Resume"} · ${record.title || "Untitled"}`;

    const meta = document.createElement("p");
    meta.textContent = `${record.parsedJobTitle || "General"} · ${formatDisplayDate(record.updatedAt || record.createdAt)}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost-button";
    button.textContent = "Load";
    button.addEventListener("click", () => loadSavedRecordIntoEditor(record));

    card.append(heading, meta, button);
    elements.savedResumes.append(card);
  });
}

function renderBillingHistory() {
  elements.billingHistory.innerHTML = "";

  if (!state.currentUser) {
    elements.billingHistory.textContent = "Sign in with the same billing email to see payment history.";
    return;
  }

  if (!state.billingHistory.length) {
    elements.billingHistory.textContent = "No billing history found yet for this signed-in email.";
    return;
  }

  state.billingHistory.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "saved-card";

    const heading = document.createElement("h4");
    heading.textContent = formatBillingKind(entry.kind, entry.planMode);

    const meta = document.createElement("p");
    const amount = sanitizeText(entry.amountLabel) || "Amount pending";
    meta.textContent = `${amount} · ${sanitizeText(entry.status || "recorded")} · ${formatDisplayDate(entry.createdAt)}`;

    card.append(heading, meta);
    elements.billingHistory.append(card);
  });
}

function loadSavedRecordIntoEditor(record) {
  elements.resumeText.value = sanitizeText(record.resumeText);
  elements.summaryField.value = sanitizeText(record.summary);
  elements.experienceField.value = sanitizeText(record.experience);
  elements.skillsField.value = sanitizeText(record.skills);
  elements.educationField.value = sanitizeText(record.education);
  elements.jobDescription.value = sanitizeText(record.jobDescription);
  elements.resumeOutput.value = sanitizeText(record.generatedResume);
  elements.coverLetterOutput.value = sanitizeText(record.generatedCoverLetter);

  if (!elements.summaryField.value || !elements.experienceField.value) {
    populateStructuredFields(elements.resumeText.value);
  }

  if (elements.resumeOutput.value || elements.coverLetterOutput.value) {
    setActiveTab(elements.resumeOutput.value ? "resumeOutput" : "coverLetterOutput");
  }

  state.parsedJob = null;
  state.matchResult = null;
  persistWorkspaceSnapshot();
  setStatus(`Loaded "${record.title || "saved record"}" into the editor.`);
}

function getComparableTime(value) {
  if (!value) {
    return 0;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }

  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDisplayDate(value) {
  const comparable = getComparableTime(value);
  if (!comparable) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(comparable));
}

function formatBillingKind(kind, planMode) {
  if (kind === "subscription_checkout") {
    return "Subscription started";
  }
  if (kind === "single_checkout") {
    return "Single resume purchase";
  }
  if (kind === "invoice_paid") {
    return "Subscription renewal paid";
  }
  if (kind === "subscription_status") {
    return `Subscription status updated${planMode ? ` (${planMode})` : ""}`;
  }
  if (kind === "refund") {
    return "Refund processed";
  }
  return "Billing event";
}

async function finalizeCheckout(sessionId) {
  try {
    setStatus("Finalizing your paid access...");
    const response = await fetch("/.netlify/functions/finalize-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to finalize checkout.");
    }
    setStatus(payload.message || "Paid access activated.");
    if (state.currentUser) {
      await loadBillingHistory();
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to finalize checkout.");
  }
}

async function loadAccessStatus() {
  try {
    const response = await fetch("/.netlify/functions/access-status");
    const payload = await response.json();
    state.accessStatus = payload;
    renderAccessStatus(payload);
  } catch (error) {
    console.error(error);
    elements.accessStatus.textContent = "Could not load billing access status.";
  }
}

function renderAccessStatus(payload) {
  if (!payload?.authenticated) {
    elements.accessStatus.textContent = payload?.billingConfigured
      ? "No paid session detected yet. Buy a credit or subscription to use server-side billing."
      : "Billing storage is not configured yet. For now, use your own API key.";
    return;
  }

  const profile = payload.profile || {};
  elements.accessStatus.textContent = `Signed in as ${payload.email}. ${payload.reason || ""} Credits: ${profile.resumeCredits ?? 0}. Subscription: ${profile.hasActiveSubscription ? "active" : (profile.subscriptionStatus || "inactive")}.`;
}

async function startCheckout(mode) {
  const customerEmail = sanitizeText(elements.billingEmail.value);
  if (!customerEmail) {
    setStatus("Enter your billing email before starting checkout.");
    return;
  }

  toggleBillingBusy(true);
  setStatus(mode === "subscription" ? "Creating monthly checkout..." : "Creating one-time checkout...");

  try {
    const response = await fetch("/.netlify/functions/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, customerEmail }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to create checkout session.");
    }
    window.location.href = payload.url;
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to start checkout.");
    toggleBillingBusy(false);
  }
}

async function openBillingPortal() {
  toggleBillingBusy(true);
  setStatus("Opening billing portal...");

  try {
    const response = await fetch("/.netlify/functions/create-customer-portal", {
      method: "POST",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Unable to open billing portal.");
    }
    window.location.href = payload.url;
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to open billing portal.");
    toggleBillingBusy(false);
  }
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
  persistWorkspaceSnapshot();
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
  persistWorkspaceSnapshot();
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
    persistWorkspaceSnapshot();
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
    persistWorkspaceSnapshot();
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
    persistWorkspaceSnapshot();
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

function toggleBillingBusy(isBusy) {
  [elements.buySingleBtn, elements.buyMonthlyBtn, elements.refreshAccessBtn, elements.manageBillingBtn].forEach((button) => {
    button.disabled = isBusy;
  });
}

function toggleAccountBusy(isBusy) {
  state.accountBusy = isBusy;
  renderAccountState();
}
