// LifeOS — "My books" on Goal Details: the book shelf of a "Books" goal with a book list
// (docs/design/bookshelf.png: every book is a cover with a coloured spine and a stack of pages).
// The data and the rules (pages, statuses, the counter of the goal, undo) are in app.js, section 11a;
// pages are recorded with the "Add an entry" form (js/entry-form.js). Here: the list, the filter,
// the "Add / Edit a book" dialog, "Mark as read" and deleting a book (with its reading entries).
// Book titles and authors are user data: always escapeHtml / textContent.
'use strict';

const BOOK_FILTERS = ['all', 'reading', 'done', 'planned'];
const BOOK_STATUS_TONE = { planned: '', reading: 'is-accent', done: 'is-success' };
const BOOK_ORDER = { reading: 0, planned: 1, done: 2 };
const SHELF_PHONE_LIMIT = 6; // a phone shows 6 books, then "Show all"; a computer — 2 rows
const SHELF_FLASH_MS = 1600; // a finished book only lights up when its cover is pressed
const BOOK_UNDO_DELAY = 7000; // "Undo" after deleting a book

/* ---------- Pure ---------- */

// When the book last changed: its newest entry, the day it was finished or started, or created.
// (Books keep no "updated" date; the data is not changed for the order.)
function bookChangedAt(book, entries = []) {
  const dates = [book.finishedAt, book.startedAt, book.createdAt,
    ...entries.filter((entry) => entry.bookId === book.id).map((entry) => entry.date)];
  return dates.filter(Boolean).map(String).sort().pop() ?? '';
}

// The books of one filter: reading -> want to read -> finished; inside each — the last changed first.
function filteredBooks(books, filter, entries = []) {
  return books
    .filter((book) => filter === 'all' || book.status === filter)
    .sort((a, b) => BOOK_ORDER[a.status] - BOOK_ORDER[b.status]
      || bookChangedAt(b, entries).localeCompare(bookChangedAt(a, entries)));
}

// How many covers are shown before "Show all": 6 on a phone, 2 rows on bigger screens.
function shelfLimit(columns, isPhone) {
  return isPhone ? SHELF_PHONE_LIMIT : Math.max(columns, 1) * 2;
}

// Titles and authors already typed in any goal, for the hints of the dialog (no empty, no repeats).
function knownBookTexts(goals, field) {
  const texts = goals.flatMap((goal) => goalBooks(goal).map((book) => String(book[field] ?? '').trim()));
  return [...new Set(texts.filter(Boolean))].sort((a, b) => a.localeCompare(b, I18n.locale()));
}

// The statuses the dialog offers. A finished book with the entry that finished it stays finished:
// that entry is deleted in the history (then the pages and the counter go back too).
function bookStatusChoices(book, hasFinishEntry) {
  if (!book) return BOOK_STATUSES;
  if (book.status === 'done') return hasFinishEntry ? ['done'] : BOOK_STATUSES;
  return ['planned', 'reading'];
}

/* ---------- Markup ---------- */

// A field of the book dialog (docs/design/book-modal.png): one frame [grey icon | divider | field (+ "pages")].
// The hint is the grey text of the empty field; the label is for screen readers (and aria-label on the field).
function bookFieldHtml({ id, icon, labelKey, control, unit = '' }) {
  return `
            <label class="visually-hidden" for="${id}" data-i18n="${labelKey}"></label>
            <div class="book-field">
              <span class="book-field-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
              ${control}
              ${unit}
            </div>`;
}

// The input of a field: the hint inside and the same text as its aria-label.
function bookInputHtml(id, labelKey, extra) {
  return `<input class="form-control book-field-input" type="text" id="${id}" autocomplete="off" ${extra}
                       data-i18n-placeholder="${labelKey}" data-i18n-aria-label="${labelKey}">`;
}

