// Medicus Onboarding App - vanilla JS, zero dependencies, zero API calls at runtime

const ROLES = [
  { id: "HCA",                icon: "🏥", color: "#00b4d8", desc: "Health Care Assistant" },
  { id: "ANP",                icon: "🩺", color: "#4cc9f0", desc: "Advanced Nurse Practitioner" },
  { id: "Nurse",              icon: "💉", color: "#7b2d8b", desc: "Practice Nurse" },
  { id: "Paramedic",          icon: "🚑", color: "#f77f00", desc: "Practice Paramedic" },
  { id: "Pharmacist",         icon: "💊", color: "#2dc653", desc: "Clinical Pharmacist" },
  { id: "Dispenser",          icon: "📋", color: "#f4d03f", desc: "Dispenser" },
  { id: "Pharmacy Technician",icon: "⚗️", color: "#00f5d4", desc: "Pharmacy Technician" },
  { id: "Receptionist",       icon: "📞", color: "#e94560", desc: "Receptionist" },
  { id: "Administrator",      icon: "⚙️",  color: "#8892a4", desc: "Practice Administrator / Manager" },
  { id: "Other Clinical",     icon: "🔬", color: "#a78bfa", desc: "Other Clinical Staff" },
];

// ── State ──────────────────────────────────────────────────────────────────

let state = {
  articles: [],
  quizzes:  {},
  view: "home",       // welcome | home | role | quiz | search | report | admin
  currentRole: null,
  currentUser: null,  // string name of logged-in user
  guideArticleIndex: 0,
  quiz: {
    questions: [],
    index: 0,
    score: 0,
    answered: false,
    done: false,
  },
  searchQuery: "",
  adminSelectedRole: null,
};

// ── Boot ───────────────────────────────────────────────────────────────────

async function init() {
  render("loading");
  try {
    if (!window.ARTICLES) throw new Error("data.js not loaded - run build script first.");
    state.articles = window.ARTICLES;
    state.quizzes  = window.QUIZZES;
    // Check for returning user in localStorage
    const lastUser = localStorage.getItem("currentUser");
    if (lastUser) {
      state.currentUser = lastUser;
      render("home");
    } else {
      render("welcome");
    }
  } catch (err) {
    renderError(err.message);
  }
}

// ── Search ─────────────────────────────────────────────────────────────────

function search(query) {
  if (!query.trim()) return [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return state.articles
    .map(art => {
      const haystack = (art.title + " " + art.section + " " + art.body).toLowerCase();
      let score = 0;
      for (const term of terms) {
        // Title matches worth more
        if (art.title.toLowerCase().includes(term)) score += 10;
        // Count body occurrences
        let idx = 0;
        while ((idx = haystack.indexOf(term, idx)) !== -1) { score++; idx++; }
      }
      return { art, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(r => r.art);
}

function highlightTerms(text, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  let out = escapeHtml(text);
  for (const term of terms) {
    const re = new RegExp(`(${escapeHtml(term)})`, "gi");
    out = out.replace(re, "<mark>$1</mark>");
  }
  return out;
}

function getExcerpt(body, query, length = 200) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = body.toLowerCase();
  let best = 0;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1) { best = Math.max(0, idx - 60); break; }
  }
  const snippet = body.substring(best, best + length);
  return (best > 0 ? "..." : "") + snippet + (snippet.length === length ? "..." : "");
}

// ── Rendering ──────────────────────────────────────────────────────────────

function render(view, extra = {}) {
  state.view = view;
  const app = document.getElementById("app");
  app.innerHTML = renderHeader() + renderView(view, extra);
  attachHandlers();
  focusWelcomeInput();
}

function renderError(msg) {
  document.getElementById("app").innerHTML = `
    <div class="loading">
      <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
      <strong>Could not load data</strong>
      <p style="margin-top:8px;color:#8892a4">${escapeHtml(msg)}</p>
      <p style="margin-top:16px;font-size:0.82rem;color:#8892a4">
        Run: <code>python scripts/build_onboarding.py</code> first.
      </p>
    </div>`;
}

function renderView(view, extra) {
  switch (view) {
    case "loading": return `<div class="loading">Loading...</div>`;
    case "welcome": return renderWelcome();
    case "home":    return renderHome();
    case "role":    return renderRole(extra.role);
    case "quiz":    return renderQuiz();
    case "search":  return renderSearch(state.searchQuery);
    case "report":  return renderReport();
    case "admin":   return renderAdmin();
    default:        return "";
  }
}

function renderHeader() {
  if (state.view === "welcome" || state.view === "loading") {
    return `<header><div class="logo">Medicus <span>Onboarding</span></div></header>`;
  }
  const homeLink = state.view === "home" ? "" :
    `<button onclick="goHome()">← Home</button>`;
  const userBadge = state.currentUser
    ? `<span class="user-badge" onclick="switchUser()" title="Switch user">
        👤 ${escapeHtml(state.currentUser)}
       </span>`
    : "";
  return `
    <header>
      <div class="logo">Medicus <span>Onboarding</span></div>
      <nav>${homeLink}${userBadge}</nav>
    </header>`;
}

// ── Welcome / user management ──────────────────────────────────────────────

function getUsers() {
  try { return JSON.parse(localStorage.getItem("users") || "[]"); } catch { return []; }
}

function saveUser(name) {
  const users = getUsers();
  if (!users.includes(name)) { users.push(name); localStorage.setItem("users", JSON.stringify(users)); }
  state.currentUser = name;
  localStorage.setItem("currentUser", name);
  render("home");
}

function switchUser() {
  localStorage.removeItem("currentUser");
  state.currentUser = null;
  render("welcome");
}

function deleteUser(name) {
  if (!confirm(`Delete profile for "${name}"? All progress will be lost.`)) return;
  const users = getUsers().filter(u => u !== name);
  localStorage.setItem("users", JSON.stringify(users));
  // Remove all completion data for this user
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(`completed_${name}_`)) localStorage.removeItem(key);
  }
  if (state.currentUser === name) {
    localStorage.removeItem("currentUser");
    state.currentUser = null;
  }
  render("welcome");
}

