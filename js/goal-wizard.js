// LifeOS — goal wizard: one 7-step dialog to create or edit a goal (concept, section 5).
// Used on the Goals page and on the Dashboard ("First steps" → step 1). The markup is below
// (GOAL_WIZARD_HTML): init() adds it to the page once. Choice lists are filled from the lists in app.js.
// Steps: 1 category → 2 title → 3 icon & color → 4 progress type →
//        5 values & deadline → 6 milestones → 7 review & save.
'use strict';

const WIZARD_LAST_STEP = 7;
const TITLE_MIN_LENGTH = 2;
const TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 300;

// Icons offered on step 3. Their names are translated as "icon.<name without bi->".
const GOAL_ICONS = [
  'bi-piggy-bank', 'bi-wallet2', 'bi-book', 'bi-heart-pulse',
  'bi-activity', 'bi-translate', 'bi-mortarboard', 'bi-laptop',
  'bi-kanban', 'bi-briefcase', 'bi-person-heart', 'bi-sunrise',
  'bi-trophy', 'bi-bicycle', 'bi-music-note-beamed', 'bi-stars'
];

// Choosing a category suggests a progress type (until the user picks one).
const CATEGORY_DEFAULT_TYPE = {
  finance: 'money',
  books: 'number',
  health: 'measurements',
  languages: 'levels',
  education: 'percent',
  projects: 'checklist',
  career: 'checklist',
  personal: 'streak',
  custom: 'number'
};

const DEFAULT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Goal templates (step 1). Every value is only a starting point: the user can change everything.
const GOAL_TEMPLATES = {
  books: { icon: 'bi-book', category: 'books', type: 'number', color: 'clay', start: 0, target: 12, unitKey: 'demo.books.unit' },
  savings: { icon: 'bi-piggy-bank', category: 'finance', type: 'money', color: 'teal', start: 0, target: 1000000 },
  language: { icon: 'bi-translate', category: 'languages', type: 'levels', color: 'blue', startLevel: 'A2', targetLevel: 'B2' },
  habit: { icon: 'bi-sunrise', category: 'personal', type: 'streak', color: 'clay', target: 30, unitKey: 'wizard.defaultUnit.days' },
  project: {
    icon: 'bi-kanban', category: 'projects', type: 'checklist', color: 'plum',
    itemKeys: ['template.project.item1', 'template.project.item2', 'template.project.item3', 'template.project.item4', 'template.project.item5']
  }
};

const NUMERIC_TYPES = ['number', 'money', 'percent', 'streak', 'measurements'];

// Which blocks of step 5 are shown for each type (see data-field in goals.html).
const VALUE_FIELDS = {
  number: ['start', 'target', 'unit'],
  money: ['start', 'target', 'currency'],
  percent: ['start', 'target'],
  streak: ['target', 'unit'], // a streak always starts at 0 days
  measurements: ['start', 'target', 'unit'],
  levels: ['levels'],
  checklist: ['checklist']
};

/* ---------- Small helpers (byId, createEl, readNumber, numberError are in app.js) ---------- */

// "A1, A2 , ,B1" -> ["A1", "A2", "B1"]
function parseLevels(text) {
  return text.split(',').map((level) => level.trim()).filter(Boolean);
}

function byDueDate(a, b) {
  return String(a.dueDate).localeCompare(String(b.dueDate));
}

/* ---------- The wizard ---------- */

