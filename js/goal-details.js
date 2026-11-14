// LifeOS — Goal details page: goal-details.html?id=goal-…  (concept, section 5)
// One goal: big percent, values, deadline and the pace needed, the "Add an entry" form,
// history, milestones, checklist, notes, related tasks. Entries are stored in lifeos_progress
// (see app.js, section "Progress entries"); every entry recalculates goal.currentValue.
// The entry form logic (fields by type, checks, saving) is shared with the Dashboard: js/entry-form.js.
'use strict';

// The id from the address; the goal itself is read fresh from storage every time.
const goalDetails = { id: new URLSearchParams(window.location.search).get('id') };

/* ---------- Reading and saving the goal ---------- */

function loadGoal() {
  const goal = goalDetails.id ? getGoalById(goalDetails.id) : null;
  return goal ? withLiveStreak(goal, getProgressEntries()) : null;
}

// Changes the saved goal: `change(goal)` edits it, then it is saved.
function updateGoal(change) {
  const goals = getGoals();
  const goal = goals.find((item) => item.id === goalDetails.id);
  if (!goal) return null;
  change(goal);
  goal.updatedAt = new Date().toISOString();
  return saveGoals(goals) ? goal : null;
}

/* ---------- Overview ---------- */

// Status badge: the text says the status, the tone only helps (the same tones as on the Goals page).
const DETAILS_STATUS = {
  active: ['is-success', 'goals.status.active'],
  completed: ['is-accent', 'goal.badge.completed'],
  archived: ['', 'goal.badge.archived']
};

function renderOverview(goal) {
  const percent = getGoalPercent(goal);
  byId('details-hero').dataset.color = goalColor(goal);
  byId('details-icon').className = `bi ${goalIcon(goal)}`;
  byId('details-title').textContent = goal.title;
  document.title = `${goal.title} · ${t('app.name')}`;

  byId('details-category').textContent = goalCategoryName(goal.category);
  const [tone, statusKey] = DETAILS_STATUS[goal.status] ?? DETAILS_STATUS.active;
  const badge = byId('details-badge');
  badge.className = `badge-status ${tone}`;
  badge.textContent = t(statusKey);

  const description = byId('details-description');
  description.hidden = !goal.description;
  description.textContent = goal.description ?? '';

  byId('details-percent').textContent = Format.number(percent / 100, { style: 'percent' });
  byId('details-progress').setAttribute('aria-valuenow', String(percent));
  byId('details-progress-bar').style.width = `${percent}%`;
  byId('details-current').textContent = currentText(goal);
  byId('details-target').textContent = targetText(goal);
  byId('details-deadline').textContent = goal.deadline ? Format.shortDate(goal.deadline) : t('goals.deadline.none');
  byId('details-days').textContent = goal.deadline && goal.status === 'active' ? goalDeadlineText(goal) : '';

  byId('details-edit').href = `goals.html#edit=${encodeURIComponent(goal.id)}`;
  // One "Mark as completed" button: outline while < 100 %, filled (the main action) at 100 %.
  const complete = byId('details-complete');
  complete.hidden = goal.status !== 'active';
  complete.classList.toggle('btn-primary', percent >= 100);
  complete.classList.toggle('btn-tool', percent < 100);
  renderPace(goal, percent);
}

/* ---------- Pace: how much is needed per day / week to finish on time ---------- */

// "≈ 12 345 ₸", "0.3 books", "5 %"
function paceValue(goal, amount) {
  if (goal.progressType === 'money') return Format.money(Math.ceil(amount), goal.unit || DEFAULT_CURRENCY);
  if (goal.progressType === 'percent') return formatGoalValue(goal, Math.round(amount * 10) / 10);
  const text = Format.number(amount, { maximumFractionDigits: amount < 10 ? 2 : 0 });
  return goal.unit ? `${text} ${goal.unit}` : text;
}

