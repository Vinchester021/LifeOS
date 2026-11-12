// LifeOS — Progress (progress.html), concept section 7.
// Everything is counted from what is already saved: goals, tasks and progress entries.
// Part 1 = PURE calculation functions: data in, numbers out (no storage, no HTML).
//          They are checked by the self-test: open progress.html?debug=1
// Part 2 = drawing the page.
// Sport and body are only summarised here (lifeos_sport); the week plan, workouts and
// measurements are entered on sport.html. Their pure functions are in app.js, section 11b.
// Charts are drawn by progress-charts.js (the only file that uses Chart.js).
'use strict';

const PROGRESS_PERIODS = ['week', 'month', 'quarter', 'year'];
const DEFAULT_PROGRESS_PERIOD = 'month';
const STUDY_CATEGORIES = ['education', 'languages'];
// A study goal counts hours when its unit is "h", "hours", "ч", "часов", "сағат"...
const HOURS_UNIT = /^(h|hrs?|hours?|ч|час|часа|часов|сағ|сағат)\.?$/i;

/* =========================================================
   Part 1. Pure calculations
   ========================================================= */

function isInRange(dateValue, start, end) {
  const date = Dates.parse(dateValue);
  return Boolean(date) && date >= start && date <= end;
}

function sumOf(list, getValue) {
  return list.reduce((sum, item) => sum + (Number(getValue(item)) || 0), 0);
}

function countInRange(dates, start, end) {
  return dates.filter((date) => isInRange(date, start, end)).length;
}

function earlier(a, b) {
  return a < b ? a : b;
}

// Bars of the chart: a week or a month -> days, a quarter -> weeks, a year -> months.
function chartBuckets(periodType, start, end) {
  const buckets = [];
  if (periodType === 'week' || periodType === 'month') {
    for (let day = start; day <= end; day = Dates.addDays(day, 1)) buckets.push({ start: day, end: day });
  } else if (periodType === 'quarter') {
    for (let monday = Dates.startOfWeek(start); monday <= end; monday = Dates.addDays(monday, 7)) {
      buckets.push({ start: monday < start ? start : monday, end: earlier(Dates.addDays(monday, 6), end) });
    }
  } else {
    for (let month = start; month <= end; month = Dates.addMonths(month, 1)) {
      buckets.push({ start: month, end: earlier(Dates.addDays(Dates.addMonths(month, 1), -1), end) });
    }
  }
  return buckets;
}

function countByBuckets(dates, buckets) {
  return buckets.map((bucket) => countInRange(dates, bucket.start, bucket.end));
}

// { difference, percent } — percent is null when there is nothing to compare with (previous = 0).
function compareValues(current, previous) {
  const difference = current - previous;
  return { difference, percent: previous === 0 ? null : difference / previous };
}

function activeDaysInRange(counts, start, end) {
  let days = 0;
  counts.forEach((count, iso) => {
    if (count > 0 && isInRange(iso, start, end)) days++;
  });
  return days;
}

function entriesInRange(entries, start, end) {
  return entries.filter((entry) => isInRange(entry.date, start, end));
}

// Average percent of all goals that are not archived; null if there are none.
function overallGoalPercent(goals) {
  const list = goals.filter((goal) => goal.status !== 'archived');
  return list.length ? Math.round(sumOf(list, getGoalPercent) / list.length) : null;
}

// Books: finished books and pages read in a period (goals: category "books", type "number").
function bookStats(goals, entries, start, end) {
  const ids = new Set(goals.filter((goal) => goal.category === 'books' && goal.progressType === 'number').map((goal) => goal.id));
  const list = entriesInRange(entries, start, end).filter((entry) => ids.has(entry.goalId));
  return { hasGoals: ids.size > 0, books: sumOf(list, (entry) => entry.value), pages: sumOf(list, (entry) => entry.pages) };
}

// Months from the first month to the last one, both counted: Sep -> Nov = 3.
function monthsInclusive(fromValue, toValue) {
  const from = Dates.parse(fromValue);
  const to = Dates.parse(toValue);
  return Math.max((to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1, 1);
}

// Finance, one row per currency: saved now, target, remaining, average added per month
// (everything added through entries / months since the first entry), added in the period.
function financeStats(goals, entries, start, end, todayValue) {
  const rows = new Map();
  goals.filter((goal) => goal.progressType === 'money' && goal.status !== 'archived').forEach((goal) => {
    const currency = goal.unit || DEFAULT_CURRENCY;
    const row = rows.get(currency) ?? { currency, saved: 0, target: 0, remaining: 0, added: 0, inPeriod: 0, firstDate: null };
    const current = Number(goal.currentValue) || 0;
    const target = Number(goal.targetValue) || 0;
    row.saved += current;
    row.target += target;
    row.remaining += Math.max(target - current, 0);
    entries.filter((entry) => entry.goalId === goal.id).forEach((entry) => {
      row.added += Number(entry.value) || 0;
      if (isInRange(entry.date, start, end)) row.inPeriod += Number(entry.value) || 0;
      if (!row.firstDate || entry.date < row.firstDate) row.firstDate = entry.date;
    });
    rows.set(currency, row);
  });
  return [...rows.values()].map((row) => ({
    ...row,
    averagePerMonth: row.firstDate ? row.added / monthsInclusive(row.firstDate, todayValue) : 0
  }));
}

function isHoursUnit(unit) {
  return HOURS_UNIT.test(String(unit ?? '').trim());
}

// Study (Education and Languages goals): hours from goals measured in hours, topics = checklist items.
function studyStats(goals, entries, start, end) {
  const study = goals.filter((goal) => STUDY_CATEGORIES.includes(goal.category) && goal.status !== 'archived');
  const hourIds = new Set(study.filter((goal) => goal.progressType === 'number' && isHoursUnit(goal.unit)).map((goal) => goal.id));
  const topics = study.flatMap((goal) => asArray(goal.checklist));
  return {
    goals: study.length,
    hasHourGoals: hourIds.size > 0,
    hours: sumOf(entriesInRange(entries, start, end).filter((entry) => hourIds.has(entry.goalId)), (entry) => entry.value),
    topicsDone: topics.filter((item) => item && item.done).length,
    topicsTotal: topics.length
  };
}

// Habits (streak goals): the current streak and the best one ever.
function habitStats(goals, entries, todayValue) {
  return goals.filter((goal) => goal.progressType === 'streak' && goal.status !== 'archived').map((goal) => {
    const dates = entries.filter((entry) => entry.goalId === goal.id).map((entry) => entry.date);
    const current = dates.length ? calculateStreak(dates, todayValue) : Number(goal.currentValue) || 0;
    return { goal, current, best: Math.max(bestStreak(dates), current), target: Number(goal.targetValue) || 0 };
  });
}

// Weeks (columns) × 7 days (rows) for the heatmap of the personal year.
function heatmapWeeks(start, end, counts, todayValue) {
  const today = Dates.parse(todayValue);
  const weeks = [];
  for (let monday = Dates.startOfWeek(start); monday <= end; monday = Dates.addDays(monday, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => {
      const day = Dates.addDays(monday, index);
      const iso = Dates.toISO(day);
      const count = counts.get(iso) ?? 0;
      return { iso, count, level: activityLevel(count), isInYear: day >= start && day <= end, isFuture: day > today };
    }));
  }
  return weeks;
}

// One row per month of the personal year: active days and actions (the table for screen readers).
function monthlyActivity(start, end, counts) {
  return chartBuckets('year', start, end).map((month) => {
    let activeDays = 0;
    let actions = 0;
    counts.forEach((count, iso) => {
      if (isInRange(iso, month.start, month.end)) {
        actions += count;
        if (count > 0) activeDays++;
      }
    });
    return { start: month.start, activeDays, actions };
  });
}


/* ----- Goals in the past: "compared with the previous period" (pure) ----- */

