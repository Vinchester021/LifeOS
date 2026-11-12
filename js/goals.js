// LifeOS — Goals page (goals.html).
// Shows goal cards with search, filters, sorting and an archive tab,
// and the card menu: edit, complete, archive/restore, delete.
// The goal model and getGoalPercent() live in app.js (section "Goals");
// the create/edit dialog lives in goal-wizard.js.
'use strict';

// Current filters. Kept in memory: a reload starts from the defaults.
const goalsView = {
  tab: 'goals', // "goals" = active + completed, "archive" = archived
  search: '',
  category: 'all',
  status: 'all',
  sort: 'deadline'
};

/* ---------- Filtering and sorting ---------- */

function deadlineTime(goal) {
  const date = Dates.parse(goal.deadline);
  return date ? date.getTime() : null;
}

// Goals without a deadline go to the end of the list.
function compareDeadlines(a, b) {
  const timeA = deadlineTime(a);
  const timeB = deadlineTime(b);
  if (timeA === timeB) return 0;
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return timeA - timeB;
}

const GOAL_SORTERS = {
  deadline: compareDeadlines,
  percent: (a, b) => getGoalPercent(b) - getGoalPercent(a),
  created: (a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
  title: (a, b) => String(a.title ?? '').localeCompare(String(b.title ?? ''), I18n.locale(), { sensitivity: 'base' })
};

function isInCurrentTab(goal) {
  return goalsView.tab === 'archive' ? goal.status === 'archived' : goal.status !== 'archived';
}

function matchesFilters(goal) {
  const locale = I18n.locale();
  const query = goalsView.search.trim().toLocaleLowerCase(locale);
  const statusOk = goalsView.tab === 'archive' || goalsView.status === 'all' || goal.status === goalsView.status;
  const categoryOk = goalsView.category === 'all' || goal.category === goalsView.category;
  const titleOk = String(goal.title ?? '').toLocaleLowerCase(locale).includes(query);
  return statusOk && categoryOk && titleOk;
}

function getVisibleGoals(goals) {
  const sorter = GOAL_SORTERS[goalsView.sort] ?? GOAL_SORTERS.deadline;
  return goals.filter(isInCurrentTab).filter(matchesFilters).sort(sorter);
}

/* ---------- Cards ---------- */

// Every card has a status badge: the text says the status, the tone only helps.
const STATUS_BADGES = {
  active: ['is-success', 'goals.status.active'],
  completed: ['is-accent', 'goal.badge.completed'],
  archived: ['', 'goal.badge.archived']
};

function statusBadge(goal) {
  const [tone, key] = STATUS_BADGES[goal.status] ?? STATUS_BADGES.active;
  return `<span class="badge-status ${tone}">${escapeHtml(t(key))}</span>`;
}

// "until 31 March 2027"; an overdue active goal: "until 1 November 2026 · 3 days overdue" in red.
function cardDeadlineHtml(goal) {
  const days = Dates.daysUntil(goal.deadline);
  if (days === null) {
    return `<p class="goal-deadline"><i class="bi bi-calendar" aria-hidden="true"></i><span>${escapeHtml(t('goals.deadline.none'))}</span></p>`;
  }
  const until = t('goals.card.until', { date: Format.date(goal.deadline, { dateStyle: 'long' }) });
  const isOverdue = goal.status === 'active' && days < 0;
  const text = isOverdue ? `${until} · ${tPlural('goals.card.overdue', -days)}` : until;
  return `
        <p class="goal-deadline${isOverdue ? ' is-overdue' : ''}">
          <i class="bi ${isOverdue ? 'bi-exclamation-circle' : 'bi-calendar-event'}" aria-hidden="true"></i>
          <span>${escapeHtml(text)}</span>
        </p>`;
}

// One menu item: <button data-goal-action="edit" data-goal-id="...">
function menuItem(action, icon, labelKey, goalId, extraClass = '') {
  return `
    <li>
      <button class="dropdown-item ${extraClass}" type="button" data-goal-action="${action}" data-goal-id="${escapeHtml(goalId)}">
        <i class="bi ${icon} me-2" aria-hidden="true"></i>${escapeHtml(t(labelKey))}
      </button>
    </li>`;
}

// Bootstrap dropdown. The items depend on the status: only active goals can be completed,
// archived goals get "Restore" instead of "Move to archive".
function goalMenu(goal) {
  const id = String(goal.id ?? '');
  const isArchived = goal.status === 'archived';
  return `
    <div class="dropdown goal-menu">
      <button class="btn btn-icon" type="button" data-bs-toggle="dropdown" aria-expanded="false"
              data-menu-for="${escapeHtml(id)}" aria-label="${escapeHtml(t('goal.menu', { title: goal.title }))}">
        <i class="bi bi-three-dots" aria-hidden="true"></i>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        ${menuItem('edit', 'bi-pencil', 'goal.action.edit', id)}
        ${goal.status === 'active' ? menuItem('complete', 'bi-check2-circle', 'goal.action.complete', id) : ''}
        ${isArchived
          ? menuItem('restore', 'bi-arrow-counterclockwise', 'goal.action.restore', id)
          : menuItem('archive', 'bi-archive', 'goal.action.archive', id)}
        <li><hr class="dropdown-divider"></li>
        ${menuItem('delete', 'bi-trash', 'goal.action.delete', id, 'text-danger')}
      </ul>
    </div>`;
}

// Every user value goes through escapeHtml(); color and icon are checked against known values.
// Card: [icon]   [status] [⋯] / title / category / value ...... % / bar / "until 31 March 2027"
function renderGoalCard(goal, index) {
  const percent = getGoalPercent(goal);
  const titleId = `goal-title-${index}`;
  const link = `goal-details.html?id=${encodeURIComponent(String(goal.id ?? ''))}`;

  return `
      <article class="goal-card" data-color="${goalColor(goal)}">
        <div class="goal-card-top">
          <span class="goal-icon" aria-hidden="true"><i class="bi ${goalIcon(goal)}"></i></span>
          <div class="goal-card-tools">
            ${statusBadge(goal)}
            ${goalMenu(goal)}
          </div>
        </div>
        <div>
          <h2 class="goal-title" id="${titleId}">
            <a class="stretched-link" href="${escapeHtml(link)}">${escapeHtml(goal.title)}</a>
          </h2>
          <p class="goal-category">${escapeHtml(goalCategoryName(goal.category))}</p>
        </div>
        <div class="goal-numbers">
          <span class="goal-values">${escapeHtml(formatGoalProgress(goal))}</span>
          <span class="goal-percent">${escapeHtml(Format.number(percent / 100, { style: 'percent' }))}</span>
        </div>
        <div class="progress" role="progressbar" aria-labelledby="${titleId}"
             aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width: ${percent}%"></div>
        </div>
        ${cardDeadlineHtml(goal)}
      </article>`;
}

/* ---------- Page rendering ---------- */

function renderGoalsPage() {
  const entries = getProgressEntries();
  const goals = getGoals().map((goal) => withLiveStreak(goal, entries));
  const visible = getVisibleGoals(goals);

  document.getElementById('count-goals').textContent = goals.filter((goal) => goal.status !== 'archived').length;
  document.getElementById('count-archive').textContent = goals.filter((goal) => goal.status === 'archived').length;
  document.getElementById('goals-grid').innerHTML = visible.map(renderGoalCard).join('');
  document.getElementById('goals-count').textContent = visible.length ? tPlural('goals.count', visible.length) : '';
  renderEmptyState(goals, visible);
  renderResetButton();
}

// How many filters are on: the search, the category, the status (the sort order is not a filter).
function activeFilterCount() {
  const statusIsOn = goalsView.tab !== 'archive' && goalsView.status !== 'all';
  return [goalsView.search.trim() !== '', goalsView.category !== 'all', statusIsOn].filter(Boolean).length;
}

// "Reset (2)" with an accent border; hidden when nothing is filtered.
function renderResetButton() {
  const count = activeFilterCount();
  const button = document.getElementById('filters-reset');
  button.hidden = count === 0;
  document.getElementById('filters-reset-label').textContent = t('goals.filters.resetCount', { count });
}

// Three different empty states, chosen by why the list is empty.
function renderEmptyState(goals, visible) {
  const emptyEl = document.getElementById('goals-empty');
  emptyEl.hidden = visible.length > 0;
  if (visible.length > 0) return;

  const tabHasGoals = goals.some(isInCurrentTab);
  let state = 'noResults';
  if (!tabHasGoals) state = goalsView.tab === 'archive' ? 'archiveEmpty' : 'empty';

  const icons = { empty: 'bi-bullseye', noResults: 'bi-search', archiveEmpty: 'bi-archive' };
  document.getElementById('goals-empty-icon').className = `bi ${icons[state]}`;
  document.getElementById('goals-empty-title').textContent = t(`goals.${state}.title`);
  document.getElementById('goals-empty-text').textContent = t(`goals.${state}.text`);
  document.getElementById('goals-empty-create').hidden = state !== 'empty';
  document.getElementById('goals-empty-reset').hidden = state !== 'noResults';
}

/* ---------- Controls ---------- */

function setTab(tab) {
  goalsView.tab = tab;
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
  });
  // The archive has only one status, so the status filter does not apply there.
  document.getElementById('filter-status').disabled = tab === 'archive';
  renderGoalsPage();
}

