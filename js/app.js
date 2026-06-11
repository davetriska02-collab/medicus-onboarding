// ─────────────────────────────────────────────────────────────────────────────
// Medicus Onboarding — application
// Vanilla JS single-page app. No build step, no runtime network calls.
// Data: window.ARTICLES / window.QUIZZES (data/data.js, scraped help centre),
//       window.MODULES / window.PERSONAS (js/curriculum.js),
//       window.WALKTHROUGHS (js/walkthroughs.js).
// ─────────────────────────────────────────────────────────────────────────────

const STORE_KEY = "medicus-onboarding-v2";
const PASS_MARK = 0.8;

let store = loadStore();

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted store — start fresh */ }
  return { people: {}, order: [] };
}

function saveStore() {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function getPerson(id) { return store.people[id] || null; }

function newPerson(name, role) {
  const p = {
    id: uid(), name: name.trim(), role, created: Date.now(),
    progress: { read: {}, wt: {}, quiz: {}, comps: {}, signoff: {}, assessment: null },
  };
  store.people[p.id] = p;
  store.order.push(p.id);
  saveStore();
  return p;
}

// ── Progress maths ──────────────────────────────────────────────────────────

function moduleProgress(person, mod) {
  const pr = person.progress;
  const parts = [];
  if (mod.core.length) {
    parts.push(mod.core.filter((a) => pr.read[a.id]).length / mod.core.length);
  }
  if (mod.def.walkthrough && WALKTHROUGHS[mod.def.walkthrough]) {
    parts.push(pr.wt[mod.def.walkthrough] ? 1 : 0);
  }
  if (moduleQuiz(person.role, mod.id).length >= 3) {
    const q = pr.quiz[mod.id];
    parts.push(q && q.passed ? 1 : 0);
  }
  if (mod.competencies.length) {
    parts.push(mod.competencies.filter((c) => pr.comps[mod.id + ":" + c.id]).length / mod.competencies.length);
  }
  if (!parts.length) return 1;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function overallProgress(person) {
  const pathway = buildPathway(person.role);
  if (!pathway) return 0;
  const fr = pathway.modules.map((m) => moduleProgress(person, m));
  fr.push(person.progress.assessment && person.progress.assessment.passed ? 1 : 0);
  return fr.reduce((a, b) => a + b, 0) / fr.length;
}

function moduleComplete(person, mod) { return moduleProgress(person, mod) >= 0.999; }

// ── Utilities ───────────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ring(frac, size = 52, stroke = 5) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = Math.round(frac * 100);
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-bg)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${frac >= 0.999 ? "var(--success)" : "var(--primary)"}" stroke-width="${stroke}"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle">${pct}%</text>
  </svg>`;
}

let toastTimer = null;
function toast(msg, kind = "ok") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.className = "toast toast-" + kind + " show";
  el.innerHTML = (kind === "ok" ? icon("check-circle", 16) : icon("alert", 16)) + esc(msg);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// Format flat scraped article text into readable HTML.
function formatBody(text) {
  const LEADS = ["Purpose", "Note:", "Note that", "Important:", "Warning:", "Tip:", "Before you start", "Prerequisites", "Summary", "Overview", "What's next", "Related articles"];
  // Split into sentences, group ~2-3 per paragraph.
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  const paras = [];
  let buf = [];
  for (const s of sentences) {
    buf.push(s.trim());
    const joined = buf.join(" ");
    if (buf.length >= 2 && joined.length > 220) { paras.push(joined); buf = []; }
  }
  if (buf.length) paras.push(buf.join(" "));
  return paras.map((p) => {
    let h = esc(p);
    for (const lead of LEADS) {
      if (p.startsWith(lead)) { h = `<strong>${esc(lead)}</strong>` + esc(p.slice(lead.length)); break; }
    }
    return `<p>${h}</p>`;
  }).join("");
}

// ── Router ──────────────────────────────────────────────────────────────────

function nav(path) { location.hash = path; }

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const seg = hash.split("/").filter(Boolean);
  closeWalkthrough(false);
  document.body.classList.remove("print-mode");

  if (!seg.length) return viewHome();
  if (seg[0] === "search") return viewSearch(decodeURIComponent(seg[1] || ""));
  if (seg[0] === "p") {
    const person = getPerson(seg[1]);
    if (!person) return viewHome();
    if (seg.length === 2) return viewPerson(person);
    if (seg[2] === "record") return viewRecord(person);
    if (seg[2] === "assessment") return viewQuiz(person, null, true);
    if (seg[2] === "m") {
      const mid = seg[3];
      const pathway = buildPathway(person.role);
      const mod = pathway.modules.find((m) => m.id === mid);
      if (!mod) return viewPerson(person);
      if (seg.length === 4) return viewModule(person, mod);
      if (seg[4] === "l") return viewLesson(person, mod, parseInt(seg[5], 10));
      if (seg[4] === "w") return viewWalkthroughLaunch(person, mod);
      if (seg[4] === "quiz") return viewQuiz(person, mod, false);
      return viewModule(person, mod);
    }
  }
  viewHome();
}

function shell(content, opts = {}) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="#/">
        <span class="brand-mark">${icon("sparkle", 18)}</span>
        <span class="brand-name">medic<b>us</b> <span class="brand-sub">onboarding</span></span>
      </a>
      <div class="header-actions">
        <form class="header-search" onsubmit="event.preventDefault(); nav('search/' + encodeURIComponent(this.q.value))">
          ${icon("search", 15)}<input name="q" placeholder="Search the help library…" value="${esc(opts.q || "")}">
        </form>
        <a class="btn btn-ghost btn-sm" href="#/">${icon("users", 15)} Team</a>
      </div>
    </header>
    <main class="container ${opts.wide ? "wide" : ""}">${content}</main>
    <footer class="site-footer">
      Built on the <a href="https://medicus-health.zendesk.com/hc/en-gb" target="_blank" rel="noopener">Medicus Help Centre</a> ·
      training simulation, not the live Medicus product · progress is stored in this browser
    </footer>`;
  window.scrollTo(0, 0);
}

