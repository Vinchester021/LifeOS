// LifeOS — Settings (settings.html), concept sections 9–10.
// Profile, appearance, and data: export / import JSON, yearly CSV report, reset.
// Part 1 = PURE functions (backup, file check, CSV) — checked by settings.html?debug=1.
// Part 2 = the page.
'use strict';

const BACKUP_APP = 'LifeOS';
// Version 2 adds lifeos_sport. Version 1 files are still accepted: their workouts and
// measurements (in "progress") are moved to Sport after the import (migrateSportData in app.js).
const BACKUP_VERSION = 2;
// Every storage key goes into the backup; the type is what the file must contain for it.
const BACKUP_KEYS = {
  profile: 'object',
  goals: 'array',
  tasks: 'array',
  planner: 'object',
  progress: 'array',
  quotes: 'object',
  settings: 'object',
  archive: 'array', // finished personal years (step 15)
  sport: 'object' // week plan, workouts, body measurements
};

/* =========================================================
   Part 1. Pure functions
   ========================================================= */

// "2026-11-11" -> "lifeos-backup-2026-11-11.json"
function backupFileName(isoDate) {
  return `lifeos-backup-${isoDate}.json`;
}

// The backup object: { app, version, exportedAt, data: { profile, goals, ... } }.
// `snapshot` = the values read from storage (key without "lifeos_" -> value).
function buildBackup(snapshot, now = new Date()) {
  const data = {};
  Object.keys(BACKUP_KEYS).forEach((key) => {
    data[key] = snapshot[key] ?? null;
  });
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

// Checks a parsed file. Returns { ok, error, summary }; error is a translation key.
// Nothing is written here: the file is only looked at.
function validateBackup(backup) {
  const fail = (error) => ({ ok: false, error, summary: null });
  if (!isPlainObject(backup) || backup.app !== BACKUP_APP) return fail('settings.import.error.notLifeos');
  if (!Number.isInteger(backup.version) || backup.version < 1 || backup.version > BACKUP_VERSION) return fail('settings.import.error.version');
  if (!isPlainObject(backup.data)) return fail('settings.import.error.structure');

  for (const [key, type] of Object.entries(BACKUP_KEYS)) {
    const value = backup.data[key];
    if (value === null || value === undefined) continue; // a missing part = empty
    const isRightType = type === 'array' ? Array.isArray(value) : isPlainObject(value);
    if (!isRightType) return fail('settings.import.error.structure');
  }
  const { profile, goals = [], tasks = [], progress = [] } = backup.data;
  if (profile && (typeof profile.name !== 'string' || !Dates.parse(profile.personalYearStart))) return fail('settings.import.error.profile');
  const goalsOk = (goals ?? []).every((goal) => isPlainObject(goal) && typeof goal.id === 'string' && typeof goal.title === 'string');
  const tasksOk = (tasks ?? []).every((task) => isPlainObject(task) && typeof task.id === 'string' && typeof task.title === 'string');
  const entriesOk = (progress ?? []).every((entry) => isPlainObject(entry) && typeof entry.date === 'string');
  const archiveOk = (backup.data.archive ?? []).every((year) => isPlainObject(year) && typeof year.yearStart === 'string');
  if (!archiveOk || !isSportBackupOk(backup.data.sport)) return fail('settings.import.error.structure');
  if (!goalsOk) return fail('settings.import.error.goals');
  if (!tasksOk) return fail('settings.import.error.tasks');
  if (!entriesOk) return fail('settings.import.error.progress');

  return {
    ok: true,
    error: null,
    summary: { goals: (goals ?? []).length, tasks: (tasks ?? []).length, entries: (progress ?? []).length, name: profile?.name ?? null }
  };
}

/* ----- Cleaning an imported file (pure): nothing broken or dangerous is written ----- */

// A number from a file, or the fallback when it is missing or not a number.
function cleanNumber(value, fallback = 0) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) ? number : fallback;
}

function isoOrNull(value) {
  return isIsoDate(value) ? value : null;
}

// Numbers stay numbers only where they are present (a checklist goal has no start / target values).
function cleanNumbers(object, keys, fallback = 0) {
  const clean = { ...object };
  keys.filter((key) => key in object).forEach((key) => {
    clean[key] = object[key] === null ? null : cleanNumber(object[key], fallback);
  });
  return clean;
}