// Pages per day for book goals, based on the user's own finished books (average length).
function booksPagesLine(goal, remainingBooks, daysLeft) {
  const entries = getGoalEntries(goal.id);
  const finished = entries.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
  const pages = entries.reduce((sum, entry) => sum + (Number(entry.pages) || 0), 0);
  if (finished < 1 || pages === 0) return null;
  const pagesPerDay = Math.ceil((remainingBooks * (pages / finished)) / daysLeft);
  return t('details.pace.pages', { pages: Format.number(pagesPerDay) });
}

// Returns { intro, lines } — the text of the pace block.
function paceTexts(goal, percent) {
  if (percent >= 100) return { intro: t('details.pace.done'), lines: [] };
  const days = Dates.daysUntil(goal.deadline);
  if (days === null) return { intro: t('details.pace.noDeadline'), lines: [] };
  if (days < 0) return { intro: t('details.pace.overdue'), lines: [] };

  const daysLeft = days + 1; // today counts too: "due today" still leaves one day
  const intro = t('details.pace.intro');
  const current = Number(goal.currentValue) || 0;
  const target = Number(goal.targetValue) || 0;

  if (goal.progressType === 'levels') {
    const levelsLeft = Math.max(target - current, 1);
    return { intro, lines: [tPlural('details.pace.level', Math.max(Math.floor(daysLeft / levelsLeft), 1))] };
  }
  if (goal.progressType === 'streak') {
    const daysNeeded = Math.max(target - current, 0);
    const lines = [tPlural('details.pace.streak', daysNeeded)];
    if (daysNeeded > daysLeft) lines.push(t('details.pace.streakLate'));
    return { intro, lines };
  }
  if (goal.progressType === 'checklist') {
    const itemsLeft = asArray(goal.checklist).filter((item) => !item.done).length;
    const perWeek = Math.round((itemsLeft / daysLeft) * 7 * 10) / 10;
    return { intro, lines: [t('details.pace.perWeek', { value: tPlural('wizard.review.items', perWeek) })] };
  }

  // number, money, percent, measurements (also when the target is lower than the start)
  const remaining = Math.abs(target - current);
  const perDay = remaining / daysLeft;
  const lines = [
    t('details.pace.perDay', { value: paceValue(goal, perDay) }),
    t('details.pace.perWeek', { value: paceValue(goal, perDay * 7) })
  ];
  if (entryMode(goal) === 'books') {
    const pagesLine = booksPagesLine(goal, remaining, daysLeft);
    if (pagesLine) lines.push(pagesLine);
  }
  return { intro, lines };
}

// The pace in the stats row: "≈ 48 780 ₸ a month" (a month when > 60 days are left,
// a week when > 14 days, else a day). Other types show their first pace line.
const NUMERIC_PACE_TYPES = ['number', 'money', 'percent', 'measurements'];

function paceShort(goal, percent) {
  const days = Dates.daysUntil(goal.deadline);
  if (percent >= 100) return { value: '—', note: t('details.pace.done') };
  if (days === null) return { value: '—', note: t('details.pace.noDeadline') };
  if (days < 0) return { value: '—', note: t('details.pace.overdue') };
  if (!NUMERIC_PACE_TYPES.includes(goal.progressType)) {
    const { lines } = paceTexts(goal, percent);
    return { value: lines[0] ?? '—', note: lines[1] ?? '' };
  }
  const daysLeft = days + 1;
  const perDay = Math.abs((Number(goal.targetValue) || 0) - (Number(goal.currentValue) || 0)) / daysLeft;
  if (daysLeft > 60) return { value: t('details.pace.month', { value: paceValue(goal, perDay * 30.44) }), note: '' };
  if (daysLeft > 14) return { value: t('details.pace.week', { value: paceValue(goal, perDay * 7) }), note: '' };
  return { value: t('details.pace.day', { value: paceValue(goal, perDay) }), note: '' };
}

function renderPace(goal, percent) {
  const { value, note } = paceShort(goal, percent);
  byId('details-pace').textContent = value;
  byId('details-pace-note').textContent = note;
}

/* ---------- Entry form ---------- */