function handleNewUser() {
  const input = document.getElementById("new-user-input");
  const name = (input ? input.value : "").trim();
  if (!name) return;
  saveUser(name);
}

function renderWelcome() {
  const users = getUsers();
  const existingHtml = users.length === 0 ? "" : `
    <div class="welcome-existing">
      <div class="welcome-section-label">Continue where you left off</div>
      <div class="user-list">
        ${users.map(u => `
          <div class="user-card" onclick="saveUser('${escapeHtml(u)}')">
            <div class="user-avatar">${escapeHtml(u.charAt(0).toUpperCase())}</div>
            <div class="user-card-name">${escapeHtml(u)}</div>
            <button class="user-delete-btn" onclick="event.stopPropagation();deleteUser('${escapeHtml(u)}')" title="Delete profile">✕</button>
          </div>`).join("")}
      </div>
    </div>`;

  return `
    <div class="welcome-wrap">
      <div class="welcome-hero">
        <div class="welcome-logo">🏥</div>
        <h1 class="welcome-title">Welcome to Medicus Onboarding</h1>
        <p class="welcome-subtitle">Witley Surgery staff training guides and quizzes</p>
      </div>
      ${existingHtml}
      <div class="welcome-new">
        <div class="welcome-section-label">${users.length ? "Or create a new profile" : "Get started"}</div>
        <div class="new-user-form">
          <input id="new-user-input" type="text" placeholder="Enter your name"
                 autocomplete="off" maxlength="40"
                 onkeydown="if(event.key==='Enter')handleNewUser()" />
          <button class="start-btn" onclick="handleNewUser()">Start →</button>
        </div>
      </div>
    </div>`;
}

// ── Home ───────────────────────────────────────────────────────────────────

function renderHome() {
  const roleCards = ROLES.map(r => {
    const articles = state.articles.filter(a => a.roles && a.roles.includes(r.id));
    const count = articles.length;
    const completed = getCompleted(r.id);
    const pct = count ? Math.round((completed.length / count) * 100) : 0;
    const progressBar = pct > 0
      ? `<div class="role-progress-track"><div class="role-progress-fill" style="background:${r.color};width:${pct}%"></div></div>
         <div class="role-progress-label" style="color:${r.color}">${pct}% done</div>`
      : `<div class="role-count">${count} articles</div>`;
    return `
      <div class="role-card" onclick="goRole('${r.id}')"
           style="border-color:${r.color}44">
        <div class="role-icon">${r.icon}</div>
        <div class="role-name">${r.id}</div>
        ${progressBar}
        <div class="role-bar" style="background:${r.color}"></div>
      </div>`;
  }).join("");

  return `
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input id="search-input" type="text"
             placeholder="Search all Medicus articles - e.g. batch sign prescriptions"
             value="${escapeHtml(state.searchQuery)}"
             autocomplete="off" />
    </div>
    <div class="home-bar">
      <div class="section-label" style="margin:0">Training guides by role</div>
      <div class="home-bar-actions">
        <button class="report-link-btn" onclick="render('report')">📋 My progress report</button>
        <button class="admin-link-btn" onclick="render('admin')">⚙️</button>
      </div>
    </div>
    <div class="role-grid">${roleCards}</div>`;
}

// ── Role guide ─────────────────────────────────────────────────────────────

