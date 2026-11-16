// LifeOS — shared core for every page.
//
// This file is loaded WITHOUT `defer` in <head>, so the theme is set on <html>
// before the page is drawn (no light/dark flash). Anything that needs the DOM,
// jQuery or Bootstrap waits for DOMContentLoaded — see "7. App start".
//
// Page scripts should start with:  onAppReady(() => { ... });
'use strict';

/* =========================================================
   1. Storage — the only code that touches localStorage
   ========================================================= */

// The version of LifeOS (semantic: fixes 1.3.4, new features 1.4.0; only forward). The logo badge shows it;
// "What's new" (js/whats-new.js) compares it with lifeos_meta.lastSeenVersion. Every release on GitHub:
// raise it and add the version to data/changelog.json (+ changelog-fallback.js) in en / ru / kk.
const APP_VERSION = '1.5.5';
// The last published version WITHOUT the "What's new" window: a user without lastSeenVersion had it.
const LEGACY_VERSION = '1.3.0';

// "Leave feedback" (js/feedback.js): the Google Form and the ids of its two pre-filled fields
// (found in FB_PUBLIC_LOAD_DATA_ of the form page). Nothing else is sent: no localStorage data.
const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc4vmGWG_aNA7N7-N3XXQzDsN2oSWfGR2feJI9-J1rnkjMyng/viewform';
const FEEDBACK_FIELD_VERSION = 'entry.1219306091'; // "VERSION" <- APP_VERSION
const FEEDBACK_FIELD_DEVICE = 'entry.1989146373'; // "DEVICE" <- "телефон, ru" / "компьютер, en"

const STORAGE_KEYS = {
  profile: 'lifeos_profile',
  goals: 'lifeos_goals',
  tasks: 'lifeos_tasks',
  planner: 'lifeos_planner',
  progress: 'lifeos_progress',
  quotes: 'lifeos_quotes',
  settings: 'lifeos_settings',
  archive: 'lifeos_archive', // finished personal years (step 15)
  sport: 'lifeos_sport', // week plan, workouts, body measurements (sport.html)
  meta: 'lifeos_meta' // { lastSeenVersion }: the newest version whose "What's new" the user has seen
};

const AppStorage = {
  // Returns the saved value, or `fallback` when the key is missing,
  // storage is blocked, or the saved JSON is broken.
  get(key, fallback = null) {
    warnIfUnknownKey(key);
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      // Broken data is NOT deleted, so it can still be inspected or exported.
      console.warn(`[LifeOS] Could not read "${key}", using fallback.`, error);
      return fallback;
    }
  },

  // Saves `value` as JSON. Returns true on success, false on failure.
  set(key, value) {
    warnIfUnknownKey(key);
    if (value === undefined) return this.remove(key);
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[LifeOS] Could not save "${key}".`, error);
      showToast(isQuotaError(error) ? 'toast.storageFull' : 'toast.storageUnavailable', 'danger');
      return false;
    }
  },

  remove(key) {
    warnIfUnknownKey(key);
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[LifeOS] Could not remove "${key}".`, error);
      return false;
    }
  }
};

function warnIfUnknownKey(key) {
  if (!Object.values(STORAGE_KEYS).includes(key)) {
    console.warn(`[LifeOS] "${key}" is not a LifeOS storage key.`);
  }
}

// Browsers report "storage is full" with different names and codes.
function isQuotaError(error) {
  return error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22);
}

