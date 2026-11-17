// LifeOS — "My projects" on Goal Details: the project list of a "Projects" goal (docs/design/projects-cards.png).
// Its own file (like books.js): the cards, the filter, the ⋯ menu, the "New / Edit a project" dialog with its
// stages, deleting a project (with its tasks, "Undo" for 7 seconds). The data and the rules — app.js, "My projects".
// Project titles, results and stages are user data: always escapeHtml / textContent.
'use strict';

const PROJECT_FILTERS = ['all', 'active', 'planned', 'done'];
const PROJECT_STATUS_TONE = { planned: 'is-warning', active: 'is-accent', done: 'is-success' };

/* ---------- Markup ---------- */

// A field of the dialog in the look of the book dialog: one frame [grey icon | divider | field].
function projectFieldHtml({ id, icon, labelKey, control }) {
  return `
            <label class="visually-hidden" for="${id}" data-i18n="${labelKey}"></label>
            <div class="book-field">
              <span class="book-field-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
              ${control}
            </div>`;
}

function projectInputHtml(id, labelKey, extra) {
  return `<input class="form-control book-field-input" type="text" id="${id}" autocomplete="off" ${extra}
                       data-i18n-placeholder="${labelKey}" data-i18n-aria-label="${labelKey}">`;
}

// One icon as a radio button; the name is for screen readers and the hint.
function projectIconChoiceHtml(icon, id = `project-icon-${icon}`, current = false) {
  const mark = current ? ' data-current-icon' : '';
  return `
                <input class="btn-check" type="radio" name="project-icon" id="${id}" value="${icon}"${mark}>
                <label class="project-icon-choice" for="${id}" data-i18n-title="icon.${icon.slice(3)}"${mark}>
                  <i class="bi ${icon}" aria-hidden="true"></i><span class="visually-hidden" data-i18n="icon.${icon.slice(3)}"></span>
                </label>`;
}

// The project icons (app.js PROJECT_ICONS): one grid without groups.
function projectIconsHtml() {
  return `<div class="project-icon-grid" id="project-icon-grid">${PROJECT_ICONS.map((icon) => projectIconChoiceHtml(icon)).join('')}</div>`;
}

const PROJECT_DIALOG_HTML = `
  <div class="modal fade" id="project-modal" tabindex="-1" aria-labelledby="project-modal-title">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down book-modal project-modal">
      <form class="modal-content" id="project-form" novalidate>
        <div class="modal-header">
          <span class="book-modal-icon" aria-hidden="true"><i class="bi bi-layers"></i></span>
          <h2 class="modal-title fs-5" id="project-modal-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body book-fields">
          <div>
            ${projectFieldHtml({ id: 'project-title', icon: 'bi-folder', labelKey: 'projects.dialog.title',
              control: projectInputHtml('project-title', 'projects.dialog.title', `maxlength="${PROJECT_TEXT_MAX}"`) })}
            <p class="field-error" id="project-title-error"></p>
          </div>
          <div class="project-field-row">
            <div>
              ${projectFieldHtml({ id: 'project-status', icon: 'bi-circle-half', labelKey: 'projects.dialog.status',
                control: '<select class="form-select book-field-input" id="project-status" data-i18n-aria-label="projects.dialog.status"></select>' })}
            </div>
            <div>
              ${projectFieldHtml({ id: 'project-deadline', icon: 'bi-calendar', labelKey: 'projects.dialog.deadline',
                control: `<input class="form-control book-field-input" type="text" id="project-deadline" inputmode="numeric" maxlength="10" autocomplete="off"
                                 data-date-field data-i18n-placeholder="date.placeholder" data-i18n-aria-label="projects.dialog.deadline">` })}
              <p class="field-error" id="project-deadline-error"></p>
            </div>
          </div>
          <fieldset class="project-icons">
            <legend class="form-label" data-i18n="projects.dialog.icon"></legend>
            ${projectIconsHtml()}
          </fieldset>
          <fieldset class="project-stages">
            <legend class="form-label" data-i18n="projects.dialog.stages"></legend>
            <ol class="project-stage-list" id="project-stage-list"></ol>
            <div class="project-stage-add">
              ${projectFieldHtml({ id: 'project-stage-new', icon: 'bi-plus-lg', labelKey: 'projects.dialog.stageNew',
                control: projectInputHtml('project-stage-new', 'projects.dialog.stageNew', `maxlength="${PROJECT_STAGE_MAX}"`) })}
              <button type="button" class="btn btn-tool" id="project-stage-add"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i><span data-i18n="projects.dialog.stageAdd"></span></button>
            </div>
            <p class="field-error" id="project-stage-new-error"></p>
          </fieldset>
        </div>
        <div class="modal-footer book-modal-foot">
          <button type="button" class="btn btn-tool" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <button type="submit" class="btn btn-primary"><i class="bi bi-check2 me-2" aria-hidden="true"></i><span data-i18n="projects.dialog.save"></span></button>
        </div>
      </form>
    </div>
  </div>
  <div class="modal fade book-sheet" tabindex="-1" id="project-sheet" aria-labelledby="project-sheet-title">
    <div class="modal-dialog modal-dialog-centered book-sheet-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title" id="project-sheet-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body book-sheet-body">
          <button type="button" class="book-sheet-item" data-sheet-action="edit"><i class="bi bi-pencil" aria-hidden="true"></i><span data-i18n="projects.card.edit"></span></button>
          <button type="button" class="book-sheet-item is-danger" data-sheet-action="delete"><i class="bi bi-trash" aria-hidden="true"></i><span data-i18n="projects.card.delete"></span></button>
          <button type="button" class="btn btn-outline-primary book-sheet-cancel" data-bs-dismiss="modal"><span data-i18n="delete.cancel"></span></button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal fade" id="project-delete-modal" tabindex="-1" aria-labelledby="project-delete-title" aria-describedby="project-delete-text">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="project-delete-title" data-i18n="projects.delete.title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body">
          <p class="delete-goal-name" id="project-delete-name"></p>
          <p class="mb-0" id="project-delete-text" data-i18n="projects.delete.text"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-tool" id="project-delete-cancel" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <button type="button" class="btn btn-danger" id="project-delete-confirm">
            <i class="bi bi-trash me-1" aria-hidden="true"></i><span data-i18n="delete.confirm"></span>
          </button>
        </div>
      </div>
    </div>
  </div>`;

// "Next step" is a task (app.js projectNextStep): "Stage 2 of 4 · Design", "→ Make the home page layout · 20 Nov",
// "2 of 5 stage tasks". A stage without open tasks: "Add a task to the stage «…»" opens the project on that stage.
function projectNextHtml(project) {
  const next = projectNextStep(project, getTasks());
  if (next.kind === 'done') {
    return `<p class="project-card-finished"><i class="bi bi-check-circle-fill" aria-hidden="true"></i>${escapeHtml(t('projects.card.finished'))}</p>`;
  }
  const label = `<span class="project-card-label">${escapeHtml(t('projects.card.next'))}</span>`;
  if (next.kind === 'noStages' || next.kind === 'finish') {
    const text = t(next.kind === 'finish' ? 'projects.card.nextFinish' : 'projects.card.nextNoStages');
    return `
        <p class="project-card-next"><i class="bi bi-signpost-2" aria-hidden="true"></i><span>${label}<strong>${escapeHtml(text)}</strong></span></p>`;
  }
  const stageLine = t('projects.card.stageOf', { n: Format.number(next.number), total: Format.number(next.total), title: next.stage.title });
  const step = next.kind === 'task'
    ? `<span class="project-card-task"><i class="bi bi-arrow-right" aria-hidden="true"></i><span><strong>${escapeHtml(next.task.title)}</strong>${isIsoDate(next.task.date)
      ? ` · ${escapeHtml(projectDayText(next.task.date))}` : ''}</span></span>
          <span class="project-card-label">${escapeHtml(tPlural('projects.card.stageTasks', next.tasksTotal, { done: Format.number(next.tasksDone), total: Format.number(next.tasksTotal) }))}</span>`
    : `<button type="button" class="project-card-add-task" data-project-open-stage="${escapeHtml(project.id)}" data-stage-id="${escapeHtml(next.stage.id)}">
            <i class="bi bi-plus-lg" aria-hidden="true"></i>${escapeHtml(t('projects.card.addTaskTo', { title: next.stage.title }))}</button>`;
  return `
        <div class="project-card-next">
          <i class="bi bi-signpost-2" aria-hidden="true"></i>
          <span>${label}<span class="project-card-stage">${escapeHtml(stageLine)}</span>${step}</span>
        </div>`;
}

function projectMenuHtml(project) {
  const label = t('projects.card.menu', { title: projectTitle(project) });
  const item = (action, icon, key, extra = '') => `
        <li><button type="button" class="dropdown-item ${extra}" data-project-action="${action}" data-project-id="${escapeHtml(project.id)}">
          <i class="bi ${icon} me-2" aria-hidden="true"></i>${escapeHtml(t(key))}
        </button></li>`;
  return `
      <div class="dropdown project-card-menu">
        <button type="button" class="btn btn-icon" data-bs-toggle="dropdown" data-project-menu="${escapeHtml(project.id)}" aria-expanded="false"
                aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
          <i class="bi bi-three-dots" aria-hidden="true"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          ${item('edit', 'bi-pencil', 'projects.card.edit')}
          <li><hr class="dropdown-divider"></li>
          ${item('delete', 'bi-trash', 'projects.card.delete', 'text-danger')}
        </ul>
      </div>`;
}