function getRoleArticles(roleId) {
  const config = getAdminRoleConfig();
  const excluded = (config[roleId] || {}).excludedArticles || [];
  return state.articles
    .filter(a => a.roles && a.roles.includes(roleId))
    .filter(a => !excluded.includes(a.id))
    .sort((a, b) => a.section.localeCompare(b.section) || a.title.localeCompare(b.title));
}

function isMandatoryArticle(roleId, articleId) {
  const config = getAdminRoleConfig();
  return ((config[roleId] || {}).mandatoryArticles || []).includes(articleId);
}

function getCompletedKey(roleId) {
  return `completed_${state.currentUser}_${roleId}`;
}

function getCompleted(roleId) {
  // Returns array of article IDs (for backwards compat)
  try {
    const raw = JSON.parse(localStorage.getItem(getCompletedKey(roleId)) || "[]");
    return raw.map(e => (typeof e === "object" ? e.id : e));
  } catch { return []; }
}

function getCompletedWithDates(roleId) {
  // Returns array of {id, date} objects
  try {
    const raw = JSON.parse(localStorage.getItem(getCompletedKey(roleId)) || "[]");
    return raw.map(e => typeof e === "object" ? e : { id: e, date: null });
  } catch { return []; }
}

function toggleComplete(roleId, articleId) {
  const entries = getCompletedWithDates(roleId);
  const idx = entries.findIndex(e => e.id === articleId);
  if (idx === -1) entries.push({ id: articleId, date: new Date().toISOString() });
  else entries.splice(idx, 1);
  localStorage.setItem(getCompletedKey(roleId), JSON.stringify(entries));
  // Re-render sidebar and progress without losing article scroll position
  renderGuideSidebar(roleId);
  renderGuideProgress(roleId);
  // Update the complete button in-place
  const isDone = getCompleted(roleId).includes(articleId);
  const btn = document.querySelector(".complete-btn");
  if (btn) {
    btn.className = "complete-btn" + (isDone ? " done" : "");
    btn.textContent = isDone ? "✓ Completed" : "Mark as complete";
  }
}

function selectArticle(roleId, index) {
  state.guideArticleIndex = index;
  renderGuideArticle(roleId);
  renderGuideSidebar(roleId);
  renderGuideProgress(roleId);
  document.getElementById("guide-article-panel").scrollTop = 0;
}