// The value of a goal at the end of a day, rebuilt from its entries:
// money/number = now minus what was added later; percent/measurements/levels = the last entry until then;
// streak = the streak on that day; checklist has no history (its value now is used).
function goalValueAt(goal, entries, dateValue) {
  const iso = Dates.toISO(Dates.parse(dateValue));
  const own = entries.filter((entry) => entry.goalId === goal.id);
  if (DELTA_TYPES.includes(goal.progressType)) {
    return (Number(goal.currentValue) || 0) - sumOf(own.filter((entry) => String(entry.date) > iso), (entry) => entry.value);
  }
  if (ABSOLUTE_TYPES.includes(goal.progressType)) {
    const before = own.filter((entry) => String(entry.date) <= iso).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return before.length ? Number(before[0].value) : Number(goal.startValue) || 0;
  }
  if (goal.progressType === 'streak') {
    return calculateStreak(own.filter((entry) => String(entry.date) <= iso).map((entry) => entry.date), dateValue);
  }
  return goal.currentValue;
}

// The same goals as now, as they were on a past day — so the change shows the progress made,
// not that new goals were added. A goal created later counts with its start value;
// a goal completed later was still active then.
function goalAsOn(goal, entries, iso) {
  const day = (value) => String(value ?? '').slice(0, 10);
  const isNewer = goal.createdAt && day(goal.createdAt) > iso;
  const value = isNewer ? goal.startValue : goalValueAt(goal, entries, iso);
  const status = goal.status === 'completed' && day(goal.updatedAt) > iso ? 'active' : goal.status;
  return { ...goal, status, currentValue: value, checklist: isNewer ? [] : goal.checklist };
}

function overallGoalPercentAt(goals, entries, dateValue) {
  const iso = Dates.toISO(Dates.parse(dateValue));
  const list = goals.filter((goal) => goal.status !== 'archived');
  if (list.length === 0) return null;
  const percents = list.map((goal) => getGoalPercent(goalAsOn(goal, entries, iso)));
  return Math.round(sumOf(percents, (percent) => percent) / list.length);
}

// Habits (streak goals) in a period: days marked / days that could be marked (until today).
function habitConsistency(goals, entries, start, end, todayValue) {
  const habits = goals.filter((goal) => goal.progressType === 'streak' && goal.status !== 'archived');
  const last = earlier(end, Dates.parse(todayValue));
  const days = last < start ? 0 : Dates.daysBetween(start, last) + 1;
  const marked = habits.reduce((sum, goal) => {
    const dates = new Set(entries.filter((entry) => entry.goalId === goal.id && isInRange(entry.date, start, last)).map((entry) => entry.date));
    return sum + dates.size;
  }, 0);
  return { habits: habits.length, marked, possible: habits.length * days };
}

/* ----- Series for the charts (pure) ----- */