const BOOK_DIALOG_HTML = `
  <div class="modal fade" id="book-modal" tabindex="-1" aria-labelledby="book-modal-title">
    <div class="modal-dialog modal-dialog-centered modal-fullscreen-sm-down book-modal">
      <form class="modal-content" id="book-form" novalidate>
        <div class="modal-header">
          <span class="book-modal-icon" aria-hidden="true"><i class="bi bi-book"></i></span>
          <h2 class="modal-title fs-5" id="book-modal-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body book-fields">
          <div>
            ${bookFieldHtml({ id: 'book-title', icon: 'bi-book', labelKey: 'books.dialog.title',
              control: bookInputHtml('book-title', 'books.dialog.title', `maxlength="${BOOK_TEXT_MAX}" list="book-title-options"`) })}
            <datalist id="book-title-options"></datalist>
            <p class="field-error" id="book-title-error"></p>
          </div>
          <div>
            ${bookFieldHtml({ id: 'book-author', icon: 'bi-pencil', labelKey: 'books.dialog.author',
              control: bookInputHtml('book-author', 'books.dialog.author', `maxlength="${BOOK_TEXT_MAX}" list="book-author-options"`) })}
            <datalist id="book-author-options"></datalist>
          </div>
          <div>
            ${bookFieldHtml({ id: 'book-pages', icon: 'bi-files', labelKey: 'books.dialog.pages',
              control: bookInputHtml('book-pages', 'books.dialog.pages', 'inputmode="numeric" data-number="integer"'),
              unit: '<span class="book-field-unit" data-i18n="details.entry.pagesUnit"></span>' })}
            <p class="field-error" id="book-pages-error"></p>
          </div>
          <div>
            ${bookFieldHtml({ id: 'book-status', icon: 'bi-circle', labelKey: 'books.dialog.status',
              control: '<select class="form-select book-field-input" id="book-status" data-i18n-aria-label="books.dialog.status"></select>' })}
            <div class="form-text" id="book-status-hint" hidden></div>
          </div>
        </div>
        <div class="modal-footer book-modal-foot">
          <button type="button" class="btn btn-tool" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <button type="submit" class="btn btn-primary"><i class="bi bi-check2 me-2" aria-hidden="true"></i><span data-i18n="books.dialog.save"></span></button>
        </div>
      </form>
    </div>
  </div>
  <div class="modal fade book-sheet" tabindex="-1" id="book-sheet" aria-labelledby="book-sheet-title">
    <div class="modal-dialog modal-dialog-centered book-sheet-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title" id="book-sheet-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body book-sheet-body">
          <button type="button" class="book-sheet-item" data-sheet-action="edit"><i class="bi bi-pencil" aria-hidden="true"></i><span data-i18n="books.card.edit"></span></button>
          <button type="button" class="book-sheet-item" data-sheet-action="finish"><i class="bi bi-check2-circle" aria-hidden="true"></i><span data-i18n="books.card.finish"></span></button>
          <button type="button" class="book-sheet-item is-danger" data-sheet-action="delete"><i class="bi bi-trash" aria-hidden="true"></i><span data-i18n="books.card.delete"></span></button>
          <button type="button" class="btn btn-outline-primary book-sheet-cancel" data-bs-dismiss="modal"><span data-i18n="delete.cancel"></span></button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal fade" id="book-delete-modal" tabindex="-1" aria-labelledby="book-delete-title" aria-describedby="book-delete-text">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="book-delete-title" data-i18n="books.delete.title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body">
          <p class="delete-goal-name" id="book-delete-name"></p>
          <p class="mb-0" id="book-delete-text"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-tool" id="book-delete-cancel" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <button type="button" class="btn btn-danger" id="book-delete-confirm">
            <i class="bi bi-trash me-1" aria-hidden="true"></i><span data-i18n="delete.confirm"></span>
          </button>
        </div>
      </div>
    </div>
  </div>`;

