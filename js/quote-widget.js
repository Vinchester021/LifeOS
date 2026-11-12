// LifeOS — quote of the day in the side menu (on all 6 pages).
// Moved here from dashboard.js. The card is built by JS, so the shared layout of the
// 6 HTML files stays the same; the "Favorite quotes" dialog is created once per page.
//
// Quotes come from data/quotes.json: { id, text: { en, ru, kk }, author }.
// lifeos_quotes keeps { date, index, favorites: [ids] }: the same quote all day (also after F5),
// a new one on the next day (never yesterday's) — concept, section 8.

const quoteState = { quotes: [], index: 0, isLoaded: false, isExpanded: false };
const QUOTE_ICON_FLASH_TIME = 1500;

function todayIsoDate() {
  return Dates.toISO(Dates.today());
}

/* ---------- Logic (pure functions are checked by the self-test) ---------- */

// Pure: a random index from 0..count-1 that is not `excluded` (if there is a choice).
function randomIndexExcept(count, excluded, random = Math.random) {
  if (count <= 1) return 0;
  const hasExcluded = Number.isInteger(excluded) && excluded >= 0 && excluded < count;
  if (!hasExcluded) return Math.floor(random() * count);
  const index = Math.floor(random() * (count - 1));
  return index >= excluded ? index + 1 : index; // skips the excluded index
}

// Pure: the quote of today. Same day -> the saved index; a new day -> another quote.
function dailyQuoteIndex(saved, todayIsoValue, count, random = Math.random) {
  const isValidIndex = Number.isInteger(saved.index) && saved.index >= 0 && saved.index < count;
  if (saved.date === todayIsoValue && isValidIndex) return saved.index;
  return randomIndexExcept(count, saved.index, random);
}

function isValidQuote(quote) {
  return Boolean(quote) && typeof quote.id === 'string' && quote.text && typeof quote.text.en === 'string';
}

function getQuotesData() {
  const saved = AppStorage.get(STORAGE_KEYS.quotes, {});
  const data = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  return { ...data, favorites: asArray(data.favorites) };
}

function saveQuotesData(changes) {
  return AppStorage.set(STORAGE_KEYS.quotes, { ...getQuotesData(), ...changes });
}

// quotes.json through a server, data/quotes-fallback.js as file:// (loadQuotesData in app.js).
// If there are no quotes at all, the card quietly shows the built-in quote (no error on screen).
async function loadQuotes() {
  const list = await loadQuotesData();
  return Array.isArray(list) ? list.filter(isValidQuote) : [];
}

function quoteText(quote) {
  return quote.text[I18n.lang] ?? quote.text.en;
}

// "Seneca" -> "Сенека" (translations.json, keys author.seneca …); unknown authors stay as they are.
function quoteAuthorName(author) {
  const key = `author.${String(author).toLowerCase().replace(/\s+/g, '-')}`;
  return I18n.dictionaries[I18n.lang]?.[key] !== undefined ? t(key) : String(author);
}

function currentQuote() {
  return quoteState.quotes[quoteState.index] ?? null;
}

/* ---------- Markup: the card at the bottom of the side menu + the favorites dialog ---------- */

const QUOTE_CARD_HTML = `
  <div class="sidebar-spacer" aria-hidden="true"></div>
  <section class="sidebar-quote" aria-labelledby="quote-title">
    <div class="sidebar-quote-head">
      <h2 class="sidebar-quote-title" id="quote-title" data-i18n="dashboard.quote.title"></h2>
      <button type="button" class="btn btn-link sidebar-quote-favorites" id="quote-favorites-open">
        <span data-i18n="quote.favorites"></span>
        <span class="badge tab-count" id="quote-favorites-count">0</span>
      </button>
    </div>
    <figure class="sidebar-quote-figure">
      <blockquote class="sidebar-quote-text" id="quote-text" aria-live="polite"></blockquote>
      <button type="button" class="btn btn-link sidebar-quote-more" id="quote-more"
              aria-controls="quote-text" aria-expanded="false" hidden></button>
      <figcaption class="sidebar-quote-author" id="quote-author"></figcaption>
    </figure>
    <div class="sidebar-quote-actions">
      <button type="button" class="btn btn-icon" id="quote-new" data-i18n-aria-label="quote.new" data-i18n-title="quote.new">
        <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
      </button>
      <button type="button" class="btn btn-icon" id="quote-copy" data-i18n-aria-label="quote.copyLabel" data-i18n-title="quote.copyLabel">
        <i class="bi bi-clipboard" aria-hidden="true"></i>
      </button>
      <button type="button" class="btn btn-icon" id="quote-favorite" aria-pressed="false" data-i18n-aria-label="quote.favorite">
        <i class="bi bi-heart" aria-hidden="true"></i>
      </button>
    </div>
    <!-- "Copied" / "Added to favorites" for screen readers (the buttons only flash a check mark) -->
    <p class="visually-hidden" id="quote-status" role="status"></p>
  </section>`;