// ── View: Home / Team ───────────────────────────────────────────────────────

function viewHome() {
  const people = store.order.map((id) => store.people[id]).filter(Boolean);
  const roleOptions = PERSONAS.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join("");

  const hero = `
    <section class="hero">
      <div class="hero-text">
        <span class="eyebrow">Role-based training for general practice</span>
        <h1>Get every member of the team <em>confidently competent</em> in Medicus</h1>
        <p>A guided pathway for each job role in the surgery — curated help-centre lessons, clickable practice walkthroughs,
        knowledge checks and a formal competency sign-off, person by person.</p>
        <div class="hero-stats">
          <div><b>${PERSONAS.length}</b><span>job roles</span></div>
          <div><b>${window.ARTICLES.length}</b><span>help-centre lessons</span></div>
          <div><b>${Object.keys(WALKTHROUGHS).length}</b><span>interactive walkthroughs</span></div>
          <div><b>${Object.values(MODULES).reduce((n, m) => n + m.competencies.length, 0)}</b><span>competencies</span></div>
        </div>
      </div>
      <div class="hero-art">${heroArt()}</div>
    </section>`;

  const addCard = `
    <div class="card add-person">
      <h3>${icon("user", 18)} Start someone's onboarding</h3>
      <form onsubmit="event.preventDefault(); addPersonSubmit(this)">
        <input name="name" placeholder="Full name, e.g. Priya Shah" required maxlength="60">
        <select name="role" required>
          <option value="" disabled selected>Choose their job role…</option>
          ${roleOptions}
        </select>
        <button class="btn btn-primary" type="submit">${icon("play", 15)} Create pathway</button>
      </form>
    </div>`;

  const peopleCards = people.map((p) => {
    const persona = getPersona(p.role);
    const frac = overallProgress(p);
    const done = frac >= 0.999;
    return `
    <a class="card person-card" href="#/p/${p.id}" style="--accent:${persona ? persona.color : "var(--primary)"}">
      <div class="person-top">
        <span class="avatar" style="background:${persona ? persona.color : "var(--primary)"}">${esc(initials(p.name))}</span>
        ${ring(frac)}
      </div>
      <b>${esc(p.name)}</b>
      <span class="person-role">${persona ? icon(persona.icon, 14) : ""} ${persona ? esc(persona.title) : esc(p.role)}</span>
      <span class="person-meta">${done ? `<span class="pill pill-green">${icon("award", 12)} Competent — signed off</span>` : `Started ${fmtDate(p.created)}`}</span>
    </a>`;
  }).join("");

  const teamSection = `
    <section class="team-section">
      <div class="section-head">
        <h2>${icon("users", 20)} The team</h2>
        <div class="section-actions">
          <button class="btn btn-ghost btn-sm" onclick="exportProgress()">${icon("download", 14)} Export progress</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('import-file').click()">${icon("upload", 14)} Import</button>
          <input type="file" id="import-file" accept=".json" style="display:none" onchange="importProgress(this)">
        </div>
      </div>
      <div class="grid people-grid">${addCard}${peopleCards}</div>
    </section>`;

  const rolesSection = `
    <section>
      <div class="section-head"><h2>${icon("compass", 20)} Pathways by role</h2></div>
      <div class="grid roles-grid">
        ${PERSONAS.map((p) => {
          const mods = p.modules.length;
          return `<div class="role-tile" style="--accent:${p.color}" onclick="prefillRole('${p.id}')">
            <span class="role-icn">${icon(p.icon, 22)}</span>
            <b>${esc(p.title)}</b>
            <p>${esc(p.blurb)}</p>
            <span class="role-meta">${mods} modules ${icon("chevron-right", 14)}</span>
          </div>`;
        }).join("")}
      </div>
    </section>`;

  shell(hero + teamSection + rolesSection, { wide: true });
}

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function addPersonSubmit(form) {
  const name = form.name.value.trim();
  const role = form.role.value;
  if (!name || !role) return;
  const p = newPerson(name, role);
  toast(`Pathway created for ${name}`);
  nav(`p/${p.id}`);
}