// createId('goal') -> "goal-m3k9x2a7f4q1": time part + random part.
function createId(prefix = 'id') {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${prefix}-${time}${random}`;
}

// The profile is an object or null. Anything else (e.g. broken data) counts as "no profile".
function getProfile() {
  const profile = AppStorage.get(STORAGE_KEYS.profile, null);
  return profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : null;
}

// Merges `changes` into the saved profile. Does nothing if there is no profile yet:
// the first-run form creates it.
function updateProfile(changes) {
  const profile = getProfile();
  if (!profile) return false;
  return AppStorage.set(STORAGE_KEYS.profile, { ...profile, ...changes });
}

// Settings are always an object (empty if missing or broken).
function getSettings() {
  const settings = AppStorage.get(STORAGE_KEYS.settings, {});
  return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
}

function updateSettings(changes) {
  return AppStorage.set(STORAGE_KEYS.settings, { ...getSettings(), ...changes });
}

// Language and theme belong to the profile (concept, section 10).
// Before the profile exists they are kept in settings, so the choice survives a reload.
function getPreference(field) {
  return getProfile()?.[field] ?? getSettings()[field];
}

function savePreference(field, value) {
  if (getProfile()) return updateProfile({ [field]: value });
  return updateSettings({ [field]: value });
}

/* =========================================================
   2. I18n — interface languages
   ========================================================= */

const LANGUAGES = ['en', 'ru', 'kk'];
const DEFAULT_LANGUAGE = 'en';
const LOCALES = { en: 'en-US', ru: 'ru-RU', kk: 'kk-KZ' };

/* ----- Loading data/*.json: through a server AND as file:// -----
   http:// or https://  -> the real JSON file data/translations.json (fetchDataJson);
                           if that fails -> the copy from data/translations-fallback.js.
   file:// (double click on an HTML file) -> browsers block fetch() of local files,
                           so the copy window.LIFEOS_TRANSLATIONS is used and fetch is not even tried
                           (no CORS errors in the Console). The same for quotes. */

function isOpenedAsFile() {
  return window.location.protocol === 'file:';
}

// Warns (does not break anything) when data/*-fallback.js was not updated after the JSON changed.
function warnIfFallbackDiffers(fromJson, fallback, fileName) {
  if (fallback && JSON.stringify(fromJson) !== JSON.stringify(fallback)) {
    console.warn(`[LifeOS] data/${fileName} differs from the JSON file. Copy the JSON into it again.`);
  }
}

// Reads data/<fileName> through the server. Protection from an old copy in the browser cache:
//   - ?v=APP_VERSION: a new version of the site asks for a new address, the old cached file is not used;
//   - cache: 'no-cache': the browser asks the server whether the file changed before it uses its copy;
//     cache: 'reload' (see loadChangelog): the browser ignores its copy completely.
async function fetchDataJson(fileName, cache = 'no-cache') {
  const response = await fetch(`./data/${fileName}?v=${APP_VERSION}`, { cache });
  if (!response.ok) throw new Error(`data/${fileName} loading failed: ${response.status}`);
  return response.json();
}

async function loadTranslations() {
  if (isOpenedAsFile()) return window.LIFEOS_TRANSLATIONS ?? null;
  try {
    const translations = await fetchDataJson('translations.json');
    warnIfFallbackDiffers(translations, window.LIFEOS_TRANSLATIONS, 'translations-fallback.js');
    return translations;
  } catch (error) {
    console.warn('[LifeOS] JSON translations are unavailable. Fallback is used.', error);
    return window.LIFEOS_TRANSLATIONS ?? null;
  }
}

// The list of versions for "What's new": data/changelog.json, the same two ways as the translations.
// The list must already know the current version (its first entry = APP_VERSION). If it is older
// (an old copy from the cache or an error): the copy changelog-fallback.js; if that is old too —
// changelog.json once more, past the browser cache (cache: 'reload').
async function loadChangelog() {
  const fallback = window.LIFEOS_CHANGELOG ?? [];
  if (isOpenedAsFile()) return fallback;
  const changelog = await fetchChangelog('no-cache');
  if (isCurrentChangelog(changelog)) {
    warnIfFallbackDiffers(changelog, window.LIFEOS_CHANGELOG, 'changelog-fallback.js');
    return changelog;
  }
  if (isCurrentChangelog(fallback)) return fallback;
  const reloaded = await fetchChangelog('reload');
  if (isCurrentChangelog(reloaded)) return reloaded;
  return reloaded ?? changelog ?? fallback; // nothing knows APP_VERSION: show what there is
}

// changelog.json or null (the error is written to the Console).
async function fetchChangelog(cache) {
  try {
    const changelog = await fetchDataJson('changelog.json', cache);
    return Array.isArray(changelog) ? changelog : null;
  } catch (error) {
    console.warn('[LifeOS] JSON changelog is unavailable.', error);
    return null;
  }
}

// true: the newest entry of the list is not older than the app itself.
function isCurrentChangelog(changelog) {
  return Array.isArray(changelog) && compareVersions(changelog[0]?.version, APP_VERSION) >= 0;
}

// lifeos_meta: facts about the app itself, not the user's plans ({ lastSeenVersion }).
function getMeta() {
  const meta = AppStorage.get(STORAGE_KEYS.meta, {});
  return isPlainObject(meta) ? meta : {};
}

function updateMeta(changes) {
  return AppStorage.set(STORAGE_KEYS.meta, { ...getMeta(), ...changes });
}

// "1.10.0" > "1.9.2": compares the numbers, not the text. Returns -1, 0 or 1.
function compareVersions(a, b) {
  const parts = (version) => String(version ?? '0').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

// Quotes for the Dashboard: the same two ways as the translations.
async function loadQuotesData() {
  if (isOpenedAsFile()) return window.LIFEOS_QUOTES ?? [];
  try {
    const quotes = await fetchDataJson('quotes.json');
    warnIfFallbackDiffers(quotes, window.LIFEOS_QUOTES, 'quotes-fallback.js');
    return quotes;
  } catch (error) {
    console.warn('[LifeOS] JSON quotes are unavailable. Fallback is used.', error);
    return window.LIFEOS_QUOTES ?? [];
  }
}

// The last safety net, only if BOTH translations.json and translations-fallback.js are missing:
// a minimal English dictionary, so the page never shows keys like "page.dashboard".
// (Texts written in the HTML stay as they are, see I18n.apply.)
const FALLBACK_DICTIONARY = {
  'app.name': 'LifeOS',
  'app.version': 'Beta v{version}',
  'page.dashboard': 'Dashboard',
  'page.goals': 'Goals',
  'page.goalDetails': 'Goal Details',
  'page.planner': 'Planner',
  'page.progress': 'Progress',
  'page.settings': 'Settings',
  'layout.skipToContent': 'Skip to content',
  'layout.openMenu': 'Open menu',
  'layout.closeMenu': 'Close menu',
  'layout.mainNav': 'Main navigation',
  'layout.language': 'Interface language',
  'layout.themeToDark': 'Switch to dark theme',
  'layout.themeToLight': 'Switch to light theme',
  'layout.author': 'Vilgelm Feller',
  'layout.storageNote': 'Your data is stored only in this browser.',
  'language.en.short': 'EN',
  'language.ru.short': 'RU',
  'language.kk.short': 'ҚZ',
  'greeting.hello': 'Hello, {name}!',
  'greeting.morning': 'Good morning, {name}!',
  'greeting.afternoon': 'Good afternoon, {name}!',
  'greeting.evening': 'Good evening, {name}!',
  'planner.level.year': 'Personal Year',
  'planner.level.quarter': 'Quarter',
  'planner.level.month': 'Month',
  'planner.level.week': 'Week',
  'planner.level.today': 'Today',
  'planner.quarterTitle': 'Quarter {number}',
  'planner.weekTitle': 'Week {number}',
  'planner.yearTitle': 'Personal year {from}–{to}',
  'firstRun.saved': 'Profile created. Welcome, {name}!',
  'profile.error.nameRequired': 'Enter your name.',
  'profile.error.nameLength': 'The name must be 2 to 30 characters long.',
  'profile.error.dateInvalid': 'Choose a valid date.',
  'date.placeholder': 'dd/mm/yyyy',
  'date.pick': 'Choose a date in the calendar',
  'task.list.empty': 'No tasks.',
  'goals.deadline.none': 'No deadline',
  'quote.fallback.text': 'Small steps create lasting progress.',
  'wizard.close': 'Close',
  'delete.cancel': 'Cancel',
  'toast.close': 'Close',
  'toast.saved': 'Saved',
  'toast.storageFull': 'Browser storage is full. Export your data and free up space.',
  'toast.storageUnavailable': 'Browser storage is unavailable. Changes will not be saved.'
};

// "goals.noResults.title" -> "No results title": readable words instead of a raw key.
function keyToWords(key) {
  const parts = key.split('.').filter((part) => !['one', 'few', 'many', 'other'].includes(part));
  const words = parts.slice(-2).join(' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const I18n = {
  lang: DEFAULT_LANGUAGE,
  dictionaries: {},
  isFallback: false, // true only when no translations could be loaded at all
  reportedMissing: new Set(),

  async load() {
    const translations = await loadTranslations();
    const isValid = translations && typeof translations === 'object' && translations[DEFAULT_LANGUAGE];
    if (isValid) {
      this.dictionaries = translations;
      this.isFallback = false;
    } else {
      console.error('[LifeOS] No translations found (data/translations.json and data/translations-fallback.js). Built-in English texts are used.');
      this.dictionaries = { [DEFAULT_LANGUAGE]: { ...FALLBACK_DICTIONARY } };
      this.isFallback = true;
    }
  },

  // The text exists in the chosen language, in English or in Russian.
  hasKey(key) {
    return [this.lang, DEFAULT_LANGUAGE, 'ru'].some((lang) => this.dictionaries[lang]?.[key] !== undefined);
  },

  // The chosen language -> English -> Russian -> readable words (never the raw key).
  translateIn(lang, key) {
    const text = this.dictionaries[lang]?.[key] ?? this.dictionaries[DEFAULT_LANGUAGE]?.[key]
      ?? this.dictionaries.ru?.[key] ?? keyToWords(key);
    return String(text);
  },

  translate(key, params = {}) {
    if (this.dictionaries[this.lang]?.[key] === undefined) this.reportMissing(key);
    const text = this.translateIn(this.lang, key);
    // "Hello, {name}!" + { name: 'Aida' } -> "Hello, Aida!"
    return text.replace(/\{(\w+)\}/g, (match, name) =>
      params && params[name] !== undefined ? String(params[name]) : match);
  },

  // Warn once per key and language; stay quiet in fallback mode (one error was already shown).
  reportMissing(key) {
    const id = `${this.lang}:${key}`;
    if (this.isFallback || this.reportedMissing.has(id)) return;
    this.reportedMissing.add(id);
    console.warn(`[LifeOS] Missing translation "${key}" for "${this.lang}".`);
  },

  // Fills every element marked with data-i18n* attributes inside `root`.
  // textContent / setAttribute never parse HTML, so translations are safe.
  // A key that is in no dictionary keeps the English text already written in the HTML.
  apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      if (this.hasKey(el.dataset.i18n)) el.textContent = this.translate(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      if (this.hasKey(el.dataset.i18nPlaceholder)) el.setAttribute('placeholder', this.translate(el.dataset.i18nPlaceholder));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      if (this.hasKey(el.dataset.i18nAriaLabel)) el.setAttribute('aria-label', this.translate(el.dataset.i18nAriaLabel));
    });
    // Tooltips of icon-only buttons
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      if (this.hasKey(el.dataset.i18nTitle)) el.setAttribute('title', this.translate(el.dataset.i18nTitle));
    });
  },

  // Switches language without reloading; user data is not touched.
  setLanguage(lang) {
    if (!LANGUAGES.includes(lang)) {
      console.warn(`[LifeOS] Unknown language "${lang}".`);
      return;
    }
    this.lang = lang;
    document.documentElement.lang = lang;
    this.apply();
    savePreference('language', lang);
    document.dispatchEvent(new CustomEvent('lifeos:languagechange', { detail: { lang } }));
  },

  // Locale for Intl. Without Kazakh data, numbers use ru-RU separators ("10 000 000").
  locale(lang = this.lang) {
    if (lang === 'kk' && !KK_INTL_SUPPORTED) return LOCALES.ru;
    return LOCALES[lang] ?? LOCALES[DEFAULT_LANGUAGE];
  }
};

// Chrome and Edge have no Kazakh data in Intl and print dates like "2026 M11 10".
// Checked once: a real Kazakh month name ("қараша") contains Cyrillic letters.
const KK_INTL_SUPPORTED = /[а-я]/i.test(
  new Intl.DateTimeFormat('kk-KZ', { month: 'long' }).format(new Date(2026, 10, 10))
);

// Short name used everywhere in page scripts: t('page.goals')
function t(key, params) {
  return I18n.translate(key, params);
}

// Plural forms: tPlural('goals.count', 5) uses "goals.count.many" in Russian ("5 целей").
// Intl.PluralRules returns the form name: "one", "few", "many" or "other".
// Every language has all four keys, so a missing form falls back to ".other".
function tPlural(baseKey, count, params = {}) {
  const form = new Intl.PluralRules(I18n.locale()).select(count);
  const hasForm = I18n.dictionaries[I18n.lang]?.[`${baseKey}.${form}`] !== undefined;
  return t(`${baseKey}.${hasForm ? form : 'other'}`, { count: Format.number(count), ...params });
}

// Saved choice first; on the very first visit, the browser language ("ru-RU" -> "ru").
function savedLanguage() {
  const lang = getPreference('language');
  return LANGUAGES.includes(lang) ? lang : detectBrowserLanguage();
}

function detectBrowserLanguage() {
  const code = String(navigator.language || '').toLowerCase().split('-')[0];
  return LANGUAGES.includes(code) ? code : DEFAULT_LANGUAGE;
}

/* =========================================================
   3. Theme — light/dark and accent color
   ========================================================= */

const THEMES = ['light', 'dark'];
// The order of the circles in Settings. The colors live in style.css ("Accent colors").
// The first five are the old ones: an old backup keeps its accent; an unknown one becomes teal.
const ACCENTS = ['teal', 'green', 'olive', 'ocean', 'blue', 'indigo', 'plum', 'pink', 'amber', 'clay', 'graphite'];
const DEFAULT_ACCENT = 'teal';
const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

const Theme = {
  // Theme chosen by the user, or null if the user has not chosen yet.
  saved() {
    const theme = getPreference('theme');
    return THEMES.includes(theme) ? theme : null;
  },

  system() {
    return darkSchemeQuery.matches ? 'dark' : 'light';
  },

  current() {
    return document.documentElement.getAttribute('data-bs-theme');
  },

  apply(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.dispatchEvent(new CustomEvent('lifeos:themechange', { detail: { theme } }));
  },

  set(theme) {
    if (!THEMES.includes(theme)) return;
    // Save first: "themechange" listeners (the Settings radios) read the saved theme.
    savePreference('theme', theme);
    this.apply(theme);
  },

  applyAccent(accent) {
    const safeAccent = ACCENTS.includes(accent) ? accent : DEFAULT_ACCENT;
    document.documentElement.setAttribute('data-accent', safeAccent);
  },

  setAccent(accent) {
    if (!ACCENTS.includes(accent)) return;
    this.applyAccent(accent);
    updateSettings({ accent });
  },

  // "As in the system": forget the chosen theme and follow the operating system again.
  useSystem() {
    savePreference('theme', null);
    this.apply(this.system());
  },

  // Compact mode: <html data-compact="true"> makes the spaces smaller (style.css).
  applyCompact(isCompact) {
    if (isCompact) document.documentElement.setAttribute('data-compact', 'true');
    else document.documentElement.removeAttribute('data-compact');
  },

  setCompact(isCompact) {
    this.applyCompact(isCompact);
    updateSettings({ compactMode: Boolean(isCompact) });
  },

  init() {
    this.apply(this.saved() ?? this.system());
    this.applyAccent(getSettings().accent);
    this.applyCompact(getSettings().compactMode === true);
    // Until the user picks a theme, follow the operating system live.
    darkSchemeQuery.addEventListener('change', () => {
      if (!this.saved()) this.apply(this.system());
    });
  }
};

/* =========================================================
   4. Dates — local calendar dates, never UTC
   Dates are stored as "YYYY-MM-DD" strings and turned into
   Date objects at LOCAL midnight. toISOString() is never used:
   it converts to UTC and can move the date one day back.
   ========================================================= */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const Dates = {
  // "2026-03-01" or a Date -> Date at local midnight, or null if invalid.
  parse(value) {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : this.startOfDay(value);
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(year, month - 1, day);
    // JS silently turns 2026-02-30 into March 2; reject such dates.
    const isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return isReal ? date : null;
  },

  // Date -> "YYYY-MM-DD" using local year/month/day.
  toISO(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  },

  startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  },

  today() {
    return this.startOfDay(new Date());
  },

  addDays(date, count) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
  },

  // Jan 31 + 1 month = Feb 28 (or 29): the day is clamped to the month length.
  addMonths(date, count) {
    const first = new Date(date.getFullYear(), date.getMonth() + count, 1);
    const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
  },

  // Whole calendar days from `from` to `to`. Date.UTC ignores daylight saving changes.
  daysBetween(from, to) {
    const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toUtc - fromUtc) / MS_PER_DAY);
  },

  // Personal month 1–12 that contains `date`.
  monthNumber(start, date) {
    let month = 1;
    while (month < 12 && this.addMonths(start, month) <= date) month++;
    return month;
  },

  // Everything about the personal year that begins on `startValue`.
  // `todayValue` is optional (used by the self-test).
  personalYear(startValue, todayValue = new Date()) {
    const start = this.parse(startValue);
    const today = this.parse(todayValue);
    if (!start || !today) return null;

    const nextStart = this.addMonths(start, 12);
    const end = this.addDays(nextStart, -1); // last day of the year
    const totalDays = this.daysBetween(start, nextStart); // 365 or 366
    const daysPassed = Math.min(Math.max(this.daysBetween(start, today), 0), totalDays);

    let status = 'active';
    if (today < start) status = 'upcoming';
    if (today > end) status = 'finished';

    // Before/after the year, show its first/last day instead of today.
    const point = status === 'upcoming' ? start : status === 'finished' ? end : today;
    const month = this.monthNumber(start, point);

    return {
      start,
      end,
      nextStart,
      totalDays,
      daysPassed,
      status,
      month,
      quarter: Math.ceil(month / 3),
      week: Math.floor(this.daysBetween(start, point) / 7) + 1, // 1–53
      percent: Math.round((daysPassed / totalDays) * 1000) / 10 // one decimal
    };
  },

  // Days left until a deadline: 0 = today, negative = overdue, null = invalid date.
  daysUntil(deadlineValue, todayValue = new Date()) {
    const deadline = this.parse(deadlineValue);
    const today = this.parse(todayValue);
    return deadline && today ? this.daysBetween(today, deadline) : null;
  },

  // Weeks start on Monday (getDay(): 0 = Sunday, 1 = Monday … 6 = Saturday).
  startOfWeek(dateValue) {
    const date = this.parse(dateValue);
    return this.addDays(date, -((date.getDay() + 6) % 7));
  },

  // ISO week number: week 1 is the week with the first Thursday of the year.
  // 2026-11-11 -> { year: 2026, week: 46 }; 2027-01-01 -> { year: 2026, week: 53 }
  isoWeek(dateValue) {
    const monday = this.startOfWeek(dateValue);
    const thursday = this.addDays(monday, 3);
    const year = thursday.getFullYear();
    const firstMonday = this.startOfWeek(new Date(year, 0, 4)); // Jan 4 is always in week 1
    return { year, week: this.daysBetween(firstMonday, monday) / 7 + 1 };
  },

  // "2026-W46"
  weekKey(dateValue) {
    const { year, week } = this.isoWeek(dateValue);
    return `${year}-W${String(week).padStart(2, '0')}`;
  },

  // "2026-11"
  monthKey(dateValue) {
    return this.toISO(this.parse(dateValue)).slice(0, 7);
  }
};

/* =========================================================
   5. Format — dates, numbers and money via Intl
   ========================================================= */

const DEFAULT_CURRENCY = 'KZT';

// Dates in English use en-GB: day first ("01/11/2026", "1 Nov 2026"), not the US month-first order.
// Numbers and money keep en-US ("10,000,000").
const DATE_LOCALES = { en: 'en-GB', ru: 'ru-RU', kk: 'kk-KZ' };

// "01/11/2026" (en), "01.11.2026" (ru, kk) — used on cards and in lists.
const SHORT_DATE = { day: '2-digit', month: '2-digit', year: 'numeric' };

const Format = {
  date(value, options = { dateStyle: 'medium' }, lang = I18n.lang) {
    const date = Dates.parse(value);
    if (!date) return '';
    if (lang === 'kk' && !KK_INTL_SUPPORTED) return this.kazakhDate(date, options);
    return new Intl.DateTimeFormat(DATE_LOCALES[lang] ?? DATE_LOCALES.en, options).format(date);
  },

  shortDate(value, lang = I18n.lang) {
    return this.date(value, SHORT_DATE, lang);
  },

  // The dates of a planner period, short: "9–15 November 2026", "30 November – 6 December 2026",
  // "September – November 2026" (byMonths: a quarter or a personal year). The parts come from Intl
  // (month names, cases); the common month and year are written once and there is no "г." / "ж.".
  // (Intl formatRange does not join the year of "сентябрь – ноябрь" and has no Kazakh in every browser.)
  periodRange(startValue, endValue, byMonths = false, lang = I18n.lang) {
    const start = Dates.parse(startValue);
    const end = Dates.parse(endValue);
    if (!start || !end) return '';
    const year = (date) => String(date.getFullYear());
    const sameYear = start.getFullYear() === end.getFullYear();
    if (byMonths) {
      const month = (date) => this.date(date, { month: 'long' }, lang);
      return sameYear
        ? `${month(start)} – ${month(end)} ${year(end)}`
        : `${month(start)} ${year(start)} – ${month(end)} ${year(end)}`;
    }
    const dayMonth = (date) => this.date(date, { day: 'numeric', month: 'long' }, lang);
    if (sameYear && start.getMonth() === end.getMonth()) return `${start.getDate()}–${dayMonth(end)} ${year(end)}`;
    return sameYear
      ? `${dayMonth(start)} – ${dayMonth(end)} ${year(end)}`
      : `${dayMonth(start)} ${year(start)} – ${dayMonth(end)} ${year(end)}`;
  },

  // "9–15 November 2026" / "9–15 ноября 2026 г.": Intl formatRange joins the common parts.
  // Without formatRange (or without Kazakh in Intl) it is "9 Nov 2026 – 15 Nov 2026".
  dateRange(startValue, endValue, options = { day: 'numeric', month: 'long', year: 'numeric' }, lang = I18n.lang) {
    const start = Dates.parse(startValue);
    const end = Dates.parse(endValue);
    if (!start || !end) return '';
    const formatter = new Intl.DateTimeFormat(DATE_LOCALES[lang] ?? DATE_LOCALES.en, options);
    if ((lang === 'kk' && !KK_INTL_SUPPORTED) || typeof formatter.formatRange !== 'function') {
      return `${this.date(start, options, lang)} – ${this.date(end, options, lang)}`;
    }
    return formatter.formatRange(start, end);
  },

  // "KZT" -> "₸", "USD" -> "$"
  currencySymbol(currency = DEFAULT_CURRENCY, lang = I18n.lang) {
    const parts = new Intl.NumberFormat(I18n.locale(lang), { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? currency;
  },

  // "Mon" / "Monday" for a date. style: "short" or "long".
  weekday(value, style = 'short', lang = I18n.lang) {
    const date = Dates.parse(value);
    if (!date) return '';
    if (lang === 'kk' && !KK_INTL_SUPPORTED) {
      const number = ((date.getDay() + 6) % 7) + 1; // 1 = Monday … 7 = Sunday
      return I18n.translateIn('kk', `weekday.${style}.${number}`);
    }
    return new Intl.DateTimeFormat(DATE_LOCALES[lang] ?? DATE_LOCALES.en, { weekday: style }).format(date);
  },

  // Fallback for browsers without Kazakh Intl data: "10 қараша 2026".
  // Month names come from translations.json (month.1 … month.12).
  kazakhDate(date, options) {
    const hasDateStyle = ['full', 'long', 'medium'].includes(options.dateStyle);
    if (!hasDateStyle && options.month !== 'long') {
      // Numeric dates look the same in Kazakh and Russian: "10.11.2026".
      return new Intl.DateTimeFormat(LOCALES.ru, options).format(date);
    }
    const parts = [];
    if (hasDateStyle || options.day) parts.push(date.getDate());
    parts.push(I18n.translateIn('kk', `month.${date.getMonth() + 1}`));
    if (hasDateStyle || options.year) parts.push(date.getFullYear());
    return parts.join(' ');
  },

  number(value, options = {}, lang = I18n.lang) {
    return new Intl.NumberFormat(I18n.locale(lang), options).format(value);
  },

  money(amount, currency = DEFAULT_CURRENCY, lang = I18n.lang) {
    return this.number(amount, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol', // "₸" instead of "KZT"
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }, lang);
  }
};

/* =========================================================
   6. Toast notifications and HTML escaping
   ========================================================= */

const TOAST_ICONS = {
  success: 'bi-check-circle',
  danger: 'bi-exclamation-octagon',
  warning: 'bi-exclamation-triangle',
  info: 'bi-info-circle'
};
const TOAST_DELAY = 4000;
const MAX_TOASTS = 2; // more would cover the page content

// showToast('toast.saved') or showToast('toast.storageFull', 'danger')
// options.action = { labelKey, onClick }: a button in the toast ("Entry deleted · Undo");
// options.delay: how long it stays (ms). The button works once, then the toast closes.
function showToast(messageKey, type = 'success', params = {}, options = {}) {
  if (!document.body || !window.bootstrap || !window.jQuery) {
    console.warn(`[LifeOS] Toast is not ready yet: "${messageKey}".`);
    return;
  }
  const safeType = Object.keys(TOAST_ICONS).includes(type) ? type : 'info';
  const toastEl = buildToast(t(messageKey, params), safeType);
  const container = getToastContainer();
  container.append(toastEl);
  removeOldToasts(container);

  // Bootstrap handles show/hide and the close button; jQuery does the fade.
  const toast = new bootstrap.Toast(toastEl, { animation: false, autohide: false });
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  if (options.action) addToastAction(toastEl, toast, options.action);
  $(toastEl).hide();
  toast.show();
  $(toastEl).fadeIn(200);
  setTimeout(() => {
    // The toast may already be removed by removeOldToasts().
    if (toastEl.isConnected) $(toastEl).fadeOut(400, () => toastEl.isConnected && toast.hide());
  }, options.delay ?? TOAST_DELAY);
}

// "Undo" before the close button. One click: the action runs and the toast closes.
function addToastAction(toastEl, toast, { labelKey, onClick }) {
  const button = createEl('button', { type: 'button', class: 'btn btn-sm toast-action' }, t(labelKey));
  button.addEventListener('click', () => {
    button.disabled = true;
    toast.hide();
    onClick();
  }, { once: true });
  toastEl.querySelector('.btn-close').before(button);
}

// Keeps only the newest MAX_TOASTS messages on the screen.
function removeOldToasts(container) {
  const toasts = [...container.querySelectorAll('.toast')];
  toasts.slice(0, Math.max(toasts.length - MAX_TOASTS, 0)).forEach((oldToast) => {
    bootstrap.Toast.getInstance(oldToast)?.dispose();
    oldToast.remove();
  });
}

function buildToast(message, type) {
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  // Errors interrupt the screen reader; other messages are read by the polite container.
  if (type === 'danger') toastEl.setAttribute('role', 'alert');

  const body = document.createElement('div');
  body.className = 'toast-body';
  const icon = document.createElement('i');
  icon.className = `bi ${TOAST_ICONS[type]} me-2`;
  icon.setAttribute('aria-hidden', 'true');
  body.append(icon, document.createTextNode(message)); // a text node is never parsed as HTML

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  // Success/danger have a dark background, so they need the white close icon.
  const needsWhiteIcon = type === 'success' || type === 'danger';
  closeButton.className = `btn-close me-2 m-auto${needsWhiteIcon ? ' btn-close-white' : ''}`;
  closeButton.setAttribute('data-bs-dismiss', 'toast');
  closeButton.setAttribute('aria-label', t('toast.close'));

  const row = document.createElement('div');
  row.className = 'd-flex';
  row.append(body, closeButton);
  toastEl.append(row);
  return toastEl;
}

// One fixed container per page. It is also the live region for screen readers,
// so it is created at start-up, before the first toast appears.
function getToastContainer() {
  let container = document.getElementById('lifeos-toasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'lifeos-toasts';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    container.setAttribute('aria-live', 'polite');
    document.body.append(container);
  }
  return container;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Use before putting user text into an HTML string: escapeHtml('<b>') -> "&lt;b&gt;"
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/* =========================================================
   7. Layout — the shared menu, header controls and footer
   The markup is written in every HTML file; this code only
   adds behaviour to it.
   ========================================================= */

// Pages without their own menu item highlight their "parent" item.
const NAV_PARENTS = { 'goal-details.html': 'goals.html' };

/* ---------- Horizontal scroll hints (phone): fade + a small arrow at the side with more content ----------
   The strips that scroll sideways (Sport tabs, Progress periods, wide tables, the year heatmap) are wrapped
   once in <div class="scroll-hint">. Classes say from which side there is more content; CSS (< 768px)
   draws the fade and the arrow. When a strip appears, it is scrolled to its active item. */
const SCROLL_HINT_SELECTOR = '.sport-tabs, .segmented, .table-wrap, .heat-scroll';

const ScrollHints = {
  init() {
    this.refresh();
    // Lists and tables are redrawn by the pages: look for new strips after every change of the page.
    new MutationObserver(() => this.scheduleRefresh()).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => this.scheduleRefresh());
  },

  scheduleRefresh() {
    if (this.timer) return;
    this.timer = requestAnimationFrame(() => {
      this.timer = null;
      this.refresh();
    });
  },

  refresh() {
    document.querySelectorAll(SCROLL_HINT_SELECTOR).forEach((strip) => {
      if (!strip.parentElement.classList.contains('scroll-hint')) this.wrap(strip);
      // The page may mark its active item a moment later: scroll to it the first time it is there.
      if (!strip.dataset.hintPlaced && this.scrollToActive(strip)) strip.dataset.hintPlaced = 'true';
      this.update(strip);
    });
  },

  wrap(strip) {
    const wrapper = createEl('div', { class: 'scroll-hint' });
    strip.before(wrapper);
    wrapper.append(strip);
    ['left', 'right'].forEach((side) => {
      const arrow = createEl('span', { class: `scroll-arrow is-${side}`, 'aria-hidden': 'true' });
      arrow.append(createEl('i', { class: `bi bi-chevron-${side}` }));
      wrapper.append(arrow);
    });
    strip.addEventListener('scroll', () => this.update(strip), { passive: true });
  },

  // The active tab / period is shown in the middle of the strip (only the strip moves, not the page).
  // Returns true when an active item was found (the strip is placed once, later the user scrolls).
  scrollToActive(strip) {
    const active = strip.querySelector('.active, [aria-pressed="true"], [aria-current="page"]');
    if (!active) return false;
    if (strip.scrollWidth > strip.clientWidth) {
      const box = active.getBoundingClientRect();
      const stripBox = strip.getBoundingClientRect();
      strip.scrollLeft += box.left - stripBox.left - (strip.clientWidth - box.width) / 2;
    }
    return true;
  },

  update(strip) {
    const wrapper = strip.parentElement;
    const max = strip.scrollWidth - strip.clientWidth;
    wrapper.classList.toggle('has-more-left', max > 1 && strip.scrollLeft > 1);
    wrapper.classList.toggle('has-more-right', max > 1 && strip.scrollLeft < max - 1);
  }
};

const Layout = {
  // "Beta v1.1.0" next to the logo (and in Settings → Help): always from APP_VERSION.
  fillAppVersion() {
    document.querySelectorAll('[data-app-version]').forEach((element) => {
      element.textContent = t('app.version', { version: APP_VERSION });
    });
  },

  init() {
    this.markActiveLink();
    ScrollHints.init();
    this.initLanguageButtons();
    this.initThemeButton();
    this.fillFooterYear();
    this.updateDocumentTitle();
    this.fillAppVersion();
    document.addEventListener('lifeos:languagechange', () => {
      this.updateLanguageButtons();
      this.updateDocumentTitle();
      this.fillAppVersion();
    });
    document.addEventListener('lifeos:themechange', () => this.updateThemeButton());
  },

  // "/goal-details.html?id=goal-1" -> "goals.html"; "/" -> "index.html"
  currentPage() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    return NAV_PARENTS[file] ?? file;
  },

  markActiveLink() {
    const page = this.currentPage();
    document.querySelectorAll('.sidebar-nav .nav-link').forEach((link) => {
      if (link.getAttribute('href') === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  },

  initLanguageButtons() {
    document.querySelectorAll('[data-lang]').forEach((button) => {
      button.addEventListener('click', () => I18n.setLanguage(button.dataset.lang));
    });
    this.updateLanguageButtons();
  },

  updateLanguageButtons() {
    document.querySelectorAll('[data-lang]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.lang === I18n.lang));
    });
    // The phone top bar shows the current language: "RU ▾"
    document.querySelectorAll('[data-lang-current]').forEach((label) => {
      label.textContent = t(`language.${I18n.lang}.short`);
    });
  },

  // The theme buttons: in the page header (#theme-toggle) and in the phone top bar ([data-theme-toggle]).
  themeButtons() {
    return document.querySelectorAll('#theme-toggle, [data-theme-toggle]');
  },

  initThemeButton() {
    this.themeButtons().forEach((button) => {
      button.addEventListener('click', () => {
        Theme.set(Theme.current() === 'dark' ? 'light' : 'dark');
      });
    });
    this.updateThemeButton();
  },

  // The button shows what will happen on click: a sun in dark theme, a moon in light.
  updateThemeButton() {
    const isDark = Theme.current() === 'dark';
    this.themeButtons().forEach((button) => {
      button.querySelector('i').className = `bi ${isDark ? 'bi-sun' : 'bi-moon-stars'}`;
      // Keep the key in data-i18n-aria-label so a later language change re-translates it.
      button.dataset.i18nAriaLabel = isDark ? 'layout.themeToLight' : 'layout.themeToDark';
      button.setAttribute('aria-label', t(button.dataset.i18nAriaLabel));
    });
  },

  fillFooterYear() {
    const year = document.getElementById('footer-year');
    if (year) year.textContent = String(new Date().getFullYear());
  },

  // Tab title follows the page heading: "Goals · LifeOS"
  updateDocumentTitle() {
    const key = document.querySelector('.page-title')?.dataset.i18n;
    if (key) document.title = `${t(key)} · ${t('app.name')}`;
  }
};

/* =========================================================
   8. Forms — validation helpers shared by all forms
   ========================================================= */

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 30;

// Each validator returns a translation key of the error, or null if the value is fine.
function validateProfileName(name) {
  if (name === '') return 'profile.error.nameRequired';
  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) return 'profile.error.nameLength';
  return null;
}

function validateDateValue(value) {
  return Dates.parse(value) ? null : 'profile.error.dateInvalid';
}

/* ----- Input masks: numbers and dates (every form) -----
   Number fields: <input data-number="decimal|integer" [data-decimals="1"]>
     "1000000" -> "1 000 000" (ru, kk: a no-break space) / "1,000,000" (en);
     decimal mark: "," in ru/kk, "." in en; both can be typed. The data keeps a plain number.
   Date fields: <input data-date-field> -> DD.MM.YYYY in every language, dots appear by themselves,
     plus a calendar button (a real <input type="date"> lies over it). The data keeps "YYYY-MM-DD".
   The masks work through events on the whole document, so fields of dialogs added later work too. */

const NUMBER_FORMATS = {
  en: { group: ',', decimal: '.' },
  ru: { group: ' ', decimal: ',' },
  kk: { group: ' ', decimal: ',' }
};

function numberFormatOf(lang = I18n.lang) {
  return NUMBER_FORMATS[lang] ?? NUMBER_FORMATS.en;
}

// Text -> number: "1 000 000" / "1,000,000" -> 1000000, "82,5" / "82.5" -> 82.5. Empty or wrong -> NaN.
// The language decides only "1,000": a thousand in English, 1.0 in Russian.
function parseNumber(text, lang = I18n.lang) {
  let value = String(text ?? '').replace(/[\s  ']/g, '');
  const negative = /^[-−]/.test(value);
  value = value.replace(/^[-−]/, '');
  if (!/^[\d.,]+$/.test(value)) return NaN;
  const lastDot = value.lastIndexOf('.');
  const lastComma = value.lastIndexOf(',');
  const count = (mark) => value.split(mark).length - 1;
  let decimal = null;
  if (lastDot !== -1 && lastComma !== -1) decimal = lastDot > lastComma ? '.' : ',';
  else if (lastComma !== -1) decimal = count(',') === 1 && !(lang === 'en' && value.length - lastComma - 1 === 3) ? ',' : null;
  else if (lastDot !== -1) decimal = count('.') === 1 ? '.' : null;
  const markAt = decimal ? value.lastIndexOf(decimal) : value.length;
  const whole = value.slice(0, markAt).replace(/[.,]/g, '');
  const fraction = decimal ? value.slice(markAt + 1) : '';
  if (/[.,]/.test(fraction) || (whole === '' && fraction === '')) return NaN;
  const number = Number(`${whole || '0'}.${fraction || '0'}`);
  return negative ? -number : number;
}

// The text of a field while typing -> "1 000 000,5" (ru) / "1,000,000.5" (en).
// decimals: digits allowed after the mark (0 = whole numbers only).
function formatNumberTyping(text, { lang = I18n.lang, decimals = 2 } = {}) {
  const { group, decimal } = numberFormatOf(lang);
  let kept = '';
  for (const char of String(text).split(group).join('')) {
    if (/\d/.test(char)) kept += char;
    else if (char === decimal && decimals > 0 && !kept.includes(decimal)) kept += char;
  }
  const [whole, fraction] = kept.split(decimal);
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return fraction === undefined ? grouped : `${grouped || '0'}${decimal}${fraction.slice(0, decimals)}`;
}

// A number from the data -> the text of a field: 82.5 -> "82,5" (ru), 1500000 -> "1,500,000" (en).
function formatNumberValue(number, { lang = I18n.lang, decimals = 2 } = {}) {
  if (!Number.isFinite(number)) return '';
  const factor = 10 ** decimals;
  const rounded = Math.round(Math.abs(number) * factor) / factor;
  const text = formatNumberTyping(String(rounded).replace('.', numberFormatOf(lang).decimal), { lang, decimals });
  return number < 0 ? `-${text}` : text;
}

function numberOptions(input) {
  const decimals = input.dataset.number === 'integer' ? 0 : Number(input.dataset.decimals ?? 2);
  return { lang: input.dataset.numberLang ?? I18n.lang, decimals };
}

// The value of a number field; the field remembers the language it was written in.
function readNumber(input) {
  return parseNumber(input.value, input.dataset.numberLang ?? I18n.lang);
}

function setNumberValue(input, number) {
  input.dataset.numberLang = I18n.lang;
  input.value = formatNumberValue(number, numberOptions(input));
  hideMinusNote(input);
}

// Rewrites the field with `format(text)` and keeps the caret after the same counted characters,
// so typing in the middle of "7 000 000" or "11.11.2026" still works (at the end it stays at the end).
function reformatKeepingCaret(input, format, countedChar) {
  const caret = input.selectionStart ?? input.value.length;
  const atEnd = caret === input.value.length;
  const countBefore = [...input.value.slice(0, caret)].filter((char) => countedChar.test(char)).length;
  input.value = format(input.value);
  let position = 0;
  let seen = 0;
  while (position < input.value.length && seen < countBefore) {
    if (countedChar.test(input.value[position])) seen++;
    position++;
  }
  if (atEnd) position = input.value.length;
  if (document.activeElement === input) input.setSelectionRange(position, position);
}

function onNumberInput(input, event) {
  const type = event.inputType ?? '';
  input.dataset.numberLang = I18n.lang;
  const options = numberOptions(input);
  const { decimal } = numberFormatOf(options.lang);
  // Pasted "1 500 000,50" or "1,500,000.50": read as a number, then written in the field's language.
  if (type.startsWith('insertFrom') || type === 'insertReplacementText') {
    const number = parseNumber(input.value, options.lang);
    input.value = Number.isFinite(number) ? formatNumberValue(number, options) : formatNumberTyping(input.value, options);
    return;
  }
  // The other decimal mark was typed ("." in Russian, "," in English): it becomes the right one.
  if (event.data && /^[.,]$/.test(event.data) && event.data !== decimal && options.decimals > 0) {
    const caret = input.selectionStart;
    input.value = `${input.value.slice(0, caret - 1)}${decimal}${input.value.slice(caret)}`;
    input.setSelectionRange(caret, caret);
  }
  const typedMinus = hasMinus(input.value);
  reformatKeepingCaret(input, (text) => formatNumberTyping(text, options), decimal === '.' ? /[\d.]/ : /[\d,]/);
  if (typedMinus) showMinusNote(input);
  else if (type.startsWith('delete') && input.value === '') hideMinusNote(input);
}

// "-" or "−" anywhere in the text (the mask removes it while typing).
function hasMinus(text) {
  return /[-−]/.test(String(text ?? ''));
}

/* A typed minus does not disappear silently: a field with data-minus-hint="<key>" gets a note under it
   ("Only positive numbers" / "To take money out, choose “Withdrawal (−)”"). The note stays until the
   field is cleared, filled by code (setNumberValue) or its form is reset. */
function showMinusNote(input) {
  const key = input.dataset.minusHint;
  if (!key) return;
  let note = document.getElementById(`${input.id}-minus`);
  if (!note) {
    note = createEl('p', { class: 'form-text minus-note', id: `${input.id}-minus`, role: 'status' });
    (input.closest('.input-group') ?? input).after(note);
  }
  note.dataset.i18n = key;
  note.textContent = t(key);
  note.hidden = false;
}

function hideMinusNote(input) {
  const note = document.getElementById(`${input.id}-minus`);
  if (note) note.hidden = true;
}

// After a language change "1 000,5" becomes "1,000.5" (and back).
function refreshNumberFields() {
  document.querySelectorAll('[data-number]').forEach((input) => {
    const number = readNumber(input);
    if (Number.isFinite(number)) setNumberValue(input, number);
    else input.dataset.numberLang = I18n.lang;
  });
}

/* ----- Dates: DD.MM.YYYY in the fields, "YYYY-MM-DD" in the code and the data ----- */

// "2026-11-05" -> "05.11.2026"
function isoToDateText(iso) {
  const date = Dates.parse(iso);
  if (!date) return '';
  const [year, month, day] = Dates.toISO(date).split('-');
  return `${day}.${month}.${year}`;
}

// A whole pasted date -> "DD.MM.YYYY": "15012027", "15/01/2027", "15-1-2027", "2027-01-15". null if it is none of them.
function normalizeDateText(text) {
  const value = String(text ?? '').trim();
  const pad = (part) => part.padStart(2, '0');
  let match = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(value);
  if (match) return `${pad(match[3])}.${pad(match[2])}.${match[1]}`;
  match = /^(\d{1,2})[-./\s](\d{1,2})[-./\s](\d{4})$/.exec(value);
  if (match) return `${pad(match[1])}.${pad(match[2])}.${match[3]}`;
  match = /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

// "DD.MM.YYYY" (or a pasted form) -> "2026-11-05"; null if it is not a real date (31.02 -> null).
function dateTextToIso(text) {
  const normalized = normalizeDateText(text);
  if (!normalized) return null;
  const [day, month, year] = normalized.split('.');
  const iso = `${year}-${month}-${day}`;
  return Dates.parse(iso) ? iso : null;
}

// While typing digits: "1501" -> "15.01" (with `trailing`: "15" -> "15." so the next part starts at once)
function formatDateDigits(digits, trailing = false) {
  const value = String(digits).replace(/\D/g, '').slice(0, 8);
  const text = [value.slice(0, 2), value.slice(2, 4), value.slice(4)].filter(Boolean).join('.');
  return trailing && (value.length === 2 || value.length === 4) ? `${text}.` : text;
}

const digitsOf = (text) => String(text).replace(/\D/g, '');

// "YYYY-MM-DD" for a valid date, "" for an empty field, or the typed text if it is wrong
// (then Dates.parse() fails and the validator shows "Choose a valid date").
function getDateValue(input) {
  const text = input.value.trim();
  if (text === '') return '';
  return dateTextToIso(text) ?? text;
}

function setDateValue(input, iso) {
  input.value = iso ? isoToDateText(iso) : '';
  input.dataset.prevDigits = digitsOf(input.value);
  syncNativeDate(input);
}

// The limits of a date field ("YYYY-MM-DD" or ''): checked when the field is left, and given to the calendar.
function setDateLimits(input, { min = '', max = '' } = {}) {
  input.dataset.min = min || '';
  input.dataset.max = max || '';
  const native = nativeDateOf(input);
  if (native) {
    native.min = min || '';
    native.max = max || '';
  }
}

// What is wrong with the date in the field (null = fine or empty). The keys of the limits come from
// data-min-error / data-max-error ("The milestone cannot be later than the goal deadline.").
function dateFieldError(input) {
  const text = input.value.trim();
  if (text === '') return null;
  const iso = dateTextToIso(text);
  if (!iso) return 'profile.error.dateInvalid';
  if (input.dataset.min && iso < input.dataset.min) return input.dataset.minError || 'date.error.min';
  if (input.dataset.max && iso > input.dataset.max) return input.dataset.maxError || 'date.error.max';
  return null;
}

function onDateInput(input, event) {
  const type = event.inputType ?? '';
  if (type.startsWith('insertFrom') || type === 'insertReplacementText') {
    // A pasted or dropped date: "15/01/2027", "2027-01-15", "15012027"
    input.value = normalizeDateText(input.value) ?? formatDateDigits(digitsOf(input.value));
  } else if (type === 'deleteContentBackward' && digitsOf(input.value) === input.dataset.prevDigits) {
    // Backspace removed only a dot: remove the digit before it too ("15.|" -> "1").
    const caret = input.selectionStart ?? input.value.length;
    const digitsBefore = digitsOf(input.value.slice(0, caret)).length;
    const digits = digitsOf(input.value);
    input.value = formatDateDigits(digits.slice(0, digitsBefore - 1) + digits.slice(digitsBefore));
    let position = 0;
    for (let seen = 0; position < input.value.length && seen < digitsBefore - 1; position++) {
      if (/\d/.test(input.value[position])) seen++;
    }
    input.setSelectionRange(position, position);
  } else {
    reformatKeepingCaret(input, (text) => formatDateDigits(digitsOf(text), type.startsWith('insert')), /\d/);
  }
  input.dataset.prevDigits = digitsOf(input.value);
  syncNativeDate(input);
}

// Leaving a date field: a wrong or out-of-range date gets its error at once; the error goes away when it is fixed.
function onDateLeave(input) {
  const error = dateFieldError(input);
  const shownError = document.getElementById(`${input.id}-error`)?.dataset.i18n;
  if (error) {
    input.dataset.maskError = error;
    setFieldError(input, error);
  } else if (input.dataset.maskError && shownError === input.dataset.maskError) {
    setFieldError(input, null);
    delete input.dataset.maskError;
  }
}

/* ----- The calendar button: a real <input type="date"> lies over the icon (opacity 0), so a tap
   on the icon is a tap on the browser's own date input — this opens the calendar in every browser,
   also in Safari on iPhone. showPicker() is only an extra help where it exists. ----- */

function nativeDateOf(input) {
  return input.closest('.date-field')?.querySelector('.date-native') ?? null;
}

// A valid typed date goes into the calendar, so it opens on that date.
function syncNativeDate(input) {
  const native = nativeDateOf(input);
  if (native) native.value = dateTextToIso(input.value) ?? '';
}

function enhanceDateField(input) {
  if (input.dataset.dateReady) return;
  input.dataset.dateReady = 'true';
  input.inputMode = 'numeric';
  input.maxLength = 10;
  input.dataset.prevDigits = digitsOf(input.value);
  const group = createEl('div', { class: 'input-group date-field' });
  input.before(group);
  group.append(input);

  const pick = createEl('span', { class: 'btn btn-tool date-pick' });
  pick.append(createEl('i', { class: 'bi bi-calendar3', 'aria-hidden': 'true' }));
  const native = createEl('input', {
    type: 'date', class: 'date-native', 'data-i18n-aria-label': 'date.pick', 'aria-label': t('date.pick')
  });
  pick.append(native);
  group.append(pick);
  setDateLimits(input, { min: input.dataset.min, max: input.dataset.max });
  syncNativeDate(input);

  native.addEventListener('click', () => {
    try {
      native.showPicker?.(); // Chrome on a computer opens the calendar only this way when the field is clicked
    } catch (error) {
      // not allowed here: the browser opens its own calendar (phones) or the user types the date
    }
  });
  native.addEventListener('change', () => {
    if (!native.value) return;
    setDateValue(input, native.value);
    // Tell the page the value changed (live validation listens to these events).
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    onDateLeave(input);
  });
}

// Date fields of dialogs added later (goal wizard, quick result, task window, sport) get their button too.
function prepareFields(root) {
  if (root.matches?.('[data-date-field]')) enhanceDateField(root);
  root.querySelectorAll?.('[data-date-field]').forEach(enhanceDateField);
  root.querySelectorAll?.('[data-number]').forEach((input) => {
    input.inputMode = input.dataset.number === 'integer' ? 'numeric' : 'decimal';
  });
}

const InputMasks = {
  init() {
    prepareFields(document);
    new MutationObserver((changes) => changes.forEach((change) => {
      change.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) prepareFields(node); });
    })).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('input', (event) => {
      const input = event.target;
      if (input.matches?.('[data-number]')) onNumberInput(input, event);
      // only real typing (the calendar sends its own plain 'input' event after setDateValue)
      if (input.matches?.('[data-date-field]') && event.inputType !== undefined) onDateInput(input, event);
    });
    document.addEventListener('change', (event) => {
      if (event.target.matches?.('[data-date-field]')) onDateLeave(event.target);
    });
    document.addEventListener('reset', (event) => {
      event.target.querySelectorAll?.('[data-minus-hint]').forEach(hideMinusNote);
    });
    document.addEventListener('lifeos:languagechange', refreshNumberFields);
  }
};

function numberError(value, { min = null, positive = false, max = null } = {}) {
  if (!Number.isFinite(value)) return 'wizard.error.number';
  if (positive && value <= 0) return 'wizard.error.positive';
  if (min !== null && value < min) return 'wizard.error.notNegative';
  if (max !== null && value > max) return 'wizard.error.percentMax';
  return null;
}

function byId(id) {
  return document.getElementById(id);
}

// createEl('span', { class: 'x' }, 'text') — text is set with textContent (safe).
function createEl(tag, attributes = {}, text) {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  if (text !== undefined) element.textContent = text;
  return element;
}

// Shows or clears the error under a field. Expects ids "<input id>-error" and "<input id>-hint".
// The error key is stored in data-i18n, so the message is re-translated on language change.
function setFieldError(input, errorKey) {
  const errorEl = document.getElementById(`${input.id}-error`);
  const hintEl = document.getElementById(`${input.id}-hint`);
  showErrorText(errorEl, errorKey);
  input.classList.toggle('is-invalid', Boolean(errorKey));
  if (errorKey) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  // The field is described by its hint (if any) and its error (if any).
  const describedBy = [hintEl?.id, errorKey ? errorEl.id : null].filter(Boolean).join(' ');
  if (describedBy) input.setAttribute('aria-describedby', describedBy);
  else input.removeAttribute('aria-describedby');
}

// Error for a group (radio fieldset, list). Expects an element with id "<group id>-error".
/* ---------- Double-submit protection: a double click or a double Enter saves only once ----------
   submitOnce(handler) wraps a "submit" (or a save button "click") listener. While the handler runs, and
   a moment after a successful save (the fields are already cleared, a dialog is closing), the save
   buttons are disabled and a second submit is ignored. If the form shows an error (a field with
   .is-invalid), it is unlocked at once, so the user can fix it and save again. */
const SAVE_HOLD_MS = 700;

function saveButtonsOf(element) {
  if (element.tagName !== 'FORM') return [element];
  const outside = element.id ? [...document.querySelectorAll(`[form="${element.id}"]`)] : [];
  return [...element.querySelectorAll('[type="submit"]'), ...outside];
}

// Locking remembers which buttons were already disabled: unlocking does not turn those on.
function setSaving(element, isSaving) {
  element.dataset.saving = String(isSaving);
  saveButtonsOf(element).forEach((button) => {
    if (isSaving) {
      button.dataset.wasDisabled = String(button.disabled);
      button.disabled = true;
    } else if (button.dataset.wasDisabled !== undefined) {
      button.disabled = button.dataset.wasDisabled === 'true';
      delete button.dataset.wasDisabled;
    }
  });
}

function submitOnce(handler) {
  return (event) => {
    const element = event.currentTarget;
    if (element.dataset.saving === 'true') {
      event.preventDefault(); // the first save is still running or has just finished
      return;
    }
    const focused = document.activeElement;
    setSaving(element, true);
    const unlock = () => {
      setSaving(element, false);
      // A disabled button loses the keyboard focus: give it back if nothing else took it.
      const lost = !document.activeElement || document.activeElement === document.body;
      if (lost && focused?.isConnected && !focused.disabled) focused.focus({ preventScroll: true });
    };
    try {
      handler(event);
    } finally {
      const hasErrors = element.tagName === 'FORM' && element.querySelector('.is-invalid');
      if (hasErrors) unlock();
      else setTimeout(unlock, SAVE_HOLD_MS);
    }
  };
}

function setGroupError(group, errorKey) {
  const errorEl = document.getElementById(`${group.id}-error`);
  showErrorText(errorEl, errorKey);
  group.classList.toggle('is-invalid', Boolean(errorKey));
  if (errorKey) group.setAttribute('aria-describedby', errorEl.id);
  else group.removeAttribute('aria-describedby');
}

function showErrorText(errorEl, errorKey) {
  if (errorKey) {
    errorEl.dataset.i18n = errorKey;
    errorEl.textContent = t(errorKey);
  } else {
    delete errorEl.dataset.i18n;
    errorEl.textContent = '';
  }
}

/* =========================================================
   9. First run — create the local profile (concept, section 9)
   ========================================================= */

const FirstRun = {
  modalEl: null,
  form: null,
  submitted: false, // errors are shown live only after the first submit

  init() {
    this.modalEl = document.getElementById('first-run-modal');
    this.form = document.getElementById('first-run-form');
    if (!this.modalEl || !this.form || getProfile()) return;

    this.fillDefaults();
    this.bindEvents();
    this.modalEl.addEventListener('shown.bs.modal', () => this.field('name').focus());
    bootstrap.Modal.getOrCreateInstance(this.modalEl).show();
  },

  field(name) {
    return this.form.querySelector(`[name="${name}"]`);
  },

  fillDefaults() {
    setDateValue(this.field('personalYearStart'), Dates.toISO(Dates.today()));
    // RadioNodeList.value checks the radio with that value.
    this.form.elements.language.value = I18n.lang;
    this.form.elements.theme.value = Theme.current();
  },

  bindEvents() {
    // Language and theme change live, right inside the dialog.
    this.form.addEventListener('change', (event) => {
      if (event.target.name === 'language') I18n.setLanguage(event.target.value);
      if (event.target.name === 'theme') Theme.set(event.target.value);
    });
    this.form.addEventListener('input', () => {
      if (this.submitted) this.validate();
    });
    this.form.addEventListener('submit', submitOnce((event) => {
      event.preventDefault();
      this.submit();
    }));
  },

  readValues() {
    return {
      name: this.field('name').value.trim(),
      personalYearStart: getDateValue(this.field('personalYearStart'))
    };
  },

  // Shows every error at once; returns true if the form is valid.
  validate() {
    const values = this.readValues();
    const nameError = validateProfileName(values.name);
    const dateError = validateDateValue(values.personalYearStart);
    setFieldError(this.field('name'), nameError);
    setFieldError(this.field('personalYearStart'), dateError);
    return !nameError && !dateError;
  },

  submit() {
    this.submitted = true;
    if (!this.validate()) {
      this.form.querySelector('.is-invalid')?.focus();
      return; // nothing is cleared: the user keeps what they typed
    }

    const values = this.readValues();
    const profile = {
      name: values.name,
      language: I18n.lang,
      theme: Theme.current(),
      personalYearStart: values.personalYearStart,
      createdAt: new Date().toISOString() // a moment in time, so UTC is correct here
    };
    if (!AppStorage.set(STORAGE_KEYS.profile, profile)) return; // error toast already shown

    this.removePreferenceCopies();
    updateMeta({ lastSeenVersion: APP_VERSION }); // a new user does not need "What's new"
    bootstrap.Modal.getInstance(this.modalEl).hide();
    showToast('firstRun.saved', 'success', { name: profile.name });
    // created: a brand-new profile (js/onboarding.js starts the tour once)
    document.dispatchEvent(new CustomEvent('lifeos:profilechange', { detail: { profile, created: true } }));
  },

  // Before the profile existed, language/theme were kept in settings. Now the profile owns them.
  removePreferenceCopies() {
    const { language, theme, ...otherSettings } = getSettings();
    AppStorage.set(STORAGE_KEYS.settings, otherSettings);
  }
};

/* =========================================================
   10. Goals — data model shared by all pages (concept, section 5)
   ========================================================= */

// Category -> default Bootstrap icon. Category names are translated as "category.<name>".
const GOAL_CATEGORIES = {
  finance: 'bi-piggy-bank',
  books: 'bi-book',
  health: 'bi-heart-pulse',
  languages: 'bi-translate',
  education: 'bi-mortarboard',
  projects: 'bi-kanban',
  career: 'bi-briefcase',
  personal: 'bi-person-heart',
  custom: 'bi-stars'
};
// Goal colors (not the accent colors of the site). The first six are the old ones: old goals keep their color.
const GOAL_COLORS = ['teal', 'blue', 'green', 'plum', 'clay', 'rose', 'coral', 'mustard', 'indigo', 'pink', 'turquoise', 'olive', 'graphite']; // palette in style.css
const PROGRESS_TYPES = ['number', 'money', 'percent', 'levels', 'checklist', 'streak', 'measurements'];
const GOAL_STATUSES = ['active', 'completed', 'archived'];

// Always an array of objects, even if the saved data is missing or broken.
function getGoals() {
  const goals = AppStorage.get(STORAGE_KEYS.goals, []);
  return Array.isArray(goals) ? goals.filter((goal) => goal && typeof goal === 'object') : [];
}

function saveGoals(goals) {
  return AppStorage.set(STORAGE_KEYS.goals, goals);
}

function getGoalById(id) {
  return getGoals().find((goal) => goal.id === id) ?? null;
}

// A date string exactly in the form "2026-11-12" (and a real day). Everything else (other formats,
// HTML from a broken or malicious file) is rejected, so such a value never reaches the page.
function isIsoDate(value) {
  return typeof value === 'string' && Dates.parse(value) !== null;
}

// An id from storage or a file: a non-empty string, otherwise null.
function cleanId(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

// { ... } but not null and not an array
function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Progress as a whole number 0–100, for every progress type.
function getGoalPercent(goal) {
  if (goal.status === 'completed') return 100;
  const ratio = goal.progressType === 'checklist'
    ? checklistRatio(goal.checklist)
    : rangeRatio(goal.startValue, goal.targetValue, goal.currentValue);
  const clamped = Math.min(Math.max(ratio, 0), 1);
  // Round DOWN: 99.6% is not reached yet. The tiny number fixes float errors like 0.29 * 100 = 28.999…
  return Math.floor(clamped * 100 + 1e-9);
}

// Works in both directions: 0 -> 13 books, or 92 -> 80 kg (target lower than start).
// For "levels" the three values are positions in goal.levels.
function rangeRatio(start, target, current) {
  const [from, to, now] = [start, target, current].map(Number);
  if (![from, to, now].every(Number.isFinite)) return 0;
  if (from === to) return now === to ? 1 : 0;
  return (now - from) / (to - from);
}

function checklistRatio(items) {
  const list = asArray(items);
  if (list.length === 0) return 0;
  return list.filter((item) => item && item.done).length / list.length;
}

// One value in the goal's own format: "3 200 000 ₸", "60 %", "B1", "86.5 kg".
function formatGoalValue(goal, value) {
  const number = Number(value) || 0;
  if (goal.progressType === 'money') return Format.money(number, goal.unit || DEFAULT_CURRENCY);
  if (goal.progressType === 'percent') return Format.number(number / 100, { style: 'percent', maximumFractionDigits: 1 });
  if (goal.progressType === 'levels') return String(asArray(goal.levels)[number] ?? '—');
  const text = Format.number(number, { maximumFractionDigits: 2 });
  if (hasBookList(goal)) return bookCountText(number, text);
  return goal.unit ? `${text} ${goal.unit}` : text;
}

// A goal with a book list counts books: "1 книга", "2 книги", "5 книг" (Intl.PluralRules in tPlural);
// other goals keep the unit the user typed. text = the number already formatted (fractions in a pace).
function bookCountText(number, text = Format.number(number)) {
  return tPlural('books.count', number, { count: text });
}

// After "of" ("2 books of 21 books"): Russian needs the genitive — «из 21 книги», «из 2 книг», «из 5 книг».
function bookCountOfText(number) {
  return tPlural('books.countOf', number, { count: Format.number(number) });
}

// "current / target" for cards: "5 / 13 books", "B1 / C1", "1 / 3".
// Returns plain text: escape it before putting into HTML (it contains user units).
function formatGoalProgress(goal) {
  if (goal.progressType === 'checklist') {
    const items = asArray(goal.checklist);
    return `${items.filter((item) => item && item.done).length} / ${items.length}`;
  }
  if (goal.progressType === 'percent' && Number(goal.targetValue) === 100) {
    return formatGoalValue(goal, goal.currentValue); // "35 %", not "35 % / 100 %"
  }
  if (['money', 'percent', 'levels'].includes(goal.progressType)) {
    return `${formatGoalValue(goal, goal.currentValue)} / ${formatGoalValue(goal, goal.targetValue)}`;
  }
  const format = (value) => Format.number(Number(value) || 0, { maximumFractionDigits: 2 });
  if (hasBookList(goal)) return `${format(goal.currentValue)} / ${bookCountText(Number(goal.targetValue) || 0)}`; // "3 / 13 книг"
  const unit = goal.unit ? ` ${goal.unit}` : '';
  return `${format(goal.currentValue)} / ${format(goal.targetValue)}${unit}`;
}

function goalCategoryName(category) {
  return t(`category.${category in GOAL_CATEGORIES ? category : 'custom'}`);
}

// Only known values may go into class names / attributes.
function goalColor(goal) {
  return GOAL_COLORS.includes(goal.color) ? goal.color : GOAL_COLORS[0];
}

function goalIcon(goal) {
  if (/^bi-[a-z0-9-]+$/.test(goal.icon)) return goal.icon;
  return GOAL_CATEGORIES[goal.category] ?? GOAL_CATEGORIES.custom;
}

// "200 days left", "Overdue by 3 days", "Due today" — or the date for finished goals.
function goalDeadlineText(goal) {
  const days = Dates.daysUntil(goal.deadline);
  if (days === null) return t('goals.deadline.none');
  // For finished or archived goals "days left" makes no sense: show the date.
  if (goal.status !== 'active') return Format.shortDate(goal.deadline);
  if (days === 0) return t('goals.deadline.today');
  if (days > 0) return tPlural('goals.deadline.left', days);
  return tPlural('goals.deadline.overdue', -days);
}

/* =========================================================
   11. Progress entries — lifeos_progress: [{ id, date, goalId, value, note }]
   How an entry changes goal.currentValue depends on the progress type:
   - money, number: value is a CHANGE (+50 000 ₸, −10 000 ₸, +1 book) and is added;
   - percent, measurements, levels: value is the NEW value; the latest entry wins;
   - streak: value is 1 for a marked day; the streak is counted from the dates;
   - checklist: no entries, progress comes from the ticked items.
   Book entries may also have "pages" (pages read that day).
   ========================================================= */

const DELTA_TYPES = ['money', 'number'];
const ABSOLUTE_TYPES = ['percent', 'measurements', 'levels'];

function getProgressEntries() {
  const entries = AppStorage.get(STORAGE_KEYS.progress, []);
  return Array.isArray(entries) ? entries.filter((entry) => entry && typeof entry === 'object') : [];
}

function saveProgressEntries(entries) {
  return AppStorage.set(STORAGE_KEYS.progress, entries);
}

// Entries of one goal, newest first. On the same date, the one added later comes first.
// (Workouts are stored in the same list with kind "workout" and no goalId, so they never match.)
function getGoalEntries(goalId, entries = getProgressEntries()) {
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.goalId === goalId)
    .sort((a, b) => String(b.entry.date).localeCompare(String(a.entry.date)) || b.index - a.index)
    .map(({ entry }) => entry);
}

// Days in a row up to today. If today is not marked yet, the streak is still alive until yesterday.
function calculateStreak(dates, todayValue = new Date()) {
  const marked = new Set(dates);
  const today = Dates.parse(todayValue);
  let day = marked.has(Dates.toISO(today)) ? today : Dates.addDays(today, -1);
  let count = 0;
  while (marked.has(Dates.toISO(day))) {
    count++;
    day = Dates.addDays(day, -1);
  }
  return count;
}

// The new goal.currentValue after an entry was added or deleted.
// `goalEntries` = the goal's entries AFTER the change (newest first).
// `change` = +value of an added entry or −value of a deleted one (used by money/number only).
function recalculateCurrentValue(goal, goalEntries, change = 0) {
  if (DELTA_TYPES.includes(goal.progressType)) {
    // Round to cents: 0.1 + 0.2 must be 0.3, not 0.30000000000000004.
    return Math.round(((Number(goal.currentValue) || 0) + change) * 100) / 100;
  }
  if (goal.progressType === 'streak') return calculateStreak(goalEntries.map((entry) => entry.date));
  if (ABSOLUTE_TYPES.includes(goal.progressType)) {
    return goalEntries.length > 0 ? Number(goalEntries[0].value) : Number(goal.startValue) || 0;
  }
  return goal.currentValue;
}

// Adds one progress entry and recalculates goal.currentValue.
// fields: { date, value, note?, pages? }. Returns the updated goal, or null if saving failed.
function recordProgress(goalId, fields) {
  const goals = getGoals();
  const goal = goals.find((item) => item.id === goalId);
  if (!goal) return null;
  const entries = getProgressEntries();
  const entry = { id: createId('entry'), date: fields.date, goalId, value: fields.value, note: fields.note ?? '' };
  if (fields.pages) entry.pages = fields.pages;
  entries.push(entry);
  const change = DELTA_TYPES.includes(goal.progressType) ? Number(entry.value) || 0 : 0;
  goal.currentValue = recalculateCurrentValue(goal, getGoalEntries(goalId, entries), change);
  goal.updatedAt = new Date().toISOString();
  if (!saveProgressEntries(entries) || !saveGoals(goals)) return null;
  return goal;
}

// A streak breaks by itself when a day is missed, so it is recounted every time it is shown.
function withLiveStreak(goal, entries) {
  if (goal.progressType !== 'streak') return goal;
  const goalEntries = getGoalEntries(goal.id, entries);
  if (goalEntries.length === 0) return goal; // keep a value typed in the wizard
  return { ...goal, currentValue: calculateStreak(goalEntries.map((entry) => entry.date)) };
}

/* =========================================================
   11a. Book shelf — a "books" goal of the type "number" with bookList: true (goal-details.html: js/books.js)
   goal.books: [{ id, title, author, totalPages, pagesRead, status, startedAt, finishedAt, createdAt }]
   - status: "planned" (want to read) -> "reading" (the first entry of pages) -> "done";
   - totalPages may be null: then the book is finished from its menu ("Mark as read");
   - goal.currentValue = the number of "done" books (counted again after every change).
   A reading entry in lifeos_progress: { id, date, goalId, bookId, pages, value, note } —
   pages = pages this entry added; value = 1 if this entry finished the book (for the history and undo).
   ========================================================= */

const BOOK_STATUSES = ['planned', 'reading', 'done'];
const BOOK_TEXT_MAX = 120; // title and author
const BOOK_DEFAULT_PAGES = 300; // the pace when no finished book has a page count yet
const BOOK_MIGRATION_LIMIT = 500; // an old goal "1 000 000 books" must not freeze the page

// A goal that can keep a book list: "Books" category + "Number" progress type.
function isBookGoal(goal) {
  return goal?.category === 'books' && goal.progressType === 'number';
}

function hasBookList(goal) {
  return isBookGoal(goal) && goal.bookList === true;
}

function goalBooks(goal) {
  return asArray(goal?.books).filter(isPlainObject);
}

function countDoneBooks(books) {
  return books.filter((book) => book.status === 'done').length;
}

function bookPagesTotal(book) {
  const total = Number(book.totalPages);
  return Number.isInteger(total) && total > 0 ? total : null;
}

// A new book. Added as "done" right away: all its pages are read (the date is unknown, so no finishedAt).
function createBook({ title = '', author = '', totalPages = null, status = 'planned' } = {}, now = new Date()) {
  const done = status === 'done';
  return {
    id: createId('book'),
    title,
    author,
    totalPages,
    pagesRead: done && totalPages ? totalPages : 0,
    status: BOOK_STATUSES.includes(status) ? status : 'planned',
    startedAt: null,
    finishedAt: null,
    createdAt: now.toISOString()
  };
}

// Old goals and "Already read: N" in the wizard: N finished books without a title.
function untitledDoneBooks(count) {
  const safe = Math.min(Math.max(Math.floor(Number(count) || 0), 0), BOOK_MIGRATION_LIMIT);
  // "-1", "-2"…: hundreds of books are made in the same millisecond, the number keeps every id unique.
  return Array.from({ length: safe }, (_, index) => ({ ...createBook({ status: 'done' }), id: `${createId('book')}-${index + 1}` }));
}

// Pure: pages read -> the new book. reading = { pages } ("+ pages") or { toPage } ("read up to page N").
// Pages never go past totalPages. Returns { book, added, finished }.
function readBookPages(book, { pages = 0, toPage = null }, date) {
  const before = Number(book.pagesRead) || 0;
  const total = bookPagesTotal(book);
  let after = toPage !== null ? toPage : before + pages;
  if (total !== null) after = Math.min(after, total);
  const added = Math.max(after - before, 0);
  const updated = { ...book, pagesRead: before + added, startedAt: book.startedAt ?? date };
  if (updated.status === 'planned') updated.status = 'reading';
  const finished = updated.status !== 'done' && total !== null && updated.pagesRead >= total;
  if (finished) Object.assign(updated, { status: 'done', finishedAt: date });
  return { book: updated, added, finished };
}

// Pure: "Mark as read" — the rest of the pages (when the page count is known) and the status "done".
function finishBook(book, date) {
  const total = bookPagesTotal(book);
  const before = Number(book.pagesRead) || 0;
  const added = total !== null ? Math.max(total - before, 0) : 0;
  return {
    book: { ...book, pagesRead: before + added, status: 'done', startedAt: book.startedAt ?? date, finishedAt: date },
    added,
    finished: true
  };
}

// Pure: the book after one of its entries was deleted. `left` = the book's entries that stay.
// The entry that finished the book (value 1) or fewer pages than the book has -> "reading" again;
// no entries left and no pages -> back to "want to read".
function undoBookEntry(book, entry, left) {
  const pagesRead = Math.max((Number(book.pagesRead) || 0) - (Number(entry.pages) || 0), 0);
  const updated = { ...book, pagesRead };
  const total = bookPagesTotal(book);
  const unfinished = Number(entry.value) > 0 || (total !== null && pagesRead < total);
  if (updated.status === 'done' && unfinished) Object.assign(updated, { status: 'reading', finishedAt: null });
  if (left.length === 0 && pagesRead === 0 && updated.status === 'reading') Object.assign(updated, { status: 'planned', startedAt: null });
  return updated;
}

// Pure: the numbers above the book list. perDay = null when there is no pace (no deadline, overdue, done).
// Pace = books left × the average length of the finished books with a page count (or 300) / days left.
// looseEntries: the goal's old entries without a book (before the list): their pages count too.
function bookShelfStats(goal, today = Dates.today(), looseEntries = []) {
  const books = goalBooks(goal);
  const done = countDoneBooks(books);
  const target = Number(goal.targetValue) || 0;
  const loosePages = looseEntries.filter((entry) => !entry.bookId).reduce((sum, entry) => sum + (Number(entry.pages) || 0), 0);
  const pages = loosePages + books.reduce((sum, book) => sum + (Number(book.pagesRead) || 0), 0);
  const lengths = books.filter((book) => book.status === 'done').map(bookPagesTotal).filter((total) => total !== null);
  const average = lengths.length ? lengths.reduce((sum, total) => sum + total, 0) / lengths.length : BOOK_DEFAULT_PAGES;
  const deadline = Dates.parse(goal.deadline);
  const daysLeft = deadline ? Dates.daysBetween(today, deadline) + 1 : 0; // today counts too
  const booksLeft = Math.max(target - done, 0);
  const perDay = booksLeft > 0 && daysLeft > 0 ? Math.ceil((booksLeft * average) / daysLeft) : null;
  return { done, target, pages, perDay };
}

// Pure: an old book goal (no bookList yet) gets a list: N finished books without a title,
// N = its current value. Nothing else changes; a goal that already has bookList is returned as it is.
function migrateBookGoal(goal) {
  if (!isBookGoal(goal) || 'bookList' in goal) return goal;
  const books = goalBooks(goal).length ? goalBooks(goal) : untitledDoneBooks(goal.currentValue);
  return { ...goal, bookList: true, books, currentValue: countDoneBooks(books) };
}

// Runs on every page start (like migrateSportData). An old backup is moved the same way after an import.
function migrateBookGoals() {
  const goals = getGoals();
  if (!goals.some((goal) => isBookGoal(goal) && !('bookList' in goal))) return;
  saveGoals(goals.map(migrateBookGoal));
}

// The goal and the book by ids (from a fresh read of the storage), or null.
function findBook(goals, goalId, bookId) {
  const goal = goals.find((item) => item.id === goalId);
  const book = goalBooks(goal).find((item) => item.id === bookId);
  return goal && book ? { goal, book } : null;
}

function replaceBook(goal, book) {
  goal.books = goalBooks(goal).map((item) => (item.id === book.id ? book : item));
  goal.currentValue = countDoneBooks(goal.books);
  goal.updatedAt = new Date().toISOString();
}

// Saves pages of a book as an entry. reading = { pages } | { toPage } | { finish: true }, plus { date, note }.
// Returns { goal, book, entry } (book.status "done" + entry.value 1 = this entry finished it) or null.
function recordBookReading(goalId, bookId, reading) {
  const goals = getGoals();
  const found = findBook(goals, goalId, bookId);
  if (!found) return null;
  const result = reading.finish ? finishBook(found.book, reading.date) : readBookPages(found.book, reading, reading.date);
  const entry = { id: createId('entry'), date: reading.date, goalId, bookId, value: result.finished ? 1 : 0, note: reading.note ?? '' };
  if (result.added > 0) entry.pages = result.added;
  replaceBook(found.goal, result.book);
  const entries = getProgressEntries();
  entries.push(entry);
  if (!saveProgressEntries(entries) || !saveGoals(goals)) return null;
  return { goal: found.goal, book: result.book, entry };
}

// Pure: the opposite of undoBookEntry (the "Undo" after a delete). The pages come back;
// the status and its dates are what they were before the delete (`before` = the book then).
function redoBookEntry(book, entry, before) {
  return {
    ...book,
    pagesRead: (Number(book.pagesRead) || 0) + (Number(entry.pages) || 0),
    status: before.status,
    startedAt: before.startedAt ?? null,
    finishedAt: before.finishedAt ?? null
  };
}

// What deleting a book also deletes: { count, pages } of its entries.
function bookEntriesSummary(bookId, entries = getProgressEntries()) {
  const list = entries.filter((entry) => entry.bookId === bookId);
  return { count: list.length, pages: list.reduce((sum, entry) => sum + (Number(entry.pages) || 0), 0) };
}

// Deletes a book and its reading entries; the goal counter is counted again.
function deleteBook(goalId, bookId) {
  const goals = getGoals();
  const goal = goals.find((item) => item.id === goalId);
  if (!goal) return null;
  goal.books = goalBooks(goal).filter((book) => book.id !== bookId);
  goal.currentValue = countDoneBooks(goal.books);
  goal.updatedAt = new Date().toISOString();
  const entries = getProgressEntries().filter((entry) => entry.bookId !== bookId);
  if (!saveProgressEntries(entries) || !saveGoals(goals)) return null;
  return goal;
}

// Does the book have the entry that finished it? Then "done" is undone only by deleting that entry.
function bookHasFinishEntry(bookId, entries = getProgressEntries()) {
  return entries.some((entry) => entry.bookId === bookId && Number(entry.value) > 0);
}

// Adds (bookId = null) or edits a book. fields: { title, author, totalPages, status }.
// Editing: the pages read never go past the new page count; reaching it finishes the book.
function saveBook(goalId, fields, bookId = null) {
  const goals = getGoals();
  const goal = goals.find((item) => item.id === goalId);
  if (!goal) return null;
  let book;
  if (bookId === null) {
    book = createBook(fields);
    goal.books = [...goalBooks(goal), book];
  } else {
    const old = goalBooks(goal).find((item) => item.id === bookId);
    if (!old) return null;
    book = { ...old, title: fields.title, author: fields.author, totalPages: fields.totalPages, status: fields.status };
    const total = bookPagesTotal(book);
    if (old.status === 'done' && book.status !== 'done') book.finishedAt = null;
    if (old.status !== 'done' && book.status === 'done') book.pagesRead = total ?? book.pagesRead;
    if (total !== null && book.pagesRead >= total) {
      book.pagesRead = total;
      if (book.status !== 'done') Object.assign(book, { status: 'done', finishedAt: Dates.toISO(Dates.today()) });
    }
  }
  replaceBook(goal, book);
  return saveGoals(goals) ? { goal, book } : null;
}

// The title of a book on the page: "" (an old book) -> "Untitled".
function bookTitle(book) {
  return String(book?.title ?? '').trim() || t('books.untitled');
}

/* =========================================================
   11b. Sport — lifeos_sport (sport.html; also Dashboard, Planner, Progress)
   {
     version: 1,
     plan: { "1".."7": { type: "workout", title, exercises: [{ id, name, sets, reps, weight, note }] }
                     | { type: "rest" } },          // 1 = Monday … 7 = Sunday, missing = not planned
     sessions: [{ id, date, title, planned, exercises: [{ name, note, sets: [{ reps, weight, done }] }], finishedAt }],
     current: null | { date, title, planned, exercises },   // today's workout that is not finished yet
     body: [{ id, date, weight, waist, belly, chest, hips, biceps, thigh, calf }]
   }
   Records are not stored: they are always counted from the sessions.
   ========================================================= */

const SPORT_VERSION = 1;

function getSport() {
  const saved = AppStorage.get(STORAGE_KEYS.sport, null);
  const data = isPlainObject(saved) ? saved : {};
  return {
    version: SPORT_VERSION,
    plan: isPlainObject(data.plan) ? data.plan : {},
    sessions: asArray(data.sessions).filter(isPlainObject),
    current: isPlainObject(data.current) ? data.current : null,
    body: asArray(data.body).filter(isPlainObject)
  };
}

function saveSport(sport) {
  return AppStorage.set(STORAGE_KEYS.sport, sport);
}

// Monday = 1 … Sunday = 7 (Date.getDay() gives Sunday = 0)
function weekdayNumber(date) {
  return date.getDay() || 7;
}

// The plan of a weekday, or null when nothing is planned.
function planForDate(dateValue, sport = getSport()) {
  const date = Dates.parse(dateValue);
  const day = date ? sport.plan[String(weekdayNumber(date))] : null;
  return isPlainObject(day) && (day.type === 'workout' || day.type === 'rest') ? day : null;
}

/* ----- Moving old data (before the Sport page workouts and body lived in lifeos_progress) ----- */

// Pure: old entries { kind: "workout", date, exercise, sets, reps, weight, note } and { kind: "body", ... }
// -> sessions (one per date) and body measurements.
function convertOldSportEntries(entries, makeId = createId) {
  const sessions = new Map();
  entries.filter((entry) => entry.kind === 'workout').forEach((entry) => {
    const session = sessions.get(entry.date)
      ?? { id: makeId('session'), date: entry.date, title: '', planned: null, exercises: [], finishedAt: null }; // planned: unknown
    const setCount = Math.min(Math.max(Math.round(Number(entry.sets) || 1), 1), 50);
    const weight = Number.isFinite(entry.weight) ? entry.weight : null;
    session.exercises.push({
      name: String(entry.exercise ?? ''),
      note: String(entry.note ?? ''),
      sets: Array.from({ length: setCount }, () => ({ reps: Number(entry.reps) || 0, weight, done: true }))
    });
    sessions.set(entry.date, session);
  });
  const body = entries.filter((entry) => entry.kind === 'body')
    .map(({ kind, goalId, value, note, ...measurement }) => measurement);
  return { sessions: [...sessions.values()], body };
}

// Runs on every page start. Old workouts and measurements are copied to lifeos_sport and only
// then removed from lifeos_progress (so they are never lost and never counted twice).
// An old backup (version 1) brings them back after an import — they are moved the same way.
function migrateSportData() {
  const entries = getProgressEntries();
  const isOld = (entry) => entry.kind === 'workout' || entry.kind === 'body';
  if (!entries.some(isOld)) return;
  const sport = getSport();
  const moved = convertOldSportEntries(entries.filter(isOld));
  sport.sessions.push(...moved.sessions);
  sport.body.push(...moved.body);
  if (!saveSport(sport)) return; // nothing is removed if the copy was not saved
  saveProgressEntries(entries.filter((entry) => !isOld(entry)));
}

/* ----- Workouts: statistics and records (pure) ----- */

function exerciseKey(name) {
  return String(name ?? '').trim().toLocaleLowerCase();
}

// Every finished set of the sessions: { exercise, reps, weight, date }
function finishedSets(sessions) {
  return sessions.flatMap((session) => asArray(session.exercises).flatMap((exercise) =>
    asArray(exercise.sets).filter((set) => set && set.done).map((set) => ({
      exercise: exercise.name,
      reps: Number(set.reps) || 0,
      weight: Number.isFinite(set.weight) ? set.weight : null,
      date: session.date
    }))));
}

// Training days, sets, reps and volume (reps × kg) between start and end.
function sportStats(sessions, start, end) {
  const inRange = sessions.filter((session) => {
    const date = Dates.parse(session.date);
    return date && date >= start && date <= end;
  });
  const sets = finishedSets(inRange);
  return {
    days: new Set(inRange.map((session) => session.date)).size,
    sets: sets.length,
    reps: sets.reduce((sum, set) => sum + set.reps, 0),
    volume: sets.reduce((sum, set) => sum + set.reps * (set.weight ?? 0), 0)
  };
}

// The best set of each exercise: the heaviest weight; the same weight -> more reps.
// For bodyweight exercises (no weight) that simply means the most reps.
function personalRecords(sessions) {
  const best = new Map();
  finishedSets(sessions).forEach((set) => {
    const key = exerciseKey(set.exercise);
    if (!key) return;
    const record = best.get(key);
    const weight = set.weight ?? 0;
    const isBetter = !record || weight > record.weight || (weight === record.weight && set.reps > record.reps);
    if (isBetter) best.set(key, { exercise: set.exercise, weight, reps: set.reps, date: set.date });
  });
  return [...best.values()].sort((a, b) => String(a.exercise).localeCompare(String(b.exercise)));
}

// Records that became better (an exercise done for the first time is not a "new record").
function improvedRecords(before, after) {
  const old = new Map(before.map((record) => [exerciseKey(record.exercise), record]));
  return after.filter((record) => {
    const previous = old.get(exerciseKey(record.exercise));
    return previous && (record.weight > previous.weight || (record.weight === previous.weight && record.reps > previous.reps));
  });
}

/* ----- Body measurements (pure) ----- */

// Every measurement: kg for weight, cm for the rest; min/max protect from typing mistakes.
const BODY_FIELDS = [
  { key: 'weight', unit: 'kg', min: 20, max: 400 },
  { key: 'waist', unit: 'cm', min: 10, max: 300 },
  { key: 'belly', unit: 'cm', min: 10, max: 300 },
  { key: 'chest', unit: 'cm', min: 10, max: 300 },
  { key: 'hips', unit: 'cm', min: 10, max: 300 },
  { key: 'biceps', unit: 'cm', min: 10, max: 300 },
  { key: 'thigh', unit: 'cm', min: 10, max: 300 },
  { key: 'calf', unit: 'cm', min: 10, max: 300 }
];

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

// Measurements sorted by date (the same date keeps the order of adding).
function sortBodyEntries(body) {
  return body
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => String(a.entry.date).localeCompare(String(b.entry.date)) || a.index - b.index)
    .map(({ entry }) => entry);
}

// Rows of the "Was / Now / Difference" table. diff is null if one of the values is missing.
function bodyDifference(from, to) {
  return BODY_FIELDS.map(({ key, unit }) => {
    const was = Number.isFinite(from?.[key]) ? from[key] : null;
    const now = Number.isFinite(to?.[key]) ? to[key] : null;
    return { key, unit, was, now, diff: was !== null && now !== null ? roundOne(now - was) : null };
  });
}

function weightSeries(bodyEntries) {
  return bodyEntries.filter((entry) => Number.isFinite(entry.weight)).map((entry) => ({ date: entry.date, value: entry.weight }));
}

/* ----- Today's workout: Dashboard and Planner show one line about it ----- */

function setsOf(exercises) {
  return asArray(exercises).flatMap((exercise) => asArray(exercise.sets));
}

// { state: "inProgress" | "done" | "planned" | "rest" | "none", title, done, total }
function sportDayInfo(dateValue, sport = getSport()) {
  const plan = planForDate(dateValue, sport);
  const current = sport.current?.date === dateValue ? sport.current : null;
  if (current) {
    const sets = setsOf(current.exercises);
    return { state: 'inProgress', title: current.title, done: sets.filter((set) => set.done).length, total: sets.length };
  }
  const finished = sport.sessions.filter((session) => session.date === dateValue);
  if (finished.length) return { state: 'done', title: finished[finished.length - 1].title };
  if (plan?.type === 'workout') return { state: 'planned', title: plan.title, total: asArray(plan.exercises).length };
  if (plan?.type === 'rest') return { state: 'rest' };
  return { state: 'none' };
}

// One line "Chest + triceps · 5 exercises → Open" for the day lists. Empty for a day without a plan.
function sportDayLineHtml(dateValue) {
  const info = sportDayInfo(dateValue);
  if (info.state === 'none') return '';
  const title = info.title || t('sport.session.untitled');
  const texts = {
    inProgress: t('sport.line.inProgress', { title, done: info.done, total: info.total }),
    done: t('sport.line.done', { title }),
    planned: t('sport.line.planned', { title, count: tPlural('sport.exercisesCount', info.total) }),
    rest: t('sport.line.rest')
  };
  const icons = { inProgress: 'bi-stopwatch', done: 'bi-check2-circle', planned: 'bi-heart-pulse', rest: 'bi-cup-hot' };
  return `
    <a class="sport-day-line is-${info.state}" href="sport.html?tab=${dateValue === Dates.toISO(Dates.today()) ? 'today' : 'plan'}">
      <i class="bi ${icons[info.state]}" aria-hidden="true"></i>
      <span>${escapeHtml(texts[info.state])}</span>
      <i class="bi bi-chevron-right ms-auto" aria-hidden="true"></i>
    </a>`;
}

// A finished workout counts in the active "Health" goals:
// +1 for a "Number" goal (e.g. 50 workouts), the day for a "Streak" goal.
function recordWorkoutInGoals(dateValue) {
  getGoals()
    .filter((goal) => goal.category === 'health' && goal.status === 'active')
    .forEach((goal) => {
      if (goal.progressType === 'number') recordProgress(goal.id, { date: dateValue, value: 1, note: t('sport.goalNote') });
      const dayMarked = getGoalEntries(goal.id).some((entry) => entry.date === dateValue);
      if (goal.progressType === 'streak' && !dayMarked) recordProgress(goal.id, { date: dateValue, value: 1 });
    });
}

/* =========================================================
   11c. Changing the history of a goal (Goal Details): delete with "Undo", edit an entry
   The pure functions take (goal, entries) and return new copies; nothing is saved there.
   - delete: money/number take the change back, other types count again from the entries left,
     a book entry gives the pages back to its book (undoBookEntry);
   - undo: the entry goes back to the same place in the list, the goal is counted again;
   - edit = delete + add as one operation: the entry keeps its id and its place.
   ========================================================= */

// A book list goal counts finished books: its entries change a book, never the counter directly.
function entryChangesBook(goal, entry) {
  return hasBookList(goal) && Boolean(entry.bookId);
}

// Puts `entry` at `index` of a copy of the list (or at the end if the list got shorter).
function insertedAt(entries, index, entry) {
  const list = [...entries];
  list.splice(Math.min(index, list.length), 0, entry);
  return list;
}

// The goal's current value counted from `list` after one entry changed by `change` (money/number).
function countedGoal(goal, list, change) {
  if (hasBookList(goal)) return { ...goal }; // the counter = finished books (replaceBook)
  const delta = DELTA_TYPES.includes(goal.progressType) ? change : 0;
  return { ...goal, currentValue: recalculateCurrentValue(goal, getGoalEntries(goal.id, list), delta) };
}

// Pure: delete. Returns { goal, entries, removed: { entry, index, book } } or null.
function withoutEntry(goal, entries, entryId) {
  const index = entries.findIndex((item) => item.id === entryId);
  if (index === -1) return null;
  const entry = entries[index];
  const rest = entries.filter((item) => item.id !== entryId);
  const updated = countedGoal(goal, rest, -(Number(entry.value) || 0));
  let book = null;
  if (entryChangesBook(goal, entry)) {
    book = goalBooks(goal).find((item) => item.id === entry.bookId) ?? null;
    const left = rest.filter((item) => item.bookId === entry.bookId);
    if (book) replaceBook(updated, undoBookEntry(book, entry, left));
  }
  return { goal: updated, entries: rest, removed: { entry, index, book } };
}

// Pure: "Undo" of a delete. Returns { goal, entries } or null (the book was deleted meanwhile).
function withEntryRestored(goal, entries, removed) {
  const { entry, index, book } = removed;
  const list = insertedAt(entries, index, entry);
  const updated = countedGoal(goal, list, Number(entry.value) || 0);
  if (book) {
    const now = goalBooks(goal).find((item) => item.id === book.id);
    if (!now) return null;
    replaceBook(updated, redoBookEntry(now, entry, book));
  }
  return { goal: updated, entries: list };
}

// pages: a number > 0 is kept, 0 / none removes the field (as in a new entry).
function withPages(entry, pages) {
  const { pages: oldPages, ...rest } = entry;
  return pages > 0 ? { ...rest, pages: Math.round(pages) } : rest;
}

// Pure: edit. fields = { date, note, value?, pages? }. A book list entry gets its pages again
// with readBookPages (it may finish the book now). Returns { goal, entries, entry } or null.
function withEntryChanged(goal, entries, entryId, fields) {
  const without = withoutEntry(goal, entries, entryId);
  if (!without) return null;
  const { entry: old, index } = without.removed;
  let changed = { ...old, date: fields.date, note: fields.note ?? '' };
  let updated;
  if (entryChangesBook(goal, old)) {
    const book = goalBooks(without.goal).find((item) => item.id === old.bookId);
    if (!book) return null;
    const result = readBookPages(book, { pages: Number(fields.pages) || 0 }, fields.date);
    changed = withPages({ ...changed, value: result.finished ? 1 : 0 }, result.added);
    updated = { ...without.goal };
    replaceBook(updated, result.book);
  } else {
    changed = withPages({ ...changed, value: fields.value ?? old.value }, Number(fields.pages) || 0);
    updated = countedGoal(without.goal, insertedAt(without.entries, index, changed), Number(changed.value) || 0);
  }
  return { goal: updated, entries: insertedAt(without.entries, index, changed), entry: changed };
}

// Saves the goal and the list from a pure change above. Returns the result or null.
function saveHistoryChange(result) {
  if (!result) return null;
  const goals = getGoals();
  const index = goals.findIndex((item) => item.id === result.goal.id);
  if (index === -1) return null;
  goals[index] = { ...result.goal, updatedAt: new Date().toISOString() };
  return saveProgressEntries(result.entries) && saveGoals(goals) ? result : null;
}

function deleteProgressEntry(goalId, entryId) {
  const goal = getGoalById(goalId);
  return goal ? saveHistoryChange(withoutEntry(goal, getProgressEntries(), entryId)) : null;
}

function restoreProgressEntry(goalId, removed) {
  const goal = getGoalById(goalId);
  return goal ? saveHistoryChange(withEntryRestored(goal, getProgressEntries(), removed)) : null;
}

function updateProgressEntry(goalId, entryId, fields) {
  const goal = getGoalById(goalId);
  return goal ? saveHistoryChange(withEntryChanged(goal, getProgressEntries(), entryId, fields)) : null;
}

/* =========================================================
   11d. Finishing a goal (Goal Details, Goals, Dashboard)
   - "Mark as completed" below 100 %: a question first (complete anyway / archive / cancel);
   - an entry that brings the goal to 100 % for the first time: "Goal reached! 🎉"
     (complete / raise the bar / later). goal.reachedShown = true: this question is asked only once.
   ========================================================= */

// Changes the status of a saved goal. Returns the goal or null.
function setGoalStatus(goalId, status) {
  const goals = getGoals();
  const goal = goals.find((item) => item.id === goalId);
  if (!goal) return null;
  goal.status = status;
  goal.updatedAt = new Date().toISOString();
  return saveGoals(goals) ? goal : null;
}

// Pure: does this change bring the goal to 100 % for the first time? (before / after: the goal objects)
function reachesGoalFirstTime(before, after) {
  return after.status === 'active' && after.reachedShown !== true
    && getGoalPercent(before) < 100 && getGoalPercent(after) >= 100;
}

// Pure: after the goal itself was edited ("Raise the bar" or any change in the wizard). If the goal is
// below 100 % again, "Goal reached! 🎉" may be shown again when the new target is reached.
function withReachedReset(goal) {
  if (goal.reachedShown !== true || getGoalPercent({ ...goal, status: 'active' }) >= 100) return goal;
  const { reachedShown, ...rest } = goal;
  return rest;
}

// The goal as the page shows it: a streak is counted from today's dates.
function liveGoal(goalId) {
  const goal = getGoalById(goalId);
  return goal ? withLiveStreak(goal, getProgressEntries()) : null;
}

const GOAL_FINISH_HTML = `
  <div class="modal fade" id="goal-finish-modal" tabindex="-1" aria-labelledby="goal-finish-title" aria-describedby="goal-finish-text">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="goal-finish-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body"><p class="mb-0" id="goal-finish-text"></p></div>
        <div class="modal-footer goal-finish-actions" id="goal-finish-actions"></div>
      </div>
    </div>
  </div>`;

const GoalFinish = {
  modalEl: null,

  ensureModal() {
    if (this.modalEl) return;
    document.body.insertAdjacentHTML('beforeend', GOAL_FINISH_HTML);
    this.modalEl = byId('goal-finish-modal');
    I18n.apply(this.modalEl);
  },

  // buttons: [{ key, primary?, focus?, action? }] — every button closes the dialog, then runs its action.
  // onDone runs when the dialog is closed (by any button, Esc or ×): the page redraws itself there.
  ask({ titleKey, textKey, params, buttons, onDone }) {
    this.ensureModal();
    byId('goal-finish-title').textContent = t(titleKey, params);
    byId('goal-finish-text').textContent = t(textKey, params); // the goal title is user data: textContent
    let chosen = null;
    byId('goal-finish-actions').replaceChildren(...buttons.map((button) => {
      const element = createEl('button', { type: 'button', class: `btn ${button.primary ? 'btn-primary' : 'btn-tool'}` }, t(button.key));
      element.addEventListener('click', () => {
        chosen = button.action ?? null;
        bootstrap.Modal.getInstance(this.modalEl).hide();
      });
      return element;
    }));
    const focusIndex = Math.max(buttons.findIndex((button) => button.focus), 0);
    this.modalEl.addEventListener('shown.bs.modal', () => byId('goal-finish-actions').children[focusIndex].focus(), { once: true });
    this.modalEl.addEventListener('hidden.bs.modal', () => {
      chosen?.();
      onDone?.();
    }, { once: true });
    bootstrap.Modal.getOrCreateInstance(this.modalEl).show();
  },

  // Saves the status and tells the open pages (Goals and the Dashboard redraw on "lifeos:goalschange").
  changeStatus(goalId, status, toastKey, toastType = 'success') {
    const goal = setGoalStatus(goalId, status);
    if (!goal) return;
    showToast(toastKey, toastType, { title: goal.title });
    document.dispatchEvent(new CustomEvent('lifeos:goalschange', { detail: { goalId } }));
  },

  // "Mark as completed". At 100 %: completed at once ("Well done!"); below: the question.
  // The safe "Cancel" has the focus first.
  askComplete(goal, onDone) {
    const percent = getGoalPercent(goal);
    if (percent >= 100) {
      this.changeStatus(goal.id, 'completed', 'toast.goalCompleted');
      onDone?.();
      return;
    }
    this.ask({
      titleKey: 'goalFinish.partial.title',
      textKey: 'goalFinish.partial.text',
      params: { percent: Format.number(percent / 100, { style: 'percent' }), title: goal.title },
      buttons: [
        { key: 'delete.cancel', focus: true },
        { key: 'goalFinish.partial.archive', action: () => this.changeStatus(goal.id, 'archived', 'toast.goalArchived') },
        { key: 'goalFinish.partial.complete', primary: true, action: () => this.changeStatus(goal.id, 'completed', 'toast.goalCompletedPartly', 'info') }
      ],
      onDone
    });
  },

  // After an entry or a ticked item: `before` = the goal before the change. Returns true if asked.
  afterEntry(before, onDone) {
    const goal = liveGoal(before.id);
    if (!goal || !reachesGoalFirstTime(before, goal)) return false;
    const goals = getGoals();
    const saved = goals.find((item) => item.id === goal.id);
    saved.reachedShown = true; // never asked again for this goal
    saveGoals(goals);
    this.ask({
      titleKey: 'goalFinish.reached.title',
      textKey: 'goalFinish.reached.text',
      params: { title: goal.title },
      buttons: [
        { key: 'goalFinish.reached.later' },
        // The wizard opens on the Goals page, on step 5 "Values and deadline".
        { key: 'goalFinish.reached.raise', action: () => { window.location.href = `goals.html#edit=${encodeURIComponent(goal.id)}&step=5`; } },
        { key: 'goalFinish.reached.complete', primary: true, focus: true, action: () => this.changeStatus(goal.id, 'completed', 'toast.goalCompleted') }
      ],
      onDone
    });
    return true;
  }
};