// The "Add an entry" form: the same logic as the Dashboard "Quick result" dialog (js/entry-form.js).
const entryForm = createEntryForm('entry');

// A checklist has no form here: its progress comes from ticking items in the list.
// Every progress type records entries except a checklist: its progress comes from the ticked items.
function usesEntries(goal) {
  return goal.progressType !== 'checklist';
}

// A checklist goal: no "Add an entry" and no history (unless old entries exist, e.g. the type was changed);
// the checklist takes the whole first row.
function renderEntryForm(goal) {
  const withEntries = usesEntries(goal);
  byId('entry-panel').hidden = !withEntries;
  byId('details-main-row').classList.toggle('is-checklist', !withEntries);
  if (withEntries) entryForm.render(goal);
}

function submitEntry(event) {
  event.preventDefault();
  const goal = loadGoal();
  if (!goal || !entryForm.save(goal)) return; // errors are shown next to the fields
  showToast('toast.entryAdded', 'success');
  entryForm.reset();
  renderDetailsPage();
}

/* ---------- History ---------- */

// "Deposit: bonus" / "Withdrawal" for money, otherwise just the note.
function entryLabel(goal, entry) {
  if (goal.progressType !== 'money') return entry.note ?? '';
  const kind = t((Number(entry.value) || 0) < 0 ? 'details.history.out' : 'details.history.in');
  return entry.note ? `${kind}: ${entry.note}` : kind;
}

// + green, − red (the sign is written, the color only helps); absolute values stay neutral.
function entryTone(goal, entry) {
  if (!DELTA_TYPES.includes(goal.progressType)) return '';
  return (Number(entry.value) || 0) < 0 ? 'is-minus' : 'is-plus';
}

// Notes and values are escaped before going into the HTML string.
function renderHistory(goal) {
  const entries = getGoalEntries(goal.id);
  byId('history-panel').hidden = !usesEntries(goal) && entries.length === 0;
  byId('history-empty').hidden = entries.length > 0;
  byId('history-list').innerHTML = entries.map((entry) => {
    const date = Format.shortDate(entry.date);
    const label = entryLabel(goal, entry);
    return `
      <li>
        <div class="gd-history-main">
          <span class="gd-history-date">${escapeHtml(date)}</span>
          ${label ? `<span class="gd-history-note">${escapeHtml(label)}</span>` : ''}
        </div>
        <strong class="gd-history-change ${entryTone(goal, entry)}">${escapeHtml(entryChangeText(goal, entry))}</strong>
        <button type="button" class="btn btn-icon" data-delete-entry="${escapeHtml(entry.id)}"
                aria-label="${escapeHtml(t('details.history.delete', { date }))}" title="${escapeHtml(t('details.history.delete', { date }))}">
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>
      </li>`;
  }).join('');
}

function deleteEntry(entryId) {
  const goal = loadGoal();
  const entries = getProgressEntries();
  const entry = entries.find((item) => item.id === entryId);
  if (!goal || !entry) return;
  const remaining = entries.filter((item) => item.id !== entryId);
  // money/number: take the deleted change back; other types: recount from the remaining entries.
  const change = DELTA_TYPES.includes(goal.progressType) ? -(Number(entry.value) || 0) : 0;
  const newValue = recalculateCurrentValue(goal, getGoalEntries(goal.id, remaining), change);
  if (!saveProgressEntries(remaining)) return;
  updateGoal((saved) => { saved.currentValue = newValue; });
  showToast('toast.entryDeleted', 'success');
  renderDetailsPage();
  byId('history-title').focus(); // the deleted button is gone; keep focus in the same area
}

/* ---------- Milestones and checklist ---------- */