// A card: the icon and ⋯, the title, the status, "Stages: 2 of 5" with a bar, the next step, the deadline,
// "Expand ▾" ("Collapse ▴" while its details are open, 1.6.5).
function projectCardHtml(project, expanded = false) {
  const id = escapeHtml(project.id);
  const { done, total } = projectStageCount(project);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const deadline = project.deadline ? t('projects.card.deadline', { date: Format.shortDate(project.deadline) }) : t('projects.card.noDeadline');
  const title = projectTitle(project);
  return `
    <li class="project-card${expanded ? ' is-expanded' : ''}" data-project-card="${id}" data-status="${escapeHtml(project.status)}">
      <div class="project-card-head">
        <span class="project-card-icon" aria-hidden="true"><i class="bi ${escapeHtml(projectIcon(project.icon))}"></i></span>
        <div class="project-card-heading">
          <h3 class="project-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
          <span class="badge-status ${PROJECT_STATUS_TONE[project.status] ?? ''}">${escapeHtml(t(`projects.status.${project.status}`))}</span>
        </div>
        ${projectMenuHtml(project)}
      </div>
      <p class="project-card-stages">${escapeHtml(t('projects.card.stages', { done: Format.number(done), total: Format.number(total) }))}</p>
      <span class="project-card-bar" aria-hidden="true"><span style="width: ${percent}%"></span></span>
      <div class="project-card-body">
        ${projectNextHtml(project)}
        <p class="project-card-deadline"><i class="bi bi-calendar" aria-hidden="true"></i>${escapeHtml(deadline)}</p>
      </div>
      <button type="button" class="btn btn-tool project-card-expand${expanded ? ' is-open' : ''}" data-project-expand="${id}"
              aria-expanded="${expanded}" ${expanded ? 'aria-controls="project-detail"' : ''}
              aria-label="${escapeHtml(`${t(expanded ? 'projects.card.collapse' : 'projects.card.expand')}: ${title}`)}">
        <span>${escapeHtml(t(expanded ? 'projects.card.collapse' : 'projects.card.expand'))}</span><i class="bi bi-chevron-down" aria-hidden="true"></i>
      </button>
    </li>`;
}

// No project yet: a dashed card "+ Add your first project".
function emptyProjectsHtml() {
  return `
    <li class="project-card is-placeholder">
      <button type="button" class="project-card-first" data-project-add-first>
        <i class="bi bi-plus-lg" aria-hidden="true"></i><span>${escapeHtml(t('projects.addFirst'))}</span>
      </button>
    </li>`;
}

/* ---------- The details of a project (1.6.5) ----------
   A computer — the panel under the row of cards (docs/design/project-details.png): the head, the stages on the
   left, the tasks of the chosen stage on the right. A phone — a full-screen window (docs/design/project-mobile-v2.png):
   the head card, "Project plan" with the stages as cards of an accordion (the tasks open inside the stage), the finish card.
   User texts (titles, results, task titles) are escaped. */

// "20 Nov" — a day of this year; "20.11.2027" — of another year. Kazakh has no short month names
// in every browser, so it gets the whole one: "20 қараша".
function projectDayText(iso) {
  if (iso.slice(0, 4) !== Dates.toISO(Dates.today()).slice(0, 4)) return Format.shortDate(iso);
  return Format.date(iso, { day: 'numeric', month: I18n.lang === 'kk' ? 'long' : 'short' });
}

// The circle of a stage: done — a green tick, the current one — the accent, the next ones — empty.
function stageStateIcon(stage, current) {
  if (stage.done) return 'bi-check-circle-fill';
  return current ? 'bi-record-circle' : 'bi-circle';
}

// The invisible native calendar over a button or a chip (works in Safari on iPhone too).
function nativeDateHtml(attribute, value, label) {
  return `<input type="date" class="date-native" ${attribute} value="${escapeHtml(value ?? '')}" aria-label="${escapeHtml(label)}">`;
}

// A task of the stage. Computer: the checkbox, the title, the date on the right and the calendar button.
// Phone: under the title a chip "📅 Set a date" (or the date) that opens the calendar.
function stageTaskHtml(task, mode) {
  const id = escapeHtml(task.id);
  const hasDate = isIsoDate(task.date);
  const dateLabel = t('projects.detail.taskDateOf', { title: task.title });
  const dateInput = nativeDateHtml(`data-pd-task-date="${id}"`, task.date, dateLabel);
  const head = `
            <input class="form-check-input" type="checkbox" id="pd-task-${id}" data-pd-task-toggle="${id}"${task.completed ? ' checked' : ''}>`;
  const title = `<label class="pd-task-title" for="pd-task-${id}">${escapeHtml(task.title)}</label>`;
  if (mode === 'sheet') {
    return `
          <li class="pd-task${task.completed ? ' is-done' : ''}">${head}
            <div class="pd-task-main">
              ${title}
              <span class="pd-date-chip${hasDate ? ' has-date' : ''}">
                <i class="bi bi-calendar3" aria-hidden="true"></i><span>${escapeHtml(hasDate ? projectDayText(task.date) : t('projects.detail.setDate'))}</span>
                ${dateInput}
              </span>
            </div>
          </li>`;
  }
  return `
          <li class="pd-task${task.completed ? ' is-done' : ''}">${head}
            ${title}
            <span class="pd-task-date">${escapeHtml(hasDate ? Format.shortDate(task.date) : t('projects.detail.taskNoDate'))}</span>
            <span class="btn btn-icon pd-date-button" title="${escapeHtml(dateLabel)}"><i class="bi bi-calendar3" aria-hidden="true"></i>${dateInput}</span>
          </li>`;
}

// The tasks of a stage, "+ Add a task" (a row: the title and the date, Enter saves) and the hint.
function stageTasksHtml(project, stage, adding, mode) {
  const tasks = projectStageTasks(project.id, stage.id);
  const list = tasks.length
    ? `<ul class="pd-task-list">${tasks.map((task) => stageTaskHtml(task, mode)).join('')}</ul>`
    : `<p class="pd-empty">${escapeHtml(t('projects.detail.noTasks'))}</p>`;
  const add = adding
    ? `<form class="pd-add-row pd-task-add" data-pd-task-add novalidate>
          <label class="visually-hidden" for="pd-task-new">${escapeHtml(t('projects.detail.taskNew'))}</label>
          <input class="form-control" type="text" id="pd-task-new" maxlength="${TASK_TITLE_MAX_LENGTH}" autocomplete="off" placeholder="${escapeHtml(t('projects.detail.taskNew'))}">
          <label class="visually-hidden" for="pd-task-new-date">${escapeHtml(t('projects.detail.taskDate'))}</label>
          <input class="form-control pd-task-new-date" type="text" id="pd-task-new-date" inputmode="numeric" maxlength="10" autocomplete="off" data-date-field
                 placeholder="${escapeHtml(t('date.placeholder'))}">
          <button type="submit" class="btn btn-primary">${escapeHtml(t('projects.detail.taskSave'))}</button>
          <p class="field-error" id="pd-task-new-error"></p>
          <p class="field-error" id="pd-task-new-date-error"></p>
        </form>`
    : `<button type="button" class="btn ${mode === 'sheet' ? 'btn-outline-primary' : 'btn-tool'} pd-add-button" data-pd-task-open><i class="bi bi-plus-lg me-2" aria-hidden="true"></i>${escapeHtml(t('projects.detail.addTask'))}</button>`;
  return `
        ${list}
        ${add}
        <p class="pd-hint"><i class="bi bi-info-circle" aria-hidden="true"></i>${escapeHtml(t('projects.detail.plannerHint'))}</p>`;
}

// ⋮ of a stage: Rename / Delete. "static": the menu opens right under the button, also inside the phone window.
function stageMenuHtml(stage) {
  const id = escapeHtml(stage.id);
  const label = t('projects.detail.stageMenu', { title: stage.title });
  return `
            <div class="dropdown pd-stage-menu">
              <button type="button" class="btn btn-icon" data-bs-toggle="dropdown" data-bs-display="static" aria-expanded="false"
                      data-pd-stage-menu="${id}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
                <i class="bi bi-three-dots-vertical" aria-hidden="true"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><button type="button" class="dropdown-item" data-pd-stage-rename="${id}"><i class="bi bi-pencil me-2" aria-hidden="true"></i>${escapeHtml(t('projects.detail.rename'))}</button></li>
                <li><button type="button" class="dropdown-item text-danger" data-pd-stage-delete="${id}"><i class="bi bi-trash me-2" aria-hidden="true"></i>${escapeHtml(t('projects.detail.delete'))}</button></li>
              </ul>
            </div>`;
}

// "Rename": the title right in the row (Enter saves, Esc cancels).
function stageRenameHtml(stage) {
  return `
            <form class="pd-rename-row" data-pd-stage-rename-form="${escapeHtml(stage.id)}" novalidate>
              <label class="visually-hidden" for="pd-stage-rename">${escapeHtml(t('projects.detail.renameLabel'))}</label>
              <input class="form-control" type="text" id="pd-stage-rename" value="${escapeHtml(stage.title)}" maxlength="${PROJECT_STAGE_MAX}" autocomplete="off">
              <button type="submit" class="btn btn-primary">${escapeHtml(t('projects.dialog.save'))}</button>
              <p class="field-error" id="pd-stage-rename-error"></p>
            </form>`;
}

// Under the title of a stage on a phone: "1 of 3 tasks" or "No tasks yet".
function stageSubtitle(project, stage) {
  const tasks = projectStageTasks(project.id, stage.id);
  if (!tasks.length) return t('projects.detail.stageNoTasks');
  const done = tasks.filter((task) => task.completed).length;
  return tPlural('projects.detail.stageTasks', tasks.length, { done: Format.number(done), total: Format.number(tasks.length) });
}