/* =========================================================
   12. Tasks — lifeos_tasks (used by Dashboard, Planner, Goal Details)
   Task: { id, title, date, priority, category, goalId, completed, completedAt,
           recurrence, period, completions }
   A repeating task is stored ONCE (a template). "date" is its first day;
   the days it was done are listed in completions: ["2026-11-10", ...].
   A one-time task uses completed / completedAt instead.
   ========================================================= */

const TASK_PRIORITIES = ['low', 'medium', 'high'];
const TASK_RECURRENCES = ['none', 'daily', 'weekdays', 'weekly'];
const TASK_PERIODS = ['day', 'week', 'month', 'quarter', 'year'];
const TASK_TITLE_MIN_LENGTH = 2;
const TASK_TITLE_MAX_LENGTH = 120;

function getTasks() {
  const tasks = AppStorage.get(STORAGE_KEYS.tasks, []);
  return Array.isArray(tasks) ? tasks.filter((task) => task && typeof task === 'object') : [];
}

function saveTasks(tasks) {
  return AppStorage.set(STORAGE_KEYS.tasks, tasks);
}

function isRecurringTask(task) {
  return TASK_RECURRENCES.includes(task.recurrence) && task.recurrence !== 'none';
}

// Does the task appear on this day? isoDate = "YYYY-MM-DD".
function taskOccursOn(task, isoDate) {
  const start = Dates.parse(task.date);
  const day = Dates.parse(isoDate);
  if (!start || !day) return false;
  if (!isRecurringTask(task)) return task.date === isoDate;
  if (day < start) return false; // a series starts on its first day
  const weekday = day.getDay(); // 0 = Sunday … 6 = Saturday
  if (task.recurrence === 'daily') return true;
  if (task.recurrence === 'weekdays') return weekday >= 1 && weekday <= 5;
  return weekday === start.getDay(); // weekly: the same weekday as the first day
}