// The line under a milestone. doneAt is saved when a milestone is ticked (older ones have no date).
function milestoneStatus(milestone) {
  if (milestone.done) {
    const text = milestone.doneAt ? t('details.milestone.reached', { date: Format.shortDate(milestone.doneAt) }) : t('details.milestone.reachedNoDate');
    return { text, tone: 'is-done' };
  }
  const days = Dates.daysUntil(milestone.dueDate);
  if (days === null) return { text: '', tone: '' };
  if (days < 0) return { text: tPlural('details.milestone.overdue', -days), tone: 'is-overdue' };
  if (days === 0) return { text: t('details.milestone.today'), tone: 'is-soon' };
  return { text: tPlural('details.milestone.left', days), tone: '' };
}

function renderMilestones(goal) {
  const milestones = asArray(goal.milestones);
  byId('milestones-empty').hidden = milestones.length > 0;
  byId('milestone-list').innerHTML = milestones.map((milestone, index) => {
    const status = milestoneStatus(milestone);
    return `
      <li class="${milestone.done ? 'is-done' : ''}">
        <input class="form-check-input" type="checkbox" id="milestone-${index}" data-milestone-index="${index}"${milestone.done ? ' checked' : ''}>
        <label class="gd-milestone-title" for="milestone-${index}">${escapeHtml(milestone.title)}
          <span class="gd-milestone-date">${escapeHtml(Format.shortDate(milestone.dueDate))}</span></label>
        <span class="gd-milestone-status ${status.tone}">
          ${milestone.done ? '<i class="bi bi-check-circle-fill" aria-hidden="true"></i>' : ''}${escapeHtml(status.text)}
        </span>
      </li>`;
  }).join('');
}

/* ----- Checklist: tick, add, rename, delete (only a checklist goal) ----- */

const CHECKLIST_ITEM_MAX = 120; // the same limit as in the goal wizard
const checklistEdit = { index: null }; // the item being renamed (null = none)

// One item: [ ] text  ✎  🗑. The last item cannot be deleted: a checklist needs at least one.
function checklistItemHtml(item, index, count) {
  const text = escapeHtml(item.text);
  if (checklistEdit.index === index) {
    return `
      <li class="gd-check-edit">
        <label class="visually-hidden" for="check-rename-${index}">${escapeHtml(t('details.checklist.editLabel'))}</label>
        <input class="form-control" type="text" id="check-rename-${index}" maxlength="${CHECKLIST_ITEM_MAX}" autocomplete="off" value="${text}" data-check-rename-input="${index}">
        <button type="button" class="btn btn-icon" data-check-save="${index}" aria-label="${escapeHtml(t('details.checklist.save'))}" title="${escapeHtml(t('details.checklist.save'))}"><i class="bi bi-check-lg" aria-hidden="true"></i></button>
        <button type="button" class="btn btn-icon" data-check-cancel="${index}" aria-label="${escapeHtml(t('delete.cancel'))}" title="${escapeHtml(t('delete.cancel'))}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        <p class="field-error" id="check-rename-${index}-error"></p>
      </li>`;
  }
  const rename = t('details.checklist.rename', { text: item.text });
  const remove = count > 1 ? t('details.checklist.delete', { text: item.text }) : t('details.checklist.lastItem');
  return `
    <li class="${item.done ? 'is-done' : ''}">
      <input class="form-check-input mt-0" type="checkbox" id="check-item-${index}" data-check-index="${index}"${item.done ? ' checked' : ''}>
      <label class="item-text" for="check-item-${index}">${text}</label>
      <button type="button" class="btn btn-icon" data-check-rename="${index}" aria-label="${escapeHtml(rename)}" title="${escapeHtml(rename)}"><i class="bi bi-pencil" aria-hidden="true"></i></button>
      <button type="button" class="btn btn-icon" data-check-delete="${index}" aria-label="${escapeHtml(remove)}" title="${escapeHtml(remove)}"${count > 1 ? '' : ' disabled'}><i class="bi bi-trash" aria-hidden="true"></i></button>
    </li>`;
}