const QUOTE_FAVORITES_HTML = `
  <div class="modal fade" id="quote-favorites-modal" tabindex="-1" aria-labelledby="quote-favorites-title">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="quote-favorites-title" tabindex="-1" data-i18n="quote.favoritesTitle"></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body">
          <p class="task-empty" id="quote-favorites-empty" data-i18n="quote.favoritesEmpty" hidden></p>
          <ul class="favorite-quotes" id="quote-favorites-list"></ul>
        </div>
      </div>
    </div>
  </div>`;

// Returns false on a page without the side menu (then there is no quote card).
function buildQuoteWidget() {
  const menuBody = document.querySelector('.sidebar .offcanvas-body');
  if (!menuBody) return false;
  menuBody.insertAdjacentHTML('beforeend', QUOTE_CARD_HTML);
  document.body.insertAdjacentHTML('beforeend', QUOTE_FAVORITES_HTML);
  I18n.apply(menuBody);
  I18n.apply(byId('quote-favorites-modal'));
  return true;
}

/* ---------- Drawing ---------- */

function renderQuote() {
  if (!quoteState.isLoaded) return;
  const quote = currentQuote();
  const favorites = getQuotesData().favorites;
  byId('quote-text').textContent = quote ? quoteText(quote) : t('quote.fallback.text');
  byId('quote-author').textContent = `— ${quote ? quoteAuthorName(quote.author) : t('app.name')}`;
  // Without the file there is nothing to switch to or to save.
  byId('quote-new').disabled = quoteState.quotes.length < 2;
  const favoriteButton = byId('quote-favorite');
  const isFavorite = Boolean(quote) && favorites.includes(quote.id);
  favoriteButton.disabled = !quote;
  favoriteButton.setAttribute('aria-pressed', String(isFavorite));
  favoriteButton.title = t(isFavorite ? 'quote.favoriteRemove' : 'quote.favoriteAdd');
  favoriteButton.querySelector('i').className = `bi ${isFavorite ? 'bi-heart-fill' : 'bi-heart'}`;
  byId('quote-favorites-count').textContent = favorites.length;
  updateQuoteMore();
}

// A long quote is cut after 4 lines (CSS line-clamp); "More" shows it all.
function updateQuoteMore() {
  const text = byId('quote-text');
  const more = byId('quote-more');
  text.classList.toggle('is-expanded', quoteState.isExpanded);
  const isCut = text.scrollHeight > text.clientHeight + 1;
  more.hidden = !quoteState.isExpanded && !isCut;
  more.textContent = t(quoteState.isExpanded ? 'quote.less' : 'quote.more');
  more.setAttribute('aria-expanded', String(quoteState.isExpanded));
}

function toggleQuoteMore() {
  quoteState.isExpanded = !quoteState.isExpanded;
  updateQuoteMore();
}

function showNewQuote() {
  quoteState.index = randomIndexExcept(quoteState.quotes.length, quoteState.index);
  quoteState.isExpanded = false;
  saveQuotesData({ date: todayIsoDate(), index: quoteState.index });
  renderQuote();
}

// Small confirmations without a toast: the button shows a check mark for 1.5 s,
// and the hidden status line tells screen reader users what happened.
function flashButtonIcon(button, messageKey, restoreIcon) {
  clearTimeout(button.flashTimer);
  button.querySelector('i').className = 'bi bi-check2';
  byId('quote-status').textContent = t(messageKey);
  button.flashTimer = setTimeout(restoreIcon, QUOTE_ICON_FLASH_TIME);
}

async function copyQuote() {
  const text = `“${byId('quote-text').textContent}” ${byId('quote-author').textContent}`;
  const button = byId('quote-copy');
  try {
    await navigator.clipboard.writeText(text);
    flashButtonIcon(button, 'toast.quoteCopied', () => {
      button.querySelector('i').className = 'bi bi-clipboard';
    });
  } catch (error) {
    showToast('toast.copyFailed', 'warning');
  }
}

function toggleFavorite() {
  const quote = currentQuote();
  if (!quote) return;
  const favorites = getQuotesData().favorites;
  const isFavorite = favorites.includes(quote.id);
  const next = isFavorite ? favorites.filter((id) => id !== quote.id) : [...favorites, quote.id];
  if (!saveQuotesData({ favorites: next })) return;
  renderQuote(); // updates the counter and aria-pressed
  // After the check mark, renderQuote() puts back the filled or empty heart.
  flashButtonIcon(byId('quote-favorite'), isFavorite ? 'toast.favoriteRemoved' : 'toast.favoriteAdded', renderQuote);
}