function isTaskDoneOn(task, isoDate) {
  return isRecurringTask(task) ? asArray(task.completions).includes(isoDate) : Boolean(task.completed);
}

// Open tasks first, then high priority first, then by date and title.
function compareTaskOccurrences(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const priority = TASK_PRIORITIES.indexOf(b.task.priority) - TASK_PRIORITIES.indexOf(a.task.priority);
  if (priority !== 0) return priority;
  return a.date.localeCompare(b.date) || String(a.task.title).localeCompare(String(b.task.title));
}

// All tasks of one day as "occurrences": [{ task, date, done }].
function getTasksForDate(dateValue, tasks = getTasks()) {
  const day = Dates.parse(dateValue);
  if (!day) return [];
  const isoDate = Dates.toISO(day);
  return tasks
    .filter((task) => taskOccursOn(task, isoDate))
    .map((task) => ({ task, date: isoDate, done: isTaskDoneOn(task, isoDate) }))
    .sort(compareTaskOccurrences);
}

// The first day on or after `fromIso` when the task appears (a week is enough to find it).
function nextTaskDate(task, fromIso) {
  if (!isRecurringTask(task)) return task.date;
  const from = Dates.parse(task.date > fromIso ? task.date : fromIso);
  for (let offset = 0; offset < 7; offset++) {
    const iso = Dates.toISO(Dates.addDays(from, offset));
    if (taskOccursOn(task, iso)) return iso;
  }
  return task.date;
}