function renderChecklist(goal) {
  const isChecklist = goal.progressType === 'checklist';
  byId('checklist-panel').hidden = !isChecklist;
  if (!isChecklist) return;
  const items = asArray(goal.checklist);
  if (checklistEdit.index !== null && !items[checklistEdit.index]) checklistEdit.index = null;
  byId('checklist-count').textContent = t('progress.tile.of', {
    done: Format.number(items.filter((item) => item.done).length), total: Format.number(items.length)
  });
  byId('checklist-list').innerHTML = items.map((item, index) => checklistItemHtml(item, index, items.length)).join('');
}

// Changes the items and counts the goal again: done items = current value, all items = target.
function saveChecklist(change) {
  return updateGoal((goal) => {
    goal.checklist = asArray(goal.checklist).map((item) => ({ ...item }));
    change(goal.checklist);
    goal.currentValue = goal.checklist.filter((item) => item.done).length;
    goal.targetValue = goal.checklist.length;
  });
}

// The text of a new or renamed item: 1–120 characters (the error is shown under the field).
function checklistTextError(text) {
  if (text === '') return 'wizard.error.itemRequired';
  return text.length > CHECKLIST_ITEM_MAX ? 'details.checklist.tooLong' : null;
}

function addChecklistItem(event) {
  event.preventDefault();
  const input = byId('checklist-new');
  const text = input.value.trim();
  const error = checklistTextError(text);
  setFieldError(input, error);
  if (error) {
    input.focus();
    return;
  }
  if (!saveChecklist((items) => items.push({ id: createId('item'), text, done: false }))) return;
  input.value = '';
  showToast('toast.checklistAdded', 'success', { text });
  renderDetailsPage();
  input.focus(); // add the next one at once
}

function startRenameChecklistItem(index) {
  checklistEdit.index = index;
  renderDetailsPage();
  const input = byId(`check-rename-${index}`);
  input?.focus();
  input?.select();
}

function cancelRenameChecklistItem(index) {
  checklistEdit.index = null;
  renderDetailsPage();
  byId('checklist-list').querySelector(`[data-check-rename="${index}"]`)?.focus();
}

function saveRenameChecklistItem(index) {
  const input = byId(`check-rename-${index}`);
  const text = input.value.trim();
  const error = checklistTextError(text);
  setFieldError(input, error);
  if (error) {
    input.focus();
    return;
  }
  if (!saveChecklist((items) => { items[index].text = text; })) return;
  checklistEdit.index = null;
  showToast('toast.checklistRenamed', 'success', { text });
  renderDetailsPage();
  byId('checklist-list').querySelector(`[data-check-rename="${index}"]`)?.focus();
}

function deleteChecklistItem(index) {
  const items = asArray(loadGoal()?.checklist);
  if (items.length <= 1 || !items[index]) return; // the last item stays
  const { text } = items[index];
  if (!saveChecklist((list) => list.splice(index, 1))) return;
  checklistEdit.index = null;
  showToast('toast.checklistDeleted', 'success', { text });
  renderDetailsPage();
  // The focus goes to the item that took this place (or the one above it), else to the title
  const list = byId('checklist-list');
  const next = list.querySelector(`[data-check-index="${Math.min(index, items.length - 2)}"]`);
  (next ?? byId('checklist-title')).focus();
}

function onChecklistClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const { checkRename, checkSave, checkCancel, checkDelete } = button.dataset;
  if (checkRename !== undefined) startRenameChecklistItem(Number(checkRename));
  if (checkSave !== undefined) saveRenameChecklistItem(Number(checkSave));
  if (checkCancel !== undefined) cancelRenameChecklistItem(Number(checkCancel));
  if (checkDelete !== undefined) deleteChecklistItem(Number(checkDelete));
}

// In the rename field: Enter saves, Esc cancels.
function onChecklistKeydown(event) {
  const index = event.target.dataset.checkRenameInput;
  if (index === undefined) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    saveRenameChecklistItem(Number(index));
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelRenameChecklistItem(Number(index));
  }
}

function toggleMilestone(index, done) {
  const save = (goal) => {
    goal.milestones[index].done = done;
    goal.milestones[index].doneAt = done ? Dates.toISO(Dates.today()) : null; // for "reached 15.01.2026"
  };
  if (!updateGoal(save)) return;
  showToast('toast.milestoneUpdated', 'success');
  renderDetailsPage();
  byId(`milestone-${index}`)?.focus(); // the list was redrawn
}