function cleanGoal(goal) {
  const clean = cleanNumbers(goal, ['startValue', 'targetValue', 'currentValue']);
  clean.title = String(goal.title ?? '');
  if ('deadline' in goal) clean.deadline = isoOrNull(goal.deadline);
  if ('unit' in goal) clean.unit = String(goal.unit ?? '');
  if ('levels' in goal) clean.levels = asArray(goal.levels).map((level) => String(level));
  clean.milestones = asArray(goal.milestones).filter(isPlainObject).map((milestone) => ({
    ...milestone,
    id: cleanId(milestone.id) ?? createId('milestone'),
    title: String(milestone.title ?? ''),
    dueDate: isoOrNull(milestone.dueDate),
    done: Boolean(milestone.done),
    doneAt: isoOrNull(milestone.doneAt)
  }));
  if ('checklist' in goal) {
    clean.checklist = asArray(goal.checklist).filter(isPlainObject).map((item) => ({
      ...item, id: cleanId(item.id) ?? createId('item'), text: String(item.text ?? ''), done: Boolean(item.done)
    }));
  }
  return clean;
}

function cleanEntry(entry) {
  const clean = cleanNumbers(entry, ['value', 'pages']);
  clean.id = cleanId(entry.id) ?? createId('entry');
  if ('goalId' in entry) clean.goalId = cleanId(entry.goalId);
  if ('note' in entry) clean.note = String(entry.note ?? '');
  return clean;
}

function cleanYear(year) {
  const stats = isPlainObject(year.stats) ? year.stats : {};
  return {
    ...year,
    id: cleanId(year.id) ?? createId('year'),
    stats: cleanNumbers(stats, Object.keys(stats)),
    goals: asArray(year.goals).filter(isPlainObject).map((goal) => ({ ...cleanNumbers(goal, ['percent', 'startValue', 'currentValue', 'targetValue']), title: String(goal.title ?? '') }))
  };
}

function cleanExercise(exercise) {
  const clean = cleanNumbers(exercise, ['reps', 'weight'], null);
  clean.name = String(exercise.name ?? '');
  if (Array.isArray(exercise.sets)) {
    clean.sets = exercise.sets.filter(isPlainObject).map((set) => ({ ...cleanNumbers(set, ['reps', 'weight'], null), done: Boolean(set.done) }));
  } else if ('sets' in exercise) {
    clean.sets = cleanNumber(exercise.sets, 1); // the plan keeps a number of sets
  }
  return clean;
}

function cleanSport(sport, keep) {
  const clean = { ...sport };
  if (isPlainObject(sport.plan)) {
    clean.plan = Object.fromEntries(Object.entries(sport.plan).filter(([, day]) => isPlainObject(day)).map(([key, day]) => [key, {
      ...day, title: String(day.title ?? ''), exercises: asArray(day.exercises).filter(isPlainObject).map(cleanExercise)
    }]));
  }
  if (Array.isArray(sport.sessions)) {
    clean.sessions = keep(sport.sessions, (session) => isIsoDate(session.date)).map((session) => ({
      ...session, id: cleanId(session.id) ?? createId('session'), title: String(session.title ?? ''),
      exercises: asArray(session.exercises).filter(isPlainObject).map(cleanExercise)
    }));
  }
  if (Array.isArray(sport.body)) {
    clean.body = keep(sport.body, (entry) => isIsoDate(entry.date)).map((entry) => {
      const body = { ...entry, id: cleanId(entry.id) ?? createId('body') };
      BODY_FIELDS.forEach(({ key }) => {
        if (key in entry && !Number.isFinite(entry[key])) delete body[key]; // not a number = not measured
      });
      return body;
    });
  }
  if ('current' in sport && !(isPlainObject(sport.current) && isIsoDate(sport.current.date))) clean.current = null;
  return clean;
}

// Cleans a checked backup before it is written: dates must be "YYYY-MM-DD", ids strings, numbers numbers.
// Records with a broken date (tasks, results, workouts, measurements, past years) are dropped;
// a broken deadline or milestone date becomes null. Returns { data, skipped }.
function sanitizeBackup(data) {
  let skipped = 0;
  const keep = (list, isOk) => list.filter((item) => {
    const ok = isPlainObject(item) && isOk(item);
    if (!ok) skipped += 1;
    return ok;
  });
  const clean = { ...data };
  if (Array.isArray(data.goals)) clean.goals = keep(data.goals, (goal) => cleanId(goal.id)).map(cleanGoal);
  if (Array.isArray(data.tasks)) clean.tasks = keep(data.tasks, (task) => cleanId(task.id) && isIsoDate(task.date)).map(normalizeTask);
  if (Array.isArray(data.progress)) clean.progress = keep(data.progress, (entry) => isIsoDate(entry.date)).map(cleanEntry);
  if (Array.isArray(data.archive)) clean.archive = keep(data.archive, (year) => isIsoDate(year.yearStart) && isIsoDate(year.yearEnd)).map(cleanYear);
  if (isPlainObject(data.sport)) clean.sport = cleanSport(data.sport, keep);
  return { data: clean, skipped };
}