// Tasks linked to a goal: one-time tasks on their date, repeating ones on their next day from today.
function getTasksForGoal(goalId) {
  const today = Dates.toISO(Dates.today());
  return getTasks()
    .filter((task) => task.goalId === goalId)
    .map((task) => {
      const date = nextTaskDate(task, today);
      return { task, date, done: isTaskDoneOn(task, date) };
    })
    .sort(compareTaskOccurrences);
}

// Makes a clean task object: unknown values are replaced by defaults.
// The date must be "YYYY-MM-DD", otherwise it is null (such a task is dropped on import, settings.js).
function normalizeTask(fields) {
  return {
    id: cleanId(fields.id) ?? createId('task'),
    title: String(fields.title ?? '').trim(),
    date: isIsoDate(fields.date) ? fields.date : null,
    priority: TASK_PRIORITIES.includes(fields.priority) ? fields.priority : 'medium',
    category: fields.category in GOAL_CATEGORIES ? fields.category : null,
    goalId: cleanId(fields.goalId),
    completed: Boolean(fields.completed),
    completedAt: typeof fields.completedAt === 'string' && !Number.isNaN(Date.parse(fields.completedAt)) ? fields.completedAt : null,
    recurrence: TASK_RECURRENCES.includes(fields.recurrence) ? fields.recurrence : 'none',
    period: TASK_PERIODS.includes(fields.period) ? fields.period : 'day',
    completions: asArray(fields.completions).filter(isIsoDate)
  };
}