// Savings over time in one currency: what was there before the entries + every entry, by date.
function savingsSeries(goals, entries, currency = DEFAULT_CURRENCY) {
  const moneyGoals = goals.filter((goal) => goal.progressType === 'money' && goal.status !== 'archived' && (goal.unit || DEFAULT_CURRENCY) === currency);
  const ids = new Set(moneyGoals.map((goal) => goal.id));
  const list = entries.filter((entry) => ids.has(entry.goalId)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const now = sumOf(moneyGoals, (goal) => goal.currentValue);
  let total = now - sumOf(list, (entry) => entry.value); // the amount before the first entry
  const byDate = new Map();
  list.forEach((entry) => {
    total += Number(entry.value) || 0;
    byDate.set(entry.date, total); // the last total of each day
  });
  return [...byDate.entries()].map(([date, value]) => ({ date, value }));
}

// Completed tasks in each of the last `weeks` weeks (oldest first).
function weeklyTaskCounts(completionDates, todayValue, weeks = 12) {
  const thisMonday = Dates.startOfWeek(todayValue);
  return Array.from({ length: weeks }, (_, index) => {
    const start = Dates.addDays(thisMonday, -7 * (weeks - 1 - index));
    return { start, count: countInRange(completionDates, start, Dates.addDays(start, 6)) };
  });
}

/* ----- Year summary (pure) ----- */

// What is kept about a goal in the archive (enough to show "at the start / now" later).
function goalSnapshot(goal) {
  return {
    id: goal.id, title: goal.title, category: goal.category, icon: goal.icon, color: goal.color,
    progressType: goal.progressType, unit: goal.unit ?? '', levels: asArray(goal.levels),
    startValue: goal.startValue, currentValue: goal.currentValue, targetValue: goal.targetValue,
    checklist: asArray(goal.checklist).map((item) => ({ done: Boolean(item?.done) })),
    status: goal.status, percent: getGoalPercent(goal)
  };
}

// Totals of a personal year between start and end.
// sport = { sessions, body } from lifeos_sport.
function buildYearSummary({ goals, tasks, entries, sport = { sessions: [], body: [] }, start, end }) {
  const visible = goals.filter((goal) => goal.status !== 'archived');
  const counts = countActivityByDay(tasks, entries, sport.sessions);
  const body = sortBodyEntries(sport.body).filter((entry) => isInRange(entry.date, start, end) && Number.isFinite(entry.weight));
  return {
    goalsTotal: visible.length,
    goalsAchieved: visible.filter((goal) => getGoalPercent(goal) >= 100).length,
    tasksDone: countInRange(taskCompletionDates(tasks), start, end),
    activeDays: activeDaysInRange(counts, start, end),
    results: entriesInRange(entries, start, end).length,
    workouts: sportStats(sport.sessions, start, end).days,
    bestStreak: habitStats(visible, entries, end).reduce((best, habit) => Math.max(best, habit.best), 0),
    weightStart: body.length ? body[0].weight : null,
    weightEnd: body.length ? body[body.length - 1].weight : null,
    goals: visible.map(goalSnapshot)
  };
}

// The week (Monday–Sunday, cut to the year) with the most completed tasks, or null if there are none.
function bestWeek(completionDates, start, end) {
  let best = null;
  for (let monday = Dates.startOfWeek(start); monday <= end; monday = Dates.addDays(monday, 7)) {
    const from = monday < start ? start : monday;
    const to = earlier(Dates.addDays(monday, 6), end);
    const count = countInRange(completionDates, from, to);
    if (count > 0 && (!best || count > best.count)) best = { start: from, end: to, count };
  }
  return best;
}

// Categories by the average percent of their goals (goal snapshots of the summary), best first.
function bestCategories(goals, limit = 3) {
  const groups = new Map();
  goals.forEach((goal) => {
    const category = goal.category in GOAL_CATEGORIES ? goal.category : 'custom';
    const group = groups.get(category) ?? { category, total: 0, count: 0 };
    group.total += Number(goal.percent) || 0;
    group.count += 1;
    groups.set(category, group);
  });
  return [...groups.values()]
    .map((group) => ({ category: group.category, count: group.count, percent: Math.round(group.total / group.count) }))
    .sort((a, b) => b.percent - a.percent || b.count - a.count)
    .slice(0, limit);
}

// The change of a goal since the start: amount (in the goal's own values) and the wanted direction
// (+1: the goal grows, −1: the goal goes down, like weight). A checklist counts ticked items.
function snapshotChange(goal) {
  if (goal.progressType === 'checklist') {
    return { amount: asArray(goal.checklist).filter((item) => item && item.done).length, direction: 1 };
  }
  const start = Number(goal.startValue) || 0;
  const target = Number(goal.targetValue) || 0;
  return { amount: roundOne((Number(goal.currentValue) || 0) - start), direction: Math.sign(target - start) || 1 };
}

/* =========================================================
   Part 2. Drawing the page
   ========================================================= */

const progressState = { period: DEFAULT_PROGRESS_PERIOD, anchor: Dates.today() };

function readProgressUrl() {
  const params = new URLSearchParams(window.location.search);
  const period = params.get('period');
  progressState.period = PROGRESS_PERIODS.includes(period) ? period : DEFAULT_PROGRESS_PERIOD;
  progressState.anchor = Dates.parse(params.get('date')) ?? Dates.today();
}

function writeProgressUrl() {
  const params = new URLSearchParams(window.location.search);
  params.set('period', progressState.period);
  const date = Dates.toISO(progressState.anchor);
  if (date === Dates.toISO(Dates.today())) params.delete('date');
  else params.set('date', date);
  history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

function yearStart() {
  return getProfile()?.personalYearStart;
}

// The chosen period and the one before it.
function progressPeriods() {
  const { period, anchor } = progressState;
  const current = getPeriodRange(period, anchor, yearStart());
  const previous = getPeriodRange(period, shiftPeriodAnchor(period, anchor, -1), yearStart());
  return { current, previous };
}

function rangeText(range) {
  return Format.dateRange(range.start, range.end);
}

function percentText(value) {
  return Format.number(value, { style: 'percent', maximumFractionDigits: 1 });
}

function numberText(value) {
  return Format.number(value, { maximumFractionDigits: 1 });
}

function emptyBlock(key) {
  return `<p class="task-empty">${escapeHtml(t(key))}</p>`;
}

// "+2" / "−3" / "0" in a soft badge. good = +1 (more is better), −1 (less is better), 0 (no color).
// The sign is always written; the color only helps.
function deltaBadgeHtml(difference, format = numberText, good = 1) {
  const sign = difference > 0 ? '+' : difference < 0 ? '−' : '';
  let tone = '';
  if (good !== 0 && difference !== 0) tone = Math.sign(difference) === good ? 'is-success' : 'is-warning';
  return `<span class="badge-status ${tone}">${escapeHtml(`${sign}${format(Math.abs(difference))}`)}</span>`;
}

function deltaLineHtml(current, previous, format = numberText) {
  return `<p class="kpi-delta">${deltaBadgeHtml(current - previous, format)}<span>${escapeHtml(t('progress.delta.vsPrevious'))}</span></p>`;
}

/* ----- Banner + toolbar ----- */

// Less than 30 days left, or the year is over: a banner with "View the summary".
function renderYearBanner(year) {
  const banner = byId('year-banner');
  const daysLeft = year ? year.totalDays - year.daysPassed : null;
  const show = Boolean(year) && (year.status === 'finished' || (year.status === 'active' && daysLeft < 30));
  banner.hidden = !show;
  if (!show) return;
  byId('year-banner-text').textContent = year.status === 'finished'
    ? t('progress.banner.ended')
    : t('progress.banner.soon', { days: tPlural('progress.days', daysLeft) });
}

function renderPeriodBar({ current, previous }) {
  document.querySelectorAll('[data-period]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.period === progressState.period));
  });
  byId('period-title').textContent = rangeText(current);
  byId('compare-note').textContent = t('progress.compareWith', { range: rangeText(previous) });
  byId('period-prev').setAttribute('aria-label', t(`planner.prev.${progressState.period}`));
  byId('period-next').setAttribute('aria-label', t(`planner.next.${progressState.period}`));
  byId('period-current').hidden = isInRange(Dates.toISO(Dates.today()), current.start, current.end);
}

/* ----- 4 KPI cards ----- */

function kpiCardHtml({ icon, tone, labelKey, value, deltaHtml }) {
  return `
    <section class="panel kpi-card prog-kpi">
      <span class="kpi-icon ${tone}" aria-hidden="true"><i class="bi ${icon}"></i></span>
      <h3 class="kpi-label">${escapeHtml(t(labelKey))}</h3>
      <p class="kpi-value">${escapeHtml(value)}</p>
      ${deltaHtml}
    </section>`;
}

// The goals' average at the end of a period (today for the current one).
function goalPercentForPeriod(data, range) {
  return range.end >= Dates.today() ? overallGoalPercent(data.goals) : overallGoalPercentAt(data.goals, data.entries, range.end);
}

function renderSummary(data, { current, previous }) {
  const doneNow = countInRange(data.completions, current.start, current.end);
  const donePrev = countInRange(data.completions, previous.start, previous.end);
  const activeNow = activeDaysInRange(data.counts, current.start, current.end);
  const activePrev = activeDaysInRange(data.counts, previous.start, previous.end);
  const entriesNow = entriesInRange(data.entries, current.start, current.end).length;
  const entriesPrev = entriesInRange(data.entries, previous.start, previous.end).length;
  const goalsNow = goalPercentForPeriod(data, current);
  const goalsPrev = overallGoalPercentAt(data.goals, data.entries, previous.end);
  const percent = (value) => percentText(value / 100);
  byId('summary-cards').innerHTML = [
    kpiCardHtml({ icon: 'bi-check2-square', tone: 'is-success', labelKey: 'progress.card.tasks', value: Format.number(doneNow), deltaHtml: deltaLineHtml(doneNow, donePrev) }),
    kpiCardHtml({ icon: 'bi-calendar-check', tone: 'is-warning', labelKey: 'progress.card.activeDays', value: Format.number(activeNow), deltaHtml: deltaLineHtml(activeNow, activePrev) }),
    kpiCardHtml({ icon: 'bi-list-check', tone: '', labelKey: 'progress.card.entries', value: Format.number(entriesNow), deltaHtml: deltaLineHtml(entriesNow, entriesPrev) }),
    kpiCardHtml({ icon: 'bi-bullseye', tone: 'is-warning', labelKey: 'progress.card.goals', value: goalsNow === null ? '—' : percent(goalsNow),
      deltaHtml: goalsNow === null || goalsPrev === null ? '' : deltaLineHtml(goalsNow, goalsPrev, percent) })
  ].join('');
}

/* ----- Completed tasks: a bar per day (week, month), week (quarter) or month (year) ----- */

function bucketLabel(bucket) {
  const type = progressState.period;
  if (type === 'week') return upperFirst(Format.weekday(bucket.start, 'short'));
  if (type === 'month') return String(bucket.start.getDate());
  if (type === 'quarter') return t('progress.weekShort', { number: Dates.isoWeek(bucket.start).week });
  return upperFirst(Format.date(bucket.start, { month: 'short' }));
}

// The second line under a bar of the week: "9 Nov".
function bucketSubLabel(bucket) {
  return progressState.period === 'week' ? Format.date(bucket.start, { day: 'numeric', month: 'short' }) : '';
}

function bucketFullName(bucket) {
  const type = progressState.period;
  if (type === 'week' || type === 'month') return Format.date(bucket.start, { dateStyle: 'long' });
  if (type === 'year') return upperFirst(Format.date(bucket.start, { month: 'long', year: 'numeric' }));
  return rangeText(bucket);
}

// Bars are only a picture (aria-hidden); the table below has the same numbers for screen readers.
function renderTasksChart(data, { current, previous }) {
  const buckets = chartBuckets(progressState.period, current.start, current.end);
  const values = countByBuckets(data.completions, buckets);
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);
  const previousTotal = countInRange(data.completions, previous.start, previous.end);
  const isDense = buckets.length > 14;
  const bars = buckets.map((bucket, index) => `
    <div class="bar-col" title="${escapeHtml(`${bucketFullName(bucket)}: ${values[index]}`)}">
      <span class="bar-value">${isDense && !values[index] ? '' : values[index]}</span>
      <span class="bar" style="height: ${(values[index] / max) * 100}%"></span>
      <span class="bar-label">${escapeHtml(bucketLabel(bucket))}${bucketSubLabel(bucket) ? `<small>${escapeHtml(bucketSubLabel(bucket))}</small>` : ''}</span>
    </div>`).join('');
  const rows = buckets.map((bucket, index) =>
    `<tr><th scope="row">${escapeHtml(bucketFullName(bucket))}</th><td>${values[index]}</td></tr>`).join('');
  byId('tasks-chart-total').innerHTML = `<strong>${escapeHtml(tPlural('planner.tasksCount', total))}</strong>${deltaBadgeHtml(total - previousTotal)}`;
  byId('tasks-chart').innerHTML = `
    ${total === 0 ? emptyBlock('progress.tasks.empty') : ''}
    <div class="bar-chart${isDense ? ' is-dense' : ''}" aria-hidden="true">${bars}</div>
    <table class="visually-hidden">
      <caption>${escapeHtml(t('progress.tasks.title'))}</caption>
      <thead><tr><th scope="col">${escapeHtml(t('progress.table.period'))}</th><th scope="col">${escapeHtml(t('progress.table.tasks'))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ----- Progress of goals: the time of the year against the average of the goals ----- */

function meterHtml({ id, labelKey, percent, note }) {
  return `
    <div class="prog-meter">
      <div class="prog-meter-head">
        <span id="${id}">${escapeHtml(t(labelKey))}</span>
        <strong>${escapeHtml(percentText(percent / 100))}</strong>
      </div>
      <div class="progress" role="progressbar" aria-labelledby="${id}" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar" style="width: ${percent}%"></div>
      </div>
      <p class="prog-meter-note">${escapeHtml(note)}</p>
    </div>`;
}

function renderGoalsProgress(data) {
  const goals = data.goals.filter((goal) => goal.status !== 'archived');
  const overall = overallGoalPercent(goals);
  if (overall === null) {
    byId('goals-progress').innerHTML = emptyBlock('planner.year.noGoals');
    return;
  }
  const year = data.year;
  const passed = year ? Math.min(year.daysPassed, year.totalDays) : 0;
  byId('goals-progress').innerHTML = `
    ${meterHtml({ id: 'compare-time', labelKey: 'progress.goals.time', percent: year ? year.percent : 0,
      note: year ? tPlural('progress.goals.daysOf', year.totalDays, { passed: Format.number(passed) }) : '' })}
    ${meterHtml({ id: 'compare-done', labelKey: 'progress.goals.done', percent: overall, note: tPlural('progress.goals.avgOf', goals.length) })}`;
}

/* ----- Heatmap of the personal year ----- */

// Month names above the first week of each month: [{ column, text }]
function heatmapMonthLabels(weeks) {
  const labels = [];
  weeks.forEach((week, column) => {
    const first = week.find((cell) => cell.isInYear && cell.iso.endsWith('-01'));
    if (first) labels.push({ column, text: upperFirst(Format.date(first.iso, { month: 'short' })) });
  });
  return labels;
}

function renderHeatmap(data) {
  const range = getPeriodRange('year', Dates.today(), yearStart());
  byId('heatmap-range').textContent = rangeText(range);
  const weeks = heatmapWeeks(range.start, range.end, data.counts, Dates.today());
  const cells = weeks.flat().map((cell) => {
    if (!cell.isInYear) return '<span class="heat-cell is-empty"></span>';
    if (cell.isFuture) return '<span class="heat-cell is-future"></span>';
    const title = `${Format.date(cell.iso, { dateStyle: 'long' })}: ${tPlural('dashboard.activity.actions', cell.count)}`;
    return `<span class="heat-cell level-${cell.level}" title="${escapeHtml(title)}"></span>`;
  }).join('');
  const months = heatmapMonthLabels(weeks).map((label) =>
    `<span style="grid-column: ${label.column + 1} / span 4">${escapeHtml(label.text)}</span>`).join('');
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((index) =>
    `<span>${index % 2 === 0 ? escapeHtml(upperFirst(Format.weekday(Dates.addDays(Dates.startOfWeek(range.start), index), 'short'))) : ''}</span>`).join('');
  const totalDays = Dates.daysBetween(range.start, range.end) + 1;
  const activeDays = activeDaysInRange(data.counts, range.start, range.end);
  const rows = monthlyActivity(range.start, range.end, data.counts).map((month) => `
    <tr>
      <th scope="row">${escapeHtml(upperFirst(Format.date(month.start, { month: 'long', year: 'numeric' })))}</th>
      <td>${month.activeDays}</td>
      <td>${month.actions}</td>
    </tr>`).join('');
  byId('year-heatmap').innerHTML = `
    <div class="heat-layout">
      <div class="heat-main" aria-hidden="true">
        <div class="heat-weekdays">${weekdays}</div>
        <div class="heat-scroll">
          <div class="heat-months" style="--weeks: ${weeks.length}">${months}</div>
          <div class="year-heatmap" style="--weeks: ${weeks.length}">${cells}</div>
        </div>
      </div>
      <div class="heat-side">
        <p class="kpi-label">${escapeHtml(t('progress.heatmap.activeDays'))}</p>
        <p class="heat-side-value"><strong>${escapeHtml(Format.number(activeDays))}</strong>
          <span>${escapeHtml(t('progress.heatmap.of', { total: Format.number(totalDays) }))}</span></p>
        <span class="badge-status is-success">${escapeHtml(percentText(activeDays / totalDays))}</span>
      </div>
    </div>
    <p class="heat-legend" aria-hidden="true">
      ${escapeHtml(t('dashboard.activity.less'))}
      ${[0, 1, 2, 3, 4].map((level) => `<span class="heat-cell level-${level}"></span>`).join('')}
      ${escapeHtml(t('dashboard.activity.more'))}
    </p>
    <table class="visually-hidden">
      <caption>${escapeHtml(t('progress.heatmap.title'))}</caption>
      <thead><tr>
        <th scope="col">${escapeHtml(t('planner.level.month'))}</th>
        <th scope="col">${escapeHtml(t('progress.table.activeDays'))}</th>
        <th scope="col">${escapeHtml(t('progress.table.actions'))}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ----- 6 tiles: a number + a caption each, a small arrow to the details ----- */

function periodWords() {
  return t(`progress.tile.per.${progressState.period}`);
}

// One tile. value = the big text, badge = HTML of a small badge (or ''), note = the caption.
function tileHtml({ id, icon, titleKey, href, value, badge = '', note }) {
  const title = t(titleKey);
  return `
    <section class="panel prog-tile" aria-labelledby="tile-${id}">
      <div class="prog-tile-head">
        <span class="prog-tile-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
        <h3 class="prog-tile-title" id="tile-${id}">${escapeHtml(title)}</h3>
        <a class="prog-tile-link" href="${href}" aria-label="${escapeHtml(t('progress.tile.open', { title }))}" title="${escapeHtml(t('progress.tile.open', { title }))}">
          <i class="bi bi-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
      <p class="prog-tile-value"><span>${escapeHtml(value)}</span>${badge}</p>
      <p class="prog-tile-note">${escapeHtml(note)}</p>
    </section>`;
}

function percentBadge(ratio, tone = 'is-accent') {
  return `<span class="badge-status ${tone}">${escapeHtml(percentText(Math.min(Math.max(ratio, 0), 1)))}</span>`;
}

function habitsTile(data, { current }) {
  const { habits, marked, possible } = habitConsistency(data.goals, data.entries, current.start, current.end, Dates.today());
  if (habits === 0) return tileHtml({ id: 'habits', icon: 'bi-arrow-repeat', titleKey: 'planner.today.habits', href: 'planner.html?level=today', value: '—', note: t('progress.tile.empty') });
  return tileHtml({
    id: 'habits', icon: 'bi-arrow-repeat', titleKey: 'planner.today.habits', href: 'planner.html?level=today',
    value: t('progress.tile.of', { done: Format.number(marked), total: Format.number(possible) }),
    badge: possible ? percentBadge(marked / possible, marked / possible >= 0.5 ? 'is-success' : 'is-warning') : '',
    note: t('progress.tile.habitsNote', { period: periodWords() })
  });
}

function booksTile(data, { current }) {
  const books = data.goals.filter((goal) => goal.category === 'books' && goal.progressType === 'number' && goal.status !== 'archived');
  if (books.length === 0) return tileHtml({ id: 'books', icon: 'bi-book', titleKey: 'category.books', href: 'goals.html', value: '—', note: t('progress.tile.empty') });
  const done = sumOf(books, (goal) => goal.currentValue);
  const target = sumOf(books, (goal) => goal.targetValue);
  const added = bookStats(data.goals, data.entries, current.start, current.end).books;
  return tileHtml({
    id: 'books', icon: 'bi-book', titleKey: 'category.books', href: 'goals.html',
    value: t('progress.tile.of', { done: Format.number(done), total: Format.number(target) }),
    badge: target ? percentBadge(done / target) : '',
    note: t('progress.tile.booksNote', { added: `+${Format.number(added)}`, period: periodWords() })
  });
}

function financeTile(data, { current }) {
  const rows = financeStats(data.goals, data.entries, current.start, current.end, Dates.today());
  const row = rows.find((item) => item.currency === DEFAULT_CURRENCY) ?? rows[0];
  if (!row) return tileHtml({ id: 'finance', icon: 'bi-cash-coin', titleKey: 'category.finance', href: 'goals.html', value: '—', note: t('progress.tile.empty') });
  const money = (value) => Format.money(Math.round(value), row.currency);
  const sign = row.inPeriod > 0 ? '+' : row.inPeriod < 0 ? '−' : '';
  return tileHtml({
    id: 'finance', icon: 'bi-cash-coin', titleKey: 'category.finance', href: 'goals.html',
    value: money(row.saved), badge: row.target ? percentBadge(row.saved / row.target) : '',
    note: t('progress.tile.financeNote', { added: `${sign}${money(Math.abs(row.inPeriod))}`, period: periodWords() })
  });
}

function studyTile(data, { current, previous }) {
  const base = { id: 'study', icon: 'bi-mortarboard', titleKey: 'progress.study.title', href: 'goals.html' };
  const now = studyStats(data.goals, data.entries, current.start, current.end);
  if (now.goals === 0) return tileHtml({ ...base, value: '—', note: t('progress.tile.empty') });
  if (now.hasHourGoals) {
    const before = studyStats(data.goals, data.entries, previous.start, previous.end);
    return tileHtml({ ...base, value: t('progress.tile.hours', { value: numberText(now.hours) }),
      badge: deltaBadgeHtml(now.hours - before.hours), note: t('progress.tile.studyNote', { period: periodWords() }) });
  }
  if (now.topicsTotal) {
    return tileHtml({ ...base, value: t('progress.tile.of', { done: now.topicsDone, total: now.topicsTotal }),
      badge: percentBadge(now.topicsDone / now.topicsTotal), note: t('progress.tile.topicsNote') });
  }
  return tileHtml({ ...base, value: Format.number(now.goals), note: tPlural('progress.tile.studyGoals', now.goals) });
}

function sportTile(data, { current, previous }) {
  const now = sportStats(data.sport.sessions, current.start, current.end).days;
  const before = sportStats(data.sport.sessions, previous.start, previous.end).days;
  return tileHtml({
    id: 'sport', icon: 'bi-heart-pulse', titleKey: 'progress.sport.title', href: 'sport.html?tab=today',
    value: Format.number(now), badge: deltaBadgeHtml(now - before),
    note: tPlural('progress.tile.workouts', now, { period: periodWords() })
  });
}

// +1 when the weight goal wants more, −1 when less, 0 when there is no weight goal (no color).
function weightGoalDirection(goals) {
  const goal = goals.find((item) => item.progressType === 'measurements' && item.status !== 'archived' && /^(kg|кг)$/i.test(String(item.unit ?? '').trim()));
  return goal ? Math.sign((Number(goal.targetValue) || 0) - (Number(goal.startValue) || 0)) : 0;
}

function bodyTile(data) {
  const base = { id: 'body', icon: 'bi-rulers', titleKey: 'progress.tile.body', href: 'sport.html?tab=body' };
  const body = sortBodyEntries(data.sport.body);
  const field = BODY_FIELDS.find(({ key }) => body.some((entry) => Number.isFinite(entry[key])));
  if (!field) return tileHtml({ ...base, value: '—', note: t('progress.tile.empty') });
  const measured = body.filter((entry) => Number.isFinite(entry[field.key]));
  const last = measured[measured.length - 1];
  const before = measured[measured.length - 2];
  const unit = t(`progress.unit.${field.unit}`);
  const good = field.key === 'weight' ? weightGoalDirection(data.goals) : 0;
  return tileHtml({
    ...base, value: `${numberText(last[field.key])} ${unit}`,
    badge: before ? deltaBadgeHtml(roundOne(last[field.key] - before[field.key]), numberText, good) : '',
    note: t('progress.tile.bodyNote', { field: t(`progress.body.${field.key}`), date: Format.shortDate(last.date) })
  });
}

function renderTiles(data, periods) {
  byId('progress-tiles').innerHTML = [
    habitsTile(data, periods), booksTile(data, periods), financeTile(data, periods),
    studyTile(data, periods), sportTile(data, periods), bodyTile(data)
  ].join('');
}

/* ----- Charts: the numbers are prepared here, progress-charts.js only draws ----- */

// The value in the card head: the last point and its change against the point before.
function chartNowHtml(series, good) {
  const { values } = series;
  if (values.length === 0) return '';
  const last = values[values.length - 1];
  const change = values.length > 1 ? last - values[values.length - 2] : null;
  const label = t('progress.charts.change');
  return `<strong>${escapeHtml(series.format(last))}</strong>${change === null ? ''
    : `<span title="${escapeHtml(label)}">${deltaBadgeHtml(change, (value) => series.format(value), good)}<span class="visually-hidden">${escapeHtml(label)}</span></span>`}`;
}

function chartSeries(data) {
  const kg = (value) => `${numberText(value)} ${t('progress.unit.kg')}`;
  const money = (value) => Format.money(Math.round(value), DEFAULT_CURRENCY);
  const compact = (value) => Format.number(value, { notation: 'compact', maximumFractionDigits: 1 });
  const weight = weightSeries(sortBodyEntries(data.sport.body));
  const savings = savingsSeries(data.goals, data.entries);
  const weeks = weeklyTaskCounts(data.completions, Dates.today());
  return {
    weight: {
      labels: weight.map((point) => Format.shortDate(point.date)), values: weight.map((point) => point.value),
      format: kg, tick: numberText, tableHeads: [t('details.entry.date'), t('progress.body.weight')], emptyKey: 'progress.charts.noWeight'
    },
    savings: {
      labels: savings.map((point) => Format.shortDate(point.date)), values: savings.map((point) => point.value),
      format: money, tick: compact, tableHeads: [t('details.entry.date'), t('progress.finance.saved')], emptyKey: 'progress.charts.noSavings'
    },
    tasks: {
      labels: weeks.map((week) => t('progress.weekShort', { number: Dates.isoWeek(week.start).week })),
      values: weeks.map((week) => week.count),
      format: (value) => Format.number(value), tick: (value) => Format.number(value), fromZero: true,
      tableHeads: [t('planner.level.week'), t('progress.table.tasks')], emptyKey: 'progress.tasks.empty'
    }
  };
}

function renderCharts(data) {
  const series = chartSeries(data);
  byId('chart-weight-now').innerHTML = chartNowHtml(series.weight, weightGoalDirection(data.goals));
  byId('chart-savings-now').innerHTML = chartNowHtml(series.savings, 1);
  byId('chart-tasks-now').innerHTML = chartNowHtml(series.tasks, 1);
  ProgressCharts.render(series);
}

// Everything is read once and passed to the pure functions.
function loadProgressData() {
  const tasks = getTasks();
  const entries = getProgressEntries();
  const sport = getSport();
  const profile = getProfile();
  return {
    goals: getGoals(),
    entries,
    sport,
    completions: taskCompletionDates(tasks),
    counts: countActivityByDay(tasks, entries, sport.sessions),
    year: profile ? Dates.personalYear(profile.personalYearStart) : null
  };
}

function renderProgress() {
  const periods = progressPeriods();
  const data = loadProgressData();
  renderYearBanner(data.year);
  renderPeriodBar(periods);
  renderSummary(data, periods);
  renderTasksChart(data, periods);
  renderGoalsProgress(data);
  renderHeatmap(data);
  renderTiles(data, periods);
  renderCharts(data);
}

function setProgressPeriod(period, anchor = progressState.anchor) {
  progressState.period = period;
  progressState.anchor = anchor;
  writeProgressUrl();
  renderProgress();
}

/* =========================================================
   Part 4. Personal year summary (progress.html?view=summary) and the archive
   ========================================================= */

// The year that is shown: from its start to its end, or to today if it is not over yet.
function summaryRange() {
  const profile = getProfile();
  if (!profile) return null;
  const year = Dates.personalYear(profile.personalYearStart);
  if (!year) return null;
  const end = year.status === 'finished' ? year.end : earlier(Dates.today(), year.end);
  return { year, start: year.start, end };
}

function currentSummary(range) {
  return buildYearSummary({ goals: getGoals(), tasks: getTasks(), entries: getProgressEntries(), sport: getSport(), start: range.start, end: range.end });
}

function isYearArchived(range) {
  return getArchive().some((item) => item.yearStart === Dates.toISO(range.start));
}

// "B1", "₸3,200,000", "2 / 5" — a value of a goal snapshot.
function snapshotValue(goal, value) {
  if (goal.progressType === 'checklist') {
    const done = value === 'start' ? 0 : goal.checklist.filter((item) => item.done).length;
    return `${done} / ${goal.checklist.length}`;
  }
  return formatGoalValue(goal, value === 'start' ? goal.startValue : goal.currentValue);
}

// A KPI card of the summary: icon, label (13px) on top, the number (28px) and a small unit next to it.
function summaryCardHtml({ icon, tone = '', labelKey, value, unit = '' }) {
  return `
    <section class="panel kpi-card sum-kpi">
      <span class="kpi-icon ${tone}" aria-hidden="true"><i class="bi ${icon}"></i></span>
      <h3 class="kpi-label">${escapeHtml(t(labelKey))}</h3>
      <p class="kpi-value">${escapeHtml(value)}${unit ? ` <span class="kpi-unit">${escapeHtml(unit)}</span>` : ''}</p>
    </section>`;
}

// A friendly empty state: icon, text and (optionally) "Create a goal".
function summaryEmptyHtml(icon, textKey, withButton = false) {
  return `
    <div class="sum-empty">
      <span class="sum-empty-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
      <p>${escapeHtml(t(textKey))}</p>
      ${withButton ? `<a class="btn btn-outline-primary btn-sm" href="goals.html#new"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>${escapeHtml(t('progress.summary.createGoal'))}</a>` : ''}
    </div>`;
}

// Title, period and the "the year is still going" note with its bar.
function renderSummaryHead(year) {
  byId('summary-title').textContent = periodTitle('year', year);
  byId('summary-range').textContent = Format.dateRange(year.start, year.end);
  const isOver = year.status === 'finished';
  byId('summary-info').hidden = isOver;
  if (isOver) return;
  const passed = year.status === 'upcoming' ? 0 : Math.min(year.daysPassed, year.totalDays);
  const percent = year.status === 'upcoming' ? 0 : year.percent;
  byId('summary-info-text').textContent = t('progress.summary.ongoing', { days: tPlural('progress.goals.daysOf', year.totalDays, { passed: Format.number(passed) }) });
  byId('summary-info-bar').setAttribute('aria-valuenow', String(Math.round(percent)));
  byId('summary-info-bar').querySelector('.progress-bar').style.width = `${percent}%`;
}

function renderSummaryCards(summary) {
  const days = (count) => tPlural('progress.summary.daysUnit', count);
  byId('year-summary-cards').innerHTML = [
    summaryCardHtml({ icon: 'bi-trophy', tone: 'is-warning', labelKey: 'progress.summary.goals', value: Format.number(summary.goalsAchieved),
      unit: t('progress.heatmap.of', { total: Format.number(summary.goalsTotal) }) }),
    summaryCardHtml({ icon: 'bi-check2-square', tone: 'is-success', labelKey: 'progress.card.tasks', value: Format.number(summary.tasksDone) }),
    summaryCardHtml({ icon: 'bi-calendar-check', labelKey: 'progress.card.activeDays', value: Format.number(summary.activeDays) }),
    summaryCardHtml({ icon: 'bi-fire', tone: 'is-warning', labelKey: 'progress.summary.bestStreak', value: Format.number(summary.bestStreak), unit: days(summary.bestStreak) }),
    summaryCardHtml({ icon: 'bi-list-check', labelKey: 'progress.card.entries', value: Format.number(summary.results) }),
    summaryCardHtml({ icon: 'bi-heart-pulse', tone: 'is-success', labelKey: 'progress.sport.sessions', value: Format.number(summary.workouts) })
  ].join('');
}

// Tasks by month: a bar chart (Chart.js) with the same numbers in a table.
function renderSummaryMonths(year) {
  const months = chartBuckets('year', year.start, year.end);
  const values = countByBuckets(taskCompletionDates(getTasks()), months);
  if (values.every((value) => value === 0)) {
    ProgressCharts.destroy();
    byId('summary-months').innerHTML = summaryEmptyHtml('bi-bar-chart', 'progress.tasks.empty');
    return;
  }
  ProgressCharts.renderSummary({
    labels: months.map((month) => upperFirst(Format.date(month.start, { month: 'short' }))),
    values,
    format: (value) => Format.number(value), tick: (value) => Format.number(value), fromZero: true, type: 'bar',
    tableHeads: [t('planner.level.month'), t('progress.table.tasks')], emptyKey: 'progress.tasks.empty'
  });
}

function renderSummaryCategories(summary) {
  const categories = bestCategories(summary.goals);
  byId('summary-categories').innerHTML = categories.length
    ? `<ol class="sum-categories">${categories.map((item) => `
        <li>
          <span class="sum-category-icon" aria-hidden="true"><i class="bi ${GOAL_CATEGORIES[item.category]}"></i></span>
          <div class="sum-category-body">
            <div class="sum-category-head">
              <strong>${escapeHtml(goalCategoryName(item.category))}</strong>
              <span>${escapeHtml(Format.number(item.percent / 100, { style: 'percent' }))}</span>
            </div>
            <div class="progress" aria-hidden="true"><div class="progress-bar" style="width: ${item.percent}%"></div></div>
            <small>${escapeHtml(tPlural('progress.summary.goalsCount', item.count))}</small>
          </div>
        </li>`).join('')}</ol>`
    : summaryEmptyHtml('bi-bullseye', 'progress.summary.noCategories', true);
}

function renderSummaryWeek(range) {
  const completions = taskCompletionDates(getTasks());
  const week = bestWeek(completions, range.start, range.end);
  if (!week) {
    byId('summary-week').innerHTML = summaryEmptyHtml('bi-calendar-week', 'progress.summary.noWeek');
    return;
  }
  const weeks = Math.max(Math.ceil((Dates.daysBetween(range.start, range.end) + 1) / 7), 1);
  const average = countInRange(completions, range.start, range.end) / weeks;
  byId('summary-week').innerHTML = `
    <p class="sum-week-dates">${escapeHtml(Format.dateRange(week.start, week.end))}</p>
    <p class="sum-week-count"><strong>${escapeHtml(Format.number(week.count))}</strong>
      <span>${escapeHtml(tPlural('progress.summary.tasksUnit', week.count))}</span></p>
    <p class="sum-week-note">${escapeHtml(t('progress.summary.weekAverage', { value: Format.number(average, { maximumFractionDigits: 1 }) }))}</p>`;
}

function renderSummaryAchieved(summary) {
  const achieved = summary.goals.filter((goal) => goal.percent >= 100);
  byId('summary-achieved').innerHTML = achieved.length
    ? `<ul class="sum-achieved">${achieved.map((goal) => `
        <li>
          <span class="sum-trophy" aria-hidden="true"><i class="bi bi-trophy-fill"></i></span>
          <span class="sum-achieved-title">${escapeHtml(goal.title)}</span>
          <span class="badge-status">${escapeHtml(goalCategoryName(goal.category))}</span>
        </li>`).join('')}</ul>`
    : summaryEmptyHtml('bi-trophy', summary.goals.length ? 'progress.summary.noneAchieved' : 'progress.summary.noGoals', summary.goals.length === 0);
}

// "+3 200 000 ₸" / "−5,5 kg" / "+2 levels": the sign is written, the color says "towards the goal".
function changeHtml(goal) {
  const { amount, direction } = snapshotChange(goal);
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  let text;
  if (goal.progressType === 'checklist') text = `${sign}${Format.number(Math.abs(amount))}`;
  else if (goal.progressType === 'levels') text = `${sign}${tPlural('progress.summary.levelsDiff', Math.abs(amount))}`;
  else text = `${sign}${formatGoalValue(goal, Math.abs(amount))}`;
  const tone = amount === 0 ? '' : Math.sign(amount) === direction ? 'is-success' : 'is-warning';
  return `<span class="badge-status ${tone}">${escapeHtml(text)}</span>`;
}

function renderSummaryCompare(summary) {
  byId('summary-compare').innerHTML = summary.goals.length
    ? `<div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th scope="col">${escapeHtml(t('settings.report.column.goal'))}</th>
            <th scope="col">${escapeHtml(t('progress.body.from'))}</th>
            <th scope="col">${escapeHtml(t('progress.body.to'))}</th>
            <th scope="col">${escapeHtml(t('progress.body.difference'))}</th>
          </tr></thead>
          <tbody>${summary.goals.map((goal) => `
            <tr>
              <th scope="row" class="sum-goal-cell">${escapeHtml(goal.title)}</th>
              <td>${escapeHtml(snapshotValue(goal, 'start'))}</td>
              <td>${escapeHtml(snapshotValue(goal, 'now'))}</td>
              <td>${changeHtml(goal)}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`
    : summaryEmptyHtml('bi-bullseye', 'progress.summary.noGoals', true);
}

// "Save to the archive" is always outline; "Start a new year" is filled only when the year is over.
function renderSummaryFinish(range) {
  const isOver = range.year.status === 'finished';
  byId('summary-status').textContent = isOver
    ? t('progress.summary.ended')
    : t('progress.summary.early', { date: Format.date(range.year.end, { dateStyle: 'long' }) });
  const archived = isYearArchived(range);
  byId('summary-archive').disabled = archived;
  byId('summary-archive-label').textContent = t(archived ? 'progress.summary.archived' : 'progress.summary.archive');
  const newYear = byId('summary-new-year');
  newYear.classList.toggle('btn-primary', isOver);
  newYear.classList.toggle('btn-outline-primary', !isOver);
}

function renderSummaryView() {
  document.title = `${t('progress.summary.pageTitle')} · ${t('app.name')}`;
  const range = summaryRange();
  if (!range) {
    byId('summary-title').textContent = t('dashboard.year.noProfile');
    return;
  }
  const summary = currentSummary(range);
  renderSummaryHead(range.year);
  renderSummaryCards(summary);
  renderSummaryMonths(range.year);
  renderSummaryCategories(summary);
  renderSummaryWeek(range);
  renderSummaryAchieved(summary);
  renderSummaryCompare(summary);
  renderSummaryFinish(range);
}

// Saves the year once (the same year start is not saved twice).
function archiveCurrentYear(range) {
  if (isYearArchived(range)) return true;
  const summary = currentSummary(range);
  const { goals, ...stats } = summary;
  const archive = getArchive();
  archive.push({
    id: createId('year'),
    yearStart: Dates.toISO(range.start),
    yearEnd: Dates.toISO(range.end),
    archivedAt: new Date().toISOString(),
    stats,
    goals
  });
  return saveArchive(archive);
}

function saveYearToArchive() {
  const range = summaryRange();
  if (!range || !archiveCurrentYear(range)) return;
  showToast('toast.yearArchived', 'success');
  renderSummaryView();
  byId('summary-new-year').focus();
}

function openNewYear() {
  const range = summaryRange();
  const early = byId('new-year-early');
  early.hidden = !range || range.year.status === 'finished';
  if (range) early.textContent = t('progress.summary.earlyWarning', { date: Format.date(range.year.end, { dateStyle: 'long' }) });
  const unfinished = getGoals().filter((goal) => goal.status === 'active' && getGoalPercent(goal) < 100);
  byId('new-year-none').hidden = unfinished.length > 0;
  byId('new-year-goals').innerHTML = unfinished.map((goal, index) => `
    <li>
      <input class="form-check-input mt-0" type="checkbox" id="carry-${index}" value="${escapeHtml(goal.id)}" checked>
      <label class="item-text" for="carry-${index}">${escapeHtml(goal.title)}</label>
      <span class="item-date">${escapeHtml(Format.number(getGoalPercent(goal) / 100, { style: 'percent' }))}</span>
    </li>`).join('');
  bootstrap.Modal.getOrCreateInstance(byId('new-year-modal')).show();
}

// Archive the year, then: finished goals and goals that are not carried over -> archive of goals;
// carried goals stay active with their progress; the new personal year starts today.
function startNewYear(event) {
  event.preventDefault();
  const range = summaryRange();
  if (!range || !archiveCurrentYear(range)) return;
  const carried = new Set([...document.querySelectorAll('#new-year-goals input:checked')].map((box) => box.value));
  const now = new Date().toISOString();
  const goals = getGoals().map((goal) => {
    if (goal.status === 'archived') return goal;
    const isFinished = goal.status === 'completed' || getGoalPercent(goal) >= 100;
    return isFinished || !carried.has(goal.id) ? { ...goal, status: 'archived', updatedAt: now } : goal;
  });
  if (!saveGoals(goals) || !updateProfile({ personalYearStart: Dates.toISO(Dates.today()) })) return;
  window.location.href = 'index.html?newYear=1';
}

function showSummaryView() {
  byId('progress-main').hidden = true;
  byId('summary-view').hidden = false;
  byId('summary-back').hidden = false;
  const title = byId('page-title');
  title.dataset.i18n = 'progress.summary.pageTitle';
  title.textContent = t('progress.summary.pageTitle');
  byId('summary-archive').addEventListener('click', saveYearToArchive); // saves a year only once by itself
  byId('summary-new-year').addEventListener('click', openNewYear);
  byId('new-year-form').addEventListener('submit', submitOnce(startNewYear));
  renderSummaryView();
  document.addEventListener('lifeos:languagechange', renderSummaryView);
}

/* =========================================================
   Self-test of the pure functions: progress.html?debug=1
   ========================================================= */

function runProgressSelfTest() {
  const results = [];
  const check = (test, actual, expected) =>
    results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const day = (iso) => Dates.parse(iso);
  const iso = (date) => Dates.toISO(date);

  check('countInRange', countInRange(['2026-11-01', '2026-11-05', '2026-12-01'], day('2026-11-01'), day('2026-11-30')), 2);
  check('buckets: week = 7 days', chartBuckets('week', day('2026-11-09'), day('2026-11-15')).length, 7);
  check('buckets: month = 30 days', chartBuckets('month', day('2026-11-01'), day('2026-11-30')).length, 30);
  check('buckets: year = 12 months', chartBuckets('year', day('2026-09-01'), day('2027-08-31')).length, 12);
  const quarter = chartBuckets('quarter', day('2026-09-01'), day('2026-11-30'));
  check('buckets: quarter weeks start inside', iso(quarter[0].start), '2026-09-01');
  check('buckets: quarter last week ends inside', iso(quarter[quarter.length - 1].end), '2026-11-30');
  check('countByBuckets', countByBuckets(['2026-11-09', '2026-11-09', '2026-11-11'], chartBuckets('week', day('2026-11-09'), day('2026-11-15'))).join(), '2,0,1,0,0,0,0');
  check('compare: up', compareValues(6, 4).difference, 2);
  check('compare: percent', compareValues(6, 4).percent, 0.5);
  check('compare: no previous -> null', compareValues(3, 0).percent, null);
  const counts = new Map([['2026-11-01', 2], ['2026-11-02', 0], ['2026-11-03', 1]]);
  check('active days', activeDaysInRange(counts, day('2026-11-01'), day('2026-11-30')), 2);

  const goals = [
    { id: 'b', category: 'books', progressType: 'number', status: 'active', startValue: 0, targetValue: 10, currentValue: 5 },
    { id: 'm', category: 'finance', progressType: 'money', status: 'active', unit: 'KZT', startValue: 0, targetValue: 1000, currentValue: 600 },
    { id: 's', category: 'education', progressType: 'number', status: 'active', unit: 'hours', startValue: 0, targetValue: 100, currentValue: 7,
      checklist: [{ done: true }, { done: false }] },
    { id: 'h', category: 'personal', progressType: 'streak', status: 'active', targetValue: 30, currentValue: 0 },
    { id: 'x', category: 'career', progressType: 'percent', status: 'archived', startValue: 0, targetValue: 100, currentValue: 10 }
  ];
  const entries = [
    { goalId: 'b', date: '2026-11-02', value: 1, pages: 300 },
    { goalId: 'b', date: '2026-11-20', value: 0, pages: 40 },
    { goalId: 'b', date: '2026-10-15', value: 1, pages: 250 },
    { goalId: 'm', date: '2026-09-10', value: 400 },
    { goalId: 'm', date: '2026-11-05', value: 200 },
    { goalId: 's', date: '2026-11-03', value: 2.5 },
    { goalId: 'h', date: '2026-11-08' }, { goalId: 'h', date: '2026-11-09' }, { goalId: 'h', date: '2026-11-10' },
    { goalId: 'h', date: '2026-11-01' }, { goalId: 'h', date: '2026-10-31' }, { goalId: 'h', date: '2026-10-30' }, { goalId: 'h', date: '2026-10-29' }
  ];
  const nov = [day('2026-11-01'), day('2026-11-30')];
  check('overall %: archived ignored', overallGoalPercent(goals), Math.round((50 + 60 + 7 + 0) / 4));
  check('books: finished in Nov', bookStats(goals, entries, ...nov).books, 1);
  check('books: pages in Nov', bookStats(goals, entries, ...nov).pages, 340);
  const finance = financeStats(goals, entries, ...nov, '2026-11-10')[0];
  check('finance: saved', finance.saved, 600);
  check('finance: remaining', finance.remaining, 400);
  check('finance: average per month (600 / 3)', finance.averagePerMonth, 200);
  check('finance: added in Nov', finance.inPeriod, 200);
  check('study: hours unit', isHoursUnit('часов') && isHoursUnit('h') && !isHoursUnit('pages'), true);
  check('study: hours in Nov', studyStats(goals, entries, ...nov).hours, 2.5);
  check('study: topics', studyStats(goals, entries, ...nov).topicsDone, 1);
  const habit = habitStats(goals, entries, '2026-11-10')[0];
  check('habit: current streak', habit.current, 3);
  check('habit: best streak', habit.best, 4);

  check('heatmap: Monday start, 7 rows', heatmapWeeks(day('2026-09-01'), day('2027-08-31'), new Map(), '2026-11-10')[0].length, 7);
  check('heatmap: first day before the year is empty', heatmapWeeks(day('2026-09-01'), day('2027-08-31'), new Map(), '2026-11-10')[0][0].isInYear, false);
  check('months inclusive Sep -> Nov', monthsInclusive('2026-09-10', '2026-11-01'), 3);

  const money = [{ id: 'm', progressType: 'money', status: 'active', unit: 'KZT', currentValue: 600 }];
  const moneyEntries = [{ goalId: 'm', date: '2026-11-05', value: 200 }, { goalId: 'm', date: '2026-09-10', value: 300 }];
  check('series: savings from the start amount', savingsSeries(money, moneyEntries).map((point) => point.value).join(), '400,600');
  const weekly = weeklyTaskCounts(['2026-11-09', '2026-11-11', '2026-11-03'], '2026-11-11', 3);
  check('series: tasks by week', weekly.map((week) => week.count).join(), '0,1,2');

  const summaryGoals = [
    { id: 'a', title: 'A', status: 'active', progressType: 'number', startValue: 0, targetValue: 10, currentValue: 10 },
    { id: 'b', title: 'B', status: 'active', progressType: 'number', startValue: 0, targetValue: 10, currentValue: 4 },
    { id: 'c', title: 'C', status: 'archived', progressType: 'number', startValue: 0, targetValue: 10, currentValue: 10 }
  ];
  const summaryTasks = [{ id: 't', recurrence: 'daily', date: '2026-09-01', completions: ['2026-09-02', '2026-09-03', '2025-01-01'] }];
  const summarySport = {
    sessions: [{ date: '2026-10-02', exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 80, done: true }] }] }, { date: '2026-10-02', exercises: [] }],
    body: [{ date: '2026-11-01', weight: 88.5 }, { date: '2026-10-01', weight: 92 }]
  };
  const summary = buildYearSummary({ goals: summaryGoals, tasks: summaryTasks, entries: [{ goalId: 'b', date: '2026-10-05', value: 4 }], sport: summarySport, start: day('2026-09-01'), end: day('2027-08-31') });
  check('summary: archived goals left out', summary.goalsTotal, 2);
  check('summary: achieved goals', summary.goalsAchieved, 1);
  check('summary: tasks done inside the year', summary.tasksDone, 2);
  check('summary: results', summary.results, 1);
  check('summary: training days from Sport', summary.workouts, 1);
  check('summary: weight at start / end', `${summary.weightStart}->${summary.weightEnd}`, '92->88.5');
  check('summary: goal snapshot keeps percent', summary.goals.find((goal) => goal.id === 'b').percent, 40);

  const pastGoals = [
    { id: 'pm', progressType: 'money', status: 'active', startValue: 0, targetValue: 1000, currentValue: 600, createdAt: '2026-09-01' },
    { id: 'pw', progressType: 'measurements', status: 'active', startValue: 90, targetValue: 80, currentValue: 85, createdAt: '2026-09-01' },
    { id: 'pn', progressType: 'number', status: 'active', startValue: 0, targetValue: 10, currentValue: 5, createdAt: '2026-12-01' }
  ];
  const pastEntries = [{ goalId: 'pm', date: '2026-11-05', value: 200 }, { goalId: 'pw', date: '2026-10-01', value: 88 }, { goalId: 'pw', date: '2026-11-05', value: 85 }];
  check('past: money = now − added later', goalValueAt(pastGoals[0], pastEntries, '2026-11-01'), 400);
  check('past: measurement = last entry until then', goalValueAt(pastGoals[1], pastEntries, '2026-11-01'), 88);
  check('past: a later goal counts with its start value', overallGoalPercentAt(pastGoals, pastEntries, '2026-11-01'), Math.round((40 + 20 + 0) / 3));
  check('past: completed later = still active then', getGoalPercent(goalAsOn({ id: 'c', progressType: 'number', status: 'completed', startValue: 0, targetValue: 10, currentValue: 10,
    createdAt: '2026-09-01', updatedAt: '2026-11-20' }, [{ goalId: 'c', date: '2026-11-15', value: 4 }], '2026-11-01')), 60);
  const consistency = habitConsistency(goals, entries, day('2026-11-08'), day('2026-11-14'), '2026-11-10');
  check('habits: marked / possible until today', `${consistency.marked}/${consistency.possible}`, '3/3');

  check('best week: most tasks', iso(bestWeek(['2026-11-03', '2026-11-10', '2026-11-11', '2026-11-12'], day('2026-11-01'), day('2026-11-30')).start), '2026-11-09');
  check('best week: none without tasks', bestWeek([], day('2026-11-01'), day('2026-11-30')), null);
  check('best week: cut to the year start', iso(bestWeek(['2026-11-01'], day('2026-11-01'), day('2026-11-30')).start), '2026-11-01');
  const categories = bestCategories([{ category: 'books', percent: 40 }, { category: 'books', percent: 60 }, { category: 'finance', percent: 80 }, { category: 'x', percent: 10 }]);
  check('categories: best first', categories.map((item) => `${item.category}:${item.percent}`).join(), 'finance:80,books:50,custom:10');
  check('change: weight goes down', JSON.stringify(snapshotChange({ progressType: 'measurements', startValue: 92, targetValue: 80, currentValue: 86.5 })), '{"amount":-5.5,"direction":-1}');
  check('change: checklist = ticked items', snapshotChange({ progressType: 'checklist', checklist: [{ done: true }, { done: false }] }).amount, 1);

  console.group('[LifeOS] Progress self-test (pure functions)');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} progress tests failed`);
  else console.info(`All ${results.length} progress tests passed`);
  console.groupEnd();
}

/* ---------- Start ---------- */

onAppReady(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1') runProgressSelfTest();
  if (params.get('view') === 'summary') {
    showSummaryView(); // the year summary replaces the statistics
    return;
  }
  readProgressUrl();
  writeProgressUrl();
  document.querySelectorAll('[data-period]').forEach((button) => {
    button.addEventListener('click', () => setProgressPeriod(button.dataset.period));
  });
  byId('period-prev').addEventListener('click', () => setProgressPeriod(progressState.period, shiftPeriodAnchor(progressState.period, progressState.anchor, -1)));
  byId('period-next').addEventListener('click', () => setProgressPeriod(progressState.period, shiftPeriodAnchor(progressState.period, progressState.anchor, 1)));
  byId('period-current').addEventListener('click', () => {
    setProgressPeriod(progressState.period, Dates.today());
    byId('period-title').focus();
  });
  renderProgress();
  document.addEventListener('lifeos:languagechange', renderProgress);
  // Chart colors come from CSS variables: redraw them after a theme change.
  document.addEventListener('lifeos:themechange', () => renderCharts(loadProgressData()));
});
