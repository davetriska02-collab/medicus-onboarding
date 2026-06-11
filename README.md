# Medicus Onboarding

Role-based Medicus training for every job in the surgery: curated help-centre
lessons, **clickable simulated-Medicus walkthroughs**, knowledge checks and a
formal **competency sign-off** per person, finishing in a printable competency
record for the training file.

Live content comes from the [Medicus Help Centre](https://medicus-health.zendesk.com/hc/en-gb)
(scraped weekly); the app itself is a zero-dependency static site — no build
step, no backend, no runtime network calls.

## What's inside

| Piece | What it does |
|---|---|
| **12 role pathways** | Receptionist/Care Navigator, Medical Secretary, Practice Manager, GP, GP Registrar, ANP, Practice Nurse, HCA, Paramedic, Clinical Pharmacist, Pharmacy Technician, Dispenser |
| **Modules** | Each pathway is built from a module library (Getting Started, Appointments, Registration, Records, Consultations, Prescribing, Communications, Documents, Vaccinations, Scheduling, Reporting, Admin & Config), filtered to articles tagged for that role |
| **Lessons** | Full article text in an in-app reader, with a link out to the original help-centre article for screenshots; curated *core* lessons count toward completion, the rest sit in a reference library |
| **Walkthroughs** | 7 interactive, click-to-advance simulations of Medicus screens (navigation, booking & arriving, registration, consultations, prescribing, documents, SMS) — fictional patients, training only |
| **Knowledge checks** | Per-module quizzes keyword-matched from the role's question bank, plus a final 10-question assessment (pass mark 80%) |
| **Competency sign-off** | Per-module "I can confidently…" checklist with confirm/witness, supervisor module sign-off, and a print-formatted competency record |
| **Team view** | Person-by-person profiles and progress rings; export/import progress as JSON (storage is browser `localStorage`) |

## Architecture

```
index.html            SPA shell
css/main.css          design system (Medicus-inspired teal/ink theme) + mock-UI + print styles
js/app.js             state, hash router, views, quiz + walkthrough engines
js/curriculum.js      module library, role personas, competency checklists
js/walkthroughs.js    simulated Medicus screens + step definitions
js/icons.js           inline SVG icon set
data/articles.json    scraped help-centre corpus (175 articles, role-tagged)
data/quizzes.json     10-question bank per role
data/data.js          browser bundle of the two JSONs (generated)
scripts/scrape_zendesk.py   weekly scraper (GitHub Action: refresh-content.yml)
scripts/build_data.py       re-tags/re-quizzes changed articles and rebuilds data.js
```

Deployed to GitHub Pages from `main` (`.github/workflows/deploy.yml`).
Content refresh runs Mondays (`.github/workflows/refresh-content.yml`,
needs `ANTHROPIC_API_KEY` secret for re-tagging/quiz generation).

## Running locally

Any static server:

```sh
npx http-server .        # or: python3 -m http.server
```

## Editing the training content

- **Add/curate lessons or competencies**: edit `js/curriculum.js` — modules
  declare their help-centre sections, curated core article IDs and competency
  text; personas declare their module order and role tags.
- **Add a walkthrough**: add an entry to `js/walkthroughs.js`; each step is a
  mock screen with exactly one `data-hot` element, and a coach-mark tip.
- **Theme**: design tokens at the top of `css/main.css`.

Notes: progress lives in each browser's `localStorage` (use Export/Import to
move it between machines). The walkthrough screens are simplified simulations
for training, not pixel-accurate copies of Medicus.