// Returns { title, date, goalId }: an error key or null for each field.
function validateTask(fields) {
  const title = String(fields.title ?? '').trim();
  let titleError = null;
  if (title === '') titleError = 'task.error.titleRequired';
  else if (title.length < TASK_TITLE_MIN_LENGTH || title.length > TASK_TITLE_MAX_LENGTH) titleError = 'task.error.titleLength';
  const goalError = fields.goalId && !getGoalById(fields.goalId) ? 'task.error.goalMissing' : null;
  return { title: titleError, date: validateDateValue(fields.date), goalId: goalError };
}

// Pure function (no storage): the task after ticking it on a day.
function toggledTask(task, isoDate, now = new Date()) {
  if (isRecurringTask(task)) {
    const completions = asArray(task.completions);
    const next = completions.includes(isoDate)
      ? completions.filter((day) => day !== isoDate)
      : [...completions, isoDate].sort();
    return { ...task, completions: next };
  }
  const completed = !task.completed;
  return { ...task, completed, completedAt: completed ? now.toISOString() : null };
}

// Reads all tasks, changes one with `change(task)` and saves. Returns the new task or null.
function changeTask(id, change) {
  const tasks = getTasks();
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return null;
  tasks[index] = change(tasks[index]);
  return saveTasks(tasks) ? tasks[index] : null;
}

function toggleTask(id, date) {
  const day = Dates.parse(date);
  return day ? changeTask(id, (task) => toggledTask(task, Dates.toISO(day))) : null;
}

function addTask(fields) {
  const task = normalizeTask({ ...fields, id: createId('task'), completed: false, completedAt: null, completions: [] });
  const tasks = getTasks();
  tasks.push(task);
  return saveTasks(tasks) ? task : null;
}

function updateTask(id, changes) {
  return changeTask(id, (task) => normalizeTask({ ...task, ...changes, id }));
}

function deleteTask(id) {
  const tasks = getTasks();
  const remaining = tasks.filter((task) => task.id !== id);
  return remaining.length < tasks.length && saveTasks(remaining);
}

