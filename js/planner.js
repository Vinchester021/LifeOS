// LifeOS — Planner (planner.html), concept section 6.
// Levels: Personal Year → Quarter → Month → Week → Today. Only the chosen level is shown.
// The level and the date live in the address: planner.html?level=week&date=2026-11-11
// Plans (quarter goals, week focus) are saved in lifeos_planner by period key
// (app.js, section "Planner plans"); tasks come from the task module (app.js + tasks.js).
'use strict';

const DEFAULT_LEVEL = 'week';
const WEEK_FOCUS_MAX_LENGTH = 80;
// Goal types that can get a quick result on the Today level (others: goal page or Habits).
const QUICK_RECORD_TYPES = ['money', 'number', 'percent', 'measurements'];

const plannerState = {
  level: DEFAULT_LEVEL,
  anchor: Dates.today(), // any day inside the shown period
  focusKey: null, // the week whose focus is in the input (so a redraw does not erase typing)
  scrolledWeek: null // the week already scrolled to today (scrolling once, not on every redraw)
};

/* ---------- Small helpers ---------- */

function isoOf(date) {
  return Dates.toISO(date);
}

// upperFirst() ("ноябрь" -> "Ноябрь") is in app.js.
const capitalize = upperFirst;

function isBetween(date, start, end) {
  return Boolean(date) && date >= start && date <= end;
}

/* ---------- Address: ?level=week&date=2026-11-11 ---------- */

function readPlannerUrl() {
  const params = new URLSearchParams(window.location.search);
  const level = params.get('level');
  plannerState.level = PERIOD_LEVELS.includes(level) ? level : DEFAULT_LEVEL;
  plannerState.anchor = Dates.parse(params.get('date')) ?? Dates.today();
}