function toggleChecklistItem(index, done) {
  if (!setChecklistItemDone(goalDetails.id, index, done)) return; // js/entry-form.js
  showToast('toast.checklistUpdated', 'success');
  renderDetailsPage();
  byId(`check-item-${index}`)?.focus();
}

/* ---------- Related tasks (TaskList and TaskForm come from tasks.js) ---------- */

function renderGoalTasks(goal) {
  TaskList.render(byId('goal-tasks'), getTasksForGoal(goal.id), { showDate: true, emptyKey: 'details.tasks.empty' });
}

// After ticking a task the list is redrawn; focus goes back to the same checkbox.
function onGoalTasksChanged({ focusId } = {}) {
  renderDetailsPage();
  if (focusId) byId(focusId)?.focus();
}

function openNewGoalTask() {
  const goal = loadGoal();
  if (!goal) return;
  TaskForm.open({
    defaults: { goalId: goal.id, category: goal.category in GOAL_CATEGORIES ? goal.category : null },
    onSaved: onGoalTasksChanged,
    returnFocusId: 'goal-task-add'
  });
}

/* ---------- Notes and completing ---------- */

function saveNotes() {
  if (updateGoal((goal) => { goal.notes = byId('goal-notes').value; })) {
    showToast('toast.notesSaved', 'success');
  }
}

function completeGoal() {
  const saved = updateGoal((goal) => { goal.status = 'completed'; });
  if (!saved) return;
  showToast('toast.goalCompleted', 'success', { title: saved.title });
  renderDetailsPage();
  byId('details-title').focus();
}

/* ---------- Page ---------- */

function showMissing() {
  byId('details-content').hidden = true;
  byId('details-missing').hidden = false;
  byId('details-missing-text').textContent = t(goalDetails.id ? 'details.missing.text' : 'details.missing.noId');
}

function renderDetailsPage() {
  const goal = loadGoal();
  if (!goal) {
    showMissing();
    return;
  }
  byId('details-missing').hidden = true;
  byId('details-content').hidden = false;
  renderOverview(goal);
  renderEntryForm(goal);
  renderHistory(goal);
  renderMilestones(goal);
  renderChecklist(goal);
  renderGoalTasks(goal);
}

function bindDetailsEvents() {
  byId('entry-form').addEventListener('submit', submitOnce(submitEntry));
  byId('history-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-entry]');
    if (button) deleteEntry(button.dataset.deleteEntry);
  });
  byId('milestone-list').addEventListener('change', (event) => {
    const box = event.target.closest('[data-milestone-index]');
    if (box) toggleMilestone(Number(box.dataset.milestoneIndex), box.checked);
  });
  byId('checklist-list').addEventListener('change', (event) => {
    const box = event.target.closest('[data-check-index]');
    if (box) toggleChecklistItem(Number(box.dataset.checkIndex), box.checked);
  });
  byId('checklist-list').addEventListener('click', onChecklistClick);
  byId('checklist-list').addEventListener('keydown', onChecklistKeydown);
  byId('checklist-add-form').addEventListener('submit', submitOnce(addChecklistItem));
  byId('notes-save').addEventListener('click', submitOnce(saveNotes));
  TaskList.bind(byId('goal-tasks'), onGoalTasksChanged);
  byId('goal-task-add').addEventListener('click', openNewGoalTask);
  byId('details-complete').addEventListener('click', completeGoal);
}

onAppReady(() => {
  bindDetailsEvents();
  entryForm.reset();
  renderDetailsPage();
  // Notes are filled once, so a re-render never overwrites what is being typed.
  byId('goal-notes').value = loadGoal()?.notes ?? '';
  byId('details-title').setAttribute('tabindex', '-1');
  document.addEventListener('lifeos:languagechange', renderDetailsPage);
});
