/**
 * app.js — Main entry point for the Family Planner Portal.
 *
 * Responsibilities:
 *  1. Open the IndexedDB
 *  2. Load runtime config (config.js, fallback to config.example.js)
 *  3. Render the shell HTML into #app
 *  4. Register routes and init the router
 *  5. Wire nav-button click handlers
 *  6. Init the kiosk screensaver
 *
 * Widget custom elements are imported here so they self-register via
 * customElements.define() at module parse time.
 */

import { db }       from './db.js';
import { store }    from './state.js';
import { eventBus } from './state.js';
import { router }   from './router.js';
import { kiosk }    from './kiosk.js';

// ---------------------------------------------------------------------------
// Widget imports — each module calls customElements.define() as a side effect.
// These are imported dynamically so missing files don't break the shell.
// ---------------------------------------------------------------------------

const WIDGET_MODULES = [
  './widgets/clock.js',
  './widgets/weather.js',
  './widgets/calendar.js',
  './widgets/chores.js',
  './widgets/trains.js',
  './widgets/shopping.js',
  './widgets/messages.js',
  './widgets/settings.js',
];

async function loadWidgets() {
  const results = await Promise.allSettled(
    WIDGET_MODULES.map(path => import(path))
  );
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      // Widgets not yet created — warn but continue so the shell renders
      console.debug(`[app] Widget module not available yet: ${WIDGET_MODULES[i]}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

async function loadConfig() {
  try {
    const mod = await import('../config.js');
    return mod.CONFIG;
  } catch {
    console.warn(
      '[app] config.js not found — falling back to config.example.js. ' +
      'Copy config.example.js to config.js and fill in your API keys.'
    );
    try {
      const mod = await import('../config.example.js');
      return mod.CONFIG;
    } catch (err) {
      console.error('[app] Failed to load config.example.js:', err);
      return {};
    }
  }
}

// ---------------------------------------------------------------------------
// SVG icon helpers
// ---------------------------------------------------------------------------

/** 4-square grid icon (Dashboard). */
const ICON_DASHBOARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="3" width="8" height="8" rx="1"/>
  <rect x="13" y="3" width="8" height="8" rx="1"/>
  <rect x="3" y="13" width="8" height="8" rx="1"/>
  <rect x="13" y="13" width="8" height="8" rx="1"/>
</svg>`;

/** Calendar page icon. */
const ICON_CALENDAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3" y="4" width="18" height="18" rx="2"/>
  <line x1="16" y1="2" x2="16" y2="6"/>
  <line x1="8" y1="2" x2="8" y2="6"/>
  <line x1="3" y1="10" x2="21" y2="10"/>
</svg>`;

/** Checkmark in circle icon (Chores). */
const ICON_CHORES = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9"/>
  <polyline points="8 12 11 15 16 9"/>
</svg>`;

/** Shopping basket icon. */
const ICON_SHOPPING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
  <line x1="3" y1="6" x2="21" y2="6"/>
  <path d="M16 10a4 4 0 0 1-8 0"/>
</svg>`;

/** Gear / cog icon (Settings). */
const ICON_SETTINGS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>`;

// ---------------------------------------------------------------------------
// Shell HTML
// ---------------------------------------------------------------------------

/**
 * Builds and injects the application shell into #app.
 * All view containers are created here; widgets populate themselves.
 */
function renderShell(appEl) {
  appEl.innerHTML = /* html */`
    <!-- ===== HEADER ===================================================== -->
    <div class="header">
      <fp-clock mode="compact"></fp-clock>
      <fp-weather mode="compact"></fp-weather>
      <button class="btn-icon settings-btn" data-nav="#settings" aria-label="Settings">
        ${ICON_SETTINGS}
      </button>
    </div>

    <!-- ===== DASHBOARD VIEW ============================================= -->
    <div class="view active" data-view="dashboard">
      <div class="dashboard">
        <fp-calendar class="widget"></fp-calendar>
        <fp-chores   class="widget"></fp-chores>
        <fp-trains   class="widget"></fp-trains>
        <fp-shopping class="widget"></fp-shopping>
        <fp-messages class="widget"></fp-messages>
        <fp-weather  class="widget" mode="forecast"></fp-weather>
      </div>
    </div>

    <!-- ===== EXPANDED VIEWS ============================================= -->
    <div class="view" data-view="calendar">
      <fp-calendar mode="full"></fp-calendar>
    </div>

    <div class="view" data-view="chores">
      <fp-chores mode="full"></fp-chores>
    </div>

    <div class="view" data-view="shopping">
      <fp-shopping mode="full"></fp-shopping>
    </div>

    <div class="view" data-view="settings">
      <fp-settings></fp-settings>
    </div>

    <!-- ===== BOTTOM NAV ================================================= -->
    <nav class="bottom-nav" role="navigation" aria-label="Main navigation">
      <button class="nav-btn active" data-nav="#dashboard" aria-label="Dashboard">
        ${ICON_DASHBOARD}
        <span class="nav-label">Dashboard</span>
      </button>
      <button class="nav-btn" data-nav="#calendar" aria-label="Calendar">
        ${ICON_CALENDAR}
        <span class="nav-label">Calendar</span>
      </button>
      <button class="nav-btn" data-nav="#chores" aria-label="Chores">
        ${ICON_CHORES}
        <span class="nav-label">Chores</span>
      </button>
      <button class="nav-btn" data-nav="#shopping" aria-label="Shopping">
        ${ICON_SHOPPING}
        <span class="nav-label">Shopping</span>
      </button>
      <button class="nav-btn" data-nav="#settings" aria-label="Settings">
        ${ICON_SETTINGS}
        <span class="nav-label">Settings</span>
      </button>
    </nav>
  `;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

function registerRoutes() {
  router.register('#dashboard', 'dashboard', 'Family Planner');
  router.register('#calendar',  'calendar',  'Calendar — Family Planner');
  router.register('#chores',    'chores',    'Chores — Family Planner');
  router.register('#shopping',  'shopping',  'Shopping — Family Planner');
  router.register('#settings',  'settings',  'Settings — Family Planner');
}

// ---------------------------------------------------------------------------
// Nav click handlers
// ---------------------------------------------------------------------------

function bindNav(appEl) {
  // Single delegated listener on #app covers header settings button + bottom nav
  appEl.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-nav]');
    if (!btn) return;
    event.preventDefault();
    router.navigate(btn.dataset.nav);
  });
}

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

async function boot() {
  const appEl = document.getElementById('app');
  if (!appEl) {
    console.error('[app] #app element not found — aborting boot.');
    return;
  }

  // 1. Open IndexedDB (ensures it's ready before any widget tries to use it)
  try {
    await db.open();
  } catch (err) {
    console.error('[app] Failed to open IndexedDB:', err);
  }

  // 2. Load widgets (non-fatal — shell renders even if widgets are missing)
  await loadWidgets();

  // 3. Load and store config
  const config = await loadConfig();
  store.set('config', config);

  // 4. Apply theme from config (default: dark)
  const theme = config?.display?.theme ?? 'dark';
  document.documentElement.dataset.theme = theme;

  // 5. Render shell HTML
  renderShell(appEl);

  // 6. Register routes + init router
  registerRoutes();
  bindNav(appEl);
  router.init();

  // 7. Init kiosk screensaver
  const screensaverTimeout = config?.display?.screensaverTimeout ?? 5;
  kiosk._timeoutMs = screensaverTimeout * 60 * 1000;
  kiosk.init();

  // Emit ready event for any widgets that want to know app boot is complete
  eventBus.emit('app:ready', { config });

  console.info('[app] Family Planner Portal ready.');
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', boot);