// One-time task: a new day. Repeating task: the series starts on the new day.
function moveTask(id, newDate) {
  const day = Dates.parse(newDate);
  return day ? changeTask(id, (task) => ({ ...task, date: Dates.toISO(day) })) : null;
}

// When a goal is deleted, its tasks stay but lose the link.
function unlinkGoalFromTasks(goalId) {
  const tasks = getTasks();
  if (!tasks.some((task) => task.goalId === goalId)) return true;
  return saveTasks(tasks.map((task) => (task.goalId === goalId ? { ...task, goalId: null } : task)));
}

/* =========================================================
   13. Periods — shared by Planner and Progress (pure: no storage)
   week = ISO week (Monday–Sunday), month = calendar month,
   quarter and year = personal ones, counted from the personal year start.
   ========================================================= */

const PERIOD_LEVELS = ['year', 'quarter', 'month', 'week', 'today'];

// The personal year that contains `dateValue`. Without a start date the calendar year is used.
function personalYearStartFor(dateValue, yearStartValue) {
  const date = Dates.parse(dateValue);
  const base = Dates.parse(yearStartValue) ?? new Date(date.getFullYear(), 0, 1);
  let years = 0;
  while (date >= Dates.addMonths(base, 12 * (years + 1))) years++;
  while (date < Dates.addMonths(base, 12 * years)) years--;
  return Dates.addMonths(base, 12 * years);
}

// { start, end, key, number } of the period of `level` that contains `anchorValue`.
// number = quarter number (1–4) or ISO week number; key is used in lifeos_planner.
function getPeriodRange(level, anchorValue, yearStartValue) {
  const anchor = Dates.parse(anchorValue);
  if (level === 'year') {
    const start = personalYearStartFor(anchor, yearStartValue);
    return { start, end: Dates.addDays(Dates.addMonths(start, 12), -1), key: `year:${Dates.toISO(start)}` };
  }
  if (level === 'quarter') {
    const yearStart = personalYearStartFor(anchor, yearStartValue);
    const number = Math.ceil(Dates.monthNumber(yearStart, anchor) / 3);
    const start = Dates.addMonths(yearStart, 3 * (number - 1));
    const end = Dates.addDays(Dates.addMonths(yearStart, 3 * number), -1);
    return { start, end, key: `${Dates.toISO(yearStart)}:Q${number}`, number };
  }
  if (level === 'month') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { start, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0), key: Dates.monthKey(start) };
  }
  if (level === 'week') {
    const start = Dates.startOfWeek(anchor);
    return { start, end: Dates.addDays(start, 6), key: Dates.weekKey(start), number: Dates.isoWeek(start).week };
  }
  return { start: anchor, end: anchor, key: Dates.toISO(anchor) };
}

// "ноябрь 2026 г." -> "Ноябрь 2026 г."
function upperFirst(text) {
  return text.charAt(0).toLocaleUpperCase(I18n.locale()) + text.slice(1);
}

// "Week 46", "Quarter 2", "November 2026", "Personal year 2026–2027", "Wednesday, 11 November 2026"
function periodTitle(level, period) {
  if (level === 'year') return t('planner.yearTitle', { from: period.start.getFullYear(), to: period.end.getFullYear() });
  if (level === 'quarter') return t('planner.quarterTitle', { number: period.number });
  if (level === 'month') return upperFirst(Format.date(period.start, { month: 'long', year: 'numeric' }));
  if (level === 'week') return t('planner.weekTitle', { number: period.number });
  return upperFirst(`${Format.weekday(period.start, 'long')}, ${Format.date(period.start, { dateStyle: 'long' })}`);
}

// A goal row with icon, title link, progress bar and percent (Planner year, Progress).
// The title is escaped; color and icon are checked values.
function goalProgressRowHtml(goal, index, prefix) {
  const percent = getGoalPercent(goal);
  const titleId = `${prefix}-${index}`;
  return `
    <li class="plan-goal" data-color="${goalColor(goal)}">
      <span class="goal-icon" aria-hidden="true"><i class="bi ${goalIcon(goal)}"></i></span>
      <div class="plan-goal-body">
        <a class="plan-goal-title" id="${titleId}" href="goal-details.html?id=${escapeHtml(encodeURIComponent(goal.id))}">${escapeHtml(goal.title)}</a>
        <div class="progress" role="progressbar" aria-labelledby="${titleId}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width: ${percent}%"></div>
        </div>
      </div>
      <span class="plan-goal-percent">${escapeHtml(Format.number(percent / 100, { style: 'percent' }))}</span>
    </li>`;
}

// A date one period back (direction -1) or forward (+1).
function shiftPeriodAnchor(level, anchorValue, direction) {
  const anchor = Dates.parse(anchorValue);
  if (level === 'year') return Dates.addMonths(anchor, 12 * direction);
  if (level === 'quarter') return Dates.addMonths(anchor, 3 * direction);
  if (level === 'month') return Dates.addMonths(anchor, direction);
  if (level === 'week') return Dates.addDays(anchor, 7 * direction);
  return Dates.addDays(anchor, direction);
}

/* =========================================================
   14. Activity — what the user did on each day (pure)
   ========================================================= */

// All days on which a task was ticked (a repeating task: every ticked day).
function taskCompletionDates(tasks) {
  const dates = [];
  tasks.forEach((task) => {
    if (isRecurringTask(task)) dates.push(...asArray(task.completions));
    else if (task.completed && task.completedAt) dates.push(Dates.toISO(new Date(task.completedAt))); // local day
  });
  return dates;
}

// iso date -> number of actions that day: ticked tasks + progress entries (also workouts).
// sessions = finished workouts from lifeos_sport (each one is an action of its day).
function countActivityByDay(tasks, entries, sessions = []) {
  const counts = new Map();
  const add = (date) => {
    if (date) counts.set(date, (counts.get(date) ?? 0) + 1);
  };
  taskCompletionDates(tasks).forEach(add);
  entries.forEach((entry) => add(entry.date));
  sessions.forEach((session) => add(session.date));
  return counts;
}

// 5 levels of intensity: 0 (nothing) … 4 (6+ actions)
function activityLevel(count) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

