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
  'bi-trophy', 'bi-bicycle', 'bi-music-note-beamed', 'bi-stars',
  'bi-airplane', 'bi-house', 'bi-car-front', 'bi-code-slash', 'bi-palette',
  'bi-camera', 'bi-moon-stars', 'bi-droplet', 'bi-tree', 'bi-people'
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

// Step 5: the labels of the two value fields by the progress type (a new goal; editing keeps "Start value").
const VALUE_LABELS = {
  number: ['wizard.values.doneSoFar', 'wizard.values.totalNeeded'],
  money: ['wizard.values.savedSoFar', 'wizard.values.needToSave'],
  percent: ['wizard.values.now', 'wizard.values.wantToReach'],
  measurements: ['wizard.values.now', 'wizard.values.wantToReach'],
  streak: ['wizard.values.start', 'wizard.values.daysInRow']
};
// Examples in the empty fields, in words ("e.g. 12"), so they do not look like typed values: [start, target]
const VALUE_EXAMPLES = { number: [0, 12], money: [0, 500000], percent: [0, 100], measurements: [92, 80], streak: [0, 30] };

const NUMERIC_TYPES = ['number', 'money', 'percent', 'streak', 'measurements'];

// "Already done / Already saved / Now" of a new goal is a real 0: most goals start from zero.
// Measurements start empty (a weight is never 0).
const START_ZERO_TYPES = ['number', 'money', 'percent'];

// "Number" with a target at or below "Already done": the error offers the "Measurements" type.
const NUMBER_TARGET_ERROR = 'wizard.error.numberTargetAboveStart';

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

// The start value of a new goal: 0 or null (the field stays empty).
function defaultStartValue(type) {
  return START_ZERO_TYPES.includes(type) ? 0 : null;
}

// "e.g. 12" (an empty string when there is no example)
function valueExampleText(number) {
  return Number.isFinite(number) ? t('wizard.values.example', { value: formatNumberValue(number) }) : '';
}

// The error of "How many in total" (null = fine).
function targetValueError(type, start, target, { isNewMoney = false } = {}) {
  const error = numberError(target, { positive: true, max: type === 'percent' ? 100 : null });
  if (error || !Number.isFinite(start)) return error;
  // A "Number" only grows (entries are +1, +5…): a target at or below the start would stay at 0 % forever.
  if (type === 'number' && target <= start) return NUMBER_TARGET_ERROR;
  // A new "Money" goal starts at 0; the field holds the current amount, which may equal the target.
  if (!isNewMoney && start === target) return 'wizard.error.sameAsStart';
  return null;
}

// Editing a goal that already had these start and target values (and this type): an old "Number"
// with target <= start is only warned about, so its title or deadline can still be saved.
function keepsOldValues(original, type, start, target) {
  return Boolean(original) && original.progressType === type
    && Number(original.startValue) === start && Number(original.targetValue) === target;
}

// Pure: start and current of an edited goal. The field "Already done / Already saved / Now" shows the
// CURRENT value; the current value is changed only by entries, so the field changes the goal only when
// the goal has no entries yet and the user typed another number. Money keeps its start (0).
function editedNumbers(original, type, fieldValue, hasEntries) {
  const oldStart = Number(original.startValue) || 0;
  const oldCurrent = Number(original.currentValue) || 0;
  const changed = !hasEntries && Number.isFinite(fieldValue) && fieldValue !== oldCurrent;
  if (!changed) return { startValue: oldStart, currentValue: oldCurrent };
  if (type === 'money') return { startValue: oldStart, currentValue: fieldValue };
  return { startValue: fieldValue, currentValue: fieldValue };
}