function renderGuideSidebar(roleId) {
  const articles = getRoleArticles(roleId);
  const completed = getCompleted(roleId);
  const sections = {};
  articles.forEach((a, i) => {
    if (!sections[a.section]) sections[a.section] = [];
    sections[a.section].push({ a, i });
  });

  const html = Object.entries(sections).map(([section, items]) => {
    const allDone = items.every(({ a }) => completed.includes(a.id));
    const sectionItems = items.map(({ a, i }) => {
      const done = completed.includes(a.id);
      const active = i === state.guideArticleIndex;
      const mandatory = isMandatoryArticle(roleId, a.id);
      return `
        <div class="guide-nav-item ${active ? "active" : ""} ${done ? "done" : ""}"
             onclick="selectArticle('${roleId}', ${i})">
          <span class="guide-nav-check">${done ? "✓" : ""}</span>
          <span class="guide-nav-title">${escapeHtml(a.title)}</span>
          ${mandatory ? '<span class="guide-nav-mandatory" title="Required">★</span>' : ""}
        </div>`;
    }).join("");
    return `
      <div class="guide-nav-section">
        <div class="guide-nav-section-title ${allDone ? "done" : ""}">${escapeHtml(section)}</div>
        ${sectionItems}
      </div>`;
  }).join("");

  const el = document.getElementById("guide-sidebar-nav");
  if (el) el.innerHTML = html;

  // Scroll active item into view
  const active = document.querySelector(".guide-nav-item.active");
  if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function renderGuideProgress(roleId) {
  const articles = getRoleArticles(roleId);
  const completed = getCompleted(roleId);
  const pct = articles.length ? Math.round((completed.length / articles.length) * 100) : 0;
  const el = document.getElementById("guide-progress-bar-fill");
  const label = document.getElementById("guide-progress-label");
  if (el) el.style.width = pct + "%";
  if (label) label.textContent = `${completed.length} of ${articles.length} completed`;
}

function renderGuideArticle(roleId) {
  const articles = getRoleArticles(roleId);
  const article = articles[state.guideArticleIndex];
  const completed = getCompleted(roleId);
  const isDone = article && completed.includes(article.id);
  const isFirst = state.guideArticleIndex === 0;
  const isLast = state.guideArticleIndex >= articles.length - 1;

  if (!article) return;

  const bodyHtml = escapeHtml(article.body || "No content available.")
    .replace(/\n\n+/g, '</p><p class="article-para">')
    .replace(/\n/g, "<br>");

  const el = document.getElementById("guide-article-panel");
  if (!el) return;

  const isArticleMandatory = isMandatoryArticle(roleId, article.id);
  el.innerHTML = `
    <div class="guide-article-inner">
      <div class="guide-article-meta-row">
        <div class="guide-article-section-badge">${escapeHtml(article.section)}</div>
        ${isArticleMandatory ? '<div class="guide-article-required-badge">★ Required</div>' : ""}
      </div>
      <h2 class="guide-article-title">${escapeHtml(article.title)}</h2>
      <div class="guide-article-body">
        <p class="article-para">${bodyHtml}</p>
      </div>
      <div class="guide-article-footer">
        <a class="article-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener">
          View full article on Zendesk →
        </a>
        <button class="complete-btn ${isDone ? "done" : ""}"
                onclick="toggleComplete('${roleId}', ${article.id})">
          ${isDone ? "✓ Completed" : "Mark as complete"}
        </button>
      </div>
      <div class="guide-article-nav">
        <button class="guide-nav-btn" ${isFirst ? "disabled" : ""}
                onclick="selectArticle('${roleId}', ${state.guideArticleIndex - 1})">
          ← Previous
        </button>
        <span class="guide-article-counter">
          ${state.guideArticleIndex + 1} / ${articles.length}
        </span>
        <button class="guide-nav-btn" ${isLast ? "disabled" : ""}
                onclick="selectArticle('${roleId}', ${state.guideArticleIndex + 1})">
          Next →
        </button>
      </div>
    </div>`;
}

function renderRole(roleId) {
  const role = ROLES.find(r => r.id === roleId);
  if (!role) return "";

  const articles = getRoleArticles(roleId);
  if (!articles.length) {
    return `<div class="empty">No articles found for this role.</div>`;
  }

  const hasQuiz = state.quizzes[roleId] && state.quizzes[roleId].length > 0;

  // Build sidebar and article inline (initial state)
  const completed = getCompleted(roleId);
  const sections = {};
  articles.forEach((a, i) => {
    if (!sections[a.section]) sections[a.section] = [];
    sections[a.section].push({ a, i });
  });

  const sidebarHtml = Object.entries(sections).map(([section, items]) => {
    const allDone = items.every(({ a }) => completed.includes(a.id));
    const sectionItems = items.map(({ a, i }) => {
      const done = completed.includes(a.id);
      const active = i === state.guideArticleIndex;
      const mandatory = isMandatoryArticle(roleId, a.id);
      return `
        <div class="guide-nav-item ${active ? "active" : ""} ${done ? "done" : ""}"
             onclick="selectArticle('${roleId}', ${i})">
          <span class="guide-nav-check">${done ? "✓" : ""}</span>
          <span class="guide-nav-title">${escapeHtml(a.title)}</span>
          ${mandatory ? '<span class="guide-nav-mandatory" title="Required">★</span>' : ""}
        </div>`;
    }).join("");
    return `
      <div class="guide-nav-section">
        <div class="guide-nav-section-title ${allDone ? "done" : ""}">${escapeHtml(section)}</div>
        ${sectionItems}
      </div>`;
  }).join("");

  const first = articles[state.guideArticleIndex] || articles[0];
  const isDone = completed.includes(first.id);
  const isFirst = state.guideArticleIndex === 0;
  const isLast = state.guideArticleIndex >= articles.length - 1;
  const pct = articles.length ? Math.round((completed.length / articles.length) * 100) : 0;

  const bodyHtml = escapeHtml(first.body || "No content available.")
    .replace(/\n\n+/g, '</p><p class="article-para">')
    .replace(/\n/g, "<br>");

  return `
    <div class="guide-header">
      <div class="guide-header-left">
        <span class="guide-role-icon">${role.icon}</span>
        <div>
          <div class="guide-role-name">${role.id} Training Guide</div>
          <div class="guide-role-desc">${role.desc}</div>
        </div>
      </div>
      <div class="guide-header-right">
        ${hasQuiz ? `<button class="quiz-launch-btn" onclick="startQuiz('${roleId}')">Test yourself →</button>` : ""}
      </div>
    </div>
    <div class="guide-progress-wrap">
      <div class="guide-progress-bar-track">
        <div class="guide-progress-bar-fill" id="guide-progress-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="guide-progress-label" id="guide-progress-label">${completed.length} of ${articles.length} completed</span>
    </div>
    <div class="guide-layout">
      <aside class="guide-sidebar">
        <div class="guide-sidebar-scroll" id="guide-sidebar-nav">
          ${sidebarHtml}
        </div>
      </aside>
      <main class="guide-article-panel" id="guide-article-panel">
        <div class="guide-article-inner">
          <div class="guide-article-meta-row">
            <div class="guide-article-section-badge">${escapeHtml(first.section)}</div>
            ${isMandatoryArticle(roleId, first.id) ? '<div class="guide-article-required-badge">★ Required</div>' : ""}
          </div>
          <h2 class="guide-article-title">${escapeHtml(first.title)}</h2>
          <div class="guide-article-body">
            <p class="article-para">${bodyHtml}</p>
          </div>
          <div class="guide-article-footer">
            <a class="article-link" href="${escapeHtml(first.url)}" target="_blank" rel="noopener">
              View full article on Zendesk →
            </a>
            <button class="complete-btn ${isDone ? "done" : ""}"
                    onclick="toggleComplete('${roleId}', ${first.id})">
              ${isDone ? "✓ Completed" : "Mark as complete"}
            </button>
          </div>
          <div class="guide-article-nav">
            <button class="guide-nav-btn" ${isFirst ? "disabled" : ""}
                    onclick="selectArticle('${roleId}', ${state.guideArticleIndex - 1})">
              ← Previous
            </button>
            <span class="guide-article-counter">
              ${state.guideArticleIndex + 1} / ${articles.length}
            </span>
            <button class="guide-nav-btn" ${isLast ? "disabled" : ""}
                    onclick="selectArticle('${roleId}', ${state.guideArticleIndex + 1})">
              Next →
            </button>
          </div>
        </div>
      </main>
    </div>`;
}

// ── Quiz ───────────────────────────────────────────────────────────────────

function startQuiz(roleId) {
  const questions = [...(state.quizzes[roleId] || [])];
  // Shuffle
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }
  state.currentRole = roleId;
  state.quiz = { questions: questions.slice(0, 10), index: 0, score: 0, answered: false, done: false };
  render("quiz");
}

