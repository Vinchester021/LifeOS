// LifeOS — task UI shared by Dashboard, Planner and Goal Details.
//   TaskList — draws a list of tasks (checkbox + label, priority badge, goal icon, repeat icon).
//   TaskForm — one dialog to create, edit and delete a task, with validation.
// The data functions (getTasksForDate, toggleTask, addTask, ...) are in app.js, section "Tasks".
// The dialog markup is created here once, so it is not copied into every page.
'use strict';

/* ---------- A done task of a goal: "Record a result for the goal?" ---------- */

// A tick does not change the goal's progress, so a quiet toast offers the "Quick result" dialog
// (js/entry-form.js) with this goal. Not for a checklist goal (its items are ticked on the goal page),
// not for a goal with a project list (it counts finished projects, 1.6.5) and not on a page without the dialog.
const RECORD_OFFER_DELAY = 7000;

function offerGoalEntry(taskId, openerId) {
  const task = getTasks().find((item) => item.id === taskId);
  const goal = task?.goalId ? getGoalById(task.goalId) : null;
  if (!goal || goal.status !== 'active' || goal.progressType === 'checklist' || hasProjectList(goal) || typeof QuickEntry === 'undefined') return;
  showToast('task.toast.recordGoal', 'info', { title: goal.title }, {
    delay: RECORD_OFFER_DELAY,
    action: { labelKey: 'task.toast.record', onClick: () => QuickEntry.open(byId(openerId), goal.id) }
  });
}

/* ---------- Task list ---------- */

// Task ids and dates come from storage (or an imported file): keep only safe characters for HTML ids.
function taskDomId(task, date, prefix = 'task') {
  const safe = (value) => String(value ?? '').replace(/[^\w-]/g, '_');
  return `${prefix}-${safe(task.id)}-${safe(date)}`;
}

