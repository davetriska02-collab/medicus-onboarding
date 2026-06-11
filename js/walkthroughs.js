// ─────────────────────────────────────────────────────────────────────────────
// Interactive walkthroughs — simulated Medicus screens.
//
// Each walkthrough is a sequence of steps. A step renders a full mock screen
// (an HTML string) containing exactly one element with [data-hot] — the
// hotspot the learner must click to advance. The engine (js/app.js) draws the
// pulsing highlight and coach-mark tooltip.
//
// All patients shown are fictional. This is a training simulation, not the
// live Medicus product.
// ─────────────────────────────────────────────────────────────────────────────

// ── Mock-screen building blocks ─────────────────────────────────────────────

const PT = { name: "CARTER, Emily (Mrs)", dob: "14-Mar-1986", age: "40y", nhs: "943 476 5919", addr: "12 Orchard Lane, Witley, GU8 5PE" };

function mxShell(active, body) {
  const items = [
    ["home", "Home"], ["calendar", "Appointment Book"], ["search", "Patient Finder"],
    ["clipboard", "Tasks"], ["message", "Chat"], ["chart", "Reports"], ["settings", "Admin"],
  ];
  return `
  <div class="mx-app">
    <div class="mx-topbar">
      <span class="mx-logo">medic<b>us</b></span>
      <span class="mx-globalsearch">${icon("search", 14)} Search patients, tasks…</span>
      <span class="mx-top-icons">${icon("bell", 16)}${icon("message", 16)}<span class="mx-panic" title="Panic button"></span><span class="mx-avatar">JD</span></span>
    </div>
    <div class="mx-body">
      <div class="mx-sidenav">
        ${items.map(([ic, label]) => `<div class="mx-navitem ${label === active ? "active" : ""}" ${label === "__never" ? "" : ""}data-nav="${label}">${icon(ic, 16)}<span>${label}</span></div>`).join("")}
      </div>
      <div class="mx-main">${body}</div>
    </div>
  </div>`;
}

// allow a sidebar item to be the hotspot
function mxShellNavHot(active, hotLabel, body) {
  return mxShell(active, body).replace(`data-nav="${hotLabel}"`, `data-hot data-nav="${hotLabel}"`);
}

function mxBanner(extra = "") {
  return `
  <div class="mx-banner">
    <div class="mx-banner-id">
      <span class="mx-pt-name">${PT.name}</span>
      <span>Born <b>${PT.dob}</b> (${PT.age})</span>
      <span>NHS No <b>${PT.nhs}</b></span>
      <span class="mx-muted">${PT.addr}</span>
    </div>
    <div class="mx-banner-chips">
      <span class="mx-chip mx-chip-red">${icon("alert", 12)} Penicillin allergy</span>
      <span class="mx-chip">${icon("phone", 12)} 07700 900123</span>
      ${extra}
    </div>
  </div>`;
}

function mxTabs(activeTab, hotTab = null) {
  const tabs = ["Summary", "Journal", "Medications", "Communications", "Documents", "Admin"];
  return `<div class="mx-tabs">${tabs.map((t) =>
    `<span class="mx-tab ${t === activeTab ? "active" : ""}" ${t === hotTab ? "data-hot" : ""}>${t}</span>`).join("")}</div>`;
}

function mxBtn(label, kind = "primary", hot = false) {
  return `<button class="mx-btn mx-btn-${kind}" ${hot ? "data-hot" : ""}>${label}</button>`;
}

function mxField(label, value, hot = false) {
  return `<div class="mx-field"><label>${label}</label><div class="mx-input" ${hot ? "data-hot" : ""}>${value}</div></div>`;
}

function mxSlideover(title, body, footer = "") {
  return `<div class="mx-slideover">
    <div class="mx-slideover-head"><b>${title}</b><span class="mx-x">${icon("x", 14)}</span></div>
    <div class="mx-slideover-body">${body}</div>
    ${footer ? `<div class="mx-slideover-foot">${footer}</div>` : ""}
  </div>`;
}

// Appointment book grid. slots: {time, col, label, status, hot}
function mxApptBook(slots, overlay = "") {
  const times = ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45"];
  const cols = ["Dr A Patel — Surgery 1", "Sister L Jones — Treatment Room"];
  const cells = times.map((t) => {
    const row = cols.map((c, ci) => {
      const s = slots.find((x) => x.time === t && x.col === ci);
      if (!s) return `<div class="mx-slot mx-slot-free">Available</div>`;
      return `<div class="mx-slot mx-slot-${s.status}" ${s.hot ? "data-hot" : ""}>
        <b>${s.label}</b>${s.sub ? `<span>${s.sub}</span>` : ""}</div>`;
    }).join("");
    return `<div class="mx-time">${t}</div>${row}`;
  }).join("");
  return `
  <div class="mx-page-head"><h3>Appointment Book</h3><span class="mx-muted">Wednesday 11 June 2026 · Witley Surgery</span></div>
  <div class="mx-book" style="grid-template-columns: 56px 1fr 1fr">
    <div></div>${cols.map((c) => `<div class="mx-colhead">${c}</div>`).join("")}
    ${cells}
  </div>${overlay}`;
}