function resetFilters() {
  goalsView.search = '';
  goalsView.category = 'all';
  goalsView.status = 'all';
  document.getElementById('goal-search').value = '';
  document.getElementById('filter-category').value = 'all';
  document.getElementById('filter-status').value = 'all';
  renderGoalsPage();
  document.getElementById('goal-search').focus(); // the reset button is hidden now
}

// The filter panel folds open/closed with jQuery. It starts open on a computer, closed on a phone.
// Without jQuery (it did not load) the panel is simply shown or hidden — the same as jQuery's toggle().
function showFiltersPanel(isOpen, animate) {
  const panel = document.getElementById('filters-panel');
  if (window.jQuery && animate) $(panel).slideToggle(200);
  else if (window.jQuery) $(panel).toggle(isOpen);
  else panel.style.display = isOpen ? '' : 'none';
}

function initFiltersPanel() {
  const isOpen = window.matchMedia('(min-width: 992px)').matches;
  document.getElementById('filters-toggle').setAttribute('aria-expanded', String(isOpen));
  showFiltersPanel(isOpen, false);
}

function toggleFiltersPanel() {
  const button = document.getElementById('filters-toggle');
  const isOpen = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!isOpen));
  showFiltersPanel(!isOpen, true);
}

function bindGoalsControls() {
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => setTab(button.dataset.tab));
  });
  document.getElementById('goal-search').addEventListener('input', (event) => {
    goalsView.search = event.target.value;
    renderGoalsPage();
  });
  const selects = { 'filter-category': 'category', 'filter-status': 'status', 'goal-sort': 'sort' };
  Object.entries(selects).forEach(([id, field]) => {
    document.getElementById(id).addEventListener('change', (event) => {
      goalsView[field] = event.target.value;
      renderGoalsPage();
    });
  });
  document.getElementById('filters-reset').addEventListener('click', resetFilters);
  document.getElementById('goals-empty-reset').addEventListener('click', resetFilters);
  document.getElementById('filters-toggle').addEventListener('click', toggleFiltersPanel);
  initFiltersPanel();
  document.querySelectorAll('[data-action="create-goal"]').forEach((button) => {
    button.addEventListener('click', () => {
      goalsFocus.returnTo = null;
      GoalWizard.openCreate();
    });
  });
  // One listener for all card menus (cards are re-drawn, so no per-card listeners).
  document.getElementById('goals-grid').addEventListener('click', (event) => {
    const item = event.target.closest('[data-goal-action]');
    if (item) handleGoalAction(item.dataset.goalAction, item.dataset.goalId);
  });
  document.getElementById('delete-goal-confirm').addEventListener('click', confirmDeleteGoal);
}

