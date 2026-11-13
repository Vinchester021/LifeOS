// LifeOS — help for new users (all 7 pages).
//   1. Demo mode: "See an example first" in the first-run dialog fills the demo data and shows a banner
//      "This is example data. Start your own plan →" on every page (only that button turns it on).
//   2. First steps (Dashboard): 5 steps checked by the real data (firstStepsStatus — pure, self-test).
//   3. Tour: short tips with a dimmed page and a highlighted element (no libraries).
//   4. Help tips "?": Bootstrap popovers with a short explanation.
// The state lives in lifeos_settings.onboarding, so it is exported, imported and reset with the settings.
// The demo data (also used by goals.html?debug=1) is created here too.
'use strict';

/* =========================================================
   1. State: lifeos_settings.onboarding = { demoMode, checklistHidden, ... } (all true / false)
   ========================================================= */

const ONBOARDING_FLAGS = ['demoMode', 'checklistHidden', 'checklistCelebrated', 'visitedProgress', 'tourDone', 'tourPending', 'progressTourDone'];

function getOnboarding() {
  const value = getSettings().onboarding;
  return isPlainObject(value) ? value : {};
}

function updateOnboarding(changes) {
  return updateSettings({ onboarding: { ...getOnboarding(), ...changes } });
}

// Only known flags, only true / false (an imported file may contain anything).
function cleanOnboarding(value) {
  if (!isPlainObject(value)) return {};
  const clean = {};
  ONBOARDING_FLAGS.forEach((flag) => {
    if (typeof value[flag] === 'boolean') clean[flag] = value[flag];
  });
  return clean;
}

function isDemoMode() {
  return getOnboarding().demoMode === true;
}

/* =========================================================
   2. Demo data: goals of every type, their history, tasks, workouts, measurements, a week plan.
   Titles are taken in the current language once and then saved as normal user data.
   ========================================================= */

function createDemoGoals() {
  const today = Dates.today();
  const inDays = (count) => Dates.toISO(Dates.addDays(today, count));
  const daysAgo = (count) => new Date(Date.now() - count * MS_PER_DAY).toISOString();
  const goal = (fields) => ({
    id: createId('goal'),
    description: '',
    startValue: 0,
    currentValue: 0,
    unit: '',
    levels: [],
    checklist: [],
    milestones: [],
    deadline: null,
    status: 'active',
    ...fields,
    updatedAt: fields.createdAt
  });
  const item = (key, done) => ({ id: createId('item'), text: t(key), done });

  return [
    goal({ title: t('demo.finance.title'), category: 'finance', icon: 'bi-piggy-bank', color: 'teal',
      progressType: 'money', targetValue: 10000000, currentValue: 3200000, unit: 'KZT',
      deadline: inDays(290), createdAt: daysAgo(70) }),
    goal({ title: t('demo.books.title'), category: 'books', icon: 'bi-book', color: 'clay',
      progressType: 'number', targetValue: 13, currentValue: 5, unit: t('demo.books.unit'),
      deadline: inDays(200), createdAt: daysAgo(60) }),
    goal({ title: t('demo.languages.title'), category: 'languages', icon: 'bi-translate', color: 'blue',
      progressType: 'levels', levels: ['A2', 'B1', 'B2', 'C1'], startValue: 0, targetValue: 3, currentValue: 1,
      deadline: inDays(320), createdAt: daysAgo(50) }),
    goal({ title: t('demo.projects.title'), category: 'projects', icon: 'bi-kanban', color: 'plum',
      progressType: 'checklist',
      checklist: [item('demo.projects.item1', true), item('demo.projects.item2', false), item('demo.projects.item3', false)],
      deadline: inDays(150), createdAt: daysAgo(40) }),
    goal({ title: t('demo.health.title'), category: 'health', icon: 'bi-heart-pulse', color: 'green',
      progressType: 'measurements', startValue: 92, targetValue: 80, currentValue: 86.5, unit: t('demo.health.unit'),
      deadline: inDays(120), createdAt: daysAgo(30) }),
    goal({ title: t('demo.habit.title'), category: 'personal', icon: 'bi-sunrise', color: 'clay',
      progressType: 'streak', targetValue: 100, currentValue: 12, unit: t('demo.habit.unit'),
      deadline: inDays(-3), createdAt: daysAgo(20) }),
    goal({ title: t('demo.course.title'), category: 'education', icon: 'bi-mortarboard', color: 'blue',
      progressType: 'percent', targetValue: 100, currentValue: 100, status: 'completed',
      deadline: inDays(-10), createdAt: daysAgo(90) }),
    goal({ title: t('demo.portfolio.title'), category: 'career', icon: 'bi-briefcase', color: 'teal',
      progressType: 'percent', targetValue: 100, currentValue: 40, status: 'archived',
      deadline: inDays(-30), createdAt: daysAgo(100) })
  ];
}

