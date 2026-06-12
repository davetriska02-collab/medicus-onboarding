# Medicus Onboarding

A practice-run training service for [Medicus](https://medicus.health): role-based
pathways for every job in the surgery, **clickable simulated-Medicus
walkthroughs**, knowledge checks and formal **competency sign-off** — with
**individual PIN logins** for staff and a **training-lead dashboard** showing
the whole team's progress.

Runs entirely from a folder — no server, no install, no IT ticket. Lessons link
to the [Medicus Help Centre](https://medicus-health.zendesk.com/hc/en-gb)
(content is deliberately not replicated in-app).

## Installing for your practice

1. **Download the latest practice pack** from the
   [Releases page](https://github.com/davetriska02-collab/medicus-onboarding/releases/latest)
   and extract it onto your practice **shared drive**, e.g. `S:\Medicus Onboarding\`.
2. Open `index.html` in **Edge or Chrome** on any practice machine.
3. The setup wizard asks for your practice name and a **training-lead
   passcode**, then offers to create the shared data file — save
   `medicus-onboarding-data.json` **in the same folder**.
4. Add your team from the dashboard. Each person appears on the login screen
   and sets their own PIN on first login.
5. On every other machine: open the same `index.html`, choose **Connect to an
   existing data file**, and pick the data file once. The browser remembers it
   (a single "Reconnect" click per session is a browser security rule).

Everyone then sees the same team; each person can only open their own pathway;
the training lead sees everything: per-module progress matrix, PIN resets,
people management, CSV/JSON exports and settings.

### Honest limits

- PINs and the passcode deter casual snooping — they are **not** strong
  security. Anyone with access to the shared folder can read the data file.
  Only training progress is stored; never patient data.
- Concurrent use is safe for normal practice sizes: saves merge
  person-by-person, newest change wins; deletions use tombstones.
- Shared-file mode needs Edge or Chrome (File System Access API). Firefox
  falls back to single-device mode.
- Take an occasional JSON backup from the dashboard; it merges back in.

## What's inside

| Piece | What it does |
|---|---|
| **12 role pathways** | Receptionist/Care Navigator, Medical Secretary, Practice Manager, GP, GP Registrar, ANP, Practice Nurse, HCA, Paramedic, Clinical Pharmacist, Pharmacy Technician, Dispenser |
| **Modules** | Each pathway is built from a module library (Getting Started, Appointments, Registration, Records, Consultations, Prescribing, Communications, Documents, Vaccinations, Scheduling, Reporting, Admin & Config), filtered to articles tagged for that role |
| **Lessons** | Link directly to the original help-centre articles; clicking a lesson opens it in a new tab and marks it read. Curated *core* lessons count toward completion, the rest sit in a reference library |
| **Walkthroughs** | 7 interactive, click-to-advance simulations of Medicus screens (navigation, booking & arriving, registration, consultations, prescribing, documents, SMS) — fictional patients, training only |
| **Knowledge checks** | Per-module quizzes keyword-matched from the role's question bank, plus a final 10-question assessment (pass mark 80%) |
| **Competency sign-off** | Per-module "I can confidently…" checklist with confirm/witness, supervisor module sign-off, and a print-formatted competency record per person |
| **Accounts** | Per-person PIN login (sessions are per-tab — right for shared machines); training-lead super-user with team matrix, PIN resets, exports |

## Architecture

```
index.html            SPA shell — open it straight from the folder (file://)
css/main.css          design system (Medicus-inspired teal/ink theme) + mock-UI + print styles
js/app.js             router, views, auth flows, quiz + walkthrough engines
js/store.js           data layer: localStorage or shared JSON file (File System
                      Access API), person-level merge, PIN/passcode hashing, sessions
js/curriculum.js      module library, role personas, competency checklists
js/walkthroughs.js    simulated Medicus screens + step definitions
js/icons.js           inline SVG icon set
data/articles.json    scraped help-centre index (175 articles, role-tagged)
data/quizzes.json     10-question bank per role
data/data.js          browser bundle of the two JSONs (generated)
scripts/scrape_zendesk.py   weekly scraper (GitHub Action: refresh-content.yml)
scripts/build_data.py       re-tags/re-quizzes changed articles and rebuilds data.js
```

Also deployed to GitHub Pages from `main` (`.github/workflows/deploy.yml`) —
the hosted copy works the same way (you can even point it at a shared file),
but the shared-drive install is the intended practice setup. Content refresh
runs Mondays (`.github/workflows/refresh-content.yml`, needs
`ANTHROPIC_API_KEY` secret).

## Running locally (development)

Any static server, or just open `index.html`:

```sh
npx http-server .        # or: python3 -m http.server
```

## Editing the training content

- **Lessons/competencies**: `js/curriculum.js` — modules declare help-centre
  sections, curated core article IDs and competency text; personas declare
  module order and role tags.
- **Walkthroughs**: `js/walkthroughs.js`; each step is a mock screen with one
  `data-hot` element and a coach-mark tip.
- **Theme**: design tokens at the top of `css/main.css`.
