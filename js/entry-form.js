// LifeOS — recording a result for a goal. One logic for two places:
//   1. the "Add an entry" form on Goal Details (goal-details.html, ids "entry-…");
//   2. the "Quick result" dialog on the Dashboard (QuickEntry below, ids "quick-entry-…").
// The fields depend on the progress type; the entry is saved with recordProgress() (app.js),
// a checklist item with setChecklistItemDone().
'use strict';

const ENTRY_NOTE_MAX_LENGTH = 200;

// Which blocks of the form are visible (data-entry-field in the HTML).
// A checklist on Goal Details has no form (items are ticked in the list there).
const ENTRY_FIELDS = {
  money: ['sign', 'amount'],
  number: ['amount'],
  books: ['pages'],
  booklist: ['book', 'pagesmode', 'bookpages'], // a goal with a book list (js/books.js)
  percent: ['value'],
  measurements: ['value'],
  levels: ['level'],
  streak: [],
  checklist: ['checklist']
};

/* ---------- Small helpers (also used by goal-details.js) ---------- */

// Book goals ("number" in the "books" category) get a special form: pages / finished book;
// with a book list — the book and its pages ("+ pages" or "up to page N").
function entryMode(goal) {
  if (hasBookList(goal)) return 'booklist';
  if (goal.progressType === 'number' && goal.category === 'books') return 'books';
  return goal.progressType;
}

// "3 200 000 ₸", "B1", "2" (checklist items done)
function currentText(goal) {
  if (goal.progressType === 'checklist') return String(asArray(goal.checklist).filter((item) => item.done).length);
  return formatGoalValue(goal, goal.currentValue);
}

function targetText(goal) {
  if (goal.progressType === 'checklist') return String(asArray(goal.checklist).length);
  return formatGoalValue(goal, goal.targetValue);
}

// The unit next to the number field: "₸", "%", "kg", "books".
function unitLabel(goal) {
  if (goal.progressType === 'money') return Format.currencySymbol(goal.unit || DEFAULT_CURRENCY);
  if (goal.progressType === 'percent') return '%';
  return goal.unit ?? '';
}

// "Example: +10,000 ₸ — money put in…" — a hint above the fields, so it is clear what to type.
function entryExampleText(goal) {
  const examples = { money: 10000, number: 20, percent: 45 };
  const mode = entryMode(goal);
  const amount = mode in examples ? formatGoalValue(goal, examples[mode]) : '';
  return t(`entry.example.${mode}`, { amount });
}

// "+₸50,000", "−₸10,000", "Book finished · 45 pages", "→ 86.5 kg", "→ B2", "Day marked"
function entryChangeText(goal, entry) {
  const mode = entryMode(goal);
  const value = Number(entry.value) || 0;
  if (mode === 'streak') return t('details.history.dayMarked');
  if (mode === 'booklist' && entry.bookId) return bookEntryText(goal, entry);
  if (mode === 'books' || mode === 'booklist') {
    const parts = [];
    if (value > 0) parts.push(t('details.history.bookFinished'));
    if (entry.pages) parts.push(`+${tPlural('details.history.pages', Number(entry.pages))}`);
    return parts.join(' · ');
  }
  if (DELTA_TYPES.includes(goal.progressType)) {
    return `${value < 0 ? '−' : '+'}${formatGoalValue(goal, Math.abs(value))}`;
  }
  return `→ ${formatGoalValue(goal, value)}`;
}

// "+45 pages · «Title»" / "Book finished: «Title» · +20 pages"
function bookEntryText(goal, entry) {
  const book = goalBooks(goal).find((item) => item.id === entry.bookId);
  const title = book ? bookTitle(book) : '';
  const pages = entry.pages ? `+${tPlural('details.history.pages', Number(entry.pages))}` : '';
  if (Number(entry.value) > 0) return [t('books.history.finished', { title }), pages].filter(Boolean).join(' · ');
  return [pages, title ? `«${title}»` : ''].filter(Boolean).join(' · ');
}

