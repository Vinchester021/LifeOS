// LifeOS — Sport (sport.html): week plan, today's workout, journal, records, body.
// Data: lifeos_sport. Reading / writing and the pure functions (records, statistics,
// body differences, today's workout) are in app.js, section 11b — Dashboard, Planner
// and Progress use them too.
// The view is in the address: sport.html?tab=plan | today | log | records | body
// (old links with #today still work).
'use strict';

const SPORT_TABS = ['plan', 'today', 'log', 'records', 'body'];
const DEFAULT_SPORT_TAB = 'today';
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7]; // Monday … Sunday
const CONFIRM_TIME = 4000; // a dangerous button waits this long for the second click

const sportState = {
  tab: DEFAULT_SPORT_TAB,
  dialog: null, // { mode: "plan" | "adhoc", day, returnFocusId }
  rowCount: 0 // exercise rows in the dialog (only for unique ids)
};

/* =========================================================
   Part 1. Small helpers
   ========================================================= */

function sportToday() {
  return Dates.toISO(Dates.today());
}

// The date of weekday 1–7 in the current week (only used for its name).
function weekdayDate(day) {
  return Dates.addDays(Dates.startOfWeek(Dates.today()), day - 1);
}

// "Thursday" / "Четверг" — at the start of a line (titles, cards)
function weekdayName(day) {
  return upperFirst(Format.weekday(weekdayDate(day), 'long'));
}

// "Thursday" / "четверг" — inside a sentence (messages, button labels)
function weekdayInText(day) {
  return Format.weekday(weekdayDate(day), 'long');
}

function readWholeNumber(input) {
  const value = readNumber(input);
  return Number.isInteger(value) ? value : NaN;
}

