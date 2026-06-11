// ─────────────────────────────────────────────────────────────────────────────
// Medicus Onboarding — Curriculum
//
// Defines the training pathway for every job role in the practice.
// Lessons are pulled from the scraped Medicus help-centre corpus
// (window.ARTICLES, see data/data.js) by section + role tag.
// Competencies are the sign-off checklist each person must confirm.
// ─────────────────────────────────────────────────────────────────────────────

// Module library. Each module:
//   sections     help-centre sections whose articles belong to this module
//   core         curated article IDs that count toward completion (others are
//                offered as a reference library)
//   walkthrough  id of an interactive walkthrough (see js/walkthroughs.js)
//   quizKeywords used to pull matching questions from the role's quiz bank
//   competencies sign-off items; optional `only`/`not` arrays restrict by persona
const MODULES = {
  "getting-started": {
    title: "Getting Started & Navigation",
    icon: "compass",
    strap: "Log in, find your way around, and master tasks & chat",
    summary:
      "Everything you need on day one: activating your account, logging in with two-factor authentication or your NHS Smartcard, finding patients safely, and working with the Medicus homepage, task lists and chat.",
    sections: ["Login & Account Management", "Medicus Overview, Navigation & Tasks"],
    core: [
      16394207045021, // Activating your Medicus Account
      16395675543453, // Logging in to Medicus
      16427764723357, // Pair/Unpair NHS Smartcard
      20558198529693, // The Medicus Homepage
      16305852109725, // Using the Patient Finder
      21550803681565, // Task Lists
      20558997075613, // Managing an Individual Task
      21038187205149, // Medicus Chat
      20605419150365, // The Panic Button
    ],
    walkthrough: "wt-navigate",
    quizKeywords: ["log in", "login", "smartcard", "task", "chat", "panic", "patient finder", "homepage", "password", "two factor", "2fa"],
    competencies: [
      { id: "gs1", text: "Log in to Medicus and complete two-factor authentication without help" },
      { id: "gs2", text: "Pair my NHS Smartcard and use it to log in" },
      { id: "gs3", text: "Find the right patient using the Patient Finder, verifying identity with at least three identifiers (name, DOB, address or NHS number)" },
      { id: "gs4", text: "Work my task list: open, action, complete and reassign a task" },
      { id: "gs5", text: "Send and reply to messages in Medicus Chat" },
      { id: "gs6", text: "Locate the Panic Button and explain when and how to use it" },
      { id: "gs7", text: "Reset my own password and recover my account if locked out" },
    ],
  },

  "patient-records": {
    title: "Patient Records & Confidentiality",
    icon: "folder",
    strap: "The patient banner, journal, alerts and safe information handling",
    summary:
      "How a patient's record is organised in Medicus — the banner, clinical summary, journal and administrative record — plus the safeguarding alerts, confidentiality controls and consent settings you must understand before touching live records.",
    sections: ["Patient Records", "Care Record"],
    core: [
      20585685078941, // The Patient Banner
      20559869582365, // Viewing a Patient's Clinical Summary
      20559840516253, // Viewing the Patient Journal
      16549946520093, // Viewing a Patient's Administrative Record
      18537085147677, // Recording a Note on the Patient Banner
      32385807299357, // Child Protection Alerts
      18264214044957, // Redacting from Patient Online Access
      17621234359965, // Managing a Patient's Consent Preferences
      16572056873373, // Manage a Patient's Contact Information
      18746224434845, // Viewing a Patient's Summary Care Record
    ],
    quizKeywords: ["banner", "journal", "summary", "record", "alert", "confidential", "redact", "consent", "safeguard", "child protection", "demographic"],
    competencies: [
      { id: "pr1", text: "Interpret everything on the patient banner, including alerts, warnings and banner notes" },
      { id: "pr2", text: "Navigate the clinical summary, journal and administrative record to find information quickly" },
      { id: "pr3", text: "Add an appropriate note to the patient banner (and know what does not belong there)" },
      { id: "pr4", text: "Recognise child protection and safeguarding alerts and follow the practice process when one appears" },
      { id: "pr5", text: "Redact an item from patient online access and mark information confidential from third parties" },
      { id: "pr6", text: "Record a patient's consent and data-sharing preferences correctly" },
      { id: "pr7", text: "Update a patient's contact details, address and language preferences", only: ["receptionist", "secretary", "manager"] },
      { id: "pr8", text: "Manage a patient's associated contacts (next of kin, carers) and pharmacy nomination", only: ["receptionist", "secretary", "manager", "pharmacist", "pharmtech", "dispenser"] },
      { id: "pr9", text: "Identify and merge duplicate patient records following the correct checks", only: ["manager"] },
    ],
  },

  appointments: {
    title: "Appointments",
    icon: "calendar",
    strap: "Book, move, arrive, DNA — run the appointment book with confidence",
    summary:
      "The appointment book is the heartbeat of the practice. Learn to book patients into the right slots, manage arrivals and DNAs, reschedule and cancel cleanly, and use appointment queues for on-the-day demand.",
    sections: ["Appointment Management"],
    core: [
      18084772966941, // Appointment Book overview
      18112034300445, // Booking Patients in for Appointments
      18131577053597, // Updating the Appointment Arrival Status
      18263400753949, // Editing Booked Appointment Details
      18266201366557, // Rescheduling an Appointment
      18265470221341, // Cancelling an Appointment
      18266859195165, // Marking an Appointment as DNA
      18108165939613, // Booking Patients into Appointment Queues
      21622227446429, // Receptionist Cheat Sheet - Booking
      21514002588189, // Squeezing a Patient in
    ],
    walkthrough: "wt-appointment",
    quizKeywords: ["appointment", "book", "arrive", "arrival", "dna", "did not attend", "cancel", "reschedul", "slot", "queue", "diary"],
    competencies: [
      { id: "ap1", text: "Book a patient into the correct slot type with the correct clinician and add booking notes" },
      { id: "ap2", text: "Edit, move and reschedule an existing appointment" },
      { id: "ap3", text: "Cancel an appointment and record who cancelled and why" },
      { id: "ap4", text: "Update arrival status when a patient arrives (including via the appointment details slideover)" },
      { id: "ap5", text: "Mark an appointment as DNA correctly and know the practice DNA policy" },
      { id: "ap6", text: "Book a patient into an appointment queue and explain when queues are used instead of slots" },
      { id: "ap7", text: "Safely squeeze in an urgent patient when the book is full, following practice protocol", only: ["receptionist", "manager"] },
      { id: "ap8", text: "Find a patient's previously cancelled and rescheduled appointments", only: ["receptionist", "secretary", "manager"] },
      { id: "ap9", text: "Set up a video appointment and send the patient their joining link", not: ["dispenser", "pharmtech"] },
    ],
  },

  registration: {
    title: "Patient Registration",
    icon: "id-card",
    strap: "Register, transfer and deregister patients correctly first time",
    summary:
      "Registration mistakes follow a patient around for years. Learn to action online registration requests, manually register permanent, temporary and immediately-necessary patients, keep registration details accurate, and handle deductions and deceased patients with care.",
    sections: ["Patient Registration"],
    core: [
      20886395988893, // Actioning a Permanent Registration Request (NHS website)
      16699587069597, // Manually Register a Permanent Patient
      16741525008285, // Register a Temporary Patient
      16743012387485, // Immediate Necessary Treatment
      16746495260701, // View and Update Registration Details
      20549627726493, // Patient Deregistration
      20522773605277, // Registering Without an NHS Number
      33024183876381, // Mark as deceased - NHS Practices
      16626072626717, // Viewing the Patient List
    ],
    walkthrough: "wt-register",
    quizKeywords: ["register", "registration", "deregist", "deceased", "nhs number", "temporary", "deduction", "pds"],
    competencies: [
      { id: "rg1", text: "Action a permanent registration request submitted via the NHS website" },
      { id: "rg2", text: "Manually register a permanent patient, including the PDS trace" },
      { id: "rg3", text: "Register a temporary patient and an immediately-necessary-treatment patient, choosing the right type" },
      { id: "rg4", text: "Register a patient who has no NHS number" },
      { id: "rg5", text: "View and update a patient's registration details and process a deregistration" },
      { id: "rg6", text: "Mark a patient as deceased following the correct, sensitive process" },
    ],
  },

  consultations: {
    title: "Consultations & Clinical Recording",
    icon: "stethoscope",
    strap: "Code consultations, observations, allergies and procedures",
    summary:
      "Record clinical care accurately and code it with SNOMED CT: creating and completing consultations, using templates, recording observations and procedures, capturing allergies, issuing fit notes, and correcting the record safely when mistakes happen.",
    sections: ["Consultations", "Clinical Cases"],
    core: [
      17368110943005, // Creating and Completing a Consultation
      18513503853469, // Recording an Observation
      28201369300253, // Recording Routine Observations
      18437502769309, // Viewing and Creating an Allergy
      18522898064157, // Recording a Procedure
      18519403315997, // Recording Medication or Device Administration
      18443627942813, // Creating eMED3 Fit Notes
      18424643155869, // Retrospectively Updating a Consultation
      18421463712413, // Marking a Consultation as Incorrect or Hidden
      34752604337693, // Managing Clinical Cases
    ],
    walkthrough: "wt-consult",
    quizKeywords: ["consultation", "snomed", "code", "observation", "allergy", "procedure", "fit note", "emed3", "template", "blood pressure", "examination"],
    competencies: [
      { id: "cn1", text: "Create, code and complete a consultation, choosing the correct consultation type" },
      { id: "cn2", text: "Record individual and routine observations (BP, weight, pulse, etc.) so they file as structured data" },
      { id: "cn3", text: "Record an allergy or adverse reaction and explain how it drives prescribing warnings", not: ["hca"] },
      { id: "cn4", text: "Record a procedure and an administered medication, vaccine or device" },
      { id: "cn5", text: "Issue an eMED3 fit note", only: ["gp", "registrar", "anp", "paramedic"] },
      { id: "cn6", text: "Retrospectively amend a consultation and mark an entry as incorrect or hidden, understanding the audit trail" },
      { id: "cn7", text: "Use consultation templates relevant to my clinics", only: ["nurse", "anp", "hca", "pharmacist"] },
    ],
  },

  prescribing: {
    title: "Prescribing & Medicines",
    icon: "pill",
    strap: "Issue, change and end prescriptions safely — and manage requests",
    summary:
      "From the medication regimen screen to signing and sending via EPS: creating acute prescriptions, re-authorising repeats, editing and ending medication, recording over-the-counter and prescribed-elsewhere medicines, and processing patient prescription requests.",
    sections: ["Prescribing"],
    core: [
      20345812943773, // Viewing a Patient's Medication Regimen
      17215844570013, // Creating a New Prescription
      17469724631581, // Prescribing Again and Re-authorising
      17196048024477, // How to Edit a Prescription
      17210221579549, // Changing the Drug or Dosage
      17247382946333, // Ending a Prescription
      17212371172893, // Marking a Prescription as Incorrect
      17192954812957, // Record Over-the-Counter Medication
      17195237651613, // Record Medication Prescribed Elsewhere
      20146984454429, // Receiving and Actioning Prescription Requests
      27830341467293, // FP34D PPA Claims
    ],
    walkthrough: "wt-prescribe",
    quizKeywords: ["prescri", "medication", "drug", "dosage", "regimen", "eps", "pharmacy", "repeat", "acute", "dispens", "fp34"],
    competencies: [
      { id: "px1", text: "Read and interpret a patient's medication regimen, including acute vs repeat and authorisation status" },
      { id: "px2", text: "Create, sign and send a new acute prescription via EPS", only: ["gp", "registrar", "anp", "paramedic", "pharmacist"] },
      { id: "px3", text: "Re-authorise a repeat and use 'prescribe again' appropriately", only: ["gp", "registrar", "anp", "paramedic", "pharmacist"] },
      { id: "px4", text: "Edit a prescription, change drug or dosage, end a prescription, and mark one issued in error as incorrect", only: ["gp", "registrar", "anp", "paramedic", "pharmacist"] },
      { id: "px5", text: "Record over-the-counter medication and medication prescribed elsewhere", not: ["dispenser", "pharmtech"] },
      { id: "px6", text: "Receive and action patient prescription requests from my task list", only: ["gp", "registrar", "anp", "paramedic", "pharmacist", "pharmtech", "dispenser"] },
      { id: "px7", text: "Manage a patient's pharmacy nomination and check where a prescription was sent", only: ["pharmacist", "pharmtech", "dispenser"] },
      { id: "px8", text: "Process FP34D PPA claims at month end", only: ["pharmtech", "dispenser", "manager"] },
    ],
  },

  communications: {
    title: "Patient Communications & Online Requests",
    icon: "message",
    strap: "SMS, conversations, bulk messaging and the online front door",
    summary:
      "Keep patients informed and manage the digital front door: one-off and bulk SMS/email, two-way conversations, communication preferences and failed-message recovery, plus receiving and actioning admin and clinical requests submitted online.",
    sections: [
      "Patient Communications",
      "Patient Portal and Online requests",
      "Patient Requests",
      "Patient Requests (Online Consultations)",
      "Patient Requests - Online Consultations",
    ],
    core: [
      32122718313373, // Sending a One-Off Communication
      32475117023901, // Managing Patient Conversations
      20588866271645, // Managing Communication Preferences
      28199703955229, // Viewing messages sent to patients
      32753200585245, // Resolving failed communication tasks
      32570066603677, // Sending a bulk communication
      32139767576861, // Patient Booking links
      21653504403869, // Actioning Patient Admin Requests
      31734188621341, // Actioning Patient Clinical Requests
      32083177603229, // Submitting Requests on Behalf of Patients
    ],
    walkthrough: "wt-sms",
    quizKeywords: ["sms", "message", "communication", "conversation", "bulk", "online request", "booking link", "notify", "email"],
    competencies: [
      { id: "cm1", text: "Send a one-off SMS or email from a patient's record using the right template" },
      { id: "cm2", text: "Manage a two-way patient conversation and close it appropriately" },
      { id: "cm3", text: "Check and update communication preferences before contacting a patient" },
      { id: "cm4", text: "Find and resolve failed communication tasks", only: ["receptionist", "secretary", "manager"] },
      { id: "cm5", text: "Send a self-book appointment link to a patient", only: ["receptionist", "secretary", "manager"] },
      { id: "cm6", text: "Send a bulk communication to a patient cohort safely (right cohort, right template, right time)", only: ["receptionist", "secretary", "manager", "nurse", "pharmacist"] },
      { id: "cm7", text: "Receive and action patient admin requests from the online front door", only: ["receptionist", "secretary", "manager"] },
      { id: "cm8", text: "Receive and action patient clinical requests, escalating red flags immediately", only: ["gp", "registrar", "anp", "nurse", "paramedic", "manager"] },
      { id: "cm9", text: "Submit a request on a patient's behalf (e.g. for a patient who phones in)", not: ["dispenser", "pharmtech"] },
    ],
  },

  documents: {
    title: "Documents, Referrals & Results",
    icon: "inbox",
    strap: "Process inbound documents, referral letters and test results",
    summary:
      "The daily document workflow: processing scanned and electronic inbound documents, coding and filing them to the record, actioning documents sent to you, managing referral letter tasks, and requesting and filing investigation results.",
    sections: ["Document Management", "Referrals", "Investigations Requesting & Results"],
    core: [
      21550953722269, // Processing Inbound Documents
      20559816156829, // Actioning Inbound Documents
      29541933433117, // Referral Letter Tasks
      21064234706205, // Requesting Investigations and Tests
      20588903518877, // Receiving, Reviewing & Filing Investigation Results
    ],
    walkthrough: "wt-document",
    quizKeywords: ["document", "inbound", "letter", "referral", "investigation", "result", "filing", "scan", "workflow"],
    competencies: [
      { id: "dc1", text: "Process an inbound document: match to the right patient, code it and file or forward it", only: ["receptionist", "secretary", "manager"] },
      { id: "dc2", text: "Action a document task assigned to me and add follow-up actions" },
      { id: "dc3", text: "Manage referral letter tasks through to completion", not: ["hca", "dispenser", "pharmtech"] },
      { id: "dc4", text: "Request investigations and tests (ICE/tQuest where configured)", only: ["gp", "registrar", "anp", "nurse", "paramedic", "pharmacist"] },
      { id: "dc5", text: "Review, comment on and file investigation results, and task follow-up actions", only: ["gp", "registrar", "anp", "nurse", "paramedic", "pharmacist"] },
    ],
  },

  vaccinations: {
    title: "Vaccinations & Recalls",
    icon: "syringe",
    strap: "Record vaccinations, manage batches and keep recalls on track",
    summary:
      "Safe immunisation recording: capturing vaccinations with batch, site and route, managing vaccine stock and expiry, reading immunisation history against the childhood schedule, and using future actions to recall patients for ongoing care.",
    sections: ["Vaccinations", "Long Term Condition Management"],
    core: [
      20588935226269, // Recording a Vaccination
      29238678681373, // Vaccine Batch Management
      20588951048989, // Viewing Immunisation History
      29541742879389, // Childhood Immunisation Schedules
      18523963544221, // Creating and Managing a Future Action / Recall
      32242854275741, // Future Action Rules
    ],
    quizKeywords: ["vaccin", "immunis", "batch", "recall", "future action", "schedule", "long term"],
    competencies: [
      { id: "vx1", text: "Record a vaccination with the correct batch, expiry, site and route" },
      { id: "vx2", text: "Manage vaccine batches: add stock, retire expired batches" },
      { id: "vx3", text: "Read a patient's immunisation history and identify gaps against the childhood schedule" },
      { id: "vx4", text: "Create, complete and cancel future actions / recalls", not: ["hca"] },
    ],
  },

  scheduling: {
    title: "Staff Scheduling & Rotas",
    icon: "grid",
    strap: "Build diaries, templates and rotas that keep clinics running",
    summary:
      "Design the practice's clinical capacity: creating appointment diaries (individually and in bulk), building and applying schedule templates, managing breaks, meetings and other activities, and configuring services, sites and rooms.",
    sections: ["Staff Scheduling"],
    core: [
      17696614872733, // Viewing the Staff Schedule
      17958681950237, // Creating an Appointment Diary
      17967352765469, // Viewing, Editing and Cancelling a Diary
      17943287237661, // Creating a Staff Schedule Template
      18071601120669, // Applying a Template
      17992067563165, // Staff Breaks
      17985627803165, // Staff Meetings
      17655530154781, // Configuring Appointment Services
      17628860917021, // Managing Sites & Rooms
    ],
    quizKeywords: ["schedule", "rota", "diary", "template", "session", "break", "meeting", "room", "site", "service"],
    competencies: [
      { id: "sc1", text: "View and interpret the staff schedule across sites" },
      { id: "sc2", text: "Create, edit and cancel an appointment diary (including bulk creation)" },
      { id: "sc3", text: "Build a schedule template and apply it to future weeks" },
      { id: "sc4", text: "Schedule breaks, meetings and other staff activities" },
      { id: "sc5", text: "Configure appointment services, sites and rooms" },
    ],
  },

  reporting: {
    title: "Reporting & Data Quality",
    icon: "chart",
    strap: "Build reports, meet GPAD requirements and monitor data quality",
    summary:
      "Turn Medicus data into answers: building ad hoc reports with the Report Builder, understanding GP Appointment Data (GPAD) submissions and fixing exceptions, and keeping an eye on practice-wide unfulfilled investigation requests.",
    sections: ["Reporting"],
    core: [
      21661012525725, // Report Builder
      18362576234653, // GPAD Reporting
      18362647425309, // GPAD Exception Reporting
      21183198713501, // Unfulfilled Investigation Requests
    ],
    quizKeywords: ["report", "gpad", "data", "builder", "exception"],
    competencies: [
      { id: "rp1", text: "Build, run and export an ad hoc report using the Report Builder" },
      { id: "rp2", text: "Explain what GPAD reporting submits and resolve GPAD exceptions" },
      { id: "rp3", text: "Monitor and chase practice-wide unfulfilled investigation requests" },
    ],
  },

  "admin-config": {
    title: "Practice Administration & Configuration",
    icon: "settings",
    strap: "Users, permissions, templates and the system settings that shape Medicus",
    summary:
      "Run Medicus itself: adding staff and managing roles, permissions and teams, maintaining prescriber details, building communication, letter and consultation templates, organisation details and closure periods, Summary Care Record configuration, and front-of-house hardware like kiosks and call-in boards.",
    sections: [
      "System Configuration",
      "User Management",
      "Data Sharing Configuration",
      "Document Scanners",
      "Implementation Guides for IT Teams",
    ],
    core: [
      16320172288285, // Adding a New Staff Member
      16469048743837, // User Roles & Permissions
      16473150488861, // Adding or Removing User Role Permissions
      16478898523677, // Managing Staff Job Roles
      16618050203037, // Managing Prescriber Details
      16321210114461, // Managing Teams
      16475329721373, // Archiving a staff member
      31098124389789, // Communication Templates
      31769942538013, // Letter Templates
      28405883567261, // Creating Consultation Templates
      16305115607581, // Managing your Organisation Details
      16321273553565, // Automatic Task Assignment
      18591781362845, // Summary Care Record Configuration
      34914311366429, // Setting up a Call-In Board
      34917795263389, // Setting up a Check-In Kiosk
    ],
    quizKeywords: ["staff", "user", "permission", "role", "team", "template", "configur", "organisation", "scr", "kiosk", "archiv"],
    competencies: [
      { id: "ad1", text: "Add a new staff member, assign their job role and send their activation link" },
      { id: "ad2", text: "Manage user roles, permissions and teams, applying least-privilege" },
      { id: "ad3", text: "Maintain prescriber details (spurious codes, prescriber numbers) for clinical staff" },
      { id: "ad4", text: "Archive a leaver and manage their outstanding tasks" },
      { id: "ad5", text: "Create and manage communication and letter templates" },
      { id: "ad6", text: "Create and manage consultation templates and questionnaires" },
      { id: "ad7", text: "Maintain organisation details and practice closure periods" },
      { id: "ad8", text: "Manage Summary Care Record configuration and bulk updates" },
      { id: "ad9", text: "Set up and troubleshoot a check-in kiosk, call-in board and practice scanners" },
    ],
  },
};