function prefillRole(roleId) {
  const sel = document.querySelector(".add-person select[name=role]");
  if (sel) {
    sel.value = roleId;
    document.querySelector(".add-person input[name=name]").focus();
    document.querySelector(".add-person").scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function exportProgress() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `medicus-onboarding-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Progress exported");
}

function importProgress(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.people || !data.order) throw new Error("bad format");
      store = data;
      saveStore();
      toast("Progress imported");
      route();
    } catch (e) {
      toast("That file isn't a valid progress export", "err");
    }
  };
  reader.readAsText(file);
  input.value = "";
}

function heroArt() {
  // abstract "connected care" illustration
  return `<svg viewBox="0 0 360 280" fill="none" aria-hidden="true">
    <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0E7490"/><stop offset="1" stop-color="#134E4A"/></linearGradient></defs>
    <rect x="20" y="30" width="220" height="150" rx="14" fill="url(#hg)" opacity="0.95"/>
    <rect x="38" y="52" width="110" height="12" rx="6" fill="#fff" opacity="0.85"/>
    <rect x="38" y="76" width="184" height="8" rx="4" fill="#fff" opacity="0.4"/>
    <rect x="38" y="92" width="160" height="8" rx="4" fill="#fff" opacity="0.4"/>
    <rect x="38" y="116" width="86" height="34" rx="8" fill="#2DD4BF"/>
    <path d="M50 133l6 6 12-12" stroke="#134E4A" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <rect x="150" y="116" width="72" height="34" rx="8" fill="#fff" opacity="0.18"/>
    <circle cx="280" cy="80" r="44" fill="#F0FDFA" stroke="#0E7490" stroke-width="2"/>
    <path d="M280 60v40M260 80h40" stroke="#0E7490" stroke-width="7" stroke-linecap="round"/>
    <rect x="120" y="160" width="220" height="100" rx="14" fill="#fff" stroke="#CBD5E1"/>
    <circle cx="152" cy="192" r="14" fill="#0E7490" opacity="0.9"/>
    <rect x="176" y="184" width="92" height="9" rx="4" fill="#94A3B8"/>
    <rect x="176" y="200" width="60" height="7" rx="3" fill="#CBD5E1"/>
    <rect x="138" y="226" width="186" height="14" rx="7" fill="#F1F5F9"/>
    <rect x="138" y="226" width="120" height="14" rx="7" fill="#14B8A6"/>
  </svg>`;
}

// ── View: Person dashboard ──────────────────────────────────────────────────

function viewPerson(person) {
  const persona = getPersona(person.role);
  const pathway = buildPathway(person.role);
  const frac = overallProgress(person);
  const assess = person.progress.assessment;
  const allModulesDone = pathway.modules.every((m) => moduleComplete(person, m));

  const moduleCards = pathway.modules.map((mod, i) => {
    const mfrac = moduleProgress(person, mod);
    const done = mfrac >= 0.999;
    const quiz = person.progress.quiz[mod.id];
    const hasQuiz = moduleQuiz(person.role, mod.id).length >= 3;
    const compsDone = mod.competencies.filter((c) => person.progress.comps[mod.id + ":" + c.id]).length;
    return `
    <a class="card module-card ${done ? "done" : ""}" href="#/p/${person.id}/m/${mod.id}">
      <div class="module-num">${done ? icon("check", 16) : i + 1}</div>
      <div class="module-icn">${icon(mod.def.icon, 22)}</div>
      <div class="module-body">
        <b>${esc(mod.def.title)}</b>
        <p>${esc(mod.def.strap)}</p>
        <div class="module-facts">
          <span>${icon("book", 13)} ${mod.core.filter((a) => person.progress.read[a.id]).length}/${mod.core.length} lessons</span>
          ${mod.def.walkthrough && WALKTHROUGHS[mod.def.walkthrough] ? `<span>${icon("mouse", 13)} walkthrough ${person.progress.wt[mod.def.walkthrough] ? "✓" : ""}</span>` : ""}
          ${hasQuiz ? `<span>${icon("target", 13)} quiz ${quiz && quiz.passed ? "✓" : ""}</span>` : ""}
          <span>${icon("clipboard", 13)} ${compsDone}/${mod.competencies.length} signed off</span>
        </div>
      </div>
      ${ring(mfrac, 44, 4)}
    </a>`;
  }).join("");

  const assessmentCard = `
    <div class="card assessment-card ${assess && assess.passed ? "done" : ""} ${allModulesDone ? "" : "locked"}">
      <div class="module-icn">${icon("award", 24)}</div>
      <div class="module-body">
        <b>Final knowledge assessment</b>
        <p>${assess && assess.passed
          ? `Passed — ${assess.score}/${assess.total} on ${fmtDate(assess.at)}`
          : allModulesDone
            ? "All modules complete. Pass the assessment to finish the pathway."
            : "Unlocks when every module is complete and signed off."}</p>
      </div>
      ${assess && assess.passed
        ? `<a class="btn btn-ghost" href="#/p/${person.id}/record">${icon("printer", 15)} Competency record</a>`
        : allModulesDone
          ? `<a class="btn btn-primary" href="#/p/${person.id}/assessment">${icon("play", 15)} Start assessment</a>`
          : `<span class="lock">${icon("lock", 18)}</span>`}
    </div>`;

  shell(`
    <nav class="crumbs"><a href="#/">Team</a> ${icon("chevron-right", 13)} <span>${esc(person.name)}</span></nav>
    <section class="person-head" style="--accent:${persona.color}">
      <span class="avatar avatar-lg" style="background:${persona.color}">${esc(initials(person.name))}</span>
      <div class="person-head-text">
        <h1>${esc(person.name)}</h1>
        <span class="person-role">${icon(persona.icon, 15)} ${esc(persona.title)}</span>
        <p>${esc(persona.blurb)}</p>
      </div>
      <div class="person-head-side">
        ${ring(frac, 76, 7)}
        <div class="person-head-actions">
          <a class="btn btn-ghost btn-sm" href="#/p/${person.id}/record">${icon("printer", 14)} Record</a>
          <button class="btn btn-ghost btn-sm btn-danger" onclick="removePerson('${person.id}')">${icon("trash", 14)} Remove</button>
        </div>
      </div>
    </section>
    <section>
      <div class="section-head"><h2>${icon("compass", 20)} Learning pathway</h2>
        <span class="muted">${pathway.modules.length} modules · complete in order or dip in as needed</span></div>
      <div class="module-list">${moduleCards}${assessmentCard}</div>
    </section>`);
}

function removePerson(id) {
  const p = getPerson(id);
  if (!p) return;
  if (!confirm(`Remove ${p.name} and all their progress? This cannot be undone.`)) return;
  delete store.people[id];
  store.order = store.order.filter((x) => x !== id);
  saveStore();
  toast(`${p.name} removed`);
  nav("");
}

// ── View: Module ────────────────────────────────────────────────────────────

function viewModule(person, mod) {
  const persona = getPersona(person.role);
  const pr = person.progress;
  const wt = mod.def.walkthrough && WALKTHROUGHS[mod.def.walkthrough] ? WALKTHROUGHS[mod.def.walkthrough] : null;
  const quizQs = moduleQuiz(person.role, mod.id);
  const hasQuiz = quizQs.length >= 3;
  const quizState = pr.quiz[mod.id];
  const signoff = pr.signoff[mod.id];

  const lessonRow = (a, idx, isCore) => `
    <div class="lesson-row ${pr.read[a.id] ? "read" : ""}">
      <button class="lesson-check" title="${pr.read[a.id] ? "Mark unread" : "Mark as read"}"
        onclick="toggleRead('${person.id}','${mod.id}',${a.id})">${pr.read[a.id] ? icon("check-circle", 20) : icon("circle", 20)}</button>
      <a class="lesson-title" href="#/p/${person.id}/m/${mod.id}/l/${a.id}">${esc(a.title)}</a>
      ${isCore ? "" : '<span class="pill">reference</span>'}
    </div>`;

  const compRow = (c) => {
    const state = pr.comps[mod.id + ":" + c.id];
    return `
    <div class="comp-row ${state ? "confirmed" : ""}">
      <div class="comp-text">
        <span class="comp-lead">I can confidently…</span>
        <b>${esc(c.text)}</b>
        ${state ? `<span class="comp-stamp">${icon("check-circle", 13)} Confirmed ${fmtDate(state.at)}${state.by ? ` · witnessed by ${esc(state.by)}` : ""}</span>` : ""}
      </div>
      ${state
        ? `<button class="btn btn-ghost btn-sm" onclick="unconfirmComp('${person.id}','${mod.id}','${c.id}')">Undo</button>`
        : `<button class="btn btn-confirm" onclick="confirmComp('${person.id}','${mod.id}','${c.id}')">${icon("check", 14)} Confirm competent</button>`}
    </div>`;
  };

  shell(`
    <nav class="crumbs"><a href="#/">Team</a> ${icon("chevron-right", 13)}
      <a href="#/p/${person.id}">${esc(person.name)}</a> ${icon("chevron-right", 13)} <span>${esc(mod.def.title)}</span></nav>

    <section class="module-head" style="--accent:${persona.color}">
      <div class="module-icn module-icn-lg">${icon(mod.def.icon, 30)}</div>
      <div>
        <h1>${esc(mod.def.title)}</h1>
        <p>${esc(mod.def.summary)}</p>
      </div>
      ${ring(moduleProgress(person, mod), 68, 6)}
    </section>

    ${wt ? `
    <section class="card wt-card">
      <div class="wt-card-art">${icon("mouse", 30)}</div>
      <div class="module-body">
        <span class="eyebrow">Interactive walkthrough · ${wt.minutes} min</span>
        <b>${esc(wt.title)}</b>
        <p>${esc(wt.intro)}</p>
      </div>
      <button class="btn ${pr.wt[mod.def.walkthrough] ? "btn-ghost" : "btn-primary"}" onclick="startWalkthrough('${person.id}','${mod.id}','${mod.def.walkthrough}')">
        ${pr.wt[mod.def.walkthrough] ? icon("rotate", 15) + " Replay" : icon("play", 15) + " Start walkthrough"}
      </button>
      ${pr.wt[mod.def.walkthrough] ? `<span class="pill pill-green">${icon("check", 12)} completed</span>` : ""}
    </section>` : ""}

    <section>
      <div class="section-head"><h2>${icon("book", 19)} Lessons</h2>
        <span class="muted">${mod.core.filter((a) => pr.read[a.id]).length} of ${mod.core.length} core lessons read</span></div>
      <div class="card lesson-list">
        ${mod.core.map((a, i) => lessonRow(a, i, true)).join("") || '<p class="muted pad">No lessons for this role in this module.</p>'}
      </div>
      ${mod.reference.length ? `
      <details class="ref-library">
        <summary>${icon("folder", 15)} Reference library — ${mod.reference.length} further articles (optional)</summary>
        <div class="card lesson-list">${mod.reference.map((a, i) => lessonRow(a, i, false)).join("")}</div>
      </details>` : ""}
    </section>

    ${hasQuiz ? `
    <section class="card quiz-card ${quizState && quizState.passed ? "done" : ""}">
      <div class="module-icn">${icon("target", 22)}</div>
      <div class="module-body">
        <b>Knowledge check</b>
        <p>${quizState
          ? quizState.passed
            ? `Passed — ${quizState.score}/${quizState.total} on ${fmtDate(quizState.at)}`
            : `Last attempt ${quizState.score}/${quizState.total} — you need ${Math.ceil(quizState.total * PASS_MARK)} to pass. Have another go.`
          : `${quizQs.length} questions drawn from this module. Pass mark ${Math.round(PASS_MARK * 100)}%.`}</p>
      </div>
      <a class="btn ${quizState && quizState.passed ? "btn-ghost" : "btn-primary"}" href="#/p/${person.id}/m/${mod.id}/quiz">
        ${quizState ? (quizState.passed ? icon("rotate", 15) + " Retake" : icon("play", 15) + " Try again") : icon("play", 15) + " Start quiz"}</a>
    </section>` : ""}

    <section>
      <div class="section-head"><h2>${icon("clipboard", 19)} Competency sign-off</h2>
        <span class="muted">Confirm each skill only once you've done it (or simulated it) without help</span></div>
      <div class="card comp-list">${mod.competencies.map(compRow).join("")}</div>
      <div class="card supervisor-card ${signoff ? "confirmed" : ""}">
        <div class="module-body">
          <b>${icon("pen", 16)} Supervisor sign-off</b>
          ${signoff
            ? `<p>Signed off by <b>${esc(signoff.name)}</b> on ${fmtDate(signoff.at)}</p>`
            : `<p>Once all competencies above are confirmed, a supervisor or trainer countersigns this module.</p>`}
        </div>
        ${signoff
          ? `<button class="btn btn-ghost btn-sm" onclick="clearSignoff('${person.id}','${mod.id}')">Undo</button>`
          : `<form class="signoff-form" onsubmit="event.preventDefault(); doSignoff('${person.id}','${mod.id}',this)">
              <input name="supname" placeholder="Supervisor name" required maxlength="60">
              <button class="btn btn-primary" type="submit">Sign off module</button>
            </form>`}
      </div>
    </section>`);
}

function toggleRead(pid, mid, aid) {
  const p = getPerson(pid);
  if (p.progress.read[aid]) delete p.progress.read[aid];
  else p.progress.read[aid] = Date.now();
  saveStore();
  route();
}

function confirmComp(pid, mid, cid) {
  const by = prompt("Witnessed by (supervisor/buddy — optional, leave blank to self-certify):") || "";
  const p = getPerson(pid);
  p.progress.comps[mid + ":" + cid] = { at: Date.now(), by: by.trim() };
  saveStore();
  toast("Competency confirmed");
  route();
}

function unconfirmComp(pid, mid, cid) {
  const p = getPerson(pid);
  delete p.progress.comps[mid + ":" + cid];
  saveStore();
  route();
}

function doSignoff(pid, mid, form) {
  const p = getPerson(pid);
  const pathway = buildPathway(p.role);
  const mod = pathway.modules.find((m) => m.id === mid);
  const remaining = mod.competencies.filter((c) => !p.progress.comps[mid + ":" + c.id]).length;
  if (remaining > 0 && !confirm(`${remaining} competencies are not yet confirmed. Sign off anyway?`)) return;
  p.progress.signoff[mid] = { name: form.supname.value.trim(), at: Date.now() };
  saveStore();
  toast("Module signed off");
  route();
}

function clearSignoff(pid, mid) {
  const p = getPerson(pid);
  delete p.progress.signoff[mid];
  saveStore();
  route();
}

// ── View: Lesson reader ─────────────────────────────────────────────────────

function viewLesson(person, mod, articleId) {
  const a = window.ARTICLES.find((x) => x.id === articleId);
  if (!a) return viewModule(person, mod);
  const all = mod.core.concat(mod.reference);
  const idx = all.findIndex((x) => x.id === articleId);
  const next = all[idx + 1];
  const isRead = !!person.progress.read[a.id];

  shell(`
    <nav class="crumbs"><a href="#/">Team</a> ${icon("chevron-right", 13)}
      <a href="#/p/${person.id}">${esc(person.name)}</a> ${icon("chevron-right", 13)}
      <a href="#/p/${person.id}/m/${mod.id}">${esc(mod.def.title)}</a> ${icon("chevron-right", 13)} <span>Lesson</span></nav>

    <article class="lesson">
      <header class="lesson-head">
        <span class="eyebrow">${esc(a.section)} · lesson ${idx + 1} of ${all.length}</span>
        <h1>${esc(a.title)}</h1>
        <a class="btn btn-ghost btn-sm" href="${esc(a.url)}" target="_blank" rel="noopener">
          ${icon("external-link", 14)} Open in the Medicus Help Centre (with screenshots)</a>
      </header>
      <div class="lesson-body">${formatBody(a.body)}</div>
      <footer class="lesson-foot">
        <button class="btn ${isRead ? "btn-ghost" : "btn-primary"}" onclick="markReadAndNext('${person.id}','${mod.id}',${a.id},${next ? next.id : "null"})">
          ${isRead ? icon("check", 15) + " Already read" : icon("check", 15) + " Mark as read"}${next ? " · next lesson" : ""}
        </button>
        <a class="btn btn-ghost" href="#/p/${person.id}/m/${mod.id}">Back to module</a>
      </footer>
    </article>`);
}

function markReadAndNext(pid, mid, aid, nextId) {
  const p = getPerson(pid);
  p.progress.read[aid] = Date.now();
  saveStore();
  if (nextId) nav(`p/${pid}/m/${mid}/l/${nextId}`);
  else { toast("Lesson complete"); nav(`p/${pid}/m/${mid}`); }
}

// ── View: Quiz ──────────────────────────────────────────────────────────────

let quizSession = null;

function viewQuiz(person, mod, isFinal) {
  const questions = isFinal ? finalAssessment(person.role) : moduleQuiz(person.role, mod.id);
  if (!questions.length) return isFinal ? viewPerson(person) : viewModule(person, mod);
  quizSession = { pid: person.id, mid: mod ? mod.id : null, isFinal, questions, index: 0, score: 0, answered: -1 };
  renderQuizStep();
}

function renderQuizStep() {
  const s = quizSession;
  const person = getPerson(s.pid);
  const q = s.questions[s.index];
  const answered = s.answered >= 0;
  const title = s.isFinal ? "Final assessment" : MODULES[s.mid].title + " — knowledge check";
  const backHref = s.isFinal ? `#/p/${s.pid}` : `#/p/${s.pid}/m/${s.mid}`;

  shell(`
    <nav class="crumbs"><a href="#/">Team</a> ${icon("chevron-right", 13)}
      <a href="#/p/${s.pid}">${esc(person.name)}</a> ${icon("chevron-right", 13)} <span>${esc(title)}</span></nav>
    <div class="quiz">
      <div class="quiz-progress">
        <span>Question ${s.index + 1} of ${s.questions.length}</span>
        <div class="bar"><i style="width:${(s.index / s.questions.length) * 100}%"></i></div>
        <span class="muted">Score ${s.score}</span>
      </div>
      <div class="card quiz-q">
        <h2>${esc(q.question)}</h2>
        <div class="quiz-opts">
          ${q.options.map((o, i) => {
            let cls = "";
            if (answered) {
              if (i === q.correct) cls = "correct";
              else if (i === s.answered) cls = "wrong";
              else cls = "muted-opt";
            }
            return `<button class="quiz-opt ${cls}" ${answered ? "disabled" : ""} onclick="answerQuiz(${i})">
              <span class="opt-letter">${"ABCD"[i]}</span>${esc(o)}</button>`;
          }).join("")}
        </div>
        ${answered ? `
        <div class="quiz-expl ${s.answered === q.correct ? "ok" : "no"}">
          <b>${s.answered === q.correct ? icon("check-circle", 16) + " Correct" : icon("x", 16) + " Not quite"}</b>
          <p>${esc(q.explanation || "")}</p>
        </div>
        <div class="quiz-next">
          ${s.index + 1 < s.questions.length
            ? `<button class="btn btn-primary" onclick="nextQuiz()">Next question ${icon("arrow-right", 14)}</button>`
            : `<button class="btn btn-primary" onclick="finishQuiz()">See result ${icon("arrow-right", 14)}</button>`}
        </div>` : ""}
      </div>
      <a class="btn btn-ghost btn-sm" href="${backHref}">Exit quiz</a>
    </div>`);
}

function answerQuiz(i) {
  if (quizSession.answered >= 0) return;
  quizSession.answered = i;
  if (i === quizSession.questions[quizSession.index].correct) quizSession.score++;
  renderQuizStep();
}

function nextQuiz() {
  quizSession.index++;
  quizSession.answered = -1;
  renderQuizStep();
}

function finishQuiz() {
  const s = quizSession;
  const person = getPerson(s.pid);
  const total = s.questions.length;
  const passed = s.score / total >= PASS_MARK;
  const result = { score: s.score, total, passed, at: Date.now() };
  if (s.isFinal) person.progress.assessment = result;
  else person.progress.quiz[s.mid] = result;
  saveStore();

  const backHref = s.isFinal ? `#/p/${s.pid}` : `#/p/${s.pid}/m/${s.mid}`;
  shell(`
    <div class="quiz-result ${passed ? "passed" : "failed"}">
      <div class="result-badge">${icon(passed ? "award" : "rotate", 40)}</div>
      <h1>${passed ? (s.isFinal ? "Assessment passed!" : "Knowledge check passed!") : "Not quite this time"}</h1>
      <p class="result-score">${s.score} / ${total} ${passed ? "" : `— you need ${Math.ceil(total * PASS_MARK)} to pass`}</p>
      <p class="muted">${passed
        ? s.isFinal ? "The full pathway is complete. Print the competency record for the training file." : "Nice work — head back and finish the sign-off checklist."
        : "Revisit the lessons that caught you out, then try again. The questions explain each answer."}</p>
      <div class="result-actions">
        ${passed && s.isFinal ? `<a class="btn btn-primary" href="#/p/${s.pid}/record">${icon("printer", 15)} Competency record</a>` : ""}
        ${!passed ? `<button class="btn btn-primary" onclick="${s.isFinal ? `nav('p/${s.pid}/assessment')` : `nav('p/${s.pid}/m/${s.mid}/quiz')`}; route()">${icon("rotate", 15)} Try again</button>` : ""}
        <a class="btn btn-ghost" href="${backHref}">${s.isFinal ? "Back to pathway" : "Back to module"}</a>
      </div>
    </div>`);
  quizSession = null;
}

// ── View: Walkthrough player ────────────────────────────────────────────────

let wtSession = null;

function viewWalkthroughLaunch(person, mod) {
  // direct URL → bounce to module and open player
  nav(`p/${person.id}/m/${mod.id}`);
  if (mod.def.walkthrough) startWalkthrough(person.id, mod.id, mod.def.walkthrough);
}

function startWalkthrough(pid, mid, wid) {
  const wt = WALKTHROUGHS[wid];
  if (!wt) return;
  wtSession = { pid, mid, wid, step: 0 };
  let overlay = document.getElementById("wt-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "wt-overlay";
    document.body.appendChild(overlay);
  }
  document.body.classList.add("wt-open");
  renderWtStep();
}

function renderWtStep() {
  const s = wtSession;
  if (!s) return;
  const wt = WALKTHROUGHS[s.wid];
  const step = wt.steps[s.step];
  const overlay = document.getElementById("wt-overlay");

  overlay.innerHTML = `
    <div class="wt-chrome">
      <span class="wt-title">${icon("mouse", 16)} ${esc(wt.title)}</span>
      <span class="wt-dots">${wt.steps.map((_, i) =>
        `<i class="${i < s.step ? "past" : i === s.step ? "now" : ""}"></i>`).join("")}</span>
      <button class="wt-close" onclick="closeWalkthrough(true)">${icon("x", 16)} Exit</button>
    </div>
    <div class="wt-stage">${step.html()}</div>`;

  const hot = overlay.querySelector("[data-hot]");
  if (hot) {
    hot.classList.add("wt-hot");
    hot.addEventListener("click", (e) => { e.stopPropagation(); advanceWt(); });
    // coach mark
    const tip = document.createElement("div");
    tip.className = "wt-tip";
    tip.innerHTML = `<b>${step.tip.title}</b><p>${step.tip.body}</p>
      <span class="wt-tip-hint">${icon("mouse", 13)} click the highlighted area · step ${s.step + 1}/${wt.steps.length}</span>`;
    overlay.appendChild(tip);
    positionTip(tip, hot, overlay);
  }
  // wrong-click hint
  overlay.querySelector(".wt-stage").addEventListener("click", () => {
    const h = overlay.querySelector(".wt-hot");
    if (h) { h.classList.remove("wt-nudge"); void h.offsetWidth; h.classList.add("wt-nudge"); }
  });
}

function positionTip(tip, hot, overlay) {
  const hr = hot.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  const pad = 14;
  let top = hr.bottom + pad;
  if (top + tr.height > window.innerHeight - 20) top = hr.top - tr.height - pad;
  if (top < 70) top = 70;
  let left = hr.left + hr.width / 2 - tr.width / 2;
  left = Math.max(16, Math.min(left, window.innerWidth - tr.width - 16));
  tip.style.top = top + "px";
  tip.style.left = left + "px";
  tip.classList.add("placed");
}

function advanceWt() {
  const s = wtSession;
  const wt = WALKTHROUGHS[s.wid];
  if (s.step + 1 < wt.steps.length) {
    s.step++;
    renderWtStep();
  } else {
    finishWalkthrough();
  }
}

function finishWalkthrough() {
  const s = wtSession;
  const wt = WALKTHROUGHS[s.wid];
  const person = getPerson(s.pid);
  const first = !person.progress.wt[s.wid];
  person.progress.wt[s.wid] = Date.now();
  saveStore();
  const overlay = document.getElementById("wt-overlay");
  overlay.innerHTML = `
    <div class="wt-chrome"><span class="wt-title">${icon("mouse", 16)} ${esc(wt.title)}</span>
      <button class="wt-close" onclick="closeWalkthrough(true)">${icon("x", 16)} Close</button></div>
    <div class="wt-done">
      ${icon("check-circle", 48)}
      <h2>Walkthrough complete${first ? " — progress saved" : ""}</h2>
      <p>${esc(wt.outro)}</p>
      <div class="result-actions">
        <button class="btn btn-ghost" onclick="wtSession.step=0; renderWtStep()">${icon("rotate", 15)} Replay</button>
        <button class="btn btn-primary" onclick="closeWalkthrough(true)">${icon("check", 15)} Back to module</button>
      </div>
    </div>`;
}

function closeWalkthrough(refresh) {
  const overlay = document.getElementById("wt-overlay");
  if (overlay) overlay.remove();
  document.body.classList.remove("wt-open");
  if (wtSession && refresh) {
    const { pid, mid } = wtSession;
    wtSession = null;
    nav(`p/${pid}/m/${mid}`);
    route();
  } else {
    wtSession = null;
  }
}

// ── View: Printable competency record ───────────────────────────────────────

function viewRecord(person) {
  const persona = getPersona(person.role);
  const pathway = buildPathway(person.role);
  const assess = person.progress.assessment;
  const frac = overallProgress(person);

  const rows = pathway.modules.map((mod) => {
    const signoff = person.progress.signoff[mod.id];
    const comps = mod.competencies.map((c) => {
      const st = person.progress.comps[mod.id + ":" + c.id];
      return `<tr>
        <td class="rec-comp">${esc(c.text)}</td>
        <td>${st ? icon("check-circle", 15) + " " + fmtDate(st.at) : "—"}</td>
        <td>${st && st.by ? esc(st.by) : st ? "Self-certified" : "—"}</td>
      </tr>`;
    }).join("");
    return `
    <section class="rec-module">
      <h3>${icon(mod.def.icon, 16)} ${esc(mod.def.title)}</h3>
      <table>
        <thead><tr><th>Competency — “I can confidently…”</th><th>Confirmed</th><th>Witnessed by</th></tr></thead>
        <tbody>${comps}</tbody>
      </table>
      <p class="rec-signoff">Module supervisor sign-off:
        ${signoff ? `<b>${esc(signoff.name)}</b>, ${fmtDate(signoff.at)}` : "not yet signed <span class='rec-line'></span>"}</p>
    </section>`;
  }).join("");

  shell(`
    <nav class="crumbs no-print"><a href="#/">Team</a> ${icon("chevron-right", 13)}
      <a href="#/p/${person.id}">${esc(person.name)}</a> ${icon("chevron-right", 13)} <span>Competency record</span></nav>
    <div class="no-print rec-toolbar">
      <button class="btn btn-primary" onclick="window.print()">${icon("printer", 15)} Print / save as PDF</button>
      <span class="muted">A4 portrait recommended · this page is print-formatted</span>
    </div>
    <article class="record">
      <header class="rec-head">
        <div>
          <span class="brand-name">medic<b>us</b> <span class="brand-sub">onboarding</span></span>
          <h1>Competency Record</h1>
        </div>
        <table class="rec-meta">
          <tr><th>Name</th><td>${esc(person.name)}</td></tr>
          <tr><th>Role</th><td>${esc(persona.title)}</td></tr>
          <tr><th>Started</th><td>${fmtDate(person.created)}</td></tr>
          <tr><th>Generated</th><td>${fmtDate(Date.now())}</td></tr>
          <tr><th>Overall progress</th><td>${Math.round(frac * 100)}%</td></tr>
          <tr><th>Final assessment</th><td>${assess ? `${assess.score}/${assess.total} — ${assess.passed ? "PASSED" : "not passed"} (${fmtDate(assess.at)})` : "not taken"}</td></tr>
        </table>
      </header>
      ${rows}
      <footer class="rec-foot">
        <div class="rec-sig"><span class="rec-line"></span>Trainee signature & date</div>
        <div class="rec-sig"><span class="rec-line"></span>Training lead signature & date</div>
      </footer>
      <p class="rec-smallprint">Generated by the practice Medicus onboarding tool. Lesson content derives from the
      Medicus Help Centre (medicus-health.zendesk.com). Competency confirmations are self- or witness-declared and
      stored locally in the practice browser.</p>
    </article>`);
  document.body.classList.add("print-mode");
}

// ── View: Search ────────────────────────────────────────────────────────────

function viewSearch(query) {
  let resultsHtml = "";
  if (query.trim()) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results = window.ARTICLES.map((a) => {
      const titleL = a.title.toLowerCase();
      const bodyL = a.body.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (titleL.includes(t)) score += 12;
        let i = -1, n = 0;
        while ((i = bodyL.indexOf(t, i + 1)) !== -1 && n < 30) { score++; n++; }
      }
      return { a, score };
    }).filter((r) => r.score > 0).sort((x, y) => y.score - x.score).slice(0, 15);

    resultsHtml = results.length ? results.map(({ a }) => `
      <a class="card search-hit" href="${esc(a.url)}" target="_blank" rel="noopener">
        <span class="pill">${esc(a.section)}</span>
        <b>${esc(a.title)}</b>
        <p>${esc(a.body.slice(0, 180))}…</p>
        <span class="muted">${icon("external-link", 13)} medicus-health.zendesk.com · roles: ${a.roles.slice(0, 4).map(esc).join(", ")}${a.roles.length > 4 ? "…" : ""}</span>
      </a>`).join("")
      : `<p class="muted pad">No matches for “${esc(query)}”. Try different words — e.g. “DNA”, “smartcard”, “repeat prescription”.</p>`;
  }
  shell(`
    <section class="search-page">
      <h1>${icon("search", 24)} Search the help library</h1>
      <form class="bigsearch" onsubmit="event.preventDefault(); nav('search/' + encodeURIComponent(this.q.value))">
        <input name="q" value="${esc(query)}" placeholder="e.g. mark a DNA, pair smartcard, end a prescription…" autofocus>
        <button class="btn btn-primary">Search</button>
      </form>
      <div class="search-results">${resultsHtml}</div>
    </section>`, { q: query });
}

// ── Boot ────────────────────────────────────────────────────────────────────

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", () => {
  if (!window.ARTICLES || !window.MODULES) {
    document.getElementById("app").innerHTML =
      '<div class="boot-error">Could not load training data — data/data.js missing. Run scripts/build_data.py.</div>';
    return;
  }
  route();
});

// expose handlers used in inline HTML
Object.assign(window, {
  nav, addPersonSubmit, prefillRole, exportProgress, importProgress, removePerson,
  toggleRead, confirmComp, unconfirmComp, doSignoff, clearSignoff, markReadAndNext,
  answerQuiz, nextQuiz, finishQuiz, startWalkthrough, closeWalkthrough, renderWtStep,
});