/* ---------- Card actions ---------- */

// Where keyboard focus goes back after a dialog or an action:
// the menu button of that goal, or the "New goal" button if the card is gone.
const goalsFocus = { returnTo: null };

function restoreFocus(goalId) {
  const menuButton = goalId ? document.querySelector(`[data-menu-for="${CSS.escape(goalId)}"]`) : null;
  (menuButton ?? document.querySelector('.goals-toolbar [data-action="create-goal"]')).focus();
}

function handleGoalAction(action, goalId) {
  const goal = getGoalById(goalId);
  if (!goal) {
    showToast('toast.goalNotFound', 'warning');
    renderGoalsPage();
    return;
  }
  goalsFocus.returnTo = goalId;
  if (action === 'edit') GoalWizard.openEdit(goal);
  if (action === 'complete') changeGoalStatus(goalId, 'completed', 'toast.goalCompleted');
  if (action === 'archive') changeGoalStatus(goalId, 'archived', 'toast.goalArchived');
  if (action === 'restore') changeGoalStatus(goalId, 'active', 'toast.goalRestored');
  if (action === 'delete') openDeleteDialog(goal);
}

function changeGoalStatus(goalId, status, toastKey) {
  const goals = getGoals();
  const goal = goals.find((item) => item.id === goalId);
  goal.status = status;
  goal.updatedAt = new Date().toISOString();
  if (!saveGoals(goals)) return;
  showToast(toastKey, 'success', { title: goal.title });
  renderGoalsPage();
  restoreFocus(goalId);
}

/* ---------- Delete: only after confirmation ---------- */

let pendingDeleteId = null;

function openDeleteDialog(goal) {
  pendingDeleteId = goal.id;
  // textContent: the title is shown exactly as typed, never as HTML.
  document.getElementById('delete-goal-name').textContent = goal.title;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('delete-goal-modal')).show();
}

