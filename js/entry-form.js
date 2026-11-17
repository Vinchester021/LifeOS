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
  money: ['sign', 'amount', 'source'], // docs/design/money-entry.png: no note, no example; the line "after saving" is in "source"
  number: ['amount'],
  books: ['pages'],
  booklist: ['book', 'pagesmode', 'bookpages', 'bookpreview', 'memo'], // a goal with a book list (js/books.js)
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
  let pages = bookEntryPages(entry) ? `+${tPlural('details.history.pages', bookEntryPages(entry))}` : '';
  if (entry.mode === 'to') pages = t('books.history.toPage', { page: Format.number(Number(entry.page) || 0) });
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

// The fields of a book list goal ("Log reading", docs/design/reading-diary.png): the same markup for
// Goal Details ("entry-…") and the Dashboard dialog ("quick-entry-…"). The labels are for screen readers:
// on the screen the placeholders say the same. The live line and the memo come after the date (see below).
function bookFieldsHtml(prefix) {
  return `
    <div class="col-12" data-entry-field="book">
      <label class="form-label visually-hidden" for="${prefix}-book" data-i18n="books.entry.book"></label>
      <div class="entry-book-row">
        <select class="form-select" id="${prefix}-book" aria-describedby="${prefix}-book-progress"></select>
        <div class="entry-book-progress" id="${prefix}-book-progress" hidden>
          <span id="${prefix}-book-progress-text"></span>
          <div class="progress entry-book-bar" id="${prefix}-book-bar" aria-hidden="true"><div class="progress-bar"></div></div>
        </div>
      </div>
      <p class="field-error" id="${prefix}-book-error"></p>
      <p class="entry-book-empty" id="${prefix}-book-empty" hidden>
        <span data-i18n="books.entry.noBooks"></span>
        <a id="${prefix}-book-empty-link" href="#books-panel" data-i18n="books.entry.addBook"></a>
      </p>
    </div>
    <fieldset class="col-12" data-entry-field="pagesmode">
      <legend class="visually-hidden" data-i18n="books.entry.how"></legend>
      <div class="gd-switch">
        <input class="btn-check" type="radio" name="${prefix}-pagesmode" id="${prefix}-pagesmode-add" value="add" checked>
        <label class="btn" for="${prefix}-pagesmode-add"><span data-i18n="books.entry.modeAdd"></span></label>
        <input class="btn-check" type="radio" name="${prefix}-pagesmode" id="${prefix}-pagesmode-to" value="to">
        <label class="btn" for="${prefix}-pagesmode-to"><span data-i18n="books.entry.modeTo"></span></label>
      </div>
    </fieldset>
    <div class="col-sm-6" data-entry-field="bookpages">
      <label class="form-label visually-hidden" for="${prefix}-bookpages" id="${prefix}-bookpages-label" data-i18n="books.entry.pagesAdd"></label>
      <input class="form-control" type="text" id="${prefix}-bookpages" inputmode="numeric" autocomplete="off" data-number="integer">
    </div>`;
}

// After the date: the live line "40 → 60 of 158 pages" (an error takes its place) and the memo.
function bookAfterDateHtml(prefix) {
  return `
    <div class="col-12" data-entry-field="bookpreview">
      <p class="entry-book-preview" id="${prefix}-bookpreview" aria-live="polite" hidden></p>
      <p class="field-error" id="${prefix}-bookpages-error"></p>
    </div>`;
}

function bookMemoHtml(prefix) {
  return `
    <div class="col-12" data-entry-field="memo">
      <label class="form-label visually-hidden" for="${prefix}-memo" data-i18n="books.entry.memo"></label>
      <textarea class="form-control entry-memo" id="${prefix}-memo" rows="3" maxlength="${ENTRY_NOTE_MAX_LENGTH}" data-i18n-placeholder="books.entry.memo"></textarea>
      <p class="field-error" id="${prefix}-memo-error"></p>
    </div>`;
}

