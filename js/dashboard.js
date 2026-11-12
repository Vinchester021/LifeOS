// LifeOS — Dashboard (index.html), concept section 4.
// A short picture of today. Everything is read from localStorage — nothing is typed twice:
// the profile, goals, tasks, progress entries and the week focus from the planner.
'use strict';

const DASHBOARD_GOALS_LIMIT = 4; // with more goals: 3 cards + a "+N more" card
const ACTIVITY_WEEKS = 4;
const RING_RADIUS = 50;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function todayIso() {
  return Dates.toISO(Dates.today());
}

function emptyHtml(key) {
  return `<p class="task-empty">${escapeHtml(t(key))}</p>`;
}

// A calm empty state inside a card: soft icon + one sentence (+ an optional link button).
function emptyCardHtml(icon, key, link = null) {
  const action = link ? `<a class="btn btn-outline-primary btn-sm" href="${link.href}">${escapeHtml(t(link.key))}</a>` : '';
  return `
    <div class="dash-empty">
      <span class="dash-empty-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
      <p>${escapeHtml(t(key))}</p>
      ${action}
    </div>`;
}

/* ---------- Greeting ---------- */

// Greeting depends on the time of day; late at night a neutral "Hello".
function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return 'greeting.morning';
  if (hour >= 12 && hour < 18) return 'greeting.afternoon';
  if (hour >= 18 && hour < 23) return 'greeting.evening';
  return 'greeting.hello';
}

// "Good morning, Vilgelm!" — textContent keeps the user's name as plain text.
function renderGreeting() {
  const profile = getProfile();
  const key = greetingKey(new Date().getHours());
  byId('dashboard-greeting').textContent = profile ? t(key, { name: profile.name }) : t('app.name');
  const today = Dates.today();
  byId('greeting-date').textContent = upperFirst(`${Format.weekday(today, 'long')}, ${Format.date(today, { dateStyle: 'long' })}`);
}

/* ---------- Planning path: Personal year › Quarter › Month › Week › Today ---------- */

function renderPlanPath(year) {
  const today = Dates.today();
  const steps = [
    ['year', t('planner.level.year')],
    ['quarter', year ? t('planner.quarterTitle', { number: year.quarter }) : t('planner.level.quarter')],
    ['month', upperFirst(Format.date(today, { month: 'long' }))],
    ['week', t('planner.weekTitle', { number: Dates.isoWeek(today).week })],
    ['today', t('planner.level.today')]
  ];
  byId('plan-path').innerHTML = steps.map(([level, label], index) => `
    <li${level === 'today' ? ' class="is-today"' : ''}>
      ${index ? '<i class="bi bi-arrow-right" aria-hidden="true"></i>' : ''}
      <a href="planner.html?level=${level}"${level === 'today' ? ' aria-current="date"' : ''}>${escapeHtml(label)}</a>
    </li>`).join('');
  scrollPathToToday();
  // The arrow icons come from a web font: once it is loaded the path is wider, scroll again.
  document.fonts?.ready.then(scrollPathToToday);
}

// When the path does not fit (phone, long Kazakh words) it scrolls sideways: show its end, "Today".
function scrollPathToToday() {
  const path = byId('plan-path');
  if (path.scrollWidth > path.clientWidth) path.scrollLeft = path.scrollWidth;
}

/* ---------- Personal year card ---------- */

function renderYearCard(year) {
  const container = byId('dash-year');
  if (!year) {
    container.innerHTML = emptyCardHtml('bi-person-plus', 'dashboard.year.noProfile');
    return;
  }
  const percentText = Format.number(year.percent / 100, { style: 'percent', maximumFractionDigits: 0 });
  const offset = RING_LENGTH * (1 - year.percent / 100);
  const day = year.status === 'upcoming' ? 0 : Math.min(year.daysPassed + 1, year.totalDays);
  const left = Math.max(year.totalDays - day, 0);
  const note = { upcoming: 'planner.year.upcoming', finished: 'planner.year.finished' }[year.status];

  // The ring is decoration; the same numbers are written as text next to it.
  container.innerHTML = `
    <div class="year-card">
      <div class="ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-track" cx="60" cy="60" r="${RING_RADIUS}"></circle>
          <circle class="ring-value" cx="60" cy="60" r="${RING_RADIUS}"
                  stroke-dasharray="${RING_LENGTH.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
        </svg>
        <span class="ring-label" aria-hidden="true"><strong>${escapeHtml(percentText)}</strong>${escapeHtml(t('dashboard.year.passedLabel'))}</span>
      </div>
      <dl class="year-numbers">
        <div><dt>${escapeHtml(tPlural('progress.days', day))}</dt><dd>${escapeHtml(t('dashboard.year.ofTotal', { total: Format.number(year.totalDays) }))}</dd></div>
        <div><dt>${escapeHtml(tPlural('progress.days', left))}</dt><dd>${escapeHtml(t('dashboard.year.left'))}</dd></div>
      </dl>
      <p class="visually-hidden">${escapeHtml(t('planner.year.passed', { percent: percentText }))}</p>
    </div>
    ${note ? `<p class="year-note">${escapeHtml(t(note))}</p>` : ''}`;
}