// Books that can get pages: "reading" first (started last first), then "want to read".
function readableBooks(goal) {
  const order = { reading: 0, planned: 1 };
  return goalBooks(goal)
    .filter((book) => book.status in order)
    .sort((a, b) => order[a.status] - order[b.status] || String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')));
}

// The fields of a book list goal: the same markup for Goal Details ("entry-…") and the Dashboard dialog ("quick-entry-…").
function bookFieldsHtml(prefix) {
  return `
    <div class="col-12" data-entry-field="book">
      <label class="form-label" for="${prefix}-book" data-i18n="books.entry.book"></label>
      <select class="form-select" id="${prefix}-book"></select>
      <p class="field-error" id="${prefix}-book-error"></p>
      <p class="entry-book-empty" id="${prefix}-book-empty" hidden>
        <span data-i18n="books.entry.noBooks"></span>
        <a id="${prefix}-book-empty-link" href="#books-panel" data-i18n="books.entry.addBook"></a>
      </p>
    </div>
    <fieldset class="col-12" data-entry-field="pagesmode">
      <legend class="form-label fs-6" data-i18n="books.entry.how"></legend>
      <div class="gd-switch">
        <input class="btn-check" type="radio" name="${prefix}-pagesmode" id="${prefix}-pagesmode-add" value="add" checked>
        <label class="btn" for="${prefix}-pagesmode-add"><i class="bi bi-plus-lg me-2" aria-hidden="true"></i><span data-i18n="books.entry.modeAdd"></span></label>
        <input class="btn-check" type="radio" name="${prefix}-pagesmode" id="${prefix}-pagesmode-to" value="to">
        <label class="btn" for="${prefix}-pagesmode-to"><i class="bi bi-bookmark me-2" aria-hidden="true"></i><span data-i18n="books.entry.modeTo"></span></label>
      </div>
    </fieldset>
    <div class="col-sm-6" data-entry-field="bookpages">
      <label class="form-label" for="${prefix}-bookpages" id="${prefix}-bookpages-label" data-i18n="books.entry.pagesAdd"></label>
      <div class="input-group">
        <input class="form-control" type="text" id="${prefix}-bookpages" inputmode="numeric" autocomplete="off" data-number="integer">
        <span class="input-group-text" data-i18n="details.entry.pagesUnit"></span>
      </div>
      <div class="form-text" id="${prefix}-bookpages-hint"></div>
      <p class="field-error" id="${prefix}-bookpages-error"></p>
    </div>`;
}

// Ticks (or unticks) a checklist item. For a checklist goal the current value is the number of done items.
function setChecklistItemDone(goalId, index, done) {
  const goals = getGoals();
  const goal = goals.find((item) => item.id === goalId);
  const item = asArray(goal?.checklist)[index];
  if (!item) return null;
  item.done = done;
  if (goal.progressType === 'checklist') {
    goal.currentValue = goal.checklist.filter((entry) => entry.done).length;
    goal.targetValue = goal.checklist.length;
  }
  goal.updatedAt = new Date().toISOString();
  return saveGoals(goals) ? goal : null;
}

// Why an entry of the history cannot be edited (a translation key), or null.
// A finished book (or any entry of a finished book) is not edited: delete it and add it again.
function entryEditBlock(goal, entry) {
  const mode = entryMode(goal);
  if (mode === 'books' && Number(entry.value) > 0) return 'details.history.editBook';
  if (mode !== 'booklist') return null;
  const book = goalBooks(goal).find((item) => item.id === entry.bookId);
  const finished = Number(entry.value) > 0 || !book || book.status === 'done';
  return finished ? 'details.history.editBook' : null;
}

// The example in the "Note" field fits the goal: money — "bonus, side job", a weight — "after a workout"…
const NOTE_EXAMPLES = {
  money: 'money', number: 'number', books: 'books', booklist: 'books', measurements: 'measurements',
  percent: 'percent', levels: 'percent', streak: 'streak', checklist: 'number'
};

function noteExampleText(goal) {
  return t(`details.entry.noteExample.${NOTE_EXAMPLES[entryMode(goal)] ?? 'number'}`);
}

function entryDateError(value, mode, goalEntries) {
  const date = Dates.parse(value);
  if (!date) return 'profile.error.dateInvalid';
  if (date > Dates.today()) return 'details.error.dateFuture';
  if (mode === 'streak' && goalEntries.some((entry) => entry.date === value)) return 'details.error.dayMarked';
  return null;
}

/* ---------- The form: createEntryForm('entry') or createEntryForm('quick-entry') ---------- */

// All elements are found by id: `${prefix}-amount`, `${prefix}-date`, …
function createEntryForm(prefix) {
  const el = (name) => byId(`${prefix}-${name}`);
  const form = el('form');
  // The book fields go before the "amount" block (one markup for both forms, see bookFieldsHtml).
  const amountBlock = form.querySelector('[data-entry-field="amount"]');
  amountBlock.insertAdjacentHTML('beforebegin', bookFieldsHtml(prefix));
  I18n.apply(amountBlock.parentElement);
  // finishedTitle: the title of the book the last save finished (for the toast);
  // edit: the history entry shown in the form ("Edit the entry"), null = a new entry.
  // preferBookId: a book just added on the shelf — "Add an entry" chooses it once.
  const state = { finishedTitle: null, edit: null, preferBookId: null };
  form.addEventListener('change', (event) => {
    if (event.target === el('book') || event.target.name === `${prefix}-pagesmode`) renderBookHint();
    if (event.target === el('sign-minus')) hideMinusNote(el('amount')); // the user did what the note asked
  });

  // Shows the fields for this goal type. Values the user typed are not touched.
  function render(goal) {
    form.dataset.goalId = goal.id;
    const mode = entryMode(goal);
    const fields = ENTRY_FIELDS[mode];
    form.querySelectorAll('[data-entry-field]').forEach((block) => {
      block.hidden = !fields.includes(block.dataset.entryField);
    });
    // A checklist item has no date and no note
    form.querySelectorAll('[data-entry-common]').forEach((block) => { block.hidden = mode === 'checklist'; });
    el('example').textContent = entryExampleText(goal);
    el('note').placeholder = noteExampleText(goal); // drawn again on a language change (render)

    const amountLabel = el('amount-label');
    amountLabel.dataset.i18n = goal.progressType === 'money' ? 'details.entry.amount' : 'details.entry.count';
    amountLabel.textContent = t(amountLabel.dataset.i18n);
    // A typed "−" is removed by the mask; the note under the field says what to do instead (app.js).
    el('amount').dataset.minusHint = mode === 'money' ? 'number.minus.useWithdraw' : 'number.minus.positiveOnly';
    const unit = unitLabel(goal);
    form.querySelectorAll('.entry-unit').forEach((span) => {
      span.textContent = unit;
      span.hidden = unit === '';
    });
    if (mode === 'levels') renderLevelOptions(goal);
    if (mode === 'checklist') renderChecklistOptions(goal);
    renderBookOptions(goal, mode === 'booklist');
    el('submit-label').textContent = t(mode === 'streak' ? 'details.entry.markDay' : 'details.entry.submit');
    if (el('cancel')) renderEditState(goal); // only the Goal Details form can edit entries
  }

  /* ----- Edit mode (Goal Details only): the same fields, "Save" and "Cancel" ----- */

  function isEditing() {
    return state.edit !== null;
  }

  function editedId() {
    return state.edit?.id ?? null;
  }

  // Opens an entry of the history in the form. The caller checks entryEditBlock() first.
  function startEdit(goal, entry) {
    reset();
    state.edit = { id: entry.id, bookId: entry.bookId ?? null };
    render(goal);
    fillFromEntry(goal, entry);
  }

  function stopEdit() {
    state.edit = null;
    el('book').disabled = false;
    reset();
  }

  // The title, the buttons and the line "Entry of 12/11/2026: +20 000 ₸".
  function renderEditState(goal) {
    const editing = isEditing();
    const title = el('title');
    title.dataset.i18n = editing ? 'details.entry.editTitle' : 'details.entry.title';
    title.textContent = t(title.dataset.i18n);
    el('cancel').hidden = !editing;
    form.querySelector('.gd-submit i').className = `bi ${editing ? 'bi-check-lg' : 'bi-plus-lg'} me-2`;
    if (editing) el('submit-label').textContent = t('details.entry.saveEdit');
    const entry = editing ? getGoalEntries(goal.id).find((item) => item.id === state.edit.id) : null;
    el('edit-note').hidden = !entry;
    if (entry) el('edit-note').textContent = t('details.entry.editingOf', { date: Format.shortDate(entry.date), change: entryChangeText(goal, entry) });
    // A book entry stays with its book and adds pages ("up to page" is only for new entries).
    if (editing && state.edit.bookId) {
      const book = goalBooks(goal).find((item) => item.id === state.edit.bookId);
      el('book').replaceChildren(createEl('option', { value: state.edit.bookId }, book ? bookTitle(book) : ''));
      el('book').disabled = true;
      el('pagesmode-add').checked = true;
      form.querySelector('[data-entry-field="pagesmode"]').hidden = true;
      renderBookHint();
    }
  }

  function fillFromEntry(goal, entry) {
    const mode = entryMode(goal);
    const value = Number(entry.value) || 0;
    if (mode === 'money' || mode === 'number') setNumberValue(el('amount'), Math.abs(value));
    if (mode === 'money') el(value < 0 ? 'sign-minus' : 'sign-plus').checked = true;
    if (mode === 'books') {
      if (entry.pages) setNumberValue(el('pages'), Number(entry.pages));
      el('finished').checked = value > 0;
    }
    if (mode === 'booklist' && entry.pages) setNumberValue(el('bookpages'), Number(entry.pages));
    if (mode === 'percent' || mode === 'measurements') setNumberValue(el('value'), value);
    if (mode === 'levels') el('level').value = String(value);
    setDateValue(el('date'), entry.date);
    el('note').value = entry.note ?? '';
  }

  // Edit = delete + add as one operation (app.js: updateProgressEntry). The checks see the goal
  // without this entry: a withdrawal may use the money of the old entry, a marked day may stay.
  function saveEdit(goal) {
    const without = withoutEntry(goal, getProgressEntries(), state.edit.id);
    if (!without) return null;
    const { errors, entry } = read(without.goal, getGoalEntries(goal.id, without.entries));
    errors.forEach((errorKey, input) => setFieldError(input, errorKey));
    if (!entry) {
      form.querySelector('.is-invalid')?.focus();
      return null;
    }
    const result = updateProgressEntry(goal.id, state.edit.id, entry);
    return result ? entryChangeText(result.goal, result.entry) : null;
  }

  // Book titles are user data: set with textContent. One book "reading" -> chosen; several -> "Choose a book".
  // No book to read: a link to "Add a book" instead of the fields (and no saving).
  function renderBookOptions(goal, isBookList) {
    const books = isBookList ? readableBooks(goal) : [];
    const empty = isBookList && books.length === 0;
    el('book-empty').hidden = !empty;
    el('book').hidden = empty;
    form.querySelector(`label[for="${prefix}-book"]`).hidden = empty;
    form.querySelectorAll('[data-entry-field="pagesmode"], [data-entry-field="bookpages"], [data-entry-common]').forEach((block) => {
      if (empty) block.hidden = true;
    });
    form.querySelectorAll('[type="submit"]').forEach((button) => { button.disabled = empty; });
    if (prefix === 'quick-entry') byId('quick-entry-submit').disabled = empty;
    if (!isBookList) return;
    el('book-empty-link').href = prefix === 'entry' ? '#books-panel' : `goal-details.html?id=${encodeURIComponent(goal.id)}#books-panel`;
    const select = el('book');
    const previous = select.value;
    const reading = books.filter((book) => book.status === 'reading');
    const options = books.map((book) => createEl('option', { value: book.id }, `${bookTitle(book)} — ${t(`books.status.${book.status}`)}`));
    select.replaceChildren(createEl('option', { value: '' }, t('books.entry.choose')), ...options);
    select.value = chosenBookId(books, previous, reading);
    renderBookHint();
  }

  // A book just added comes first; then the one the user chose; one book (or one "reading") — it.
  function chosenBookId(books, previous, reading) {
    const has = (id) => books.some((book) => book.id === id);
    if (has(state.preferBookId)) {
      const id = state.preferBookId;
      state.preferBookId = null;
      return id;
    }
    if (has(previous)) return previous;
    if (books.length === 1) return books[0].id;
    return reading.length === 1 ? reading[0].id : '';
  }

  function preferBook(bookId) {
    state.preferBookId = bookId;
  }

  // "Pages read" or "Up to page" and the line under the field: "Read: 120 of 320 pages".
  function renderBookHint() {
    const goal = getGoalById(form.dataset.goalId);
    const book = goalBooks(goal).find((item) => item.id === el('book').value);
    const label = el('bookpages-label');
    label.dataset.i18n = el('pagesmode-to').checked ? 'books.entry.pagesTo' : 'books.entry.pagesAdd';
    label.textContent = t(label.dataset.i18n);
    const hint = el('bookpages-hint');
    if (!book) {
      hint.textContent = '';
      return;
    }
    const read = Format.number(Number(book.pagesRead) || 0);
    const total = bookPagesTotal(book);
    hint.textContent = total !== null ? t('books.entry.readOf', { read, total: Format.number(total) }) : t('books.entry.read', { read });
  }

  // Level names are user data: set with textContent. The next level is preselected.
  function renderLevelOptions(goal) {
    const select = el('level');
    const levels = asArray(goal.levels);
    const previous = select.value;
    select.replaceChildren(...levels.map((level, index) => createEl('option', { value: String(index) }, level)));
    const nextLevel = Math.min((Number(goal.currentValue) || 0) + 1, levels.length - 1);
    select.value = previous !== '' && Number(previous) < levels.length ? previous : String(nextLevel);
  }

  // Only the items that are not done yet.
  function renderChecklistOptions(goal) {
    const options = asArray(goal.checklist)
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.done)
      .map(({ item, index }) => createEl('option', { value: String(index) }, item.text));
    el('checklist').replaceChildren(...options);
  }

  function reset() {
    ['amount', 'pages', 'value', 'note', 'bookpages'].forEach((name) => { el(name).value = ''; });
    hideMinusNote(el('amount'));
    el('finished').checked = false;
    el('pagesmode-add').checked = true;
    el('sign-plus').checked = true;
    setDateValue(el('date'), Dates.toISO(Dates.today()));
    form.querySelectorAll('.is-invalid').forEach((input) => setFieldError(input, null));
  }

  // Reads the form. Returns { errors: Map(input -> key|null), entry } — entry is null if invalid.
  // For a checklist the entry is { checklistIndex }.
  function read(goal, goalEntries) {
    const mode = entryMode(goal);
    const errors = new Map();
    if (mode === 'checklist') {
      const select = el('checklist');
      errors.set(select, select.value === '' ? 'entry.error.checklistDone' : null);
      return { errors, entry: select.value === '' ? null : { checklistIndex: Number(select.value) } };
    }

    const date = getDateValue(el('date'));
    const note = el('note').value.trim();
    const extra = {};
    let value = 0;
    errors.set(el('date'), entryDateError(date, mode, goalEntries));
    errors.set(el('note'), note.length > ENTRY_NOTE_MAX_LENGTH ? 'details.error.noteLength' : null);

    if (mode === 'money' || mode === 'number') {
      const amount = readNumber(el('amount'));
      const sign = mode === 'money' && el('sign-minus').checked ? -1 : 1;
      let error = numberError(amount, { positive: true });
      if (!error && sign < 0 && amount > (Number(goal.currentValue) || 0)) error = 'details.error.notEnough';
      errors.set(el('amount'), error);
      value = sign * amount;
    }
    if (mode === 'books') {
      const pagesInput = el('pages');
      const pages = pagesInput.value.trim() === '' ? 0 : readNumber(pagesInput);
      const finished = el('finished').checked;
      let error = numberError(pages, { min: 0 });
      if (!error && pages === 0 && !finished) error = 'details.error.pagesOrFinished';
      errors.set(pagesInput, error);
      value = finished ? 1 : 0;
      if (pages > 0) extra.pages = Math.round(pages);
    }
    if (mode === 'booklist') {
      const reading = readBookFields(goal, errors);
      const isValid = [...errors.values()].every((key) => key === null);
      return { errors, entry: isValid ? { date, note, ...reading } : null };
    }
    if (mode === 'percent' || mode === 'measurements') {
      value = readNumber(el('value'));
      const limits = mode === 'percent' ? { min: 0, max: 100 } : { positive: true };
      errors.set(el('value'), numberError(value, limits));
    }
    if (mode === 'levels') value = Number(el('level').value);
    if (mode === 'streak') value = 1;

    const isValid = [...errors.values()].every((key) => key === null);
    return { errors, entry: isValid ? { date, value, note, ...extra } : null };
  }

  // The book and its pages: { bookId, pages } or { bookId, toPage }. "Up to page" must be past the pages
  // already read and not past the end of the book; "+ pages" may go past the end (it stops there).
  function readBookFields(goal, errors) {
    const bookId = el('book').value;
    const book = goalBooks(goal).find((item) => item.id === bookId);
    errors.set(el('book'), book ? null : 'books.error.chooseBook');
    const input = el('bookpages');
    const number = readNumber(input);
    const toPage = el('pagesmode-to').checked;
    const total = book ? bookPagesTotal(book) : null;
    let error = numberError(number, { positive: true });
    if (!error && !Number.isInteger(number)) error = 'books.error.wholePages';
    if (!error && book && toPage && number <= (Number(book.pagesRead) || 0)) error = 'books.error.toPageLow';
    if (!error && toPage && total !== null && number > total) error = 'books.error.toPageHigh';
    errors.set(input, error);
    return toPage ? { bookId, toPage: number } : { bookId, pages: number };
  }

  // Reads, checks and saves. Returns the change text ("+20 pages") or null (errors are shown).
  function save(goal) {
    state.finishedTitle = null;
    if (isEditing()) return saveEdit(goal);
    const { errors, entry } = read(goal, getGoalEntries(goal.id));
    errors.forEach((errorKey, input) => setFieldError(input, errorKey));
    if (!entry) {
      form.querySelector('.is-invalid')?.focus();
      return null;
    }
    if ('checklistIndex' in entry) {
      const text = asArray(goal.checklist)[entry.checklistIndex]?.text ?? '';
      return setChecklistItemDone(goal.id, entry.checklistIndex, true) ? `✓ ${text}` : null;
    }
    if ('bookId' in entry) return saveBookReading(goal, entry);
    // adds the entry and recalculates goal.currentValue (app.js)
    return recordProgress(goal.id, entry) ? entryChangeText(goal, entry) : null;
  }

  // Pages of a book (app.js: recordBookReading). A finished book is remembered for the toast.
  function saveBookReading(goal, { bookId, date, note, pages = 0, toPage = null }) {
    const result = recordBookReading(goal.id, bookId, { date, note, pages, toPage });
    if (!result) return null;
    if (result.entry.value > 0) state.finishedTitle = bookTitle(result.book);
    return entryChangeText(result.goal, result.entry);
  }

  // The toast after a save: "Book finished: «…»" when the entry finished a book.
  function toastAfterSave(fallbackKey, params = {}) {
    if (state.finishedTitle !== null) showToast('books.toast.finished', 'success', { title: state.finishedTitle });
    else showToast(fallbackKey, 'success', params);
  }

  return { form, render, reset, save, toastAfterSave, startEdit, stopEdit, isEditing, editedId, preferBook };
}

