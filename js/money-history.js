// LifeOS — "Operations history" of a money goal on Goal Details (docs/design/money-history-v2.png).
// Its own file (like books.js): the history has its own state — the month, two filters, "Show all" —
// and its own markup. The numbers come from app.js (moneyPeriodEntries, moneyEntriesSum, filterMoneyEntries …);
// editing and deleting a row are the same as in every history (goal-details.js: editEntry, deleteEntry).
//
//   [📅 November 2026 ▾]  [All operations ▾]  [All sources ▾]          [Total for the month  +17 500 ₸]
//   Date | ⊞ Deposit | Source | Amount | ✎ 🗑
//   "Shown 2 of 5 · total of the filter: +350 000 ₸" (with a filter); a long list scrolls inside (3 cards / 12 rows)
'use strict';

// A long list scrolls inside the block, the filters and the total above it stay. The visible height is measured
// on the real rows: a phone (cards) — 3 cards; a tablet / computer (the table) — the head and 12 rows.
// A shorter list shows all its rows without a scroll. No overscroll-behavior: at the start or the end of the list
// the wheel (or the finger) scrolls the page.
const MONEY_HISTORY_ROWS = { phone: 3, wide: 12 };
const moneyHistoryPhone = window.matchMedia('(max-width: 767.98px)');