const TaskList = {
  // occurrences: [{ task, date, done }] — from getTasksForDate() or getTasksForGoal()
  // weekActions: the compact week card (Planner, week level): priority dot, move ‹ › and edit buttons.
  // menu: a plain row with a ⋯ menu (a reading goal page): checkbox, title, date, ⋯ (edit, delete).
  render(container, occurrences, { showDate = false, emptyKey = 'task.list.empty', weekActions = false, menu = false } = {}) {
    if (occurrences.length === 0) {
      container.innerHTML = `<p class="task-empty">${escapeHtml(t(emptyKey))}</p>`;
      return;
    }
    const goals = new Map(getGoals().map((goal) => [goal.id, goal]));
    const items = occurrences.map((occurrence) => (menu ? this.menuItemHtml(occurrence) : this.itemHtml(occurrence, goals, showDate, weekActions)));
    container.innerHTML = `<ul class="task-list">${items.join('')}</ul>`;
  },

  // Every user value (title, goal title) is escaped.
  itemHtml({ task, date, done }, goals, showDate, weekActions) {
    if (weekActions) return this.weekItemHtml({ task, date, done }, goals);
    const checkboxId = taskDomId(task, date);
    const goal = task.goalId ? goals.get(task.goalId) : null; // a deleted goal = no icon
    const priority = TASK_PRIORITIES.includes(task.priority) ? task.priority : 'medium';
    // The pencil sits inside .task-meta, so it never wraps to a line of its own.
    return `
      <li class="task-item${done ? ' is-done' : ''}">
        <input class="form-check-input" type="checkbox" id="${checkboxId}"
               data-task-toggle="${escapeHtml(task.id)}" data-task-date="${escapeHtml(date)}"${done ? ' checked' : ''}>
        <label class="task-title" for="${checkboxId}">${escapeHtml(task.title)}</label>
        <span class="task-meta">
          ${showDate ? `<span class="task-date">${escapeHtml(Format.shortDate(date))}</span>` : ''}
          ${isRecurringTask(task) ? this.repeatHtml(task) : ''}
          ${this.projectHtml(task, goals)}
          ${goal ? this.goalHtml(goal) : ''}
          ${this.priorityBadgeHtml(priority)}
          ${this.editButtonHtml(task, date)}
        </span>
      </li>`;
  },

  // A row with a ⋯ menu (docs/design/reading-diary.png). The goal icon and the priority are not shown:
  // the page is the goal itself.
  menuItemHtml({ task, date, done }) {
    const checkboxId = taskDomId(task, date);
    const id = escapeHtml(task.id);
    const menuLabel = t('task.menu', { title: task.title });
    return `
      <li class="task-item task-item-menu${done ? ' is-done' : ''}">
        <input class="form-check-input" type="checkbox" id="${checkboxId}"
               data-task-toggle="${id}" data-task-date="${escapeHtml(date)}"${done ? ' checked' : ''}>
        <label class="task-title" for="${checkboxId}">${escapeHtml(task.title)}</label>
        ${this.projectHtml(task)}
        <span class="task-date"><i class="bi bi-calendar3" aria-hidden="true"></i>${escapeHtml(Format.shortDate(date))}${isRecurringTask(task) ? this.repeatHtml(task) : ''}</span>
        <div class="dropdown">
          <button type="button" class="btn btn-icon" id="${taskDomId(task, date, 'task-menu')}" data-bs-toggle="dropdown" aria-expanded="false"
                  aria-label="${escapeHtml(menuLabel)}" title="${escapeHtml(menuLabel)}">
            <i class="bi bi-three-dots" aria-hidden="true"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button type="button" class="dropdown-item" data-task-edit="${id}"><i class="bi bi-pencil me-2" aria-hidden="true"></i>${escapeHtml(t('task.menu.edit'))}</button></li>
            <li><button type="button" class="dropdown-item text-danger" data-task-delete="${id}"><i class="bi bi-trash me-2" aria-hidden="true"></i>${escapeHtml(t('task.menu.delete'))}</button></li>
          </ul>
        </div>
      </li>`;
  },

  // ⋯ → "Delete": at once, with "Undo" in the toast (the task goes back to its place in the list).
  deleteWithUndo(taskId, onChange) {
    const tasks = getTasks();
    const index = tasks.findIndex((item) => item.id === taskId);
    if (index === -1 || !deleteTask(taskId)) return;
    const task = tasks[index];
    onChange({});
    showToast('toast.taskDeleted', 'success', {}, {
      delay: RECORD_OFFER_DELAY,
      action: { labelKey: 'toast.undo', onClick: () => this.restore(task, index, onChange) }
    });
  },

  restore(task, index, onChange) {
    const tasks = getTasks();
    tasks.splice(Math.min(index, tasks.length), 0, task);
    if (!saveTasks(tasks)) return;
    showToast('toast.taskRestored', 'success');
    onChange({ focusId: taskDomId(task, task.date) });
  },

  // Week view: a compact card. Line 1: checkbox, title (2 lines max), priority dot.
  // The small buttons (goal, move ‹ ›, edit) appear on hover / keyboard focus (always on touch screens).
  weekItemHtml({ task, date, done }, goals) {
    const checkboxId = taskDomId(task, date);
    const goal = task.goalId ? goals.get(task.goalId) : null;
    const repeat = isRecurringTask(task)
      ? `<i class="bi bi-arrow-repeat task-repeat-mini" aria-hidden="true"></i><span class="visually-hidden">${escapeHtml(t('task.repeats', { rule: t(`task.recurrence.${task.recurrence}`) }))}</span>`
      : '';
    return `
      <li class="task-item task-item-week${done ? ' is-done' : ''}"${this.dragAttributes(task, date, true)}>
        <input class="form-check-input" type="checkbox" id="${checkboxId}"
               data-task-toggle="${escapeHtml(task.id)}" data-task-date="${escapeHtml(date)}"${done ? ' checked' : ''}>
        <label class="task-title" for="${checkboxId}" title="${escapeHtml(task.title)}">${repeat}${escapeHtml(task.title)}</label>
        ${this.priorityDotHtml(task, date)}
        <span class="task-actions">
          ${this.projectHtml(task, goals, true)}
          ${goal ? this.goalHtml(goal) : ''}
          ${this.weekActionsHtml(task, date)}
          ${this.editButtonHtml(task, date)}
        </span>
      </li>`;
  },

  // Colored dot = priority. A click opens a small menu of 3 priorities (Bootstrap dropdown:
  // arrows, Enter and Escape work). "fixed" keeps the menu visible inside the scrolling week.
  priorityDotHtml(task, date) {
    const priority = TASK_PRIORITIES.includes(task.priority) ? task.priority : 'medium';
    const label = t('task.priorityDot', { priority: t(`task.priority.${priority}`), title: task.title });
    const items = [...TASK_PRIORITIES].reverse().map((value) => `
          <li><button type="button" class="dropdown-item${value === priority ? ' active' : ''}" data-set-priority="${value}"
                      data-task-id="${escapeHtml(task.id)}"${value === priority ? ' aria-current="true"' : ''}>
            <span class="priority-dot dot-${value}" aria-hidden="true"></span>${escapeHtml(t(`task.priority.${value}`))}
          </button></li>`).join('');
    return `
        <div class="dropdown task-dot-menu">
          <button type="button" class="task-dot-button" id="${taskDomId(task, date, 'task-priority')}" data-bs-toggle="dropdown"
                  aria-expanded="false" data-bs-popper-config='{"strategy":"fixed"}' aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
            <span class="priority-dot dot-${priority}" aria-hidden="true"></span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">${items}</ul>
        </div>`;
  },

  editButtonHtml(task, date) {
    return `
        <button type="button" class="btn btn-icon" id="${taskDomId(task, date, 'task-edit')}" data-task-edit="${escapeHtml(task.id)}"
                aria-label="${escapeHtml(t('task.edit', { title: task.title }))}">
          <i class="bi bi-pencil" aria-hidden="true"></i>
        </button>`;
  },

  // Week view: one-time tasks can be dragged to another day (repeating ones would move the whole series).
  dragAttributes(task, date, weekActions) {
    if (!weekActions || isRecurringTask(task)) return '';
    return ` draggable="true" data-drag-task="${escapeHtml(task.id)}" data-drag-date="${escapeHtml(date)}"`;
  },

  // The priority as a small badge (in the week view a colored dot shows it instead).
  priorityBadgeHtml(priority) {
    return `
      <span class="task-priority priority-${priority}">
        <span class="visually-hidden">${escapeHtml(t('task.priorityPrefix'))}</span>${escapeHtml(t(`task.priority.${priority}`))}
      </span>`;
  },

  // Move buttons ‹ ›. A repeating task is not moved by them (that would shift the whole series).
  weekActionsHtml(task, date) {
    if (isRecurringTask(task) || !isIsoDate(date)) return '';
    const id = escapeHtml(task.id);
    const move = (direction, icon, labelKey) => {
      const target = Dates.toISO(Dates.addDays(Dates.parse(date), direction));
      const label = t(labelKey, { title: task.title });
      return `
        <button type="button" class="btn btn-icon" id="${taskDomId(task, date, `task-move${direction}`)}"
                data-task-move="${id}" data-move-to="${escapeHtml(target)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
          <i class="bi ${icon}" aria-hidden="true"></i>
        </button>`;
    };
    return move(-1, 'bi-chevron-left', 'task.movePrev') + move(1, 'bi-chevron-right', 'task.moveNext');
  },

  repeatHtml(task) {
    const label = t('task.repeats', { rule: t(`task.recurrence.${task.recurrence}`) });
    return `
      <span class="task-repeat" title="${escapeHtml(label)}">
        <i class="bi bi-arrow-repeat" aria-hidden="true"></i><span class="visually-hidden">${escapeHtml(label)}</span>
      </span>`;
  },

  // A task of a project stage (1.6.5): "▤ Room repair" next to it (in the compact week card — the icon only,
  // the name in its hint). The name is user data: escaped.
  projectHtml(task, goals = null, iconOnly = false) {
    const found = taskProject(task, goals ? [...goals.values()] : getGoals());
    if (!found) return '';
    const label = t('task.project', { title: projectTitle(found.project) });
    return `
          <span class="task-project${iconOnly ? ' is-icon' : ''}" title="${escapeHtml(label)}">
            <i class="bi bi-layers" aria-hidden="true"></i>${iconOnly
              ? `<span class="visually-hidden">${escapeHtml(label)}</span>`
              : `<span class="visually-hidden">${escapeHtml(t('task.projectPrefix'))}</span>${escapeHtml(projectTitle(found.project))}`}
          </span>`;
  },

  // A small colored icon of the linked goal; it links to the goal page.
  goalHtml(goal) {
    const label = t('task.goalLink', { title: goal.title });
    return `
      <a class="task-goal" href="goal-details.html?id=${escapeHtml(encodeURIComponent(goal.id))}"
         data-color="${goalColor(goal)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">
        <i class="bi ${goalIcon(goal)}" aria-hidden="true"></i>
      </a>`;
  },

  // One listener per list. onChange({ focusId }) is called after any change, so the page can redraw.
  bind(container, onChange) {
    container.addEventListener('change', (event) => {
      const box = event.target.closest('[data-task-toggle]');
      if (!box) return;
      const isDone = box.checked; // the new state
      const task = toggleTask(box.dataset.taskToggle, box.dataset.taskDate);
      const stageChange = syncProjectStage(task); // a task of a project stage: the stage may get ready / reopen
      onChange({ focusId: box.id });
      if (isDone) offerGoalEntry(box.dataset.taskToggle, box.id);
      announceStageChange(stageChange, () => onChange({ focusId: box.id }));
    });
    container.addEventListener('click', (event) => {
      // Week view: a priority from the dot menu; focus goes back to the dot.
      const priorityItem = event.target.closest('[data-set-priority]');
      if (priorityItem) {
        const task = getTasks().find((item) => item.id === priorityItem.dataset.taskId);
        const dot = priorityItem.closest('.task-dot-menu').querySelector('.task-dot-button');
        updateTask(priorityItem.dataset.taskId, { priority: priorityItem.dataset.setPriority });
        if (task) onChange({ focusId: dot.id });
        return;
      }
      const moveButton = event.target.closest('[data-task-move]');
      if (moveButton) {
        const task = moveTask(moveButton.dataset.taskMove, moveButton.dataset.moveTo);
        // Focus follows the task to its new day.
        if (task) onChange({ focusId: taskDomId(task, task.date), moved: true });
        return;
      }
      const remove = event.target.closest('[data-task-delete]');
      if (remove) {
        this.deleteWithUndo(remove.dataset.taskDelete, onChange);
        return;
      }
      const button = event.target.closest('[data-task-edit]');
      if (!button) return;
      const task = getTasks().find((item) => item.id === button.dataset.taskEdit);
      // From the ⋯ menu the focus goes back to the ⋯ button
      const returnFocusId = button.id || button.closest('.dropdown')?.querySelector('[data-bs-toggle]')?.id;
      if (task) TaskForm.open({ task, onSaved: onChange, returnFocusId });
    });
  }
};

