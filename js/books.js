// LifeOS — "My books" on Goal Details: the book shelf of a "Books" goal with a book list.
// The data and the rules (pages, statuses, the counter of the goal, undo) are in app.js, section 11a;
// pages are recorded with the "Add an entry" form (js/entry-form.js). Here: the list, the filter,
// the "Add / Edit a book" dialog, "Mark as read" and deleting a book (with its reading entries).
// Book titles and authors are user data: always escapeHtml / textContent.
'use strict';

const BOOK_FILTERS = ['all', 'reading', 'done', 'planned'];
const BOOK_STATUS_TONE = { planned: '', reading: 'is-accent', done: 'is-success' };
const BOOK_ORDER = { reading: 0, planned: 1, done: 2 };

/* ---------- Pure ---------- */

// The books of one filter: reading -> want to read -> finished (the last finished first).
function filteredBooks(books, filter) {
  return books
    .filter((book) => filter === 'all' || book.status === filter)
    .sort((a, b) => BOOK_ORDER[a.status] - BOOK_ORDER[b.status]
      || String(b.finishedAt ?? b.startedAt ?? '').localeCompare(String(a.finishedAt ?? a.startedAt ?? ''))
      || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
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

const BOOK_DIALOG_HTML = `
  <div class="modal fade" id="book-modal" tabindex="-1" aria-labelledby="book-modal-title">
    <div class="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
      <form class="modal-content" id="book-form" novalidate>
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="book-modal-title"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label" for="book-title" data-i18n="books.dialog.title"></label>
              <input class="form-control" type="text" id="book-title" maxlength="${BOOK_TEXT_MAX}" autocomplete="off" list="book-title-options">
              <datalist id="book-title-options"></datalist>
              <p class="field-error" id="book-title-error"></p>
            </div>
            <div class="col-12">
              <label class="form-label" for="book-author" data-i18n="books.dialog.author"></label>
              <input class="form-control" type="text" id="book-author" maxlength="${BOOK_TEXT_MAX}" autocomplete="off" list="book-author-options">
              <datalist id="book-author-options"></datalist>
            </div>
            <div class="col-sm-6">
              <label class="form-label" for="book-pages" data-i18n="books.dialog.pages"></label>
              <div class="input-group">
                <input class="form-control" type="text" id="book-pages" inputmode="numeric" autocomplete="off" data-number="integer">
                <span class="input-group-text" data-i18n="details.entry.pagesUnit"></span>
              </div>
              <div class="form-text" id="book-pages-hint" data-i18n="books.dialog.pagesHint"></div>
              <p class="field-error" id="book-pages-error"></p>
            </div>
            <div class="col-sm-6">
              <label class="form-label" for="book-status" data-i18n="books.dialog.status"></label>
              <select class="form-select" id="book-status"></select>
              <div class="form-text" id="book-status-hint" hidden></div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-tool" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <button type="submit" class="btn btn-primary"><i class="bi bi-check2 me-2" aria-hidden="true"></i><span data-i18n="books.dialog.save"></span></button>
        </div>
      </form>
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

// "120 / 320 pages" with a bar; no page count: "Read 120 pages" (nothing while no page is read).
function bookPagesHtml(book) {
  const read = Number(book.pagesRead) || 0;
  const total = bookPagesTotal(book);
  if (total === null) {
    return read > 0 ? `<p class="book-card-pages">${escapeHtml(t('books.card.read', { read: Format.number(read) }))}</p>` : '';
  }
  const percent = Math.min(Math.round((read / total) * 100), 100);
  const text = t('books.card.readOf', { read: Format.number(read), total: Format.number(total) });
  return `
    <div class="book-card-progress">
      <div class="progress" role="progressbar" aria-label="${escapeHtml(text)}" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar" style="width: ${percent}%"></div>
      </div>
      <span class="book-card-pages">${escapeHtml(text)}</span>
    </div>`;
}

function bookMenuHtml(book) {
  const title = bookTitle(book);
  const item = (action, icon, key, extra = '') => `
    <li><button type="button" class="dropdown-item ${extra}" data-book-action="${action}" data-book-id="${escapeHtml(book.id)}">
      <i class="bi ${icon} me-2" aria-hidden="true"></i>${escapeHtml(t(key))}
    </button></li>`;
  return `
    <div class="dropdown book-card-menu">
      <button type="button" class="btn btn-icon" data-bs-toggle="dropdown" aria-expanded="false"
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

function bookCardHtml(book) {
  const author = String(book.author ?? '').trim();
  return `
    <li class="book-card" data-status="${escapeHtml(book.status)}">
      <div class="book-card-top">
        <span class="book-card-icon" aria-hidden="true"><i class="bi ${book.status === 'done' ? 'bi-journal-check' : 'bi-book'}"></i></span>
        <div class="book-card-text">
          <h3 class="book-card-title">${escapeHtml(bookTitle(book))}</h3>
          ${author ? `<p class="book-card-author">${escapeHtml(author)}</p>` : ''}
        </div>
        <span class="badge-status ${BOOK_STATUS_TONE[book.status] ?? ''}">${escapeHtml(t(`books.status.${book.status}`))}</span>
        ${bookMenuHtml(book)}
      </div>
      ${bookPagesHtml(book)}
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

  goal() {
    return getGoalById(this.goalId);
  },

  // Called by renderDetailsPage (goal-details.js) on every change of the goal.
  render(goal) {
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
    const shown = filteredBooks(books, this.filter);
    byId('books-list').innerHTML = shown.map(bookCardHtml).join('');
    const empty = byId('books-empty');
    empty.hidden = shown.length > 0;
    empty.querySelector('span').textContent = t(books.length ? 'books.empty.filter' : 'books.empty.none');
  },

  // Coming from the Dashboard dialog ("Add a book" link: goal-details.html?id=…#books-panel).
  scrollOnce(panel) {
    if (this.scrolled || window.location.hash !== '#books-panel') return;
    this.scrolled = true;
    panel.scrollIntoView({ block: 'start' });
    byId('books-title').focus({ preventScroll: true });
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

  confirmDelete() {
    const book = goalBooks(this.goal()).find((item) => item.id === this.deletingId);
    const goal = book ? deleteBook(this.goalId, book.id) : null;
    this.deletingId = null;
    this.opener = byId('books-title'); // the card is gone
    bootstrap.Modal.getInstance(byId('book-delete-modal')).hide();
    if (!goal) return;
    showToast('books.toast.deleted', 'success', { title: bookTitle(book) });
    renderDetailsPage();
  },

  /* ----- Events ----- */

  bind() {
    byId('book-add').addEventListener('click', (event) => this.openDialog(null, event.currentTarget));
    byId('books-filter').addEventListener('click', (event) => {
      const button = event.target.closest('[data-book-filter]');
      if (!button) return;
      this.filter = button.dataset.bookFilter;
      this.render(this.goal());
      byId('books-filter').querySelector(`[data-book-filter="${this.filter}"]`)?.focus();
    });
    byId('books-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-book-action]');
      if (!button) return;
      const { bookAction, bookId } = button.dataset;
      const opener = button.closest('.book-card')?.querySelector('[data-bs-toggle="dropdown"]');
      if (bookAction === 'edit') this.openDialog(bookId, opener);
      if (bookAction === 'finish') this.markRead(bookId);
      if (bookAction === 'delete') this.askDelete(bookId, opener);
    });
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