function stageRowHtml(project, stage, { current, selected, mode, state }) {
  const id = escapeHtml(stage.id);
  const doneLabel = t('projects.detail.stageDone', { title: stage.title });
  const open = mode === 'sheet' && selected;
  const name = state.renamingStageId === stage.id ? stageRenameHtml(stage) : `
            <button type="button" class="pd-stage-name" data-pd-stage-select="${id}" ${mode === 'sheet' ? `aria-expanded="${open}"` : `aria-pressed="${selected}"`}>
              <span class="pd-stage-text">
                <span class="pd-stage-title">${escapeHtml(stage.title)}</span>
                ${mode === 'sheet' ? `<span class="pd-stage-sub">${escapeHtml(stageSubtitle(project, stage))}</span>` : ''}
              </span>
              <i class="bi ${mode === 'sheet' ? 'bi-chevron-down' : 'bi-chevron-right'}" aria-hidden="true"></i>
            </button>`;
  return `
        <li class="pd-stage${stage.done ? ' is-done' : ''}${current ? ' is-current' : ''}${selected ? ' is-selected' : ''}${open ? ' is-open' : ''}">
          <div class="pd-stage-row">
            <button type="button" class="pd-stage-check" role="checkbox" aria-checked="${stage.done}" data-pd-stage-done="${id}"
                    aria-label="${escapeHtml(doneLabel)}" title="${escapeHtml(doneLabel)}">
              <i class="bi ${stageStateIcon(stage, current)}" aria-hidden="true"></i>
            </button>
            ${name}
            ${stageMenuHtml(stage)}
          </div>
          ${open ? `<div class="pd-stage-tasks">${stageTasksHtml(project, stage, state.addingTask, mode)}</div>` : ''}
        </li>`;
}

function stageListHtml(project, state, mode) {
  const stages = projectStages(project);
  const current = projectCurrentStage(project);
  const rows = stages.map((stage) => stageRowHtml(project, stage, {
    current: stage.id === current?.id, selected: stage.id === state.selectedStageId, mode, state
  })).join('');
  const add = state.addingStage
    ? `<form class="pd-add-row" data-pd-stage-add novalidate>
          <label class="visually-hidden" for="pd-stage-new">${escapeHtml(t('projects.dialog.stageNew'))}</label>
          <input class="form-control" type="text" id="pd-stage-new" maxlength="${PROJECT_STAGE_MAX}" autocomplete="off" placeholder="${escapeHtml(t('projects.dialog.stageNew'))}">
          <button type="submit" class="btn btn-primary">${escapeHtml(t('projects.detail.taskSave'))}</button>
          <p class="field-error" id="pd-stage-new-error"></p>
        </form>`
    : `<button type="button" class="btn ${mode === 'sheet' ? 'btn-outline-primary' : 'btn-tool'} pd-add-button" data-pd-stage-open><i class="bi bi-plus-lg me-2" aria-hidden="true"></i>${escapeHtml(t('projects.dialog.stageAdd'))}</button>`;
  return `
        ${stages.length ? `<ol class="pd-stage-list">${rows}</ol>` : ''}
        ${add}`;
}

function statusSelectHtml(project, id) {
  const options = PROJECT_STATUSES.map((status) => `<option value="${status}"${status === project.status ? ' selected' : ''}>${escapeHtml(t(`projects.status.${status}`))}</option>`).join('');
  return `<select class="form-select pd-status" id="${id}" data-pd-status data-status="${escapeHtml(project.status)}"${id === 'pd-status-panel'
    ? ` aria-label="${escapeHtml(t('projects.detail.status'))}"` : ''}>${options}</select>`;
}

function projectIconHtml(project) {
  return `<span class="pd-icon" aria-hidden="true"><i class="bi ${escapeHtml(projectIcon(project.icon))}"></i></span>`;
}

// The finished project: "Project finished 17.11.2026 ✓".
function projectFinishedHtml(project) {
  return `<p class="pd-finished"><i class="bi bi-check-circle-fill" aria-hidden="true"></i>${escapeHtml(project.doneAt
    ? t('projects.detail.finished', { date: Format.shortDate(project.doneAt) }) : t('projects.card.finished'))}</p>`;
}

/* ----- Computer: the panel ----- */

function projectPanelHtml(project, state) {
  const deadline = project.deadline ? Format.shortDate(project.deadline) : t('projects.card.noDeadline');
  const selected = projectStages(project).find((stage) => stage.id === state.selectedStageId) ?? null;
  return `
    <div class="pd-head">
      ${projectIconHtml(project)}
      <div class="pd-title-block">
        <h3 class="pd-title" id="project-detail-title" tabindex="-1">${escapeHtml(projectTitle(project))}</h3>
      </div>
      <div class="pd-controls">
        ${statusSelectHtml(project, 'pd-status-panel')}
        <span class="btn btn-tool pd-deadline" title="${escapeHtml(t('projects.detail.deadline'))}">
          <i class="bi bi-calendar3" aria-hidden="true"></i><span>${escapeHtml(deadline)}</span>
          ${nativeDateHtml('data-pd-deadline', project.deadline, t('projects.detail.deadline'))}
        </span>
        <button type="button" class="btn btn-icon pd-edit" data-pd-edit aria-label="${escapeHtml(t('projects.dialog.editTitle'))}" title="${escapeHtml(t('projects.dialog.editTitle'))}">
          <i class="bi bi-pencil" aria-hidden="true"></i>
        </button>
      </div>
    </div>
    <div class="pd-body">
      <section class="pd-card pd-stages" aria-labelledby="pd-stages-title">
        <h4 class="pd-card-title" id="pd-stages-title"><i class="bi bi-layers" aria-hidden="true"></i>${escapeHtml(t('projects.detail.stages'))}</h4>
        ${stageListHtml(project, state, 'panel')}
      </section>
      <section class="pd-card pd-tasks" aria-labelledby="pd-tasks-title">
        <h4 class="pd-card-title" id="pd-tasks-title"><i class="bi bi-list-check" aria-hidden="true"></i>${escapeHtml(selected
          ? t('projects.detail.tasksOf', { title: selected.title }) : t('projects.detail.noStage'))}</h4>
        ${selected ? stageTasksHtml(project, selected, state.addingTask, 'panel') : ''}
      </section>
    </div>
    <div class="pd-foot">${project.status === 'done' ? projectFinishedHtml(project) : `
      <button type="button" class="btn btn-tool pd-finish" data-pd-finish><i class="bi bi-check2 me-2" aria-hidden="true"></i>${escapeHtml(t('projects.detail.finish'))}</button>
      <span class="pd-finish-note">${escapeHtml(t('projects.detail.finishNote'))}</span>`}
    </div>`;
}

/* ----- Phone: the full-screen window ----- */

function projectSheetHtml(project, state) {
  const { done, total } = projectStageCount(project);
  const percent = total ? Math.round((done / total) * 100) : 0;
  const stagesText = t('projects.card.stages', { done: Format.number(done), total: Format.number(total) });
  return `
    <section class="pd-card pd-sheet-head" aria-labelledby="project-detail-title">
      <div class="pd-sheet-title-row">
        ${projectIconHtml(project)}
        <div class="pd-title-block">
          <h2 class="pd-title" id="project-detail-title" tabindex="-1">${escapeHtml(projectTitle(project))}</h2>
        </div>
        <button type="button" class="btn btn-tool pd-edit-text" data-pd-edit aria-label="${escapeHtml(t('projects.dialog.editTitle'))}">
          <i class="bi bi-pencil me-1" aria-hidden="true"></i>${escapeHtml(t('projects.detail.edit'))}
        </button>
      </div>
      <div class="pd-sheet-fields">
        <div class="pd-field">
          <label class="pd-field-label" for="pd-status-sheet">${escapeHtml(t('projects.detail.statusLabel'))}</label>
          ${statusSelectHtml(project, 'pd-status-sheet')}
        </div>
        <div class="pd-field">
          <span class="pd-field-label" aria-hidden="true">${escapeHtml(t('projects.detail.deadline'))}</span>
          <span class="btn btn-tool pd-deadline${project.deadline ? '' : ' is-empty'}">
            <i class="bi bi-calendar3" aria-hidden="true"></i><span>${escapeHtml(project.deadline ? projectDayText(project.deadline) : t('projects.detail.noDeadline'))}</span>
            <i class="bi bi-chevron-down pd-deadline-arrow" aria-hidden="true"></i>
            ${nativeDateHtml('data-pd-deadline', project.deadline, t('projects.detail.deadline'))}
          </span>
        </div>
      </div>
      <div class="pd-sheet-progress">
        <span>${escapeHtml(stagesText)}</span>
        <span class="project-card-bar" aria-hidden="true"><span style="width: ${percent}%"></span></span>
      </div>
    </section>
    <section class="pd-card pd-plan" aria-labelledby="pd-plan-title">
      <div class="pd-plan-head">
        <h3 class="pd-card-title" id="pd-plan-title"><i class="bi bi-layers" aria-hidden="true"></i>${escapeHtml(t('projects.detail.plan'))}</h3>
        <div class="pd-help">
          <button type="button" class="pd-help-button" data-pd-help aria-expanded="false" aria-controls="pd-plan-help"
                  aria-label="${escapeHtml(t('projects.detail.planHelp'))}">?</button>
          <p class="pd-help-bubble" id="pd-plan-help" role="tooltip">${escapeHtml(t('projects.detail.planHint'))}</p>
        </div>
      </div>
      ${stageListHtml(project, state, 'sheet')}
    </section>
    <section class="pd-card pd-sheet-finish">${project.status === 'done' ? projectFinishedHtml(project) : `
      <button type="button" class="btn btn-primary pd-finish-main" data-pd-finish><i class="bi bi-check2 me-2" aria-hidden="true"></i>${escapeHtml(t('projects.detail.finish'))}</button>
      <p class="pd-finish-hint">${escapeHtml(t('projects.detail.finishHint'))}</p>`}
    </section>`;
}