/* ---------- The "Quick result" dialog (Dashboard: header button and First steps; any page: the toast
   after a done task of a goal, js/tasks.js) ---------- */

// The goal chosen when the dialog opens: the goal of the newest entry if it is still active,
// else the active goal with the nearest deadline (goals without a deadline last, then by title).
function quickEntryDefaultGoal(goals, entries) {
  const activeIds = new Set(goals.map((goal) => goal.id));
  const last = [...entries].reverse().find((entry) => activeIds.has(entry.goalId));
  if (last) return last.goalId;
  const byDeadline = [...goals].sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'))
    || String(a.title).localeCompare(String(b.title), I18n.locale()));
  return byDeadline[0]?.id ?? '';
}

const QUICK_ENTRY_HTML = `
  <div class="modal fade" id="quick-entry-modal" tabindex="-1" aria-labelledby="quick-entry-title">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
      <form class="modal-content" id="quick-entry-form" novalidate>
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="quick-entry-title" data-i18n="quickEntry.title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body">
          <div class="quick-entry-empty" id="quick-entry-empty" hidden>
            <i class="bi bi-bullseye" aria-hidden="true"></i>
            <p class="mb-0" id="quick-entry-empty-text" data-i18n="quickEntry.noGoals"></p>
          </div>
          <div class="row g-3" id="quick-entry-fields">
            <div class="col-12">
              <label class="form-label" for="quick-entry-goal" data-i18n="quickEntry.goal"></label>
              <select class="form-select" id="quick-entry-goal" aria-describedby="quick-entry-now"></select>
              <p class="quick-entry-now" id="quick-entry-now" aria-live="polite"></p>
            </div>
            <div class="col-12"><p class="entry-example" id="quick-entry-example"></p></div>

            <fieldset class="col-12" data-entry-field="sign">
              <legend class="form-label fs-6" data-i18n="details.entry.operation"></legend>
              <div class="gd-switch">
                <input class="btn-check" type="radio" name="quick-entry-sign" id="quick-entry-sign-plus" value="1" checked>
                <label class="btn" for="quick-entry-sign-plus"><i class="bi bi-plus-lg me-2" aria-hidden="true"></i><span data-i18n="details.entry.deposit"></span></label>
                <input class="btn-check" type="radio" name="quick-entry-sign" id="quick-entry-sign-minus" value="-1">
                <label class="btn" for="quick-entry-sign-minus"><i class="bi bi-dash-lg me-2" aria-hidden="true"></i><span data-i18n="details.entry.withdraw"></span></label>
              </div>
            </fieldset>

            <div class="col-sm-6" data-entry-field="amount">
              <label class="form-label" for="quick-entry-amount" id="quick-entry-amount-label" data-i18n="details.entry.amount"></label>
              <div class="input-group">
                <input class="form-control" type="text" id="quick-entry-amount" inputmode="decimal" autocomplete="off" data-number="decimal"
                       data-i18n-placeholder="details.entry.amountPlaceholder" aria-describedby="quick-entry-amount-hint">
                <span class="input-group-text entry-unit"></span>
              </div>
              <div class="form-text" id="quick-entry-amount-hint" data-i18n="details.entry.amountHint"></div>
              <p class="field-error" id="quick-entry-amount-error"></p>
            </div>

            <div class="col-sm-6" data-entry-field="pages">
              <label class="form-label" for="quick-entry-pages" data-i18n="details.entry.pages"></label>
              <div class="input-group">
                <input class="form-control" type="text" id="quick-entry-pages" inputmode="numeric" autocomplete="off" data-number="integer">
                <span class="input-group-text" data-i18n="details.entry.pagesUnit"></span>
              </div>
              <p class="field-error" id="quick-entry-pages-error"></p>
            </div>
            <div class="col-sm-6 entry-check" data-entry-field="pages">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="quick-entry-finished">
                <label class="form-check-label" for="quick-entry-finished" data-i18n="details.entry.finished"></label>
              </div>
            </div>

            <div class="col-sm-6" data-entry-field="value">
              <label class="form-label" for="quick-entry-value" data-i18n="details.entry.newValue"></label>
              <div class="input-group">
                <input class="form-control" type="text" id="quick-entry-value" inputmode="decimal" autocomplete="off" data-number="decimal">
                <span class="input-group-text entry-unit"></span>
              </div>
              <p class="field-error" id="quick-entry-value-error"></p>
            </div>

            <div class="col-sm-6" data-entry-field="level">
              <label class="form-label" for="quick-entry-level" data-i18n="details.entry.newLevel"></label>
              <select class="form-select" id="quick-entry-level"></select>
            </div>

            <div class="col-12" data-entry-field="checklist">
              <label class="form-label" for="quick-entry-checklist" data-i18n="quickEntry.checklistItem"></label>
              <select class="form-select" id="quick-entry-checklist"></select>
              <p class="field-error" id="quick-entry-checklist-error"></p>
            </div>

            <div class="col-sm-6" data-entry-common>
              <label class="form-label" for="quick-entry-date" data-i18n="details.entry.date"></label>
              <input class="form-control" type="text" inputmode="numeric" maxlength="10" autocomplete="off" data-date-field data-i18n-placeholder="date.placeholder" id="quick-entry-date">
              <p class="field-error" id="quick-entry-date-error"></p>
            </div>

            <div class="col-12" data-entry-common>
              <label class="form-label" for="quick-entry-note" data-i18n="details.entry.noteOptional"></label>
              <input class="form-control" type="text" id="quick-entry-note" maxlength="200" autocomplete="off">
              <p class="field-error" id="quick-entry-note-error"></p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-tool" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <a class="btn btn-primary" id="quick-entry-create" href="goals.html#new" hidden>
            <i class="bi bi-bullseye me-2" aria-hidden="true"></i><span data-i18n="goals.new"></span>
          </a>
          <button type="submit" class="btn btn-primary" id="quick-entry-submit">
            <i class="bi bi-check2 me-2" aria-hidden="true"></i><span id="quick-entry-submit-label"></span>
          </button>
        </div>
      </form>
    </div>
  </div>`;