/* ---------- Task form dialog ---------- */

// Static markup (no user data). Texts come from data-i18n.
const TASK_FORM_HTML = `
  <div class="modal fade" id="task-modal" tabindex="-1" aria-labelledby="task-modal-title">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
      <form class="modal-content" id="task-form" novalidate>
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="task-modal-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label" for="task-title" data-i18n="task.form.title"></label>
            <input class="form-control" type="text" id="task-title" autocomplete="off" aria-describedby="task-title-hint">
            <div class="form-text" id="task-title-hint" data-i18n="task.form.titleHint"></div>
            <p class="field-error" id="task-title-error"></p>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-sm-6">
              <label class="form-label" for="task-date" data-i18n="task.form.date"></label>
              <input class="form-control" type="text" id="task-date" inputmode="numeric" maxlength="10" autocomplete="off" data-date-field data-i18n-placeholder="date.placeholder" aria-describedby="task-date-hint">
              <div class="form-text" id="task-date-hint" data-i18n="task.form.dateHint"></div>
              <p class="field-error" id="task-date-error"></p>
            </div>
            <fieldset class="col-sm-6">
              <legend class="form-label fs-6" data-i18n="task.form.priority"></legend>
              <div class="choice-group" id="task-priority-list"></div>
            </fieldset>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-sm-6">
              <label class="form-label" for="task-category" data-i18n="task.form.category"></label>
              <select class="form-select" id="task-category"></select>
            </div>
            <div class="col-sm-6">
              <label class="form-label" for="task-goal" data-i18n="task.form.goal"></label>
              <select class="form-select" id="task-goal" aria-describedby="task-goal-hint"></select>
              <div class="form-text" id="task-goal-hint" data-i18n="task.form.goalHint"></div>
              <p class="field-error" id="task-goal-error"></p>
            </div>
          </div>
          <div class="row g-3">
            <div class="col-sm-6">
              <label class="form-label" for="task-recurrence" data-i18n="task.form.recurrence"></label>
              <select class="form-select" id="task-recurrence" aria-describedby="task-recurrence-hint"></select>
              <div class="form-text" id="task-recurrence-hint" data-i18n="task.form.recurrenceHint"></div>
            </div>
            <div class="col-sm-6">
              <label class="form-label" for="task-period" data-i18n="task.form.period"></label>
              <select class="form-select" id="task-period"></select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-danger me-auto" id="task-delete">
            <i class="bi bi-trash me-1" aria-hidden="true"></i><span id="task-delete-label"></span>
          </button>
          <button type="button" class="btn btn-tool" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <button type="submit" class="btn btn-primary" id="task-save"></button>
        </div>
      </form>
    </div>
  </div>`;

