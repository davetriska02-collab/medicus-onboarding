// ─────────────────────────────────────────────────────────────────────────────
// Medicus Onboarding — application
// Vanilla JS single-page app. No build step, no backend.
// Data layer (storage modes, auth, merge): js/store.js
// Content: window.ARTICLES / window.QUIZZES (data/data.js),
//          window.MODULES / window.PERSONAS (js/curriculum.js),
//          window.WALKTHROUGHS (js/walkthroughs.js).
//
// Access model:
//   - first run → practice setup wizard (name, training-lead passcode, storage)
//   - staff log in with a personal PIN and see only their own pathway
//   - the training lead (admin passcode) sees everyone: dashboard, people
//     management, PIN resets, exports and settings
// ─────────────────────────────────────────────────────────────────────────────

const PASS_MARK = 0.8;

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

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
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

// ── Router & access control ─────────────────────────────────────────────────

function nav(path) { location.hash = path; }

function canView(personId) {
  if (isAdmin()) return true;
  const u = sessionUser();
  return u && u.id === personId;
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const seg = hash.split("/").filter(Boolean);
  closeWalkthrough(false);
  document.body.classList.remove("print-mode");

  if (needsReconnect) return viewReconnect();
  if (!store.practice) return viewSetup();
  const sess = session();
  if (!sess) return viewLogin();
  if (sess.kind === "user" && !getPerson(sess.id)) { setSession(null); return viewLogin(); }

  if (!seg.length) {
    if (isAdmin()) return viewAdminHome();
    return viewPerson(sessionUser());
  }
  if (seg[0] === "search") return viewSearch(decodeURIComponent(seg[1] || ""));
  if (seg[0] === "settings") return isAdmin() ? viewSettings() : viewLogin();
  if (seg[0] === "p") {
    const person = getPerson(seg[1]);
    if (!person || !canView(person.id)) return nav("");
    if (seg.length === 2) return viewPerson(person);
    if (seg[2] === "record") return viewRecord(person);
    if (seg[2] === "assessment") return viewQuiz(person, null, true);
    if (seg[2] === "m") {
      const mid = seg[3];
      const pathway = buildPathway(person.role);
      const mod = pathway.modules.find((m) => m.id === mid);
      if (!mod) return viewPerson(person);
      if (seg.length === 4) return viewModule(person, mod);
      if (seg[4] === "w") return viewWalkthroughLaunch(person, mod);
      if (seg[4] === "quiz") return viewQuiz(person, mod, false);
      return viewModule(person, mod);
    }
  }
  nav("");
}

function storageBadge() {
  return storageMode === "shared"
    ? `<span class="storage-badge ok" title="Progress is saved to the practice's shared data file">${icon("folder", 12)} Shared file</span>`
    : `<span class="storage-badge" title="Progress is saved in this browser only — the training lead can switch to a shared file in Settings">${icon("lock", 12)} This device only</span>`;
}

function identityChip() {
  if (isAdmin()) {
    return `<span class="id-chip"><span class="avatar avatar-xs" style="background:var(--ink)">${icon("shield-plus", 13)}</span> Training lead</span>
      <a class="btn btn-ghost btn-sm" href="#/settings">${icon("settings", 14)}</a>
      <button class="btn btn-ghost btn-sm" onclick="logout()">${icon("x", 13)} Log out</button>`;
  }
  const u = sessionUser();
  if (!u) return "";
  const persona = getPersona(u.role);
  return `<span class="id-chip"><span class="avatar avatar-xs" style="background:${persona ? persona.color : "var(--primary)"}">${esc(initials(u.name))}</span> ${esc(u.name.split(" ")[0])}</span>
    <button class="btn btn-ghost btn-sm" onclick="logout()">${icon("x", 13)} Log out</button>`;
}