// The pages on the cover: a thin bar (only with a page count) and "120 / 320 pages" or "Read 120 pages";
// a finished book: a full bar and, under it, the day it was finished.
function bookPagesHtml(book) {
  const read = Number(book.pagesRead) || 0;
  const total = bookPagesTotal(book);
  const percent = total !== null ? Math.min(Math.round((read / total) * 100), 100) : 0;
  const text = total !== null
    ? t('books.card.readOf', { read: Format.number(read), total: Format.number(total) })
    : t('books.card.read', { read: Format.number(read) });
  const finished = book.status === 'done' && book.finishedAt
    ? `<span class="book-card-date">${escapeHtml(t('books.card.finishedOn', { date: Format.shortDate(book.finishedAt) }))}</span>` : '';
  return `
          ${total !== null ? `<span class="book-card-bar" aria-hidden="true"><span style="width: ${percent}%"></span></span>` : ''}
          <span class="book-card-pages">${escapeHtml(text)}</span>
          ${finished}`;
}

// "Shantaram, Reading, 120 of 864 pages" — what a screen reader says for the cover.
function bookCardLabel(book) {
  const read = Number(book.pagesRead) || 0;
  const total = bookPagesTotal(book);
  const pages = total !== null
    ? tPlural('books.card.pagesOf', total, { read: Format.number(read), total: Format.number(total) })
    : t('books.card.read', { read: Format.number(read) });
  return t('books.card.label', { title: bookTitle(book), status: t(`books.status.${book.status}`), pages });
}

function bookMenuHtml(book) {
  const title = bookTitle(book);
  const item = (action, icon, key, extra = '') => `
    <li><button type="button" class="dropdown-item ${extra}" data-book-action="${action}" data-book-id="${escapeHtml(book.id)}">
      <i class="bi ${icon} me-2" aria-hidden="true"></i>${escapeHtml(t(key))}
    </button></li>`;
  return `
    <div class="dropdown book-card-menu">
      <button type="button" class="btn btn-icon" data-bs-toggle="dropdown" data-book-menu="${escapeHtml(book.id)}" aria-expanded="false"
              aria-label="${escapeHtml(t('books.card.menu', { title }))}" title="${escapeHtml(t('books.card.menu', { title }))}">
        <i class="bi bi-three-dots" aria-hidden="true"></i>
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        ${item('edit', 'bi-pencil', 'books.card.edit')}
        ${book.status === 'done' ? '' : item('finish', 'bi-check2-circle', 'books.card.finish')}
        <li><hr class="dropdown-divider"></li>
        ${item('delete', 'bi-trash', 'books.card.delete', 'text-danger')}
      </ul>
    </div>`;
}

// A cover: the whole cover is a button (it chooses the book in "Log reading"); the ⋯ menu lies over it.
function bookCardHtml(book) {
  const id = escapeHtml(book.id);
  const title = bookTitle(book);
  const author = String(book.author ?? '').trim();
  const status = book.status === 'done' ? t('books.history.finishedBadge') : t(`books.status.${book.status}`);
  return `
    <li class="book-card" data-status="${escapeHtml(book.status)}" data-book-card="${id}">
      <button type="button" class="book-card-main" data-book-pick="${id}" aria-label="${escapeHtml(bookCardLabel(book))}">
        <span class="book-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
        ${author ? `<span class="book-card-author">${escapeHtml(author)}</span>` : ''}
        <span class="book-card-foot">
          <span class="badge-status ${BOOK_STATUS_TONE[book.status] ?? ''}">${escapeHtml(status)}</span>
          ${bookPagesHtml(book)}
        </span>
      </button>
      ${bookMenuHtml(book)}
    </li>`;
}

// An empty shelf: a dashed cover "+ Add your first book".
function emptyShelfHtml() {
  return `
    <li class="book-card is-placeholder">
      <button type="button" class="book-card-main" data-book-add-first>
        <i class="bi bi-plus-lg" aria-hidden="true"></i>
        <span>${escapeHtml(t('books.shelf.addFirst'))}</span>
      </button>
    </li>`;
}