// state: { selectedStageId, addingStage, addingTask, renamingStageId }; mode: "panel" | "sheet".
function projectDetailHtml(project, state, mode) {
  return mode === 'sheet' ? projectSheetHtml(project, state) : projectPanelHtml(project, state);
}

const PROJECT_DETAIL_HTML = `
  <div class="modal fade" id="project-detail-modal" tabindex="-1" aria-labelledby="project-detail-title">
    <div class="modal-dialog modal-fullscreen project-detail-dialog">
      <div class="modal-content">
        <div class="modal-header pd-sheet-top">
          <button type="button" class="btn btn-tool pd-back" data-bs-dismiss="modal">
            <i class="bi bi-arrow-left me-2" aria-hidden="true"></i><span data-i18n="projects.detail.back"></span>
          </button>
        </div>
        <div class="modal-body project-detail is-sheet" id="project-detail-sheet"></div>
      </div>
    </div>
  </div>
  <div class="modal fade" id="project-confirm-modal" tabindex="-1" aria-labelledby="project-confirm-title" aria-describedby="project-confirm-text">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="project-confirm-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body">
          <p class="delete-goal-name" id="project-confirm-name"></p>
          <p class="mb-0" id="project-confirm-text"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-tool" id="project-confirm-cancel" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <button type="button" class="btn" id="project-confirm-ok"></button>
        </div>
      </div>
    </div>
  </div>`;

/* ---------- The block ---------- */