function confirmDeleteGoal() {
  const goals = getGoals();
  const goal = goals.find((item) => item.id === pendingDeleteId);
  if (goal && saveGoals(goals.filter((item) => item.id !== pendingDeleteId))) {
    // "All its data": the goal's progress entries are deleted too.
    saveProgressEntries(getProgressEntries().filter((entry) => entry.goalId !== goal.id));
    // Tasks are the user's plans, so they stay — only the link to the goal is removed.
    unlinkGoalFromTasks(goal.id);
    showToast('toast.goalDeleted', 'success', { title: goal.title });
    goalsFocus.returnTo = null; // the card is gone
  }
  pendingDeleteId = null;
  bootstrap.Modal.getInstance(document.getElementById('delete-goal-modal')).hide();
  renderGoalsPage();
}

function bindDialogFocus() {
  const deleteModal = document.getElementById('delete-goal-modal');
  // The safe button gets focus first.
  deleteModal.addEventListener('shown.bs.modal', () => document.getElementById('delete-goal-cancel').focus());
  deleteModal.addEventListener('hidden.bs.modal', () => restoreFocus(goalsFocus.returnTo));
  document.getElementById('goal-wizard').addEventListener('hidden.bs.modal', () => {
    restoreFocus(GoalWizard.savedGoalId ?? goalsFocus.returnTo);
  });
}

/* ---------- Opening the wizard from the address: goals.html#new, goals.html#edit=<id> ---------- */

function handleGoalsHash() {
  const hash = window.location.hash;
  if (hash !== '#new' && !hash.startsWith('#edit=')) return;
  if (!getProfile()) return; // the first-run dialog comes first
  if (hash === '#new') {
    GoalWizard.openCreate();
  } else {
    const goal = getGoalById(decodeURIComponent(hash.slice('#edit='.length)));
    if (goal) GoalWizard.openEdit(goal);
    else showToast('toast.goalNotFound', 'warning');
  }
  // Remove the hash, so a reload does not open the dialog again.
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

/* ---------- Demo data (only with ?debug=1) ---------- */

// Examples from the concept. Titles are taken in the current language once
// and then saved as normal user data (they are not translated later).
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
    ...[[20, 70], [13, 75], [6, 80], [1, 80]].map(([daysAgo, weight]) => workout(daysAgo, t('demo.workout.squat'), 3, 5, weight)),
    workout(3, t('demo.workout.pushups'), 3, 15, null),
    // Body measurements (no goal), the same weights as the weight goal history
    bodyMeasure(25, { weight: 90, waist: 98, belly: 101, chest: 106, hips: 104, biceps: 34, thigh: 60, calf: 39 }),
    bodyMeasure(12, { weight: 88, waist: 96, belly: 99, chest: 105, hips: 103 }),
    bodyMeasure(2, { weight: 86.5, waist: 94, belly: 97, chest: 105, hips: 102, biceps: 35, thigh: 59, calf: 39 })
  ];
}

function bodyMeasure(daysAgo, values) {
  return {
    id: createId('body'), kind: 'body', goalId: null, note: '',
    date: Dates.toISO(Dates.addDays(Dates.today(), -daysAgo)),
    ...values, value: values.weight
  };
}

function workout(daysAgo, exercise, sets, reps, weight) {
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

function initDebugTools() {
  if (new URLSearchParams(window.location.search).get('debug') !== '1') return;
  document.getElementById('debug-tools').hidden = false;
  document.getElementById('debug-fill-demo').addEventListener('click', () => {
    const goals = createDemoGoals();
    if (saveGoals(goals) && saveProgressEntries(createDemoEntries(goals)) && saveTasks(createDemoTasks(goals))) {
      // Demo workouts and measurements are written the old way and moved to Sport like real old data.
      AppStorage.remove(STORAGE_KEYS.sport);
      migrateSportData();
      saveSport({ ...getSport(), plan: createDemoSportPlan() });
      showToast('debug.demoAdded', 'success');
      renderGoalsPage();
    }
  });
}

/* ---------- Start ---------- */

onAppReady(() => {
  if (!document.getElementById('goals-grid')) return;
  GoalWizard.init();
  bindGoalsControls();
  bindDialogFocus();
  initDebugTools();
  renderGoalsPage();
  handleGoalsHash();
  window.addEventListener('hashchange', handleGoalsHash);
  // Category names, dates and plural forms depend on the language.
  document.addEventListener('lifeos:languagechange', renderGoalsPage);
  // The wizard saved a goal.
  document.addEventListener('lifeos:goalschange', renderGoalsPage);
  // After the first-run dialog, a "#new" link can still open the wizard.
  document.addEventListener('lifeos:profilechange', handleGoalsHash);
});