function isBetween(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function kgNumber(value) {
  return Format.number(value, { maximumFractionDigits: 1 });
}

// "60 kg × 8" or "20 reps" (bodyweight)
function setText(weight, reps) {
  return weight ? t('sport.set.weighted', { weight: kgNumber(weight), reps }) : t('sport.set.bodyweight', { reps });
}

// "4 × 8 · 60 kg" for a planned exercise
function planExerciseText(exercise) {
  const base = `${exercise.sets} × ${exercise.reps}`;
  return Number.isFinite(exercise.weight) ? `${base} · ${t('progress.workout.kg', { value: kgNumber(exercise.weight) })}` : base;
}

function emptyText(key) {
  return `<p class="task-empty">${escapeHtml(t(key))}</p>`;
}

// A dangerous action asks twice: the first click turns the button into "Sure?",
// the second one (within 4 s) does it. Returns true on the second click.
function confirmTwice(button, confirmKey) {
  if (button.dataset.armed === 'true') return true;
  button.dataset.armed = 'true';
  button.dataset.original = button.innerHTML; // our own markup, no user text
  button.classList.add('is-armed');
  button.innerHTML = `<i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>${escapeHtml(t(confirmKey))}`;
  if (button.hasAttribute('aria-label')) {
    button.dataset.originalLabel = button.getAttribute('aria-label');
    button.setAttribute('aria-label', t(confirmKey));
  }
  setTimeout(() => {
    if (!button.isConnected || button.dataset.armed !== 'true') return;
    button.dataset.armed = 'false';
    button.classList.remove('is-armed');
    button.innerHTML = button.dataset.original;
    if (button.dataset.originalLabel) button.setAttribute('aria-label', button.dataset.originalLabel);
  }, CONFIRM_TIME);
  return false;
}

/* =========================================================
   Part 2. Views (tabs)
   ========================================================= */

// ?tab=body; an old link sport.html#body still opens the right tab.
function tabFromAddress() {
  const fromQuery = new URLSearchParams(window.location.search).get('tab');
  const tab = SPORT_TABS.includes(fromQuery) ? fromQuery : window.location.hash.slice(1);
  return SPORT_TABS.includes(tab) ? tab : DEFAULT_SPORT_TAB;
}

// Saves the tab in the address (no reload; other parameters like ?debug=1 stay).
function writeTabToAddress(tab) {
  const params = new URLSearchParams(window.location.search);
  params.set('tab', tab);
  history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

function showTab(tab) {
  sportState.tab = tab;
  document.querySelectorAll('[data-sport-view]').forEach((view) => {
    view.hidden = view.dataset.sportView !== tab;
  });
  document.querySelectorAll('[data-sport-tab]').forEach((link) => {
    const isActive = link.dataset.sportTab === tab;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  // On a phone the tabs scroll sideways: show the active one.
  const active = document.querySelector('.sport-tabs .active');
  const strip = active?.closest('.sport-tabs');
  if (strip && strip.scrollWidth > strip.clientWidth) active.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function renderSport() {
  const sport = getSport();
  renderPlan(sport);
  renderToday(sport);
  renderLog(sport);
  renderRecords(sport);
  renderBody(sport);
}

/* =========================================================
   Part 3. Week plan
   ========================================================= */

function renderPlan(sport) {
  const today = weekdayNumber(Dates.today());
  byId('sport-week').innerHTML = WEEK_DAYS.map((day) => planDayHtml(day, planOfDay(sport, day), day === today)).join('');
}

function planOfDay(sport, day) {
  const plan = sport.plan[String(day)];
  return isPlainObject(plan) && (plan.type === 'workout' || plan.type === 'rest') ? plan : null;
}

function planDayBodyHtml(plan) {
  if (plan?.type === 'rest') {
    return `<p class="sport-rest"><i class="bi bi-cup-hot me-1" aria-hidden="true"></i>${escapeHtml(t('sport.day.rest'))}</p>`;
  }
  if (plan?.type !== 'workout') return `<p class="sport-none">${escapeHtml(t('sport.day.none'))}</p>`;
  const rows = asArray(plan.exercises).map((exercise) => `
      <li>
        <span class="sport-ex-name">${escapeHtml(exercise.name)}</span>
        <span class="sport-ex-meta">${escapeHtml(planExerciseText(exercise))}</span>
        ${exercise.note ? `<span class="sport-ex-note">${escapeHtml(exercise.note)}</span>` : ''}
      </li>`).join('');
  return `<p class="sport-day-name">${escapeHtml(plan.title)}</p><ul class="sport-ex-list">${rows}</ul>`;
}

function planDayHtml(day, plan, isToday) {
  const name = weekdayName(day);
  const inText = weekdayInText(day);
  const copyItems = WEEK_DAYS.filter((other) => other !== day).map((other) => `
          <li><button type="button" class="dropdown-item" data-plan-copy="${day}" data-copy-to="${other}">${escapeHtml(weekdayName(other))}</button></li>`).join('');
  const planActions = plan ? `
        <div class="dropdown">
          <button type="button" class="btn btn-tool btn-sm dropdown-toggle" id="plan-copy-${day}" data-bs-toggle="dropdown" aria-expanded="false"
                  aria-label="${escapeHtml(t('sport.plan.copyLabel', { day: inText }))}">
            <i class="bi bi-files me-1" aria-hidden="true"></i>${escapeHtml(t('sport.plan.copy'))}
          </button>
          <ul class="dropdown-menu">${copyItems}</ul>
        </div>
        <button type="button" class="btn btn-icon" id="plan-clear-${day}" data-plan-clear="${day}"
                aria-label="${escapeHtml(t('sport.plan.clearLabel', { day: inText }))}" title="${escapeHtml(t('sport.plan.clearLabel', { day: inText }))}">
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>` : '';
  return `
    <article class="panel sport-day${isToday ? ' is-today' : ''}" aria-labelledby="plan-day-${day}">
      <header class="sport-day-head">
        <h3 class="panel-title" id="plan-day-${day}">${escapeHtml(name)}</h3>
        ${isToday ? `<span class="week-today-badge">${escapeHtml(t('planner.week.todayBadge'))}</span>` : ''}
      </header>
      ${planDayBodyHtml(plan)}
      <div class="sport-day-actions">
        <button type="button" class="btn btn-tool btn-sm" id="plan-edit-${day}" data-plan-edit="${day}"
                aria-label="${escapeHtml(t(plan ? 'sport.plan.editLabel' : 'sport.plan.addLabel', { day: inText }))}">
          <i class="bi ${plan ? 'bi-pencil' : 'bi-plus-lg'} me-1" aria-hidden="true"></i>${escapeHtml(t(plan ? 'sport.plan.edit' : 'sport.plan.add'))}
        </button>
        ${planActions}
      </div>
    </article>`;
}

// A copy gets new exercise ids, so the two days never share objects.
function copyPlanDay(from, to) {
  const sport = getSport();
  const plan = planOfDay(sport, from);
  if (!plan) return;
  sport.plan[String(to)] = plan.type === 'workout'
    ? { ...plan, exercises: asArray(plan.exercises).map((exercise) => ({ ...exercise, id: createId('ex') })) }
    : { type: 'rest' };
  if (!saveSport(sport)) return;
  showToast('sport.toast.copied', 'success', { from: weekdayInText(from), to: weekdayInText(to) });
  renderSport();
  byId(`plan-copy-${from}`)?.focus();
}

function clearPlanDay(day, button) {
  if (!confirmTwice(button, 'sport.plan.clearConfirm')) return;
  const sport = getSport();
  delete sport.plan[String(day)];
  if (!saveSport(sport)) return;
  showToast('sport.toast.planCleared', 'success', { day: weekdayInText(day) });
  renderSport();
  byId(`plan-edit-${day}`)?.focus();
}

/* ----- Dialog: a day of the plan, or a workout outside the plan ----- */

function exerciseRowHtml(number) {
  const field = (name, labelKey, colClass, attributes = '') => `
      <div class="${colClass}">
        <label class="form-label" for="ex-${name}-${number}" data-i18n="${labelKey}">${escapeHtml(t(labelKey))}</label>
        <input class="form-control" type="text" id="ex-${name}-${number}" autocomplete="off" ${attributes}>
        <p class="field-error" id="ex-${name}-${number}-error"></p>
      </div>`;
  return `
    <fieldset class="sport-ex-row" data-ex-row="${number}">
      <legend class="visually-hidden" data-i18n="sport.day.exercise">${escapeHtml(t('sport.day.exercise'))}</legend>
      <div class="row g-2">
        ${field('name', 'progress.workout.exercise', 'col-12 col-md-5', 'maxlength="60" data-i18n-placeholder="progress.workout.exercisePlaceholder"')}
        ${field('sets', 'progress.workout.sets', 'col-4 col-md-2', 'inputmode="numeric" maxlength="2"')}
        ${field('reps', 'progress.workout.reps', 'col-4 col-md-2', 'inputmode="numeric" maxlength="3"')}
        ${field('weight', 'progress.workout.weight', 'col-4 col-md-3', 'inputmode="decimal" maxlength="6" data-i18n-placeholder="progress.workout.bodyweight"')}
        <div class="col-12 sport-ex-note-row">
          <div class="flex-grow-1">
            <label class="form-label" for="ex-note-${number}" data-i18n="sport.day.note">${escapeHtml(t('sport.day.note'))}</label>
            <input class="form-control" type="text" id="ex-note-${number}" maxlength="100" autocomplete="off">
            <p class="field-error" id="ex-note-${number}-error"></p>
          </div>
          <button type="button" class="btn btn-icon" data-ex-remove="${number}"
                  data-i18n-aria-label="sport.day.removeExercise" aria-label="${escapeHtml(t('sport.day.removeExercise'))}"
                  data-i18n-title="sport.day.removeExercise" title="${escapeHtml(t('sport.day.removeExercise'))}">
            <i class="bi bi-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </fieldset>`;
}

function addExerciseRow(exercise = null) {
  const number = ++sportState.rowCount;
  byId('sport-ex-rows').insertAdjacentHTML('beforeend', exerciseRowHtml(number));
  I18n.apply(document.querySelector(`[data-ex-row="${number}"]`)); // placeholders
  if (exercise) {
    // .value never parses HTML: user text is safe here.
    byId(`ex-name-${number}`).value = exercise.name ?? '';
    byId(`ex-sets-${number}`).value = exercise.sets ?? '';
    byId(`ex-reps-${number}`).value = exercise.reps ?? '';
    byId(`ex-weight-${number}`).value = Number.isFinite(exercise.weight) ? String(exercise.weight) : '';
    byId(`ex-note-${number}`).value = exercise.note ?? '';
    document.querySelector(`[data-ex-row="${number}"]`).dataset.exId = exercise.id ?? '';
  }
  return number;
}

function selectedDayType() {
  return byId('sport-day-form').elements['sport-day-type'].value || 'workout';
}

function updateDayTypeFields() {
  byId('sport-day-workout').hidden = sportState.dialog?.mode === 'plan' && selectedDayType() === 'rest';
}

function openDayDialog(mode, day, returnFocusId) {
  sportState.dialog = { mode, day, returnFocusId };
  const plan = mode === 'plan' ? planOfDay(getSport(), day) : null;
  const form = byId('sport-day-form');
  form.querySelectorAll('.is-invalid').forEach((element) => setFieldError(element, null));
  setGroupError(byId('sport-ex-rows'), null);
  byId('sport-day-modal-title').textContent = mode === 'plan'
    ? t('sport.day.dialogTitle', { day: weekdayName(day) }) : t('sport.adhoc.title');
  byId('sport-day-save').textContent = t(mode === 'plan' ? 'sport.day.save' : 'sport.adhoc.start');
  byId('sport-day-type-group').hidden = mode !== 'plan';
  form.elements['sport-day-type'].value = plan?.type ?? 'workout';
  byId('sport-day-title').value = plan?.type === 'workout' ? plan.title : (mode === 'adhoc' ? t('sport.adhoc.defaultTitle') : '');
  byId('sport-ex-rows').innerHTML = '';
  const exercises = plan?.type === 'workout' ? asArray(plan.exercises) : [];
  (exercises.length ? exercises : [null]).forEach((exercise) => addExerciseRow(exercise));
  updateDayTypeFields();
  bootstrap.Modal.getOrCreateInstance(byId('sport-day-modal')).show();
}

// Reads and checks every exercise row; errors are shown next to the fields.
function readExerciseRows() {
  let firstInvalid = null;
  const exercises = [...document.querySelectorAll('[data-ex-row]')].map((row) => {
    const number = row.dataset.exRow;
    const input = (name) => byId(`ex-${name}-${number}`);
    const name = input('name').value.trim();
    const sets = readWholeNumber(input('sets'));
    const reps = readWholeNumber(input('reps'));
    const weightText = input('weight').value.trim();
    const weight = weightText === '' ? null : readNumber(input('weight'));
    const note = input('note').value.trim();
    let nameError = null;
    if (name === '') nameError = 'progress.error.exercise';
    else if (name.length > 60) nameError = 'progress.error.exerciseLength';
    [
      [input('name'), nameError],
      [input('sets'), isBetween(sets, 1, 20) ? null : 'sport.error.sets'],
      [input('reps'), isBetween(reps, 1, 500) ? null : 'progress.error.reps'],
      [input('weight'), weight === null || isBetween(weight, 0, 1000) ? null : 'progress.error.weight'],
      [input('note'), note.length > 100 ? 'sport.error.note' : null]
    ].forEach(([field, errorKey]) => {
      setFieldError(field, errorKey);
      if (errorKey) firstInvalid ??= field;
    });
    return { id: row.dataset.exId || createId('ex'), name, sets, reps, weight: weight === null ? null : roundOne(weight), note };
  });
  return { exercises, firstInvalid };
}

// A planned exercise -> exercise of a workout: one set per planned set, not done yet.
function toWorkoutExercise(exercise) {
  return {
    name: exercise.name,
    note: exercise.note ?? '',
    sets: Array.from({ length: exercise.sets }, () => ({ reps: exercise.reps, weight: exercise.weight ?? null, done: false }))
  };
}

function saveDayDialog(event) {
  event.preventDefault();
  const { mode, day } = sportState.dialog;
  const sport = getSport();
  const isRest = mode === 'plan' && selectedDayType() === 'rest';
  if (isRest) {
    sport.plan[String(day)] = { type: 'rest' };
    finishDayDialog(sport, 'sport.toast.planSaved', { day: weekdayInText(day) });
    return;
  }
  const titleInput = byId('sport-day-title');
  const title = titleInput.value.trim();
  setFieldError(titleInput, title === '' ? 'sport.error.title' : null);
  const { exercises, firstInvalid } = readExerciseRows();
  setGroupError(byId('sport-ex-rows'), exercises.length === 0 ? 'sport.error.noExercises' : null);
  const invalid = title === '' ? titleInput : firstInvalid ?? (exercises.length === 0 ? byId('sport-ex-add') : null);
  if (invalid) {
    invalid.focus();
    return;
  }
  if (mode === 'plan') {
    sport.plan[String(day)] = { type: 'workout', title, exercises };
    finishDayDialog(sport, 'sport.toast.planSaved', { day: weekdayInText(day) });
    return;
  }
  // Outside the plan: the workout starts right away (Today tab).
  sport.current = { date: sportToday(), title, planned: false, exercises: exercises.map(toWorkoutExercise) };
  sportState.dialog.returnFocusId = 'sport-finish';
  finishDayDialog(sport, 'sport.toast.started', { title });
  if (sportState.tab !== 'today') window.location.hash = 'today';
}

function finishDayDialog(sport, toastKey, params) {
  if (!saveSport(sport)) return;
  bootstrap.Modal.getInstance(byId('sport-day-modal')).hide();
  showToast(toastKey, 'success', params);
  renderSport();
}

/* =========================================================
   Part 4. Today: mark the sets, then "Finish workout"
   ========================================================= */

function renderToday(sport) {
  const today = sportToday();
  const box = byId('sport-today');
  if (sport.current) {
    box.innerHTML = currentWorkoutHtml(sport.current, today);
    return;
  }
  const plan = planForDate(today, sport);
  const finished = sport.sessions.filter((session) => session.date === today);
  const adhocButton = `
    <button type="button" class="btn btn-tool" id="sport-adhoc">
      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>${escapeHtml(t(finished.length ? 'sport.today.another' : 'sport.today.adhoc'))}
    </button>`;
  let content;
  if (finished.length) {
    const items = finished.map((session) => `
      <li><strong>${escapeHtml(session.title || t('sport.session.untitled'))}</strong>
        · ${escapeHtml(tPlural('sport.setsCount', finishedSets([session]).length))}</li>`).join('');
    content = `
      <p class="sport-today-state is-done"><i class="bi bi-check2-circle me-1" aria-hidden="true"></i>${escapeHtml(t('sport.today.done'))}</p>
      <ul class="sport-done-list">${items}</ul>
      <div class="sport-today-actions">${adhocButton}</div>`;
  } else if (plan?.type === 'workout') {
    content = `
      <p class="sport-today-label">${escapeHtml(t('sport.today.planned'))}</p>
      ${planDayBodyHtml(plan)}
      <div class="sport-today-actions">
        <button type="button" class="btn btn-primary" id="sport-start">
          <i class="bi bi-play-fill me-1" aria-hidden="true"></i>${escapeHtml(t('sport.today.start'))}
        </button>
        ${adhocButton}
      </div>`;
  } else {
    const key = plan?.type === 'rest' ? 'sport.today.rest' : 'sport.today.none';
    content = `
      <p class="sport-today-state">${escapeHtml(t(key))}</p>
      <div class="sport-today-actions">
        ${plan ? '' : `<a class="btn btn-tool" href="#plan">${escapeHtml(t('sport.today.toPlan'))}</a>`}
        ${adhocButton}
      </div>`;
  }
  box.innerHTML = `
    <section class="panel" aria-labelledby="sport-day-heading">
      <h3 class="panel-title" id="sport-day-heading">${escapeHtml(upperFirst(Format.date(Dates.today(), { weekday: 'long', day: 'numeric', month: 'long' })))}</h3>
      ${content}
    </section>`;
}

function workoutProgress(current) {
  const sets = setsOf(current.exercises);
  return { done: sets.filter((set) => set.done).length, total: sets.length };
}

function setRowHtml(exercise, e, set, s) {
  const id = `set-${e}-${s}`;
  const number = s + 1;
  const value = (number) => (Number.isFinite(number) ? String(number) : '');
  return `
    <li class="sport-set${set.done ? ' is-done' : ''}">
      <input class="form-check-input" type="checkbox" id="${id}-done" data-set="${e}-${s}" data-set-field="done"${set.done ? ' checked' : ''}>
      <label class="sport-set-label" for="${id}-done">${escapeHtml(t('sport.set.number', { number }))}</label>
      <span class="sport-set-inputs">
        <label class="visually-hidden" for="${id}-weight">${escapeHtml(t('sport.set.weightLabel', { number, exercise: exercise.name }))}</label>
        <input class="form-control form-control-sm" type="text" id="${id}-weight" inputmode="decimal" maxlength="6"
               data-set="${e}-${s}" data-set-field="weight" value="${escapeHtml(value(set.weight))}" placeholder="—">
        <span class="sport-set-unit" aria-hidden="true">${escapeHtml(t('progress.unit.kg'))} ×</span>
        <label class="visually-hidden" for="${id}-reps">${escapeHtml(t('sport.set.repsLabel', { number, exercise: exercise.name }))}</label>
        <input class="form-control form-control-sm" type="text" id="${id}-reps" inputmode="numeric" maxlength="3"
               data-set="${e}-${s}" data-set-field="reps" value="${escapeHtml(value(set.reps))}">
      </span>
      <p class="field-error" id="${id}-weight-error"></p>
      <p class="field-error" id="${id}-reps-error"></p>
    </li>`;
}

function currentWorkoutHtml(current, today) {
  const { done, total } = workoutProgress(current);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const exercises = asArray(current.exercises).map((exercise, e) => `
      <div class="sport-current-ex">
        <h4 class="h6 mb-1">${escapeHtml(exercise.name)}</h4>
        ${exercise.note ? `<p class="sport-ex-note mb-1">${escapeHtml(exercise.note)}</p>` : ''}
        <ol class="sport-sets">${asArray(exercise.sets).map((set, s) => setRowHtml(exercise, e, set, s)).join('')}</ol>
        <button type="button" class="btn btn-tool btn-sm" id="add-set-${e}" data-add-set="${e}">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>${escapeHtml(t('sport.set.add'))}
        </button>
      </div>`).join('');
  return `
    <section class="panel sport-current" aria-labelledby="sport-current-title">
      <div class="panel-head">
        <h3 class="panel-title" id="sport-current-title">${escapeHtml(current.title || t('sport.session.untitled'))}</h3>
        ${current.planned ? '' : `<span class="badge tab-count">${escapeHtml(t('sport.badge.adhoc'))}</span>`}
      </div>
      ${current.date !== today ? `<p class="form-text mt-0">${escapeHtml(t('sport.today.startedOn', { date: Format.date(current.date, { dateStyle: 'long' }) }))}</p>` : ''}
      <div class="progress mb-1" role="progressbar" aria-labelledby="sport-current-progress" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar" id="sport-current-bar" style="width: ${percent}%"></div>
      </div>
      <p class="sport-progress-text" id="sport-current-progress">${escapeHtml(t('sport.today.progress', { done, total }))}</p>
      ${exercises}
      <div class="sport-finish">
        <p class="field-error" id="sport-finish-error"></p>
        <div class="sport-today-actions">
          <button type="button" class="btn btn-primary" id="sport-finish" aria-describedby="sport-finish-error">
            <i class="bi bi-flag me-1" aria-hidden="true"></i>${escapeHtml(t('sport.today.finish'))}
          </button>
          <button type="button" class="btn btn-outline-danger" id="sport-cancel">${escapeHtml(t('sport.today.cancel'))}</button>
        </div>
      </div>
    </section>`;
}

function startPlannedWorkout() {
  const sport = getSport();
  const plan = planForDate(sportToday(), sport);
  if (plan?.type !== 'workout') return;
  sport.current = { date: sportToday(), title: plan.title, planned: true, exercises: asArray(plan.exercises).map(toWorkoutExercise) };
  if (!saveSport(sport)) return;
  renderSport();
  byId('set-0-0-done')?.focus();
}

// Every change of a set is saved at once, so a page refresh keeps the marks.
function updateSet(input) {
  const [e, s] = input.dataset.set.split('-').map(Number);
  const sport = getSport();
  const set = sport.current?.exercises?.[e]?.sets?.[s];
  if (!set) return;
  const field = input.dataset.setField;
  if (field === 'done') set.done = input.checked;
  else {
    const value = input.value.trim() === '' ? null : readNumber(input);
    set[field] = Number.isFinite(value) ? value : null;
  }
  if (!saveSport(sport)) return;
  if (field === 'done') {
    input.closest('.sport-set').classList.toggle('is-done', set.done);
    const { done, total } = workoutProgress(sport.current);
    const percent = total ? Math.round((done / total) * 100) : 0;
    byId('sport-current-bar').style.width = `${percent}%`;
    byId('sport-current-bar').parentElement.setAttribute('aria-valuenow', String(percent));
    byId('sport-current-progress').textContent = t('sport.today.progress', { done, total });
  }
}

function addSet(e) {
  const sport = getSport();
  const sets = sport.current?.exercises?.[e]?.sets;
  if (!sets) return;
  const last = sets[sets.length - 1];
  sets.push({ reps: last?.reps ?? null, weight: last?.weight ?? null, done: false });
  if (!saveSport(sport)) return;
  renderSport();
  byId(`set-${e}-${sets.length - 1}-done`)?.focus();
}

// Checks the finished sets; returns the first wrong field (or null).
function checkFinishedSets(current) {
  let firstInvalid = null;
  current.exercises.forEach((exercise, e) => exercise.sets.forEach((set, s) => {
    const repsInput = byId(`set-${e}-${s}-reps`);
    const weightInput = byId(`set-${e}-${s}-weight`);
    if (!set.done) {
      setFieldError(repsInput, null);
      setFieldError(weightInput, null);
      return;
    }
    const reps = readWholeNumber(repsInput);
    const weight = weightInput.value.trim() === '' ? null : readNumber(weightInput);
    const repsError = isBetween(reps, 1, 500) ? null : 'progress.error.reps';
    const weightError = weight === null || isBetween(weight, 0, 1000) ? null : 'progress.error.weight';
    setFieldError(weightInput, weightError);
    setFieldError(repsInput, repsError);
    if (weightError) firstInvalid ??= weightInput;
    if (repsError) firstInvalid ??= repsInput;
    set.reps = reps;
    set.weight = weight === null ? null : roundOne(weight);
  }));
  return firstInvalid;
}

function recordText(record) {
  return `${record.exercise} ${setText(record.weight, record.reps)}`;
}

function finishWorkout() {
  const sport = getSport();
  const current = sport.current;
  if (!current) return;
  const { done } = workoutProgress(current);
  showErrorText(byId('sport-finish-error'), done === 0 ? 'sport.error.noSetsDone' : null);
  if (done === 0) {
    byId('sport-finish').focus();
    return;
  }
  const invalid = checkFinishedSets(current);
  if (invalid) {
    invalid.focus();
    return;
  }
  const recordsBefore = personalRecords(sport.sessions);
  sport.sessions.push({
    id: createId('session'),
    date: current.date,
    title: current.title,
    planned: Boolean(current.planned),
    exercises: current.exercises
      .map((exercise) => ({ name: exercise.name, note: exercise.note ?? '', sets: exercise.sets.filter((set) => set.done).map(({ reps, weight }) => ({ reps, weight, done: true })) }))
      .filter((exercise) => exercise.sets.length > 0),
    finishedAt: new Date().toISOString()
  });
  sport.current = null;
  if (!saveSport(sport)) return;
  recordWorkoutInGoals(current.date); // "Health" goals: +1 workout / the day of a streak
  showToast('sport.toast.finished', 'success');
  const improved = improvedRecords(recordsBefore, personalRecords(sport.sessions));
  if (improved.length) showToast('sport.toast.newRecord', 'success', { records: improved.map(recordText).join(', ') });
  renderSport();
  (byId('sport-adhoc') ?? byId('sport-today'))?.focus();
}

function cancelWorkout(button) {
  if (!confirmTwice(button, 'sport.today.cancelConfirm')) return;
  const sport = getSport();
  sport.current = null;
  if (!saveSport(sport)) return;
  showToast('sport.toast.cancelled', 'success');
  renderSport();
  (byId('sport-start') ?? byId('sport-adhoc'))?.focus();
}

/* =========================================================
   Part 5. Journal and records
   ========================================================= */

// Exercise names for the filter: one spelling per exercise, sorted.
function exerciseNames(sessions) {
  const names = new Map();
  finishedSets(sessions).forEach((set) => {
    const key = exerciseKey(set.exercise);
    if (key && !names.has(key)) names.set(key, set.exercise);
  });
  return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

function renderLog(sport) {
  const select = byId('sport-log-filter');
  const chosen = select.value;
  const names = exerciseNames(sport.sessions);
  select.replaceChildren(createEl('option', { value: '' }, t('sport.log.all')),
    ...names.map(([key, name]) => createEl('option', { value: key }, name)));
  select.value = names.some(([key]) => key === chosen) ? chosen : '';
  const filter = select.value;

  const sessions = [...sport.sessions]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.finishedAt).localeCompare(String(a.finishedAt)))
    .map((session) => ({ session, exercises: asArray(session.exercises).filter((exercise) => !filter || exerciseKey(exercise.name) === filter) }))
    .filter(({ exercises }) => exercises.length > 0);
  if (sessions.length === 0) {
    byId('sport-log').innerHTML = emptyText(sport.sessions.length ? 'sport.log.noMatch' : 'sport.log.empty');
    return;
  }
  byId('sport-log').innerHTML = `<ul class="sport-log">${sessions.map(({ session, exercises }) => logItemHtml(session, exercises)).join('')}</ul>`;
}

function logItemHtml(session, exercises) {
  const title = session.title || t('sport.session.untitled');
  const date = Format.date(session.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const lines = exercises.map((exercise) => `
        <li><strong>${escapeHtml(exercise.name)}</strong>:
          ${escapeHtml(asArray(exercise.sets).filter((set) => set.done).map((set) => setText(set.weight, set.reps)).join(', '))}</li>`).join('');
  return `
    <li class="sport-log-item">
      <div class="sport-log-head">
        <div>
          <p class="history-date mb-0">${escapeHtml(upperFirst(date))}</p>
          <h3 class="h6 mb-1">${escapeHtml(title)}
            ${session.planned === false ? `<span class="badge tab-count ms-1">${escapeHtml(t('sport.badge.adhoc'))}</span>` : ''}</h3>
        </div>
        <button type="button" class="btn btn-icon" id="log-delete-${escapeHtml(session.id)}" data-delete-session="${escapeHtml(session.id)}"
                aria-label="${escapeHtml(t('sport.log.deleteLabel', { title, date }))}" title="${escapeHtml(t('sport.log.deleteLabel', { title, date }))}">
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>
      </div>
      <ul class="sport-log-lines">${lines}</ul>
    </li>`;
}

function deleteSession(id, button) {
  if (!confirmTwice(button, 'sport.log.deleteConfirm')) return;
  const sport = getSport();
  const remaining = sport.sessions.filter((session) => session.id !== id);
  if (remaining.length === sport.sessions.length) return;
  sport.sessions = remaining;
  if (!saveSport(sport)) return;
  showToast('toast.workoutDeleted', 'success');
  renderSport();
  byId('sport-log-filter').focus();
}

function renderRecords(sport) {
  const records = personalRecords(sport.sessions);
  if (records.length === 0) {
    byId('sport-records').innerHTML = emptyText('sport.records.empty');
    return;
  }
  const rows = records.map((record) => `
      <tr>
        <th scope="row">${escapeHtml(record.exercise)}</th>
        <td>${escapeHtml(setText(record.weight, record.reps))}</td>
        <td>${escapeHtml(Format.shortDate(record.date))}</td>
      </tr>`).join('');
  byId('sport-records').innerHTML = `
    <p class="form-text mt-0 mb-3">${escapeHtml(t('sport.records.hint'))}</p>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th scope="col">${escapeHtml(t('progress.workout.exercise'))}</th>
          <th scope="col">${escapeHtml(t('sport.records.best'))}</th>
          <th scope="col">${escapeHtml(t('sport.records.date'))}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* =========================================================
   Part 6. Body (moved from the Progress page; the data is in lifeos_sport.body)
   ========================================================= */

const BODY_CHECKPOINTS = [33, 66, 100]; // percent of the body goal; each one opens the next stage

// The goal that drives the silhouette: the first "measurements" goal that is not archived.
function bodyGoal(goals) {
  return goals
    .filter((goal) => goal.progressType === 'measurements' && goal.status !== 'archived')
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))[0] ?? null;
}

// Stage 1–4: it changes ONLY when a checkpoint (33%, 66%, 100%) of the goal is reached.
function bodyStage(percent) {
  return 1 + BODY_CHECKPOINTS.filter((checkpoint) => percent >= checkpoint).length;
}

function nextBodyCheckpoint(percent) {
  return BODY_CHECKPOINTS.find((checkpoint) => percent < checkpoint) ?? null;
}

// Words of the goal title, lower case, "ё" = "е" ("Увеличить бицепс до 38 см" -> ["увеличить", "бицепс", …]).
function titleWords(title) {
  return String(title ?? '').toLocaleLowerCase().replaceAll('ё', 'е').split(/[^\p{L}]+/u).filter(Boolean);
}

// Names of a parameter in all interface languages, as words: "Бёдра" -> "бедра".
function bodyFieldNames(key) {
  return Object.values(I18n.dictionaries).map((dictionary) => titleWords(dictionary[`progress.body.${key}`])[0]).filter(Boolean);
}

// The parameter named in the goal title. First the exact word ("бедро" = thigh, "бедра" = hips),
// then the same beginning of the word ("талию" matches "талия").
function bodyFieldFromTitle(goal) {
  const words = titleWords(goal?.title);
  const stem = (name) => (name.length > 4 ? name.slice(0, -1) : name);
  const exact = BODY_FIELDS.find(({ key }) => bodyFieldNames(key).some((name) => words.includes(name)));
  const similar = BODY_FIELDS.find(({ key }) => bodyFieldNames(key).some((name) => words.some((word) => word.startsWith(stem(name)))));
  return (exact ?? similar)?.key ?? null;
}

// The parameter of a body goal: named in the title, else a kg goal = weight, a cm goal = waist.
function bodyFieldForGoal(goal) {
  const fromTitle = bodyFieldFromTitle(goal);
  if (fromTitle) return fromTitle;
  return /^(cm|см)$/i.test(String(goal?.unit ?? '').trim()) ? 'waist' : 'weight';
}

// parameter -> +1 (the goal wants more) / -1 (the goal wants less). Parameters without a goal are not in the map.
function bodyGoalDirections(goals) {
  const directions = new Map();
  goals
    .filter((goal) => goal.progressType === 'measurements' && goal.status !== 'archived')
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
    .forEach((goal) => {
      const field = bodyFieldForGoal(goal);
      const sign = Math.sign((Number(goal.targetValue) || 0) - (Number(goal.startValue) || 0));
      if (sign !== 0 && !directions.has(field)) directions.set(field, sign);
    });
  return directions;
}

// A neutral figure from simple rounded shapes (head, body, arms, legs): no gender, no details.
// The stage is shown by how much of the figure is filled (1 = a quarter … 4 = all of it).
const BODY_PARTS = `
  <circle cx="60" cy="26" r="17"></circle>
  <rect x="38" y="48" width="44" height="88" rx="20"></rect>
  <rect x="21" y="54" width="13" height="78" rx="6.5"></rect>
  <rect x="86" y="54" width="13" height="78" rx="6.5"></rect>
  <rect x="41" y="122" width="17" height="98" rx="8.5"></rect>
  <rect x="62" y="122" width="17" height="98" rx="8.5"></rect>`;
const BODY_HEIGHT = 222;

function silhouetteSvg(stage, idSuffix, titleText = '') {
  const clipId = `body-clip-${idSuffix}`;
  const filled = Math.round((BODY_HEIGHT * stage) / 4);
  const title = titleText ? `<title>${escapeHtml(titleText)}</title>` : '';
  const role = titleText ? 'role="img"' : 'aria-hidden="true"';
  return `
    <svg class="body-svg" viewBox="0 0 120 ${BODY_HEIGHT}" ${role}>
      ${title}
      <defs><clipPath id="${clipId}">${BODY_PARTS}</clipPath></defs>
      <g clip-path="url(#${clipId})">
        <rect class="body-svg-base" x="0" y="0" width="120" height="${BODY_HEIGHT}"></rect>
        <rect class="body-svg-fill" x="0" y="${BODY_HEIGHT - filled}" width="120" height="${filled}"></rect>
      </g>
    </svg>`;
}

function renderSilhouette(goals) {
  const goal = bodyGoal(goals);
  const percent = goal ? getGoalPercent(goal) : 0;
  const stage = goal ? bodyStage(percent) : 1;
  const title = t('progress.body.stage', { stage, total: 4 });
  let caption = t('progress.body.noGoal');
  if (goal) {
    const next = nextBodyCheckpoint(percent);
    caption = t('progress.body.goalLine', { title: goal.title, percent: Format.number(percent / 100, { style: 'percent' }) });
    caption += ' ' + (next ? t('progress.body.next', { percent: `${next}%` }) : t('progress.body.allReached'));
  }
  const thumbs = [1, 2, 3, 4].map((number) => `
    <li class="${number === stage ? 'is-current' : ''}">${silhouetteSvg(number, number)}<span class="body-stage-number">${number}</span></li>`).join('');
  byId('body-figure').innerHTML = `
    <div class="body-figure-main">${silhouetteSvg(stage, 'main', title)}</div>
    <div class="body-figure-side">
      <strong class="body-stage-title">${escapeHtml(title)}</strong>
      <ol class="body-stages" aria-hidden="true">${thumbs}</ol>
    </div>
    <figcaption>
      <span>${escapeHtml(caption)}</span>
      <span class="body-disclaimer"><i class="bi bi-info-circle" aria-hidden="true"></i>${escapeHtml(t('progress.body.disclaimer'))}</span>
    </figcaption>`;
}

function buildBodyInputs() {
  byId('body-inputs').innerHTML = BODY_FIELDS.map(({ key, unit }) => `
    <div class="col-6">
      <label class="form-label" for="body-${key}">${escapeHtml(t(`progress.body.${key}`))}</label>
      <div class="input-group">
        <input class="form-control" type="text" id="body-${key}" inputmode="decimal" autocomplete="off">
        <span class="input-group-text">${escapeHtml(t(`progress.unit.${unit}`))}</span>
      </div>
      <p class="field-error" id="body-${key}-error"></p>
    </div>`).join('');
}

// Labels and units change with the language; the typed values stay.
function refreshBodyInputs() {
  BODY_FIELDS.forEach(({ key, unit }) => {
    const input = byId(`body-${key}`);
    input.closest('.col-6').querySelector('label').textContent = t(`progress.body.${key}`);
    input.closest('.input-group').querySelector('.input-group-text').textContent = t(`progress.unit.${unit}`);
  });
}

function bodyValueText(value, unit) {
  return value === null ? '—' : `${Format.number(value, { maximumFractionDigits: 1 })} ${t(`progress.unit.${unit}`)}`;
}

// The color of a difference: green towards the goal, orange away from it, gray without a goal (or 0).
function bodyDiffTone(diff, direction) {
  if (!direction || diff === 0) return 'is-neutral';
  return Math.sign(diff) === direction ? 'is-good' : 'is-bad';
}

// "−3,5 kg" / "+0,5 cm" / "0 cm": the sign is always written, the color only helps.
function bodyDiffHtml(diff, unit, direction) {
  if (diff === null) return '—';
  const number = Format.number(Math.abs(diff), { maximumFractionDigits: 1 });
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  return `<span class="body-diff ${bodyDiffTone(diff, direction)}">${sign}${escapeHtml(number)} ${escapeHtml(t(`progress.unit.${unit}`))}</span>`;
}

function fillBodySelect(select, entries, preferredId) {
  const labelOf = (entry) => {
    const sameDay = entries.filter((item) => item.date === entry.date);
    const position = sameDay.indexOf(entry) + 1;
    return sameDay.length > 1 ? `${Format.shortDate(entry.date)} (${position})` : Format.shortDate(entry.date);
  };
  select.replaceChildren(...entries.map((entry) => createEl('option', { value: entry.id }, labelOf(entry))));
  if (entries.some((entry) => entry.id === preferredId)) select.value = preferredId;
}

function renderBodyCompare(entries, directions) {
  const from = byId('body-from');
  const to = byId('body-to');
  byId('body-compare-controls').hidden = entries.length < 2;
  if (entries.length === 0) {
    byId('body-compare').innerHTML = emptyText('progress.body.empty');
    return;
  }
  // Default: the first measurement against the latest one.
  fillBodySelect(from, entries, from.value || entries[0].id);
  fillBodySelect(to, entries, to.value || entries[entries.length - 1].id);
  const fromEntry = entries.find((entry) => entry.id === from.value) ?? entries[0];
  const toEntry = entries.find((entry) => entry.id === to.value) ?? entries[entries.length - 1];
  // Only the parameters measured on at least one of the two dates.
  const rows = bodyDifference(fromEntry, toEntry).filter((row) => row.was !== null || row.now !== null).map((row) => `
    <tr>
      <th scope="row">${escapeHtml(t(`progress.body.${row.key}`))}</th>
      <td>${escapeHtml(bodyValueText(row.was, row.unit))}</td>
      <td>${escapeHtml(bodyValueText(row.now, row.unit))}</td>
      <td>${bodyDiffHtml(row.diff, row.unit, directions.get(row.key))}</td>
    </tr>`).join('');
  // .table-wrap: on a narrow phone the table scrolls inside the card instead of being cut.
  byId('body-compare').innerHTML = `
    <div class="table-wrap">
      <table class="data-table body-table">
        <thead><tr>
          <th scope="col">${escapeHtml(t('progress.body.measurement'))}</th>
          <th scope="col">${escapeHtml(t('progress.body.from'))}<span class="th-date">${escapeHtml(Format.shortDate(fromEntry.date))}</span></th>
          <th scope="col">${escapeHtml(t('progress.body.to'))}<span class="th-date">${escapeHtml(Format.shortDate(toEntry.date))}</span></th>
          <th scope="col">${escapeHtml(t('progress.body.difference'))}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="body-legend">${escapeHtml(t('progress.body.diffLegend'))}</p>`;
}

// "All measurements": the newest first (highlighted); only the parameters that were ever measured.
function renderBodyEntries(entries) {
  if (entries.length === 0) {
    byId('body-entries').innerHTML = emptyText('progress.body.empty');
    return;
  }
  const fields = BODY_FIELDS.filter(({ key }) => entries.some((entry) => Number.isFinite(entry[key])));
  const head = fields.map(({ key }) => `<th scope="col">${escapeHtml(t(`progress.body.${key}`))}</th>`).join('');
  const rows = [...entries].reverse().map((entry, index) => {
    const date = Format.shortDate(entry.date);
    const cells = fields.map(({ key, unit }) => `<td>${escapeHtml(bodyValueText(Number.isFinite(entry[key]) ? entry[key] : null, unit))}</td>`).join('');
    const latest = index === 0 ? ` <span class="badge-status is-accent">${escapeHtml(t('progress.body.latest'))}</span>` : '';
    return `
      <tr${index === 0 ? ' class="is-latest"' : ''}>
        <th scope="row">${escapeHtml(date)}${latest}</th>
        ${cells}
        <td class="cell-action">
          <button type="button" class="btn btn-icon" data-delete-body="${escapeHtml(entry.id)}"
                  aria-label="${escapeHtml(t('progress.body.delete', { date }))}" title="${escapeHtml(t('progress.body.delete', { date }))}">
            <i class="bi bi-trash" aria-hidden="true"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
  byId('body-entries').innerHTML = `
    <div class="table-wrap">
      <table class="data-table body-entries-table">
        <thead><tr><th scope="col">${escapeHtml(t('details.entry.date'))}</th>${head}<th scope="col"><span class="visually-hidden">${escapeHtml(t('progress.body.deleteColumn'))}</span></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderBodySync(goals) {
  const goal = bodyGoal(goals);
  byId('body-sync-row').hidden = !goal;
  if (goal) {
    const field = t(`progress.body.${bodyFieldForGoal(goal)}`).toLocaleLowerCase(I18n.locale());
    byId('body-sync-label').textContent = t('progress.body.sync', { field, title: goal.title });
  }
}

function renderBody(sport) {
  const goals = getGoals();
  const entries = sortBodyEntries(sport.body);
  renderBodySync(goals);
  renderBodyCompare(entries, bodyGoalDirections(goals));
  renderBodyEntries(entries);
  renderSilhouette(goals);
}

function saveBody(event) {
  event.preventDefault();
  const date = getDateValue(byId('body-date'));
  let dateError = validateDateValue(date);
  if (!dateError && Dates.parse(date) > Dates.today()) dateError = 'details.error.dateFuture';
  setFieldError(byId('body-date'), dateError);

  const values = {};
  let firstInvalid = dateError ? byId('body-date') : null;
  BODY_FIELDS.forEach(({ key, unit, min, max }) => {
    const input = byId(`body-${key}`);
    if (input.value.trim() === '') {
      setFieldError(input, null);
      return;
    }
    const value = readNumber(input);
    const isValid = Number.isFinite(value) && value >= min && value <= max;
    setFieldError(input, isValid ? null : `progress.body.error.${unit}`);
    if (isValid) values[key] = roundOne(value);
    else firstInvalid ??= input;
  });
  const isEmpty = Object.keys(values).length === 0 && !firstInvalid;
  setGroupError(byId('body-fields'), isEmpty ? 'progress.body.error.empty' : null);
  if (isEmpty) firstInvalid = byId('body-weight');
  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  const sport = getSport();
  const entry = { id: createId('body'), date, ...values };
  sport.body.push(entry);
  if (!saveSport(sport)) return;

  // Optionally the same number is recorded in the body goal (this can change the stage).
  const goal = bodyGoal(getGoals());
  const goalValue = goal ? values[bodyFieldForGoal(goal)] : undefined;
  if (goal && byId('body-sync').checked && goalValue !== undefined) recordProgress(goal.id, { date, value: goalValue });

  showToast('toast.bodySaved', 'success');
  BODY_FIELDS.forEach(({ key }) => { byId(`body-${key}`).value = ''; });
  byId('body-to').value = entry.id; // show the new measurement in the comparison
  renderSport();
  byId('body-weight').focus();
}

function deleteBody(id) {
  const sport = getSport();
  const remaining = sport.body.filter((entry) => entry.id !== id);
  if (remaining.length === sport.body.length) return;
  sport.body = remaining;
  if (!saveSport(sport)) return;
  showToast('toast.bodyDeleted', 'success');
  renderSport();
  byId('body-entries-title').focus();
}

/* =========================================================
   Part 7. Self-test of the pure functions: sport.html?debug=1
   ========================================================= */

function runSportSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const day = (iso) => Dates.parse(iso);
  let id = 0;
  const fixedId = (prefix) => `${prefix}-${++id}`;

  const old = [
    { kind: 'workout', date: '2026-11-02', exercise: 'Squat', sets: 3, reps: 5, weight: 80, note: '' },
    { kind: 'workout', date: '2026-11-02', exercise: 'Push-up', sets: 2, reps: 20, weight: null },
    { kind: 'body', goalId: null, value: 88, note: '', id: 'b1', date: '2026-11-01', weight: 88, waist: 96 },
    { goalId: 'g', date: '2026-11-03', value: 1 }
  ];
  const moved = convertOldSportEntries(old, fixedId);
  check('migration: one session per date', moved.sessions.length, 1);
  check('migration: exercises of the day', moved.sessions[0].exercises.length, 2);
  check('migration: sets copied as done', moved.sessions[0].exercises[0].sets.filter((set) => set.done).length, 3);
  check('migration: bodyweight stays empty', moved.sessions[0].exercises[1].sets[0].weight, null);
  check('migration: body keeps values, drops old fields', `${moved.body[0].weight}/${moved.body[0].waist}/${'kind' in moved.body[0]}`, '88/96/false');

  const session = (date, name, sets) => ({ date, exercises: [{ name, sets: sets.map(([weight, reps, done = true]) => ({ weight, reps, done })) }] });
  const sessions = [
    session('2026-11-02', 'Squat', [[80, 5], [80, 5], [85, 3, false]]),
    session('2026-11-05', 'squat', [[80, 8]]),
    session('2026-11-05', 'Push-ups', [[null, 20], [null, 25]]),
    session('2026-10-20', 'Squat', [[70, 5]])
  ];
  const nov = sportStats(sessions, day('2026-11-01'), day('2026-11-30'));
  check('stats: training days (two sessions on one day = 1)', nov.days, 2);
  check('stats: only finished sets', nov.sets, 5);
  check('stats: reps', nov.reps, 5 + 5 + 8 + 20 + 25);
  check('stats: volume', nov.volume, 80 * 18);
  const records = personalRecords(sessions);
  const squat = records.find((record) => exerciseKey(record.exercise) === 'squat');
  check('record: heaviest, more reps wins a tie, unfinished set ignored', `${squat.weight}x${squat.reps}`, '80x8');
  check('record: bodyweight = most reps', records.find((record) => exerciseKey(record.exercise) === 'push-ups').reps, 25);
  const before = personalRecords(sessions.slice(0, 1));
  check('new record: better reps at the same weight', improvedRecords(before, personalRecords(sessions.slice(0, 2))).length, 1);
  check('new record: a first exercise is not a record', improvedRecords(before, personalRecords(sessions.slice(0, 3))).filter((record) => exerciseKey(record.exercise) === 'push-ups').length, 0);

  const plan = { 1: { type: 'workout', title: 'Legs', exercises: [{ name: 'Squat', sets: 3, reps: 5, weight: 80 }] }, 7: { type: 'rest' } };
  const sport = { plan, sessions: [], current: null, body: [] };
  check('plan: Monday 2026-11-09', planForDate('2026-11-09', sport)?.title, 'Legs');
  check('plan: Sunday = day 7', planForDate('2026-11-15', sport)?.type, 'rest');
  check('day info: planned', sportDayInfo('2026-11-09', sport).state, 'planned');
  check('day info: rest', sportDayInfo('2026-11-15', sport).state, 'rest');
  check('day info: nothing planned', sportDayInfo('2026-11-10', sport).state, 'none');
  check('day info: done', sportDayInfo('2026-11-09', { ...sport, sessions: [{ date: '2026-11-09', title: 'Legs' }] }).state, 'done');
  const current = { date: '2026-11-09', title: 'Legs', exercises: [toWorkoutExercise(plan[1].exercises[0])] };
  current.exercises[0].sets[0].done = true;
  const progress = sportDayInfo('2026-11-09', { ...sport, current });
  check('day info: in progress 1 of 3', `${progress.state} ${progress.done}/${progress.total}`, 'inProgress 1/3');
  check('activity counts finished workouts', countActivityByDay([], [], [{ date: '2026-11-09' }, { date: '2026-11-09' }]).get('2026-11-09'), 2);

  const body = sortBodyEntries([{ date: '2026-11-01', weight: 88.5, waist: 96 }, { date: '2026-10-01', weight: 92, waist: 100 }]);
  check('body: sorted by date', body[0].date, '2026-10-01');
  check('body: weight difference', bodyDifference(body[0], body[1]).find((row) => row.key === 'weight').diff, -3.5);
  check('body: missing value -> no difference', bodyDifference(body[0], body[1]).find((row) => row.key === 'chest').diff, null);
  check('body: stage 2 at 33%', bodyStage(33), 2);
  check('body: field from title (inflected)', bodyFieldFromTitle({ title: 'Уменьшить талию до 80 см' }), 'waist');
  check('body: field from title (thigh, not hips)', bodyFieldFromTitle({ title: 'Накачать бедро' }), 'thigh');
  check('body: field from unit', bodyFieldForGoal({ title: 'Goal', unit: 'kg' }), 'weight');
  const directions = bodyGoalDirections([
    { progressType: 'measurements', status: 'active', title: 'Снизить вес до 80 кг', unit: 'кг', startValue: 92, targetValue: 80 },
    { progressType: 'measurements', status: 'active', title: 'Biceps 38 cm', unit: 'cm', startValue: 35, targetValue: 38 }
  ]);
  check('body: weight goal wants less', directions.get('weight'), -1);
  check('body: biceps goal wants more', directions.get('biceps'), 1);
  check('body: minus weight = good', bodyDiffTone(-1, -1), 'is-good');
  check('body: plus biceps = good, minus = bad', `${bodyDiffTone(0.5, 1)}/${bodyDiffTone(-0.5, 1)}`, 'is-good/is-bad');
  check('body: no goal or 0 = neutral', `${bodyDiffTone(-2, undefined)}/${bodyDiffTone(0, -1)}`, 'is-neutral/is-neutral');
  check('body: stage 4 at 100%', bodyStage(100), 4);
  check('body: next checkpoint', nextBodyCheckpoint(40), 66);
  check('body: cm goal uses the waist', bodyFieldForGoal({ unit: 'см' }), 'waist');
  check('series: weight points', weightSeries(body).map((point) => point.value).join(), '92,88.5');

  console.group('[LifeOS] Sport self-test (pure functions)');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} sport tests failed`);
  else console.info(`All ${results.length} sport tests passed`);
  console.groupEnd();
}

/* =========================================================
   Part 8. Start
   ========================================================= */

function bindSportEvents() {
  document.querySelectorAll('[data-sport-tab]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault(); // no reload: only the view changes
      showTab(link.dataset.sportTab);
      writeTabToAddress(link.dataset.sportTab);
    });
  });
  // Plan
  byId('sport-week').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-plan-edit]');
    const copy = event.target.closest('[data-plan-copy]');
    const clear = event.target.closest('[data-plan-clear]');
    if (edit) openDayDialog('plan', Number(edit.dataset.planEdit), edit.id);
    if (copy) copyPlanDay(Number(copy.dataset.planCopy), Number(copy.dataset.copyTo));
    if (clear) clearPlanDay(Number(clear.dataset.planClear), clear);
  });
  // Dialog
  byId('sport-day-form').addEventListener('submit', submitOnce(saveDayDialog));
  byId('sport-day-form').addEventListener('change', (event) => {
    if (event.target.name === 'sport-day-type') updateDayTypeFields();
  });
  byId('sport-ex-add').addEventListener('click', () => {
    setGroupError(byId('sport-ex-rows'), null);
    byId(`ex-name-${addExerciseRow()}`).focus();
  });
  byId('sport-ex-rows').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-ex-remove]');
    if (!remove) return;
    remove.closest('[data-ex-row]').remove();
    byId('sport-ex-add').focus();
  });
  byId('sport-day-modal').addEventListener('shown.bs.modal', () => {
    const first = sportState.dialog?.mode === 'plan' ? byId('sport-day-form').querySelector('[name="sport-day-type"]:checked') : byId('sport-day-title');
    first?.focus();
  });
  byId('sport-day-modal').addEventListener('hidden.bs.modal', () => {
    byId(sportState.dialog?.returnFocusId ?? '')?.focus();
  });
  // Today
  const today = byId('sport-today');
  today.addEventListener('click', (event) => {
    if (event.target.closest('#sport-start')) startPlannedWorkout();
    if (event.target.closest('#sport-adhoc')) openDayDialog('adhoc', null, 'sport-adhoc');
    if (event.target.closest('#sport-finish')) finishWorkout();
    const cancel = event.target.closest('#sport-cancel');
    if (cancel) cancelWorkout(cancel);
    const add = event.target.closest('[data-add-set]');
    if (add) addSet(Number(add.dataset.addSet));
  });
  today.addEventListener('change', (event) => {
    if (event.target.matches('[data-set]')) updateSet(event.target);
    if (event.target.matches('[data-set-field="done"]')) showErrorText(byId('sport-finish-error'), null);
  });
  // Journal
  byId('sport-log-filter').addEventListener('change', () => renderLog(getSport()));
  byId('sport-log').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-session]');
    if (button) deleteSession(button.dataset.deleteSession, button);
  });
  // Body
  byId('body-form').addEventListener('submit', submitOnce(saveBody));
  byId('body-inputs').addEventListener('input', () => setGroupError(byId('body-fields'), null));
  byId('body-from').addEventListener('change', () => renderBody(getSport()));
  byId('body-to').addEventListener('change', () => renderBody(getSport()));
  byId('body-entries').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-body]');
    if (button) deleteBody(button.dataset.deleteBody);
  });
  document.addEventListener('lifeos:languagechange', () => {
    refreshBodyInputs();
    renderSport();
  });
}

onAppReady(() => {
  if (!byId('sport-week')) return;
  if (new URLSearchParams(window.location.search).get('debug') === '1') runSportSelfTest();
  buildBodyInputs();
  setDateValue(byId('body-date'), sportToday());
  bindSportEvents();
  const tab = tabFromAddress();
  showTab(tab);
  writeTabToAddress(tab); // shows ?tab=… from the start (and turns an old #body into ?tab=body)
  renderSport();
});
