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
  byId('details-reopen').hidden = goal.status !== 'completed';
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
  if (hasBookList(goal)) return bookCountText(amount, text); // "0,07 книги"
  return goal.unit ? `${text} ${goal.unit}` : text;
}

// Pages per day for book goals, based on the user's own finished books (average length).
// A goal with a book list: the same pace as above the list (app.js: bookShelfStats).
function booksPagesLine(goal, remainingBooks, daysLeft) {
  if (hasBookList(goal)) {
    const { perDay } = bookShelfStats(goal);
    return perDay ? t('details.pace.pages', { pages: Format.number(perDay) }) : null;
  }
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
  // A book list: one pace for the whole page, in pages ("~77 pages a day"), not "0.3 books a week"
  if (hasBookList(goal)) {
    const { perDay } = bookShelfStats(goal, Dates.today(), getGoalEntries(goal.id));
    return { value: perDay ? t('details.pace.bookPages', { pages: Format.number(perDay) }) : '—', note: '' };
  }
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

// Adds a new entry, or saves the entry being edited ("Edit the entry" → "Save").
function submitEntry(event) {
  event.preventDefault();
  const goal = loadGoal();
  const editedId = entryForm.editedId();
  if (!goal || !entryForm.save(goal)) return; // errors are shown next to the fields
  if (editedId) {
    showToast('toast.entryUpdated', 'success');
    entryForm.stopEdit();
    renderDetailsPage();
    focusHistoryEntry(editedId);
    offerFinish(goal);
    return;
  }
  entryForm.toastAfterSave('toast.entryAdded'); // or "Book finished: «…»"
  entryForm.reset();
  renderDetailsPage();
  offerFinish(goal);
}

/* ----- Editing an entry of the history in the same form ----- */

// The ✎ of a row (or a click on the row). An entry of a finished book only gets the reason.
function editEntry(entryId) {
  const goal = loadGoal();
  const entry = goal ? getGoalEntries(goal.id).find((item) => item.id === entryId) : null;
  if (!entry) return;
  const block = entryEditBlock(goal, entry);
  if (block) {
    showToast(block, 'info');
    return;
  }
  entryForm.startEdit(goal, entry);
  renderHistory(goal); // marks the row being edited
  byId('entry-panel').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  byId('entry-title').focus({ preventScroll: true });
}

function cancelEdit() {
  const editedId = entryForm.editedId();
  entryForm.stopEdit();
  renderDetailsPage();
  focusHistoryEntry(editedId);
}

// Back to the row's ✎ after saving or cancelling (or to the title if the row is gone).
function focusHistoryEntry(entryId) {
  const button = byId('history-list').querySelector(`[data-edit-entry="${CSS.escape(entryId ?? '')}"]`);
  (button ?? byId('history-title')).focus();
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
  const isReading = hasBookList(goal);
  byId('history-panel').hidden = !usesEntries(goal) && entries.length === 0;
  byId('history-empty').hidden = entries.length > 0;
  const title = byId('history-title');
  title.dataset.i18n = isReading ? 'books.history.title' : 'details.history.titleLong'; // "Reading history"
  title.textContent = t(title.dataset.i18n);
  const editedId = entryForm.editedId();
  byId('history-list').classList.toggle('is-reading', isReading);
  byId('history-list').innerHTML = entries
    .map((entry) => (isReading ? bookHistoryItemHtml(goal, entry, editedId) : historyItemHtml(goal, entry, editedId)))
    .join('');
}

function historyItemHtml(goal, entry, editedId) {
  const date = Format.shortDate(entry.date);
  const label = entryLabel(goal, entry);
  return `
      <li class="${entry.id === editedId ? 'is-editing' : ''}" data-entry-row="${escapeHtml(entry.id)}">
        <div class="gd-history-main">
          <span class="gd-history-date">${escapeHtml(date)}</span>
          ${label ? `<span class="gd-history-note">${escapeHtml(label)}</span>` : ''}
        </div>
        <strong class="gd-history-change ${entryTone(goal, entry)} ${entry.bookId ? 'is-book' : ''}">${escapeHtml(entryChangeText(goal, entry))}</strong>
        ${historyActionsHtml(goal, entry, date)}
      </li>`;
}

// A reading entry: [date] the book (bold), under it "+20 pages" or "Finished ✓" and the memo.
// An old entry without a book (before the list) shows its change text instead of a title.
function bookHistoryItemHtml(goal, entry, editedId) {
  const date = Format.shortDate(entry.date);
  const book = goalBooks(goal).find((item) => item.id === entry.bookId);
  const finished = Number(entry.value) > 0;
  let badge = '';
  if (finished) badge = `<span class="badge-status is-success">${escapeHtml(t('books.history.finishedBadge'))}</span>`;
  else if (entry.mode === 'to') badge = toPageBadgeHtml(entry);
  else if (bookEntryPages(entry)) badge = `<span class="badge-status is-accent">${escapeHtml(tPlural('books.history.pagesBadge', bookEntryPages(entry)))}</span>`;
  return `
      <li class="gd-history-book${entry.id === editedId ? ' is-editing' : ''}" data-entry-row="${escapeHtml(entry.id)}">
        <span class="gd-history-day">${escapeHtml(date)}</span>
        <div class="gd-history-main">
          <strong class="gd-history-book-title">${escapeHtml(book ? bookTitle(book) : entryChangeText(goal, entry))}</strong>
          ${badge ? `<span class="gd-history-badges">${badge}</span>` : ''}
          ${entry.note ? `<span class="gd-history-note">${escapeHtml(entry.note)}</span>` : ''}
        </div>
        ${historyActionsHtml(goal, entry, date)}
      </li>`;
}

// "Stopped at page 95" -> the badge "at p. 95" and, small, what it added "(+10)": counted again by
// replayBook whenever an older entry changes (app.js), so it is never stale.
function toPageBadgeHtml(entry) {
  const added = Number(entry.added) || 0;
  const sign = added < 0 ? '−' : '+';
  return `<span class="badge-status is-accent">${escapeHtml(t('books.history.toPage', { page: Format.number(Number(entry.page) || 0) }))}</span>
          <span class="gd-history-added">(${sign}${escapeHtml(Format.number(Math.abs(added)))})</span>`;
}

// ✎ and 🗑. An entry of a finished book cannot be edited: the ✎ then says why (entryEditBlock).
function historyActionsHtml(goal, entry, date) {
  const id = escapeHtml(entry.id);
  const editText = t(entryEditBlock(goal, entry) ?? 'details.history.edit', { date });
  const deleteText = t('details.history.delete', { date });
  return `
        <div class="gd-history-actions">
          <button type="button" class="btn btn-icon" data-edit-entry="${id}"
                  aria-label="${escapeHtml(editText)}" title="${escapeHtml(editText)}">
            <i class="bi bi-pencil" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-icon" data-delete-entry="${id}"
                  aria-label="${escapeHtml(deleteText)}" title="${escapeHtml(deleteText)}">
            <i class="bi bi-trash" aria-hidden="true"></i>
          </button>
        </div>`;
}

// Deletes at once (app.js: deleteProgressEntry) and offers "Undo" for 7 seconds.
// Leaving the page makes the delete final: nothing is kept anywhere else.
const UNDO_DELAY = 7000;

function deleteEntry(entryId) {
  const goal = loadGoal();
  if (!goal) return;
  const result = deleteProgressEntry(goal.id, entryId);
  if (!result) return;
  if (entryForm.editedId() === entryId) entryForm.stopEdit(); // the entry in the form is gone
  showToast('toast.entryDeleted', 'success', {}, {
    delay: UNDO_DELAY,
    action: { labelKey: 'toast.undo', onClick: () => undoDelete(goal.id, result.removed) }
  });
  renderDetailsPage();
  byId('history-title').focus(); // the deleted button is gone; keep focus in the same area
}

// The entry goes back to its place, the goal (and the book) are counted again.
function undoDelete(goalId, removed) {
  if (!restoreProgressEntry(goalId, removed)) {
    showToast('toast.undoFailed', 'warning');
    return;
  }
  showToast('toast.entryRestored', 'success');
  renderDetailsPage();
  focusHistoryEntry(removed.entry.id);
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
  const milestones = goalMilestones(goal); // app.js: none for a book list goal (the data stays)
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
  const before = loadGoal();
  if (!setChecklistItemDone(goalDetails.id, index, done)) return; // js/entry-form.js
  showToast('toast.checklistUpdated', 'success');
  renderDetailsPage();
  byId(`check-item-${index}`)?.focus();
  if (before) offerFinish(before);
}

/* ---------- Related tasks (TaskList and TaskForm come from tasks.js) ---------- */

function renderGoalTasks(goal) {
  const isReading = hasBookList(goal);
  TaskList.render(byId('goal-tasks'), getTasksForGoal(goal.id), { showDate: true, emptyKey: 'details.tasks.empty', menu: isReading });
  byId('goal-task-add-head').hidden = !isReading;
  byId('goal-task-add').hidden = isReading;
}

// After ticking a task the list is redrawn; focus goes back to the same checkbox.
function onGoalTasksChanged({ focusId } = {}) {
  renderDetailsPage();
  if (focusId) byId(focusId)?.focus();
}

function openNewGoalTask(event) {
  const goal = loadGoal();
  if (!goal) return;
  TaskForm.open({
    defaults: { goalId: goal.id, category: goal.category in GOAL_CATEGORIES ? goal.category : null },
    onSaved: onGoalTasksChanged,
    returnFocusId: event?.currentTarget?.id ?? 'goal-task-add'
  });
}

/* ---------- Notes and completing ---------- */

function saveNotes() {
  if (updateGoal((goal) => { goal.notes = byId('goal-notes').value; })) {
    showToast('toast.notesSaved', 'success');
  }
}

// After a finish dialog (or at once): the page is drawn again, the focus goes to the title.
function afterGoalStatus() {
  renderDetailsPage();
  byId('details-title').focus();
}

// Below 100 % a question first (app.js: GoalFinish).
function completeGoal() {
  const goal = loadGoal();
  if (goal) GoalFinish.askComplete(goal, afterGoalStatus);
}

// A completed goal goes back to "In progress".
function reopenGoal() {
  const saved = setGoalStatus(goalDetails.id, 'active');
  if (!saved) return;
  showToast('toast.goalReopened', 'success', { title: saved.title });
  afterGoalStatus();
}

// An entry or a ticked item brought the goal to 100 % for the first time: "Goal reached! 🎉".
function offerFinish(before) {
  GoalFinish.afterEntry(before, afterGoalStatus);
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
  renderReadingLayout(goal);
  BookShelf.render(goal); // "My books" (js/books.js): only for a goal with a book list
  renderEntryForm(goal);
  renderHistory(goal);
  renderMilestones(goal);
  renderChecklist(goal);
  renderGoalTasks(goal);
}

// The shelf (js/books.js) chose a book: an entry being edited is closed, the book is chosen,
// the page scrolls smoothly to the form and the pages field gets the focus.
function pickBookForReading(bookId) {
  if (entryForm.isEditing()) {
    entryForm.stopEdit();
    renderDetailsPage();
  }
  if (!entryForm.selectBook(bookId)) return;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  byId('entry-panel').scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  byId('entry-bookpages').focus({ preventScroll: true });
}

// A goal with a book list is a reading diary (docs/design/reading-diary.png): no milestones and no notes
// on the page (they stay in the data), the related tasks take the whole row.
function renderReadingLayout(goal) {
  const isReading = hasBookList(goal);
  byId('details-content').classList.toggle('is-reading', isReading);
  byId('milestones-panel').hidden = isReading;
  byId('notes-panel').hidden = isReading;
}

// 🗑 deletes, ✎ edits; a click anywhere else on the row edits too (the ✎ is the keyboard way).
function onHistoryClick(event) {
  const remove = event.target.closest('[data-delete-entry]');
  if (remove) {
    deleteEntry(remove.dataset.deleteEntry);
    return;
  }
  const row = event.target.closest('[data-entry-row]');
  if (row) editEntry(row.dataset.entryRow);
}

function bindDetailsEvents() {
  byId('entry-form').addEventListener('submit', submitOnce(submitEntry));
  byId('history-list').addEventListener('click', onHistoryClick);
  byId('entry-cancel').addEventListener('click', cancelEdit);
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
  byId('goal-task-add-head').addEventListener('click', openNewGoalTask);
  byId('details-complete').addEventListener('click', completeGoal);
  byId('details-reopen').addEventListener('click', reopenGoal);
}

onAppReady(() => {
  bindDetailsEvents();
  entryForm.reset();
  renderDetailsPage();
  // Notes are filled once, so a re-render never overwrites what is being typed.
  byId('goal-notes').value = loadGoal()?.notes ?? '';
  byId('details-title').setAttribute('tabindex', '-1');
  document.addEventListener('lifeos:languagechange', renderDetailsPage);
  // The "Quick result" dialog (offered after a done task) and the finish dialog change the goal too
  document.addEventListener('lifeos:progresschange', renderDetailsPage);
  // A book added on the shelf is chosen in "Add an entry" (js/books.js)
  document.addEventListener('lifeos:bookadded', (event) => entryForm.preferBook(event.detail.bookId));
  // A cover pressed on the shelf: this book in "Log reading", the page goes to the form
  document.addEventListener('lifeos:bookpick', (event) => pickBookForReading(event.detail.bookId));
  document.addEventListener('lifeos:goalschange', renderDetailsPage);
});