function renderQuiz() {
  const { questions, index, score, done } = state.quiz;
  const role = ROLES.find(r => r.id === state.currentRole);

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    const pass = pct >= 70;
    return `
      <div class="page-header">
        <div class="page-title"><span class="icon">${role.icon}</span>${role.id} Quiz</div>
      </div>
      <div class="quiz-wrap">
        <div class="quiz-results">
          <div class="quiz-score ${pass ? "pass" : "fail"}">${score}/${questions.length}</div>
          <div class="quiz-score-label">${pct}% - ${pass ? "Well done!" : "Keep reading and try again."}</div>
          <div class="quiz-result-actions">
            <button class="retry-btn" onclick="startQuiz('${role.id}')">Try again</button>
            <button class="guide-btn" onclick="goRole('${role.id}')">Back to guide</button>
          </div>
        </div>
      </div>`;
  }

  const q = questions[index];
  const optionsHtml = q.options.map((opt, i) => `
    <button class="quiz-option" data-index="${i}" onclick="answerQuiz(${i})">
      ${escapeHtml(opt)}
    </button>`).join("");

  const pct = Math.round((index / questions.length) * 100);

  return `
    <div class="page-header">
      <div class="page-title"><span class="icon">${role.icon}</span>${role.id} Quiz</div>
    </div>
    <div class="quiz-wrap">
      <div class="quiz-progress">
        <span>Question ${index + 1} of ${questions.length}</span>
        <span>${score} correct so far</span>
      </div>
      <div class="quiz-progress-bar">
        <div class="quiz-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="quiz-question">${escapeHtml(q.question)}</div>
      <div class="quiz-options" id="quiz-options">${optionsHtml}</div>
      <div class="quiz-explanation" id="quiz-explanation">${escapeHtml(q.explanation)}</div>
      <button class="quiz-next-btn" id="quiz-next" onclick="nextQuestion()">
        ${index + 1 < questions.length ? "Next question →" : "See results →"}
      </button>
    </div>`;
}

function answerQuiz(chosen) {
  if (state.quiz.answered) return;
  state.quiz.answered = true;

  const q = state.quiz.questions[state.quiz.index];
  const correct = q.correct;
  const isRight = chosen === correct;
  if (isRight) state.quiz.score++;

  // Colour the buttons
  document.querySelectorAll(".quiz-option").forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add("correct");
    else if (i === chosen && !isRight) btn.classList.add("wrong");
  });

  document.getElementById("quiz-explanation").classList.add("visible");
  document.getElementById("quiz-next").classList.add("visible");
}

function logQuizScore(roleId, score, total) {
  if (!state.currentUser) return;
  const key = `quizscores_${state.currentUser}_${roleId}`;
  const scores = JSON.parse(localStorage.getItem(key) || "[]");
  scores.push({ date: new Date().toISOString(), score, total, pct: Math.round((score / total) * 100) });
  localStorage.setItem(key, JSON.stringify(scores));
}