/* ---------- Today: tasks + quick add ---------- */

function renderTodayTasks() {
  byId('dash-sport-line').innerHTML = sportDayLineHtml(todayIso());
  TaskList.render(byId('dash-today-tasks'), getTasksForDate(todayIso()), { emptyKey: 'dashboard.today.empty' });
}

function addDashboardTask(event) {
  event.preventDefault();
  const input = byId('dash-task');
  const fields = { title: input.value.trim(), date: todayIso(), priority: 'medium', period: 'day' };
  const error = validateTask(fields).title;
  setFieldError(input, error);
  if (error || !addTask(fields)) {
    input.focus();
    return;
  }
  showToast('toast.taskCreated', 'success');
  input.value = '';
  renderDashboard();
  input.focus();
}

/* ---------- Focus of the week (the same data as in the Planner) ---------- */

function weekTaskStats() {
  const tasks = getTasks();
  const monday = Dates.startOfWeek(Dates.today());
  let total = 0;
  let done = 0;
  for (let index = 0; index < 7; index++) {
    getTasksForDate(Dates.toISO(Dates.addDays(monday, index)), tasks).forEach((occurrence) => {
      total++;
      if (occurrence.done) done++;
    });
  }
  return { total, done };
}

function renderFocus() {
  const focus = getPeriodPlan(Dates.weekKey(Dates.today())).focus ?? '';
  const text = byId('dash-focus-text');
  text.textContent = focus || t('dashboard.focus.empty');
  text.classList.toggle('is-empty', !focus);
  // No focus yet: the form is open right away.
  if (!focus) setFocusFormOpen(true, false);

  byId('dash-week-progress').innerHTML = weekProgressHtml(weekTaskStats());
}

// "2 of 5" + one segment per task of the week (a plain bar when there are many tasks).
const WEEK_SEGMENTS_MAX = 10;

function weekProgressHtml({ total, done }) {
  if (!total) return `<p class="dash-week-empty">${escapeHtml(t('dashboard.focus.noTasks'))}</p>`;
  const percent = Math.round((done / total) * 100);
  const bar = total <= WEEK_SEGMENTS_MAX
    ? `<span class="week-segments" aria-hidden="true">${Array.from({ length: total }, (_, index) =>
        `<span${index < done ? ' class="is-done"' : ''}></span>`).join('')}</span>`
    : `<span class="week-segments is-bar" aria-hidden="true"><span class="is-done" style="width: ${percent}%"></span></span>`;
  return `
    <div class="dash-week" role="img" aria-label="${escapeHtml(t('dashboard.focus.progress', { done, total }))}">
      <strong class="dash-week-count">${escapeHtml(t('dashboard.focus.count', { done, total }))}</strong>
      ${bar}
    </div>`;
}

function setFocusFormOpen(isOpen, moveFocus = true) {
  const form = byId('dash-focus-form');
  const wasClosed = form.hidden;
  form.hidden = !isOpen;
  byId('dash-focus-edit').setAttribute('aria-expanded', String(isOpen));
  // Fill the input only when the form opens, so a redraw never erases typing.
  if (isOpen && wasClosed) {
    byId('dash-focus').value = getPeriodPlan(Dates.weekKey(Dates.today())).focus ?? '';
    if (moveFocus) byId('dash-focus').focus();
  }
}

// Escape inside the form = cancel: nothing is saved, focus goes back to "Change focus".
function closeFocusFormOnEscape(event) {
  if (event.key !== 'Escape') return;
  setFieldError(byId('dash-focus'), null);
  setFocusFormOpen(false);
  byId('dash-focus-edit').focus();
}

function saveDashboardFocus(event) {
  event.preventDefault();
  const input = byId('dash-focus');
  const focus = input.value.trim();
  const error = focus.length > 80 ? 'planner.error.focusLength' : null;
  setFieldError(input, error);
  if (error) {
    input.focus();
    return;
  }
  if (!updatePeriodPlan(Dates.weekKey(Dates.today()), { focus })) return;
  showToast('toast.focusSaved', 'success');
  if (focus) setFocusFormOpen(false);
  renderFocus();
  byId('dash-focus-edit').focus();
}