function shell(content, opts = {}) {
  const app = document.getElementById("app");
  const authed = !!session() && store.practice && !needsReconnect;
  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="#/">
        <span class="brand-mark">${icon("sparkle", 18)}</span>
        <span class="brand-name">medic<b>us</b> <span class="brand-sub">onboarding</span></span>
        ${store.practice ? `<span class="practice-name">· ${esc(store.practice.name)}</span>` : ""}
      </a>
      <div class="header-actions">
        ${authed ? `
        <form class="header-search" onsubmit="event.preventDefault(); nav('search/' + encodeURIComponent(this.q.value))">
          ${icon("search", 15)}<input name="q" placeholder="Search the help library…" value="${esc(opts.q || "")}">
        </form>
        ${storageBadge()}
        ${identityChip()}` : storageBadge()}
      </div>
    </header>
    <main class="container ${opts.wide ? "wide" : ""}">${content}</main>
    <footer class="site-footer">
      Built on the <a href="https://medicus-health.zendesk.com/hc/en-gb" target="_blank" rel="noopener">Medicus Help Centre</a> ·
      training simulation, not the live Medicus product · no patient data is stored
    </footer>`;
  window.scrollTo(0, 0);
}

// ── View: Reconnect (shared file needs a permission click) ──────────────────

function viewReconnect() {
  shell(`
    <div class="gate-card card">
      <div class="gate-icn">${icon("folder", 34)}</div>
      <h1>Reconnect to the practice data file</h1>
      <p class="muted">Your browser remembers the shared data file but needs your OK to use it again
      (a one-click browser security rule).</p>
      <div class="result-actions">
        <button class="btn btn-primary" onclick="doReconnect()">${icon("check", 15)} Reconnect</button>
        <button class="btn btn-ghost" onclick="pickDifferentFile()">${icon("upload", 15)} Choose the file manually</button>
      </div>
    </div>`);
}

async function doReconnect() {
  try {
    if (await reconnectShared()) { toast("Connected to practice data"); route(); }
    else toast("Permission was not granted", "err");
  } catch (e) {
    toast("Couldn't reconnect — try choosing the file manually", "err");
  }
}

async function pickDifferentFile() {
  try {
    await connectSharedFile(false);
    needsReconnect = false;
    toast("Connected to practice data");
    route();
  } catch (e) { /* picker dismissed */ }
}

// ── View: First-run practice setup ──────────────────────────────────────────

function viewSetup() {
  const existing = store.order.length;
  shell(`
    <section class="hero hero-setup">
      <div class="hero-text">
        <span class="eyebrow">Set up Medicus onboarding for your practice</span>
        <h1>One folder. Every role. <em>Signed-off competence.</em></h1>
        <p>Guided Medicus training for all ${PERSONAS.length} jobs in the surgery — help-centre lessons, clickable
        walkthroughs, knowledge checks and a formal competency record, with individual logins and a
        training-lead view of the whole team.</p>
        ${existing ? `<p class="setup-note">${icon("check-circle", 14)} ${existing} existing ${existing === 1 ? "person" : "people"} found on this device — they'll be kept.</p>` : ""}
      </div>
      <form class="card setup-card" onsubmit="event.preventDefault(); submitSetup(this)">
        <h3>${icon("briefcase", 18)} Practice details</h3>
        <label>Practice name
          <input name="pname" required maxlength="60" placeholder="e.g. Witley Surgery"></label>
        <label>Training-lead passcode <span class="muted">(the super-user login — keep it private)</span>
          <input name="pass1" type="password" required minlength="6" placeholder="At least 6 characters"></label>
        <label>Confirm passcode
          <input name="pass2" type="password" required minlength="6"></label>

        <h3>${icon("folder", 18)} Where should progress be saved?</h3>
        ${supportsSharedMode() ? `
        <label class="radio"><input type="radio" name="storage" value="create" checked>
          <span><b>Shared data file (recommended)</b><br>
          <span class="muted">Creates <code>medicus-onboarding-data.json</code> — save it in this app's shared-drive folder so every machine sees the same team and progress.</span></span></label>
        <label class="radio"><input type="radio" name="storage" value="open">
          <span><b>Connect to an existing data file</b><br>
          <span class="muted">Your practice has already set up — pick its data file from the shared folder.</span></span></label>
        <label class="radio"><input type="radio" name="storage" value="local">
          <span><b>This device only</b><br>
          <span class="muted">Progress stays in this browser. You can switch to a shared file later in Settings.</span></span></label>
        ` : `<p class="muted">This browser can't write to shared folders (use Edge or Chrome for that) — progress will be saved on this device only.</p>`}

        <button class="btn btn-primary" type="submit">${icon("play", 15)} Set up practice</button>
        <p class="muted small">PINs and passcodes deter casual snooping — they are not strong security. Only training
        progress is stored; never any patient data.</p>
      </form>
    </section>`, { wide: true });
}

async function submitSetup(form) {
  const name = form.pname.value.trim();
  const p1 = form.pass1.value, p2 = form.pass2.value;
  if (p1 !== p2) return toast("Passcodes don't match", "err");
  const choice = form.storage ? form.storage.value : "local";
  try {
    if (choice === "open") {
      await connectSharedFile(false); // may already contain a practice
    }
    if (!store.practice) {
      store.practice = { name, adminHash: await hashSecret(p1), created: Date.now(), updated: Date.now() };
    }
    if (choice === "create") await connectSharedFile(true);
    saveStore();
    setSession({ kind: "admin" });
    toast(`Welcome, ${store.practice.name}`);
    nav("");
    route();
  } catch (e) {
    if (e && e.name === "AbortError") return; // picker dismissed — stay on form
    toast("Setup failed: " + e.message, "err");
  }
}

// ── View: Login ─────────────────────────────────────────────────────────────

function viewLogin(selectedId = null, mode = null) {
  const people = store.order.map((id) => store.people[id]).filter(Boolean);
  let panel = "";

  if (selectedId === "__admin") {
    panel = loginPanel("Training lead", "var(--ink)", icon("shield-plus", 16), `
      <form onsubmit="event.preventDefault(); adminLogin(this)">
        <input name="pass" type="password" placeholder="Practice passcode" required autofocus>
        <button class="btn btn-primary" type="submit">Log in</button>
      </form>`);
  } else if (selectedId) {
    const p = getPerson(selectedId);
    if (p && !p.pinHash) {
      panel = loginPanel(p.name, getPersona(p.role).color, esc(initials(p.name)), `
        <p class="muted">First login — choose a PIN you'll remember (at least 4 digits).</p>
        <form onsubmit="event.preventDefault(); setPinAndLogin('${p.id}', this)">
          <input name="pin1" type="password" inputmode="numeric" placeholder="Choose a PIN" required minlength="4" autofocus>
          <input name="pin2" type="password" inputmode="numeric" placeholder="Confirm PIN" required minlength="4">
          <button class="btn btn-primary" type="submit">Set PIN & start</button>
        </form>`);
    } else if (p) {
      panel = loginPanel(p.name, getPersona(p.role).color, esc(initials(p.name)), `
        <form onsubmit="event.preventDefault(); userLogin('${p.id}', this)">
          <input name="pin" type="password" inputmode="numeric" placeholder="Your PIN" required autofocus>
          <button class="btn btn-primary" type="submit">Log in</button>
        </form>
        <p class="muted small">Forgotten? The training lead can reset your PIN.</p>`);
    }
  }

  shell(`
    <section class="login-page">
      <h1>Who's training today?</h1>
      <p class="muted">Pick your name. Progress is personal — what you confirm is signed in your name.</p>
      <div class="grid login-grid">
        ${people.map((p) => {
          const persona = getPersona(p.role);
          return `<button class="login-tile ${selectedId === p.id ? "sel" : ""}" onclick="viewLogin('${p.id}')">
            <span class="avatar" style="background:${persona ? persona.color : "var(--primary)"}">${esc(initials(p.name))}</span>
            <b>${esc(p.name)}</b>
            <span class="muted">${persona ? esc(persona.title) : ""}</span>
            ${!p.pinHash ? '<span class="pill">new — set your PIN</span>' : ""}
          </button>`;
        }).join("")}
        <button class="login-tile login-admin ${selectedId === "__admin" ? "sel" : ""}" onclick="viewLogin('__admin')">
          <span class="avatar" style="background:var(--ink)">${icon("shield-plus", 18)}</span>
          <b>Training lead</b>
          <span class="muted">Team dashboard & admin</span>
        </button>
      </div>
      ${panel}
      ${!people.length ? `<p class="muted" style="margin-top:18px">No staff yet — log in as the training lead to add your team.</p>` : ""}
    </section>`);
  const input = document.querySelector(".login-panel input");
  if (input) input.focus();
}

function loginPanel(title, color, avatarHtml, body) {
  return `<div class="card login-panel">
    <div class="login-panel-head">
      <span class="avatar" style="background:${color}">${avatarHtml}</span>
      <b>${esc(title)}</b>
    </div>${body}</div>`;
}

async function userLogin(id, form) {
  const p = getPerson(id);
  const h = await hashSecret(form.pin.value);
  if (p && p.pinHash === h) {
    setSession({ kind: "user", id });
    toast(`Welcome back, ${p.name.split(" ")[0]}`);
    nav(""); route();
  } else {
    toast("Wrong PIN", "err");
    form.pin.value = ""; form.pin.focus();
  }
}

async function setPinAndLogin(id, form) {
  if (form.pin1.value !== form.pin2.value) return toast("PINs don't match", "err");
  const p = getPerson(id);
  p.pinHash = await hashSecret(form.pin1.value);
  touch(p); saveStore();
  setSession({ kind: "user", id });
  toast("PIN set — let's go");
  nav(""); route();
}

async function adminLogin(form) {
  const h = await hashSecret(form.pass.value);
  if (h === store.practice.adminHash) {
    setSession({ kind: "admin" });
    nav(""); route();
  } else {
    toast("Wrong passcode", "err");
    form.pass.value = ""; form.pass.focus();
  }
}

function logout() {
  setSession(null);
  nav(""); route();
}

// ── View: Training-lead dashboard ───────────────────────────────────────────

function viewAdminHome() {
  const people = store.order.map((id) => store.people[id]).filter(Boolean);
  const roleOptions = PERSONAS.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join("");
  const avg = people.length ? people.reduce((n, p) => n + overallProgress(p), 0) / people.length : 0;
  const done = people.filter((p) => overallProgress(p) >= 0.999).length;

  const rows = people.map((p) => {
    const persona = getPersona(p.role);
    const pathway = buildPathway(p.role);
    const frac = overallProgress(p);
    const dots = pathway.modules.map((m) => {
      const f = moduleProgress(p, m);
      const cls = f >= 0.999 ? "done" : f > 0 ? "part" : "";
      return `<span class="mod-dot ${cls}" title="${esc(m.def.title)} — ${Math.round(f * 100)}%"></span>`;
    }).join("");
    const assess = p.progress.assessment;
    return `<tr>
      <td><a class="dash-name" href="#/p/${p.id}">
        <span class="avatar avatar-xs" style="background:${persona.color}">${esc(initials(p.name))}</span>
        <span><b>${esc(p.name)}</b><br><span class="muted">${esc(persona.title)}</span></span></a></td>
      <td>${ring(frac, 42, 4)}</td>
      <td><div class="mod-dots">${dots}</div></td>
      <td>${assess ? (assess.passed ? `<span class="pill pill-green">${icon("award", 11)} ${assess.score}/${assess.total}</span>` : `<span class="pill">${assess.score}/${assess.total}</span>`) : '<span class="muted">—</span>'}</td>
      <td>${p.pinHash ? `<button class="btn btn-ghost btn-sm" onclick="resetPin('${p.id}')" title="Clear PIN — they set a new one next login">Reset PIN</button>` : '<span class="pill">no PIN yet</span>'}</td>
      <td class="dash-actions">
        <a class="btn btn-ghost btn-sm" href="#/p/${p.id}/record" title="Competency record">${icon("printer", 13)}</a>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="removePerson('${p.id}')" title="Remove">${icon("trash", 13)}</button>
      </td>
    </tr>`;
  }).join("");

  shell(`
    <section class="dash-head">
      <div>
        <span class="eyebrow">Training-lead dashboard</span>
        <h1>${esc(store.practice.name)}</h1>
      </div>
      <div class="hero-stats">
        <div><b>${people.length}</b><span>people</span></div>
        <div><b>${done}</b><span>fully signed off</span></div>
        <div><b>${Math.round(avg * 100)}%</b><span>average progress</span></div>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>${icon("users", 20)} Team progress</h2>
        <div class="section-actions">
          <button class="btn btn-ghost btn-sm" onclick="exportCsv()">${icon("download", 14)} CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="exportProgress()">${icon("download", 14)} Backup (JSON)</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('import-file').click()">${icon("upload", 14)} Restore</button>
          <input type="file" id="import-file" accept=".json" style="display:none" onchange="importProgress(this)">
        </div>
      </div>
      ${people.length ? `
      <div class="card dash-table-wrap">
        <table class="dash-table">
          <thead><tr><th>Person</th><th>Overall</th><th>Modules</th><th>Assessment</th><th>PIN</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : ""}
      <div class="card add-person" style="margin-top:16px">
        <h3>${icon("user", 18)} Add someone to the team</h3>
        <form class="add-person-row" onsubmit="event.preventDefault(); addPersonSubmit(this)">
          <input name="name" placeholder="Full name, e.g. Priya Shah" required maxlength="60">
          <select name="role" required>
            <option value="" disabled selected>Job role…</option>${roleOptions}
          </select>
          <button class="btn btn-primary" type="submit">${icon("play", 15)} Create pathway</button>
        </form>
        <p class="muted small">They'll appear on the login screen and set their own PIN on first login.</p>
      </div>
    </section>

    <section>
      <div class="section-head"><h2>${icon("compass", 20)} Pathways by role</h2></div>
      <div class="grid roles-grid">
        ${PERSONAS.map((p) => `<div class="role-tile" style="--accent:${p.color}">
            <span class="role-icn">${icon(p.icon, 22)}</span>
            <b>${esc(p.title)}</b>
            <p>${esc(p.blurb)}</p>
            <span class="role-meta">${p.modules.length} modules</span>
          </div>`).join("")}
      </div>
    </section>`, { wide: true });
}