// A money goal (docs/design/money-entry.png), after the date: "Source (optional)" — "Reason" for a
// withdrawal — with hints (a combobox, see bindSourceHints), and under it, in the same block,
// "After saving: 1 000 000 ₸ → 1 050 000 ₸" (one part of the form: the gaps of the form stay even).
function moneyFieldsHtml(prefix) {
  return `
    <div class="col-12" data-entry-field="source">
      <label class="form-label" for="${prefix}-source" id="${prefix}-source-label" data-i18n="money.entry.source"></label>
      <div class="entry-hints">
        <input class="form-control" type="text" id="${prefix}-source" maxlength="${MONEY_SOURCE_MAX}" autocomplete="off"
               role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${prefix}-source-list">
        <ul class="entry-hints-list" id="${prefix}-source-list" role="listbox" aria-labelledby="${prefix}-source-label" hidden></ul>
      </div>
      <p class="entry-money-preview" id="${prefix}-moneypreview" aria-live="polite" hidden>
        <i class="bi bi-database" aria-hidden="true"></i><!-- a stack of coins (bi-coin has a "$" on it) -->
        <span class="entry-money-preview-label" data-i18n="money.entry.after"></span>
        <strong class="entry-money-preview-value" id="${prefix}-moneypreview-value"></strong>
      </p>
    </div>`;
}

// The hints under a text field (an ARIA combobox): typing (or the focus) shows the matching texts,
// ↑ ↓ go through them, Enter or a click / tap puts one into the field, Esc closes the list.
// getHints(text) returns the texts to show. Returns { close }.
function bindSourceHints(input, list, getHints) {
  let active = -1;
  const options = () => [...list.children];

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function open() {
    const hints = getHints(input.value);
    list.replaceChildren(...hints.map((text, index) => createEl('li', { id: `${list.id}-${index}`, role: 'option', 'aria-selected': 'false' }, text)));
    if (hints.length === 0) {
      close();
      return;
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  }

  function mark(index) {
    active = index;
    options().forEach((option, i) => {
      option.setAttribute('aria-selected', String(i === index));
      option.classList.toggle('is-active', i === index);
    });
    input.setAttribute('aria-activedescendant', options()[index].id);
    options()[index].scrollIntoView({ block: 'nearest' });
  }

  function pick(option) {
    input.value = option.textContent;
    close();
  }

  function onKeydown(event) {
    const count = options().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (list.hidden) open();
      if (options().length === 0) return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      mark((active + step + options().length) % options().length);
    } else if (event.key === 'Enter' && !list.hidden && active >= 0 && active < count) {
      event.preventDefault(); // takes the hint, does not send the form
      pick(options()[active]);
    } else if (event.key === 'Escape' && !list.hidden) {
      event.preventDefault();
      event.stopPropagation(); // the dialog around stays open
      close();
    }
  }

  input.addEventListener('input', open);
  input.addEventListener('focus', open);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', onKeydown);
  // mousedown (not click): the field keeps the focus, so the list is not closed by "blur" first
  list.addEventListener('mousedown', (event) => {
    const option = event.target.closest('[role="option"]');
    if (!option) return;
    event.preventDefault();
    pick(option);
  });
  return { close };
}