function getQuizScores(roleId) {
  if (!state.currentUser) return [];
  try {
    return JSON.parse(localStorage.getItem(`quizscores_${state.currentUser}_${roleId}`) || "[]");
  } catch { return []; }
}

function nextQuestion() {
  state.quiz.index++;
  state.quiz.answered = false;
  if (state.quiz.index >= state.quiz.questions.length) {
    state.quiz.done = true;
    logQuizScore(state.currentRole, state.quiz.score, state.quiz.questions.length);
  }
  render("quiz");
}

// ── Search results ─────────────────────────────────────────────────────────

function renderSearch(query) {
  const results = search(query);

  if (!query.trim()) {
    return `
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input id="search-input" type="text"
               placeholder="Search all Medicus articles..."
               value="" autocomplete="off" />
      </div>
      <div class="empty">Start typing to search across all 175 articles.</div>`;
  }

  const resultsHtml = results.length === 0
    ? `<div class="empty"><strong>No results for "${escapeHtml(query)}"</strong>
         <p>Try different words or browse a role guide.</p></div>`
    : results.map(a => {
        const excerpt = getExcerpt(a.body, query);
        const roleTags = (a.roles || []).map(r => {
          const role = ROLES.find(ro => ro.id === r);
          return `<span class="role-tag" style="border:1px solid ${role ? role.color + "66" : "#333"}">${escapeHtml(r)}</span>`;
        }).join("");
        return `
          <div class="search-result-card">
            <div class="search-result-title">${highlightTerms(a.title, query)}</div>
            <div class="search-result-meta">${escapeHtml(a.section)}</div>
            <div class="search-result-excerpt">${highlightTerms(excerpt, query)}</div>
            <div class="role-tags">${roleTags}</div>
            <a class="search-result-link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener">
              View on Zendesk →
            </a>
          </div>`;
      }).join("");

  return `
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input id="search-input" type="text"
             placeholder="Search all Medicus articles..."
             value="${escapeHtml(query)}" autocomplete="off" />
    </div>
    <div class="search-results-header">
      ${results.length} result${results.length !== 1 ? "s" : ""} for <strong>"${escapeHtml(query)}"</strong>
    </div>
    ${resultsHtml}`;
}

// ── Progress report ────────────────────────────────────────────────────────

function renderReport() {
  const user = state.currentUser || "Unknown";
  const reportDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const roleRows = ROLES.map(r => {
    const articles = getRoleArticles(r.id);
    if (!articles.length) return "";
    const completed = getCompleted(r.id);
    const withDates = getCompletedWithDates(r.id);
    const scores = getQuizScores(r.id);
    const lastScore = scores.length ? scores[scores.length - 1] : null;
    const pct = articles.length ? Math.round((completed.length / articles.length) * 100) : 0;
    const lastDate = withDates.length
      ? withDates.filter(e => e.date).sort((a, b) => b.date.localeCompare(a.date))[0]?.date
      : null;
    const lastDateStr = lastDate ? new Date(lastDate).toLocaleDateString("en-GB") : "-";

    return `
      <tr class="report-row ${pct === 100 ? "complete" : ""}">
        <td class="report-role"><span class="report-icon">${r.icon}</span>${escapeHtml(r.id)}</td>
        <td class="report-progress">
          <div class="report-bar-wrap">
            <div class="report-bar-fill" style="width:${pct}%;background:${r.color}"></div>
          </div>
          <span class="report-pct">${pct}%</span>
        </td>
        <td class="report-articles">${completed.length} / ${articles.length}</td>
        <td class="report-quiz">${lastScore ? `${lastScore.pct}% (${lastScore.score}/${lastScore.total})` : "-"}</td>
        <td class="report-date">${lastDateStr}</td>
        <td class="report-status">${pct === 100 ? '<span class="status-done">✓ Ready</span>' : pct > 0 ? '<span class="status-progress">In progress</span>' : '<span class="status-pending">Not started</span>'}</td>
      </tr>`;
  }).join("");

  const totalArticles = state.articles.length;
  const totalCompleted = ROLES.reduce((sum, r) => {
    const c = getCompleted(r.id);
    return sum + c.length;
  }, 0);

  return `
    <div class="report-wrap">
      <div class="report-header">
        <div>
          <div class="report-title">Training Completion Report</div>
          <div class="report-meta">Witley Surgery · Medicus EPR Onboarding</div>
        </div>
        <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
      </div>
      <div class="report-staff-block">
        <div class="report-field"><span>Staff name</span><strong>${escapeHtml(user)}</strong></div>
        <div class="report-field"><span>Report generated</span><strong>${reportDate}</strong></div>
        <div class="report-field"><span>System</span><strong>Medicus EPR</strong></div>
        <div class="report-field"><span>Practice</span><strong>Witley Surgery</strong></div>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th>Role guide</th>
            <th>Progress</th>
            <th>Articles</th>
            <th>Best quiz score</th>
            <th>Last activity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${roleRows}</tbody>
      </table>
      <div class="report-footer">
        This report was generated automatically by the Medicus Onboarding tool at Witley Surgery.
        Please retain in the staff induction file for CQC inspection purposes.
      </div>
    </div>`;
}