function addPersonSubmit(form) {
  const name = form.name.value.trim();
  const role = form.role.value;
  if (!name || !role) return;
  newPerson(name, role);
  toast(`${name} added — they set a PIN on first login`);
  route();
}

function resetPin(id) {
  const p = getPerson(id);
  if (!confirm(`Reset ${p.name}'s PIN? They'll choose a new one next time they log in.`)) return;
  p.pinHash = null;
  touch(p); saveStore();
  toast("PIN reset");
  route();
}

function removePerson(id) {
  const p = getPerson(id);
  if (!p) return;
  if (!confirm(`Remove ${p.name} and all their progress? This cannot be undone.`)) return;
  deletePerson(p.id);
  toast(`${p.name} removed`);
  route();
}

function exportProgress() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `medicus-onboarding-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup downloaded");
}

function importProgress(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.people) throw new Error("bad format");
      Object.assign(store, mergeStores(store, migrateImport(data)));
      saveStore();
      toast("Backup merged in");
      route();
    } catch (e) {
      toast("That file isn't a valid backup", "err");
    }
  };
  reader.readAsText(file);
  input.value = "";
}

function migrateImport(data) {
  if (!data.version) data = { version: 3, practice: data.practice || null, people: data.people, order: data.order || Object.keys(data.people) };
  for (const p of Object.values(data.people)) {
    if (!("pinHash" in p)) p.pinHash = null;
    if (!p.updated) p.updated = p.created || Date.now();
  }
  return data;
}

function exportCsv() {
  const lines = [["Name", "Role", "Overall %", "Module", "Module %", "Competencies", "Supervisor sign-off", "Signed off on", "Knowledge check", "Final assessment"].join(",")];
  for (const id of store.order) {
    const p = store.people[id];
    if (!p) continue;
    const persona = getPersona(p.role);
    const pathway = buildPathway(p.role);
    const assess = p.progress.assessment;
    for (const m of pathway.modules) {
      const so = p.progress.signoff[m.id];
      const q = p.progress.quiz[m.id];
      const comps = `${m.competencies.filter((c) => p.progress.comps[m.id + ":" + c.id]).length}/${m.competencies.length}`;
      lines.push([
        csvCell(p.name), csvCell(persona.title), Math.round(overallProgress(p) * 100),
        csvCell(m.def.title), Math.round(moduleProgress(p, m) * 100), comps,
        csvCell(so ? so.name : ""), so ? fmtDate(so.at) : "",
        q ? `${q.score}/${q.total}${q.passed ? " pass" : ""}` : "",
        assess ? `${assess.score}/${assess.total}${assess.passed ? " pass" : ""}` : "",
      ].join(","));
    }
  }
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `medicus-onboarding-progress-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("CSV downloaded");
}