const MoneyHistory = {
  goalId: null,
  month: null,          // "YYYY-MM" or MONEY_ALL_TIME
  kind: 'all',          // the "Operation" filter: all | in | out
  source: '',           // the "Source" filter: '' = all
  focusId: null,        // after a choice the focus goes back to the same list

  /* ----- The numbers of what is shown ----- */

  view(goal) {
    const entries = getGoalEntries(goal.id);
    const months = moneyHistoryMonths(goal, entries);
    if (this.goalId !== goal.id) this.resetFor(goal.id, entries);
    if (this.month !== MONEY_ALL_TIME && !months.includes(this.month)) this.month = defaultMoneyMonth(entries);
    const period = moneyPeriodEntries(entries, this.month);
    const sources = moneySourceOptions(period);
    if (this.source && !sources.some((text) => moneySourceKey(text) === moneySourceKey(this.source))) this.source = '';
    const shown = filterMoneyEntries(period, { kind: this.kind, source: this.source });
    return { entries, months, period, sources, shown };
  },

  resetFor(goalId, entries) {
    Object.assign(this, { goalId, month: defaultMoneyMonth(entries), kind: 'all', source: '' });
  },

  filtered() {
    return this.kind !== 'all' || this.source !== '';
  },

  /* ----- Drawing ----- */

  render(goal) {
    const data = this.view(goal);
    byId('money-history').innerHTML = [
      this.filtersHtml(goal, data),
      data.period.length ? this.tableHtml(goal, data, entryForm.editedId()) : this.emptyHtml(data),
      this.footerHtml(goal, data)
    ].join('');
    this.fitHeight();
    this.restoreFocus();
  },

  // "November 2026" — the month name without "г." / "ж." (the same way as Format.periodRange)
  monthName(month) {
    if (month === MONEY_ALL_TIME) return t('money.history.allTime');
    const date = Dates.parse(`${month}-01`);
    return `${upperFirst(Format.date(date, { month: 'long' }))} ${date.getFullYear()}`;
  },

  // "+300 000 ₸" in green, "−50 000 ₸" in red, "0 ₸" in grey
  signedMoney(goal, amount) {
    const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
    return `${sign}${formatGoalValue(goal, Math.abs(amount))}`;
  },

  toneClass(amount) {
    if (amount > 0) return 'is-plus';
    return amount < 0 ? 'is-minus' : 'is-zero';
  },

  // A list without a visible label: its name is the aria-label ("Month", "Operation", "Source");
  // the options are [value, text], user texts are escaped.
  selectHtml({ id, labelKey, options, value, icon = '', extraClass = '' }) {
    const items = options.map(([key, text]) => `<option value="${escapeHtml(key)}"${key === value ? ' selected' : ''}>${escapeHtml(text)}</option>`).join('');
    return `
      <div class="mh-field ${extraClass}">
        <div class="mh-select${icon ? ' has-icon' : ''}">
          ${icon ? `<i class="bi ${icon}" aria-hidden="true"></i>` : ''}
          <select class="form-select" id="${id}" data-mh-filter aria-label="${escapeHtml(t(labelKey))}">${items}</select>
        </div>
      </div>`;
  },

  // Month | Operation | Source, and on the right "Total for the month +17 500 ₸" (by all operations, not the filter)
  filtersHtml(goal, { months, period, sources }) {
    const total = moneyEntriesSum(period);
    const totalKey = this.month === MONEY_ALL_TIME ? 'money.history.total' : 'money.history.totalMonth';
    return `
      <div class="mh-filters">
        ${this.selectHtml({ id: 'mh-month', labelKey: 'money.history.month', icon: 'bi-calendar3', extraClass: 'mh-field-month',
          options: [...months, MONEY_ALL_TIME].map((month) => [month, this.monthName(month)]), value: this.month })}
        ${this.selectHtml({ id: 'mh-kind', labelKey: 'money.history.colOp', extraClass: this.kind !== 'all' ? 'is-active' : '',
          options: [['all', t('money.history.allOps')], ['in', t('money.history.deposits')], ['out', t('money.history.withdrawals')]], value: this.kind })}
        ${this.selectHtml({ id: 'mh-source', labelKey: 'money.history.colSource', extraClass: this.source ? 'is-active' : '',
          options: [['', t('money.history.allSources')], ...sources.map((text) => [text, text])], value: this.source })}
        <p class="mh-total ${this.toneClass(total)}">
          <span>${escapeHtml(t(totalKey))}</span>
          <strong class="mh-total-value">${escapeHtml(this.signedMoney(goal, total))}</strong>
        </p>
      </div>`;
  },

  tableHtml(goal, { shown }, editedId) {
    const rows = shown.map((entry) => this.rowHtml(goal, entry, editedId)).join('');
    return `
      <div class="mh-box" id="mh-box">
        <div class="mh-scroll" id="mh-scroll">
          <table class="mh-table">
            <thead>
              <tr>
                <th scope="col" class="mh-date">${escapeHtml(t('money.history.colDate'))}</th>
                <th scope="col" class="mh-op">${escapeHtml(t('money.history.colOp'))}</th>
                <th scope="col" class="mh-source">${escapeHtml(t('money.history.colSource'))}</th>
                <th scope="col" class="mh-amount">${escapeHtml(t('money.history.colAmount'))}</th>
                <th scope="col" class="mh-actions"><span class="visually-hidden">${escapeHtml(t('money.history.colActions'))}</span></th>
              </tr>
            </thead>
            <tbody id="mh-rows">${rows}</tbody>
          </table>
          ${shown.length ? '' : `<p class="mh-empty-filter">${escapeHtml(t('money.history.emptyFilter'))}</p>`}
        </div>
      </div>`;
  },

  // Date | the colored sign and the word | the source ("—") and an old note | the amount | ✎ 🗑
  rowHtml(goal, entry, editedId) {
    const out = moneyEntryKind(entry) === 'out';
    const date = Format.shortDate(entry.date);
    const source = tidyMoneySource(entry.source);
    const amount = Number(entry.value) || 0;
    return `
      <tr class="${entry.id === editedId ? 'is-editing' : ''}" data-entry-row="${escapeHtml(entry.id)}">
        <td class="mh-date">${escapeHtml(date)}</td>
        <td class="mh-op">
          <span class="mh-sign ${out ? 'is-out' : 'is-in'}" aria-hidden="true"><i class="bi ${out ? 'bi-dash-lg' : 'bi-plus-lg'}"></i></span>
          <span class="mh-op-word">${escapeHtml(t(out ? 'details.history.out' : 'details.history.in'))}</span>
        </td>
        <td class="mh-source">
          <span class="mh-source-text${source ? '' : ' is-none'}">${escapeHtml(source || '—')}</span>
          ${entry.note ? `<span class="mh-note">${escapeHtml(entry.note)}</span>` : ''}
        </td>
        <td class="mh-amount gd-history-change is-money ${out ? 'is-minus' : 'is-plus'}">${escapeHtml(this.signedMoney(goal, amount))}</td>
        <td class="mh-actions">${historyActionsHtml(goal, entry, date)}</td>
      </tr>`;
  },

  emptyHtml({ entries }) {
    const key = this.month === MONEY_ALL_TIME || entries.length === 0 ? 'money.history.emptyAll' : 'money.history.emptyMonth';
    return `<div class="gd-empty mh-empty"><i class="bi bi-clock-history" aria-hidden="true"></i><span>${escapeHtml(t(key))}</span></div>`;
  },

  // "Shown 2 of 5 · total of the filter: +350 000 ₸" (only with a filter)
  footerHtml(goal, { period, shown }) {
    if (!this.filtered() || !period.length) return '';
    return `<p class="mh-filter-line" aria-live="polite">${escapeHtml(t('money.history.filterLine', {
      shown: Format.number(shown.length), total: Format.number(period.length), sum: this.signedMoney(goal, moneyEntriesSum(shown))
    }))}</p>`;
  },

  /* ----- Long lists ----- */

  // The height of the scrolling block: up to the bottom of the 3rd card (phone) or of the 12th row with the head
  // (tablet, computer). Fewer rows — no limit, so no inner scroll at all.
  fitHeight() {
    const scroller = byId('mh-scroll');
    if (!scroller) return;
    const rows = [...scroller.querySelectorAll('#mh-rows > tr')];
    const count = moneyHistoryPhone.matches ? MONEY_HISTORY_ROWS.phone : MONEY_HISTORY_ROWS.wide;
    scroller.style.maxHeight = '';
    if (rows.length > count) {
      const top = scroller.getBoundingClientRect().top - scroller.scrollTop;
      scroller.style.maxHeight = `${Math.ceil(rows[count - 1].getBoundingClientRect().bottom - top)}px`;
    }
    scroller.classList.toggle('is-scrolling', rows.length > count);
    this.updateFade();
  },

  // The fade at the bottom while more rows are below (a list that does not scroll has none).
  updateFade() {
    const scroller = byId('mh-scroll');
    if (!scroller) return;
    const moreBelow = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 2;
    byId('mh-box').classList.toggle('has-more-below', moreBelow);
  },

  restoreFocus() {
    if (!this.focusId) return;
    byId(this.focusId)?.focus();
    this.focusId = null;
  },

  // An entry must be seen (after it was added, edited or brought back): its month, no filter that hides it,
  // the whole list on a phone, the scrolling block brought to the row. Returns the row or null.
  show(entryId) {
    const goal = loadGoal();
    const entry = goal ? getGoalEntries(goal.id).find((item) => item.id === entryId) : null;
    if (!entry) return null;
    if (this.month !== MONEY_ALL_TIME && this.month !== entryMonthKey(entry)) this.month = entryMonthKey(entry);
    if (filterMoneyEntries([entry], { kind: this.kind, source: this.source }).length === 0) Object.assign(this, { kind: 'all', source: '' });
    this.render(goal);
    const row = document.querySelector(`#mh-rows [data-entry-row="${CSS.escape(entryId)}"]`);
    this.scrollToRow(row);
    return row;
  },

  scrollToRow(row) {
    const scroller = byId('mh-scroll');
    if (!row || !scroller) return;
    const head = scroller.querySelector('thead')?.getBoundingClientRect().height ?? 0; // the sticky head covers the top
    const box = scroller.getBoundingClientRect();
    const place = row.getBoundingClientRect();
    if (place.top < box.top + head) scroller.scrollTop -= box.top + head - place.top;
    else if (place.bottom > box.bottom) scroller.scrollTop += place.bottom - box.bottom;
    this.updateFade();
  },

  /* ----- Events ----- */

  // A list was changed: the state, then the table is drawn again and the focus goes back to that list.
  onChange(event) {
    const select = event.target.closest('[data-mh-filter]');
    if (!select) return;
    const field = { 'mh-month': 'month', 'mh-kind': 'kind', 'mh-source': 'source' }[select.id];
    Object.assign(this, { [field]: select.value });
    this.focusId = select.id;
    const goal = loadGoal();
    if (goal) this.render(goal);
    const scroller = byId('mh-scroll');
    if (scroller) scroller.scrollTop = 0;
    this.updateFade();
  },

  bind() {
    const box = byId('money-history');
    box.addEventListener('change', (event) => this.onChange(event));
    // The scroll lives in a block drawn again with every change: listen on the box (scroll does not bubble)
    box.addEventListener('scroll', () => this.updateFade(), true);
    // Cards ↔ table, a narrower window, other fonts: the rows change their height — measure again
    moneyHistoryPhone.addEventListener('change', () => this.fitHeight());
    window.addEventListener('resize', () => this.fitHeight());
  }
};