// ── Admin ─────────────────────────────────────────────────────────────────

const ADMIN_DEFAULT_PASSWORD = "witley2026";

function getAdminPassword() {
  return localStorage.getItem("admin_password") || ADMIN_DEFAULT_PASSWORD;
}

function isAdminAuthenticated() {
  return sessionStorage.getItem("admin_authed") === "1";
}

function adminLogin(password) {
  if (password === getAdminPassword()) {
    sessionStorage.setItem("admin_authed", "1");
    state.adminSelectedRole = state.adminSelectedRole || ROLES[0].id;
    render("admin");
  } else {
    const err = document.getElementById("admin-login-error");
    if (err) { err.textContent = "Incorrect password."; err.style.display = "block"; }
  }
}

function adminLogout() {
  sessionStorage.removeItem("admin_authed");
  render("home");
}

function getAdminRoleConfig() {
  try { return JSON.parse(localStorage.getItem("admin_role_config") || "{}"); } catch { return {}; }
}

function saveAdminRoleConfig(config) {
  localStorage.setItem("admin_role_config", JSON.stringify(config));
}

function renderAdmin() {
  if (!isAdminAuthenticated()) {
    return `
      <div class="admin-login-wrap">
        <div class="admin-login-card">
          <div class="admin-login-icon">⚙️</div>
          <div class="admin-login-title">Admin Access</div>
          <div class="admin-login-sub">Witley Surgery · Medicus Onboarding</div>
          <input id="admin-password-input" type="password" placeholder="Password"
                 class="admin-input"
                 onkeydown="if(event.key==='Enter')adminLogin(this.value)" />
          <div id="admin-login-error" class="admin-error"></div>
          <button class="admin-login-btn" onclick="adminLogin(document.getElementById('admin-password-input').value)">
            Sign in →
          </button>
          <button class="admin-cancel-btn" onclick="goHome()">Cancel</button>
        </div>
      </div>`;
  }

  const config = getAdminRoleConfig();
  const adminRole = state.adminSelectedRole || ROLES[0].id;
  const role = ROLES.find(r => r.id === adminRole);

  const roleTabsHtml = ROLES.map(r => {
    const roleConfig = config[r.id] || {};
    const hasCustom = (roleConfig.excludedArticles || []).length > 0 ||
                      (roleConfig.mandatoryArticles || []).length > 0;
    return `
      <button class="admin-role-tab ${adminRole === r.id ? "active" : ""}"
              onclick="selectAdminRole('${r.id}')">
        ${r.icon} ${r.id}
        ${hasCustom ? '<span class="admin-tab-dot"></span>' : ""}
      </button>`;
  }).join("");

  const roleConfig = config[adminRole] || {};
  const excluded = roleConfig.excludedArticles || [];
  const mandatory = roleConfig.mandatoryArticles || [];

  const allArticles = state.articles
    .filter(a => a.roles && a.roles.includes(adminRole))
    .sort((a, b) => a.section.localeCompare(b.section) || a.title.localeCompare(b.title));

  const sections = {};
  allArticles.forEach(a => {
    if (!sections[a.section]) sections[a.section] = [];
    sections[a.section].push(a);
  });

  const sectionsHtml = Object.entries(sections).map(([section, articles]) => {
    const enabledCount = articles.filter(a => !excluded.includes(a.id)).length;
    const articlesHtml = articles.map(a => {
      const isExcluded = excluded.includes(a.id);
      const isMand = mandatory.includes(a.id);
      return `
        <div class="admin-article-row ${isExcluded ? "excluded" : ""}">
          <label class="admin-toggle-wrap" title="${isExcluded ? "Enable article" : "Disable article"}">
            <input type="checkbox" ${!isExcluded ? "checked" : ""}
                   onchange="toggleArticleEnabled('${adminRole}', ${a.id}, this.checked)" />
            <span class="admin-toggle-slider"></span>
          </label>
          <span class="admin-article-title">${escapeHtml(a.title)}</span>
          <label class="admin-mandatory-label ${isExcluded ? "disabled" : ""}" title="Mark as required reading">
            <input type="checkbox" ${isMand ? "checked" : ""} ${isExcluded ? "disabled" : ""}
                   onchange="toggleArticleMandatory('${adminRole}', ${a.id}, this.checked)" />
            <span>Required</span>
          </label>
        </div>`;
    }).join("");
    return `
      <div class="admin-section">
        <div class="admin-section-title">
          ${escapeHtml(section)}
          <span class="admin-section-count">${enabledCount}/${articles.length} enabled</span>
        </div>
        ${articlesHtml}
      </div>`;
  }).join("");

  const totalEnabled = allArticles.length - excluded.length;
  const mandatoryCount = mandatory.filter(id => !excluded.includes(id)).length;

  return `
    <div class="admin-wrap">
      <div class="admin-header">
        <div>
          <div class="admin-title">⚙️ Module Management</div>
          <div class="admin-subtitle">Control which articles appear in each role's training guide. Changes take effect immediately.</div>
        </div>
        <div class="admin-header-actions">
          <button class="admin-change-pw-btn" onclick="adminChangePassword()">Change password</button>
          <button class="admin-logout-btn" onclick="adminLogout()">Sign out</button>
        </div>
      </div>
      <div class="admin-role-tabs">${roleTabsHtml}</div>
      <div class="admin-role-panel">
        <div class="admin-role-info">
          <span class="admin-role-icon">${role.icon}</span>
          <div>
            <div class="admin-role-name">${adminRole}</div>
            <div class="admin-role-stats">${totalEnabled} articles active · ${mandatoryCount} marked required</div>
          </div>
          <button class="admin-reset-btn" onclick="resetRoleConfig('${adminRole}')">Reset to defaults</button>
        </div>
        <div class="admin-articles-list">${sectionsHtml}</div>
      </div>
    </div>`;
}