// "40 → 60 of 158 pages" / "158 of 158 — the book will be finished" / "40 → 60 pages" (no page count).
function bookPreviewText({ from, to, total, finishes }) {
  const values = { from: Format.number(from), to: Format.number(to) };
  if (finishes) return t('books.entry.previewFinish', { ...values, total: Format.number(total) });
  if (total === null) return t('books.entry.previewNoTotal', values);
  return tPlural('books.entry.preview', total, { ...values, total: Format.number(total) });
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
  el('date').closest('[data-entry-common]').insertAdjacentHTML('afterend', bookAfterDateHtml(prefix));
  el('date').closest('[data-entry-common]').insertAdjacentHTML('afterend', moneyFieldsHtml(prefix));
  el('note').closest('[data-entry-common]').insertAdjacentHTML('afterend', bookMemoHtml(prefix));
  I18n.apply(amountBlock.parentElement);
  // finishedTitle: the title of the book the last save finished (for the toast);
  // edit: the history entry shown in the form ("Edit the entry"), null = a new entry
  //   (its old note is kept: a money entry has no note field any more);
  // preferBookId: a book just added on the shelf — "Add an entry" chooses it once.
  const state = { finishedTitle: null, edit: null, preferBookId: null };
  const sourceHints = bindSourceHints(el('source'), el('source-list'), (text) => {
    const goal = getGoalById(form.dataset.goalId);
    return goal ? moneySourceHints(moneySourceList(getGoalEntries(goal.id), signKind()), text) : [];
  });
  form.addEventListener('change', (event) => {
    if (event.target === el('book') || event.target.name === `${prefix}-pagesmode`) renderBookState(true);
    if (event.target === el('date') && form.classList.contains('is-reading')) renderBookPreview(true);
    if (event.target === el('sign-minus')) hideMinusNote(el('amount')); // the user did what the note asked
    if (event.target.name === `${prefix}-sign`) renderMoneySign();
  });
  // The live lines are counted again while the pages / the amount are typed
  form.addEventListener('input', (event) => {
    if (event.target === el('bookpages')) renderBookPreview(true);
    if (event.target === el('amount') && form.classList.contains('is-money')) renderMoneyPreview(true);
  });

  /* ----- A money goal: deposit / withdrawal ----- */

  function signKind() {
    return el('sign-minus').checked ? 'out' : 'in';
  }

  // The title, "Source" / "Reason" and the line follow the switch.
  function renderMoneySign() {
    const out = signKind() === 'out';
    const label = el('source-label');
    label.dataset.i18n = out ? 'money.entry.reason' : 'money.entry.source';
    label.textContent = t(label.dataset.i18n);
    el('source').placeholder = t(out ? 'money.entry.reasonPlaceholder' : 'money.entry.sourcePlaceholder');
    sourceHints.close(); // the hints of the other kind
    const goal = getGoalById(form.dataset.goalId);
    if (goal) renderTitle(goal);
    renderMoneyPreview(el('amount').value.trim() !== '');
  }

  // The money there is before this entry (editing: without the entry being edited — as saveEdit checks it).
  function moneyBefore(goal) {
    const without = isEditing() ? withoutEntry(goal, getProgressEntries(), state.edit.id) : null;
    return Number((without?.goal ?? goal).currentValue) || 0;
  }

  // "After saving: 1 000 000 ₸ → 1 050 000 ₸"; a withdrawal bigger than the balance shows the error instead.
  function renderMoneyPreview(live) {
    const goal = getGoalById(form.dataset.goalId);
    if (!goal || goal.progressType !== 'money') return;
    const input = el('amount');
    const amount = input.value.trim() === '' ? NaN : readNumber(input);
    const preview = moneyEntryPreview(moneyBefore(goal), amount, signKind() === 'out' ? -1 : 1);
    if (live) setFieldError(input, preview?.error ?? null);
    const show = Boolean(preview) && !preview.error;
    el('moneypreview').hidden = !show;
    el('moneypreview-value').textContent = show
      ? t('money.entry.afterValue', { from: formatGoalValue(goal, preview.from), to: formatGoalValue(goal, preview.to) }) : '';
  }

  // "⊕ Record a deposit" / "⊖ Record a withdrawal" (a money goal), "Edit the entry", or the usual title.
  // The quick dialog keeps "Quick result" for other goals. Both titles: an icon and a text span.
  function renderTitle(goal) {
    const text = el('title-text');
    if (!text) return;
    let key = prefix === 'quick-entry' ? 'quickEntry.title' : 'details.entry.title';
    if (hasBookList(goal) && prefix !== 'quick-entry') key = 'books.entry.title'; // "Log reading"
    let icon = '';
    if (goal.progressType === 'money') {
      const out = signKind() === 'out';
      key = out ? 'money.entry.titleOut' : 'money.entry.titleIn';
      icon = out ? 'bi-dash-circle' : 'bi-plus-circle';
    }
    if (isEditing()) {
      key = 'details.entry.editTitle';
      icon = '';
    }
    text.dataset.i18n = key;
    text.textContent = t(key);
    el('title-icon').className = `bi ${icon} entry-title-icon`;
    el('title-icon').hidden = icon === '';
    // A withdrawal: the red of the operation on the switch and on "Save" (style.css)
    form.classList.toggle('is-out', goal.progressType === 'money' && signKind() === 'out');
  }

  // Shows the fields for this goal type. Values the user typed are not touched.
  function render(goal) {
    form.dataset.goalId = goal.id;
    const mode = entryMode(goal);
    const fields = ENTRY_FIELDS[mode];
    form.querySelectorAll('[data-entry-field]').forEach((block) => {
      block.hidden = !fields.includes(block.dataset.entryField);
    });
    // A checklist item has no date and no note; a book list has its own memo field instead of the note
    form.querySelectorAll('[data-entry-common]').forEach((block) => { block.hidden = mode === 'checklist'; });
    const isBookList = mode === 'booklist';
    const isMoney = mode === 'money';
    // A money goal has no note (the source says it) — an old note of an edited entry stays in the data
    el('note').closest('[data-entry-common]').hidden = mode === 'checklist' || isBookList || isMoney;
    form.classList.toggle('is-reading', isBookList); // "Log reading": no labels above the fields (style.css)
    form.classList.toggle('is-money', isMoney); // a deposit / withdrawal (docs/design/money-entry.png)
    el('example').closest('.col-12').hidden = isBookList || isMoney; // the long hint is not needed there
    el('amount-hint').hidden = isMoney; // "After saving: …" shows what the amount does
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
    let submitKey = 'details.entry.submit';
    if (mode === 'streak') submitKey = 'details.entry.markDay';
    if (isBookList) submitKey = 'books.entry.save';
    if (isMoney) submitKey = 'money.entry.save';
    el('submit-label').textContent = t(submitKey);
    renderTitle(goal);
    if (isMoney) renderMoneySign();
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
    state.edit = { id: entry.id, bookId: entry.bookId ?? null, note: entry.note ?? '' };
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
    el('cancel').hidden = !editing;
    const saveIcon = editing || goal.progressType === 'money' ? 'bi-check-lg' : 'bi-plus-lg';
    form.querySelector('.gd-submit i').className = `bi ${saveIcon} me-2`;
    if (editing) el('submit-label').textContent = t('details.entry.saveEdit');
    const entry = editing ? getGoalEntries(goal.id).find((item) => item.id === state.edit.id) : null;
    el('edit-note').hidden = !entry;
    if (entry) el('edit-note').textContent = t('details.entry.editingOf', { date: Format.shortDate(entry.date), change: entryChangeText(goal, entry) });
    // A book entry stays with its book and adds pages ("up to page" is only for new entries).
    if (editing && state.edit.bookId) {
      const book = goalBooks(goal).find((item) => item.id === state.edit.bookId);
      el('book').replaceChildren(createEl('option', { value: state.edit.bookId }, book ? bookTitle(book) : ''));
      el('book').disabled = true;
      const savedMode = getGoalEntries(goal.id).find((item) => item.id === state.edit.id)?.mode;
      el(savedMode === 'to' ? 'pagesmode-to' : 'pagesmode-add').checked = true;
      form.querySelector('[data-entry-field="pagesmode"]').hidden = true;
      renderBookState(false);
    }
  }

  function fillFromEntry(goal, entry) {
    const mode = entryMode(goal);
    const value = Number(entry.value) || 0;
    if (mode === 'money' || mode === 'number') setNumberValue(el('amount'), Math.abs(value));
    if (mode === 'money') {
      el(value < 0 ? 'sign-minus' : 'sign-plus').checked = true;
      el('source').value = entry.source ?? '';
      renderMoneySign(); // the title, "Reason" for a withdrawal and the line
    }
    if (mode === 'books') {
      if (entry.pages) setNumberValue(el('pages'), Number(entry.pages));
      el('finished').checked = value > 0;
    }
    if (mode === 'booklist') {
      const number = entry.mode === 'to' ? Number(entry.page) : Number(entry.pages);
      if (number) setNumberValue(el('bookpages'), number);
    }
    if (mode === 'booklist') el('memo').value = entry.note ?? '';
    if (mode === 'percent' || mode === 'measurements') setNumberValue(el('value'), value);
    if (mode === 'levels') el('level').value = String(value);
    setDateValue(el('date'), entry.date);
    el('note').value = entry.note ?? '';
    if (mode === 'booklist') renderBookPreview(false);
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
    form.querySelectorAll('[data-entry-field="pagesmode"], [data-entry-field="bookpages"], [data-entry-field="bookpreview"], [data-entry-field="memo"], [data-entry-common]').forEach((block) => {
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
    renderBookState(false);
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
    return reading[0]?.id ?? ''; // the book being read now (the last started one first)
  }

  function preferBook(bookId) {
    state.preferBookId = bookId;
  }

  // A cover on the shelf was pressed: choose this book now (false: it cannot get pages).
  function selectBook(bookId) {
    if (![...el('book').options].some((option) => option.value === bookId)) return false;
    el('book').value = bookId;
    renderBookState(true);
    return true;
  }

  // The chosen book as it is before this entry (editing: without the entry being edited).
  function stateBook() {
    let goal = getGoalById(form.dataset.goalId);
    if (goal && isEditing()) goal = withoutEntry(goal, getProgressEntries(), state.edit.id)?.goal ?? goal;
    return goalBooks(goal).find((item) => item.id === el('book').value) ?? null;
  }

  // live: the user changed something now — then the error of the pages field may change too.
  function renderBookState(live) {
    const label = el('bookpages-label');
    label.dataset.i18n = el('pagesmode-to').checked ? 'books.entry.pagesTo' : 'books.entry.pagesAdd';
    label.textContent = t(label.dataset.i18n);
    el('bookpages').placeholder = label.textContent; // "How many pages I read" / "The page I stopped at"
    renderBookProgress(stateBook());
    renderBookPreview(live);
  }

  // Next to the book: "40 of 158 pages" with a thin bar, or "Read 40 pages" (no page count).
  function renderBookProgress(book) {
    el('book-progress').hidden = !book;
    if (!book) return;
    const read = Number(book.pagesRead) || 0;
    const total = bookPagesTotal(book);
    el('book-progress-text').textContent = total !== null
      ? t('books.entry.progressOf', { read: Format.number(read), total: Format.number(total) })
      : t('books.entry.progressRead', { read: Format.number(read) });
    el('book-bar').hidden = total === null;
    if (total !== null) el('book-bar').firstElementChild.style.width = `${Math.min(100, Math.round((read / total) * 100))}%`;
  }

  // Under the pages and the date: "40 → 60 of 158 pages"; a mistake shows its error in the same place.
  // The pages read just before this entry: at its date, without the entry being edited (app.js).
  function readingFrom(book) {
    if (!book) return 0;
    const date = getDateValue(el('date'));
    return pagesBeforeEntry(book, getProgressEntries(), { date: Dates.parse(date) ? date : Dates.toISO(Dates.today()), entryId: state.edit?.id ?? null });
  }

  function renderBookPreview(live) {
    const input = el('bookpages');
    const box = el('bookpreview');
    const number = input.value.trim() === '' ? NaN : readNumber(input);
    const toPage = el('pagesmode-to').checked;
    const book = stateBook();
    const preview = bookReadingPreview(book, toPage ? { toPage: number } : { pages: number }, readingFrom(book), { allowSame: isEditing() });
    if (live) setFieldError(input, preview?.error ?? null);
    const show = Boolean(preview) && !preview.error && !input.classList.contains('is-invalid');
    box.hidden = !show;
    // Nothing to show (no line, no error): the empty row would only add a gap
    box.closest('[data-entry-field]').hidden = !show && !input.classList.contains('is-invalid');
    box.classList.toggle('is-finish', show && preview.finishes);
    box.textContent = show ? bookPreviewText(preview) : '';
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
    ['amount', 'pages', 'value', 'note', 'bookpages', 'memo', 'source'].forEach((name) => { el(name).value = ''; });
    el('bookpreview').hidden = true;
    el('moneypreview').hidden = true;
    sourceHints.close();
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
    const noteInput = mode === 'booklist' ? el('memo') : el('note'); // "What stayed with me" for books
    let note = noteInput.value.trim();
    const extra = {};
    let value = 0;
    errors.set(el('date'), entryDateError(date, mode, goalEntries));
    errors.set(noteInput, note.length > ENTRY_NOTE_MAX_LENGTH ? 'details.error.noteLength' : null);

    if (mode === 'money') {
      // No note field: a new entry has none, an edited old one keeps its note as it was
      note = state.edit?.note ?? '';
      extra.source = normalizeMoneySource(el('source').value, moneySourceList(goalEntries, signKind()));
    }
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
    // The same checks as the live line (app.js): "stopped at page" must be past the pages before this entry
    errors.set(input, bookPagesError(book, number, toPage, readingFrom(book), { allowSame: isEditing() }));
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

  return { form, render, reset, save, toastAfterSave, startEdit, stopEdit, isEditing, editedId, preferBook, selectBook };
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
          <h2 class="modal-title entry-title" id="quick-entry-title"><i class="bi entry-title-icon" id="quick-entry-title-icon" aria-hidden="true" hidden></i><span id="quick-entry-title-text" data-i18n="quickEntry.title"></span></h2>
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
              <legend class="visually-hidden" data-i18n="details.entry.operation"></legend>
              <div class="gd-switch">
                <input class="btn-check" type="radio" name="quick-entry-sign" id="quick-entry-sign-plus" value="1" checked>
                <label class="btn" for="quick-entry-sign-plus"><span data-i18n="money.entry.deposit"></span></label>
                <input class="btn-check" type="radio" name="quick-entry-sign" id="quick-entry-sign-minus" value="-1">
                <label class="btn" for="quick-entry-sign-minus"><span data-i18n="money.entry.withdraw"></span></label>
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
      .filter((goal) => goal.status === 'active' && !hasProjectList(goal)) // a project list counts its projects, no entries
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