// The dialog. The English texts are replaced by data-i18n (I18n.apply in init()).
const GOAL_WIZARD_HTML = `
  <div class="modal fade" id="goal-wizard" tabindex="-1" data-bs-backdrop="static" aria-labelledby="wizard-title">
    <div class="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-sm-down">
      <form class="modal-content" id="wizard-form" novalidate>
        <div class="modal-header">
          <div>
            <h2 class="modal-title fs-5" id="wizard-title">New goal</h2>
            <h3 class="wizard-step-label" id="wizard-step-label" tabindex="-1"></h3>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close" aria-label="Close"></button>
        </div>
        <ol class="wizard-steps" aria-hidden="true">
          <li></li><li></li><li></li><li></li><li></li><li></li><li></li>
        </ol>

        <div class="modal-body">
          <!-- Step 1: category -->
          <section class="wizard-step" data-step="1">
            <!-- Templates (create mode only): fill the fields, everything can be changed later -->
            <div class="wizard-templates" id="wiz-templates">
              <h4 class="h6 mb-1" data-i18n="wizard.templates.title">Start from a template (optional)</h4>
              <p class="form-text mt-0" data-i18n="wizard.templates.hint">A template fills in the fields; you can change everything on the next steps.</p>
              <div class="template-list" id="wiz-template-list"></div>
            </div>
            <fieldset id="wiz-category">
              <legend class="wizard-intro" data-i18n="wizard.category.intro">What area of life is this goal about?</legend>
              <div class="choice-grid" id="wiz-category-list"></div>
            </fieldset>
            <p class="field-error" id="wiz-category-error"></p>
          </section>

          <!-- Step 2: title and description -->
          <section class="wizard-step" data-step="2" hidden>
            <div class="mb-3">
              <label class="form-label" for="wiz-title" data-i18n="wizard.title.label">Goal title</label>
              <input class="form-control" type="text" id="wiz-title" autocomplete="off" aria-describedby="wiz-title-hint">
              <div class="form-text" id="wiz-title-hint" data-i18n="wizard.title.hint">From 2 to 80 characters.</div>
              <p class="field-error" id="wiz-title-error"></p>
            </div>
            <div>
              <label class="form-label" for="wiz-description" data-i18n="wizard.description.label">Description</label>
              <textarea class="form-control" id="wiz-description" rows="3" aria-describedby="wiz-description-hint"></textarea>
              <div class="form-text" id="wiz-description-hint" data-i18n="wizard.description.hint">Optional, up to 300 characters.</div>
              <p class="field-error" id="wiz-description-error"></p>
            </div>
          </section>

          <!-- Step 3: icon and color -->
          <section class="wizard-step" data-step="3" hidden>
            <div class="goal-preview mb-3" id="wiz-preview" data-color="teal">
              <span class="goal-icon" aria-hidden="true"><i class="bi bi-stars"></i></span>
              <span class="goal-preview-title" id="wiz-preview-title"></span>
            </div>
            <fieldset class="mb-3">
              <legend class="form-label fs-6" data-i18n="wizard.icon.label">Icon</legend>
              <div class="choice-grid choice-grid-icons" id="wiz-icon-list"></div>
            </fieldset>
            <fieldset>
              <legend class="form-label fs-6" data-i18n="wizard.color.label">Color</legend>
              <div class="choice-grid-colors" id="wiz-color-list"></div>
            </fieldset>
          </section>

          <!-- Step 4: progress type -->
          <section class="wizard-step" data-step="4" hidden>
            <fieldset id="wiz-type">
              <legend class="wizard-intro help-title"><span data-i18n="wizard.type.intro">How will you measure progress?</span>
                <button type="button" class="btn help-tip" data-help="progressType" data-i18n-aria-label="onboarding.help.progressType.label" aria-label="How to choose the type?"><i class="bi bi-question-circle" aria-hidden="true"></i></button></legend>
              <div class="choice-grid choice-grid-wide" id="wiz-type-list"></div>
            </fieldset>
            <p class="field-error" id="wiz-type-error"></p>
          </section>

          <!-- Step 5: values and deadline. JS shows only the fields of the chosen type (data-field). -->
          <section class="wizard-step" data-step="5" hidden>
            <p class="wizard-intro" id="wiz-type-hint"></p>
            <div class="row g-3">
              <div class="col-sm-6" data-field="start">
                <label class="form-label" for="wiz-start" data-i18n="wizard.values.start">Start value</label>
                <input class="form-control" type="text" id="wiz-start" inputmode="decimal" autocomplete="off" data-group-digits>
                <p class="field-error" id="wiz-start-error"></p>
              </div>
              <div class="col-sm-6" data-field="target">
                <label class="form-label" for="wiz-target" data-i18n="wizard.values.target">Target value</label>
                <input class="form-control" type="text" id="wiz-target" inputmode="decimal" autocomplete="off" data-group-digits>
                <p class="field-error" id="wiz-target-error"></p>
              </div>
              <div class="col-sm-6" data-field="current">
                <label class="form-label" for="wiz-current" data-i18n="wizard.values.current">Current value</label>
                <input class="form-control" type="text" id="wiz-current" inputmode="decimal" autocomplete="off" data-group-digits>
                <p class="field-error" id="wiz-current-error"></p>
              </div>
              <div class="col-sm-6" data-field="unit">
                <label class="form-label" for="wiz-unit" data-i18n="wizard.values.unit">Unit</label>
                <input class="form-control" type="text" id="wiz-unit" maxlength="20" autocomplete="off" aria-describedby="wiz-unit-hint">
                <div class="form-text" id="wiz-unit-hint" data-i18n="wizard.values.unitHint">Optional, e.g. books, kg, days.</div>
              </div>
              <div class="col-sm-6" data-field="currency">
                <label class="form-label" for="wiz-currency" data-i18n="wizard.values.currency">Currency</label>
                <select class="form-select" id="wiz-currency">
                  <option value="KZT" data-i18n="currency.KZT">Tenge (₸)</option>
                  <option value="USD" data-i18n="currency.USD">US dollar ($)</option>
                  <option value="EUR" data-i18n="currency.EUR">Euro (€)</option>
                  <option value="RUB" data-i18n="currency.RUB">Russian ruble (₽)</option>
                </select>
              </div>

              <div class="col-12" data-field="levels">
                <label class="form-label" for="wiz-levels" data-i18n="wizard.values.levels">Levels in order</label>
                <input class="form-control" type="text" id="wiz-levels" autocomplete="off" aria-describedby="wiz-levels-hint">
                <div class="form-text" id="wiz-levels-hint" data-i18n="wizard.values.levelsHint">Separate with commas, from lowest to highest.</div>
                <p class="field-error" id="wiz-levels-error"></p>
                <div class="row g-3 mt-0">
                  <div class="col-sm-4">
                    <label class="form-label" for="wiz-level-start" data-i18n="wizard.values.levelStart">Start level</label>
                    <select class="form-select" id="wiz-level-start"></select>
                  </div>
                  <div class="col-sm-4">
                    <label class="form-label" for="wiz-level-target" data-i18n="wizard.values.levelTarget">Target level</label>
                    <select class="form-select" id="wiz-level-target"></select>
                    <p class="field-error" id="wiz-level-target-error"></p>
                  </div>
                  <div class="col-sm-4" data-field="levelCurrent">
                    <label class="form-label" for="wiz-level-current" data-i18n="wizard.values.levelCurrent">Current level</label>
                    <select class="form-select" id="wiz-level-current"></select>
                  </div>
                </div>
              </div>

              <div class="col-12" data-field="checklist">
                <label class="form-label" for="wiz-check-input" data-i18n="wizard.values.checkItem">New item</label>
                <div class="add-row">
                  <input class="form-control" type="text" id="wiz-check-input" maxlength="120" autocomplete="off" aria-describedby="wiz-check-input-hint">
                  <button type="button" class="btn btn-tool" id="wiz-check-add"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i><span data-i18n="wizard.add">Add</span></button>
                </div>
                <div class="form-text" id="wiz-check-input-hint" data-i18n="wizard.values.checkHint">Press Enter to add. Tick items that are already done.</div>
                <p class="field-error" id="wiz-check-input-error"></p>
                <ul class="edit-list" id="wiz-check-list"></ul>
              </div>

              <div class="col-sm-6">
                <label class="form-label" for="wiz-deadline" data-i18n="wizard.values.deadline">Deadline</label>
                <input class="form-control" type="text" inputmode="numeric" maxlength="10" autocomplete="off" data-date-field data-i18n-placeholder="date.placeholder" id="wiz-deadline" aria-describedby="wiz-deadline-hint">
                <div class="form-text" id="wiz-deadline-hint" data-i18n="wizard.values.deadlineHint">Optional. Cannot be in the past.</div>
                <p class="field-error" id="wiz-deadline-error"></p>
              </div>
            </div>
          </section>

          <!-- Step 6: milestones (optional) -->
          <section class="wizard-step" data-step="6" hidden>
            <p class="wizard-intro" data-i18n="wizard.milestones.intro">Split the goal into stages with dates. This step is optional.</p>
            <div class="row g-3 align-items-start">
              <div class="col-sm-6">
                <label class="form-label" for="wiz-ms-title" data-i18n="wizard.milestones.title">Milestone</label>
                <input class="form-control" type="text" id="wiz-ms-title" maxlength="80" autocomplete="off">
                <p class="field-error" id="wiz-ms-title-error"></p>
              </div>
              <div class="col-sm-4">
                <label class="form-label" for="wiz-ms-date" data-i18n="wizard.milestones.date">Date</label>
                <input class="form-control" type="text" inputmode="numeric" maxlength="10" autocomplete="off" data-date-field data-i18n-placeholder="date.placeholder" id="wiz-ms-date">
                <p class="field-error" id="wiz-ms-date-error"></p>
              </div>
              <div class="col-sm-2 milestone-add">
                <button type="button" class="btn btn-tool w-100" id="wiz-ms-add"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i><span data-i18n="wizard.add">Add</span></button>
              </div>
            </div>
            <p class="text-secondary mt-3 mb-0" id="wiz-ms-empty" data-i18n="wizard.milestones.empty">No milestones yet.</p>
            <ul class="edit-list" id="wiz-ms-list"></ul>
            <p class="field-error" id="wiz-ms-list-error"></p>
          </section>

          <!-- Step 7: review -->
          <section class="wizard-step" data-step="7" hidden>
            <p class="wizard-intro" data-i18n="wizard.review.intro">Check the goal before saving.</p>
            <div class="goal-preview mb-3" id="wiz-review-preview" data-color="teal">
              <span class="goal-icon" aria-hidden="true"><i class="bi bi-stars"></i></span>
              <span class="goal-preview-title" id="wiz-review-title"></span>
            </div>
            <dl class="review-list" id="wiz-review"></dl>
          </section>
        </div>

        <div class="modal-footer justify-content-between">
          <button type="button" class="btn btn-tool" id="wiz-back"><i class="bi bi-arrow-left me-1" aria-hidden="true"></i><span data-i18n="wizard.back">Back</span></button>
          <button type="submit" class="btn btn-primary" id="wiz-next"><span id="wiz-next-label">Next</span></button>
        </div>
      </form>
    </div>
  </div>`;