function mxFreeSlotHot(time) {
  // helper: a free slot that is the hotspot
  return { time, col: 0, label: "Available", status: "free-hot", hot: true };
}

// ── Walkthrough definitions ─────────────────────────────────────────────────

const WALKTHROUGHS = {
  // 1 ─ Navigation, patient finder, tasks
  "wt-navigate": {
    title: "Finding your way around Medicus",
    minutes: 3,
    intro: "Tour the homepage, find a patient safely, and work your task list. Click the highlighted area on each screen to move forward — exactly as you would in Medicus.",
    steps: [
      {
        tip: { title: "Welcome to Medicus", body: "This is the homepage: your tasks, today's clinics and practice notices live here. The left navigation takes you everywhere. Let's find a patient — click <b>Patient Finder</b>." },
        html: () => mxShellNavHot("Home", "Patient Finder", `
          <div class="mx-page-head"><h3>Good morning, Jordan</h3><span class="mx-muted">Witley Surgery · Wednesday 11 June 2026</span></div>
          <div class="mx-cards">
            <div class="mx-card"><b>12</b><span>Tasks assigned to you</span></div>
            <div class="mx-card"><b>38</b><span>Appointments today</span></div>
            <div class="mx-card"><b>4</b><span>Unread chat messages</span></div>
          </div>
          <div class="mx-panel"><b>Practice noticeboard</b><p class="mx-muted">Flu clinic Saturday — extra HCA cover needed. Fire alarm test 12:00 Friday.</p></div>`),
      },
      {
        tip: { title: "Search for the patient", body: "Search by name and date of birth, or scan for the NHS number. Click the search box to look up <b>Emily Carter</b>." },
        html: () => mxShell("Patient Finder", `
          <div class="mx-page-head"><h3>Patient Finder</h3></div>
          <div class="mx-searchrow"><div class="mx-input mx-input-lg" data-hot>${icon("search", 16)} carter emily 14/03/1986</div>${mxBtn("Search")}</div>
          <p class="mx-muted">Tip: you can search by name, date of birth, NHS number, phone number or address.</p>`),
      },
      {
        tip: { title: "Verify before you open", body: "<b>Always verify at least three identifiers</b> — name, date of birth and address or NHS number — before opening a record. This row matches all three. Click the patient." },
        html: () => mxShell("Patient Finder", `
          <div class="mx-page-head"><h3>Patient Finder</h3></div>
          <div class="mx-searchrow"><div class="mx-input mx-input-lg">${icon("search", 16)} carter emily 14/03/1986</div>${mxBtn("Search")}</div>
          <div class="mx-list">
            <div class="mx-listrow" data-hot><b>${PT.name}</b><span>Born ${PT.dob}</span><span>NHS ${PT.nhs}</span><span class="mx-muted">${PT.addr}</span></div>
            <div class="mx-listrow"><b>CARTER, Emma (Miss)</b><span>Born 02-Nov-1994</span><span>NHS 943 281 0042</span><span class="mx-muted">8 Mill Road, Milford</span></div>
          </div>`),
      },
      {
        tip: { title: "The patient record", body: "The <b>patient banner</b> stays pinned everywhere in the record — identity, alerts and key warnings. Note the red allergy chip. Now let's check your work queue — click <b>Tasks</b>." },
        html: () => mxShellNavHot("Patient Finder", "Tasks", `
          ${mxBanner()}
          ${mxTabs("Summary")}
          <div class="mx-twocol">
            <div class="mx-panel"><b>Active problems</b><p>Asthma (2019) · Hypertension (2023)</p></div>
            <div class="mx-panel"><b>Acute medication</b><p>None issued in last 6 months</p></div>
            <div class="mx-panel"><b>Last consultation</b><p>04-Jun-2026 — Dr A Patel — Medication review</p></div>
            <div class="mx-panel"><b>Allergies</b><p class="mx-danger">Penicillin — rash (recorded 2012)</p></div>
          </div>`),
      },
      {
        tip: { title: "Your task list", body: "Tasks are how work moves around the practice — documents, requests, reminders. Open the first task." },
        html: () => mxShell("Tasks", `
          <div class="mx-page-head"><h3>My Tasks</h3><span class="mx-muted">12 open · 3 due today</span></div>
          <div class="mx-list">
            <div class="mx-listrow" data-hot><span class="mx-pill mx-pill-amber">Due today</span><b>Call patient re: blood results</b><span>CARTER, Emily</span><span class="mx-muted">From Dr Patel · 09:12</span></div>
            <div class="mx-listrow"><span class="mx-pill">Routine</span><b>Scan and file insurance form</b><span>BAXTER, Leon</span><span class="mx-muted">From reception · yesterday</span></div>
            <div class="mx-listrow"><span class="mx-pill">Routine</span><b>Update next-of-kin details</b><span>OKAFOR, Grace</span><span class="mx-muted">From Dr Whitmore · yesterday</span></div>
          </div>`),
      },
      {
        tip: { title: "Action and complete", body: "A task opens in a slideover: you can comment, reassign it to a colleague or team, or complete it. You've made the call — click <b>Mark as Complete</b>." },
        html: () => mxShell("Tasks", `
          <div class="mx-page-head"><h3>My Tasks</h3></div>
          <div class="mx-list mx-dim">
            <div class="mx-listrow"><span class="mx-pill mx-pill-amber">Due today</span><b>Call patient re: blood results</b><span>CARTER, Emily</span></div>
          </div>
          ${mxSlideover("Task — Call patient re: blood results", `
            ${mxField("Patient", PT.name)}
            ${mxField("Requested by", "Dr A Patel · 11-Jun-2026 09:12")}
            ${mxField("Note", "Please let Mrs Carter know her FBC is normal, no action needed.")}
            ${mxField("Add a comment", "Phoned 10:42 — patient informed, happy.")}`,
            `${mxBtn("Reassign", "ghost")}${mxBtn("Mark as Complete", "primary", true)}`)}`),
      },
    ],
    outro: "You can navigate Medicus, find the right patient safely and work a task end-to-end. In live Medicus, explore the Homepage tiles and Chat next.",
  },

  // 2 ─ Book & arrive an appointment
  "wt-appointment": {
    title: "Book and arrive a patient",
    minutes: 4,
    intro: "Book Emily Carter into this morning's surgery, then mark her as arrived when she reaches the front desk.",
    steps: [
      {
        tip: { title: "Find a free slot", body: "This is today's appointment book — one column per clinician. Free slots are white. Click the <b>10:30 slot with Dr Patel</b> to book it." },
        html: () => mxShell("Appointment Book", mxApptBook([
          { time: "09:00", col: 0, label: "WALSH, Peter", status: "booked", sub: "Telephone" },
          { time: "09:15", col: 0, label: "OKAFOR, Grace", status: "arrived", sub: "Arrived 09:08" },
          { time: "09:00", col: 1, label: "B12 clinic", status: "booked", sub: "NDLOVU, Sam" },
          { time: "09:30", col: 1, label: "Dressing", status: "booked", sub: "PRICE, Hannah" },
          mxFreeSlotHot("10:30"),
        ])),
      },
      {
        tip: { title: "Attach the patient", body: "The booking slideover opens against the slot. First, find the patient — click the patient search box." },
        html: () => mxShell("Appointment Book", mxApptBook([
          { time: "09:00", col: 0, label: "WALSH, Peter", status: "booked", sub: "Telephone" },
        ], mxSlideover("Book Appointment — 10:30, Dr A Patel", `
            ${mxField("Patient", `${icon("search", 14)} Search by name, DOB or NHS number…`, true)}
            ${mxField("Service", "GP Surgery — Face to face (15 min)")}
            ${mxField("Booking note", "")}`))),
      },
      {
        tip: { title: "Confirm the booking", body: "Patient attached, service correct, note added. Slot type matters — it drives the clinician's day and GPAD reporting. Click <b>Book Appointment</b>." },
        html: () => mxShell("Appointment Book", mxApptBook([
          { time: "09:00", col: 0, label: "WALSH, Peter", status: "booked", sub: "Telephone" },
        ], mxSlideover("Book Appointment — 10:30, Dr A Patel", `
            ${mxField("Patient", `${PT.name} · ${PT.dob} · NHS ${PT.nhs}`)}
            ${mxField("Service", "GP Surgery — Face to face (15 min)")}
            ${mxField("Booking note", "Cough 3 weeks, requesting review")}`,
          `${mxBtn("Cancel", "ghost")}${mxBtn("Book Appointment", "primary", true)}`))),
      },
      {
        tip: { title: "It's 10:24 — she's here", body: "The appointment is in the book. Mrs Carter has just arrived at the desk. Click her <b>10:30 appointment</b> to open it." },
        html: () => mxShell("Appointment Book", mxApptBook([
          { time: "09:00", col: 0, label: "WALSH, Peter", status: "booked", sub: "Telephone" },
          { time: "09:15", col: 0, label: "OKAFOR, Grace", status: "arrived", sub: "Seen" },
          { time: "10:30", col: 0, label: "CARTER, Emily", status: "booked", sub: "GP Surgery · F2F", hot: true },
        ])),
      },
      {
        tip: { title: "One-click arrival", body: "The appointment details slideover shows the status flow: Booked → Arrived → In Consultation → Departed. Click <b>mark them as arrived</b> — the clinician sees it instantly." },
        html: () => mxShell("Appointment Book", mxApptBook([
          { time: "10:30", col: 0, label: "CARTER, Emily", status: "booked", sub: "GP Surgery · F2F" },
        ], mxSlideover("Appointment — CARTER, Emily · 10:30", `
            ${mxField("Status", "Booked")}
            <div class="mx-notice" data-hot>${icon("check-circle", 16)} Patient at the desk? <u>Click here to mark them as arrived</u></div>
            ${mxField("Service", "GP Surgery — Face to face (15 min)")}
            ${mxField("Booking note", "Cough 3 weeks, requesting review")}`,
          `${mxBtn("Reschedule", "ghost")}${mxBtn("Cancel Appointment", "ghost")}`))),
      },
      {
        tip: { title: "Arrived ✓", body: "The slot turns green and Dr Patel's screen updates in real time. If a patient can't attend, you'd use <b>Cancel</b> or <b>Reschedule</b> from this same slideover — and <b>DNA</b> if they never turn up. Click the slot to finish.", },
        html: () => mxShell("Appointment Book", mxApptBook([
          { time: "10:30", col: 0, label: "CARTER, Emily", status: "arrived", sub: "Arrived 10:24", hot: true },
        ])),
      },
    ],
    outro: "Booked, noted and arrived. Practise next: rescheduling, cancelling with a reason, and marking a DNA — all from the same appointment slideover.",
  },

  // 3 ─ Register a patient
  "wt-register": {
    title: "Register a new patient",
    minutes: 4,
    intro: "A new patient, Daniel Mercer, walks in to register. You'll trace him on the NHS Spine (PDS) and complete a permanent registration.",
    steps: [
      {
        tip: { title: "Start a registration", body: "Registration starts from the Patient Finder — if a patient isn't found, you can register them. Click <b>Register New Patient</b>." },
        html: () => mxShell("Patient Finder", `
          <div class="mx-page-head"><h3>Patient Finder</h3></div>
          <div class="mx-searchrow"><div class="mx-input mx-input-lg">${icon("search", 16)} mercer daniel 22/08/1991</div>${mxBtn("Search")}</div>
          <div class="mx-empty">No matching patients at this practice.<br>${mxBtn("Register New Patient", "primary", true)}</div>`),
      },
      {
        tip: { title: "Choose the right type", body: "<b>Permanent</b> for patients joining the practice; <b>Temporary</b> for short stays; <b>Immediate & Necessary</b> for urgent one-offs. Daniel is moving to the area — click <b>Permanent</b>." },
        html: () => mxShell("Patient Finder", `
          <div class="mx-page-head"><h3>New Patient Registration</h3></div>
          <div class="mx-choice-grid">
            <div class="mx-choice" data-hot><b>Permanent</b><span>Joining the practice list (GMS registration)</span></div>
            <div class="mx-choice"><b>Temporary</b><span>In the area under 3 months</span></div>
            <div class="mx-choice"><b>Immediate & Necessary</b><span>Urgent treatment only</span></div>
            <div class="mx-choice"><b>Other / custom</b><span>Practice-defined types</span></div>
          </div>`),
      },
      {
        tip: { title: "Trace on the Spine", body: "A PDS trace fetches the patient's NHS number and national record — it prevents duplicates and typos. Details entered; click <b>Search PDS</b>." },
        html: () => mxShell("Patient Finder", `
          <div class="mx-page-head"><h3>Permanent Registration — PDS Trace</h3></div>
          <div class="mx-formgrid">
            ${mxField("First name", "Daniel")}${mxField("Last name", "Mercer")}
            ${mxField("Date of birth", "22-Aug-1991")}${mxField("Gender", "Male")}
            ${mxField("Postcode", "GU8 5QT")}
          </div>
          <div class="mx-formfoot">${mxBtn("Search PDS", "primary", true)}</div>`),
      },
      {
        tip: { title: "Confirm the match", body: "One PDS match, and the demographics line up. Confirming pulls his NHS number and Spine demographics straight in. Click <b>Use this match</b>." },
        html: () => mxShell("Patient Finder", `
          <div class="mx-page-head"><h3>Permanent Registration — PDS Trace</h3></div>
          <div class="mx-panel mx-panel-ok">
            <b>1 match found on PDS</b>
            <div class="mx-listrow"><b>MERCER, Daniel (Mr)</b><span>Born 22-Aug-1991</span><span>NHS 485 777 3456</span><span class="mx-muted">Previous GP: Riverside Practice, Guildford</span></div>
            ${mxBtn("Use this match", "primary", true)}
          </div>`),
      },
      {
        tip: { title: "Finish the registration", body: "Contact details, registered GP and consent preferences are captured here; the previous practice transfer (GP2GP) kicks off automatically once submitted. Click <b>Complete Registration</b>." },
        html: () => mxShell("Patient Finder", `
          <div class="mx-page-head"><h3>Permanent Registration — Details</h3></div>
          <div class="mx-formgrid">
            ${mxField("NHS number", "485 777 3456 ✓ verified")}
            ${mxField("Mobile", "07700 900456")}
            ${mxField("Registered GP", "Dr A Patel")}
            ${mxField("SMS consent", "Yes")}
            ${mxField("Online services", "NHS App — full access requested")}
          </div>
          <div class="mx-formfoot">${mxBtn("Back", "ghost")}${mxBtn("Complete Registration", "primary", true)}</div>`),
      },
      {
        tip: { title: "Registered ✓", body: "Daniel is on the list; the GP2GP record transfer and registration paperwork tasks are created automatically. Click the confirmation to finish." },
        html: () => mxShell("Patient Finder", `
          <div class="mx-success" data-hot>
            ${icon("check-circle", 36)}
            <h3>MERCER, Daniel registered</h3>
            <p>GP2GP transfer requested from Riverside Practice.<br>New-patient questionnaire task created for the care navigation team.</p>
          </div>`),
      },
    ],
    outro: "You traced, matched and registered in one pass. Read the temporary and INT registration lessons to know when each type applies.",
  },

  // 4 ─ Record a consultation
  "wt-consult": {
    title: "Record a consultation",
    minutes: 4,
    intro: "Dr-side view: Emily Carter is in the room with a three-week cough. Record, code and complete the consultation.",
    steps: [
      {
        tip: { title: "Start from the book", body: "Clinicians launch consultations straight from their appointment list. Mrs Carter is arrived — click her appointment to begin." },
        html: () => mxShell("Appointment Book", mxApptBook([
          { time: "10:30", col: 0, label: "CARTER, Emily", status: "arrived", sub: "Arrived 10:24", hot: true },
        ])),
      },
      {
        tip: { title: "Code the problem", body: "A consultation is structured: problem, history, examination, plan. Free text is searchable, but <b>SNOMED codes drive everything</b> — QOF, recalls, safety alerts. Click the problem search to code it." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Consultation — GP Surgery</h3><span class="mx-muted">Dr A Patel · 11-Jun-2026 10:31</span></div>
          <div class="mx-consult">
            ${mxField("Problem", `${icon("search", 14)} cough 3 weeks…`, true)}
            ${mxField("History", "Productive cough 3/52, worse at night. No haemoptysis, no weight loss. Never smoker.")}
            ${mxField("Examination", "")}
            ${mxField("Plan", "")}
          </div>`),
      },
      {
        tip: { title: "Pick the SNOMED concept", body: "Medicus suggests matching SNOMED CT concepts as you type. Pick the clinically correct one — click <b>Acute cough</b>." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Consultation — GP Surgery</h3></div>
          <div class="mx-consult">
            ${mxField("Problem", "cough")}
            <div class="mx-dropdown">
              <div class="mx-option" data-hot><b>Acute cough</b><span class="mx-muted">SNOMED 11833005</span></div>
              <div class="mx-option">Chronic cough <span class="mx-muted">68154008</span></div>
              <div class="mx-option">Nocturnal cough <span class="mx-muted">22325002</span></div>
            </div>
          </div>`),
      },
      {
        tip: { title: "Add an observation", body: "Observations recorded as structured data (not free text) chart over time and feed templates and QOF. Chest sounds fine; record her oxygen sats — click <b>Add observation</b>." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Consultation — GP Surgery</h3></div>
          <div class="mx-consult">
            ${mxField("Problem", "Acute cough · SNOMED 11833005 ✓")}
            ${mxField("Examination", "Chest clear, no wheeze. Throat NAD.")}
            <div class="mx-notice" data-hot>${icon("activity", 16)} <u>Add observation</u> — BP, pulse, SpO₂, weight…</div>
          </div>`),
      },
      {
        tip: { title: "Complete it", body: "SpO₂ 98% recorded as structured data. Plan documented, safety-netting noted. Click <b>Complete Consultation</b> — completing files it to the journal and frees the room." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Consultation — GP Surgery</h3></div>
          <div class="mx-consult">
            ${mxField("Problem", "Acute cough · SNOMED 11833005 ✓")}
            ${mxField("Observations", "SpO₂ 98% · Pulse 72 · Temp 36.8°C")}
            ${mxField("Plan", "Viral, self-care advice. Safety-net: return if haemoptysis, fever or >6 weeks.")}
            <div class="mx-formfoot">${mxBtn("Save Draft", "ghost")}${mxBtn("Complete Consultation", "primary", true)}</div>
          </div>`),
      },
      {
        tip: { title: "In the journal ✓", body: "The consultation is filed, coded and visible in the journal with a full audit trail. If you spot an error later, use <i>retrospectively update</i> or <i>mark as incorrect</i> — never just re-type. Click the entry to finish." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          ${mxTabs("Journal")}
          <div class="mx-list">
            <div class="mx-listrow" data-hot><span class="mx-pill mx-pill-green">Today 10:43</span><b>GP Surgery — Acute cough</b><span>Dr A Patel</span><span class="mx-muted">SpO₂ 98% · self-care, safety-netted</span></div>
            <div class="mx-listrow"><span class="mx-pill">04-Jun</span><b>Medication review</b><span>Dr A Patel</span></div>
          </div>`),
      },
    ],
    outro: "Coded consultation, structured observation, clean completion. Next: practise templates for your regular clinics and the fit-note workflow.",
  },

  // 5 ─ Issue a prescription
  "wt-prescribe": {
    title: "Issue an acute prescription",
    minutes: 4,
    intro: "Issue doxycycline for Emily Carter and send it electronically (EPS) to her nominated pharmacy. Watch what the allergy check does.",
    steps: [
      {
        tip: { title: "The medication regimen", body: "The Medications tab shows everything: acutes, repeats, authorisations and what's been issued. Start a new acute — click <b>New Prescription</b>." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          ${mxTabs("Medications")}
          <div class="mx-page-head"><h3>Medication Regimen</h3>${mxBtn("New Prescription", "primary", true)}</div>
          <div class="mx-list">
            <div class="mx-listrow"><span class="mx-pill mx-pill-green">Repeat</span><b>Sertraline 50mg tablets</b><span>One daily · 28 tablets</span><span class="mx-muted">3 of 6 issues used · review Nov 2026</span></div>
            <div class="mx-listrow"><span class="mx-pill">Acute</span><b>Salbutamol 100micrograms/dose inhaler</b><span>2 puffs PRN</span><span class="mx-muted">Issued 12-May-2026</span></div>
          </div>`),
      },
      {
        tip: { title: "Search the formulary", body: "Drug search runs against dm+d with your local formulary preferences first. Click the search box to find <b>doxycycline</b>." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Prescription</h3></div>
          ${mxField("Drug", `${icon("search", 14)} doxycyc…`, true)}`),
      },
      {
        tip: { title: "Note the safety check", body: "Amoxicillin is greyed out — Medicus has blocked it against her <b>penicillin allergy</b>. This is why allergies must be coded, not free-texted. Click <b>Doxycycline 100mg capsules</b>." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Prescription</h3></div>
          ${mxField("Drug", "doxycycline")}
          <div class="mx-dropdown">
            <div class="mx-option" data-hot><b>Doxycycline 100mg capsules</b><span class="mx-muted">Formulary first-line</span></div>
            <div class="mx-option mx-option-blocked">${icon("alert", 14)} Amoxicillin 500mg capsules <span class="mx-muted">Blocked — penicillin allergy</span></div>
            <div class="mx-option">Doxycycline 40mg modified-release capsules</div>
          </div>`),
      },
      {
        tip: { title: "Dose, course, quantity", body: "Dosage instructions print on the label exactly as written here. Course and quantity are pre-calculated but always sense-check them. Click <b>Continue to Sign</b>." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Prescription — Doxycycline 100mg capsules</h3></div>
          <div class="mx-formgrid">
            ${mxField("Dosage", "Two capsules on day one, then one daily")}
            ${mxField("Course", "7 days")}
            ${mxField("Quantity", "8 capsules")}
            ${mxField("Type", "Acute")}
          </div>
          <div class="mx-formfoot">${mxBtn("Back", "ghost")}${mxBtn("Continue to Sign", "primary", true)}</div>`),
      },
      {
        tip: { title: "Sign and send via EPS", body: "Signing needs your smartcard or credentials — it's a legal act. The script goes electronically to her nominated pharmacy. Click <b>Sign & Send</b>." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>Sign Prescription</h3></div>
          <div class="mx-panel">
            <b>Doxycycline 100mg capsules</b>
            <p>Two capsules on day one, then one daily · 7 days · 8 capsules</p>
            <p class="mx-muted">${icon("check-circle", 14)} Interaction & allergy checks passed</p>
            <p class="mx-muted">${icon("package", 14)} EPS nomination: Witley Village Pharmacy</p>
          </div>
          <div class="mx-formfoot">${mxBtn("Print instead", "ghost")}${mxBtn("Sign & Send (EPS)", "primary", true)}</div>`),
      },
      {
        tip: { title: "On its way ✓", body: "The prescription is signed, sent and on the regimen with a full audit trail. Mistake after signing? Use <i>mark as incorrect</i> / <i>end prescription</i> — the lessons cover both. Click the new entry to finish." },
        html: () => mxShell("Appointment Book", `
          ${mxBanner()}
          ${mxTabs("Medications")}
          <div class="mx-page-head"><h3>Medication Regimen</h3></div>
          <div class="mx-list">
            <div class="mx-listrow" data-hot><span class="mx-pill mx-pill-green">Sent via EPS · just now</span><b>Doxycycline 100mg capsules</b><span>2 on day 1, then 1 daily · 8 caps</span><span class="mx-muted">Witley Village Pharmacy</span></div>
            <div class="mx-listrow"><span class="mx-pill mx-pill-green">Repeat</span><b>Sertraline 50mg tablets</b><span>One daily</span></div>
          </div>`),
      },
    ],
    outro: "Prescribed safely with the allergy check doing its job. Next lessons: re-authorising repeats, editing and ending prescriptions, and actioning patient prescription requests.",
  },

  // 6 ─ Process an inbound document
  "wt-document": {
    title: "Process an inbound document",
    minutes: 3,
    intro: "A discharge summary has arrived in the practice inbox. Match it, code it, file it — and task the GP.",
    steps: [
      {
        tip: { title: "The document queue", body: "Inbound documents — scans, hospital letters, MESH — land in a shared task list. Open the discharge summary at the top." },
        html: () => mxShell("Tasks", `
          <div class="mx-page-head"><h3>Inbound Documents</h3><span class="mx-muted">4 awaiting processing</span></div>
          <div class="mx-list">
            <div class="mx-listrow" data-hot><span class="mx-pill mx-pill-amber">New</span><b>Discharge summary — Royal Surrey</b><span class="mx-muted">Received 08:55 via MESH</span></div>
            <div class="mx-listrow"><span class="mx-pill mx-pill-amber">New</span><b>Outpatient letter — Dermatology</b><span class="mx-muted">Received 08:31</span></div>
            <div class="mx-listrow"><span class="mx-pill">Scanned</span><b>Insurance report request</b><span class="mx-muted">Scanned yesterday 16:02</span></div>
          </div>`),
      },
      {
        tip: { title: "Match the patient", body: "The letter preview sits beside the patient match. Medicus suggests Emily Carter from the NHS number — <b>check name and DOB against the letter yourself</b> before confirming. Click <b>Confirm Patient</b>." },
        html: () => mxShell("Tasks", `
          <div class="mx-page-head"><h3>Process Document — Discharge summary</h3></div>
          <div class="mx-twocol">
            <div class="mx-docpreview"><b>ROYAL SURREY COUNTY HOSPITAL</b><p>Discharge summary<br>Patient: Emily CARTER · DOB 14/03/1986<br>NHS: 943 476 5919<br>Admitted 08-Jun · Discharged 10-Jun<br>Dx: Community-acquired pneumonia…</p></div>
            <div>
              <div class="mx-panel mx-panel-ok"><b>Suggested match (NHS number)</b><p>${PT.name} · ${PT.dob}<br>NHS ${PT.nhs}</p>${mxBtn("Confirm Patient", "primary", true)}</div>
              <p class="mx-muted">Wrong match? Search manually instead.</p>
            </div>
          </div>`),
      },
      {
        tip: { title: "Code the content", body: "Coding the diagnosis files it into the structured record — recalls and QOF pick it up from here. Click the suggested code <b>Community-acquired pneumonia</b>." },
        html: () => mxShell("Tasks", `
          <div class="mx-page-head"><h3>Process Document — ${PT.name}</h3></div>
          <div class="mx-twocol">
            <div class="mx-docpreview mx-dim"><b>ROYAL SURREY COUNTY HOSPITAL</b><p>Dx: Community-acquired pneumonia…</p></div>
            <div>
              ${mxField("Document type", "Discharge summary")}
              ${mxField("Add clinical codes", "pneumonia")}
              <div class="mx-dropdown">
                <div class="mx-option" data-hot><b>Community acquired pneumonia</b><span class="mx-muted">SNOMED 385093006</span></div>
                <div class="mx-option">Pneumonia <span class="mx-muted">233604007</span></div>
              </div>
            </div>
          </div>`),
      },
      {
        tip: { title: "File — and route", body: "Filing alone is fine for routine copies, but this discharge changes medication, so the GP must see it. Click <b>File & Task Dr Patel</b>." },
        html: () => mxShell("Tasks", `
          <div class="mx-page-head"><h3>Process Document — ${PT.name}</h3></div>
          ${mxField("Coded", "Community acquired pneumonia · 385093006 ✓")}
          ${mxField("Comment for GP", "New abx course on discharge — med changes to reconcile")}
          <div class="mx-choice-grid">
            <div class="mx-choice"><b>File only</b><span>No clinical action needed</span></div>
            <div class="mx-choice" data-hot><b>File & Task Dr Patel</b><span>Needs clinical review</span></div>
            <div class="mx-choice"><b>File & Task team</b><span>e.g. coding team, pharmacist</span></div>
          </div>`),
      },
      {
        tip: { title: "Done ✓", body: "Filed to the record, coded, and a review task is in Dr Patel's list with your comment. One document fully processed — three to go in real life! Click the confirmation to finish." },
        html: () => mxShell("Tasks", `
          <div class="mx-success" data-hot>
            ${icon("check-circle", 36)}
            <h3>Document filed & tasked</h3>
            <p>Discharge summary filed to CARTER, Emily.<br>Review task sent to Dr A Patel.</p>
          </div>`),
      },
    ],
    outro: "Matched carefully, coded properly, routed to the right person. The referrals and results lessons build on exactly this workflow.",
  },

  // 7 ─ Send an SMS
  "wt-sms": {
    title: "Message a patient",
    minutes: 3,
    intro: "Send Emily Carter a one-off SMS with her appointment details — checking her communication preferences first.",
    steps: [
      {
        tip: { title: "Communications tab", body: "Every message ever sent to the patient lives here — SMS, email, letters — plus two-way conversations. Click <b>New Communication</b>." },
        html: () => mxShell("Patient Finder", `
          ${mxBanner('<span class="mx-chip">${"" }SMS consent: Yes</span>')}
          ${mxTabs("Communications")}
          <div class="mx-page-head"><h3>Communications</h3>${mxBtn("New Communication", "primary", true)}</div>
          <div class="mx-list">
            <div class="mx-listrow"><span class="mx-pill mx-pill-green">Delivered</span><b>SMS — Appointment reminder</b><span class="mx-muted">04-Jun-2026 09:00</span></div>
            <div class="mx-listrow"><span class="mx-pill mx-pill-green">Delivered</span><b>SMS — Flu campaign invite</b><span class="mx-muted">12-May-2026</span></div>
          </div>`),
      },
      {
        tip: { title: "Preferences first", body: "Medicus shows her consent and preferred channel before you write a word: <b>SMS — consented ✓</b>. If this said 'no SMS', you'd stop here. Pick a template — click the template selector." },
        html: () => mxShell("Patient Finder", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Communication — ${PT.name}</h3></div>
          <div class="mx-panel mx-panel-ok">${icon("check-circle", 14)} SMS consent: Yes · Mobile 07700 900123 verified</div>
          ${mxField("Channel", "SMS")}
          ${mxField("Template", "Choose a template…", true)}`),
      },
      {
        tip: { title: "Templates keep it safe", body: "Approved templates mean consistent wording and no accidental clinical detail over SMS. Click <b>Appointment details</b>." },
        html: () => mxShell("Patient Finder", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Communication — ${PT.name}</h3></div>
          ${mxField("Channel", "SMS")}
          <div class="mx-dropdown">
            <div class="mx-option" data-hot><b>Appointment details</b><span class="mx-muted">Date, time, clinician merge fields</span></div>
            <div class="mx-option">Test results — normal, no action</div>
            <div class="mx-option">Please contact the surgery</div>
          </div>`),
      },
      {
        tip: { title: "Preview, then send", body: "Merge fields are filled from the booking — read the preview as the patient will receive it. All good? Click <b>Send Message</b>." },
        html: () => mxShell("Patient Finder", `
          ${mxBanner()}
          <div class="mx-page-head"><h3>New Communication — ${PT.name}</h3></div>
          <div class="mx-smspreview">
            <div class="mx-bubble">Hi Emily, your appointment is on Wed 11 Jun at 10:30 with Dr Patel at Witley Surgery. Reply CANCEL if you can no longer attend.</div>
          </div>
          <div class="mx-formfoot">${mxBtn("Back", "ghost")}${mxBtn("Send Message", "primary", true)}</div>`),
      },
      {
        tip: { title: "Sent ✓", body: "Delivery status updates live; failures appear as tasks so they're never silently lost. Click the sent message to finish." },
        html: () => mxShell("Patient Finder", `
          ${mxBanner()}
          ${mxTabs("Communications")}
          <div class="mx-page-head"><h3>Communications</h3></div>
          <div class="mx-list">
            <div class="mx-listrow" data-hot><span class="mx-pill mx-pill-green">Sent · just now</span><b>SMS — Appointment details</b><span class="mx-muted">to 07700 900123</span></div>
            <div class="mx-listrow"><span class="mx-pill mx-pill-green">Delivered</span><b>SMS — Appointment reminder</b><span class="mx-muted">04-Jun-2026</span></div>
          </div>`),
      },
    ],
    outro: "Preferences checked, template used, delivery tracked. The bulk-communication lesson shows the same flow at cohort scale — with bigger consequences for mistakes.",
  },
};

window.WALKTHROUGHS = WALKTHROUGHS;