// lifeos_sport in a file: the plan is an object, workouts and measurements are lists with dates.
function isSportBackupOk(sport) {
  if (sport === null || sport === undefined) return true;
  const hasDate = (item) => isPlainObject(item) && typeof item.date === 'string';
  const listOk = (list) => list === undefined || (Array.isArray(list) && list.every(hasDate));
  const planOk = sport.plan === undefined || isPlainObject(sport.plan);
  const currentOk = sport.current === undefined || sport.current === null || hasDate(sport.current);
  return planOk && currentOk && listOk(sport.sessions) && listOk(sport.body);
}

// One CSV cell. Text with the separator, quotes or line breaks goes in quotes.
// A cell that starts with = + - @ is made safe, so Excel does not run it as a formula.
function csvCell(value, separator) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text)) text = `'${text}`;
  return /["\n\r]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text;
}

// A UTF-8 file with a BOM at the start: Excel then shows Cyrillic and Kazakh letters correctly.
function buildCsv(rows, separator) {
  return '﻿' + rows.map((row) => row.map((cell) => csvCell(cell, separator)).join(separator)).join('\r\n');
}

// "86.5" -> "86,5" for ru/kk Excel (where the decimal mark is a comma).
function csvNumber(value, decimalMark) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return String(Math.round(number * 100) / 100).replace('.', decimalMark);
}

// One row per goal: title, category, type, start / current / target, unit, %, status, deadline, tasks.
// `labels` translates categories, types and statuses (passed in, so this stays pure).
function goalReportRows(goals, tasks, labels, decimalMark) {
  return goals.map((goal) => {
    const linked = tasks.filter((task) => task.goalId === goal.id);
    const done = linked.filter((task) => (isRecurringTask(task) ? asArray(task.completions).length > 0 : task.completed)).length;
    const level = (index) => asArray(goal.levels)[index] ?? '';
    const isLevels = goal.progressType === 'levels';
    return [
      goal.title,
      labels.category(goal.category),
      labels.type(goal.progressType),
      isLevels ? level(goal.startValue) : csvNumber(goal.startValue, decimalMark),
      isLevels ? level(goal.currentValue) : csvNumber(goal.currentValue, decimalMark),
      isLevels ? level(goal.targetValue) : csvNumber(goal.targetValue, decimalMark),
      goal.unit ?? '',
      getGoalPercent(goal),
      labels.status(goal.status),
      goal.deadline ?? '',
      linked.length,
      done
    ];
  });
}

// Reset is allowed only when the typed name is the profile name (spaces and letter case do not matter).
function isResetNameCorrect(typed, profileName) {
  const clean = (text) => String(text ?? '').trim().toLocaleLowerCase();
  return clean(typed) !== '' && clean(typed) === clean(profileName);
}

/* =========================================================
   Part 2. The page
   ========================================================= */

let pendingImport = null; // a checked backup waiting for confirmation