/* ---------- Big goals ---------- */

// Active goals, the nearest deadline first (goals without a deadline at the end).
function dashboardGoals() {
  const entries = getProgressEntries();
  const deadline = (goal) => Dates.parse(goal.deadline)?.getTime() ?? Infinity;
  return getGoals()
    .filter((goal) => goal.status === 'active')
    .map((goal) => withLiveStreak(goal, entries))
    .sort((a, b) => (deadline(a) === deadline(b) ? 0 : deadline(a) - deadline(b)));
}

function dashGoalCardHtml(goal, index) {
  const percent = getGoalPercent(goal);
  const titleId = `dash-goal-${index}`;
  return `
    <article class="dash-goal" data-color="${goalColor(goal)}">
      <span class="goal-icon" aria-hidden="true"><i class="bi ${goalIcon(goal)}"></i></span>
      <div class="dash-goal-text">
        <h3 class="goal-title" id="${titleId}">
          <a class="stretched-link" href="goal-details.html?id=${escapeHtml(encodeURIComponent(goal.id))}">${escapeHtml(goal.title)}</a>
        </h3>
        <p class="goal-values">${escapeHtml(formatGoalProgress(goal))}</p>
      </div>
      <span class="dash-goal-percent">${escapeHtml(Format.number(percent / 100, { style: 'percent' }))}</span>
      <div class="progress" role="progressbar" aria-labelledby="${titleId}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar" style="width: ${percent}%"></div>
      </div>
    </article>`;
}

function renderGoalCards() {
  const goals = dashboardGoals();
  const container = byId('dash-goals');
  if (goals.length === 0) {
    container.innerHTML = emptyCardHtml('bi-bullseye', 'dashboard.goals.empty', { href: 'goals.html#new', key: 'goals.empty.create' });
    return;
  }
  // Up to 4 cards; with more goals the 4th place is a "+N more" card,
  // with fewer goals the free place is a dashed "+ Add goal" card (no empty space on the right).
  const shown = goals.length > DASHBOARD_GOALS_LIMIT ? goals.slice(0, DASHBOARD_GOALS_LIMIT - 1) : goals;
  const hidden = goals.length - shown.length;
  let extra = '';
  if (hidden) {
    extra = `
    <a class="dash-goal dash-goal-more" href="goals.html">
      <strong>${escapeHtml(t('dashboard.goals.more', { count: hidden }))}</strong>
      <span>${escapeHtml(t('dashboard.goals.moreHint'))}</span>
    </a>`;
  } else if (goals.length < DASHBOARD_GOALS_LIMIT) {
    extra = `
    <a class="dash-goal dash-goal-more dash-goal-add" href="goals.html#new" data-goals="${goals.length}">
      <i class="bi bi-plus-lg" aria-hidden="true"></i>
      <strong>${escapeHtml(t('dashboard.goals.add'))}</strong>
    </a>`;
  }
  container.innerHTML = `<div class="dash-goal-grid">${shown.map(dashGoalCardHtml).join('')}${extra}</div>`;
}

/* ---------- Activity map: last 4 weeks ---------- */