/* ---------- The block ---------- */

const BookShelf = {
  goalId: null,
  filter: 'all',
  editingId: null, // the book in the dialog (null = a new book)
  deletingId: null,
  opener: null, // the focus goes back here when a dialog closes
  scrolled: false,
  expanded: false, // "Show all" was pressed

  goal() {
    return getGoalById(this.goalId);
  },

  // Called by renderDetailsPage (goal-details.js) on every change of the goal.
  render(goal) {
    if (this.menuOpen()) {
      this.pendingRender = true; // drawn again when the menu closes (bind: hidden.bs.dropdown / hidden.bs.modal)
      return;
    }
    this.pendingRender = false;
    const panel = byId('books-panel');
    panel.hidden = !hasBookList(goal);
    if (panel.hidden) return;
    this.goalId = goal.id;
    const books = goalBooks(goal);
    this.renderStats(goal);
    this.renderFilter(books);
    this.renderList(books);
    this.scrollOnce(panel);
  },

  // "Read 4 of 13" · "Pages in all: 1,280". The pace ("~25 pages a day") is in the goal header only.
  renderStats(goal) {
    const stats = bookShelfStats(goal, Dates.today(), getGoalEntries(goal.id)); // + pages of old entries without a book
    const lines = [
      ['bi-journal-check', t('books.stats.done', { done: Format.number(stats.done), target: Format.number(stats.target) })],
      ['bi-file-earmark-text', t('books.stats.pages', { pages: Format.number(stats.pages) })]
    ];
    byId('books-stats').innerHTML = lines
      .map(([icon, text]) => `<li><i class="bi ${icon}" aria-hidden="true"></i>${escapeHtml(text)}</li>`).join('');
  },

  renderFilter(books) {
    const count = (filter) => (filter === 'all' ? books.length : books.filter((book) => book.status === filter).length);
    byId('books-filter').innerHTML = BOOK_FILTERS.map((filter) => `
      <button type="button" class="segmented-btn" data-book-filter="${filter}" aria-pressed="${filter === this.filter}">
        ${escapeHtml(t(`books.filter.${filter}`))} <span class="tab-count">${escapeHtml(Format.number(count(filter)))}</span>
      </button>`).join('');
  },

  renderList(books) {
    const shown = filteredBooks(books, this.filter, getGoalEntries(this.goalId));
    byId('books-list').innerHTML = books.length ? shown.map(bookCardHtml).join('') : emptyShelfHtml();
    const empty = byId('books-empty'); // "No books here" for a filter without books
    empty.hidden = !books.length || shown.length > 0;
    empty.querySelector('span').textContent = t('books.empty.filter');
    this.applyLimit();
  },

  // 2 rows on a computer (the columns come from the grid), 6 covers on a phone; then "Show all (N)".
  applyLimit() {
    const covers = [...byId('books-list').querySelectorAll('.book-card:not(.is-placeholder)')];
    const columns = getComputedStyle(byId('books-list')).gridTemplateColumns.split(' ').filter(Boolean).length;
    const limit = shelfLimit(columns, window.matchMedia('(max-width: 575.98px)').matches);
    covers.forEach((cover, index) => { cover.hidden = !this.expanded && index >= limit; });
    const more = byId('books-more');
    more.hidden = covers.length <= limit;
    more.setAttribute('aria-expanded', String(this.expanded));
    more.querySelector('span').textContent = this.expanded
      ? t('books.shelf.less') : t('books.shelf.more', { count: Format.number(covers.length) });
    more.querySelector('i').className = `bi ${this.expanded ? 'bi-chevron-up' : 'bi-chevron-down'} me-2`;
  },

  // A cover is pressed: the book is chosen in "Log reading" (goal-details.js scrolls there);
  // a finished book cannot get pages — its cover only lights up.
  pick(bookId) {
    const book = goalBooks(this.goal()).find((item) => item.id === bookId);
    if (!book) return;
    if (book.status === 'done') {
      const cover = byId('books-list').querySelector(`[data-book-card="${CSS.escape(bookId)}"]`);
      cover?.classList.add('is-flash');
      setTimeout(() => cover?.classList.remove('is-flash'), SHELF_FLASH_MS);
      return;
    }
    document.dispatchEvent(new CustomEvent('lifeos:bookpick', { detail: { bookId } }));
  },

  // Coming from the Dashboard dialog ("Add a book" link: goal-details.html?id=…#books-panel).
  scrollOnce(panel) {
    if (this.scrolled || window.location.hash !== '#books-panel') return;
    this.scrolled = true;
    panel.scrollIntoView({ block: 'start' });
    byId('books-title').focus({ preventScroll: true });
  },

  menuOpen() {
    return Boolean(byId('books-list')?.querySelector('.dropdown-menu.show')) || Boolean(byId('book-sheet')?.classList.contains('show'));
  },

  renderIfPending() {
    if (this.pendingRender && !this.menuOpen()) this.render(this.goal());
  },

  /* ----- ⋯: Bootstrap's dropdown with a mouse, a bottom sheet on a touch screen ----- */

  // Only one ⋯ menu at a time: opening one closes the others (Esc and a click outside close it: Bootstrap).
  closeOtherMenus(toggle) {
    byId('books-list').querySelectorAll('[data-book-menu].show').forEach((other) => {
      if (other !== toggle) bootstrap.Dropdown.getInstance(other)?.hide();
    });
  },

  // A touch screen: the click is caught before Bootstrap (window, capture phase), so no dropdown opens;
  // a small window in the middle of the screen opens instead (openSheet).
  catchTouchMenu(event) {
    const toggle = event.target.closest?.('#books-list [data-book-menu]');
    if (!toggle || !window.matchMedia('(pointer: coarse)').matches) return;
    event.preventDefault();
    event.stopPropagation();
    this.openSheet(toggle.dataset.bookMenu, toggle);
  },

  // The small window: the book title (2 lines max) and ✕, big rows "Edit", "Mark as read", "Delete" (red),
  // "Cancel". Esc, ✕, "Cancel" and a tap on the dark background close it; the focus goes back to ⋯.
  openSheet(bookId, opener) {
    const book = goalBooks(this.goal()).find((item) => item.id === bookId);
    if (!book || !window.bootstrap) return;
    this.ensureDialogs();
    this.sheetBookId = bookId;
    this.sheetAction = null;
    this.opener = opener;
    byId('book-sheet-title').textContent = bookTitle(book);
    byId('book-sheet').querySelector('[data-sheet-action="finish"]').hidden = book.status === 'done';
    bootstrap.Modal.getOrCreateInstance(byId('book-sheet')).show();
  },

  // A row of the window: it closes first, then the action (a dialog never opens over it).
  onSheetHidden() {
    const action = this.sheetAction;
    this.sheetAction = null;
    if (action) this.runAction(action, this.sheetBookId, this.opener);
    else this.opener?.focus();
    this.renderIfPending();
  },

  runAction(action, bookId, opener) {
    if (action === 'edit') this.openDialog(bookId, opener);
    if (action === 'finish') this.markRead(bookId);
    if (action === 'delete') this.askDelete(bookId, opener);
  },

  /* ----- "Add / Edit a book" ----- */

  ensureDialogs() {
    if (byId('book-modal')) return;
    document.body.insertAdjacentHTML('beforeend', BOOK_DIALOG_HTML);
    I18n.apply(byId('book-modal'));
    I18n.apply(byId('book-delete-modal'));
    byId('book-form').addEventListener('submit', submitOnce((event) => this.saveDialog(event)));
    byId('book-delete-confirm').addEventListener('click', () => this.confirmDelete());
    byId('book-modal').addEventListener('shown.bs.modal', () => byId('book-title').focus());
    byId('book-delete-modal').addEventListener('shown.bs.modal', () => byId('book-delete-cancel').focus());
    byId('book-sheet').addEventListener('shown.bs.modal', () => byId('book-sheet').querySelector('.book-sheet-item:not([hidden])')?.focus());
    byId('book-sheet').addEventListener('hidden.bs.modal', () => this.onSheetHidden());
    byId('book-sheet').addEventListener('click', (event) => {
      const row = event.target.closest('[data-sheet-action]');
      if (!row) return;
      this.sheetAction = row.dataset.sheetAction;
      bootstrap.Modal.getInstance(byId('book-sheet')).hide();
    });
    I18n.apply(byId('book-sheet'));
    ['book-modal', 'book-delete-modal'].forEach((id) => byId(id).addEventListener('hidden.bs.modal', () => this.restoreFocus()));
  },

  restoreFocus() {
    const target = this.opener?.isConnected ? this.opener : byId('book-add');
    target?.focus();
  },

  openDialog(bookId = null, opener = null) {
    if (!window.bootstrap) return;
    this.ensureDialogs();
    this.editingId = bookId;
    this.opener = opener;
    const book = bookId ? goalBooks(this.goal()).find((item) => item.id === bookId) : null;
    const heading = byId('book-modal-title');
    heading.dataset.i18n = book ? 'books.dialog.editTitle' : 'books.dialog.addTitle'; // re-translated on a language change
    heading.textContent = t(heading.dataset.i18n);
    byId('book-title').value = book?.title ?? '';
    byId('book-author').value = book?.author ?? '';
    const total = book ? bookPagesTotal(book) : null;
    if (total !== null) setNumberValue(byId('book-pages'), total);
    else byId('book-pages').value = '';
    this.fillOptions();
    this.fillStatuses(book);
    ['book-title', 'book-pages'].forEach((id) => setFieldError(byId(id), null));
    bootstrap.Modal.getOrCreateInstance(byId('book-modal')).show();
  },

  // Hints: the titles and authors of the books of all goals (the same book in two goals is typed once).
  fillOptions() {
    const goals = getGoals();
    [['book-title-options', 'title'], ['book-author-options', 'author']].forEach(([id, field]) => {
      byId(id).replaceChildren(...knownBookTexts(goals, field).map((text) => createEl('option', { value: text })));
    });
  },

  fillStatuses(book) {
    const select = byId('book-status');
    const locked = book?.status === 'done' && bookHasFinishEntry(book.id);
    const choices = bookStatusChoices(book, locked);
    select.replaceChildren(...choices.map((status) => createEl('option', { value: status }, t(`books.status.${status}`))));
    select.value = book?.status ?? 'reading'; // a new book: usually the one being read now
    select.disabled = choices.length === 1;
    const hint = byId('book-status-hint');
    hint.hidden = !locked;
    hint.textContent = locked ? t('books.dialog.doneLocked') : '';
    if (locked) select.setAttribute('aria-describedby', 'book-status-hint');
    else select.removeAttribute('aria-describedby');
  },

  // Title 1–120 characters; pages empty (not known) or a whole number > 0.
  readDialog() {
    const title = byId('book-title').value.trim();
    const pagesInput = byId('book-pages');
    const pagesEmpty = pagesInput.value.trim() === '';
    const pages = pagesEmpty ? null : readNumber(pagesInput);
    let pagesError = pagesEmpty ? null : numberError(pages, { positive: true });
    if (!pagesError && pages !== null && !Number.isInteger(pages)) pagesError = 'books.error.wholePages';
    const errors = new Map([[byId('book-title'), title ? null : 'books.error.title'], [pagesInput, pagesError]]);
    errors.forEach((key, input) => setFieldError(input, key));
    if ([...errors.values()].some(Boolean)) return null;
    return { title, author: byId('book-author').value.trim(), totalPages: pages, status: byId('book-status').value };
  },

  saveDialog(event) {
    event.preventDefault();
    const fields = this.readDialog();
    if (!fields) {
      byId('book-form').querySelector('.is-invalid')?.focus();
      return;
    }
    const result = saveBook(this.goalId, fields, this.editingId);
    if (!result) return;
    bootstrap.Modal.getInstance(byId('book-modal')).hide();
    showToast(this.editingId ? 'books.toast.saved' : 'books.toast.added', 'success', { title: bookTitle(result.book) });
    if (!this.editingId) {
      this.filter = 'all'; // the new book is visible at once
      // "Add an entry" chooses this book by itself (js/entry-form.js, preferBook)
      document.dispatchEvent(new CustomEvent('lifeos:bookadded', { detail: { bookId: result.book.id } }));
    }
    renderDetailsPage();
  },

  /* ----- Menu: mark as read, delete ----- */

  markRead(bookId) {
    const result = recordBookReading(this.goalId, bookId, { finish: true, date: Dates.toISO(Dates.today()), note: '' });
    if (!result) return;
    showToast('books.toast.finished', 'success', { title: bookTitle(result.book) });
    renderDetailsPage();
    byId('books-title').focus();
  },

  // "The book and 5 entries (320 pages) will be deleted. The goal counter goes down if the book was read."
  askDelete(bookId, opener) {
    if (!window.bootstrap) return;
    const book = goalBooks(this.goal()).find((item) => item.id === bookId);
    if (!book) return;
    this.ensureDialogs();
    this.deletingId = bookId;
    this.opener = opener;
    const { count, pages } = bookEntriesSummary(bookId);
    byId('book-delete-name').textContent = bookTitle(book);
    byId('book-delete-text').textContent = count
      ? t('books.delete.text', { entries: tPlural('books.delete.entries', count), pages: Format.number(pages) })
      : t('books.delete.textNoEntries');
    bootstrap.Modal.getOrCreateInstance(byId('book-delete-modal')).show();
  },

  // Deleted at once, "Undo" for 7 seconds brings the book and its entries back (as for a project).
  confirmDelete() {
    const goalId = this.goalId;
    const book = goalBooks(this.goal()).find((item) => item.id === this.deletingId);
    const result = book ? deleteBook(goalId, book.id) : null;
    this.deletingId = null;
    this.opener = byId('books-title'); // the card is gone
    bootstrap.Modal.getInstance(byId('book-delete-modal')).hide();
    if (!result) return;
    showToast('books.toast.deleted', 'success', { title: bookTitle(book) }, {
      delay: BOOK_UNDO_DELAY,
      action: { labelKey: 'toast.undo', onClick: () => this.undoDelete(goalId, result.removed) }
    });
    renderDetailsPage();
  },

  undoDelete(goalId, removed) {
    if (!restoreBook(goalId, removed)) {
      showToast('toast.undoFailed', 'warning');
      return;
    }
    showToast('books.toast.restored', 'success');
    renderDetailsPage();
    byId('books-list').querySelector(`[data-book-menu="${CSS.escape(removed.book.id)}"]`)?.focus();
  },

  /* ----- Events ----- */

  bind() {
    byId('book-add').addEventListener('click', (event) => this.openDialog(null, event.currentTarget));
    byId('books-filter').addEventListener('click', (event) => {
      const button = event.target.closest('[data-book-filter]');
      if (!button) return;
      this.filter = button.dataset.bookFilter;
      this.render(this.goal());
      byId('books-filter').querySelector(`[data-book-filter="${this.filter}"]`)?.focus({ preventScroll: true });
      ScrollHints.scrollToActive(byId('books-filter')); // app.js
    });
    byId('books-more').addEventListener('click', () => {
      this.expanded = !this.expanded;
      this.applyLimit();
    });
    let resizeFrame = 0; // the columns change with the width: 2 rows stay 2 rows
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => { if (!byId('books-panel').hidden) this.applyLimit(); });
    });
    byId('books-list').addEventListener('click', (event) => {
      // ⋯ (Bootstrap has already opened its menu): the click goes no further — the book is not chosen
      const menuToggle = event.target.closest('[data-book-menu]');
      if (menuToggle) {
        event.stopPropagation();
        this.closeOtherMenus(menuToggle);
        return;
      }
      const item = event.target.closest('[data-book-action]');
      if (item) {
        event.stopPropagation();
        const menuToggle = item.closest('.book-card')?.querySelector('[data-book-menu]');
        bootstrap.Dropdown.getInstance(menuToggle)?.hide();
        this.runAction(item.dataset.bookAction, item.dataset.bookId, menuToggle);
        return;
      }
      if (event.target.closest('[data-book-add-first]')) {
        this.openDialog(null, event.target.closest('button'));
        return;
      }
      const cover = event.target.closest('[data-book-pick]');
      if (cover) {
        this.pick(cover.dataset.bookPick);
        return;
      }
    });
    window.addEventListener('click', (event) => this.catchTouchMenu(event), true);
    // A redraw that waited for the menu (render) happens when it closes
    byId('books-list').addEventListener('hidden.bs.dropdown', () => this.renderIfPending());
    // "No book to read yet — add a book" in the entry form: opens the dialog right here.
    document.addEventListener('click', (event) => {
      if (event.target.closest('#entry-book-empty-link')) {
        event.preventDefault();
        this.openDialog(null, event.target);
      }
    });
  }
};

function runBooksSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const books = [
    { id: 'a', status: 'done', finishedAt: '2026-10-01' }, { id: 'b', status: 'planned' },
    { id: 'c', status: 'reading', startedAt: '2026-11-01' }, { id: 'd', status: 'done', finishedAt: '2026-11-05' }
  ];
  check('order: reading, want to read, the last finished first', filteredBooks(books, 'all').map((book) => book.id).join(), 'c,b,d,a');
  const planned = [{ id: 'p1', status: 'planned', createdAt: '2026-11-01T10:00:00Z' }, { id: 'p2', status: 'planned', createdAt: '2026-11-03T10:00:00Z' }];
  check('order: inside a status the last changed first', filteredBooks(planned, 'all').map((book) => book.id).join(), 'p2,p1');
  check('order: a newer entry makes a book "changed"', filteredBooks(planned, 'all', [{ bookId: 'p1', date: '2026-11-10' }]).map((book) => book.id).join(), 'p1,p2');
  check('shelf: a phone shows 6, a computer 2 rows', `${shelfLimit(2, true)} ${shelfLimit(7, false)} ${shelfLimit(4, false)}`, '6 14 8');
  check('filter: finished', filteredBooks(books, 'done').length, 2);
  check('hints: no empty titles, no repeats', knownBookTexts([{ books: [{ title: 'B' }, { title: ' ' }] }, { books: [{ title: 'B' }, { title: 'A' }] }], 'title').join(), 'A,B');
  check('status: a new book — any', bookStatusChoices(null, false).length, 3);
  check('status: a finished book with its entry stays finished', bookStatusChoices({ status: 'done' }, true).join(), 'done');
  check('status: a reading book cannot be "done" here', bookStatusChoices({ status: 'reading' }, false).join(), 'planned,reading');
  console.group('[LifeOS] Books self-test');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} books tests failed`);
  else console.info(`All ${results.length} books tests passed`);
  console.groupEnd();
}

onAppReady(() => {
  if (!byId('books-panel')) return;
  BookShelf.bind();
  if (new URLSearchParams(window.location.search).get('debug') === '1') runBooksSelfTest();
});