// Saves a file on the user's computer (a temporary link with "download").
function downloadFile(fileName, content, mimeType) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = createEl('a', { href: url, download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readStorageSnapshot() {
  const snapshot = {};
  Object.keys(BACKUP_KEYS).forEach((key) => {
    snapshot[key] = AppStorage.get(STORAGE_KEYS[key], null);
  });
  return snapshot;
}

/* ----- Profile ----- */

function fillProfileForm() {
  const profile = getProfile();
  byId('settings-name').value = profile?.name ?? '';
  setDateValue(byId('settings-start'), profile?.personalYearStart ?? '');
}

function saveProfile(event) {
  event.preventDefault();
  const name = byId('settings-name').value.trim();
  const start = getDateValue(byId('settings-start'));
  const nameError = validateProfileName(name);
  const startError = validateDateValue(start);
  setFieldError(byId('settings-name'), nameError);
  setFieldError(byId('settings-start'), startError);
  if (nameError || startError) {
    byId(nameError ? 'settings-name' : 'settings-start').focus();
    return;
  }
  const changes = { name, personalYearStart: start };
  // Without a profile (it was reset in another tab) a new one is created.
  const saved = getProfile()
    ? updateProfile(changes)
    : AppStorage.set(STORAGE_KEYS.profile, { ...changes, language: I18n.lang, theme: Theme.current(), createdAt: new Date().toISOString() });
  if (!saved) return;
  byId('settings-name').value = name;
  showToast('toast.profileSaved', 'success');
  document.dispatchEvent(new CustomEvent('lifeos:profilechange', { detail: { profile: getProfile() } }));
}

/* ----- Appearance ----- */

function buildAccentChoices() {
  const container = byId('settings-accents');
  ACCENTS.forEach((accent) => {
    const id = `settings-accent-${accent}`;
    const label = createEl('label', { class: 'choice-color', for: id });
    // The check mark is shown by CSS only on the chosen color (the hidden text names the color).
    const swatch = createEl('span', { class: 'swatch', 'data-color': accent, 'aria-hidden': 'true' });
    swatch.append(createEl('i', { class: 'bi bi-check-lg' }));
    label.append(
      swatch,
      createEl('span', { class: 'visually-hidden', 'data-i18n': `color.${accent}` }, t(`color.${accent}`))
    );
    container.append(createEl('input', { class: 'btn-check', type: 'radio', name: 'settings-accent', id, value: accent }), label);
  });
}

// Shows the current choices (they can also be changed in the header or in another tab).
function syncAppearance() {
  const check = (name, value) => {
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) radio.checked = true;
  };
  check('settings-language', I18n.lang);
  check('settings-theme', Theme.saved() ?? 'system');
  check('settings-accent', document.documentElement.getAttribute('data-accent') || DEFAULT_ACCENT);
  byId('settings-compact').checked = document.documentElement.getAttribute('data-compact') === 'true';
}

function onAppearanceChange(event) {
  const { name, value, id, checked } = event.target;
  if (name === 'settings-language') I18n.setLanguage(value);
  if (name === 'settings-theme') {
    if (value === 'system') Theme.useSystem();
    else Theme.set(value);
  }
  if (name === 'settings-accent') Theme.setAccent(value);
  if (id === 'settings-compact') Theme.setCompact(checked);
  if (name || id === 'settings-compact') showToast('toast.settingsSaved', 'success');
}

/* ----- Export / report ----- */

function exportJson() {
  const backup = buildBackup(readStorageSnapshot());
  downloadFile(backupFileName(Dates.toISO(Dates.today())), JSON.stringify(backup, null, 2), 'application/json');
  showToast('toast.exportDone', 'success');
}

function exportCsv() {
  const separator = I18n.lang === 'en' ? ',' : ';';
  const decimalMark = I18n.lang === 'en' ? '.' : ',';
  const labels = {
    category: (category) => goalCategoryName(category),
    type: (type) => (PROGRESS_TYPES.includes(type) ? t(`progressType.${type}`) : ''),
    status: (status) => t(`settings.report.status.${GOAL_STATUSES.includes(status) ? status : 'active'}`)
  };
  const head = ['goal', 'category', 'type', 'start', 'current', 'target', 'unit', 'percent', 'status', 'deadline', 'tasks', 'tasksDone']
    .map((column) => t(`settings.report.column.${column}`));
  const rows = goalReportRows(getGoals(), getTasks(), labels, decimalMark);
  downloadFile(`lifeos-report-${Dates.toISO(Dates.today())}.csv`, buildCsv([head, ...rows], separator), 'text/csv;charset=utf-8');
  showToast('toast.reportDone', 'success');
}

/* ----- Import ----- */

// The name of the chosen file (user data: textContent), or "No file chosen".
function showChosenFileName(file) {
  const label = byId('import-file-name');
  if (file) {
    delete label.dataset.i18n;
    label.textContent = file.name;
  } else {
    label.dataset.i18n = 'settings.import.noFile';
    label.textContent = t('settings.import.noFile');
  }
}

function clearImportFile() {
  byId('import-file').value = '';
  showChosenFileName(null);
}

async function onImportFileChosen(event) {
  const input = event.target;
  const file = input.files[0];
  pendingImport = null;
  setFieldError(input, null);
  showChosenFileName(file);
  if (!file) return;
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch (error) {
    setFieldError(input, 'settings.import.error.json'); // not JSON at all
    showToast('toast.importInvalid', 'danger');
    clearImportFile();
    return;
  }
  const result = validateBackup(backup);
  if (!result.ok) {
    setFieldError(input, result.error);
    showToast('toast.importInvalid', 'danger');
    clearImportFile();
    return;
  }
  // Only clean data is written: broken dates are dropped, ids and numbers are checked.
  const { data, skipped } = sanitizeBackup(backup.data);
  pendingImport = { ...backup, data };
  byId('import-summary').textContent = t('settings.import.found', {
    goals: tPlural('goals.count', asArray(data.goals).length),
    tasks: tPlural('planner.tasksCount', asArray(data.tasks).length),
    entries: tPlural('settings.entriesCount', asArray(data.progress).length)
  });
  const skippedNote = byId('import-skipped');
  skippedNote.hidden = skipped === 0;
  skippedNote.textContent = skipped ? t('settings.import.skipped', { count: Format.number(skipped) }) : '';
  bootstrap.Modal.getOrCreateInstance(byId('import-modal')).show();
}

// Writes every part. If one write fails, everything is put back as it was before.
function confirmImport() {
  if (!pendingImport) return;
  const before = readStorageSnapshot();
  const keys = Object.keys(BACKUP_KEYS);
  const write = (values) => keys.every((key) => (values[key] === null || values[key] === undefined
    ? AppStorage.remove(STORAGE_KEYS[key])
    : AppStorage.set(STORAGE_KEYS[key], values[key])));
  if (!write(pendingImport.data)) {
    write(before);
    showToast('toast.importFailed', 'danger');
    return;
  }
  // Reload: the imported language, theme and profile are applied everywhere.
  window.location.href = 'settings.html?imported=1';
}

/* ----- Reset ----- */

function openReset() {
  const profile = getProfile();
  byId('reset-name').value = '';
  setFieldError(byId('reset-name'), null);
  byId('reset-name-label').textContent = t('settings.reset.typeName', { name: profile?.name ?? '' });
  bootstrap.Modal.getOrCreateInstance(byId('reset-modal')).show();
}

function confirmReset(event) {
  event.preventDefault();
  const input = byId('reset-name');
  const profile = getProfile();
  // Without a profile there is no name to type, so any confirmation is fine.
  if (profile && !isResetNameCorrect(input.value, profile.name)) {
    setFieldError(input, 'settings.reset.error.name');
    input.focus();
    return;
  }
  Object.keys(BACKUP_KEYS).forEach((key) => AppStorage.remove(STORAGE_KEYS[key]));
  window.location.href = 'index.html'; // the first-run dialog starts again
}

/* ----- Past personal years (lifeos_archive) ----- */

// "Your current personal year: from 01.09.2026 to 31.08.2027" + a bar "72 of 365 days (20 %)".
function renderCurrentYear() {
  const container = byId('current-year');
  const profile = getProfile();
  const year = profile ? Dates.personalYear(profile.personalYearStart) : null;
  if (!year) {
    container.innerHTML = `<p class="task-empty">${escapeHtml(t('dashboard.year.noProfile'))}</p>`;
    return;
  }
  const passed = year.status === 'upcoming' ? 0 : Math.min(year.daysPassed, year.totalDays);
  const percent = year.status === 'upcoming' ? 0 : year.percent;
  const line = year.status === 'upcoming'
    ? t('settings.years.upcoming', { date: Format.shortDate(year.start) })
    : t('settings.years.current', { start: Format.shortDate(year.start), end: Format.shortDate(year.end) });
  const days = `${tPlural('progress.goals.daysOf', year.totalDays, { passed: Format.number(passed) })} (${Format.number(percent / 100, { style: 'percent', maximumFractionDigits: 0 })})`;
  container.innerHTML = `
    <p class="set-year-line" id="current-year-line">${escapeHtml(line)}</p>
    <div class="set-year-bar">
      <div class="progress" role="progressbar" aria-labelledby="current-year-line" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar" style="width: ${percent}%"></div>
      </div>
      <span class="set-year-days">${escapeHtml(days)}</span>
    </div>`;
}

function renderPastYears() {
  const archive = [...getArchive()].sort((a, b) => String(b.yearStart).localeCompare(String(a.yearStart)));
  if (archive.length === 0) {
    byId('past-years').innerHTML = `<p class="task-empty">${escapeHtml(t('settings.years.empty'))}</p>`;
    return;
  }
  byId('past-years').innerHTML = `<ul class="past-years">${archive.map((year) => {
    const stats = year.stats ?? {};
    const range = `${Format.date(year.yearStart)} – ${Format.date(year.yearEnd)}`;
    const goals = asArray(year.goals).map((goal) => `
      <li><span>${escapeHtml(goal.title)}</span><span>${escapeHtml(Format.number((Number(goal.percent) || 0) / 100, { style: 'percent' }))}</span></li>`).join('');
    return `
      <li>
        <details>
          <summary>
            <strong>${escapeHtml(range)}</strong>
            <span>${escapeHtml(t('settings.years.line', {
              goals: t('progress.summary.goalsValue', { done: stats.goalsAchieved ?? 0, total: stats.goalsTotal ?? 0 }),
              tasks: tPlural('planner.tasksCount', stats.tasksDone ?? 0)
            }))}</span>
          </summary>
          <ul class="past-year-goals">${goals}</ul>
        </details>
      </li>`;
  }).join('')}</ul>`;
}

/* ----- Self-test: settings.html?debug=1 ----- */

function runSettingsSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const good = buildBackup({ profile: { name: 'Aida', personalYearStart: '2026-09-01' }, goals: [{ id: 'g', title: 'Read' }], tasks: [], progress: [{ date: '2026-11-01' }] }, new Date('2026-11-11T10:00:00Z'));
  check('file name', backupFileName('2026-11-11'), 'lifeos-backup-2026-11-11.json');
  check('backup has version', good.version, 2);
  check('backup has all parts (with archive and sport)', Object.keys(good.data).length, 9);
  check('old version 1 is accepted', validateBackup({ ...good, version: 1 }).ok, true);
  check('sport: sessions must have dates', validateBackup({ ...good, data: { ...good.data, sport: { sessions: [{}] } } }).error, 'settings.import.error.structure');
  check('sport: a valid part', validateBackup({ ...good, data: { ...good.data, sport: { plan: {}, sessions: [{ date: '2026-11-10' }], body: [], current: null } } }).ok, true);
  check('archive must be a list of years', validateBackup({ ...good, data: { ...good.data, archive: [{}] } }).error, 'settings.import.error.structure');
  check('valid backup', validateBackup(good).ok, true);
  check('summary: goals', validateBackup(good).summary.goals, 1);
  check('summary: entries', validateBackup(good).summary.entries, 1);
  check('not LifeOS', validateBackup({ app: 'Other', version: 1, data: {} }).error, 'settings.import.error.notLifeos');
  check('future version', validateBackup({ ...good, version: 99 }).error, 'settings.import.error.version');
  check('goals must be an array', validateBackup({ ...good, data: { ...good.data, goals: {} } }).error, 'settings.import.error.structure');
  check('goal without title', validateBackup({ ...good, data: { ...good.data, goals: [{ id: 'x' }] } }).error, 'settings.import.error.goals');
  check('profile with a bad date', validateBackup({ ...good, data: { ...good.data, profile: { name: 'A', personalYearStart: 'soon' } } }).error, 'settings.import.error.profile');
  check('missing parts are allowed', validateBackup({ app: 'LifeOS', version: 1, data: {} }).ok, true);
  check('csv: separator in quotes', csvCell('a;b', ';'), '"a;b"');
  check('csv: quotes doubled', csvCell('say "hi"', ','), '"say ""hi"""');
  check('csv: formula made safe', csvCell('=SUM(A1)', ','), "'=SUM(A1)");
  check('csv: negative number stays', csvCell('-5', ','), '-5');
  check('csv: BOM first', buildCsv([['a']], ',').charCodeAt(0), 0xfeff);
  check('csv: decimal comma', csvNumber(86.5, ','), '86,5');
  const labels = { category: (c) => c, type: (type) => type, status: (s) => s };
  const goalsList = [{ id: 'g', title: 'Weight', category: 'health', progressType: 'measurements', startValue: 92, currentValue: 86, targetValue: 80, unit: 'kg', status: 'active' }];
  const taskList = [{ id: 't1', goalId: 'g', title: 'Run', recurrence: 'daily', completions: ['2026-11-10'] }, { id: 't2', goalId: 'g', title: 'Buy', recurrence: 'none', completed: false }];
  const row = goalReportRows(goalsList, taskList, labels, '.')[0];
  check('report row: percent', row[7], 50);
  check('report row: tasks / done', `${row[10]}/${row[11]}`, '2/1');
  check('reset name: case and spaces ignored', isResetNameCorrect('  vilgelm ', 'Vilgelm'), true);
  check('reset name: empty is wrong', isResetNameCorrect('', ''), false);
  const dirty = sanitizeBackup({
    tasks: [{ id: 't1', title: 'Ok', date: '2026-11-12' }, { id: 't2', title: 'Bad', date: '2026-11-12"><img src=x>' }, { id: 5, title: 'No id', date: '2026-11-12' }],
    goals: [{ id: 'g', title: 'G', deadline: '<b>', startValue: '3', targetValue: 'x', milestones: [{ title: 'M', dueDate: '12.11.2026' }] }],
    progress: [{ goalId: 'g', date: 'bad', value: 1 }, { goalId: 'g', date: '2026-11-01', value: '2' }],
    sport: { sessions: [{ date: 'nope' }], body: [{ date: '2026-11-01', weight: 'heavy', waist: 90 }] },
    archive: [{ yearStart: '2025-09-01', yearEnd: '<i>' }]
  });
  check('import: tasks with a bad date or id are dropped', dirty.data.tasks.map((task) => task.id).join(), 't1');
  check('import: dropped records are counted', dirty.skipped, 5);
  check('import: a bad deadline becomes null', dirty.data.goals[0].deadline, null);
  check('import: numbers are numbers', `${dirty.data.goals[0].startValue}/${dirty.data.goals[0].targetValue}/${dirty.data.progress[0].value}`, '3/0/2');
  check('import: a bad milestone date becomes null', dirty.data.goals[0].milestones[0].dueDate, null);
  check('import: a non-number measurement is removed', `${'weight' in dirty.data.sport.body[0]}/${dirty.data.sport.body[0].waist}`, 'false/90');
  check('strict date', `${isIsoDate('2026-11-12')}/${isIsoDate('12.11.2026')}/${isIsoDate('2026-02-30')}`, 'true/false/false');

  console.group('[LifeOS] Settings self-test');
  console.table(results);
  const failed = results.filter((item) => item.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} settings tests failed`);
  else console.info(`All ${results.length} settings tests passed`);
  console.groupEnd();
}

/* ----- Start ----- */

onAppReady(() => {
  buildAccentChoices();
  I18n.apply(byId('settings-accents'));
  fillProfileForm();
  syncAppearance();
  renderPastYears();
  renderCurrentYear();
  document.addEventListener('lifeos:languagechange', renderPastYears);
  document.addEventListener('lifeos:languagechange', renderCurrentYear);
  document.addEventListener('lifeos:profilechange', renderCurrentYear); // a new start of the year
  byId('profile-form').addEventListener('submit', submitOnce(saveProfile));
  document.querySelector('[aria-labelledby="appearance-title"]').addEventListener('change', onAppearanceChange);
  byId('export-json').addEventListener('click', exportJson);
  byId('export-csv').addEventListener('click', exportCsv);
  byId('import-file').addEventListener('change', onImportFileChosen);
  byId('import-confirm').addEventListener('click', submitOnce(confirmImport));
  byId('import-modal').addEventListener('hidden.bs.modal', () => {
    if (pendingImport) { // cancelled: nothing was changed
      pendingImport = null;
      clearImportFile();
    }
    byId('import-file').focus();
  });
  byId('reset-open').addEventListener('click', openReset);
  byId('reset-export').addEventListener('click', exportJson);
  byId('reset-form').addEventListener('submit', submitOnce(confirmReset));
  byId('reset-modal').addEventListener('shown.bs.modal', () => byId('reset-name').focus());
  byId('reset-modal').addEventListener('hidden.bs.modal', () => byId('reset-open').focus());
  // The header buttons (language, theme) change the same things: keep the page in sync.
  document.addEventListener('lifeos:languagechange', syncAppearance);
  document.addEventListener('lifeos:themechange', syncAppearance);
  document.addEventListener('lifeos:profilechange', fillProfileForm);

  const params = new URLSearchParams(window.location.search);
  if (params.get('imported') === '1') {
    showToast('toast.importDone', 'success');
    history.replaceState(null, '', window.location.pathname);
  }
  if (params.get('debug') === '1') runSettingsSelfTest();
});
