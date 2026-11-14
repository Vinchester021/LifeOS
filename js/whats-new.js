// LifeOS — the "What's new" window for people who used an older version (all pages).
// Versions come from data/changelog.json (loadChangelog in app.js), newest first:
//   [{ version, date, items: [{ type: "new" | "improved" | "fixed", text: { en, ru, kk } }] }]
// lifeos_meta.lastSeenVersion is the newest version the user has already seen:
//   - a profile and lastSeenVersion < APP_VERSION -> the window opens once (no lastSeenVersion = a user of
//     LEGACY_VERSION 1.3.0, the last version without this window: only the versions after it are shown);
//   - no profile (a new user) -> nothing; creating a profile or the example writes APP_VERSION;
//   - not while the first-run dialog, a tour or the example mode is on: then on the next page.
// Every unseen version is shown. Several of them: "While you were away, 3 updates came out" and an accordion —
// the newest version open, the older ones folded (<details>). Settings → Help → "What's new" opens the whole history.
// ?debug=1 adds a test version to the list (WHATS_NEW_TEST_ENTRY); it is never saved to changelog.json.
'use strict';

const WHATS_NEW_DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';

// The test version for ?debug=1: with lastSeenVersion 1.3.0 there are 3 unseen versions (1.3.4, 1.3.3 and this one).
const WHATS_NEW_TEST_ENTRY = {
  version: '1.3.2',
  date: '2026-11-14',
  items: [{ type: 'fixed', text: { en: 'Test entry (only with ?debug=1).', ru: 'Тестовая запись (только с ?debug=1).', kk: 'Сынақ жазба (тек ?debug=1 кезінде).' } }]
};

const WHATS_NEW_GROUPS = [
  { type: 'new', icon: 'bi-stars', key: 'whatsNew.new' },
  { type: 'improved', icon: 'bi-arrow-up-circle', key: 'whatsNew.improved' },
  { type: 'fixed', icon: 'bi-check2-circle', key: 'whatsNew.fixed' }
];

// A tour may start on this page (read now: onboarding.js removes these parameters from the address).
const WHATS_NEW_TOUR_ASKED = (() => {
  const params = new URLSearchParams(window.location.search);
  return params.get('tour') === '1' || params.get('from') === 'onboarding';
})();

/* ---------- Pure: which versions to show ---------- */

// Versions newer than `seen` and not newer than the app itself (seen = null: all of them).
function unseenVersions(changelog, seen, current = APP_VERSION) {
  return asArray(changelog)
    .filter((entry) => isPlainObject(entry) && typeof entry.version === 'string')
    .filter((entry) => compareVersions(entry.version, current) <= 0)
    .filter((entry) => !seen || compareVersions(entry.version, seen) > 0);
}

// The changelog plus the test version, newest first (only for ?debug=1).
function withTestEntry(changelog, entry = WHATS_NEW_TEST_ENTRY) {
  const list = asArray(changelog).filter((item) => item?.version !== entry.version);
  return [...list, entry].sort((a, b) => compareVersions(b?.version, a?.version));
}

function needsWhatsNew(seen, current = APP_VERSION) {
  return !seen || compareVersions(seen, current) < 0;
}

// The text of an item in the interface language (English if this language is missing).
function changeText(item) {
  return item?.text?.[I18n.lang] ?? item?.text?.en ?? '';
}

/* ---------- The window ---------- */