function selectAdminRole(roleId) {
  state.adminSelectedRole = roleId;
  render("admin");
}

function toggleArticleEnabled(roleId, articleId, enabled) {
  const config = getAdminRoleConfig();
  if (!config[roleId]) config[roleId] = { excludedArticles: [], mandatoryArticles: [] };
  const exc = config[roleId].excludedArticles || [];
  if (enabled) {
    config[roleId].excludedArticles = exc.filter(id => id !== articleId);
  } else {
    if (!exc.includes(articleId)) exc.push(articleId);
    config[roleId].excludedArticles = exc;
    // Auto-remove from mandatory if disabling
    config[roleId].mandatoryArticles = (config[roleId].mandatoryArticles || []).filter(id => id !== articleId);
  }
  saveAdminRoleConfig(config);
  render("admin");
}

function toggleArticleMandatory(roleId, articleId, mandatory) {
  const config = getAdminRoleConfig();
  if (!config[roleId]) config[roleId] = { excludedArticles: [], mandatoryArticles: [] };
  const list = config[roleId].mandatoryArticles || [];
  if (mandatory) {
    if (!list.includes(articleId)) list.push(articleId);
    config[roleId].mandatoryArticles = list;
  } else {
    config[roleId].mandatoryArticles = list.filter(id => id !== articleId);
  }
  saveAdminRoleConfig(config);
}

function resetRoleConfig(roleId) {
  if (!confirm(`Reset ${roleId} to defaults? All customisations for this role will be lost.`)) return;
  const config = getAdminRoleConfig();
  delete config[roleId];
  saveAdminRoleConfig(config);
  render("admin");
}

function adminChangePassword() {
  const current = prompt("Current password:");
  if (current !== getAdminPassword()) { alert("Incorrect password."); return; }
  const newPw = prompt("New password:");
  if (!newPw || newPw.length < 6) { alert("Password must be at least 6 characters."); return; }
  const confirm2 = prompt("Confirm new password:");
  if (newPw !== confirm2) { alert("Passwords do not match."); return; }
  localStorage.setItem("admin_password", newPw);
  alert("Password changed.");
}

// ── Navigation ─────────────────────────────────────────────────────────────

function goHome() {
  state.searchQuery = "";
  render("home");
}

function goRole(roleId) {
  state.currentRole = roleId;
  state.guideArticleIndex = 0;
  render("role", { role: roleId });
}

// ── Event handlers ─────────────────────────────────────────────────────────

let searchTimer;
function attachHandlers() {
  const input = document.getElementById("search-input");
  if (!input) return;

  input.addEventListener("input", e => {
    clearTimeout(searchTimer);
    const q = e.target.value;
    state.searchQuery = q;
    searchTimer = setTimeout(() => {
      if (q.trim()) render("search");
      else render("home");
    }, 250);
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && state.searchQuery.trim()) render("search");
  });

  // Focus search on home
  if (state.view === "home") input.focus();
}

function focusWelcomeInput() {
  const newUserInput = document.getElementById("new-user-input");
  if (newUserInput) newUserInput.focus();
}

// ── Utils ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Start ──────────────────────────────────────────────────────────────────

init();