function csvCell(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

// ── View: Settings (admin) ──────────────────────────────────────────────────

function viewSettings() {
  shell(`
    <nav class="crumbs"><a href="#/">Dashboard</a> ${icon("chevron-right", 13)} <span>Settings</span></nav>
    <h1 class="page-title">${icon("settings", 22)} Practice settings</h1>

    <div class="card settings-card">
      <h3>${icon("briefcase", 16)} Practice</h3>
      <form class="settings-form" onsubmit="event.preventDefault(); savePracticeName(this)">
        <label>Practice name <input name="pname" value="${esc(store.practice.name)}" required maxlength="60"></label>
        <button class="btn btn-ghost btn-sm" type="submit">Save</button>
      </form>
      <form class="settings-form" onsubmit="event.preventDefault(); changePasscode(this)">
        <label>New training-lead passcode <input name="pass1" type="password" minlength="6" required placeholder="At least 6 characters"></label>
        <label>Confirm <input name="pass2" type="password" minlength="6" required></label>
        <button class="btn btn-ghost btn-sm" type="submit">Change passcode</button>
      </form>
    </div>

    <div class="card settings-card">
      <h3>${icon("folder", 16)} Storage</h3>
      <p>${storageMode === "shared"
        ? `${icon("check-circle", 14)} Progress is saved to the practice's <b>shared data file</b>. Every machine that connects to the same file sees the same team.`
        : `Progress is currently saved <b>in this browser only</b>. For a whole-practice setup, switch to a shared data file in your shared-drive folder.`}</p>
      ${supportsSharedMode() ? `
      <div class="result-actions" style="justify-content:flex-start">
        ${storageMode !== "shared" ? `
          <button class="btn btn-primary" onclick="switchToShared(true)">${icon("download", 14)} Create shared data file</button>
          <button class="btn btn-ghost" onclick="switchToShared(false)">${icon("upload", 14)} Connect to existing file</button>`
        : `<button class="btn btn-ghost" onclick="switchToShared(false)">${icon("rotate", 14)} Connect to a different file</button>`}
      </div>
      <p class="muted small">Save the file as <code>medicus-onboarding-data.json</code> in the same shared folder as this app.
      On each machine, staff connect once and the browser remembers it.</p>`
      : `<p class="muted small">Shared files need Edge or Chrome.</p>`}
    </div>

    <div class="card settings-card">
      <h3>${icon("alert", 16)} Good to know</h3>
      <ul class="muted settings-notes">
        <li>PINs and the passcode deter casual snooping; anyone with access to the shared folder can technically read the data file. Only training progress is stored — never patient data.</li>
        <li>Two people can use the app at once; progress merges automatically (newest change per person wins).</li>
        <li>Take an occasional JSON backup from the dashboard — it merges back in cleanly if anything is lost.</li>
      </ul>
    </div>`);
}

function savePracticeName(form) {
  store.practice.name = form.pname.value.trim();
  store.practice.updated = Date.now();
  saveStore();
  toast("Practice name saved");
  route();
}

async function changePasscode(form) {
  if (form.pass1.value !== form.pass2.value) return toast("Passcodes don't match", "err");
  store.practice.adminHash = await hashSecret(form.pass1.value);
  store.practice.updated = Date.now();
  saveStore();
  toast("Passcode changed");
  route();
}

async function switchToShared(create) {
  try {
    await connectSharedFile(create);
    saveStore();
    toast(create ? "Shared data file created" : "Connected to shared data file");
    route();
  } catch (e) {
    if (e && e.name !== "AbortError") toast("Couldn't connect: " + e.message, "err");
  }
}

// ── View: Person dashboard ──────────────────────────────────────────────────

function viewPerson(person) {
  const persona = getPersona(person.role);
  const pathway = buildPathway(person.role);
  const frac = overallProgress(person);
  const assess = person.progress.assessment;
  const allModulesDone = pathway.modules.every((m) => moduleComplete(person, m));
  const admin = isAdmin();

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
    ${admin ? `<nav class="crumbs"><a href="#/">Dashboard</a> ${icon("chevron-right", 13)} <span>${esc(person.name)}</span></nav>` : ""}
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
        </div>
      </div>
    </section>
    <section>
      <div class="section-head"><h2>${icon("compass", 20)} Learning pathway</h2>
        <span class="muted">${pathway.modules.length} modules · complete in order or dip in as needed</span></div>
      <div class="module-list">${moduleCards}${assessmentCard}</div>
    </section>`);
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
      <a class="lesson-title" href="${esc(a.url)}" target="_blank" rel="noopener"
        onclick="markRead('${person.id}',${a.id})">${esc(a.title)} ${icon("external-link", 13)}</a>
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
    <nav class="crumbs"><a href="#/">${isAdmin() ? "Dashboard" : "My pathway"}</a> ${icon("chevron-right", 13)}
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
        <span class="muted">${mod.core.filter((a) => pr.read[a.id]).length} of ${mod.core.length} core lessons read ·
          lessons open the Medicus Help Centre (with screenshots) in a new tab</span></div>
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
  touch(p); saveStore();
  route();
}