// History for the demo goals. The numbers add up to the demo currentValue
// (3 200 000 ₸, 5 books, B1, 86.5 kg, 12 days in a row).
function createDemoEntries(goals) {
  const today = Dates.today();
  const find = (category) => goals.find((goal) => goal.category === category);
  const entry = (goal, daysAgo, value, extra = {}) => ({
    id: createId('entry'),
    date: Dates.toISO(Dates.addDays(today, -daysAgo)),
    goalId: goal.id,
    value,
    note: '',
    ...extra
  });
  const finance = find('finance');
  const books = find('books');
  const health = find('health');
  const habit = find('personal');
  return [
    entry(finance, 60, 1500000), entry(finance, 30, 1000000), entry(finance, 5, 700000),
    ...[52, 41, 30, 19, 8].map((daysAgo) => entry(books, daysAgo, 1, { pages: 320 })),
    entry(books, 2, 0, { pages: 45 }),
    entry(find('languages'), 25, 1),
    entry(health, 25, 90), entry(health, 12, 88), entry(health, 2, 86.5),
    ...Array.from({ length: 12 }, (_, index) => entry(habit, index + 1, 1)),
    // Workouts (no goal): squat and push-ups during the last weeks
    ...[[20, 70], [13, 75], [6, 80], [1, 80]].map(([daysAgo, weight]) => demoWorkout(daysAgo, t('demo.workout.squat'), 3, 5, weight)),
    demoWorkout(3, t('demo.workout.pushups'), 3, 15, null),
    // Body measurements (no goal), the same weights as the weight goal history
    demoBodyMeasure(25, { weight: 90, waist: 98, belly: 101, chest: 106, hips: 104, biceps: 34, thigh: 60, calf: 39 }),
    demoBodyMeasure(12, { weight: 88, waist: 96, belly: 99, chest: 105, hips: 103 }),
    demoBodyMeasure(2, { weight: 86.5, waist: 94, belly: 97, chest: 105, hips: 102, biceps: 35, thigh: 59, calf: 39 })
  ];
}

function demoBodyMeasure(daysAgo, values) {
  return {
    id: createId('body'), kind: 'body', goalId: null, note: '',
    date: Dates.toISO(Dates.addDays(Dates.today(), -daysAgo)),
    ...values, value: values.weight
  };
}

function demoWorkout(daysAgo, exercise, sets, reps, weight) {
  return {
    id: createId('workout'), kind: 'workout', goalId: null,
    date: Dates.toISO(Dates.addDays(Dates.today(), -daysAgo)),
    exercise, sets, reps, weight, note: '', value: sets * reps
  };
}

// Demo week plan for the Sport page: 3 workouts, rest days in between.
function createDemoSportPlan() {
  const exercise = (nameKey, sets, reps, weight) => ({ id: createId('ex'), name: t(nameKey), sets, reps, weight, note: '' });
  const fullBody = () => ({
    type: 'workout', title: t('demo.sport.fullBody'),
    exercises: [exercise('demo.workout.squat', 3, 5, 80), exercise('demo.workout.pushups', 3, 15, null)]
  });
  return {
    1: fullBody(),
    2: { type: 'rest' },
    3: { type: 'workout', title: t('demo.sport.upper'),
         exercises: [exercise('demo.workout.bench', 4, 8, 60), exercise('demo.workout.pushups', 3, 15, null)] },
    4: fullBody(),
    5: { type: 'rest' },
    6: { type: 'workout', title: t('demo.sport.legs'), exercises: [exercise('demo.workout.squat', 4, 8, 70)] },
    7: { type: 'rest' }
  };
}

// A few tasks linked to the demo goals: one daily, one weekly, one one-time.
function createDemoTasks(goals) {
  const today = Dates.toISO(Dates.today());
  const find = (category) => goals.find((goal) => goal.category === category);
  const task = (fields) => normalizeTask({ id: createId('task'), date: today, ...fields });
  return [
    task({ title: t('demo.task.read'), priority: 'medium', category: 'books', goalId: find('books').id, recurrence: 'daily' }),
    task({ title: t('demo.task.save'), priority: 'high', category: 'finance', goalId: find('finance').id, recurrence: 'weekly', period: 'week' }),
    task({ title: t('demo.task.exam'), priority: 'high', category: 'languages', goalId: find('languages').id,
      date: Dates.toISO(Dates.addDays(Dates.today(), 14)) })
  ];
}

// Writes all demo data. Returns true when everything was saved.
// It does NOT turn on the demo mode: only the first-run button does (DemoMode.start).
function fillDemoData() {
  const goals = createDemoGoals();
  if (!saveGoals(goals) || !saveProgressEntries(createDemoEntries(goals)) || !saveTasks(createDemoTasks(goals))) return false;
  // Demo workouts and measurements are written the old way and moved to Sport like real old data.
  AppStorage.remove(STORAGE_KEYS.sport);
  migrateSportData();
  return saveSport({ ...getSport(), plan: createDemoSportPlan() });
}