const QuickEntry = {
  modalEl: null,
  entryForm: null,
  opener: null, // the button that opened the dialog (the focus goes back to it)

  // Creates the dialog the first time it is needed.
  ensureModal() {
    if (this.modalEl) return;
    document.body.insertAdjacentHTML('beforeend', QUICK_ENTRY_HTML);
    this.modalEl = byId('quick-entry-modal');
    this.entryForm = createEntryForm('quick-entry');
    I18n.apply(this.modalEl);
    byId('quick-entry-form').addEventListener('submit', submitOnce((event) => this.submit(event)));
    byId('quick-entry-goal').addEventListener('change', () => this.showGoal());
    this.modalEl.addEventListener('shown.bs.modal', () => {
      (this.goals().length ? byId('quick-entry-goal') : byId('quick-entry-create')).focus();
    });
    this.modalEl.addEventListener('hidden.bs.modal', () => {
      // The opener may have been redrawn (First steps): then the "Record a result" button.
      const target = this.opener?.isConnected ? this.opener : (byId('dash-record') || document.querySelector('.page-title'));
      target?.focus();
    });
    document.addEventListener('lifeos:languagechange', () => {
      if (this.goals().length) this.showGoal();
    });
  },

  // Active goals by title (titles are user data: set with textContent).
  goals() {
    return getGoals()
      .filter((goal) => goal.status === 'active')
      .sort((a, b) => String(a.title).localeCompare(String(b.title), I18n.locale()));
  },

  // open(opener) — the goal of the last entry is chosen; open(opener, goalId) — this goal
  // ("Record" in the toast after a done task). Only active goals are in the list.
  open(opener, goalId = null) {
    if (!window.bootstrap) return;
    this.ensureModal();
    this.opener = opener;
    const goals = this.goals();
    byId('quick-entry-empty').hidden = goals.length > 0;
    byId('quick-entry-fields').hidden = goals.length === 0;
    byId('quick-entry-create').hidden = goals.length > 0;
    byId('quick-entry-submit').hidden = goals.length === 0;
    // No goal at all: "Create a goal first"; only completed or archived ones: "No goals in progress".
    const emptyText = byId('quick-entry-empty-text');
    emptyText.dataset.i18n = getGoals().length ? 'quickEntry.noActive' : 'quickEntry.noGoals';
    emptyText.textContent = t(emptyText.dataset.i18n);
    if (goals.length) {
      const select = byId('quick-entry-goal');
      select.replaceChildren(...goals.map((goal) => createEl('option', { value: goal.id }, goal.title)));
      select.value = goals.some((goal) => goal.id === goalId) ? goalId : quickEntryDefaultGoal(goals, getProgressEntries());
      this.entryForm.reset();
      this.showGoal();
    }
    bootstrap.Modal.getOrCreateInstance(this.modalEl).show();
  },

  selectedGoal() {
    const goal = getGoalById(byId('quick-entry-goal').value);
    return goal ? withLiveStreak(goal, getProgressEntries()) : null;
  },

  // The fields for the chosen goal and the line "Now: 300,000 of 1,000,000 ₸".
  showGoal() {
    const goal = this.selectedGoal();
    if (!goal) return;
    this.entryForm.render(goal);
    // money: "300,000 of 1,000,000 ₸" (the currency only once)
    const current = goal.progressType === 'money' ? Format.number(Number(goal.currentValue) || 0) : currentText(goal);
    // A book list: «Сейчас: 2 книги из 21 книги» (the genitive after "из", app.js bookCountOfText)
    const target = hasBookList(goal) ? bookCountOfText(Number(goal.targetValue) || 0) : targetText(goal);
    byId('quick-entry-now').textContent = t('quickEntry.now', { current, target });
  },

  submit(event) {
    event.preventDefault();
    const goal = this.selectedGoal();
    if (!goal) return;
    const change = this.entryForm.save(goal);
    if (!change) return;
    // "Goal reached! 🎉" (app.js: GoalFinish) opens after this dialog is closed: two dialogs never overlap.
    this.modalEl.addEventListener('hidden.bs.modal', () => GoalFinish.afterEntry(goal), { once: true });
    bootstrap.Modal.getInstance(this.modalEl).hide();
    this.entryForm.toastAfterSave('quickEntry.saved', { change });
    // The Dashboard redraws its cards and First steps (dashboard.js)
    document.dispatchEvent(new CustomEvent('lifeos:progresschange', { detail: { goalId: goal.id } }));
  }
};

// Any button with data-quick-entry opens the dialog (Dashboard header, First steps).
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-quick-entry]');
  if (!button) return;
  event.preventDefault();
  QuickEntry.open(button);
});