// countActivityByDay() and activityLevel() are shared with Progress (app.js, section "Activity").
// "19–25 Oct" or "26 Oct – 1 Nov"
function weekRangeLabel(start) {
  const end = Dates.addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const from = Format.date(start, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  return `${from}–${Format.date(end, { day: 'numeric', month: 'short' })}`;
}

function renderActivity() {
  const counts = countActivityByDay(getTasks(), getProgressEntries(), getSport().sessions);
  const today = Dates.today();
  const firstMonday = Dates.addDays(Dates.startOfWeek(today), -7 * (ACTIVITY_WEEKS - 1));
  let activeDays = 0;
  let pastDays = 0;

  const weeks = Array.from({ length: ACTIVITY_WEEKS }, (_, week) => Dates.addDays(firstMonday, week * 7));
  const head = `<span></span>${weeks.map((monday) => `<span class="heat-week">${escapeHtml(weekRangeLabel(monday))}</span>`).join('')}`;
  // Rows = weekdays (Mon–Sun), columns = weeks.
  const rows = Array.from({ length: 7 }, (_, weekday) => {
    const label = upperFirst(Format.weekday(Dates.addDays(firstMonday, weekday), 'short'));
    const cells = weeks.map((monday) => {
      const day = Dates.addDays(monday, weekday);
      if (day > today) return '<span class="heat-cell is-future"></span>';
      const iso = Dates.toISO(day);
      const count = counts.get(iso) ?? 0;
      pastDays++;
      if (count > 0) activeDays++;
      const title = `${Format.shortDate(iso)}: ${tPlural('dashboard.activity.actions', count)}`;
      return `<span class="heat-cell level-${activityLevel(count)}" title="${escapeHtml(title)}"></span>`;
    }).join('');
    return `<span class="heat-day">${escapeHtml(label)}</span>${cells}`;
  }).join('');

  const rate = pastDays ? activeDays / pastDays : 0;
  const summary = activeDays
    ? `${tPlural('dashboard.activity.days', activeDays)} · ${t('dashboard.activity.rate', { percent: Format.number(rate, { style: 'percent' }) })}`
    : t('dashboard.activity.empty');
  // The grid is only a picture; the line under it says the same in words.
  byId('dash-activity').innerHTML = `
    <div class="dash-heatmap" style="--weeks: ${ACTIVITY_WEEKS}" aria-hidden="true">${head}${rows}</div>
    <div class="dash-activity-foot">
      <p class="dash-activity-summary${activeDays ? '' : ' is-empty'}">${escapeHtml(summary)}</p>
      <p class="heat-legend" aria-hidden="true">
        ${escapeHtml(t('dashboard.activity.less'))}
        ${[0, 1, 2, 3, 4].map((level) => `<span class="heat-cell level-${level}"></span>`).join('')}
        ${escapeHtml(t('dashboard.activity.more'))}
      </p>
    </div>`;
}

/* ---------- Statistics by category ---------- */

function renderCategories() {
  const groups = new Map(); // category -> list of goals
  getGoals().filter((goal) => goal.status !== 'archived').forEach((goal) => {
    const category = goal.category in GOAL_CATEGORIES ? goal.category : 'custom';
    groups.set(category, [...(groups.get(category) ?? []), goal]);
  });
  if (groups.size === 0) {
    byId('dash-categories').innerHTML = emptyCardHtml('bi-pie-chart', 'dashboard.categories.empty');
    return;
  }
  const rows = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([category, goals]) => {
      const average = Math.round(goals.reduce((sum, goal) => sum + getGoalPercent(goal), 0) / goals.length);
      return `
        <li>
          <span class="category-icon" aria-hidden="true"><i class="bi ${GOAL_CATEGORIES[category]}"></i></span>
          <span class="category-name">${escapeHtml(goalCategoryName(category))}
            <span class="category-count">(${escapeHtml(tPlural('goals.count', goals.length))})</span></span>
          <span class="category-bar" aria-hidden="true"><span style="width: ${average}%"></span></span>
          <span class="category-average">${escapeHtml(Format.number(average / 100, { style: 'percent' }))}</span>
        </li>`;
    }).join('');
  byId('dash-categories').innerHTML = `<ul class="category-stats">${rows}</ul>`;
}

/* ---------- Page ---------- */

function renderDashboard() {
  const profile = getProfile();
  const year = profile ? Dates.personalYear(profile.personalYearStart) : null;
  renderGreeting();
  byId('year-ended').hidden = year?.status !== 'finished';
  renderPlanPath(year);
  renderYearCard(year);
  renderTodayTasks();
  renderFocus();
  renderGoalCards();
  renderActivity();
  renderCategories();
}

// After ticking a task the page is redrawn; focus goes back to the same checkbox.
function onDashboardTasksChanged({ focusId } = {}) {
  renderDashboard();
  if (focusId) byId(focusId)?.focus();
}

onAppReady(() => {
  byId('dash-task-form').addEventListener('submit', submitOnce(addDashboardTask));
  TaskList.bind(byId('dash-today-tasks'), onDashboardTasksChanged);
  byId('dash-focus-edit').addEventListener('click', () => setFocusFormOpen(byId('dash-focus-form').hidden));
  byId('dash-focus-form').addEventListener('submit', submitOnce(saveDashboardFocus));
  byId('dash-focus-form').addEventListener('keydown', closeFocusFormOnEscape);
  renderDashboard();
  const params = new URLSearchParams(window.location.search);
  if (params.get('newYear') === '1') {
    showToast('toast.newYearStarted', 'success');
    history.replaceState(null, '', window.location.pathname);
  }
  document.addEventListener('lifeos:languagechange', renderDashboard);
  document.addEventListener('lifeos:profilechange', renderDashboard);
});