function writePlannerUrl() {
  const params = new URLSearchParams(window.location.search);
  params.set('level', plannerState.level);
  const date = isoOf(plannerState.anchor);
  if (date === isoOf(Dates.today())) params.delete('date');
  else params.set('date', date);
  history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

/* ---------- Periods ---------- */

// The period dates and titles come from app.js (getPeriodRange, periodTitle).
// { start, end, key, title } of the period of `level` that contains `anchor`.
function getPeriod(level, anchor) {
  const period = getPeriodRange(level, anchor, getProfile()?.personalYearStart);
  return { ...period, title: periodTitle(level, period) };
}



function currentPeriod() {
  return getPeriod(plannerState.level, plannerState.anchor);
}

// The arrows: one period back (-1) or forward (+1).
function shiftAnchor(direction) {
  return shiftPeriodAnchor(plannerState.level, plannerState.anchor, direction);
}

/* ---------- Page frame: level pills and the period bar ---------- */

// On a phone the pills do not fit and scroll sideways: show the active one (e.g. "Week").
// Only the strip scrolls (not the page): the active level goes to the middle of the strip.
// It is done again when the fonts are loaded, because the words get their real width only then.
function scrollActiveLevelIntoView(link) {
  const strip = link?.closest('.planner-levels');
  if (!strip) return;
  const center = () => {
    if (strip.scrollWidth <= strip.clientWidth) return; // everything fits (tablet, computer)
    const linkBox = link.getBoundingClientRect();
    const stripBox = strip.getBoundingClientRect();
    strip.scrollLeft += linkBox.left - stripBox.left - (strip.clientWidth - linkBox.width) / 2;
  };
  center();
  document.fonts?.ready.then(center);
}

function renderHeader(period) {
  const { level } = plannerState;
  document.querySelectorAll('[data-level]').forEach((link) => {
    const isActive = link.dataset.level === level;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  scrollActiveLevelIntoView(document.querySelector(`.planner-levels [data-level="${level}"]`));
  byId('period-title').textContent = period.title;
  // "November 2026" says it all; the other levels also show their dates.
  const range = byId('period-range');
  range.hidden = level === 'today' || level === 'month';
  range.textContent = `${Format.date(period.start)} – ${Format.date(period.end)}`;
  byId('period-prev').setAttribute('aria-label', t(`planner.prev.${level}`));
  byId('period-next').setAttribute('aria-label', t(`planner.next.${level}`));
  byId('period-current').hidden = isBetween(Dates.today(), period.start, period.end);
}

function renderPlanner() {
  const period = currentPeriod();
  renderHeader(period);
  document.querySelectorAll('.planner-view').forEach((view) => {
    view.hidden = view.dataset.view !== plannerState.level;
  });
  const renderers = { year: renderYear, quarter: renderQuarter, month: renderMonth, week: renderWeek, today: renderToday };
  renderers[plannerState.level](period);
}

// Changes level and/or date, saves it in the address and redraws.
function goTo(level, anchor = plannerState.anchor, moveFocus = false) {
  plannerState.level = level;
  plannerState.anchor = anchor;
  writePlannerUrl();
  renderPlanner();
  if (moveFocus) byId('period-title').focus();
}

function emptyText(key) {
  return `<p class="task-empty">${escapeHtml(t(key))}</p>`;
}

/* ---------- Level: personal year ---------- */

function yearSummary(year) {
  if (year.status === 'upcoming') return t('planner.year.upcoming');
  if (year.status === 'finished') return t('planner.year.finished');
  const passed = t('planner.year.passed', { percent: Format.number(year.percent / 100, { style: 'percent', maximumFractionDigits: 1 }) });
  return `${passed} · ${tPlural('goals.deadline.left', year.totalDays - year.daysPassed)}`;
}

function renderYear(period) {
  const year = Dates.personalYear(isoOf(period.start), Dates.today());
  const filled = year.status === 'upcoming' ? 0 : year.percent;
  // 4 quarters; each one is a button that opens that quarter.
  const quarters = [1, 2, 3, 4].map((number) => {
    const start = Dates.addMonths(period.start, 3 * (number - 1));
    const end = Dates.addDays(Dates.addMonths(period.start, 3 * number), -1);
    return `
      <button type="button" class="year-quarter" style="flex-grow: ${Dates.daysBetween(start, end) + 1}" data-goto-quarter="${isoOf(start)}">
        <span class="year-quarter-name">${escapeHtml(t('planner.quarterShort', { number }))}</span>
        <span class="year-quarter-dates">${escapeHtml(`${Format.shortDate(start)} – ${Format.shortDate(end)}`)}</span>
      </button>`;
  }).join('');
  const marker = year.status === 'active'
    ? `<span class="year-today" style="left: ${year.percent}%" aria-hidden="true"><span>${escapeHtml(t('planner.level.today'))}</span></span>`
    : '';
  byId('year-timeline').innerHTML = `
    <p class="year-summary">${escapeHtml(yearSummary(year))}</p>
    <div class="year-bar">
      <span class="year-fill" style="width: ${filled}%" aria-hidden="true"></span>
      ${quarters}
      ${marker}
    </div>`;

  const goals = getGoals().filter((goal) => goal.status === 'active').sort((a, b) => getGoalPercent(b) - getGoalPercent(a));
  byId('year-goals').innerHTML = goals.length
    ? `<ul class="plan-goals">${goals.map((goal, index) => goalProgressRowHtml(goal, index, 'year-goal')).join('')}</ul>`
    : emptyText('planner.year.noGoals');
}

/* ---------- Level: quarter ---------- */

// Milestones and goal deadlines between start and end, sorted by date.
function getCheckpoints(start, end) {
  const points = [];
  getGoals().filter((goal) => goal.status !== 'archived').forEach((goal) => {
    asArray(goal.milestones).forEach((milestone) => {
      if (isBetween(Dates.parse(milestone.dueDate), start, end)) {
        points.push({ date: milestone.dueDate, text: milestone.title, goal, done: Boolean(milestone.done), kind: 'milestone' });
      }
    });
    if (isBetween(Dates.parse(goal.deadline), start, end)) {
      points.push({ date: goal.deadline, text: t('planner.checkpoint.deadline', { title: goal.title }), goal,
        done: goal.status === 'completed', kind: 'deadline' });
    }
  });
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

function renderQuarter(period) {
  const selected = new Set(asArray(getPeriodPlan(period.key).goalIds));
  const goals = getGoals().filter((goal) => goal.status === 'active' || (selected.has(goal.id) && goal.status !== 'archived'));
  byId('quarter-goals').innerHTML = goals.length
    ? `<ul class="edit-list">${goals.map((goal, index) => `
        <li>
          <input class="form-check-input mt-0" type="checkbox" id="quarter-goal-${index}" data-quarter-goal="${escapeHtml(goal.id)}"${selected.has(goal.id) ? ' checked' : ''}>
          <label class="item-text" for="quarter-goal-${index}">${escapeHtml(goal.title)}</label>
          <span class="item-date">${escapeHtml(Format.number(getGoalPercent(goal) / 100, { style: 'percent' }))}</span>
        </li>`).join('')}</ul>`
    : emptyText('planner.year.noGoals');

  const points = getCheckpoints(period.start, period.end);
  byId('quarter-checkpoints').innerHTML = points.length
    ? `<ul class="checkpoints">${points.map((point) => `
        <li class="${point.done ? 'is-done' : ''}">
          <span class="checkpoint-date">${escapeHtml(Format.shortDate(point.date))}</span>
          <i class="bi ${point.kind === 'milestone' ? 'bi-flag' : 'bi-calendar-event'}" aria-hidden="true"></i>
          <span class="checkpoint-text">
            ${escapeHtml(point.text)}
            ${point.kind === 'milestone' ? `<a href="goal-details.html?id=${escapeHtml(encodeURIComponent(point.goal.id))}">${escapeHtml(point.goal.title)}</a>` : ''}
          </span>
          ${point.done ? `<span class="checkpoint-done"><i class="bi bi-check2" aria-hidden="true"></i> ${escapeHtml(t('planner.checkpoint.done'))}</span>` : ''}
        </li>`).join('')}</ul>`
    : emptyText('planner.quarter.noCheckpoints');
}

function saveQuarterGoals() {
  const goalIds = [...document.querySelectorAll('[data-quarter-goal]:checked')].map((box) => box.dataset.quarterGoal);
  if (updatePeriodPlan(currentPeriod().key, { goalIds })) showToast('toast.quarterSaved', 'success');
}

/* ---------- Level: month (calendar grid, our own code) ---------- */

// iso date -> number of deadlines/milestones on that day
function deadlineCounts() {
  const counts = new Map();
  const add = (date) => counts.set(date, (counts.get(date) ?? 0) + 1);
  getGoals().filter((goal) => goal.status === 'active').forEach((goal) => {
    if (Dates.parse(goal.deadline)) add(goal.deadline);
    asArray(goal.milestones).filter((milestone) => !milestone.done).forEach((milestone) => add(milestone.dueDate));
  });
  return counts;
}

function dayLabel(date, taskCount, deadlineCount) {
  const parts = [Format.date(date, { dateStyle: 'long' })];
  if (taskCount) parts.push(tPlural('planner.tasksCount', taskCount));
  if (deadlineCount) parts.push(tPlural('planner.deadlinesCount', deadlineCount));
  return parts.join(', ');
}

// Saturday and Sunday get another color in the calendar (the day names still say it).
function isWeekend(day) {
  return day.getDay() === 0 || day.getDay() === 6;
}

// One mark in a day cell: a dot + "3 tasks" (on a phone only the dot is shown, see the legend).
function calMarkHtml(dotClass, count, pluralKey) {
  if (!count) return '';
  return `<span class="cal-mark"><span class="cal-dot ${dotClass}"></span><span class="cal-mark-text">${escapeHtml(tPlural(pluralKey, count))}</span></span>`;
}

function renderMonth(period) {
  const tasks = getTasks();
  const deadlines = deadlineCounts();
  const today = isoOf(Dates.today());
  const gridStart = Dates.startOfWeek(period.start); // the grid starts on Monday
  const weeks = Math.ceil((Dates.daysBetween(gridStart, period.end) + 1) / 7);

  const head = Array.from({ length: 7 }, (_, index) => {
    const day = Dates.addDays(gridStart, index);
    return `<th scope="col"${isWeekend(day) ? ' class="is-weekend"' : ''}><span aria-hidden="true">${escapeHtml(capitalize(Format.weekday(day, 'short')))}</span><span class="visually-hidden">${escapeHtml(Format.weekday(day, 'long'))}</span></th>`;
  }).join('');

  const rows = Array.from({ length: weeks }, (_, week) => {
    const cells = Array.from({ length: 7 }, (_, index) => {
      const day = Dates.addDays(gridStart, week * 7 + index);
      const iso = isoOf(day);
      const taskCount = getTasksForDate(iso, tasks).length;
      const deadlineCount = deadlines.get(iso) ?? 0;
      const classes = ['cal-day'];
      if (day.getMonth() !== period.start.getMonth()) classes.push('is-outside');
      if (iso === today) classes.push('is-today');
      if (isWeekend(day)) classes.push('is-weekend');
      return `
        <td>
          <button type="button" class="${classes.join(' ')}" data-goto-day="${iso}"${iso === today ? ' aria-current="date"' : ''}
                  aria-label="${escapeHtml(dayLabel(day, taskCount, deadlineCount))}">
            <span class="cal-num" aria-hidden="true">${day.getDate()}</span>
            <span class="cal-marks" aria-hidden="true">
              ${calMarkHtml('dot-task', taskCount, 'planner.tasksCount')}${calMarkHtml('dot-deadline', deadlineCount, 'planner.deadlinesCount')}
            </span>
          </button>
        </td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  byId('month-calendar').innerHTML = `
    <table class="cal-table">
      <caption class="visually-hidden">${escapeHtml(period.title)}</caption>
      <thead><tr>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Tasks planned for the whole month (period "month" with a date in this month)
  const monthTasks = tasks
    .filter((task) => task.period === 'month' && Dates.parse(task.date) && Dates.monthKey(task.date) === period.key)
    .map((task) => ({ task, date: task.date, done: isTaskDoneOn(task, task.date) }))
    .sort(compareTaskOccurrences);
  TaskList.render(byId('month-tasks'), monthTasks, { showDate: true, emptyKey: 'planner.month.noTasks' });
}

/* ---------- Level: week ---------- */

// Load of a day by the number of open tasks — shown as text and as a bar.
function dayLoad(openCount) {
  if (openCount === 0) return 'free';
  if (openCount <= 2) return 'light';
  if (openCount <= 4) return 'medium';
  return 'heavy';
}

function renderWeek(period) {
  // The saved focus is put into the input only when the week changes, not on every redraw.
  if (plannerState.focusKey !== period.key) {
    byId('week-focus').value = getPeriodPlan(period.key).focus ?? '';
    setFieldError(byId('week-focus'), null);
    plannerState.focusKey = period.key;
  }
  const tasks = getTasks();
  const today = isoOf(Dates.today());
  const days = Array.from({ length: 7 }, (_, index) => Dates.addDays(period.start, index));

  byId('week-days').innerHTML = days.map((day, index) => weekDayHtml(day, index, tasks, today)).join('');

  days.forEach((day, index) => {
    const occurrences = getTasksForDate(isoOf(day), tasks);
    if (occurrences.length) TaskList.render(byId(`week-day-tasks-${index}`), occurrences, { weekActions: true });
  });
  scrollWeekToToday(period.key);
}

// One day column. An empty day is compact: title, "Free" and a dashed "+ Add" button.
function weekDayHtml(day, index, tasks, today) {
  const iso = isoOf(day);
  const isToday = iso === today;
  const occurrences = getTasksForDate(iso, tasks);
  const open = occurrences.filter((occurrence) => !occurrence.done).length;
  const load = dayLoad(open);
  const name = `${capitalize(Format.weekday(day, 'short'))}, ${Format.date(day, { day: 'numeric', month: 'long' })}`;
  // Narrow columns show "Thu, 12" (the month is in the week title); the phone list shows the full date.
  const shortName = `${capitalize(Format.weekday(day, 'short'))}, ${day.getDate()}`;
  const addLabel = t('planner.addTaskFor', { date: Format.date(day, { dateStyle: 'long' }) });
  const body = occurrences.length
    ? `<p class="week-load load-${load}">
         <span class="week-load-bar" aria-hidden="true"><span style="width: ${Math.min(open / 6, 1) * 100}%"></span></span>
         <span class="week-load-text">${escapeHtml(`${tPlural('planner.tasksCount', open)} · ${t(`planner.load.${load}`)}`)}</span>
       </p>
       <div class="week-day-tasks" id="week-day-tasks-${index}"></div>`
    : `<p class="week-free">${escapeHtml(t('planner.week.free'))}</p>
       <button type="button" class="btn week-add-empty" id="week-add-${index}" data-add-task-day="${iso}" aria-label="${escapeHtml(addLabel)}">
         <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>${escapeHtml(t('planner.week.add'))}
       </button>
       <div class="week-day-tasks" id="week-day-tasks-${index}"></div>`;
  const addIcon = occurrences.length
    ? `<button type="button" class="btn btn-icon week-add" id="week-add-${index}" data-add-task-day="${iso}"
               aria-label="${escapeHtml(addLabel)}" title="${escapeHtml(addLabel)}">
         <i class="bi bi-plus-lg" aria-hidden="true"></i>
       </button>`
    : '';
  return `
      <section class="week-day${isToday ? ' is-today' : ''}${occurrences.length ? '' : ' is-empty'}" data-day="${iso}" aria-labelledby="week-day-title-${index}">
        <header class="week-day-head">
          <h3 class="week-day-title" id="week-day-title-${index}">
            <a href="?level=today&amp;date=${iso}" data-goto-day="${iso}"${isToday ? ' aria-current="date"' : ''} aria-label="${escapeHtml(name)}"><span class="week-name-long">${escapeHtml(name)}</span><span class="week-name-short" aria-hidden="true">${escapeHtml(shortName)}</span></a>
          </h3>
          ${isToday ? `<span class="week-today-badge">${escapeHtml(t('planner.week.todayBadge'))}</span>` : ''}
          ${addIcon}
        </header>
        ${body}
      </section>`;
}

// When the 7 columns do not fit, the week scrolls sideways: show today (once per week, not on every redraw).
function scrollWeekToToday(weekKey) {
  if (plannerState.scrolledWeek === weekKey) return;
  plannerState.scrolledWeek = weekKey;
  const strip = byId('week-days');
  const todayColumn = strip.querySelector('.week-day.is-today');
  if (!todayColumn || strip.scrollWidth <= strip.clientWidth) return;
  const todayRight = todayColumn.offsetLeft + todayColumn.offsetWidth; // .week-days is position: relative
  if (todayRight <= strip.clientWidth) return; // today is already visible
  strip.scrollLeft = todayColumn.offsetLeft;
}

function saveWeekFocus(event) {
  event.preventDefault();
  const input = byId('week-focus');
  const focus = input.value.trim();
  const error = focus.length > WEEK_FOCUS_MAX_LENGTH ? 'planner.error.focusLength' : null;
  setFieldError(input, error);
  if (error) {
    input.focus();
    return;
  }
  input.value = focus;
  if (updatePeriodPlan(currentPeriod().key, { focus })) showToast('toast.focusSaved', 'success');
}

/* ---------- Week: drag and drop (HTML5 Drag and Drop API) ----------
   Drag a one-time task onto another day. The day under the cursor is highlighted.
   Phones and keyboards use the ‹ › buttons of the task instead (same moveTask()). */

function clearDropTargets() {
  document.querySelectorAll('.week-day.is-drop-target').forEach((day) => day.classList.remove('is-drop-target'));
}

function bindWeekDragAndDrop() {
  const week = byId('week-days');
  week.addEventListener('dragstart', (event) => {
    const item = event.target.closest('[data-drag-task]');
    if (!item) return;
    event.dataTransfer.setData('text/plain', item.dataset.dragTask);
    event.dataTransfer.effectAllowed = 'move';
    item.classList.add('is-dragging');
  });
  week.addEventListener('dragend', (event) => {
    event.target.closest('[data-drag-task]')?.classList.remove('is-dragging');
    clearDropTargets();
  });
  // dragover must call preventDefault(), otherwise the browser does not allow a drop here.
  week.addEventListener('dragover', (event) => {
    const day = event.target.closest('.week-day');
    if (!day) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!day.classList.contains('is-drop-target')) {
      clearDropTargets();
      day.classList.add('is-drop-target');
    }
  });
  week.addEventListener('dragleave', (event) => {
    const day = event.target.closest('.week-day');
    if (day && !day.contains(event.relatedTarget)) day.classList.remove('is-drop-target');
  });
  week.addEventListener('drop', (event) => {
    const day = event.target.closest('.week-day');
    const taskId = event.dataTransfer.getData('text/plain');
    clearDropTargets();
    if (!day || !taskId) return;
    event.preventDefault();
    const task = getTasks().find((item) => item.id === taskId);
    if (!task || task.date === day.dataset.day) return; // dropped on the same day
    const moved = moveTask(taskId, day.dataset.day);
    if (!moved) return;
    showToast('toast.taskMoved', 'success', { date: Format.date(moved.date, { dateStyle: 'long' }) });
    onPlannerTasksChanged({ focusId: taskDomId(moved, moved.date) });
  });
}

/* ---------- Level: today (one day) ---------- */

function renderToday(period) {
  const iso = isoOf(period.start);
  byId('today-sport-line').innerHTML = sportDayLineHtml(iso);
  TaskList.render(byId('today-tasks'), getTasksForDate(iso), { emptyKey: 'task.list.empty' });
  renderHabits(iso);
  renderQuickRecord();
}

// Habits = active goals with the "streak" type. One button marks the shown day.
function renderHabits(iso) {
  const entries = getProgressEntries();
  const habits = getGoals()
    .filter((goal) => goal.status === 'active' && goal.progressType === 'streak')
    .map((goal) => withLiveStreak(goal, entries));
  if (habits.length === 0) {
    byId('today-habits').innerHTML = emptyText('planner.today.noHabits');
    return;
  }
  const isFuture = Dates.parse(iso) > Dates.today();
  const items = habits.map((goal, index) => {
    const isMarked = getGoalEntries(goal.id, entries).some((entry) => entry.date === iso);
    const action = isMarked
      ? `<span class="habit-done" id="habit-${index}" tabindex="-1"><i class="bi bi-check-circle-fill" aria-hidden="true"></i> ${escapeHtml(t('planner.habit.done'))}</span>`
      : `<button type="button" class="btn btn-tool btn-sm" id="habit-${index}" data-habit="${escapeHtml(goal.id)}"${isFuture ? ' disabled' : ''}
                 aria-label="${escapeHtml(t('planner.habit.markLabel', { title: goal.title }))}">
           <i class="bi bi-check2 me-1" aria-hidden="true"></i>${escapeHtml(t('details.entry.markDay'))}
         </button>`;
    return `
      <li class="habit" data-color="${goalColor(goal)}">
        <span class="goal-icon" aria-hidden="true"><i class="bi ${goalIcon(goal)}"></i></span>
        <div class="habit-body">
          <a href="goal-details.html?id=${escapeHtml(encodeURIComponent(goal.id))}">${escapeHtml(goal.title)}</a>
          <span class="habit-streak">${escapeHtml(formatGoalProgress(goal))}</span>
        </div>
        ${action}
      </li>`;
  }).join('');
  const futureNote = isFuture ? `<p class="text-secondary small mt-2 mb-0">${escapeHtml(t('planner.habit.future'))}</p>` : '';
  byId('today-habits').innerHTML = `<ul class="habits">${items}</ul>${futureNote}`;
}

function markHabit(goalId, buttonId) {
  const iso = isoOf(plannerState.anchor);
  const alreadyMarked = getGoalEntries(goalId).some((entry) => entry.date === iso);
  if (alreadyMarked || Dates.parse(iso) > Dates.today()) return;
  if (!recordProgress(goalId, { date: iso, value: 1 })) return;
  showToast('toast.entryAdded', 'success');
  renderPlanner();
  byId(buttonId)?.focus(); // now the "Done for this day" text
}

function addQuickTask(event) {
  event.preventDefault();
  const input = byId('quick-task');
  const fields = { title: input.value.trim(), date: isoOf(plannerState.anchor), priority: 'medium', period: 'day' };
  const error = validateTask(fields).title;
  setFieldError(input, error);
  if (error || !addTask(fields)) {
    input.focus();
    return;
  }
  showToast('toast.taskCreated', 'success');
  input.value = '';
  renderPlanner();
  input.focus();
}

// Quick result: money/number add an amount, percent/measurements set a new value.
function renderQuickRecord() {
  const goals = getGoals().filter((goal) => goal.status === 'active' && QUICK_RECORD_TYPES.includes(goal.progressType));
  byId('quick-record-none').hidden = goals.length > 0;
  byId('quick-record-form').hidden = goals.length === 0;
  const select = byId('quick-goal');
  const previous = select.value;
  select.replaceChildren(...goals.map((goal) => createEl('option', { value: goal.id }, goal.title)));
  if (goals.some((goal) => goal.id === previous)) select.value = previous;
  updateQuickRecordLabel();
}

function updateQuickRecordLabel() {
  const goal = getGoalById(byId('quick-goal').value);
  if (!goal) return;
  const label = byId('quick-value-label');
  label.dataset.i18n = DELTA_TYPES.includes(goal.progressType) ? 'planner.record.add' : 'details.entry.newValue';
  label.textContent = t(label.dataset.i18n);
  let unit = goal.unit ?? '';
  if (goal.progressType === 'money') unit = Format.currencySymbol(goal.unit || DEFAULT_CURRENCY);
  if (goal.progressType === 'percent') unit = '%';
  byId('quick-value-unit').textContent = unit;
  byId('quick-value-unit').hidden = unit === '';
}

function saveQuickRecord(event) {
  event.preventDefault();
  const goal = getGoalById(byId('quick-goal').value);
  const input = byId('quick-value');
  if (!goal) return;
  const iso = isoOf(plannerState.anchor);
  const value = readNumber(input);
  const limits = goal.progressType === 'percent' ? { min: 0, max: 100 } : { positive: true };
  let error = numberError(value, limits);
  if (!error && Dates.parse(iso) > Dates.today()) error = 'details.error.dateFuture';
  setFieldError(input, error);
  if (error) {
    input.focus();
    return;
  }
  if (!recordProgress(goal.id, { date: iso, value })) return;
  showToast('toast.entryAdded', 'success');
  input.value = '';
  renderPlanner();
}

/* ---------- Events ---------- */

// Lists were redrawn: put focus back on the same control (it has the same id).
function onPlannerTasksChanged({ focusId } = {}) {
  renderPlanner();
  if (focusId) byId(focusId)?.focus();
}

function bindPlannerEvents() {
  document.querySelectorAll('[data-level]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault(); // no page reload: only the view changes
      goTo(link.dataset.level);
    });
  });
  byId('period-prev').addEventListener('click', () => goTo(plannerState.level, shiftAnchor(-1)));
  byId('period-next').addEventListener('click', () => goTo(plannerState.level, shiftAnchor(1)));
  byId('period-current').addEventListener('click', () => goTo(plannerState.level, Dates.today(), true));

  // Calendar days, week day titles and year quarters open another level.
  document.querySelector('main').addEventListener('click', (event) => {
    const day = event.target.closest('[data-goto-day]');
    const quarter = event.target.closest('[data-goto-quarter]');
    if (day) {
      event.preventDefault();
      goTo('today', Dates.parse(day.dataset.gotoDay), true);
    }
    if (quarter) goTo('quarter', Dates.parse(quarter.dataset.gotoQuarter), true);
  });

  byId('quarter-goals').addEventListener('change', saveQuarterGoals);
  ['month-tasks', 'week-days', 'today-tasks'].forEach((id) => TaskList.bind(byId(id), onPlannerTasksChanged));
  byId('month-task-add').addEventListener('click', () => {
    const period = currentPeriod();
    const today = Dates.today();
    const date = isBetween(today, period.start, period.end) ? today : period.start;
    TaskForm.open({ defaults: { date: isoOf(date), period: 'month' }, onSaved: onPlannerTasksChanged, returnFocusId: 'month-task-add' });
  });
  bindWeekDragAndDrop();
  byId('week-days').addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-task-day]');
    if (!button) return;
    TaskForm.open({ defaults: { date: button.dataset.addTaskDay }, onSaved: onPlannerTasksChanged, returnFocusId: button.id });
  });
  byId('week-focus-form').addEventListener('submit', submitOnce(saveWeekFocus));
  byId('quick-task-form').addEventListener('submit', submitOnce(addQuickTask));
  byId('today-habits').addEventListener('click', (event) => {
    const button = event.target.closest('[data-habit]');
    if (button) markHabit(button.dataset.habit, button.id);
  });
  byId('quick-goal').addEventListener('change', updateQuickRecordLabel);
  byId('quick-record-form').addEventListener('submit', submitOnce(saveQuickRecord));
  document.addEventListener('lifeos:languagechange', renderPlanner);
  document.addEventListener('lifeos:profilechange', renderPlanner); // a new personal year start
}

onAppReady(() => {
  // Dashboard button "Record a result" opens planner.html?level=today#quick-result
  // (read the hash first: writePlannerUrl() rewrites the address without it).
  const openQuickResult = window.location.hash === '#quick-result';
  readPlannerUrl();
  writePlannerUrl(); // shows ?level=… in the address from the start
  bindPlannerEvents();
  renderPlanner();
  if (openQuickResult && plannerState.level === 'today') {
    byId('record-title').scrollIntoView({ block: 'center' });
    byId('quick-goal').focus();
  }
});