/* =========================================================
   3. Demo mode: the first-run button, the banner, leaving the example
   ========================================================= */

const DemoMode = {
  // "See an example first": a guest profile, the demo data, the banner.
  start() {
    const today = Dates.today();
    const yearStart = Dates.addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -2); // the charts have data
    const profile = {
      name: t('onboarding.demo.guest'),
      language: I18n.lang,
      theme: Theme.current(),
      personalYearStart: Dates.toISO(yearStart),
      createdAt: new Date().toISOString()
    };
    if (!AppStorage.set(STORAGE_KEYS.profile, profile)) return;
    FirstRun.removePreferenceCopies();
    if (!fillDemoData() || !updateOnboarding({ demoMode: true })) return;
    window.location.reload(); // every block of the page is drawn again with the example
  },

  renderBanner() {
    document.getElementById('demo-banner')?.remove();
    if (!isDemoMode()) return;
    const banner = createEl('div', { class: 'demo-banner', id: 'demo-banner', role: 'status' });
    banner.innerHTML = `
      <i class="bi bi-eye" aria-hidden="true"></i>
      <p>${escapeHtml(t('onboarding.demo.banner'))}</p>
      <button type="button" class="btn btn-sm demo-banner-btn" id="demo-exit">
        ${escapeHtml(t('onboarding.demo.exit'))}<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i>
      </button>`;
    document.querySelector('main')?.prepend(banner);
    byId('demo-exit').addEventListener('click', () => this.askToExit());
  },

  // "Delete the example?" — a small dialog, created once.
  askToExit() {
    let modal = byId('demo-exit-modal');
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="demo-exit-modal" tabindex="-1" aria-labelledby="demo-exit-title" aria-describedby="demo-exit-text">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h2 class="modal-title fs-5" id="demo-exit-title" data-i18n="onboarding.demo.confirmTitle"></h2>
                <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
              </div>
              <div class="modal-body"><p class="mb-0" id="demo-exit-text" data-i18n="onboarding.demo.confirmText"></p></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-tool" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
                <button type="button" class="btn btn-primary" id="demo-exit-confirm" data-i18n="onboarding.demo.confirm"></button>
              </div>
            </div>
          </div>
        </div>`);
      modal = byId('demo-exit-modal');
      I18n.apply(modal);
      byId('demo-exit-confirm').addEventListener('click', () => this.exit());
      modal.addEventListener('hidden.bs.modal', () => byId('demo-exit')?.focus());
    }
    bootstrap.Modal.getOrCreateInstance(modal).show();
  },

  // Deletes ALL LifeOS data except the language and the theme — allowed only in the demo mode.
  // The onboarding state is not kept either: the real profile starts the checklist and the tour again.
  exit() {
    if (!isDemoMode()) return;
    const keep = { language: I18n.lang, theme: Theme.current() };
    Object.values(STORAGE_KEYS).forEach((key) => AppStorage.remove(key));
    AppStorage.set(STORAGE_KEYS.settings, keep); // before a profile exists, language and theme live here
    window.location.href = 'index.html'; // the first-run dialog opens
  },

  bindFirstRunButton() {
    document.querySelectorAll('[data-demo-start]').forEach((button) => {
      button.addEventListener('click', submitOnce(() => this.start()));
    });
  }
};

/* =========================================================
   4. First steps (Dashboard): 5 steps, checked by the real data
   ========================================================= */

// Pure: data in, steps out: [{ key, done }] — the order is the order on the card (the actions: FirstSteps.run).
function hasGoalResult(goals, entries) {
  const hasEntry = entries.some((entry) => typeof entry.goalId === 'string' && entry.goalId !== '');
  return hasEntry || goals.some((goal) => asArray(goal.checklist).some((item) => item?.done === true));
}

function firstStepsStatus({ goals, tasks, entries, visitedProgress, today }) {
  const todayIso = Dates.toISO(Dates.parse(today));
  return [
    { key: 'goal', done: goals.some((goal) => goal.status !== 'archived') },
    { key: 'task', done: getTasksForDate(todayIso, tasks).length > 0 },
    { key: 'tick', done: taskCompletionDates(tasks).length > 0 },
    { key: 'result', done: hasGoalResult(goals, entries) }, // an entry for a goal or a ticked checklist item
    { key: 'progress', done: visitedProgress === true }
  ];
}

// Scrolls to an element (smoothly, if motion is allowed), focuses it and highlights it for 2 seconds.
function spotlight(element) {
  if (!element) return;
  const smooth = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  element.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
  element.focus({ preventScroll: true });
  element.classList.add('is-spotlight');
  setTimeout(() => element.classList.remove('is-spotlight'), 2000);
}

// Computer: a stepper of 5 pills + the block of one step. Phone: an accordion.
// The markup is drawn for the current width and drawn again when the width crosses 768px.
const FIRST_STEPS_PHONE = window.matchMedia('(max-width: 767.98px)');

const FirstSteps = {
  doneKeys: null, // steps done at the last drawing: a step done since then gets the tick animation
  selectedKey: null, // the step in the block / open in the accordion; null = the first open step; '' = all closed (phone)
  placed: false, // index.html#first-steps scrolls to the card once

  // The card shows for a real profile until it is hidden or everything is done.
  render() {
    const card = byId('first-steps');
    if (!card) return;
    const state = getOnboarding();
    if (!getProfile() || state.demoMode || state.checklistHidden || state.checklistCelebrated) {
      card.hidden = true;
      return;
    }
    const steps = firstStepsStatus({
      goals: getGoals(), tasks: getTasks(), entries: getProgressEntries(),
      visitedProgress: state.visitedProgress, today: Dates.today()
    });
    const doneKeys = steps.filter((step) => step.done).map((step) => step.key);
    const justDone = this.doneKeys ? doneKeys.filter((key) => !this.doneKeys.includes(key)) : [];
    this.doneKeys = doneKeys;
    if (doneKeys.length === steps.length) {
      card.hidden = true;
      updateOnboarding({ checklistCelebrated: true });
      showToast('onboarding.steps.congrats', 'success');
      return;
    }
    card.hidden = false;
    this.chooseStep(steps, justDone.length > 0);
    this.renderCount(doneKeys.length, steps.length);
    byId('first-steps-body').innerHTML = FIRST_STEPS_PHONE.matches
      ? this.accordionHtml(steps, justDone)
      : this.stepperHtml(steps, justDone) + this.blockHtml(steps);
    this.scrollToCardOnce(card);
  },

  // A step was just done (or nothing is chosen): the first open step. A done step cannot be open on a phone.
  chooseStep(steps, stepWasDone) {
    const firstOpen = steps.find((step) => !step.done).key;
    const chosen = steps.find((step) => step.key === this.selectedKey);
    const phone = FIRST_STEPS_PHONE.matches;
    if (stepWasDone || this.selectedKey === null) this.selectedKey = firstOpen;
    else if (phone && chosen?.done) this.selectedKey = firstOpen;
    else if (!phone && !chosen) this.selectedKey = firstOpen; // '' (all closed on a phone) means nothing here
  },

  renderCount(done, total) {
    byId('first-steps-count').textContent = t('onboarding.steps.count', { done, total });
    const bar = byId('first-steps-bar');
    bar.setAttribute('aria-valuenow', String(done));
    bar.setAttribute('aria-valuemax', String(total));
    bar.querySelector('.progress-bar').style.width = `${(done / total) * 100}%`;
  },

  // "1" in a circle, or a tick for a done step
  markHtml(step, number, extraClass = '') {
    return `<span class="fs-mark${extraClass}" aria-hidden="true">${step.done ? '<i class="bi bi-check-lg"></i>' : number}</span>`;
  },

  // The main button of a step: "Create a goal →". Step 5 opens another page, so it is a link.
  // A done step has "Done ✓" instead.
  actionHtml(step, wide = false) {
    if (step.done) {
      return `<p class="fs-done">${escapeHtml(t('onboarding.steps.done'))}<i class="bi bi-check-lg" aria-hidden="true"></i></p>`;
    }
    const label = `<span>${escapeHtml(t(`onboarding.steps.${step.key}.button`))}</span><i class="bi bi-arrow-right ms-2" aria-hidden="true"></i>`;
    const css = `btn btn-primary fs-action${wide ? ' w-100' : ''}`;
    if (step.key === 'progress') return `<a class="${css}" href="progress.html?from=onboarding">${label}</a>`;
    return `<button type="button" class="${css}" data-first-step="${step.key}">${label}</button>`;
  },

  // Computer: 5 pills joined by a line. A click shows that step in the block below (aria-current="step").
  stepperHtml(steps, justDone) {
    const pills = steps.map((step, index) => {
      const isCurrent = step.key === this.selectedKey;
      const css = ['fs-pill', step.done && 'is-done', isCurrent && 'is-current', justDone.includes(step.key) && 'is-new']
        .filter(Boolean).join(' ');
      const doneText = step.done ? `<span class="visually-hidden">${escapeHtml(t('onboarding.steps.done'))}</span>` : '';
      return `
        <li class="${step.done ? 'is-done' : ''}">
          <button type="button" class="${css}" id="fs-pill-${step.key}" data-fs-select="${step.key}" aria-controls="fs-block"${isCurrent ? ' aria-current="step"' : ''}>
            ${this.markHtml(step, index + 1)}<span>${escapeHtml(t(`onboarding.steps.${step.key}.short`))}</span>${doneText}
          </button>
        </li>`;
    }).join('');
    return `<ol class="fs-stepper">${pills}</ol>`;
  },

  // Computer: the chosen step — number, title, hint, the main button
  blockHtml(steps) {
    const index = steps.findIndex((step) => step.key === this.selectedKey);
    const step = steps[index];
    return `
      <div class="fs-block${step.done ? ' is-done' : ''}" id="fs-block">
        ${this.markHtml(step, index + 1, ' fs-mark-lg')}
        <div class="fs-block-text">
          <h3 class="fs-block-title">${escapeHtml(t(`onboarding.steps.${step.key}`))}</h3>
          <p class="fs-hint">${escapeHtml(t(`onboarding.steps.${step.key}.hint`))}</p>
        </div>
        ${this.actionHtml(step)}
      </div>`;
  },

  // Phone: one open step (title, hint, a full-width button); the others closed (number, title, ▾).
  // Done steps: a tick and a muted title, they do not open.
  accordionHtml(steps, justDone) {
    const items = steps.map((step, index) => {
      const title = escapeHtml(t(`onboarding.steps.${step.key}`));
      if (step.done) {
        return `
          <li class="fs-item is-done${justDone.includes(step.key) ? ' is-new' : ''}">
            <div class="fs-item-head">
              ${this.markHtml(step, index + 1)}<span class="fs-item-title">${title}</span>
              <span class="visually-hidden">${escapeHtml(t('onboarding.steps.done'))}</span>
            </div>
          </li>`;
      }
      const isOpen = step.key === this.selectedKey;
      return `
        <li class="fs-item${isOpen ? ' is-open' : ''}">
          <h3 class="fs-item-heading">
            <button type="button" class="fs-item-head" id="fs-toggle-${step.key}" data-fs-select="${step.key}" aria-expanded="${isOpen}" aria-controls="fs-item-${step.key}">
              ${this.markHtml(step, index + 1)}<span class="fs-item-title">${title}</span>
              <i class="bi bi-chevron-down fs-chevron" aria-hidden="true"></i>
            </button>
          </h3>
          <div class="fs-item-body" id="fs-item-${step.key}"${isOpen ? '' : ' hidden'}>
            <p class="fs-hint">${escapeHtml(t(`onboarding.steps.${step.key}.hint`))}</p>
            ${this.actionHtml(step, true)}
          </div>
        </li>`;
    }).join('');
    return `<ol class="fs-accordion">${items}</ol>`;
  },

  // A pill shows its step; on a phone a tap opens the step (or closes the open one).
  select(key) {
    const phone = FIRST_STEPS_PHONE.matches;
    this.selectedKey = phone && this.selectedKey === key ? '' : key;
    this.render();
    byId(phone ? `fs-toggle-${key}` : `fs-pill-${key}`)?.focus(); // the markup was drawn again
  },

  scrollToCardOnce(card) {
    if (this.placed || window.location.hash !== '#first-steps') return;
    this.placed = true;
    card.scrollIntoView({ block: 'start' });
    byId('first-steps-title').focus({ preventScroll: true });
  },

  // The actions of steps 1–4 (step 5 is a link to progress.html?from=onboarding).
  run(key, button) {
    if (key === 'goal') this.openWizard();
    if (key === 'task') spotlight(byId('dash-task'));
    if (key === 'tick') {
      // the first task of today that is not done; no tasks yet — first add one (as step 2)
      const box = document.querySelector('#dash-today-tasks [data-task-toggle]:not(:checked)');
      spotlight(box || byId('dash-task'));
    }
    if (key === 'result') QuickEntry.open(button); // js/entry-form.js
  },

  // The goal wizard right on the Dashboard (js/goal-wizard.js). After saving we stay here:
  // dashboard.js redraws the page on "lifeos:goalschange".
  openWizard() {
    if (typeof GoalWizard === 'undefined' || !window.bootstrap) {
      window.location.href = 'goals.html#new';
      return;
    }
    GoalWizard.init();
    GoalWizard.modalEl.addEventListener('hidden.bs.modal', () => this.focusAfter(), { once: true });
    GoalWizard.openCreate();
  },

  // After the wizard: the button of the step now shown (the next one, if the goal was saved), or the title.
  focusAfter() {
    const target = document.querySelector('#first-steps .fs-action');
    (target && !byId('first-steps').hidden ? target : document.querySelector('.page-title'))?.focus();
  },

  bind() {
    const card = byId('first-steps');
    if (!card) return;
    byId('first-steps-hide').addEventListener('click', () => {
      updateOnboarding({ checklistHidden: true });
      card.hidden = true;
      document.querySelector('.page-title')?.focus();
    });
    card.addEventListener('click', (event) => {
      const pill = event.target.closest('[data-fs-select]');
      if (pill) this.select(pill.dataset.fsSelect);
      const button = event.target.closest('[data-first-step]');
      if (button) this.run(button.dataset.firstStep, button);
    });
    // The width crossed 768px: stepper <-> accordion
    FIRST_STEPS_PHONE.addEventListener('change', () => this.render());
  }
};

/* =========================================================
   5. Tours: dimmed page + a highlighted element + a small dialog. Steps whose element is not
   visible are skipped (on a phone the menu step points to ☰ and its text says so).
   Two tours with one engine: the Dashboard (after the profile is created) and the Progress page
   (from First steps → step 5, once; again from Settings → Help).
   ========================================================= */

const TOUR_STEPS = [
  { key: 'menu', target: '.sidebar-nav', phoneTarget: '.mobile-bar [data-bs-target="#sidebar"]', phoneKey: 'menuPhone' },
  { key: 'newGoal', target: '.dash-actions .btn-primary' },
  { key: 'today', target: '[aria-labelledby="today-card-title"]' },
  { key: 'focus', target: '[aria-labelledby="focus-card-title"]' },
  { key: 'planner', target: '.sidebar-nav a[href="planner.html"]' },
  { key: 'progress', target: '.sidebar-nav a[href="progress.html"]' }
];

// The last step: "Step done! You can go back…" when the user came from First steps (stepDoneKey).
const PROGRESS_TOUR_STEPS = [
  { key: 'period', target: '[data-tour="period"]' }, // the period type + the navigator: one frame around both
  { key: 'kpi', target: '#summary-cards' },
  { key: 'charts', target: '[aria-labelledby="charts-title"]' },
  { key: 'summary', target: '[data-tour="year-summary"]' },
  {
    key: 'home', target: '.sidebar-nav a[href="index.html"]', phoneTarget: '.mobile-bar [data-bs-target="#sidebar"]',
    phoneKey: 'homePhone', stepDoneKey: 'homeDone', stepDonePhoneKey: 'homeDonePhone'
  }
];

// steps, the prefix of the texts, the state saved when the tour ends
const TOURS = {
  dashboard: { steps: TOUR_STEPS, prefix: 'onboarding.tour', doneState: { tourDone: true, tourPending: false } },
  progress: { steps: PROGRESS_TOUR_STEPS, prefix: 'onboarding.progressTour', doneState: { progressTourDone: true } }
};

function isShown(element) {
  if (!element) return false;
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
}

// All visible elements of a selector (a step can highlight several: the frame goes around all of them).
function shownElements(selector) {
  return selector ? [...document.querySelectorAll(selector)].filter(isShown) : [];
}

// One rectangle around several elements
function unionBox(elements) {
  const boxes = elements.map((element) => element.getBoundingClientRect());
  const top = Math.min(...boxes.map((box) => box.top));
  const left = Math.min(...boxes.map((box) => box.left));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  const right = Math.max(...boxes.map((box) => box.right));
  return { top, left, bottom, right, width: right - left, height: bottom - top };
}

const Tour = {
  tour: TOURS.dashboard,
  steps: [],
  index: 0,
  root: null,
  returnFocus: null,

  // The steps that can be shown on this screen. stepDone: the user came from First steps.
  collectSteps(stepDone) {
    return this.tour.steps.map((step) => {
      const elements = shownElements(step.target);
      if (elements.length) return { ...step, elements, textKey: (stepDone && step.stepDoneKey) || step.key };
      const phone = shownElements(step.phoneTarget);
      if (phone.length) return { ...step, elements: phone, textKey: (stepDone && step.stepDonePhoneKey) || step.phoneKey };
      return null; // not visible here: skipped
    }).filter(Boolean);
  },

  // name: "dashboard" or "progress" (TOURS)
  start(name = 'dashboard', { stepDone = false } = {}) {
    if (this.root) return;
    if (name === 'progress' && byId('summary-view')?.hidden === false) return; // the year summary is open instead
    this.tour = TOURS[name];
    this.stepDone = stepDone;
    this.steps = this.collectSteps(stepDone);
    if (this.steps.length === 0) return this.finish();
    this.returnFocus = document.activeElement;
    this.build();
    this.show(0);
  },

  build() {
    this.root = createEl('div', { class: 'tour', id: 'tour' });
    this.root.innerHTML = `
      <div class="tour-blocker"></div>
      <div class="tour-spot" aria-hidden="true"></div>
      <div class="tour-tip" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text" tabindex="-1">
        <p class="tour-count" id="tour-count"></p>
        <h2 class="tour-title" id="tour-title"></h2>
        <p class="tour-text" id="tour-text"></p>
        <div class="tour-actions">
          <button type="button" class="btn btn-link tour-skip" data-tour-action="skip">${escapeHtml(t('onboarding.tour.skip'))}</button>
          <button type="button" class="btn btn-tool btn-sm" data-tour-action="back">${escapeHtml(t('onboarding.tour.back'))}</button>
          <button type="button" class="btn btn-primary btn-sm" data-tour-action="next"></button>
        </div>
      </div>`;
    document.body.append(this.root);
    this.root.addEventListener('click', (event) => {
      const action = event.target.closest('[data-tour-action]')?.dataset.tourAction;
      if (action === 'skip') this.finish();
      if (action === 'back') this.show(this.index - 1);
      if (action === 'next') (this.index === this.steps.length - 1 ? this.finish() : this.show(this.index + 1));
    });
    this.onKey = (event) => this.handleKey(event);
    this.onMove = () => this.place();
    this.onResize = () => this.refresh();
    document.addEventListener('keydown', this.onKey, true);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('scroll', this.onMove, { passive: true });
  },

  // The window size changed: the elements may be other ones now (the menu or ☰), so the steps are
  // collected again; the same step stays open, its texts and the frame are updated (no scrolling).
  refresh() {
    if (!this.root) return;
    const key = this.steps[this.index]?.key;
    const steps = this.collectSteps(this.stepDone);
    if (steps.length === 0) return;
    this.steps = steps;
    this.index = Math.max(0, steps.findIndex((step) => step.key === key));
    this.fillTexts();
    this.place();
  },

  fillTexts() {
    const step = this.steps[this.index];
    byId('tour-count').textContent = t('onboarding.tour.count', { step: this.index + 1, total: this.steps.length });
    byId('tour-title').textContent = t(`${this.tour.prefix}.${step.key}.title`);
    byId('tour-text').textContent = t(`${this.tour.prefix}.${step.textKey}`);
    this.root.querySelector('[data-tour-action="back"]').hidden = this.index === 0;
    this.root.querySelector('[data-tour-action="next"]').textContent = t(this.index === this.steps.length - 1 ? 'onboarding.tour.done' : 'onboarding.tour.next');
  },

  show(index) {
    this.index = Math.max(0, Math.min(index, this.steps.length - 1));
    const step = this.steps[this.index];
    const tip = this.root.querySelector('.tour-tip');
    this.fillTexts();
    this.scrollTo(step.elements);
    this.place();
    // Measure again once the page has settled after the scroll (sticky bars, late images)
    requestAnimationFrame(() => this.place());
    setTimeout(() => this.place(), 300);
    tip.focus(); // a screen reader reads the counter, the title and the text
  },

  // Computer: the elements in the middle of the screen.
  // Phone: the elements right under the top bar, so the bottom sheet covers as little of them as possible.
  scrollTo(elements) {
    const box = unionBox(elements);
    if (!window.matchMedia('(max-width: 767.98px)').matches) {
      if (elements.length === 1) elements[0].scrollIntoView({ block: 'center', inline: 'nearest' });
      else window.scrollBy(0, box.top + box.height / 2 - window.innerHeight / 2);
      return;
    }
    const barHeight = document.querySelector('.mobile-bar')?.offsetHeight || 0;
    window.scrollBy(0, box.top - barHeight - 12);
  },

  // The spot covers the element (its huge shadow dims the rest); the tip goes next to it.
  // On a phone the tip is a sheet at the bottom of the screen (CSS).
  place() {
    const step = this.steps[this.index];
    if (!step || !this.root) return;
    const box = unionBox(step.elements);
    const pad = 6;
    const spot = this.root.querySelector('.tour-spot');
    Object.assign(spot.style, {
      top: `${box.top - pad}px`, left: `${box.left - pad}px`, width: `${box.width + pad * 2}px`, height: `${box.height + pad * 2}px`
    });
    const tip = this.root.querySelector('.tour-tip');
    if (window.matchMedia('(max-width: 767.98px)').matches) {
      tip.style.top = tip.style.left = '';
      return;
    }
    const gap = 14;
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const roomRight = window.innerWidth - box.right;
    let top;
    let left;
    if (roomRight > width + gap * 2 && box.left < window.innerWidth / 3) { // the menu: to the right
      left = box.right + gap;
      top = box.top + box.height / 2 - height / 2;
    } else if (window.innerHeight - box.bottom > height + gap * 2) { // below
      top = box.bottom + gap;
      left = box.left;
    } else { // above
      top = box.top - height - gap;
      left = box.left;
    }
    tip.style.left = `${Math.max(16, Math.min(left, window.innerWidth - width - 16))}px`;
    tip.style.top = `${Math.max(16, Math.min(top, window.innerHeight - height - 16))}px`;
  },

  // Esc closes the tour; Tab stays inside the tip.
  handleKey(event) {
    if (!this.root) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.finish();
      return;
    }
    if (event.key !== 'Tab') return;
    const tip = this.root.querySelector('.tour-tip');
    const items = [...tip.querySelectorAll('button')].filter((button) => !button.hidden);
    const first = items[0];
    const last = items[items.length - 1];
    if (!tip.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === tip)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  },

  finish() {
    updateOnboarding(this.tour.doneState);
    if (this.root) {
      document.removeEventListener('keydown', this.onKey, true);
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('scroll', this.onMove);
      this.root.remove();
      this.root = null;
    }
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  },

  // On the Dashboard: once after the profile was created, or after "Take the tour again".
  maybeStart() {
    if (!byId('first-steps')) return; // only on the Dashboard
    const params = new URLSearchParams(window.location.search);
    const asked = params.get('tour') === '1';
    if (asked) {
      params.delete('tour');
      const rest = params.toString();
      history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    }
    const state = getOnboarding();
    if (!getProfile() || state.demoMode || !(asked || state.tourPending)) return;
    this.startLater('dashboard');
  },

  // After the page and the fonts are drawn, so the places of the elements are final.
  startLater(name, options) {
    (document.fonts?.ready ?? Promise.resolve()).then(() => setTimeout(() => this.start(name, options), 300));
  },

  // On Progress: progress.html?from=onboarding (First steps → step 5) starts the page tour once;
  // progress.html?tour=1 (Settings → Help) starts it again. Both parameters leave the address.
  // Read at once: progress.js rewrites the address with its own parameters.
  maybeStartProgress() {
    if (!byId('summary-cards')) return; // only on the Progress page
    const params = new URLSearchParams(window.location.search);
    const fromSteps = params.get('from') === 'onboarding';
    const asked = params.get('tour') === '1';
    if (!fromSteps && !asked) return;
    params.delete('from');
    params.delete('tour');
    const rest = params.toString();
    history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    if (!getProfile() || isDemoMode()) return;
    if (asked || !getOnboarding().progressTourDone) this.startLater('progress', { stepDone: fromSteps });
  }
};

/* =========================================================
   6. Help tips "?": a button with an aria-label; a click shows a short text (Bootstrap popover)
   ========================================================= */

const HelpTips = {
  init() {
    if (!window.bootstrap?.Popover) return;
    this.attach(document);
    // One tip at a time; a click outside or Esc closes it.
    document.addEventListener('click', (event) => {
      document.querySelectorAll('[data-help][aria-describedby]').forEach((button) => {
        if (!button.contains(event.target)) bootstrap.Popover.getInstance(button)?.hide();
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('[data-help][aria-describedby]').forEach((button) => {
        bootstrap.Popover.getInstance(button)?.hide();
        button.focus();
      });
    });
  },

  // The "?" buttons inside `root` get their popover (also in dialogs added later: the goal wizard).
  attach(root) {
    if (!window.bootstrap?.Popover) return;
    root.querySelectorAll('[data-help]').forEach((button) => {
      bootstrap.Popover.getOrCreateInstance(button, {
        trigger: 'click',
        placement: 'bottom',
        container: 'body',
        customClass: 'help-popover',
        content: () => t(`onboarding.help.${button.dataset.help}`) // read on every show: follows the language
      });
    });
  }
};

/* =========================================================
   7. Start + self-test (index.html?debug=1)
   ========================================================= */

function runOnboardingSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const empty = firstStepsStatus({ goals: [], tasks: [], entries: [], visitedProgress: false, today: '2026-11-13' });
  check('first steps: nothing done', empty.filter((step) => step.done).length, 0);
  const full = firstStepsStatus({
    goals: [{ id: 'g', status: 'active' }],
    tasks: [normalizeTask({ id: 't', title: 'T', date: '2026-11-13', completed: true, completedAt: '2026-11-13T10:00:00Z' })],
    entries: [{ goalId: 'g', date: '2026-11-12', value: 1 }],
    visitedProgress: true, today: '2026-11-13'
  });
  check('first steps: everything done', full.every((step) => step.done), true);
  check('first steps: an archived goal does not count', firstStepsStatus({ goals: [{ status: 'archived' }], tasks: [], entries: [], today: '2026-11-13' })[0].done, false);
  check('first steps: a ticked checklist item is a result', firstStepsStatus({ goals: [{ status: 'active', checklist: [{ text: 'a', done: true }] }], tasks: [], entries: [], today: '2026-11-13' })[3].done, true);
  check('first steps: a workout entry is not a goal result', firstStepsStatus({ goals: [], tasks: [], entries: [{ kind: 'workout', goalId: null, date: '2026-11-12' }], today: '2026-11-13' })[3].done, false);
  check('onboarding: only known true/false flags', JSON.stringify(cleanOnboarding({ demoMode: 'yes', tourDone: true, extra: 1 })), '{"tourDone":true}');
  console.group('[LifeOS] Onboarding self-test');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} onboarding tests failed`);
  else console.info(`All ${results.length} onboarding tests passed`);
  console.groupEnd();
}

onAppReady(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1' && byId('first-steps')) runOnboardingSelfTest();
  DemoMode.bindFirstRunButton();
  DemoMode.renderBanner();
  HelpTips.init();
  FirstSteps.bind();
  // The Progress page counts as visited (step 5) for a real profile.
  if (window.location.pathname.endsWith('progress.html') && getProfile() && !isDemoMode()) updateOnboarding({ visitedProgress: true });
  // A new real profile: the tour starts (on the Dashboard now, or the next time it opens).
  document.addEventListener('lifeos:profilechange', (event) => {
    if (!event.detail?.created) return;
    updateOnboarding({ tourPending: true });
    Tour.maybeStart();
    FirstSteps.render();
  });
  document.addEventListener('lifeos:languagechange', () => DemoMode.renderBanner());
  Tour.maybeStart();
  Tour.maybeStartProgress();
});