// Lessons open the Medicus Help Centre in a new tab; clicking marks them read.
function markRead(pid, aid) {
  const p = getPerson(pid);
  if (!p.progress.read[aid]) {
    p.progress.read[aid] = Date.now();
    touch(p); saveStore();
    setTimeout(route, 100); // refresh after the new tab opens
  }
}

function confirmComp(pid, mid, cid) {
  const by = prompt("Witnessed by (supervisor/buddy — optional, leave blank to self-certify):") || "";
  const p = getPerson(pid);
  p.progress.comps[mid + ":" + cid] = { at: Date.now(), by: by.trim() };
  touch(p); saveStore();
  toast("Competency confirmed");
  route();
}

function unconfirmComp(pid, mid, cid) {
  const p = getPerson(pid);
  delete p.progress.comps[mid + ":" + cid];
  touch(p); saveStore();
  route();
}

function doSignoff(pid, mid, form) {
  const p = getPerson(pid);
  const pathway = buildPathway(p.role);
  const mod = pathway.modules.find((m) => m.id === mid);
  const remaining = mod.competencies.filter((c) => !p.progress.comps[mid + ":" + c.id]).length;
  if (remaining > 0 && !confirm(`${remaining} competencies are not yet confirmed. Sign off anyway?`)) return;
  p.progress.signoff[mid] = { name: form.supname.value.trim(), at: Date.now() };
  touch(p); saveStore();
  toast("Module signed off");
  route();
}