// The longest run of days in a row (for habits).
function bestStreak(dates) {
  const days = [...new Set(dates)].filter((date) => Dates.parse(date)).sort();
  let best = 0;
  let run = 0;
  days.forEach((day, index) => {
    const isNextDay = index > 0 && Dates.daysBetween(Dates.parse(days[index - 1]), Dates.parse(day)) === 1;
    run = isNextDay ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/* =========================================================
   15. Planner plans — lifeos_planner: { "<period key>": { focus, goalIds } }
   Keys: week "2026-W46", month "2026-11",
         quarter "2026-09-01:Q2" (personal year start + quarter number).
   ========================================================= */

function getPlanner() {
  const planner = AppStorage.get(STORAGE_KEYS.planner, {});
  return planner && typeof planner === 'object' && !Array.isArray(planner) ? planner : {};
}

function getPeriodPlan(key) {
  const plan = getPlanner()[key];
  return plan && typeof plan === 'object' ? plan : {};
}

// Archive of finished personal years: [{ id, yearStart, yearEnd, archivedAt, stats, goals }]
function getArchive() {
  const archive = AppStorage.get(STORAGE_KEYS.archive, []);
  return Array.isArray(archive) ? archive.filter((year) => year && typeof year === 'object') : [];
}

function saveArchive(archive) {
  return AppStorage.set(STORAGE_KEYS.archive, archive);
}

function updatePeriodPlan(key, changes) {
  const planner = getPlanner();
  planner[key] = { ...getPeriodPlan(key), ...changes };
  return AppStorage.set(STORAGE_KEYS.planner, planner);
}

/* ----- Focus days: the days of a week when the user followed the focus (Dashboard and Planner, week level) -----
   Stored with the focus: lifeos_planner["2026-W46"].focusDays = ["2026-11-09", …] (sorted, no repeats).
   Changing the focus text keeps them (updatePeriodPlan merges); old weeks without the list simply have none. */

function getFocusDays(weekKey) {
  return [...new Set(asArray(getPeriodPlan(weekKey).focusDays).filter(isIsoDate))].sort();
}

// Pure: the list with the day added (or removed when it was there).
function toggledFocusDays(days, iso) {
  const set = new Set(days);
  if (set.has(iso)) set.delete(iso);
  else set.add(iso);
  return [...set].sort();
}

const FocusDays = {
  // The row of the 7 days of the week that starts on `weekStart` (Monday), the count and "Mark today".
  // idPrefix keeps the ids unique on the page ("dash", "week").
  html(weekStart, idPrefix) {
    const key = Dates.weekKey(weekStart);
    const marked = getFocusDays(key);
    const today = Dates.toISO(Dates.today());
    const days = Array.from({ length: 7 }, (_, index) => Dates.toISO(Dates.addDays(weekStart, index)));
    const buttons = days.map((iso, index) => this.dayHtml({ iso, index, key, idPrefix, isMarked: marked.includes(iso), today })).join('');
    const count = marked.filter((iso) => days.includes(iso)).length;
    return `
      <div class="focus-days">
        <h3 class="focus-days-title" id="${idPrefix}-focus-days-title">${escapeHtml(t('focusDays.title'))}</h3>
        <p class="focus-days-hint">${escapeHtml(t('focusDays.hint'))}</p>
        <div class="focus-days-row" role="group" aria-labelledby="${idPrefix}-focus-days-title">${buttons}</div>
        ${count === 7
          ? `<p class="focus-days-count is-perfect"><i class="bi bi-stars" aria-hidden="true"></i>${escapeHtml(t('focusDays.perfect'))}</p>`
          : `<p class="focus-days-count">${escapeHtml(tPlural('focusDays.count', 7, { done: Format.number(count) }))}</p>`}
        ${days.includes(today) ? this.todayButtonHtml(key, today, idPrefix, marked.includes(today)) : ''}
      </div>`;
  },

  // One day: a 44px button "✓ Mon". A future day cannot be marked yet (aria-disabled, not a real disabled:
  // it stays in the Tab order and says why).
  dayHtml({ iso, index, key, idPrefix, isMarked, today }) {
    const isFuture = iso > today;
    // "Monday, 9 November": the weekday from our texts (Intl leaves it out in Kazakh), the date from Intl
    const date = upperFirst(`${t(`weekday.long.${index + 1}`)}, ${Format.date(iso, { day: 'numeric', month: 'long' })}`);
    const stateKey = isFuture ? 'focusDays.future' : isMarked ? 'focusDays.marked' : 'focusDays.notMarked';
    const classes = ['focus-day', isMarked ? 'is-marked' : '', iso === today ? 'is-today' : '', isFuture ? 'is-future' : ''].filter(Boolean).join(' ');
    return `
      <button type="button" class="${classes}" id="${idPrefix}-focus-day-${iso}" data-focus-day="${iso}" data-focus-week="${escapeHtml(key)}"
              aria-pressed="${isMarked}" aria-label="${escapeHtml(t(stateKey, { date }))}"${isFuture ? ' aria-disabled="true"' : ''}>
        <i class="bi bi-check-lg" aria-hidden="true"></i><span aria-hidden="true">${escapeHtml(t(`weekday.short.${index + 1}`))}</span>
      </button>`;
  },

  // "✓ Mark today" (outline); when today is marked: "Today is marked ✓" — pressing it again unmarks it.
  todayButtonHtml(key, today, idPrefix, isMarked) {
    const label = isMarked
      ? `${escapeHtml(t('focusDays.todayMarked'))}<i class="bi bi-check-lg ms-2" aria-hidden="true"></i>`
      : `<i class="bi bi-check-lg me-2" aria-hidden="true"></i>${escapeHtml(t('focusDays.markToday'))}`;
    return `
      <button type="button" class="btn btn-tool focus-days-today${isMarked ? ' is-marked' : ''}" id="${idPrefix}-focus-today"
              data-focus-day="${today}" data-focus-week="${escapeHtml(key)}" aria-pressed="${isMarked}">${label}</button>`;
  },

  // One click listener per container: marks / unmarks the day, then onChange({ focusId }) redraws the page.
  bind(container, onChange) {
    container.addEventListener('click', (event) => {
      const button = event.target.closest('[data-focus-day]');
      if (!button || button.getAttribute('aria-disabled') === 'true') return;
      const key = button.dataset.focusWeek;
      if (!updatePeriodPlan(key, { focusDays: toggledFocusDays(getFocusDays(key), button.dataset.focusDay) })) return;
      onChange({ focusId: button.id });
    });
  }
};

/* =========================================================
   16. App start
   ========================================================= */

// Runs immediately, before <body> is drawn.
Theme.init();
migrateSportData(); // old workouts / measurements from lifeos_progress -> lifeos_sport (once)
migrateBookGoals(); // old "books" goals get a book list: N finished books without a title (once)
I18n.lang = savedLanguage();
document.documentElement.lang = I18n.lang;

// Resolves when the DOM is ready and translations are applied.
const appReady = new Promise((resolve) => {
  document.addEventListener('DOMContentLoaded', async () => {
    // jQuery animations ignore CSS, so turn them off for reduced motion here.
    if (window.jQuery && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      jQuery.fx.off = true;
    }
    getToastContainer();
    await I18n.load();
    // After load(): the calendar button needs t('date.pick') for its aria-label.
    InputMasks.init();
    I18n.apply();
    Layout.init();
    FirstRun.init();
    resolve();
  });
});

function onAppReady(callback) {
  appReady.then(callback);
}

/* =========================================================
   17. Self-test (dates, goal percent, progress, tasks, periods) — open any page with ?debug=1
   ========================================================= */

// History of a goal (section 11c): edit and "Undo" after a delete, for every kind of goal.
function runHistorySelfTest(check, book) {
  const day = (offset) => Dates.toISO(Dates.addDays(Dates.today(), offset));
  const entry = (id, date, value, extra = {}) => ({ id, goalId: 'g', date, value, note: '', ...extra });
  const ids = (list) => list.map((item) => item.id).join();

  // Money: +50 000, +20 000 = 70 000
  const money = { id: 'g', progressType: 'money', startValue: 0, currentValue: 70000 };
  const moneyEntries = [entry('a', day(-5), 50000), entry('b', day(-2), 20000)];
  check('edit: money +20 000 -> +30 000 = 80 000', withEntryChanged(money, moneyEntries, 'b', { date: day(-2), value: 30000 }).goal.currentValue, 80000);
  const moneyDeleted = withoutEntry(money, moneyEntries, 'a');
  check('delete: money −50 000', moneyDeleted.goal.currentValue, 20000);
  const moneyBack = withEntryRestored(moneyDeleted.goal, moneyDeleted.entries, moneyDeleted.removed);
  check('undo: money back to 70 000, same place', `${moneyBack.goal.currentValue} ${ids(moneyBack.entries)}`, '70000 a,b');

  // Percent: the latest entry wins; a date moved back changes which one is the latest
  const percent = { id: 'g', progressType: 'percent', startValue: 0, currentValue: 60 };
  const percentEntries = [entry('a', day(-5), 40), entry('b', day(-1), 60)];
  check('edit: date moved back -> the other entry is the latest (40 %)', withEntryChanged(percent, percentEntries, 'b', { date: day(-9), value: 60 }).goal.currentValue, 40);
  const percentDeleted = withoutEntry(percent, percentEntries, 'b');
  check('undo: percent 40 -> 60', `${percentDeleted.goal.currentValue}->${withEntryRestored(percentDeleted.goal, percentDeleted.entries, percentDeleted.removed).goal.currentValue}`, '40->60');

  // Weight (measurements): 90 kg, then 88 kg
  const weight = { id: 'g', progressType: 'measurements', startValue: 92, currentValue: 88 };
  const weightDeleted = withoutEntry(weight, [entry('a', day(-10), 90), entry('b', day(-1), 88)], 'b');
  check('undo: weight 90 -> 88', `${weightDeleted.goal.currentValue}->${withEntryRestored(weightDeleted.goal, weightDeleted.entries, weightDeleted.removed).goal.currentValue}`, '90->88');

  // Streak: today, yesterday, the day before = 3; deleting yesterday breaks it
  const streak = { id: 'g', progressType: 'streak', startValue: 0, currentValue: 3 };
  const streakDeleted = withoutEntry(streak, [entry('a', day(-2), 1), entry('b', day(-1), 1), entry('c', day(0), 1)], 'b');
  check('undo: streak 1 -> 3', `${streakDeleted.goal.currentValue}->${withEntryRestored(streakDeleted.goal, streakDeleted.entries, streakDeleted.removed).goal.currentValue}`, '1->3');

  // Book list: 60 + 40 pages finished a 100-page book
  const finished = book({ totalPages: 100, pagesRead: 100, status: 'done', startedAt: day(-6), finishedAt: day(-1) });
  const books = { id: 'g', category: 'books', progressType: 'number', bookList: true, books: [finished], currentValue: 1 };
  const bookEntries = [entry('a', day(-6), 0, { bookId: 'b1', pages: 60 }), entry('b', day(-1), 1, { bookId: 'b1', pages: 40 })];
  const bookDeleted = withoutEntry(books, bookEntries, 'b');
  check('delete: the finishing entry -> reading, 60 pages, 0 books', `${bookDeleted.goal.books[0].status} ${bookDeleted.goal.books[0].pagesRead} ${bookDeleted.goal.currentValue}`, 'reading 60 0');
  const bookBack = withEntryRestored(bookDeleted.goal, bookDeleted.entries, bookDeleted.removed).goal;
  check('undo: book done again, 100 pages, same date, 1 book', `${bookBack.books[0].status} ${bookBack.books[0].pagesRead} ${bookBack.books[0].finishedAt === day(-1)} ${bookBack.currentValue}`, 'done 100 true 1');
  const reading = { ...books, books: [book({ status: 'reading', pagesRead: 50, startedAt: day(-3) })], currentValue: 0 };
  const pagesEdit = withEntryChanged(reading, [entry('a', day(-3), 0, { bookId: 'b1', pages: 50 })], 'a', { date: day(-3), pages: 80 });
  check('edit: book pages 50 -> 80', `${pagesEdit.goal.books[0].pagesRead} ${pagesEdit.entry.pages}`, '80 80');

  // "Goal reached! 🎉" (section 11d): only the first time the goal gets to 100 %
  const count = (current, more = {}) => ({ id: 'g', progressType: 'number', status: 'active', startValue: 0, targetValue: 10, currentValue: current, ...more });
  check('reached: 9 -> 10 of 10 = asked', reachesGoalFirstTime(count(9), count(10)), true);
  check('reached: already asked once', reachesGoalFirstTime(count(9), count(10, { reachedShown: true })), false);
  check('reached: was already at 100 %', reachesGoalFirstTime(count(10), count(11)), false);
  check('reached: 8 -> 9 is not 100 %', reachesGoalFirstTime(count(8), count(9)), false);
  check('raise the bar 10 -> 20: asked again later', 'reachedShown' in withReachedReset(count(10, { reachedShown: true, targetValue: 20 })), false);
  check('an edit that stays at 100 %: still asked once', withReachedReset(count(10, { reachedShown: true, title: 'New' })).reachedShown, true);
  const raised = withReachedReset(count(10, { reachedShown: true, targetValue: 20 }));
  check('raised goal reaches 20: asked again', reachesGoalFirstTime(raised, { ...raised, currentValue: 20 }), true);
}

function runDateSelfTest() {
  const results = [];
  const check = (test, actual, expected) =>
    results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const iso = (date) => (date ? Dates.toISO(date) : null);

  check('parse keeps the same day (no UTC shift)', iso(Dates.parse('2026-03-01')), '2026-03-01');
  check('toISO uses the local date, not UTC', Dates.toISO(new Date(2026, 0, 1, 0, 30)), '2026-01-01');
  check('impossible date 2026-02-30 is rejected', Dates.parse('2026-02-30'), null);
  check('text that is not a date is rejected', Dates.parse('hello'), null);
  check('2 days across a daylight saving change', Dates.daysBetween(Dates.parse('2026-03-28'), Dates.parse('2026-03-30')), 2);
  check('Jan 31 + 1 month = Feb 28', iso(Dates.addMonths(Dates.parse('2026-01-31'), 1)), '2026-02-28');

  const leapYear = Dates.personalYear('2024-01-01', '2024-06-01');
  check('leap year has 366 days', leapYear.totalDays, 366);
  check('leap year ends on Dec 31', iso(leapYear.end), '2024-12-31');

  const year = Dates.personalYear('2026-09-01', '2026-11-10');
  check('Sep 1 -> Nov 10: end date', iso(year.end), '2027-08-31');
  check('Sep 1 -> Nov 10: days passed', year.daysPassed, 70);
  check('Sep 1 -> Nov 10: month', year.month, 3);
  check('Sep 1 -> Nov 10: quarter', year.quarter, 1);
  check('Sep 1 -> Nov 10: week', year.week, 11);
  check('Sep 1 -> Nov 10: percent', year.percent, 19.2);
  check('Sep 1 -> Nov 10: status', year.status, 'active');

  check('start Jan 31, on Mar 1 it is month 2', Dates.personalYear('2026-01-31', '2026-03-01').month, 2);
  check('last day of the year is week 53', Dates.personalYear('2026-01-01', '2026-12-31').week, 53);
  check('last day of the year is quarter 4', Dates.personalYear('2026-01-01', '2026-12-31').quarter, 4);
  check('year not started yet: 0%', Dates.personalYear('2027-01-01', '2026-11-10').percent, 0);
  check('year not started yet: status', Dates.personalYear('2027-01-01', '2026-11-10').status, 'upcoming');
  check('year already over: 100%', Dates.personalYear('2025-01-01', '2026-11-10').percent, 100);
  check('deadline in 10 days', Dates.daysUntil('2026-11-20', '2026-11-10'), 10);
  check('overdue deadline is negative', Dates.daysUntil('2026-11-01', '2026-11-10'), -9);

  // Intl puts non-breaking spaces into numbers; compare with plain spaces.
  const plain = (text) => text.replace(/\s/g, ' ');
  check('ru money uses ₸', plain(Format.money(10000000, 'KZT', 'ru')), '10 000 000 ₸');
  if (!KK_INTL_SUPPORTED) {
    check('kk fallback: long date', Format.date('2026-11-10', { dateStyle: 'long' }, 'kk'), '10 қараша 2026');
    check('kk fallback: month and year', Format.date('2026-11-10', { month: 'long', year: 'numeric' }, 'kk'), 'қараша 2026');
    check('kk fallback: numeric date', Format.date('2026-11-10', { dateStyle: 'short' }, 'kk'), '10.11.2026');
    check('kk fallback: money', plain(Format.money(10000000, 'KZT', 'kk')), '10 000 000 ₸');
  }

  const goal = (fields) => ({ status: 'active', startValue: 0, ...fields });
  check('percent: money 3.2M of 10M', getGoalPercent(goal({ progressType: 'money', targetValue: 10000000, currentValue: 3200000 })), 32);
  check('percent: weight 92 -> 80, now 86', getGoalPercent(goal({ progressType: 'measurements', startValue: 92, targetValue: 80, currentValue: 86 })), 50);
  check('percent: weight went up = 0', getGoalPercent(goal({ progressType: 'measurements', startValue: 92, targetValue: 80, currentValue: 95 })), 0);
  check('percent: target passed = 100', getGoalPercent(goal({ progressType: 'number', targetValue: 13, currentValue: 15 })), 100);
  check('percent: 99.6% shows 99', getGoalPercent(goal({ progressType: 'number', targetValue: 1000, currentValue: 996 })), 99);
  check('percent: no float error (29 of 100)', getGoalPercent(goal({ progressType: 'number', targetValue: 100, currentValue: 29 })), 29);
  check('percent: levels A2 -> C1, now B1', getGoalPercent(goal({ progressType: 'levels', levels: ['A2', 'B1', 'B2', 'C1'], targetValue: 3, currentValue: 1 })), 33);
  check('percent: checklist 1 of 3', getGoalPercent(goal({ progressType: 'checklist', checklist: [{ done: true }, { done: false }, { done: false }] })), 33);
  check('percent: empty checklist = 0', getGoalPercent(goal({ progressType: 'checklist', checklist: [] })), 0);
  check('percent: completed = 100', getGoalPercent(goal({ progressType: 'number', targetValue: 10, currentValue: 2, status: 'completed' })), 100);
  check('percent: broken numbers = 0', getGoalPercent(goal({ progressType: 'number', targetValue: 'abc', currentValue: null })), 0);

  const today = '2026-11-10';
  check('streak: today + 2 days before = 3', calculateStreak(['2026-11-10', '2026-11-09', '2026-11-08'], today), 3);
  check('streak: today not marked yet, still alive', calculateStreak(['2026-11-09', '2026-11-08'], today), 2);
  check('streak: yesterday missed = 0', calculateStreak(['2026-11-08', '2026-11-07'], today), 0);
  check('streak: a gap stops counting', calculateStreak(['2026-11-10', '2026-11-08'], today), 1);
  check('recalc: money +50 000', recalculateCurrentValue(goal({ progressType: 'money', currentValue: 100000 }), [], 50000), 150000);
  check('recalc: no float error 0.1 + 0.2', recalculateCurrentValue(goal({ progressType: 'number', currentValue: 0.1 }), [], 0.2), 0.3);
  check('recalc: weight = latest entry', recalculateCurrentValue(goal({ progressType: 'measurements', startValue: 92 }), [{ value: 86.5 }, { value: 88 }]), 86.5);
  check('recalc: weight, no entries = start', recalculateCurrentValue(goal({ progressType: 'measurements', startValue: 92 }), []), 92);
  // Book shelf
  const book = (fields) => ({ id: 'b1', title: 'A', author: '', totalPages: 300, pagesRead: 0, status: 'planned', startedAt: null, finishedAt: null, ...fields });
  const read1 = readBookPages(book(), { pages: 120 }, '2026-11-10');
  check('books: first pages -> reading', `${read1.book.status} ${read1.book.pagesRead} ${read1.book.startedAt}`, 'reading 120 2026-11-10');
  const read2 = readBookPages(book({ status: 'reading', pagesRead: 250 }), { pages: 100 }, '2026-11-12');
  check('books: pages stop at the page count, the book is done', `${read2.book.status} ${read2.book.pagesRead} +${read2.added} ${read2.finished}`, 'done 300 +50 true');
  check('books: "up to page 200"', readBookPages(book({ status: 'reading', pagesRead: 120 }), { toPage: 200 }, '2026-11-12').added, 80);
  check('books: no page count -> never done by pages', readBookPages(book({ totalPages: null }), { pages: 999 }, '2026-11-12').book.status, 'reading');
  check('books: "mark as read" adds the rest', finishBook(book({ status: 'reading', pagesRead: 100 }), '2026-11-12').added, 200);
  const undone = undoBookEntry(book({ status: 'done', pagesRead: 300 }), { pages: 50, value: 1 }, [{}]);
  check('books: deleting the finishing entry -> reading', `${undone.status} ${undone.pagesRead}`, 'reading 250');
  check('books: deleting the only entry -> want to read', undoBookEntry(book({ status: 'reading', pagesRead: 40 }), { pages: 40, value: 0 }, []).status, 'planned');
  runHistorySelfTest(check, book);
  const old = migrateBookGoal(goal({ category: 'books', progressType: 'number', currentValue: 3, targetValue: 13 }));
  check('books: an old goal of 3 books -> 3 finished untitled books', `${old.bookList} ${old.books.length} ${countDoneBooks(old.books)} ${old.currentValue} "${old.books[0].title}"`, 'true 3 3 3 ""');
  check('books: migration ids are unique', new Set(untitledDoneBooks(400).map((item) => item.id)).size, 400);
  check('books: a goal with bookList is not migrated again', migrateBookGoal({ ...old, books: [] }).books.length, 0);
  const shelf = { targetValue: 13, deadline: '2026-11-30', books: [book({ status: 'done', pagesRead: 300 }), book({ id: 'b2', status: 'done', totalPages: 500, pagesRead: 500 }), book({ id: 'b3', status: 'reading', totalPages: null, pagesRead: 120 })] };
  const stats = bookShelfStats(shelf, new Date(2026, 10, 21));
  check('books: shelf 2 of 13, 920 pages, 11 × 400 pages / 10 days', `${stats.done}/${stats.target} ${stats.pages} ${stats.perDay}`, '2/13 920 440');
  check('books: no deadline -> no pace', bookShelfStats({ ...shelf, deadline: null }).perDay, null);
  const listGoal = goal({ category: 'books', progressType: 'number', bookList: true, unit: 'книг', currentValue: 1, targetValue: 13 });
  check('books: a list goal counts books with plurals', formatGoalValue(listGoal, 2), tPlural('books.count', 2));
  check('books: "1 / 13 books" with the plural of 13', formatGoalProgress(listGoal), `${Format.number(1)} / ${tPlural('books.count', 13)}`);
  check('books: the number after "of" has its own forms', bookCountOfText(21), tPlural('books.countOf', 21, { count: Format.number(21) }));
  check('books: other goals keep their own unit', formatGoalValue(goal({ progressType: 'number', unit: 'km' }), 5), `${Format.number(5)} km`);
  check('books: old entries without a book add their pages', bookShelfStats(shelf, new Date(2026, 10, 21), [{ pages: 80 }, { pages: 40, bookId: 'b1' }]).pages, 1000);
  // Focus days
  check('focus days: a day is added in date order', toggledFocusDays(['2026-11-11'], '2026-11-09').join(), '2026-11-09,2026-11-11');
  check('focus days: a marked day is removed', toggledFocusDays(['2026-11-09', '2026-11-11'], '2026-11-09').join(), '2026-11-11');
  const sample = [
    { id: 'a', goalId: 'g', date: '2026-11-01' },
    { id: 'b', goalId: 'g', date: '2026-11-05' },
    { id: 'x', goalId: 'other', date: '2026-11-09' },
    { id: 'c', goalId: 'g', date: '2026-11-05' }
  ];
  check('entries: newest first, later added first', getGoalEntries('g', sample).map((entry) => entry.id).join(','), 'c,b,a');

  // 2026-11-10 is a Tuesday
  const task = (fields) => normalizeTask({ title: 'Task', date: '2026-11-10', ...fields });
  check('task: one-time only on its day', taskOccursOn(task({}), '2026-11-10') && !taskOccursOn(task({}), '2026-11-11'), true);
  check('task: daily not before the start', taskOccursOn(task({ recurrence: 'daily' }), '2026-11-09'), false);
  check('task: daily on a later day', taskOccursOn(task({ recurrence: 'daily' }), '2026-12-25'), true);
  check('task: weekdays skip Saturday', taskOccursOn(task({ recurrence: 'weekdays' }), '2026-11-14'), false);
  check('task: weekdays on Friday', taskOccursOn(task({ recurrence: 'weekdays' }), '2026-11-13'), true);
  check('task: weekly on the same weekday', taskOccursOn(task({ recurrence: 'weekly' }), '2026-11-17'), true);
  check('task: weekly not on another day', taskOccursOn(task({ recurrence: 'weekly' }), '2026-11-18'), false);
  const ticked = toggledTask(task({ recurrence: 'daily' }), '2026-11-12');
  check('task: repeating tick = one date in completions', ticked.completions.join(','), '2026-11-12');
  check('task: other days stay open', isTaskDoneOn(ticked, '2026-11-13'), false);
  check('task: tick again removes the date', toggledTask(ticked, '2026-11-12').completions.length, 0);
  check('task: one-time tick sets completedAt', Boolean(toggledTask(task({}), '2026-11-10').completedAt), true);
  check('task: unknown priority -> medium', task({ priority: 'urgent' }).priority, 'medium');
  check('week: 2026-11-11 is 2026-W46', Dates.weekKey('2026-11-11'), '2026-W46');
  check('week: Monday start', Dates.toISO(Dates.startOfWeek('2026-11-15')), '2026-11-09');
  check('week: 1 Jan 2027 is in 2026-W53', Dates.weekKey('2027-01-01'), '2026-W53');
  check('week: 30 Dec 2024 is in 2025-W01', Dates.weekKey('2024-12-30'), '2025-W01');
  check('month key', Dates.monthKey('2026-11-30'), '2026-11');
  check('period: personal quarter 2 from 1 Sep', Dates.toISO(getPeriodRange('quarter', '2026-12-15', '2026-09-01').start), '2026-12-01');
  check('period: personal year before its start', Dates.toISO(getPeriodRange('year', '2026-08-31', '2026-09-01').start), '2025-09-01');
  check('period: month end', Dates.toISO(getPeriodRange('month', '2026-02-10').end), '2026-02-28');
  check('period: previous week', Dates.toISO(shiftPeriodAnchor('week', '2026-11-11', -1)), '2026-11-04');
  check('best streak', bestStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']), 3);
  check('best streak: duplicates count once', bestStreak(['2026-11-01', '2026-11-01', '2026-11-02']), 2);
  check('activity level 6 = 4', activityLevel(6), 4);
  check('versions: 1.10.0 > 1.9.2, 1.1 = 1.1.0', `${compareVersions('1.10.0', '1.9.2')}/${compareVersions('1.1', '1.1.0')}/${compareVersions('1.0.9', '1.1.0')}`, '1/0/-1');

  // Input masks: numbers
  check('number: "1 000 000,5" (ru)', parseNumber('1\u00A0000\u00A0000,5', 'ru'), 1000000.5);
  check('number: "1,000,000.5" (en)', parseNumber('1,000,000.5', 'en'), 1000000.5);
  check('number: "82,5" in English = 82.5', parseNumber('82,5', 'en'), 82.5);
  check('number: "1,000" en = 1000, ru = 1', `${parseNumber('1,000', 'en')}/${parseNumber('1,000', 'ru')}`, '1000/1');
  check('number: empty and text -> NaN', `${parseNumber('', 'ru')}/${parseNumber('12a', 'ru')}`, 'NaN/NaN');
  check('number typing: 1000000 (ru)', formatNumberTyping('1000000', { lang: 'ru' }), '1\u00A0000\u00A0000');
  check('number typing: 1000000.5 (en)', formatNumberTyping('1000000.5', { lang: 'en' }), '1,000,000.5');
  check('number typing: whole numbers drop the mark', formatNumberTyping('12,5', { lang: 'ru', decimals: 0 }), '125');
  check('number typing: 2 digits after the mark', formatNumberTyping('3,14159', { lang: 'ru' }), '3,14');
  check('number from data: 82.5 ru / en', `${formatNumberValue(82.5, { lang: 'ru' })}|${formatNumberValue(82.5, { lang: 'en' })}`, '82,5|82.5');
  check('language switch: ru text -> en text', formatNumberValue(parseNumber('1\u00A0500,25', 'ru'), { lang: 'en' }), '1,500.25');
  check('number typing: a minus is found ("-" and "\u2212") before the mask drops it', `${hasMinus('-500')}/${hasMinus('\u22125')}/${hasMinus('500')}`, 'true/true/false');
  check('number typing: the mask drops the minus', formatNumberTyping('\u2212500', { lang: 'ru' }), '500');
  // Input masks: dates
  check('date typing: 1501 -> 15.01', formatDateDigits('1501'), '15.01');
  check('date typing: 15 -> "15." while typing', formatDateDigits('15', true), '15.');
  check('date typing: 8 digits', formatDateDigits('15012027'), '15.01.2027');
  check('date paste: 15012027 / 15/01/2027 / 2027-01-15',
    [normalizeDateText('15012027'), normalizeDateText('15/01/2027'), normalizeDateText('2027-01-15')].join(' '), '15.01.2027 15.01.2027 15.01.2027');
  check('date paste: 5-1-2027 gets zeros', normalizeDateText('5-1-2027'), '05.01.2027');
  check('date: 31.02 is not a date', dateTextToIso('31.02.2027'), null);
  check('date: text <-> ISO', `${dateTextToIso('29.02.2028')}|${isoToDateText('2027-01-15')}`, '2028-02-29|15.01.2027');

  console.group('[LifeOS] Self-test: dates and goal percent');
  console.table(results);
  console.log(`Kazakh Intl data in this browser: ${KK_INTL_SUPPORTED ? 'yes' : 'no (using fallback)'}`);
  console.log('Intl examples (spaces may differ between browsers):');
  LANGUAGES.forEach((lang) => {
    console.log(`  ${lang}: ${Format.date('2026-11-10', { dateStyle: 'long' }, lang)} | ${Format.money(10000000, 'KZT', lang)}`);
  });
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} tests failed`);
  else console.info(`All ${results.length} tests passed`);
  console.groupEnd();
}

if (new URLSearchParams(window.location.search).get('debug') === '1') {
  onAppReady(runDateSelfTest);
}