const ProjectList = {
  goalId: null,
  filter: 'all',
  editingId: null, // the project in the dialog (null = a new one)
  deletingId: null,
  stages: [], // the stages being edited in the dialog
  opener: null, // the focus goes back here when a dialog closes
  pendingRender: false,
  expandedId: null, // the project open under its row (computer, tablet)
  windowId: null, // the project open on the whole screen (phone)
  detail: { selectedStageId: null, addingStage: false, addingTask: false, renamingStageId: null },
  windowFocus: null, // a phone: the element focused when the window is shown (the title by default)
  focusKey: null, // after a redraw the focus goes back to this element of the details
  returnToWindow: null, // a phone: the project window comes back after a dialog

  goal() {
    return getGoalById(this.goalId);
  },

  // Called by renderDetailsPage (goal-details.js) on every change of the goal.
  render(goal) {
    const panel = byId('projects-panel');
    if (!panel) return;
    panel.hidden = !hasProjectList(goal);
    if (panel.hidden) return;
    if (this.menuOpen()) {
      this.pendingRender = true; // drawn again when the menu closes
      return;
    }
    this.pendingRender = false;
    this.goalId = goal.id;
    const projects = goalProjects(goal);
    this.renderFilter(projects);
    const old = byId('project-detail'); // where the open panel was: its tail may slide from there
    this.lastPanel = old && this.expandedId ? { rowEnd: old.dataset.rowEnd ?? null, tail: old.style.getPropertyValue('--tail-x') } : null;
    this.removePanel();
    this.renderList(projects);
    if (this.expandedId && !this.isPhone()) this.placePanel(this.animateNext);
    this.animateNext = false;
    if (this.windowId && byId('project-detail-modal')?.classList.contains('show')) this.renderWindow();
  },

  renderFilter(projects) {
    const count = (filter) => (filter === 'all' ? projects.length : projects.filter((project) => project.status === filter).length);
    byId('projects-filter').innerHTML = PROJECT_FILTERS.map((filter) => `
      <button type="button" class="segmented-btn" data-project-filter="${filter}" aria-pressed="${filter === this.filter}">
        ${escapeHtml(t(`projects.filter.${filter}`))} <span class="tab-count">${escapeHtml(Format.number(count(filter)))}</span>
      </button>`).join('');
  },

  renderList(projects) {
    const shown = filteredProjects(projects, this.filter);
    byId('projects-list').innerHTML = projects.length
      ? shown.map((project) => projectCardHtml(project, project.id === this.expandedId)).join('') : emptyProjectsHtml();
    const empty = byId('projects-empty'); // "No projects here" for a filter without projects
    empty.hidden = !projects.length || shown.length > 0;
    empty.querySelector('span').textContent = t('projects.empty.filter');
  },

  menuOpen() {
    return Boolean(document.querySelector('.projects-list .dropdown-menu.show, #project-detail .dropdown-menu.show'))
      || Boolean(byId('project-sheet')?.classList.contains('show'));
  },

  renderIfPending() {
    if (this.pendingRender && !this.menuOpen()) this.render(this.goal());
  },

  /* ----- ⋯: a dropdown with a mouse, a small window in the middle on a touch screen (as for a book) ----- */

  closeOtherMenus(toggle) {
    document.querySelectorAll('.projects-list [data-project-menu].show').forEach((other) => {
      if (other !== toggle) bootstrap.Dropdown.getInstance(other)?.hide();
    });
  },

  catchTouchMenu(event) {
    const toggle = event.target.closest?.('.projects-list [data-project-menu]');
    if (!toggle || !window.matchMedia('(pointer: coarse)').matches) return;
    event.preventDefault();
    event.stopPropagation();
    this.openSheet(toggle.dataset.projectMenu, toggle);
  },

  openSheet(projectId, opener) {
    const project = goalProjects(this.goal()).find((item) => item.id === projectId);
    if (!project || !window.bootstrap) return;
    this.ensureDialogs();
    this.sheetProjectId = projectId;
    this.sheetAction = null;
    this.opener = opener;
    byId('project-sheet-title').textContent = projectTitle(project);
    bootstrap.Modal.getOrCreateInstance(byId('project-sheet')).show();
  },

  // A row of the window: it closes first, then the action (a dialog never opens over it).
  onSheetHidden() {
    const action = this.sheetAction;
    this.sheetAction = null;
    if (action) this.runAction(action, this.sheetProjectId, this.opener);
    else this.opener?.focus();
    this.renderIfPending();
  },

  runAction(action, projectId, opener) {
    if (action === 'edit') this.openDialog(projectId, opener);
    if (action === 'delete') this.askDelete(projectId, opener);
  },

  /* ----- "New / Edit a project" ----- */

  ensureDialogs() {
    if (byId('project-modal')) return;
    document.body.insertAdjacentHTML('beforeend', PROJECT_DIALOG_HTML + PROJECT_DETAIL_HTML);
    ['project-modal', 'project-sheet', 'project-delete-modal', 'project-detail-modal', 'project-confirm-modal'].forEach((id) => I18n.apply(byId(id)));
    const sheet = byId('project-detail-sheet');
    sheet.addEventListener('click', (event) => this.onDetailClick(event));
    sheet.addEventListener('change', (event) => this.onDetailChange(event));
    sheet.addEventListener('submit', (event) => this.onDetailSubmit(event));
    sheet.addEventListener('keydown', (event) => this.onDetailKeydown(event));
    byId('project-detail-modal').addEventListener('hidden.bs.modal', () => this.onDetailWindowHidden());
    byId('project-detail-modal').addEventListener('shown.bs.modal', () => {
      const target = this.windowFocus ? byId('project-detail-sheet').querySelector(this.windowFocus) : null;
      this.windowFocus = null;
      (target ?? byId('project-detail-title'))?.focus();
    });
    byId('project-confirm-ok').addEventListener('click', () => {
      this.confirmed = true;
      bootstrap.Modal.getInstance(byId('project-confirm-modal')).hide();
    });
    byId('project-confirm-modal').addEventListener('shown.bs.modal', () => byId('project-confirm-cancel').focus());
    byId('project-confirm-modal').addEventListener('hidden.bs.modal', () => this.onConfirmHidden());
    byId('project-form').addEventListener('submit', submitOnce((event) => this.saveDialog(event)));
    byId('project-delete-confirm').addEventListener('click', () => this.confirmDelete());
    byId('project-modal').addEventListener('shown.bs.modal', () => byId('project-title').focus());
    byId('project-delete-modal').addEventListener('shown.bs.modal', () => byId('project-delete-cancel').focus());
    byId('project-sheet').addEventListener('shown.bs.modal', () => byId('project-sheet').querySelector('.book-sheet-item')?.focus());
    byId('project-sheet').addEventListener('hidden.bs.modal', () => this.onSheetHidden());
    byId('project-sheet').addEventListener('click', (event) => {
      const row = event.target.closest('[data-sheet-action]');
      if (!row) return;
      this.sheetAction = row.dataset.sheetAction;
      bootstrap.Modal.getInstance(byId('project-sheet')).hide();
    });
    ['project-modal', 'project-delete-modal'].forEach((id) => byId(id).addEventListener('hidden.bs.modal', () => this.restoreFocus()));
    // The error "Enter the project title" goes away as soon as a title is typed
    byId('project-title').addEventListener('input', (event) => {
      if (event.target.value.trim()) setFieldError(event.target, null);
    });
    this.bindStages();
  },

  restoreFocus() {
    if (this.backToWindow()) return; // a phone: the project window comes back
    const target = this.opener?.isConnected ? this.opener : byId('project-add');
    target?.focus();
  },

  openDialog(projectId = null, opener = null) {
    if (!window.bootstrap) return;
    this.ensureDialogs();
    this.editingId = projectId;
    this.opener = opener;
    const project = projectId ? goalProjects(this.goal()).find((item) => item.id === projectId) : null;
    const heading = byId('project-modal-title');
    heading.dataset.i18n = project ? 'projects.dialog.editTitle' : 'projects.dialog.addTitle';
    heading.textContent = t(heading.dataset.i18n);
    byId('project-title').value = project?.title ?? '';
    setDateValue(byId('project-deadline'), project?.deadline ?? '');
    const status = byId('project-status');
    status.replaceChildren(...PROJECT_STATUSES.map((value) => createEl('option', { value }, t(`projects.status.${value}`))));
    status.value = project?.status ?? 'active'; // a new project: usually the one being started
    const radio = this.renderCurrentIcon(projectIcon(project?.icon)); // a new project: the folder
    if (radio) radio.checked = true;
    this.stages = projectStages(project).map((stage) => ({ ...stage }));
    byId('project-stage-new').value = '';
    ['project-title', 'project-deadline', 'project-stage-new'].forEach((id) => setFieldError(byId(id), null));
    this.renderStages();
    bootstrap.Modal.getOrCreateInstance(byId('project-modal')).show();
  },

  // An icon chosen before 1.6.5 that is not a project icon: it goes first in the grid, so saving keeps it.
  renderCurrentIcon(icon) {
    const grid = byId('project-icon-grid');
    grid.querySelectorAll('[data-current-icon]').forEach((element) => element.remove());
    if (PROJECT_ICONS.includes(icon)) return byId(`project-icon-${icon}`);
    grid.insertAdjacentHTML('afterbegin', projectIconChoiceHtml(icon, 'project-icon-current-choice', true));
    I18n.apply(grid);
    return byId('project-icon-current-choice');
  },

  /* ----- The stages of the dialog: add, rename (right in the row), delete, ↑ ↓ ----- */

  renderStages(focus = null) {
    const list = byId('project-stage-list');
    list.innerHTML = this.stages.map((stage, index) => {
      const name = stage.title || t('projects.dialog.stageName', { n: index + 1 });
      const button = (action, icon, key, disabled) => `
            <button type="button" class="btn btn-icon" data-stage-${action}="${index}" ${disabled ? 'disabled' : ''}
                    aria-label="${escapeHtml(t(key, { title: name }))}" title="${escapeHtml(t(key, { title: name }))}">
              <i class="bi ${icon}" aria-hidden="true"></i>
            </button>`;
      return `
        <li class="project-stage${stage.done ? ' is-done' : ''}">
          <span class="project-stage-number" aria-hidden="true">${stage.done ? '<i class="bi bi-check-lg"></i>' : index + 1}</span>
          <input class="form-control" type="text" value="${escapeHtml(stage.title)}" maxlength="${PROJECT_STAGE_MAX}" autocomplete="off"
                 data-stage-title="${index}" aria-label="${escapeHtml(t('projects.dialog.stageName', { n: index + 1 }))}">
          <span class="project-stage-tools">
            ${button('up', 'bi-arrow-up', 'projects.dialog.stageUp', index === 0)}
            ${button('down', 'bi-arrow-down', 'projects.dialog.stageDown', index === this.stages.length - 1)}
            ${this.stageHasTasks(stage) ? `<button type="button" class="btn btn-icon" disabled
                    aria-label="${escapeHtml(t('projects.dialog.stageHasTasks'))}" title="${escapeHtml(t('projects.dialog.stageHasTasks'))}">
              <i class="bi bi-x-lg" aria-hidden="true"></i></button>` : button('delete', 'bi-x-lg', 'projects.dialog.stageDelete', false)}
          </span>
        </li>`;
    }).join('');
    if (focus) list.querySelector(focus)?.focus();
  },

  // A saved stage with tasks: its ✕ is off in the dialog (the details ask about the tasks and offer "Undo").
  stageHasTasks(stage) {
    return Boolean(this.editingId) && projectStageTasks(this.editingId, stage.id).length > 0;
  },

  addStage() {
    const input = byId('project-stage-new');
    const title = input.value.trim();
    let error = title ? null : 'projects.error.stage';
    if (!error && this.stages.length >= PROJECT_STAGES_LIMIT) error = 'projects.error.stagesLimit';
    setFieldError(input, error);
    if (error) {
      input.focus();
      return;
    }
    this.stages.push({ id: createId('stage'), title, done: false, doneAt: null });
    input.value = '';
    this.renderStages();
    input.focus();
  },

  // ↑ ↓ ✕ of a row; the focus stays on the same button of the moved stage (or on the field after ✕).
  onStageClick(event) {
    const button = event.target.closest('[data-stage-up], [data-stage-down], [data-stage-delete]');
    if (!button) return;
    const index = Number(button.dataset.stageUp ?? button.dataset.stageDown ?? button.dataset.stageDelete);
    if ('stageDelete' in button.dataset) {
      this.stages.splice(index, 1);
      this.renderStages();
      byId('project-stage-new').focus();
      return;
    }
    const to = 'stageUp' in button.dataset ? index - 1 : index + 1;
    [this.stages[index], this.stages[to]] = [this.stages[to], this.stages[index]];
    const action = 'stageUp' in button.dataset ? 'up' : 'down';
    const disabledThere = (action === 'up' && to === 0) || (action === 'down' && to === this.stages.length - 1);
    this.renderStages(`[data-stage-${disabledThere ? (action === 'up' ? 'down' : 'up') : action}="${to}"]`);
  },

  bindStages() {
    byId('project-stage-add').addEventListener('click', () => this.addStage());
    byId('project-stage-new').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault(); // Enter adds the stage, it does not save the dialog
      this.addStage();
    });
    byId('project-stage-list').addEventListener('click', (event) => this.onStageClick(event));
    byId('project-stage-list').addEventListener('input', (event) => {
      const input = event.target.closest('[data-stage-title]');
      if (input) this.stages[Number(input.dataset.stageTitle)].title = input.value;
    });
  },

  // The title is needed; the deadline is empty or a real date. A stage left with an empty name is dropped.
  readDialog() {
    const title = byId('project-title').value.trim();
    const deadlineInput = byId('project-deadline');
    const deadline = getDateValue(deadlineInput);
    const deadlineError = deadlineInput.value.trim() && !deadline ? 'profile.error.dateInvalid' : null;
    const errors = new Map([[byId('project-title'), title ? null : 'projects.error.title'], [deadlineInput, deadlineError]]);
    errors.forEach((key, input) => setFieldError(input, key));
    if ([...errors.values()].some(Boolean)) return null;
    return {
      title,
      status: byId('project-status').value,
      deadline: deadline || null,
      icon: byId('project-form').querySelector('[name="project-icon"]:checked')?.value ?? PROJECT_DEFAULT_ICON,
      stages: this.stages.map((stage) => ({ ...stage, title: stage.title.trim() })).filter((stage) => stage.title)
    };
  },

  saveDialog(event) {
    event.preventDefault();
    const fields = this.readDialog();
    if (!fields) {
      byId('project-form').querySelector('.is-invalid')?.focus();
      return;
    }
    const before = this.goal();
    const result = saveProject(this.goalId, fields, this.editingId);
    if (!result) return;
    bootstrap.Modal.getInstance(byId('project-modal')).hide();
    showToast(this.editingId ? 'projects.toast.saved' : 'projects.toast.added', 'success', { title: projectTitle(result.project) });
    if (!this.editingId) this.filter = 'all'; // the new project is seen at once
    renderDetailsPage();
    if (before) offerFinish(before); // the last finished project: "Goal reached! 🎉" (goal-details.js)
  },

  /* ----- Delete: the question with the number of tasks, then "Undo" for 7 seconds ----- */

  askDelete(projectId, opener) {
    if (!window.bootstrap) return;
    const project = goalProjects(this.goal()).find((item) => item.id === projectId);
    if (!project) return;
    this.ensureDialogs();
    this.deletingId = projectId;
    this.opener = opener;
    const count = projectTaskCount(projectId);
    const title = projectTitle(project);
    byId('project-delete-name').textContent = count
      ? t('projects.delete.question', { title, tasks: tPlural('projects.delete.tasks', count) })
      : t('projects.delete.questionNoTasks', { title });
    bootstrap.Modal.getOrCreateInstance(byId('project-delete-modal')).show();
  },

  confirmDelete() {
    const goalId = this.goalId;
    const result = this.deletingId ? deleteProject(goalId, this.deletingId) : null;
    this.deletingId = null;
    this.opener = byId('projects-title'); // the card is gone
    bootstrap.Modal.getInstance(byId('project-delete-modal')).hide();
    if (!result) return;
    showToast('projects.toast.deleted', 'success', { title: projectTitle(result.removed.project) }, {
      delay: PROJECT_UNDO_DELAY,
      action: { labelKey: 'toast.undo', onClick: () => this.undoDelete(goalId, result.removed) }
    });
    renderDetailsPage();
  },

  undoDelete(goalId, removed) {
    if (!restoreProject(goalId, removed)) {
      showToast('toast.undoFailed', 'warning');
      return;
    }
    showToast('projects.toast.restored', 'success');
    renderDetailsPage();
    document.querySelector(`[data-project-menu="${CSS.escape(removed.project.id)}"]`)?.focus();
  },

  /* ----- The details (1.6.5): a panel under the row of cards (computer, tablet) or a full-screen window (phone) ----- */

  isPhone() {
    return window.matchMedia('(max-width: 767.98px)').matches;
  },

  reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  project(projectId) {
    return goalProjects(this.goal()).find((item) => item.id === projectId) ?? null;
  },

  // A project opened: its current stage is chosen (or the first one), no add row is open.
  resetDetail(project) {
    const stages = projectStages(project);
    this.detail = { selectedStageId: projectCurrentStage(project)?.id ?? stages[0]?.id ?? null, addingStage: false, addingTask: false, renamingStageId: null };
  },

  // "Expand ▾": one project at a time; the same button (or Esc) collapses it. A phone opens the full-screen window.
  toggleExpand(projectId, button) {
    if (!this.isPhone() && this.expandedId === projectId) {
      this.collapse(true);
      return;
    }
    this.openProject(projectId, button);
  },

  // Opens the details: a computer — the panel, a phone — the window. stageId (from a card "Add a task to the
  // stage «…»"): that stage is chosen and its add row is open.
  openProject(projectId, button, stageId = null) {
    const project = this.project(projectId);
    if (!project) return;
    this.resetDetail(project);
    if (stageId) Object.assign(this.detail, { selectedStageId: stageId, addingTask: true });
    if (this.isPhone()) {
      this.windowFocus = stageId ? '#pd-task-new' : null;
      this.openDetailWindow(projectId, button, true);
      return;
    }
    this.animateNext = !this.expandedId; // the panel is open already: it stays, the tail moves
    this.expandedId = projectId;
    this.focusKey = stageId ? '#pd-task-new' : null;
    this.render(this.goal());
    if (!stageId) document.querySelector(`[data-project-expand="${CSS.escape(projectId)}"]`)?.focus({ preventScroll: true });
  },

  // Takes the panel and the second part of "My projects" away: all the cards are back in the list.
  removePanel() {
    byId('project-detail')?.remove();
    const more = byId('projects-more');
    if (!more) return;
    byId('projects-list').append(...more.querySelectorAll('.project-card'));
    more.remove();
  },

  // Computer: "My projects" ends after the row of the chosen card; the panel is its own block under it
  // (the page background between them), the next rows go on in a block without a head ("projects-more").
  // The tail (--tail-x) points to the middle of the card. Opening: the panel unfolds (not with reduced motion)
  // and is scrolled into view; another card of the same row: the panel stays, its tail slides.
  placePanel(animate = false) {
    const list = byId('projects-list');
    const old = byId('project-detail');
    const before = old ? { rowEnd: old.dataset.rowEnd ?? null, tail: old.style.getPropertyValue('--tail-x') } : this.lastPanel;
    this.lastPanel = null;
    this.removePanel();
    const project = this.project(this.expandedId);
    const card = project ? list.querySelector(`[data-project-card="${CSS.escape(project.id)}"]`) : null;
    if (!card) this.expandedId = null;
    if (!card || this.isPhone()) return;
    const cards = [...list.querySelectorAll('.project-card:not(.is-placeholder)')];
    const columns = getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    const rowEndIndex = Math.min((Math.floor(cards.indexOf(card) / columns) + 1) * columns, cards.length) - 1;
    const rowEnd = cards[rowEndIndex];
    const sameRow = Boolean(before) && before.rowEnd === rowEnd.dataset.projectCard;
    if (sameRow) animate = false;
    const panel = createEl('section', { class: `project-detail is-panel${animate ? ' is-closed' : ''}`, id: 'project-detail', 'aria-labelledby': 'project-detail-title' });
    panel.dataset.rowEnd = rowEnd.dataset.projectCard;
    panel.innerHTML = `<div class="pd-clip"><div class="pd-inner">${projectDetailHtml(project, this.detail, 'panel')}</div></div>`;
    byId('projects-panel').after(panel);
    const rest = cards.slice(rowEndIndex + 1);
    if (rest.length) {
      const more = createEl('section', { class: 'panel gd-projects projects-more', id: 'projects-more', 'aria-labelledby': 'projects-title' });
      const moreList = createEl('ul', { class: 'projects-list' });
      moreList.append(...rest);
      more.append(moreList);
      panel.after(more);
    }
    const cardBox = card.getBoundingClientRect();
    const tailX = `${Math.round(cardBox.left - panel.getBoundingClientRect().left + cardBox.width / 2)}px`;
    if (sameRow && before.tail && before.tail !== tailX && !this.reducedMotion()) {
      panel.style.setProperty('--tail-x', before.tail); // drawn at the old place first, then it slides (CSS transition)
      panel.getBoundingClientRect();
      panel.classList.add('is-sliding');
    }
    panel.style.setProperty('--tail-x', tailX);
    if (animate) {
      panel.getBoundingClientRect(); // the closed state is drawn first, then it unfolds
      panel.classList.remove('is-closed');
      const scroll = () => panel.scrollIntoView({ block: 'nearest', behavior: this.reducedMotion() ? 'auto' : 'smooth' });
      if (this.reducedMotion()) scroll();
      else setTimeout(scroll, 280);
    }
    this.restoreDetailFocus(panel);
  },

  collapse(focusButton = false) {
    const projectId = this.expandedId;
    if (!projectId) return;
    this.expandedId = null;
    const done = () => {
      this.render(this.goal());
      if (focusButton) document.querySelector(`[data-project-expand="${CSS.escape(projectId)}"]`)?.focus();
    };
    const panel = byId('project-detail');
    if (!panel || this.reducedMotion()) {
      done();
      return;
    }
    panel.classList.add('is-closed');
    setTimeout(done, 260);
  },

  // A phone: the project on the whole screen. "← Projects" (and the back gesture of the window) returns to its card.
  openDetailWindow(projectId, opener, keepState = false) {
    if (!window.bootstrap || !this.project(projectId)) return;
    this.ensureDialogs();
    this.windowId = projectId;
    this.windowOpener = opener;
    if (!keepState) this.resetDetail(this.project(projectId));
    this.renderWindow();
    bootstrap.Modal.getOrCreateInstance(byId('project-detail-modal')).show();
  },

  renderWindow() {
    const project = this.project(this.windowId);
    if (!project) {
      bootstrap.Modal.getInstance(byId('project-detail-modal'))?.hide();
      return;
    }
    const box = byId('project-detail-sheet');
    box.innerHTML = projectDetailHtml(project, this.detail, 'sheet');
    this.restoreDetailFocus(box);
  },

  onDetailWindowHidden() {
    const projectId = this.windowId;
    this.windowId = null;
    if (this.returnToWindow) return; // a dialog opens over it: the window comes back after the dialog
    document.querySelector(`[data-project-expand="${CSS.escape(projectId ?? '')}"]`)?.focus();
  },

  // A phone: the full-screen window closes first, then the dialog opens; after it the window comes back.
  overWindow(openDialog) {
    const sheet = byId('project-detail-modal');
    if (!sheet?.classList.contains('show')) {
      openDialog();
      return;
    }
    this.returnToWindow = this.windowId;
    sheet.addEventListener('hidden.bs.modal', () => openDialog(), { once: true });
    bootstrap.Modal.getInstance(sheet).hide();
  },

  backToWindow() {
    const projectId = this.returnToWindow;
    this.returnToWindow = null;
    if (projectId && this.project(projectId)) this.openDetailWindow(projectId, this.windowOpener, true);
    return Boolean(projectId);
  },

  restoreDetailFocus(container) {
    if (!this.focusKey) return;
    container.querySelector(this.focusKey)?.focus({ preventScroll: true });
    this.focusKey = null;
  },

  // Every change goes through the page: the head tiles, the cards ("Next step") and the details are drawn again.
  refresh(focusKey = null) {
    this.focusKey = focusKey;
    renderDetailsPage();
  },

  /* ----- What is pressed in the details ----- */

  detailProjectId(event) {
    return event.target.closest('#project-detail-sheet') ? this.windowId : this.expandedId;
  },

  // The hint "?" of "Project plan" (phone): open / closed.
  setHelp(open) {
    const help = byId('project-detail-sheet')?.querySelector('.pd-help');
    if (!help) return;
    help.classList.toggle('is-open', open);
    help.querySelector('[data-pd-help]').setAttribute('aria-expanded', String(open));
  },

  onDetailClick(event) {
    const helpButton = event.target.closest('[data-pd-help]');
    this.setHelp(Boolean(helpButton) && !helpButton.closest('.pd-help').classList.contains('is-open'));
    if (helpButton) return;
    const projectId = this.detailProjectId(event);
    const target = event.target.closest('[data-pd-stage-select], [data-pd-stage-done], [data-pd-stage-rename], [data-pd-stage-delete], [data-pd-stage-open], [data-pd-task-open], [data-pd-edit], [data-pd-finish]');
    if (!projectId || !target) return;
    const data = target.dataset;
    const sheet = Boolean(event.target.closest('#project-detail-sheet'));
    // A row of the ⋮ menu: the menu closes first (then the details may be drawn again)
    const menuToggle = target.closest('.pd-stage-menu')?.querySelector('[data-pd-stage-menu]');
    if (menuToggle) bootstrap.Dropdown.getInstance(menuToggle)?.hide();
    if ('pdStageSelect' in data) {
      // A phone: the stage opens / closes its tasks under it (an accordion); a computer: it is chosen
      const same = this.detail.selectedStageId === data.pdStageSelect;
      this.detail = { ...this.detail, selectedStageId: sheet && same ? null : data.pdStageSelect, addingTask: false, renamingStageId: null };
      this.refresh(`[data-pd-stage-select="${CSS.escape(data.pdStageSelect)}"]`);
    } else if ('pdStageDone' in data) {
      const stage = projectStages(this.project(projectId)).find((item) => item.id === data.pdStageDone);
      if (stage) setStageDone(this.goalId, projectId, stage.id, !stage.done);
      this.refresh(`[data-pd-stage-done="${CSS.escape(data.pdStageDone)}"]`);
    } else if ('pdStageRename' in data) {
      this.detail = { ...this.detail, renamingStageId: data.pdStageRename, addingStage: false };
      this.refresh('#pd-stage-rename');
      byId('pd-stage-rename')?.select();
    } else if ('pdStageDelete' in data) {
      this.askStageDelete(projectId, data.pdStageDelete, menuToggle ?? target);
    } else if ('pdStageOpen' in data) {
      this.detail.addingStage = true;
      this.refresh('#pd-stage-new');
    } else if ('pdTaskOpen' in data) {
      this.detail.addingTask = true;
      this.refresh('#pd-task-new');
    } else if ('pdEdit' in data) {
      this.overWindow(() => this.openDialog(projectId, sheet ? this.windowOpener : target));
    } else if ('pdFinish' in data) {
      this.askFinish(projectId, target);
    }
  },

  onDetailChange(event) {
    const projectId = this.detailProjectId(event);
    const target = event.target;
    if (!projectId) return;
    if (target.matches('[data-pd-task-toggle]')) {
      const task = getTasks().find((item) => item.id === target.dataset.pdTaskToggle);
      const stageChange = syncProjectStage(task ? toggleTask(task.id, task.date) : null);
      this.refresh(`#pd-task-${CSS.escape(target.dataset.pdTaskToggle)}`);
      announceStageChange(stageChange, () => this.refresh());
    } else if (target.matches('[data-pd-status]')) {
      const before = this.goal();
      const result = setProjectStatus(this.goalId, projectId, target.value);
      this.refresh('[data-pd-status]');
      if (result && target.value === 'done') offerFinish(before); // the last needed project: "Goal reached! 🎉"
    } else if (target.matches('[data-pd-deadline]')) {
      setProjectDeadline(this.goalId, projectId, target.value || null);
      this.refresh('[data-pd-deadline]');
    } else if (target.matches('[data-pd-task-date]')) {
      updateTask(target.dataset.pdTaskDate, { date: target.value || null });
      this.refresh(`[data-pd-task-date="${CSS.escape(target.dataset.pdTaskDate)}"]`);
    }
  },

  // Enter in a row: "+ Add a stage" — the title; "+ Add a task" — the title and the date (the row stays for the next one).
  onDetailSubmit(event) {
    const form = event.target.closest('[data-pd-stage-add], [data-pd-task-add], [data-pd-stage-rename-form]');
    const projectId = this.detailProjectId(event);
    if (!form || !projectId) return;
    event.preventDefault();
    if (form.matches('[data-pd-stage-add]')) this.submitStage(projectId);
    else if (form.matches('[data-pd-task-add]')) this.submitTask(projectId);
    else this.submitRename(projectId, form.dataset.pdStageRenameForm);
  },

  submitRename(projectId, stageId) {
    const input = byId('pd-stage-rename');
    const error = input.value.trim() ? null : 'projects.error.stage';
    setFieldError(input, error);
    if (error) {
      input.focus();
      return;
    }
    renameProjectStage(this.goalId, projectId, stageId, input.value);
    this.detail.renamingStageId = null;
    this.refresh(`[data-pd-stage-select="${CSS.escape(stageId)}"]`);
  },

  submitStage(projectId) {
    const input = byId('pd-stage-new');
    const title = input.value.trim();
    const full = projectStages(this.project(projectId)).length >= PROJECT_STAGES_LIMIT;
    let error = title ? null : 'projects.error.stage';
    if (!error && full) error = 'projects.error.stagesLimit';
    setFieldError(input, error);
    if (error) {
      input.focus();
      return;
    }
    const result = addProjectStage(this.goalId, projectId, title);
    if (!result) return;
    if (!this.detail.selectedStageId) this.detail.selectedStageId = projectStages(result.project).slice(-1)[0].id;
    this.refresh('#pd-stage-new');
  },

  submitTask(projectId) {
    const titleInput = byId('pd-task-new');
    const dateInput = byId('pd-task-new-date');
    const date = getDateValue(dateInput) || null;
    const fields = { title: titleInput.value.trim(), date: date ?? Dates.toISO(Dates.today()) };
    const errors = validateTask(fields);
    const dateError = dateInput.value.trim() && !date ? 'profile.error.dateInvalid' : null;
    setFieldError(titleInput, errors.title);
    setFieldError(dateInput, dateError);
    if (errors.title || dateError) {
      (errors.title ? titleInput : dateInput).focus();
      return;
    }
    if (!addProjectTask(this.goalId, projectId, this.detail.selectedStageId, { title: fields.title, date })) return;
    showToast('toast.taskCreated', 'success');
    this.refresh('#pd-task-new');
  },

  // Esc in an add row closes the row (not the panel, not the window); elsewhere in the panel Esc collapses it.
  onDetailKeydown(event) {
    if (event.key === 'Escape' && event.target.closest('.pd-help.is-open')) {
      event.preventDefault();
      event.stopPropagation(); // Esc closes the hint, not the window
      this.setHelp(false);
      return;
    }
    const form = event.key === 'Escape' ? event.target.closest('[data-pd-stage-add], [data-pd-task-add], [data-pd-stage-rename-form]') : null;
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    if (form.matches('[data-pd-stage-rename-form]')) {
      this.detail.renamingStageId = null;
      this.refresh(`[data-pd-stage-select="${CSS.escape(form.dataset.pdStageRenameForm)}"]`);
      return;
    }
    const isStage = form.matches('[data-pd-stage-add]');
    this.detail[isStage ? 'addingStage' : 'addingTask'] = false;
    this.refresh(isStage ? '[data-pd-stage-open]' : '[data-pd-task-open]');
  },

  /* ----- Questions: finish the project, delete a stage (with its tasks, "Undo") ----- */

  confirm({ titleKey, name, textKey, okKey, danger, onConfirm }) {
    this.overWindow(() => {
      this.ensureDialogs();
      byId('project-confirm-title').textContent = t(titleKey);
      byId('project-confirm-name').textContent = name;
      byId('project-confirm-text').textContent = t(textKey);
      const ok = byId('project-confirm-ok');
      ok.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
      ok.innerHTML = `<i class="bi ${danger ? 'bi-trash' : 'bi-check2'} me-1" aria-hidden="true"></i>${escapeHtml(t(okKey))}`;
      this.confirmAction = onConfirm;
      bootstrap.Modal.getOrCreateInstance(byId('project-confirm-modal')).show();
    });
  },

  askFinish(projectId, opener) {
    const project = this.project(projectId);
    if (!project || !window.bootstrap) return;
    this.opener = opener;
    this.confirm({
      titleKey: 'projects.finish.title', name: t('projects.finish.question', { title: projectTitle(project) }), textKey: 'projects.finish.text',
      okKey: 'projects.finish.confirm', danger: false,
      onConfirm: () => {
        const before = this.goal();
        if (!setProjectStatus(this.goalId, projectId, 'done')) return;
        showToast('projects.toast.finished', 'success', { title: projectTitle(project) });
        this.refresh('[data-pd-status]');
        offerFinish(before);
      }
    });
  },

  askStageDelete(projectId, stageId, opener) {
    const stage = projectStages(this.project(projectId)).find((item) => item.id === stageId);
    if (!stage || !window.bootstrap) return;
    this.opener = opener;
    const count = projectStageTasks(projectId, stageId).length;
    this.confirm({
      titleKey: 'projects.stage.deleteTitle',
      name: count ? t('projects.stage.deleteQuestion', { title: stage.title, tasks: tPlural('projects.delete.tasks', count) })
        : t('projects.stage.deleteQuestionNoTasks', { title: stage.title }),
      textKey: 'projects.stage.deleteText', okKey: 'delete.confirm', danger: true,
      onConfirm: () => {
        const goalId = this.goalId;
        const result = deleteProjectStage(goalId, projectId, stageId);
        if (!result) return;
        if (this.detail.selectedStageId === stageId) this.resetDetail(this.project(projectId));
        this.opener = null;
        showToast('projects.toast.stageDeleted', 'success', { title: stage.title }, {
          delay: PROJECT_UNDO_DELAY,
          action: { labelKey: 'toast.undo', onClick: () => this.undoStageDelete(goalId, result.removed) }
        });
        this.refresh('[data-pd-stage-open]');
      }
    });
  },

  undoStageDelete(goalId, removed) {
    if (!restoreProjectStage(goalId, removed)) {
      showToast('toast.undoFailed', 'warning');
      return;
    }
    showToast('projects.toast.stageRestored', 'success');
    this.refresh(`[data-pd-stage-select="${CSS.escape(removed.stage.id)}"]`);
  },

  // The answer is given (or not): the window closes, the action runs; a phone gets its project window back.
  onConfirmHidden() {
    const action = this.confirmAction;
    this.confirmAction = null;
    if (action && this.confirmed) action();
    this.confirmed = false;
    if (this.backToWindow()) return;
    if (!this.focusKey && this.opener?.isConnected) this.opener.focus();
  },

  /* ----- Events ----- */

  bind() {
    byId('project-add').addEventListener('click', (event) => this.openDialog(null, event.currentTarget));
    byId('projects-filter').addEventListener('click', (event) => {
      const button = event.target.closest('[data-project-filter]');
      if (!button) return;
      this.filter = button.dataset.projectFilter;
      this.expandedId = null; // another filter: the panel closes
      this.render(this.goal());
      byId('projects-filter').querySelector(`[data-project-filter="${this.filter}"]`)?.focus({ preventScroll: true });
    });
    // "My projects", the panel and the rest of the cards are blocks of one column: the events are caught there
    const area = byId('projects-panel').parentElement;
    const inDetail = (event) => Boolean(event.target.closest('#project-detail'));
    area.addEventListener('change', (event) => { if (inDetail(event)) this.onDetailChange(event); });
    area.addEventListener('submit', (event) => { if (inDetail(event)) this.onDetailSubmit(event); });
    area.addEventListener('keydown', (event) => { if (inDetail(event)) this.onDetailKeydown(event); });
    // Esc collapses the open panel (not while a dialog is open; an add row closes itself first)
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !this.expandedId || document.querySelector('.modal.show')) return;
      this.collapse(true);
    });
    // The columns change with the width: the panel moves under the right row; a phone has no panel
    let resizeFrame = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (!this.expandedId) return;
        if (this.isPhone()) this.collapse(false);
        else this.placePanel(false);
      });
    });
    area.addEventListener('click', (event) => {
      if (inDetail(event)) {
        this.onDetailClick(event);
        return;
      }
      if (!event.target.closest('.projects-list')) return;
      const menuToggle = event.target.closest('[data-project-menu]');
      if (menuToggle) {
        this.closeOtherMenus(menuToggle);
        return;
      }
      const item = event.target.closest('[data-project-action]');
      if (item) {
        const toggle = item.closest('.project-card')?.querySelector('[data-project-menu]');
        bootstrap.Dropdown.getInstance(toggle)?.hide();
        this.runAction(item.dataset.projectAction, item.dataset.projectId, toggle);
        return;
      }
      // "Add a task to the stage «…»" of the next step: the project opens on that stage
      const openStage = event.target.closest('[data-project-open-stage]');
      if (openStage) {
        this.openProject(openStage.dataset.projectOpenStage, openStage, openStage.dataset.stageId);
        return;
      }
      // "Expand ▾": the details under the row (a phone: on the whole screen)
      const expand = event.target.closest('[data-project-expand]');
      if (expand) this.toggleExpand(expand.dataset.projectExpand, expand);
      if (event.target.closest('[data-project-add-first]')) this.openDialog(null, event.target.closest('button'));
    });
    window.addEventListener('click', (event) => this.catchTouchMenu(event), true);
    area.addEventListener('hidden.bs.dropdown', (event) => {
      if (event.target.closest('.projects-list, #project-detail')) this.renderIfPending();
    });
  }
};