// Pure: the current level of an edited "Levels" goal: a new start level moves it only without entries.
function editedLevelCurrent(original, start, hasEntries) {
  const changed = !hasEntries && start !== Number(original.startValue);
  return changed ? start : Number(original.currentValue) || 0;
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
            <!-- The limits are in the "?" tips; the counter "12/80" shows while the field has the focus.
                 Its line keeps its height when it hides (.field-meta), so "Next" does not jump under the mouse. -->
            <div class="mb-3">
              <div class="help-title field-label">
                <label class="form-label" for="wiz-title" data-i18n="wizard.title.label">Goal title</label>
                <button type="button" class="btn help-tip" data-help="goalTitle" data-i18n-aria-label="onboarding.help.goalTitle.label" aria-label="About the goal title"><i class="bi bi-question-circle" aria-hidden="true"></i></button>
              </div>
              <input class="form-control" type="text" id="wiz-title" autocomplete="off" data-char-limit="80" data-i18n-placeholder="wizard.title.placeholder">
              <div class="field-meta">
                <p class="field-error" id="wiz-title-error"></p>
                <span class="char-count" id="wiz-title-count" aria-hidden="true" hidden></span>
              </div>
            </div>
            <div>
              <div class="help-title field-label">
                <label class="form-label" for="wiz-description" data-i18n="wizard.description.label">Description</label>
                <button type="button" class="btn help-tip" data-help="goalDescription" data-i18n-aria-label="onboarding.help.goalDescription.label" aria-label="About the description"><i class="bi bi-question-circle" aria-hidden="true"></i></button>
              </div>
              <textarea class="form-control" id="wiz-description" rows="3" data-char-limit="300" data-i18n-placeholder="wizard.description.placeholder"></textarea>
              <div class="field-meta">
                <p class="field-error" id="wiz-description-error"></p>
                <span class="char-count" id="wiz-description-count" aria-hidden="true" hidden></span>
              </div>
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
            <div class="row g-3">
              <!-- "Books" + "Number": keep a list of books (Goal Details → My books); then "What do you count" = books -->
              <div class="col-12" data-field="bookList">
                <div class="form-check form-switch wiz-book-switch">
                  <input class="form-check-input" type="checkbox" role="switch" id="wiz-book-list" checked aria-describedby="wiz-book-list-hint">
                  <label class="form-check-label" for="wiz-book-list" data-i18n="wizard.books.toggle">Keep a list of books</label>
                </div>
                <div class="form-text" id="wiz-book-list-hint" data-i18n="wizard.books.hint">Add books on the goal page and record pages: the goal counts finished books by itself.</div>
              </div>
              <!-- First: what is counted (books, km…). Not for money (the currency) and percent (%). -->
              <div class="col-12 wiz-unit-field" data-field="unit">
                <label class="form-label" for="wiz-unit" data-i18n="wizard.values.what">What do you count</label>
                <input class="form-control" type="text" id="wiz-unit" maxlength="20" autocomplete="off" data-i18n-placeholder="wizard.values.whatPlaceholder">
              </div>
              <div class="col-12 wiz-unit-field" data-field="currency">
                <label class="form-label" for="wiz-currency" data-i18n="wizard.values.currency">Currency</label>
                <select class="form-select" id="wiz-currency">
                  <option value="KZT" data-i18n="currency.KZT">Tenge (₸)</option>
                  <option value="USD" data-i18n="currency.USD">US dollar ($)</option>
                  <option value="EUR" data-i18n="currency.EUR">Euro (€)</option>
                  <option value="RUB" data-i18n="currency.RUB">Russian ruble (₽)</option>
                </select>
              </div>
              <div class="col-sm-6" data-field="start">
                <label class="form-label" for="wiz-start" data-i18n="wizard.values.start">Start value</label>
                <div class="input-group">
                  <input class="form-control" type="text" id="wiz-start" inputmode="decimal" autocomplete="off" data-number="decimal" data-minus-hint="number.minus.positiveOnly">
                  <span class="input-group-text wiz-value-unit" hidden></span>
                </div>
                <!-- Editing a goal with entries: the value is shown, but only entries change it -->
                <div class="form-text" id="wiz-start-hint" hidden></div>
                <p class="field-error" id="wiz-start-error"></p>
              </div>
              <div class="col-sm-6" data-field="target">
                <label class="form-label" for="wiz-target" data-i18n="wizard.values.target">Target value</label>
                <div class="input-group">
                  <input class="form-control" type="text" id="wiz-target" inputmode="decimal" autocomplete="off" data-number="decimal" data-minus-hint="number.minus.positiveOnly">
                  <span class="input-group-text wiz-value-unit" hidden></span>
                </div>
                <p class="field-error" id="wiz-target-error"></p>
                <!-- Editing an old "Number" with target <= start: a warning, the goal can still be saved -->
                <p class="form-text field-warning" id="wiz-target-warning" role="status" hidden></p>
                <!-- Shown with the "Number" error / warning: switches the type and opens step 4 -->
                <button type="button" class="btn btn-link field-error-action" id="wiz-to-measurements" hidden data-i18n="wizard.error.chooseMeasurements">Choose “Measurements”</button>
              </div>
              <div class="col-12" data-field="levels">
                <label class="form-label" for="wiz-levels" data-i18n="wizard.values.levels">Levels in order</label>
                <input class="form-control" type="text" id="wiz-levels" autocomplete="off" aria-describedby="wiz-levels-hint">
                <div class="form-text" id="wiz-levels-hint" data-i18n="wizard.values.levelsHint">Separate with commas, from lowest to highest.</div>
                <p class="field-error" id="wiz-levels-error"></p>
                <div class="row g-3 mt-0">
                  <div class="col-sm-6">
                    <label class="form-label" for="wiz-level-start" data-i18n="wizard.values.levelStart">Start level</label>
                    <select class="form-select" id="wiz-level-start"></select>
                  </div>
                  <div class="col-sm-6">
                    <label class="form-label" for="wiz-level-target" data-i18n="wizard.values.levelTarget">Target level</label>
                    <select class="form-select" id="wiz-level-target"></select>
                    <p class="field-error" id="wiz-level-target-error"></p>
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
                <div class="help-title field-label">
                  <label class="form-label" for="wiz-deadline" data-i18n="wizard.values.deadlineOptional">Deadline (optional)</label>
                  <button type="button" class="btn help-tip" data-help="deadline" data-i18n-aria-label="onboarding.help.deadline.label" aria-label="About the deadline"><i class="bi bi-question-circle" aria-hidden="true"></i></button>
                </div>
                <input class="form-control" type="text" inputmode="numeric" maxlength="10" autocomplete="off" data-date-field data-min-error="wizard.error.deadlinePast" data-i18n-placeholder="date.placeholder" id="wiz-deadline">
                <p class="field-error" id="wiz-deadline-error"></p>
              </div>

              <!-- "Goal: 13 books. Now 0 — 13 to go by 31.12.2027" (updated while typing) -->
              <div class="col-12">
                <p class="wiz-summary" id="wiz-summary" aria-live="polite" hidden></p>
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
                <input class="form-control" type="text" inputmode="numeric" maxlength="10" autocomplete="off" data-date-field data-min-error="wizard.error.deadlinePast" data-max-error="wizard.error.milestoneAfterDeadline" data-i18n-placeholder="date.placeholder" id="wiz-ms-date">
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
  hasEntries: false, // editing a goal with entries: "Already done" is only shown (entries change it)

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
    setNumberValue(byId('wiz-start'), template.start);
    setNumberValue(byId('wiz-target'), template.target);
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
      // Icons and colors have no visible text: the name is the tooltip (and the hidden text for screen readers).
      const label = createEl('label', item.hiddenText
        ? { class: labelClass, for: id, title: t(item.key), 'data-i18n-title': item.key }
        : { class: labelClass, for: id });
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
    byId('wiz-back').addEventListener('click', () => this.goToStep(this.stepAfter(this.step, -1), true));
    this.form.addEventListener('change', (event) => this.onChange(event));
    this.form.addEventListener('input', (event) => {
      if (event.target.id === 'wiz-levels') this.refreshLevelSelects();
      if (event.target.id === 'wiz-title') this.renderPreview();
      if (event.target.dataset.charLimit) this.updateCharCount(event.target);
      if (event.target.id === 'wiz-unit') this.updateValueUnits();
      if (event.target.id === 'wiz-start') delete event.target.dataset.autoValue; // typed by the user now
      if (this.step === 5) this.renderSummary();
      if (this.attempted.has(this.step)) this.validateStep(this.step);
      else if (this.step === 5) this.refreshNumberWarning();
    });

    this.form.querySelectorAll('[data-char-limit]').forEach((input) => {
      input.addEventListener('focus', () => this.updateCharCount(input, true));
      input.addEventListener('blur', () => this.updateCharCount(input, false));
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

    byId('wiz-to-measurements').addEventListener('click', () => this.switchToMeasurements());

    this.modalEl.addEventListener('shown.bs.modal', () => this.focusStepLabel());
    this.modalEl.addEventListener('keydown', (event) => this.keepFocusInside(event));
    document.addEventListener('lifeos:languagechange', () => {
      if (this.modalEl.classList.contains('show')) this.refreshTexts();
    });
  },

  // Tab and Shift+Tab go round inside the dialog: from "Next" to the close button and back,
  // so the focus never reaches "Skip to content" behind the dialog.
  keepFocusInside(event) {
    if (event.key !== 'Tab') return;
    const first = this.modalEl.querySelector('.btn-close');
    const last = byId('wiz-next');
    const active = document.activeElement;
    const atStart = active === first || active === byId('wizard-step-label') || active === this.modalEl;
    if (event.shiftKey && atStart) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
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
    if (['wiz-level-start', 'wiz-level-target'].includes(id)) {
      this.levelChoice[id] = event.target.selectedOptions[0]?.textContent;
    }
    if (name === 'category') this.applyCategoryDefaults(value);
    if (name === 'icon') this.touched.icon = true;
    if (name === 'progressType') {
      this.touched.progressType = true;
      this.applyTypeDefaults();
    }
    if (name === 'icon' || name === 'color') this.renderPreview();
    if (id === 'wiz-currency') this.updateValueUnits();
    if (id === 'wiz-book-list') this.updateValueFields();
    if (id === 'wiz-deadline') this.updateDateLimits();
    if (this.step === 5) this.renderSummary();
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
    this.hasEntries = getGoalEntries(goal.id).length > 0;
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
    delete byId('wiz-start').dataset.autoValue;
    byId('wiz-to-measurements').hidden = true;
    this.showNumberWarning(false);
    this.checklist = [];
    this.milestones = [];
    this.touched = { icon: false, progressType: false };
    this.attempted = new Set();
    this.hasEntries = false;
    this.step = 1;
    this.check('color', GOAL_COLORS[0]);
    byId('wiz-currency').value = DEFAULT_CURRENCY;
    this.refreshLevelSelects({});
    this.renderChecklist();
    this.renderMilestones();
    this.form.querySelectorAll('[data-char-limit]').forEach((input) => this.updateCharCount(input, false));
  },

  fillFromGoal(goal) {
    const type = PROGRESS_TYPES.includes(goal.progressType) ? goal.progressType : 'number';
    // 10000000 -> "10 000 000", the same look as while typing.

    this.check('category', goal.category in GOAL_CATEGORIES ? goal.category : 'custom');
    byId('wiz-title').value = goal.title ?? '';
    byId('wiz-description').value = goal.description ?? '';
    this.check('icon', goalIcon(goal));
    this.check('color', goalColor(goal));
    this.check('progressType', type);
    this.touched = { icon: true, progressType: true };

    // "Already done / Already saved / Now" = the current value, as when the goal was created
    setNumberValue(byId('wiz-start'), goal.currentValue);
    setNumberValue(byId('wiz-target'), goal.targetValue);
    byId('wiz-book-list').checked = goal.bookList !== false; // on by default (also for an old book goal)
    if (type === 'money') byId('wiz-currency').value = goal.unit || DEFAULT_CURRENCY;
    else byId('wiz-unit').value = goal.unit ?? '';

    const levels = asArray(goal.levels);
    byId('wiz-levels').value = levels.join(', ');
    this.refreshLevelSelects({
      'wiz-level-start': levels[goal.startValue],
      'wiz-level-target': levels[goal.targetValue]
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
    if (this.mode !== 'edit') this.applyStartDefault(type);
    if (type === 'percent') fillIfEmpty('wiz-target', '100');
    if (type === 'levels' && byId('wiz-levels').value.trim() === '') {
      byId('wiz-levels').value = DEFAULT_LEVELS.join(', ');
      this.refreshLevelSelects();
    }
    if (type === 'streak') fillIfEmpty('wiz-unit', t('wizard.defaultUnit.days'));
    this.updateValueFields();
  },

  // A new goal: an empty "Already done" gets a real 0. A 0 put here by this function (not typed)
  // is taken away again when the type becomes "Measurements".
  applyStartDefault(type) {
    const start = byId('wiz-start');
    const startValue = defaultStartValue(type);
    if (startValue !== null && start.value.trim() === '') {
      setNumberValue(start, startValue);
      start.dataset.autoValue = 'true';
    } else if (startValue === null && start.dataset.autoValue === 'true') {
      start.value = '';
      delete start.dataset.autoValue;
    }
  },

  // The link under the "Number" error: the type becomes "Measurements", the user sees it on step 4.
  switchToMeasurements() {
    this.check('progressType', 'measurements');
    this.touched.progressType = true;
    this.applyTypeDefaults();
    this.attempted.delete(5);
    ['wiz-start', 'wiz-target'].forEach((id) => setFieldError(byId(id), null));
    byId('wiz-to-measurements').hidden = true;
    this.showNumberWarning(false);
    this.goToStep(4, true);
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
    if (this.step === 5 || this.step === 6) this.updateDateLimits();
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
    if (this.step < WIZARD_LAST_STEP) this.goToStep(this.stepAfter(this.step, 1), true);
    else this.save();
  },

  // A goal with a book list has no milestones (its progress is the books): step 6 is skipped both ways.
  // Its old milestones stay in the goal (this.milestones is saved as it is).
  skipsMilestones() {
    return this.bookListOn();
  },

  stepAfter(step, direction) {
    const next = step + direction;
    return next === 6 && this.skipsMilestones() ? next + direction : next;
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
    if (step === 6) return this.addTypedMilestone() && this.validateMilestones();
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
    // The same fields as when the goal was created: the current value is changed by entries only.
    const fields = [...VALUE_FIELDS[type]];
    if (!this.isBookGoalChoice()) return fields;
    // A book list counts the goal by itself: editing shows no "Already done".
    const hidden = this.bookListOn() && this.mode === 'edit' ? ['start'] : [];
    return ['bookList', ...fields.filter((field) => !hidden.includes(field))];
  },

  // "Books" + "Number": the goal may keep a book list (app.js, section 11a).
  isBookGoalChoice() {
    return this.selected('category') === 'books' && this.selected('progressType') === 'number';
  },

  bookListOn() {
    return this.isBookGoalChoice() && byId('wiz-book-list').checked;
  },

  // With a book list "What do you count" is "books" and cannot be changed.
  updateBookUnit() {
    const unit = byId('wiz-unit');
    unit.readOnly = this.bookListOn();
    if (unit.readOnly) unit.value = t('demo.books.unit');
  },

  // Editing: is "Already done" only shown (the goal has entries)?
  isStartLocked() {
    return this.mode === 'edit' && this.hasEntries;
  },

  // A goal with entries: the field is read-only with the hint "Changes with the entries of the goal".
  updateStartLock() {
    const locked = this.isStartLocked();
    const input = byId('wiz-start');
    const hint = byId('wiz-start-hint');
    input.readOnly = locked;
    hint.hidden = !locked;
    hint.dataset.i18n = 'wizard.values.changedByEntries';
    hint.textContent = locked ? t(hint.dataset.i18n) : '';
    if (locked) {
      setFieldError(input, null);
      input.setAttribute('aria-describedby', hint.id);
    } else if (input.getAttribute('aria-describedby') === hint.id) {
      input.removeAttribute('aria-describedby');
    }
  },

  // { startValue, currentValue } the form gives now. Creating: the field is the start (money: the amount
  // saved, the goal starts at 0). Editing: see editedNumbers().
  formNumbers(type = this.selected('progressType')) {
    const hasStart = this.visibleValueFields().includes('start');
    const field = hasStart ? readNumber(byId('wiz-start')) : NaN;
    if (this.mode === 'edit') return editedNumbers(this.original, type, field, this.isStartLocked());
    const start = hasStart ? field : 0;
    return type === 'money' ? { startValue: 0, currentValue: start } : { startValue: start, currentValue: start };
  },

  validateValues() {
    const type = this.selected('progressType');
    const fields = this.visibleValueFields();
    const errors = new Map(); // input -> error key or null
    let targetError = null;
    let warnOnly = false;

    if (NUMERIC_TYPES.includes(type)) {
      const max = type === 'percent' ? 100 : null;
      const field = fields.includes('start') ? readNumber(byId('wiz-start')) : 0;
      // A new goal: the field is the start; an edited one keeps its start unless the field changed it.
      const start = this.mode === 'edit' ? this.formNumbers(type).startValue : field;
      const target = readNumber(byId('wiz-target'));
      targetError = targetValueError(type, start, target, { isNewMoney: this.isNewMoneyGoal() });
      warnOnly = targetError === NUMBER_TARGET_ERROR && this.isOldNumberProblem();
      if (warnOnly) targetError = null;
      if (fields.includes('start') && !this.isStartLocked()) errors.set(byId('wiz-start'), numberError(field, { min: 0, max }));
      errors.set(byId('wiz-target'), targetError);
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
    this.showNumberWarning(warnOnly);
    byId('wiz-to-measurements').hidden = targetError !== NUMBER_TARGET_ERROR && !warnOnly;
    return [...errors.values()].every((errorKey) => errorKey === null);
  },

  // Editing an old "Number" whose target is already <= start, and the user has not changed these values.
  isOldNumberProblem() {
    if (this.mode !== 'edit' || this.selected('progressType') !== 'number' || !this.visibleValueFields().includes('start')) return false;
    const start = this.formNumbers('number').startValue;
    const target = readNumber(byId('wiz-target'));
    return targetValueError('number', start, target) === NUMBER_TARGET_ERROR && keepsOldValues(this.original, 'number', start, target);
  },

  // The warning is shown as soon as step 5 opens (and updated while typing), not only after "Next".
  refreshNumberWarning() {
    const isShown = this.isOldNumberProblem();
    this.showNumberWarning(isShown);
    const hasError = byId('wiz-target-error').dataset.i18n === NUMBER_TARGET_ERROR;
    byId('wiz-to-measurements').hidden = !isShown && !hasError;
  },

  showNumberWarning(isShown) {
    const warning = byId('wiz-target-warning');
    warning.hidden = !isShown;
    warning.dataset.i18n = 'wizard.warning.numberTargetAboveStart';
    warning.textContent = isShown ? t(warning.dataset.i18n) : '';
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

  // "₸" (money) or "%" (percent) as a label to the right of the number fields, not inside the text.
  // "Already done" / "How many in total" for a number, "Already saved" / "Need to save" for money…
  // (a new "Money" goal asks for the amount saved so far: the goal itself starts at 0).
  updateValueLabels(type) {
    const [startKey, targetKey] = VALUE_LABELS[type] ?? ['wizard.values.start', 'wizard.values.target'];
    const setLabel = (id, key) => {
      const label = this.form.querySelector(`label[for="${id}"]`);
      label.dataset.i18n = key;
      label.textContent = t(key);
    };
    setLabel('wiz-start', startKey); // editing: the same words as when the goal was created
    setLabel('wiz-target', targetKey);
    const [startExample, targetExample] = VALUE_EXAMPLES[type] ?? [null, null];
    byId('wiz-start').placeholder = valueExampleText(startExample);
    byId('wiz-target').placeholder = valueExampleText(targetExample);
  },

  // What the numbers are: "₸" (money), "%" (percent) or the text of "What do you count" (books, km…).
  valueUnit(type = this.selected('progressType')) {
    if (type === 'money') return Format.currencySymbol(byId('wiz-currency').value || DEFAULT_CURRENCY);
    if (type === 'percent') return '%';
    return VALUE_FIELDS[type]?.includes('unit') ? byId('wiz-unit').value.trim() : '';
  },

  // "Goal: 13 books. Now 0 — 13 to go by 31.12.2027" under the fields (only for number-like types).
  renderSummary() {
    const summary = byId('wiz-summary');
    const type = this.selected('progressType');
    const target = readNumber(byId('wiz-target'));
    const hasField = this.visibleValueFields().includes('start');
    const field = hasField ? readNumber(byId('wiz-start')) : NaN;
    // The sentence uses what is typed ("Now 200 000 — 800 000 to go"); editing a streak: its current value
    let current = hasField ? field : 0;
    if (this.mode === 'edit' && !hasField) current = Number(this.original.currentValue) || 0;
    // A "Number" that cannot grow to its target has its own error: no "40 to go" sentence then.
    const start = NUMERIC_TYPES.includes(type) && (!hasField || Number.isFinite(field)) ? this.formNumbers(type).startValue : 0;
    const cannotGrow = type === 'number' && target <= start;
    summary.hidden = !NUMERIC_TYPES.includes(type) || !Number.isFinite(target) || !Number.isFinite(current) || cannotGrow;
    if (summary.hidden) return;
    const goal = { progressType: type, unit: type === 'money' ? byId('wiz-currency').value : this.valueUnit(type) };
    if (this.bookListOn()) Object.assign(goal, { category: 'books', bookList: true }); // "Goal: 13 books. Now 1 book" with plurals
    const values = { target: formatGoalValue(goal, target), current: formatGoalValue(goal, current), left: formatGoalValue(goal, Math.abs(target - current)) };
    const deadline = dateTextToIso(byId('wiz-deadline').value);
    let key = deadline ? 'wizard.summary.until' : 'wizard.summary.plain';
    if (target === current) key = 'wizard.summary.reached';
    summary.textContent = t(key, { ...values, date: deadline ? Format.date(deadline, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '' });
  },

  // The character counter under the title and the description: "12/80" while the field has the focus.
  updateCharCount(input, show = document.activeElement === input) {
    const counter = byId(`${input.id}-count`);
    if (!counter) return;
    const limit = Number(input.dataset.charLimit);
    counter.textContent = `${input.value.length}/${limit}`;
    counter.classList.toggle('is-over', input.value.length > limit);
    counter.hidden = !show && input.value.length <= limit;
  },

  updateValueUnits() {
    const unit = this.valueUnit();
    this.form.querySelectorAll('.wiz-value-unit').forEach((label) => {
      label.textContent = unit;
      label.hidden = unit === '';
    });
  },

  // The limits of the dates — in the check when a field is left and in the calendar:
  // the deadline is not in the past (an old deadline of an edited goal may stay),
  // a milestone is between today and the deadline.
  updateDateLimits() {
    const today = Dates.toISO(Dates.today());
    const oldDeadline = this.mode === 'edit' ? this.original?.deadline : null;
    setDateLimits(byId('wiz-deadline'), { min: oldDeadline && oldDeadline < today ? oldDeadline : today });
    const deadline = dateTextToIso(byId('wiz-deadline').value);
    setDateLimits(byId('wiz-ms-date'), { min: today, max: deadline ?? '' });
  },

  updateValueFields() {
    const type = this.selected('progressType') || 'number';
    const fields = this.visibleValueFields();
    this.updateBookUnit();
    this.form.querySelectorAll('[data-field]').forEach((block) => {
      block.hidden = !fields.includes(block.dataset.field);
    });
    this.updateValueLabels(type);
    this.updateValueUnits();
    this.updateStartLock();
    this.renderSummary();
    this.refreshNumberWarning();
    // Errors of fields that are now hidden are no longer relevant.
    this.form.querySelectorAll('[data-field][hidden] .is-invalid').forEach((input) => setFieldError(input, null));
  },

  // Rebuilds the three level selects from the text field.
  // The user's choice is remembered by level NAME (this.levelChoice), so typing in the
  // list (even a broken list for a moment) does not lose "start = A2, target = C1".
  refreshLevelSelects(chosen) {
    if (chosen) this.levelChoice = { ...chosen };
    const levels = parseLevels(byId('wiz-levels').value);
    const defaults = { 'wiz-level-start': 0, 'wiz-level-target': levels.length - 1 };
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

  // The title or the date of a milestone is typed, but "Add" was not pressed: add it now, so it is not lost.
  addTypedMilestone() {
    const isTyped = byId('wiz-ms-title').value.trim() !== '' || byId('wiz-ms-date').value.trim() !== '';
    return isTyped ? this.addMilestone() : true;
  },

  // Returns true when the milestone was added (false: the errors are shown next to the fields).
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
      return false;
    }
    this.milestones.push({ id: createId('milestone'), title, dueDate, done: false });
    this.milestones.sort(byDueDate);
    titleInput.value = '';
    dateInput.value = '';
    this.renderMilestones();
    this.validateMilestones();
    titleInput.focus();
    return true;
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
      [goal.progressType === 'money' ? 'wizard.review.saved' : 'wizard.review.values', this.reviewValues(goal)], // money: "Saved"
      ['wizard.values.deadline', goal.deadline ? Format.date(goal.deadline, { dateStyle: 'long' }) : t('goals.deadline.none')]
    ];
    // A book list goal: no milestones row (the step is skipped)
    if (!this.skipsMilestones()) rows.push(['wizard.step.6', milestones.length ? milestones : t('wizard.milestones.empty')]);
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
    // Money: "200 000 ₸ of 1 000 000 ₸" (a new goal starts at 0, so "0 ₸ → …" said nothing)
    if (goal.progressType === 'money') {
      return t('wizard.review.moneyOf', { current: formatGoalValue(goal, goal.currentValue), target: formatGoalValue(goal, goal.targetValue) });
    }
    const text = `${formatGoalValue(goal, goal.startValue)} → ${formatGoalValue(goal, goal.targetValue)}`;
    if (this.mode !== 'edit') return text;
    return `${text} (${t('wizard.values.current')}: ${formatGoalValue(goal, goal.currentValue)})`;
  },

  // Texts made by JS must be redrawn when the language changes.
  refreshTexts() {
    this.refreshStepTexts();
    if (this.step === 5) this.updateValueFields(); // the labels, the examples (number format) and the sentence
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
        currentValue: isEdit ? editedLevelCurrent(this.original, start, this.hasEntries) : start
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
    let unit = '';
    if (type === 'money') unit = byId('wiz-currency').value;
    else if (fields.includes('unit')) unit = byId('wiz-unit').value.trim();
    // A new "Money" goal starts at 0: "Already saved" is its current amount, so 1.5 M of 7 M is 21 %.
    const values = { ...empty, unit, ...this.formNumbers(type), targetValue: readNumber(byId('wiz-target')) };
    return this.isBookGoalChoice() ? this.withBookList(values) : values;
  },

  // The book list of a "Books" goal. On: "Already done: N" of a new goal (or the old counter of a goal
  // that had no list) becomes N finished books without a title; the counter = the finished books.
  // Off: the books stay saved (hidden), the counter is a plain number again.
  withBookList(values) {
    if (!byId('wiz-book-list').checked) return { ...values, bookList: false };
    const base = this.mode === 'edit' ? this.original : {};
    let books = goalBooks(base);
    if (books.length === 0 && base.bookList !== true) books = untitledDoneBooks(this.mode === 'edit' ? base.currentValue : values.currentValue);
    return { ...values, bookList: true, books, startValue: 0, currentValue: countDoneBooks(books) };
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
      if (step === 6 && this.skipsMilestones()) continue; // hidden milestones never block saving
      if (!this.validateStep(step)) {
        this.setSaving(false);
        this.attempted.add(step);
        this.goToStep(step, true);
        this.focusFirstError();
        return;
      }
    }

    this.setSaving(true);
    // A raised target (below 100 % again): "Goal reached! 🎉" may come again (app.js: withReachedReset).
    const goal = withReachedReset(this.readGoal());
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

/* ---------- Self-test (goals.html?debug=1): start values and the target check ---------- */

function runWizardSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  check('start: number, money, percent = 0', [defaultStartValue('number'), defaultStartValue('money'), defaultStartValue('percent')].join(), '0,0,0');
  check('start: measurements stay empty', defaultStartValue('measurements'), null);
  check('example in words, not a value', valueExampleText(12) !== formatNumberValue(12) && valueExampleText(12).includes(formatNumberValue(12)), true);
  check('number: empty target = "Enter a number"', targetValueError('number', 0, NaN), 'wizard.error.number');
  check('number: 50 -> 10 is blocked', targetValueError('number', 50, 10), NUMBER_TARGET_ERROR);
  check('number: 50 -> 50 is blocked', targetValueError('number', 50, 50), NUMBER_TARGET_ERROR);
  check('number: 0 -> 12 is fine', targetValueError('number', 0, 12), null);
  check('measurements: 92 -> 80 is fine', targetValueError('measurements', 92, 80), null);
  check('measurements: 80 -> 80 differs from the start', targetValueError('measurements', 80, 80), 'wizard.error.sameAsStart');
  check('new money: saved 500 000 of 500 000 is fine', targetValueError('money', 500000, 500000, { isNewMoney: true }), null);
  const oldGoal = { progressType: 'number', startValue: 50, targetValue: 10 };
  check('edit: the same old values are only warned about', keepsOldValues(oldGoal, 'number', 50, 10), true);
  check('edit: a new target is checked again', keepsOldValues(oldGoal, 'number', 50, 20), false);
  check('edit: another type before is checked again', keepsOldValues({ ...oldGoal, progressType: 'measurements' }, 'number', 50, 10), false);
  check('create: no old goal', keepsOldValues(null, 'number', 50, 10), false);
  // Editing: the current value changes only by entries (В7)
  const savings = { startValue: 0, currentValue: 200000 };
  check('edit money, no entries: "Already saved" = the current amount', JSON.stringify(editedNumbers(savings, 'money', 250000, false)), '{"startValue":0,"currentValue":250000}');
  check('edit money with entries: the amount stays', JSON.stringify(editedNumbers(savings, 'money', 250000, true)), '{"startValue":0,"currentValue":200000}');
  check('edit number, no entries: start = current = new', JSON.stringify(editedNumbers({ startValue: 5, currentValue: 5 }, 'number', 7, false)), '{"startValue":7,"currentValue":7}');
  check('edit, field not changed: an old goal stays as it is', JSON.stringify(editedNumbers({ startValue: 0, currentValue: 30 }, 'number', 30, false)), '{"startValue":0,"currentValue":30}');
  check('edit levels: new start with entries keeps the current level', editedLevelCurrent({ startValue: 1, currentValue: 3 }, 0, true), 3);
  check('edit levels: new start without entries moves the current level', editedLevelCurrent({ startValue: 1, currentValue: 1 }, 2, false), 2);
  check('percent: target over 100', targetValueError('percent', 0, 120), 'wizard.error.percentMax');
  console.group('[LifeOS] Goal wizard self-test');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} wizard tests failed`);
  else console.info(`All ${results.length} wizard tests passed`);
  console.groupEnd();
}

onAppReady(() => {
  if (byId('goal-search') && new URLSearchParams(window.location.search).get('debug') === '1') runWizardSelfTest();
});