// Personas — the people who work in a GP surgery.
//   tags     role tags used to filter help-centre articles for this persona
//   quizRole which quiz bank (data/quizzes.json) backs their knowledge checks
//   modules  ordered learning pathway
const PERSONAS = [
  {
    id: "receptionist",
    title: "Receptionist / Care Navigator",
    icon: "phone",
    color: "#0E7490",
    blurb: "Front of house: appointments, arrivals, registrations, messages and the online front door.",
    tags: ["Receptionist"],
    quizRole: "Receptionist",
    modules: ["getting-started", "appointments", "registration", "patient-records", "communications", "documents"],
  },
  {
    id: "secretary",
    title: "Medical Secretary",
    icon: "file-text",
    color: "#7C3AED",
    blurb: "Referrals, letters, document workflow and patient correspondence.",
    tags: ["Administrator", "Receptionist"],
    quizRole: "Administrator",
    modules: ["getting-started", "patient-records", "documents", "communications", "appointments"],
  },
  {
    id: "manager",
    title: "Practice Manager",
    icon: "briefcase",
    color: "#B45309",
    blurb: "Runs the practice and the system: users, rotas, reporting, configuration — and everything else.",
    tags: ["Administrator"],
    quizRole: "Administrator",
    modules: [
      "getting-started", "patient-records", "appointments", "registration",
      "communications", "documents", "scheduling", "reporting", "admin-config",
    ],
  },
  {
    id: "gp",
    title: "GP (Partner / Salaried)",
    icon: "stethoscope",
    color: "#0F766E",
    blurb: "Consultations, prescribing, results, documents and clinical decision-making.",
    tags: ["ANP", "Other Clinical"],
    quizRole: "Other Clinical",
    modules: ["getting-started", "patient-records", "consultations", "prescribing", "documents", "communications", "appointments", "vaccinations"],
  },
  {
    id: "registrar",
    title: "GP Registrar / Trainee",
    icon: "graduation",
    color: "#0D9488",
    blurb: "The full GP clinical workflow, learned under supervision.",
    tags: ["ANP", "Other Clinical"],
    quizRole: "Other Clinical",
    modules: ["getting-started", "patient-records", "consultations", "prescribing", "documents", "communications", "appointments", "vaccinations"],
  },
  {
    id: "anp",
    title: "Advanced Nurse Practitioner",
    icon: "shield-plus",
    color: "#1D4ED8",
    blurb: "Autonomous clinics: consultations, independent prescribing, requests and results.",
    tags: ["ANP"],
    quizRole: "ANP",
    modules: ["getting-started", "patient-records", "consultations", "prescribing", "documents", "communications", "appointments", "vaccinations"],
  },
  {
    id: "nurse",
    title: "Practice Nurse",
    icon: "heart-pulse",
    color: "#BE185D",
    blurb: "Treatment-room clinics, long-term conditions, vaccinations and recalls.",
    tags: ["Nurse"],
    quizRole: "Nurse",
    modules: ["getting-started", "patient-records", "consultations", "vaccinations", "appointments", "communications", "documents", "prescribing"],
  },
  {
    id: "hca",
    title: "Healthcare Assistant / Phlebotomist",
    icon: "activity",
    color: "#0891B2",
    blurb: "Health checks, observations, bloods and vaccination support clinics.",
    tags: ["HCA"],
    quizRole: "HCA",
    modules: ["getting-started", "patient-records", "consultations", "vaccinations", "appointments", "communications"],
  },
  {
    id: "paramedic",
    title: "Practice Paramedic",
    icon: "zap",
    color: "#C2410C",
    blurb: "Urgent and same-day care, home visits, consultations and prescribing.",
    tags: ["Paramedic"],
    quizRole: "Paramedic",
    modules: ["getting-started", "patient-records", "consultations", "prescribing", "documents", "communications", "appointments", "vaccinations"],
  },
  {
    id: "pharmacist",
    title: "Clinical Pharmacist",
    icon: "pill",
    color: "#15803D",
    blurb: "Medication reviews, prescription requests, prescribing and medicines safety.",
    tags: ["Pharmacist"],
    quizRole: "Pharmacist",
    modules: ["getting-started", "patient-records", "prescribing", "consultations", "documents", "communications"],
  },
  {
    id: "pharmtech",
    title: "Pharmacy Technician",
    icon: "flask",
    color: "#4D7C0F",
    blurb: "Prescription processing, medicines reconciliation and pharmacy admin.",
    tags: ["Pharmacy Technician"],
    quizRole: "Pharmacy Technician",
    modules: ["getting-started", "patient-records", "prescribing"],
  },
  {
    id: "dispenser",
    title: "Dispenser",
    icon: "package",
    color: "#A16207",
    blurb: "Dispensary workflow: prescription requests, dispensing and FP34D claims.",
    tags: ["Dispenser"],
    quizRole: "Dispenser",
    modules: ["getting-started", "patient-records", "prescribing"],
  },
];