/* ---------- Self-test (goal-details.html?debug=1) ---------- */

function runProjectsSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  // Migration: a checklist and a number
  const checklistGoal = { id: 'g1', category: 'projects', progressType: 'checklist', targetValue: 3, currentValue: 1,
    checklist: [{ text: 'Сайт', done: true }, { text: 'Портфолио', done: false }, { text: 'Курс', done: false }] };
  const fromList = migrateProjectGoal(checklistGoal);
  check('migration: checklist items -> projects, ticked = done', `${fromList.progressType} ${fromList.projectList} ${fromList.projects.map((p) => `${p.title}:${p.status}`).join(',')}`,
    'number true Сайт:done,Портфолио:planned,Курс:planned');
  check('migration: checklist — the goal = the number of items, the counter = the ticked ones', `${fromList.targetValue} ${fromList.currentValue}`, '3 1');
  check('migration: the old checklist stays in the data', fromList.checklist.length, 3);
  const fromNumber = migrateProjectGoal({ id: 'g2', category: 'projects', progressType: 'number', targetValue: 5, currentValue: 2 });
  check('migration: a number N -> N finished projects without a title, the goal stays', `${fromNumber.projects.length} ${countDoneProjects(fromNumber.projects)} ${fromNumber.targetValue} ${fromNumber.projects[0].title === ''}`, '2 2 5 true');
  check('migration: done once (projectList is there)', migrateProjectGoal(fromNumber), fromNumber);
  check('migration: the projects get the folder icon', [...fromList.projects, ...fromNumber.projects].every((item) => item.icon === 'bi-folder'), true);
  check('migration: a "Projects" goal with projectList: false is not changed', migrateProjectGoal({ category: 'projects', progressType: 'checklist', projectList: false }).projectList, false);
  check('migration: other categories are not changed', migrateProjectGoal({ category: 'career', progressType: 'checklist' }).projectList, undefined);
  // Progress, the head
  const goal = { category: 'projects', progressType: 'number', projectList: true, targetValue: 4, status: 'active', startValue: 0, projects: [
    { id: 'a', status: 'active', deadline: '2026-12-20', stages: [] }, { id: 'b', status: 'active', deadline: '2026-11-25', stages: [] },
    { id: 'c', status: 'planned', deadline: null, stages: [] }, { id: 'd', status: 'done', deadline: '2026-10-01', stages: [] }] };
  goal.currentValue = countDoneProjects(goal.projects);
  const stats = projectGoalStats(goal);
  check('progress: 1 of 4 = 25 %, 2 in progress, the nearest deadline of an open project', `${stats.done}/${stats.target} ${getGoalPercent(goal)}% ${stats.active} ${stats.nearest}`, '1/4 25% 2 2026-11-25');
  check('order: in progress (nearest first) → planned → finished', filteredProjects(goal.projects).map((p) => p.id).join(), 'b,a,c,d');
  // Next step
  const stages = [{ id: 's1', title: 'Подготовка', done: true }, { id: 's2', title: 'Закупка', done: false }, { id: 's3', title: 'Покраска', done: false }];
  const project = { id: 'p', status: 'active', stages };
  const tasks = [{ projectId: 'p', stageId: 's2', title: 'Купить расходники', date: '2026-11-21', completed: false },
    { projectId: 'p', stageId: 's2', title: 'Выбрать краску', date: '2026-11-20', completed: false },
    { projectId: 'p', stageId: 's1', title: 'Старая', date: '2026-11-01', completed: false }];
  check('next step: the first open task of the current stage (by date)', projectNextStep(project, tasks).text, 'Выбрать краску');
  check('next step: no task — the title of the current stage', projectNextStep(project, []).text, 'Закупка');
  check('next step: all stages done -> finish', projectNextStep({ ...project, stages: stages.map((s) => ({ ...s, done: true })) }).kind, 'finish');
  check('next step: no stages / finished project', `${projectNextStep({ status: 'planned', stages: [] }).kind} ${projectNextStep({ status: 'done', stages }).kind}`, 'noStages done');
  check('stages: 1 of 3', JSON.stringify(projectStageCount(project)), '{"done":1,"total":3}');
  // Plurals and the safety of imported links
  if (I18n.lang === 'ru') check('plural (ru): 1 проект / 2 проекта / 5 проектов / 21 проект', [1, 2, 5, 21].map((n) => projectCountText(n)).join(' | '), '1 проект | 2 проекта | 5 проектов | 21 проект');
  check('plural: the goal value uses it', formatGoalValue({ ...goal }, 2), projectCountText(2));
  check('import: a "javascript:" link is dropped, https is kept',
    cleanProject({ links: [{ title: 'x', url: 'javascript:alert(1)' }, { title: 'y', url: 'https://example.com' }] }).links.map((l) => l.url).join(), 'https://example.com');
  check('import: an unknown status -> planned, a bad date -> null', `${cleanProject({ status: 'wip', deadline: '31.12.2026' }).status} ${cleanProject({ deadline: '31.12.2026' }).deadline}`, 'planned null');
  // 1.6.5: the tasks of a stage
  const stageTasks = [{ projectId: 'p', stageId: 's2', title: 'Б', date: null, completed: false },
    { projectId: 'p', stageId: 's2', title: 'А', date: '2026-11-21', completed: true },
    { projectId: 'p', stageId: 's2', title: 'В', date: '2026-11-20', completed: false },
    { projectId: 'p', stageId: 's1', title: 'Г', date: '2026-11-19', completed: false }];
  check('stage tasks: only this stage; open by date, no date after, done at the end',
    projectStageTasks('p', 's2', stageTasks).map((task) => task.title).join(), 'В,Б,А');
  check('stage tasks: without a date — in the order they were added (not by title)',
    orderStageTasks([{ title: 'Я', date: null }, { title: 'А', date: null }, { title: 'М', date: '2026-11-30' }]).map((task) => task.title).join(), 'М,Я,А');
  const step = projectNextStep(project, tasks);
  check('next step: "Stage 2 of 3", the task with its date, "0 of 2 tasks of the stage"',
    `${step.kind} ${step.number}/${step.total} ${step.task.date} ${step.tasksDone}/${step.tasksTotal}`, 'task 2/3 2026-11-20 0/2');
  check('next step: a stage without open tasks -> "Add a task to the stage"', `${projectNextStep(project, []).kind} ${projectNextStep(project, []).stage.id}`, 'noTasks s2');
  check('icons: a new / unknown icon -> the folder; an old goal icon chosen before is kept',
    `${projectIcon(undefined)} ${projectIcon('bi-x')} ${projectIcon('bi-piggy-bank')} ${projectIcon('bi-rocket')}`, 'bi-folder bi-folder bi-piggy-bank bi-rocket');
  check('icons: the project set has no piggy bank, ~40–50 icons', `${PROJECT_ICONS.includes('bi-piggy-bank')} ${PROJECT_ICONS.length >= 40}`, 'false true');
  check('a task keeps its project and stage', ['projectId', 'stageId'].map((key) => normalizeTask({ title: 'x', projectId: 'p', stageId: 's2' })[key]).join(), 'p,s2');
  check('a task without a date is sorted after the dated ones (no error)',
    compareTaskOccurrences({ done: false, date: null, task: { priority: 'medium', title: 'a' } }, { done: false, date: '2026-11-20', task: { priority: 'medium', title: 'b' } }) > 0, true);
  const projectGoal = { id: 'g', projectList: true, category: 'projects', progressType: 'number', projects: [{ id: 'p', title: 'Ремонт' }] };
  check('a task finds its project; a task of a deleted project — none',
    `${taskProject({ goalId: 'g', projectId: 'p' }, [projectGoal])?.project.title} ${taskProject({ goalId: 'g', projectId: 'x' }, [projectGoal])}`, 'Ремонт null');
  console.group('[LifeOS] Projects self-test');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} projects tests failed`);
  else console.info(`All ${results.length} projects tests passed`);
  console.groupEnd();
}

onAppReady(() => {
  if (!byId('projects-panel')) return;
  ProjectList.bind();
  if (new URLSearchParams(window.location.search).get('debug') === '1') runProjectsSelfTest();
});