const GoalWizard = {
  modalEl: null,
  form: null,
  mode: 'create', // "create" or "edit"
  original: null, // the goal being edited
  step: 1,
  hasDraft: false, // a closed, unsaved "create" keeps what was typed
  savedGoalId: null,
  isSaving: false, // true while the saved wizard closes: a second Enter must not save a copy
  checklist: [],
  milestones: [],
  levelChoice: {}, // select id -> chosen level name
  touched: { icon: false, progressType: false }, // the user chose it, so do not overwrite
  attempted: new Set(), // steps where "Next" failed: errors update while typing

  // Adds the dialog to the page once (a second call does nothing).
  init() {
    if (this.modalEl || !document.body) return;
    document.body.insertAdjacentHTML('beforeend', GOAL_WIZARD_HTML);
    this.modalEl = byId('goal-wizard');
    this.form = byId('wizard-form');
    this.buildChoices();
    this.buildTemplates();
    this.bindEvents();
    I18n.apply(this.modalEl);
    if (typeof HelpTips !== 'undefined') HelpTips.attach(this.modalEl); // the "?" at the progress type (js/onboarding.js)
  },

  /* ----- Templates (step 1) ----- */

  buildTemplates() {
    const list = byId('wiz-template-list');
    Object.entries(GOAL_TEMPLATES).forEach(([name, template]) => {
      const button = createEl('button', { type: 'button', class: 'btn btn-tool btn-sm', 'data-template': name });
      button.append(
        createEl('i', { class: `bi ${template.icon} me-1`, 'aria-hidden': 'true' }),
        createEl('span', { 'data-i18n': `template.${name}` }, t(`template.${name}`))
      );
      list.append(button);
    });
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-template]');
      if (button) this.applyTemplate(button.dataset.template);
    });
  },

  templateTitle(name, template) {
    if (name === 'books') return t('template.books.title', { n: Format.number(template.target) });
    if (name === 'savings') return t('template.savings.title', { amount: Format.money(template.target) });
    return t(`template.${name}.title`);
  },

  // Fills every step from the template and opens step 2, where the title can be changed.
  applyTemplate(name) {
    const template = GOAL_TEMPLATES[name];
    if (!template) return;
    this.check('category', template.category);
    this.check('icon', template.icon);
    this.check('color', template.color);
    this.check('progressType', template.type);
    this.touched = { icon: true, progressType: true }; // the template choice is not overwritten

    byId('wiz-title').value = this.templateTitle(name, template);
    byId('wiz-start').value = template.start === undefined ? '' : formatDigitGroups(String(template.start));
    byId('wiz-target').value = template.target === undefined ? '' : formatDigitGroups(String(template.target));
    byId('wiz-unit').value = template.unitKey ? t(template.unitKey) : '';
    byId('wiz-currency').value = DEFAULT_CURRENCY;
    if (template.type === 'levels') {
      byId('wiz-levels').value = DEFAULT_LEVELS.join(', ');
      this.refreshLevelSelects({ 'wiz-level-start': template.startLevel, 'wiz-level-target': template.targetLevel });
    }
    this.checklist = (template.itemKeys ?? []).map((key) => ({ id: createId('item'), text: t(key), done: false }));
    this.renderChecklist();
    this.form.querySelectorAll('.is-invalid').forEach((element) => {
      if (element.matches('fieldset, ul')) setGroupError(element, null);
      else setFieldError(element, null);
    });
    this.updateValueFields();
    this.goToStep(2, true);
  },


  /* ----- Building the choice lists (radio buttons styled as cards) ----- */

  buildChoices() {
    const categories = Object.keys(GOAL_CATEGORIES).map((value) => ({
      value, icon: GOAL_CATEGORIES[value], key: `category.${value}`
    }));
    const icons = GOAL_ICONS.map((icon) => ({ value: icon, icon, key: `icon.${icon.slice(3)}`, hiddenText: true }));
    const colors = GOAL_COLORS.map((color) => ({ value: color, swatch: color, key: `color.${color}`, hiddenText: true }));
    const types = PROGRESS_TYPES.map((type) => ({
      value: type, key: `progressType.${type}`, hintKey: `progressType.${type}.hint`, exampleKey: `progressType.${type}.example`
    }));

    this.fillChoiceList('wiz-category', 'category', categories, 'choice-card');
    this.fillChoiceList('wiz-icon', 'icon', icons, 'choice-icon');
    this.fillChoiceList('wiz-color', 'color', colors, 'choice-color');
    this.fillChoiceList('wiz-type', 'progressType', types, 'choice-card');
  },

  fillChoiceList(prefix, name, items, labelClass) {
    const container = byId(`${prefix}-list`);
    items.forEach((item) => {
      const id = `${prefix}-${item.value}`;
      const input = createEl('input', { class: 'btn-check', type: 'radio', name, id, value: item.value });
      const label = createEl('label', { class: labelClass, for: id });
      if (item.icon) label.append(createEl('i', { class: `bi ${item.icon}`, 'aria-hidden': 'true' }));
      if (item.swatch) label.append(createEl('span', { class: 'swatch', 'data-color': item.swatch, 'aria-hidden': 'true' }));
      // Icon and color choices show no text, but screen readers still get the name.
      const textClass = item.hiddenText ? 'visually-hidden' : 'choice-name';
      label.append(createEl('span', { class: textClass, 'data-i18n': item.key }, t(item.key)));
      if (item.hintKey) label.append(createEl('span', { class: 'choice-hint', 'data-i18n': item.hintKey }, t(item.hintKey)));
      if (item.exampleKey) label.append(createEl('span', { class: 'choice-example', 'data-i18n': item.exampleKey }, t(item.exampleKey)));
      container.append(input, label);
    });
  },

  /* ----- Events ----- */

  bindEvents() {
    // Enter or the main button = "Next" (or "Save" on the last step).
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.next();
    });
    byId('wiz-back').addEventListener('click', () => this.goToStep(this.step - 1, true));
    this.form.addEventListener('change', (event) => this.onChange(event));
    this.form.addEventListener('input', (event) => {
      if (event.target.id === 'wiz-levels') this.refreshLevelSelects();
      if (event.target.id === 'wiz-title') this.renderPreview();
      if (this.attempted.has(this.step)) this.validateStep(this.step);
    });

    // Checklist editor (step 5)
    byId('wiz-check-add').addEventListener('click', () => this.addChecklistItem());
    this.addOnEnter(byId('wiz-check-input'), () => this.addChecklistItem());
    byId('wiz-check-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-index]');
      if (button) this.removeChecklistItem(Number(button.dataset.removeIndex));
    });
    byId('wiz-check-list').addEventListener('change', (event) => {
      const box = event.target.closest('[data-done-index]');
      if (box) this.checklist[Number(box.dataset.doneIndex)].done = box.checked;
    });

    // Milestone editor (step 6)
    byId('wiz-ms-add').addEventListener('click', () => this.addMilestone());
    this.addOnEnter(byId('wiz-ms-title'), () => this.addMilestone());
    this.addOnEnter(byId('wiz-ms-date'), () => this.addMilestone());
    byId('wiz-ms-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-index]');
      if (button) this.removeMilestone(Number(button.dataset.removeIndex));
    });

    this.modalEl.addEventListener('shown.bs.modal', () => this.focusStepLabel());
    document.addEventListener('lifeos:languagechange', () => {
      if (this.modalEl.classList.contains('show')) this.refreshTexts();
    });
  },

  // In "add item" fields Enter adds the item instead of going to the next step.
  addOnEnter(input, callback) {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      callback();
    });
  },

  onChange(event) {
    const { name, value, id } = event.target;
    if (['wiz-level-start', 'wiz-level-target', 'wiz-level-current'].includes(id)) {
      this.levelChoice[id] = event.target.selectedOptions[0]?.textContent;
    }
    if (name === 'category') this.applyCategoryDefaults(value);
    if (name === 'icon') this.touched.icon = true;
    if (name === 'progressType') {
      this.touched.progressType = true;
      this.applyTypeDefaults();
    }
    if (name === 'icon' || name === 'color') this.renderPreview();
  },

  /* ----- Reading and setting radio groups ----- */

  // RadioNodeList.value is "" when nothing is checked.
  selected(name) {
    return this.form.elements[name].value;
  },

  check(name, value) {
    this.form.elements[name].value = value;
  },

  /* ----- Opening ----- */

  openCreate() {
    if (this.mode === 'edit' || !this.hasDraft) this.reset();
    this.mode = 'create';
    this.original = null;
    this.hasDraft = true;
    byId('wiz-templates').hidden = false;
    this.goToStep(this.step);
    this.show();
  },

  openEdit(goal) {
    this.reset();
    this.mode = 'edit';
    this.original = goal;
    byId('wiz-templates').hidden = true; // templates are only for new goals
    this.fillFromGoal(goal);
    this.goToStep(1);
    this.show();
  },

  show() {
    this.savedGoalId = null;
    this.setSaving(false);
    bootstrap.Modal.getOrCreateInstance(this.modalEl).show();
  },

  reset() {
    this.form.reset();
    this.form.querySelectorAll('.is-invalid').forEach((element) => {
      if (element.matches('fieldset, ul')) setGroupError(element, null);
      else setFieldError(element, null);
    });
    this.checklist = [];
    this.milestones = [];
    this.touched = { icon: false, progressType: false };
    this.attempted = new Set();
    this.step = 1;
    this.check('color', GOAL_COLORS[0]);
    byId('wiz-currency').value = DEFAULT_CURRENCY;
    this.refreshLevelSelects({});
    this.renderChecklist();
    this.renderMilestones();
  },

  fillFromGoal(goal) {
    const type = PROGRESS_TYPES.includes(goal.progressType) ? goal.progressType : 'number';
    // 10000000 -> "10 000 000", the same look as while typing.
    const valueText = (value) => (value === null || value === undefined ? '' : formatDigitGroups(String(value)));

    this.check('category', goal.category in GOAL_CATEGORIES ? goal.category : 'custom');
    byId('wiz-title').value = goal.title ?? '';
    byId('wiz-description').value = goal.description ?? '';
    this.check('icon', goalIcon(goal));
    this.check('color', goalColor(goal));
    this.check('progressType', type);
    this.touched = { icon: true, progressType: true };

    byId('wiz-start').value = valueText(goal.startValue);
    byId('wiz-target').value = valueText(goal.targetValue);
    byId('wiz-current').value = valueText(goal.currentValue);
    if (type === 'money') byId('wiz-currency').value = goal.unit || DEFAULT_CURRENCY;
    else byId('wiz-unit').value = goal.unit ?? '';

    const levels = asArray(goal.levels);
    byId('wiz-levels').value = levels.join(', ');
    this.refreshLevelSelects({
      'wiz-level-start': levels[goal.startValue],
      'wiz-level-target': levels[goal.targetValue],
      'wiz-level-current': levels[goal.currentValue]
    });

    this.checklist = asArray(goal.checklist).map((item) => ({
      id: item.id ?? createId('item'), text: String(item.text ?? ''), done: Boolean(item.done)
    }));
    this.milestones = asArray(goal.milestones).map((milestone) => ({
      id: milestone.id ?? createId('milestone'),
      title: String(milestone.title ?? ''),
      dueDate: milestone.dueDate,
      done: Boolean(milestone.done),
      doneAt: milestone.doneAt ?? null // when it was ticked on the goal page (kept by editing)
    }));
    setDateValue(byId('wiz-deadline'), goal.deadline ?? '');
    this.renderChecklist();
    this.renderMilestones();
  },

  /* ----- Defaults ----- */

  applyCategoryDefaults(category) {
    if (!this.touched.icon) this.check('icon', GOAL_CATEGORIES[category]);
    if (!this.touched.progressType) {
      this.check('progressType', CATEGORY_DEFAULT_TYPE[category]);
      this.applyTypeDefaults();
    }
    this.renderPreview();
  },

  // Fill only EMPTY fields, so nothing the user typed is overwritten.
  applyTypeDefaults() {
    const type = this.selected('progressType');
    const fillIfEmpty = (id, value) => {
      if (byId(id).value.trim() === '') byId(id).value = value;
    };
    if (type === 'percent') {
      fillIfEmpty('wiz-start', '0');
      fillIfEmpty('wiz-target', '100');
    }
    if (type === 'levels' && byId('wiz-levels').value.trim() === '') {
      byId('wiz-levels').value = DEFAULT_LEVELS.join(', ');
      this.refreshLevelSelects();
    }
    if (type === 'streak') fillIfEmpty('wiz-unit', t('wizard.defaultUnit.days'));
    this.updateValueFields();
  },

  /* ----- Steps ----- */

  goToStep(step, moveFocus = false) {
    this.step = Math.min(Math.max(step, 1), WIZARD_LAST_STEP);
    this.form.querySelectorAll('.wizard-step').forEach((section) => {
      section.hidden = Number(section.dataset.step) !== this.step;
    });
    this.form.querySelectorAll('.wizard-steps li').forEach((item, index) => {
      item.classList.toggle('is-done', index + 1 < this.step);
      item.classList.toggle('is-current', index + 1 === this.step);
    });
    if (this.step === 3) this.renderPreview();
    if (this.step === 5) this.updateValueFields();
    if (this.step === 7) this.renderReview();
    this.refreshStepTexts();
    this.form.querySelector('.modal-body').scrollTop = 0;
    if (moveFocus) this.focusStepLabel();
  },

  refreshStepTexts() {
    const isLast = this.step === WIZARD_LAST_STEP;
    byId('wizard-title').textContent = t(this.mode === 'edit' ? 'wizard.titleEdit' : 'wizard.titleCreate');
    byId('wizard-step-label').textContent = t('wizard.stepLabel', {
      current: this.step, total: WIZARD_LAST_STEP, name: t(`wizard.step.${this.step}`)
    });
    byId('wiz-back').disabled = this.step === 1;
    // Hidden on step 1, but keeps its place: "Next" stays on the right.
    byId('wiz-back').classList.toggle('invisible', this.step === 1);
    let nextKey = 'wizard.next';
    if (isLast) nextKey = this.mode === 'edit' ? 'wizard.save' : 'wizard.create';
    byId('wiz-next-label').textContent = t(nextKey);
  },

  // After changing the step, focus goes to "Step 3 of 7: Icon and color",
  // so screen reader users hear where they are.
  focusStepLabel() {
    byId('wizard-step-label').focus();
  },

  next() {
    if (!this.validateStep(this.step)) {
      this.attempted.add(this.step);
      this.focusFirstError();
      return;
    }
    if (this.step < WIZARD_LAST_STEP) this.goToStep(this.step + 1, true);
    else this.save();
  },

  focusFirstError() {
    const invalid = this.form.querySelector(`.wizard-step[data-step="${this.step}"] .is-invalid`);
    if (!invalid) return;
    if (invalid.matches('fieldset')) invalid.querySelector('input').focus();
    else if (invalid.matches('ul')) byId('wiz-ms-title').focus();
    else invalid.focus();
  },

  /* ----- Validation (one function per step) ----- */

  validateStep(step) {
    if (step === 1) return this.requireChoice('wiz-category', 'category', 'wizard.error.category');
    if (step === 2) return this.validateText();
    if (step === 3) return this.ensureIconAndColor();
    if (step === 4) return this.requireChoice('wiz-type', 'progressType', 'wizard.error.type');
    if (step === 5) return this.validateValues();
    if (step === 6) return this.validateMilestones();
    return true;
  },

  requireChoice(fieldsetId, name, errorKey) {
    const isChosen = this.selected(name) !== '';
    setGroupError(byId(fieldsetId), isChosen ? null : errorKey);
    return isChosen;
  },

  validateText() {
    const title = byId('wiz-title').value.trim();
    const description = byId('wiz-description').value.trim();
    let titleError = null;
    if (title === '') titleError = 'wizard.error.titleRequired';
    else if (title.length < TITLE_MIN_LENGTH || title.length > TITLE_MAX_LENGTH) titleError = 'wizard.error.titleLength';
    const descriptionError = description.length > DESCRIPTION_MAX_LENGTH ? 'wizard.error.descriptionLength' : null;
    setFieldError(byId('wiz-title'), titleError);
    setFieldError(byId('wiz-description'), descriptionError);
    return !titleError && !descriptionError;
  },

  // Icon and color always have a value, so this step cannot fail.
  ensureIconAndColor() {
    if (!this.selected('icon')) this.check('icon', GOAL_CATEGORIES[this.selected('category')] ?? 'bi-stars');
    if (!this.selected('color')) this.check('color', GOAL_COLORS[0]);
    return true;
  },

  isNewMoneyGoal() {
    return this.mode !== 'edit' && this.selected('progressType') === 'money';
  },

  visibleValueFields() {
    const type = this.selected('progressType') || 'number';
    const fields = [...VALUE_FIELDS[type]];
    // The current value is entered on the goal page later; here only when editing.
    if (this.mode === 'edit' && NUMERIC_TYPES.includes(type)) fields.push('current');
    if (this.mode === 'edit' && type === 'levels') fields.push('levelCurrent');
    return fields;
  },

  validateValues() {
    const type = this.selected('progressType');
    const fields = this.visibleValueFields();
    const errors = new Map(); // input -> error key or null

    if (NUMERIC_TYPES.includes(type)) {
      const max = type === 'percent' ? 100 : null;
      const start = fields.includes('start') ? readNumber(byId('wiz-start')) : 0;
      const target = readNumber(byId('wiz-target'));
      let targetError = numberError(target, { positive: true, max });
      // A new "Money" goal starts at 0; the field holds the current amount, which may equal the target.
      if (!targetError && !this.isNewMoneyGoal() && start === target) targetError = 'wizard.error.sameAsStart';
      if (fields.includes('start')) errors.set(byId('wiz-start'), numberError(start, { min: 0, max }));
      errors.set(byId('wiz-target'), targetError);
      if (fields.includes('current')) errors.set(byId('wiz-current'), numberError(readNumber(byId('wiz-current')), { min: 0, max }));
    }
    if (type === 'levels') {
      const levelsError = this.levelsError();
      errors.set(byId('wiz-levels'), levelsError);
      errors.set(byId('wiz-level-target'), levelsError ? null : this.levelOrderError());
    }
    if (type === 'checklist') {
      errors.set(byId('wiz-check-input'), this.checklist.length > 0 ? null : 'wizard.error.checklistEmpty');
    }
    errors.set(byId('wiz-deadline'), this.deadlineError());

    errors.forEach((errorKey, input) => setFieldError(input, errorKey));
    return [...errors.values()].every((errorKey) => errorKey === null);
  },

  levelsError() {
    const levels = parseLevels(byId('wiz-levels').value);
    if (levels.length < 2) return 'wizard.error.levelsMin';
    const unique = new Set(levels.map((level) => level.toLowerCase()));
    return unique.size === levels.length ? null : 'wizard.error.levelsUnique';
  },

  levelOrderError() {
    const start = Number(byId('wiz-level-start').value);
    const target = Number(byId('wiz-level-target').value);
    return target > start ? null : 'wizard.error.levelOrder';
  },

  // The deadline is optional. An old deadline may stay when editing, but a NEW one cannot be in the past.
  deadlineError() {
    const value = getDateValue(byId('wiz-deadline'));
    if (value === '') return null;
    const date = Dates.parse(value);
    if (!date) return 'profile.error.dateInvalid';
    const isUnchanged = this.mode === 'edit' && value === this.original.deadline;
    return !isUnchanged && date < Dates.today() ? 'wizard.error.deadlinePast' : null;
  },

  validateMilestones() {
    const deadline = Dates.parse(getDateValue(byId('wiz-deadline')));
    const hasLate = Boolean(deadline) && this.milestones.some((milestone) => Dates.parse(milestone.dueDate) > deadline);
    setGroupError(byId('wiz-ms-list'), hasLate ? 'wizard.error.milestonesAfterDeadline' : null);
    return !hasLate;
  },

  /* ----- Step 5: fields that depend on the progress type ----- */

  updateValueFields() {
    const type = this.selected('progressType') || 'number';
    const fields = this.visibleValueFields();
    this.form.querySelectorAll('[data-field]').forEach((block) => {
      block.hidden = !fields.includes(block.dataset.field);
    });
    const hint = byId('wiz-type-hint');
    hint.dataset.i18n = `progressType.${type}.hint`;
    hint.textContent = t(hint.dataset.i18n);
    // A new "Money" goal asks for the amount saved so far (the goal itself starts at 0).
    const startLabel = this.form.querySelector('label[for="wiz-start"]');
    startLabel.dataset.i18n = this.isNewMoneyGoal() ? 'wizard.values.currentAmount' : 'wizard.values.start';
    startLabel.textContent = t(startLabel.dataset.i18n);
    // Errors of fields that are now hidden are no longer relevant.
    this.form.querySelectorAll('[data-field][hidden] .is-invalid').forEach((input) => setFieldError(input, null));
  },

  // Rebuilds the three level selects from the text field.
  // The user's choice is remembered by level NAME (this.levelChoice), so typing in the
  // list (even a broken list for a moment) does not lose "start = A2, target = C1".
  refreshLevelSelects(chosen) {
    if (chosen) this.levelChoice = { ...chosen };
    const levels = parseLevels(byId('wiz-levels').value);
    const defaults = { 'wiz-level-start': 0, 'wiz-level-target': levels.length - 1, 'wiz-level-current': 0 };
    Object.entries(defaults).forEach(([id, defaultIndex]) => {
      const select = byId(id);
      select.replaceChildren(...levels.map((level, index) => createEl('option', { value: String(index) }, level)));
      const keptIndex = levels.indexOf(this.levelChoice[id]);
      if (levels.length) select.value = String(keptIndex >= 0 ? keptIndex : Math.max(defaultIndex, 0));
    });
  },

  addChecklistItem() {
    const input = byId('wiz-check-input');
    const text = input.value.trim();
    if (text === '') {
      setFieldError(input, 'wizard.error.itemRequired');
      input.focus();
      return;
    }
    setFieldError(input, null);
    this.checklist.push({ id: createId('item'), text, done: false });
    input.value = '';
    this.renderChecklist();
    input.focus();
  },

  removeChecklistItem(index) {
    this.checklist.splice(index, 1);
    this.renderChecklist();
    byId('wiz-check-input').focus();
  },

  // Item texts are user data: escaped before going into HTML.
  renderChecklist() {
    byId('wiz-check-list').innerHTML = this.checklist.map((item, index) => `
      <li>
        <input class="form-check-input mt-0" type="checkbox" id="wiz-item-${index}" data-done-index="${index}"${item.done ? ' checked' : ''}>
        <label class="item-text" for="wiz-item-${index}">${escapeHtml(item.text)}</label>
        <button type="button" class="btn btn-icon" data-remove-index="${index}"
                aria-label="${escapeHtml(t('wizard.remove', { text: item.text }))}">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </li>`).join('');
  },

  /* ----- Step 6: milestones ----- */

  addMilestone() {
    const titleInput = byId('wiz-ms-title');
    const dateInput = byId('wiz-ms-date');
    const title = titleInput.value.trim();
    const titleError = title === '' ? 'wizard.error.milestoneTitle' : null;
    const dueDate = getDateValue(dateInput);
    const dateError = this.milestoneDateError(dueDate);
    setFieldError(titleInput, titleError);
    setFieldError(dateInput, dateError);
    if (titleError || dateError) {
      (titleError ? titleInput : dateInput).focus();
      return;
    }
    this.milestones.push({ id: createId('milestone'), title, dueDate, done: false });
    this.milestones.sort(byDueDate);
    titleInput.value = '';
    dateInput.value = '';
    this.renderMilestones();
    this.validateMilestones();
    titleInput.focus();
  },

  milestoneDateError(value) {
    const date = Dates.parse(value);
    if (!date) return 'profile.error.dateInvalid';
    if (date < Dates.today()) return 'wizard.error.deadlinePast';
    const deadline = Dates.parse(getDateValue(byId('wiz-deadline')));
    if (deadline && date > deadline) return 'wizard.error.milestoneAfterDeadline';
    return null;
  },

  removeMilestone(index) {
    this.milestones.splice(index, 1);
    this.renderMilestones();
    this.validateMilestones();
    byId('wiz-ms-title').focus();
  },

  renderMilestones() {
    byId('wiz-ms-empty').hidden = this.milestones.length > 0;
    byId('wiz-ms-list').innerHTML = this.milestones.map((milestone, index) => `
      <li>
        <i class="bi bi-flag" aria-hidden="true"></i>
        <span class="item-text">${escapeHtml(milestone.title)}</span>
        <span class="item-date">${escapeHtml(Format.shortDate(milestone.dueDate))}</span>
        <button type="button" class="btn btn-icon" data-remove-index="${index}"
                aria-label="${escapeHtml(t('wizard.remove', { text: milestone.title }))}">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </li>`).join('');
  },

  /* ----- Preview (step 3) and review (step 7) ----- */

  renderPreview() {
    const preview = byId('wiz-preview');
    preview.dataset.color = this.selected('color') || GOAL_COLORS[0];
    preview.querySelector('i').className = `bi ${this.selected('icon') || 'bi-stars'}`;
    byId('wiz-preview-title').textContent = byId('wiz-title').value.trim();
  },

  renderReview() {
    const goal = this.readGoal();
    const preview = byId('wiz-review-preview');
    preview.dataset.color = goalColor(goal);
    preview.querySelector('i').className = `bi ${goalIcon(goal)}`;
    byId('wiz-review-title').textContent = goal.title;

    const milestones = goal.milestones.map((milestone) => `${milestone.title} — ${Format.shortDate(milestone.dueDate)}`);
    const rows = [
      ['wizard.step.1', goalCategoryName(goal.category)],
      ['wizard.description.label', goal.description || '—'],
      ['wizard.step.4', t(`progressType.${goal.progressType}`)],
      ['wizard.review.values', this.reviewValues(goal)],
      ['wizard.values.deadline', goal.deadline ? Format.date(goal.deadline, { dateStyle: 'long' }) : t('goals.deadline.none')],
      ['wizard.step.6', milestones.length ? milestones : t('wizard.milestones.empty')]
    ];
    // Every value is escaped; a list of milestones becomes <ul>.
    byId('wiz-review').innerHTML = rows.map(([labelKey, value]) => {
      const valueHtml = Array.isArray(value)
        ? `<ul>${value.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
        : escapeHtml(value);
      return `<dt>${escapeHtml(t(labelKey))}</dt><dd>${valueHtml}</dd>`;
    }).join('');
  },

  reviewValues(goal) {
    if (goal.progressType === 'checklist') return tPlural('wizard.review.items', goal.checklist.length);
    if (goal.progressType === 'levels') return `${goal.levels[goal.startValue]} → ${goal.levels[goal.targetValue]}`;
    const text = `${formatGoalValue(goal, goal.startValue)} → ${formatGoalValue(goal, goal.targetValue)}`;
    if (this.isNewMoneyGoal()) return `${text} (${t('wizard.values.currentAmount')}: ${formatGoalValue(goal, goal.currentValue)})`;
    if (this.mode !== 'edit') return text;
    return `${text} (${t('wizard.values.current')}: ${formatGoalValue(goal, goal.currentValue)})`;
  },

  // Texts made by JS must be redrawn when the language changes.
  refreshTexts() {
    this.refreshStepTexts();
    this.renderChecklist();
    this.renderMilestones();
    if (this.step === 7) this.renderReview();
  },

  /* ----- Building the goal object and saving ----- */

  readGoal() {
    const type = this.selected('progressType');
    const base = this.mode === 'edit' ? this.original : {};
    const now = new Date().toISOString();
    return {
      ...base, // keeps fields this dialog does not edit
      id: base.id ?? createId('goal'),
      title: byId('wiz-title').value.trim(),
      description: byId('wiz-description').value.trim(),
      category: this.selected('category'),
      icon: this.selected('icon'),
      color: this.selected('color'),
      progressType: type,
      ...this.readValues(type),
      deadline: getDateValue(byId('wiz-deadline')) || null,
      milestones: this.milestones.map((milestone) => ({ ...milestone })),
      status: base.status ?? 'active',
      createdAt: base.createdAt ?? now,
      updatedAt: now
    };
  },

  // start/target/current/unit/levels/checklist for the chosen progress type.
  readValues(type) {
    const empty = { unit: '', levels: [], checklist: [] };
    const isEdit = this.mode === 'edit';

    if (type === 'levels') {
      const start = Number(byId('wiz-level-start').value);
      return {
        ...empty,
        levels: parseLevels(byId('wiz-levels').value),
        startValue: start,
        targetValue: Number(byId('wiz-level-target').value),
        currentValue: isEdit ? Number(byId('wiz-level-current').value) : start
      };
    }
    if (type === 'checklist') {
      const checklist = this.checklist.map((item) => ({ ...item }));
      return {
        ...empty,
        checklist,
        startValue: 0,
        targetValue: checklist.length,
        currentValue: checklist.filter((item) => item.done).length
      };
    }
    const fields = VALUE_FIELDS[type];
    const start = fields.includes('start') ? readNumber(byId('wiz-start')) : 0;
    let unit = '';
    if (type === 'money') unit = byId('wiz-currency').value;
    else if (fields.includes('unit')) unit = byId('wiz-unit').value.trim();
    if (this.isNewMoneyGoal()) {
      // The field is "Current amount": saving starts at 0, so 1.5 M of 7 M is already 21%.
      return { ...empty, unit, startValue: 0, targetValue: readNumber(byId('wiz-target')), currentValue: start };
    }
    return {
      ...empty,
      unit,
      startValue: start,
      targetValue: readNumber(byId('wiz-target')),
      currentValue: isEdit ? readNumber(byId('wiz-current')) : start
    };
  },

  // Locks the "Create"/"Save" button so a double click or double Enter saves only once.
  setSaving(isSaving) {
    this.isSaving = isSaving;
    byId('wiz-next').disabled = isSaving;
  },

  save() {
    if (this.isSaving) return; // already saved, the dialog is closing
    // Check every step again: jump to the first one with a problem.
    for (let step = 1; step < WIZARD_LAST_STEP; step++) {
      if (!this.validateStep(step)) {
        this.setSaving(false);
        this.attempted.add(step);
        this.goToStep(step, true);
        this.focusFirstError();
        return;
      }
    }

    this.setSaving(true);
    const goal = this.readGoal();
    const goals = getGoals();
    const wasEdit = this.mode === 'edit';
    if (wasEdit) {
      const index = goals.findIndex((item) => item.id === goal.id);
      if (index === -1) {
        showToast('toast.goalNotFound', 'warning');
        this.setSaving(false);
        return;
      }
      goals[index] = goal;
    } else {
      goals.push(goal);
    }
    if (!saveGoals(goals)) { // the storage error toast is already shown
      this.setSaving(false);
      return;
    }

    this.hasDraft = false;
    this.savedGoalId = goal.id;
    bootstrap.Modal.getInstance(this.modalEl).hide();
    showToast(wasEdit ? 'toast.goalUpdated' : 'toast.goalCreated', 'success', { title: goal.title });
    document.dispatchEvent(new CustomEvent('lifeos:goalschange', { detail: { goalId: goal.id } }));
  }
};