const WhatsNew = {
  modalEl: null,
  changelog: [],
  marksSeen: false, // the window opened after an update: closing it in any way writes lastSeenVersion

  ensureModal() {
    if (this.modalEl) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade whats-new-modal" id="whats-new-modal" tabindex="-1" aria-labelledby="whats-new-title">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
          <div class="modal-content">
            <div class="modal-header">
              <div>
                <h2 class="modal-title fs-5" id="whats-new-title"></h2>
                <p class="whats-new-subtitle" id="whats-new-subtitle"></p>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
            </div>
            <div class="modal-body" id="whats-new-body"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-primary" data-bs-dismiss="modal" data-i18n="whatsNew.ok"></button>
            </div>
          </div>
        </div>
      </div>`);
    this.modalEl = byId('whats-new-modal');
    I18n.apply(this.modalEl);
    // "Got it", the cross and Esc all close the window: each of them counts as "seen".
    // Written when closing STARTS, so it is saved even if the next page opens during the fade.
    this.modalEl.addEventListener('hide.bs.modal', () => {
      if (this.marksSeen) updateMeta({ lastSeenVersion: APP_VERSION });
      this.marksSeen = false;
    });
  },

  // versions: newest first. history: the whole list (Settings) instead of "what is new for you".
  render(versions, { history = false } = {}) {
    this.shown = [versions, { history }]; // drawn again in the new language
    const newest = versions[0];
    const accordion = !history && versions.length > 1;
    byId('whats-new-title').textContent = history
      ? t('whatsNew.historyTitle')
      : t('whatsNew.title', { version: newest?.version ?? APP_VERSION });
    byId('whats-new-subtitle').textContent = this.subtitle(versions, history, accordion);
    byId('whats-new-body').innerHTML = this.bodyHtml(versions, history, accordion);
  },

  // Under the title: the date of the one new version, or "While you were away, 3 updates came out".
  subtitle(versions, history, accordion) {
    if (history) return '';
    if (accordion) return tPlural('whatsNew.missed', versions.length);
    return versions[0]?.date ? Format.date(versions[0].date) : '';
  },

  bodyHtml(versions, history, accordion) {
    if (versions.length === 0) return `<p class="text-secondary mb-0">${escapeHtml(t('whatsNew.empty'))}</p>`;
    if (accordion) return versions.map((entry, index) => this.foldHtml(entry, index === 0)).join('');
    return versions.map((entry) => this.versionHtml(entry, history)).join('');
  },

  // One version: "Version 1.1.0 · 14 Nov 2026" (in the history), then New / Improved / Fixed.
  versionHtml(entry, showHead) {
    const head = showHead
      ? `<h3 class="whats-new-version">${escapeHtml(t('whatsNew.version', { version: entry.version, date: entry.date ? Format.date(entry.date) : '' }))}</h3>`
      : '';
    return `<article class="whats-new-entry">${head}${this.groupsHtml(entry)}</article>`;
  },

  // One version of the accordion: "v1.4.0 — 20.11.2026 ▾", opens on a click (the newest is open).
  foldHtml(entry, open) {
    const date = entry.date ? Format.date(entry.date, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const label = date ? t('whatsNew.versionShort', { version: entry.version, date }) : `v${entry.version}`;
    return `
      <details class="whats-new-entry whats-new-fold"${open ? ' open' : ''}>
        <summary class="whats-new-version"><span>${escapeHtml(label)}</span><i class="bi bi-chevron-down" aria-hidden="true"></i></summary>
        ${this.groupsHtml(entry)}
      </details>`;
  },

  // New / Improved / Fixed of one version (an empty group is not shown).
  groupsHtml(entry) {
    return WHATS_NEW_GROUPS.map(({ type, icon, key }) => {
      const items = asArray(entry.items).filter((item) => item?.type === type).map(changeText).filter(Boolean);
      if (items.length === 0) return '';
      return `
        <section class="whats-new-group is-${type}">
          <h4 class="whats-new-group-title"><i class="bi ${icon}" aria-hidden="true"></i>${escapeHtml(t(key))}</h4>
          <ul>${items.map((text) => `<li>${escapeHtml(text)}</li>`).join('')}</ul>
        </section>`;
    }).join('');
  },

  async loadVersions() {
    const changelog = await loadChangelog();
    return WHATS_NEW_DEBUG ? withTestEntry(changelog) : changelog;
  },

  async open(versions, options) {
    if (!window.bootstrap) return;
    this.ensureModal();
    this.render(versions, options);
    bootstrap.Modal.getOrCreateInstance(this.modalEl).show();
  },

  // After an update: once, with the versions the user has not seen yet.
  async maybeShow() {
    if (!getProfile() || isDemoMode() || WHATS_NEW_TOUR_ASKED) return;
    if (getOnboarding().tourPending || byId('tour') || document.querySelector('.modal.show')) return;
    const seen = getMeta().lastSeenVersion ?? LEGACY_VERSION;
    if (!needsWhatsNew(seen)) return;
    this.changelog = await this.loadVersions();
    if (!isCurrentChangelog(this.changelog)) return; // an old list (cache): not "seen", try on the next page
    const versions = unseenVersions(this.changelog, seen);
    if (versions.length === 0) {
      updateMeta({ lastSeenVersion: APP_VERSION }); // nothing to tell
      return;
    }
    this.marksSeen = true;
    this.open(versions);
  },

  // Settings → Help: the whole history.
  async openHistory() {
    this.changelog = await this.loadVersions();
    this.marksSeen = needsWhatsNew(getMeta().lastSeenVersion);
    this.open(unseenVersions(this.changelog, null), { history: true });
  }
};

function runWhatsNewSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const log = [{ version: '1.2.0' }, { version: '1.1.1' }, { version: '1.1.0' }, { version: '1.0.0' }];
  check('no lastSeenVersion: the window is needed', needsWhatsNew(undefined, '1.1.0'), true);
  check('the same version: not needed', needsWhatsNew('1.1.0', '1.1.0'), false);
  check('an older one: needed', needsWhatsNew('1.0.0', '1.1.0'), true);
  check('newer than seen, not newer than the app', unseenVersions(log, '1.0.0', '1.1.1').map((v) => v.version).join(), '1.1.1,1.1.0');
  check('nothing seen: everything up to the app', unseenVersions(log, null, '1.1.0').map((v) => v.version).join(), '1.1.0,1.0.0');
  check('the text falls back to English', changeText({ text: { en: 'A' } }), 'A');
  check('a list without the app version is old', isCurrentChangelog([{ version: '1.0.0' }]), false);
  check('a list with the app version is current', isCurrentChangelog([{ version: APP_VERSION }]), true);
  const many = ['1.9.0', '1.8.0', '1.7.0', '1.6.0', '1.5.0', '1.4.0', '1.3.0'].map((version) => ({ version }));
  check('no limit: 6 unseen versions are all shown', unseenVersions(many, '1.3.0', '1.9.0').length, 6);
  check('the test version goes into its place', withTestEntry(log, { version: '1.1.5' }).map((v) => v.version).join(), '1.2.0,1.1.5,1.1.1,1.1.0,1.0.0');
  console.group('[LifeOS] What\'s new self-test');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} what's new tests failed`);
  else console.info(`All ${results.length} what's new tests passed`);
  console.groupEnd();
}

onAppReady(() => {
  if (WHATS_NEW_DEBUG && byId('first-steps')) runWhatsNewSelfTest();
  byId('whats-new-open')?.addEventListener('click', () => WhatsNew.openHistory());
  document.addEventListener('lifeos:languagechange', () => {
    if (WhatsNew.modalEl?.classList.contains('show')) WhatsNew.render(...WhatsNew.shown);
  });
  // A little later: the first-run dialog or a tour (they start a moment after the page) go first.
  setTimeout(() => WhatsNew.maybeShow(), 900);
});