const TaskForm = {
  modalEl: null,
  task: null, // the task being edited, or null for a new one
  onSaved: null,
  returnFocusId: null,
  deleteArmed: false, // delete needs two clicks: "Delete task" -> "Yes, delete"

  // Creates the dialog the first time it is needed.
  ensureModal() {
    if (this.modalEl) return;
    document.body.insertAdjacentHTML('beforeend', TASK_FORM_HTML);
    this.modalEl = byId('task-modal');
    this.buildOptions();
    I18n.apply(this.modalEl);
    byId('task-form').addEventListener('submit', submitOnce((event) => {
      event.preventDefault();
      this.save();
    }));
    byId('task-delete').addEventListener('click', () => this.remove());
    this.modalEl.addEventListener('shown.bs.modal', () => byId('task-title').focus());
    this.modalEl.addEventListener('hidden.bs.modal', () => {
      // The button that opened the dialog may have been redrawn: find it again by id.
      const target = (this.returnFocusId && byId(this.returnFocusId)) || document.querySelector('.page-title');
      target?.focus();
    });
    document.addEventListener('lifeos:languagechange', () => this.refreshTexts());
  },

  buildOptions() {
    const option = (value, key) => createEl('option', { value, 'data-i18n': key }, t(key));
    byId('task-category').append(
      option('', 'task.form.noCategory'),
      ...Object.keys(GOAL_CATEGORIES).map((category) => option(category, `category.${category}`))
    );
    byId('task-recurrence').append(...TASK_RECURRENCES.map((rule) => option(rule, `task.recurrence.${rule}`)));
    byId('task-period').append(...TASK_PERIODS.map((period) => option(period, `task.period.${period}`)));
    // Priority: three radio buttons shown as buttons
    TASK_PRIORITIES.forEach((priority) => {
      const id = `task-priority-${priority}`;
      byId('task-priority-list').append(
        createEl('input', { class: 'btn-check', type: 'radio', name: 'task-priority', id, value: priority }),
        createEl('label', { class: 'btn btn-tool', for: id, 'data-i18n': `task.priority.${priority}` }, t(`task.priority.${priority}`))
      );
    });
  },

  // Goal titles are user data: set with textContent. Archived goals are hidden,
  // except the one already linked to this task.
  fillGoalOptions(selectedId) {
    const goals = getGoals()
      .filter((goal) => goal.status !== 'archived' || goal.id === selectedId)
      .sort((a, b) => String(a.title).localeCompare(String(b.title), I18n.locale()));
    byId('task-goal').replaceChildren(
      createEl('option', { value: '', 'data-i18n': 'task.form.noGoal' }, t('task.form.noGoal')),
      ...goals.map((goal) => createEl('option', { value: goal.id }, goal.title))
    );
    byId('task-goal').value = goals.some((goal) => goal.id === selectedId) ? selectedId : '';
  },

  // open({ task }) edits a task; open({ defaults: { date, goalId, period } }) creates one.
  open({ task = null, defaults = {}, onSaved = null, returnFocusId = document.activeElement?.id } = {}) {
    this.ensureModal();
    setSaving(byId('task-form'), false); // a new dialog: the save button works again
    this.task = task;
    this.onSaved = onSaved;
    this.returnFocusId = returnFocusId || null;
    this.deleteArmed = false;

    const values = task ?? {
      date: Dates.toISO(Dates.today()), priority: 'medium', recurrence: 'none', period: 'day', ...defaults
    };
    ['task-title', 'task-date', 'task-goal'].forEach((id) => setFieldError(byId(id), null));
    byId('task-title').value = values.title ?? '';
    setDateValue(byId('task-date'), values.date ?? '');
    byId(`task-priority-${TASK_PRIORITIES.includes(values.priority) ? values.priority : 'medium'}`).checked = true;
    byId('task-category').value = values.category in GOAL_CATEGORIES ? values.category : '';
    byId('task-recurrence').value = TASK_RECURRENCES.includes(values.recurrence) ? values.recurrence : 'none';
    byId('task-period').value = TASK_PERIODS.includes(values.period) ? values.period : 'day';
    this.fillGoalOptions(values.goalId ?? null);

    byId('task-delete').hidden = !task;
    this.refreshTexts();
    bootstrap.Modal.getOrCreateInstance(this.modalEl).show();
  },

  refreshTexts() {
    byId('task-modal-title').textContent = t(this.task ? 'task.form.titleEdit' : 'task.form.titleCreate');
    byId('task-save').textContent = t(this.task ? 'task.form.save' : 'task.form.create');
    byId('task-delete-label').textContent = t(this.deleteArmed ? 'task.form.deleteConfirm' : 'task.form.delete');
  },

  readFields() {
    return {
      title: byId('task-title').value.trim(),
      date: getDateValue(byId('task-date')),
      priority: document.querySelector('input[name="task-priority"]:checked')?.value ?? 'medium',
      category: byId('task-category').value || null,
      goalId: byId('task-goal').value || null,
      recurrence: byId('task-recurrence').value,
      period: byId('task-period').value
    };
  },

  save() {
    const fields = this.readFields();
    const errors = validateTask(fields);
    setFieldError(byId('task-title'), errors.title);
    setFieldError(byId('task-date'), errors.date);
    setFieldError(byId('task-goal'), errors.goalId);
    if (errors.title || errors.date || errors.goalId) {
      byId('task-form').querySelector('.is-invalid').focus();
      return; // the dialog stays open, nothing typed is lost
    }
    const saved = this.task ? updateTask(this.task.id, fields) : addTask(fields);
    if (!saved) return; // the storage error toast is already shown
    showToast(this.task ? 'toast.taskUpdated' : 'toast.taskCreated', 'success');
    this.close();
  },

  remove() {
    if (!this.task) return;
    if (!this.deleteArmed) {
      this.deleteArmed = true; // first click only asks for confirmation
      this.refreshTexts();
      return;
    }
    if (!deleteTask(this.task.id)) return;
    showToast('toast.taskDeleted', 'success');
    this.close();
  },

  close() {
    bootstrap.Modal.getInstance(this.modalEl).hide();
    this.onSaved?.({});
  }
};