// Favorite quotes in the dialog; quotes that are no longer in the file are skipped.
function renderFavorites() {
  const favorites = getQuotesData().favorites
    .map((id) => quoteState.quotes.find((quote) => quote.id === id))
    .filter(Boolean);
  byId('quote-favorites-empty').hidden = favorites.length > 0;
  byId('quote-favorites-list').innerHTML = favorites.map((quote, index) => `
    <li>
      <blockquote class="mb-1">${escapeHtml(quoteText(quote))}</blockquote>
      <span class="quote-author">— ${escapeHtml(quoteAuthorName(quote.author))}</span>
      <button type="button" class="btn btn-icon" id="favorite-remove-${index}" data-remove-favorite="${escapeHtml(quote.id)}"
              aria-label="${escapeHtml(t('quote.remove', { author: quoteAuthorName(quote.author) }))}">
        <i class="bi bi-trash" aria-hidden="true"></i>
      </button>
    </li>`).join('');
}

function removeFavorite(id, index) {
  const favorites = getQuotesData().favorites.filter((item) => item !== id);
  if (!saveQuotesData({ favorites })) return;
  showToast('toast.favoriteRemoved', 'success');
  renderFavorites();
  renderQuote();
  // Focus goes to the next remove button, or to the dialog title if the list is empty now.
  (byId(`favorite-remove-${index}`) ?? byId(`favorite-remove-${index - 1}`) ?? byId('quote-favorites-title')).focus();
}

function openFavorites() {
  renderFavorites();
  // On a phone the quote lives in the Offcanvas menu: close it first, Bootstrap allows one overlay.
  const menu = bootstrap.Offcanvas.getInstance(byId('sidebar'));
  if (menu && byId('sidebar').classList.contains('show')) menu.hide();
  bootstrap.Modal.getOrCreateInstance(byId('quote-favorites-modal')).show();
}

/* ---------- Start ---------- */

async function initQuotes() {
  quoteState.quotes = await loadQuotes();
  if (quoteState.quotes.length) {
    const saved = getQuotesData();
    quoteState.index = dailyQuoteIndex(saved, todayIsoDate(), quoteState.quotes.length);
    if (saved.date !== todayIsoDate() || saved.index !== quoteState.index) {
      saveQuotesData({ date: todayIsoDate(), index: quoteState.index });
    }
  }
  quoteState.isLoaded = true;
  renderQuote();
}

function bindQuoteEvents() {
  byId('quote-new').addEventListener('click', showNewQuote);
  byId('quote-copy').addEventListener('click', copyQuote);
  byId('quote-favorite').addEventListener('click', toggleFavorite);
  byId('quote-more').addEventListener('click', toggleQuoteMore);
  byId('quote-favorites-open').addEventListener('click', openFavorites);
  byId('quote-favorites-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-favorite]');
    if (button) removeFavorite(button.dataset.removeFavorite, Number(button.id.split('-').pop()));
  });
  // Back to the "Favorites" button, if it is visible (on a phone the menu is closed by then).
  byId('quote-favorites-modal').addEventListener('hidden.bs.modal', () => {
    const opener = byId('quote-favorites-open');
    if (opener.offsetParent) opener.focus();
  });
  document.addEventListener('lifeos:languagechange', renderQuote); // same quote, other language
  // "More" depends on the card width and on whether the card is visible at all.
  window.addEventListener('resize', updateQuoteMore);
  byId('sidebar').addEventListener('shown.bs.offcanvas', updateQuoteMore);
}

// Self-test of the quote logic: any page with ?debug=1
function runQuoteSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const fixed = (value) => () => value; // a "random" that always returns the same number
  check('same day -> saved quote', dailyQuoteIndex({ date: '2026-11-11', index: 7 }, '2026-11-11', 50, fixed(0)), 7);
  check('new day -> not yesterday (random hits it)', dailyQuoteIndex({ date: '2026-11-10', index: 0 }, '2026-11-11', 50, fixed(0)), 1);
  check('new day -> skips yesterday in the middle', randomIndexExcept(5, 2, fixed(0.5)), 3);
  check('never returns the excluded index', [0, 0.2, 0.4, 0.6, 0.8, 0.99].every((value) => randomIndexExcept(5, 3, fixed(value)) !== 3), true);
  check('broken saved index -> any quote', dailyQuoteIndex({ date: '2026-11-11', index: 99 }, '2026-11-11', 50, fixed(0)), 0);
  check('one quote only', randomIndexExcept(1, 0, fixed(0.9)), 0);
  check('invalid quotes are dropped', [{ id: 'a', text: { en: 'x' } }, { id: 'b' }, null].filter(isValidQuote).length, 1);
  console.group('[LifeOS] Quote self-test');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} quote tests failed`);
  else console.info(`All ${results.length} quote tests passed`);
  console.groupEnd();
}

onAppReady(() => {
  if (!buildQuoteWidget()) return;
  bindQuoteEvents();
  initQuotes();
  if (new URLSearchParams(window.location.search).get('debug') === '1') runQuoteSelfTest();
});