// ── Pathway assembly ────────────────────────────────────────────────────────
// Builds the concrete pathway for a persona by joining the module library
// with the article corpus. Memoised per persona.

const _pathwayCache = {};

function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || null;
}

function buildPathway(personaId) {
  if (_pathwayCache[personaId]) return _pathwayCache[personaId];
  const persona = getPersona(personaId);
  if (!persona) return null;

  const seenTitles = new Set(); // dedupe articles duplicated across help-centre sections
  const modules = persona.modules.map((mid) => {
    const def = MODULES[mid];
    const inSections = window.ARTICLES.filter((a) => def.sections.includes(a.section));
    const forRole = inSections.filter((a) => a.roles.some((r) => persona.tags.includes(r)));

    const core = [];
    const reference = [];
    for (const a of forRole.sort((x, y) => def.core.indexOf(x.id) - def.core.indexOf(y.id))) {
      const key = a.title.toLowerCase().trim();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      (def.core.includes(a.id) ? core : reference).push(a);
    }
    // keep curated order for core lessons
    core.sort((x, y) => def.core.indexOf(x.id) - def.core.indexOf(y.id));

    const competencies = def.competencies.filter((c) => {
      if (c.only && !c.only.includes(personaId)) return false;
      if (c.not && c.not.includes(personaId)) return false;
      return true;
    });

    return { id: mid, def, core, reference, competencies };
  }).filter((m) => m.core.length + m.reference.length + m.competencies.length > 0);

  const pathway = { persona, modules };
  _pathwayCache[personaId] = pathway;
  return pathway;
}

// Pull quiz questions for a module by keyword match against the persona's bank.
function moduleQuiz(personaId, moduleId, max = 5) {
  const persona = getPersona(personaId);
  const bank = (window.QUIZZES || {})[persona.quizRole] || [];
  const kws = (MODULES[moduleId].quizKeywords || []).map((k) => k.toLowerCase());
  const matched = bank.filter((q) => {
    const hay = (q.question + " " + q.options.join(" ") + " " + (q.explanation || "")).toLowerCase();
    return kws.some((k) => hay.includes(k));
  });
  return matched.slice(0, max);
}

function finalAssessment(personaId) {
  const persona = getPersona(personaId);
  return ((window.QUIZZES || {})[persona.quizRole] || []).slice();
}

window.MODULES = MODULES;
window.PERSONAS = PERSONAS;
window.getPersona = getPersona;
window.buildPathway = buildPathway;
window.moduleQuiz = moduleQuiz;
window.finalAssessment = finalAssessment;