function clearSignoff(pid, mid) {
  const p = getPerson(pid);
  delete p.progress.signoff[mid];
  touch(p); saveStore();
  route();
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
    <nav class="crumbs"><a href="#/p/${s.pid}">${esc(person.name)}</a> ${icon("chevron-right", 13)} <span>${esc(title)}</span></nav>
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
  touch(person); saveStore();

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
    const tip = document.createElement("div");
    tip.className = "wt-tip";
    tip.innerHTML = `<b>${step.tip.title}</b><p>${step.tip.body}</p>
      <span class="wt-tip-hint">${icon("mouse", 13)} click the highlighted area · step ${s.step + 1}/${wt.steps.length}</span>`;
    overlay.appendChild(tip);
    positionTip(tip, hot, overlay);
  }
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
  touch(person); saveStore();
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
    <nav class="crumbs no-print"><a href="#/p/${person.id}">${esc(person.name)}</a> ${icon("chevron-right", 13)} <span>Competency record</span></nav>
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
          <tr><th>Practice</th><td>${esc(store.practice.name)}</td></tr>
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
      Medicus Help Centre (medicus-health.zendesk.com). Competency confirmations are self- or witness-declared.</p>
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
        <span class="muted">${icon("external-link", 13)} opens in the Medicus Help Centre · for: ${a.roles.slice(0, 4).map(esc).join(", ")}${a.roles.length > 4 ? "…" : ""}</span>
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
window.addEventListener("DOMContentLoaded", async () => {
  if (!window.ARTICLES || !window.MODULES) {
    document.getElementById("app").innerHTML =
      '<div class="boot-error">Could not load training data — data/data.js missing. Run scripts/build_data.py.</div>';
    return;
  }
  await initStorage();
  route();
});

// expose handlers used in inline HTML
Object.assign(window, {
  nav, route, toast, addPersonSubmit, exportProgress, importProgress, exportCsv, removePerson, resetPin,
  toggleRead, confirmComp, unconfirmComp, doSignoff, clearSignoff, markRead,
  answerQuiz, nextQuiz, finishQuiz, startWalkthrough, closeWalkthrough, renderWtStep,
  viewLogin, userLogin, setPinAndLogin, adminLogin, logout, submitSetup,
  doReconnect, pickDifferentFile, savePracticeName, changePasscode, switchToShared,
  mergeStores,
});
