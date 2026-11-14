// LifeOS — "Leave feedback" (all pages).
// Any button with data-feedback-open (side menu, Settings → Help, the Dashboard invitation) opens a small
// window; its "Open the feedback form" link leads to the Google Form (FEEDBACK_URL in app.js) in a new tab.
// Only two fields are filled in for the user: the version (APP_VERSION) and "phone / computer, language".
// No user agent, no name, no localStorage data.
// Dashboard: one quiet invitation when the profile is 7+ days old and First steps are done;
// after "Leave feedback" or "Not now" it never shows again (lifeos_settings.onboarding.feedbackAsked).
'use strict';

const FEEDBACK_INVITE_DAYS = 7;

// The words written into the "DEVICE" field: data for the author of the form, the same in every language.
const FEEDBACK_DEVICE_NAMES = { phone: 'телефон', computer: 'компьютер' };

/* ---------- Pure ---------- */

// The smaller side of the screen under 600px = a phone (the screen size, not the user agent).
function feedbackDeviceType(screenWidth, screenHeight) {
  return Math.min(screenWidth, screenHeight) < 600 ? 'phone' : 'computer';
}

// The form address with the two filled-in fields: ...viewform?entry.X=1.3.5&entry.Y=телефон, ru
// (encodeURIComponent: a space becomes %20, Cyrillic letters and the comma are encoded too).
function feedbackFormUrl({ version, device, lang }) {
  const value = (text) => encodeURIComponent(text);
  return `${FEEDBACK_URL}?${FEEDBACK_FIELD_VERSION}=${value(version)}&${FEEDBACK_FIELD_DEVICE}=${value(`${FEEDBACK_DEVICE_NAMES[device]}, ${lang}`)}`;
}

// The invitation: a real profile, 7+ days old, First steps done, not asked yet, not the example.
function shouldInviteFeedback({ profile, onboarding, today }) {
  if (!profile || onboarding.demoMode || onboarding.feedbackAsked || !onboarding.checklistCelebrated) return false;
  const created = new Date(profile.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return Dates.daysBetween(Dates.startOfDay(created), today) >= FEEDBACK_INVITE_DAYS;
}

/* ---------- The window ---------- */

const FEEDBACK_MODAL_HTML = `
  <div class="modal fade feedback-modal" id="feedback-modal" tabindex="-1" aria-labelledby="feedback-title" aria-describedby="feedback-text">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title fs-5" id="feedback-title"><i class="bi bi-chat-heart me-2" aria-hidden="true"></i><span data-i18n="feedback.title"></span></h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" data-i18n-aria-label="wizard.close"></button>
        </div>
        <div class="modal-body">
          <p class="mb-0" id="feedback-text" data-i18n="feedback.text"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-tool" data-bs-dismiss="modal" data-i18n="delete.cancel"></button>
          <a class="btn btn-primary" id="feedback-link" href="${FEEDBACK_URL}" target="_blank" rel="noopener">
            <i class="bi bi-box-arrow-up-right me-2" aria-hidden="true"></i><span data-i18n="feedback.open"></span>
            <span class="visually-hidden" data-i18n="feedback.newTab"></span>
          </a>
        </div>
      </div>
    </div>
  </div>`;

const Feedback = {
  modalEl: null,

  ensureModal() {
    if (this.modalEl) return;
    document.body.insertAdjacentHTML('beforeend', FEEDBACK_MODAL_HTML);
    this.modalEl = byId('feedback-modal');
    I18n.apply(this.modalEl);
    // The form opens in a new tab: this window closes behind it.
    byId('feedback-link').addEventListener('click', () => bootstrap.Modal.getInstance(this.modalEl)?.hide());
  },

  // trigger: the pressed button (to know whether it is in the side menu).
  open(trigger = null) {
    if (!window.bootstrap) return;
    this.ensureModal();
    // The address is built at the moment of opening: the current language and screen.
    byId('feedback-link').href = feedbackFormUrl({
      version: APP_VERSION,
      device: feedbackDeviceType(window.screen.width, window.screen.height),
      lang: I18n.lang
    });
    // Phone: the side menu (Offcanvas) closes first, so two dark backgrounds do not stack.
    const menu = byId('sidebar');
    if (trigger && menu?.contains(trigger)) bootstrap.Offcanvas.getInstance(menu)?.hide();
    bootstrap.Modal.getOrCreateInstance(this.modalEl).show();
  }
};

/* ---------- The Dashboard invitation ---------- */

const FeedbackInvite = {
  render() {
    const anchor = byId('first-steps');
    if (!anchor || byId('feedback-invite')) return;
    if (!shouldInviteFeedback({ profile: getProfile(), onboarding: getOnboarding(), today: Dates.today() })) return;
    anchor.insertAdjacentHTML('beforebegin', `
      <aside class="feedback-invite" id="feedback-invite" aria-labelledby="feedback-invite-text">
        <i class="bi bi-chat-heart feedback-invite-icon" aria-hidden="true"></i>
        <p class="feedback-invite-text" id="feedback-invite-text" data-i18n="feedback.invite.text"></p>
        <div class="feedback-invite-actions">
          <button type="button" class="btn btn-primary btn-sm" data-invite-answer="open" data-i18n="feedback.button"></button>
          <button type="button" class="btn btn-tool btn-sm" data-invite-answer="later" data-i18n="feedback.invite.later"></button>
        </div>
      </aside>`);
    const invite = byId('feedback-invite');
    I18n.apply(invite);
    invite.addEventListener('click', (event) => this.answer(event.target.closest('[data-invite-answer]')));
  },

  // Any answer: never again. "Leave feedback" also opens the window.
  answer(button) {
    if (!button) return;
    updateOnboarding({ feedbackAsked: true });
    byId('feedback-invite').remove();
    if (button.dataset.inviteAnswer === 'open') Feedback.open();
  }
};

function runFeedbackSelfTest() {
  const results = [];
  const check = (test, actual, expected) => results.push({ test, expected, actual, ok: Object.is(actual, expected) ? '✓' : '✗' });
  const url = new URL(feedbackFormUrl({ version: '1.3.5', device: 'phone', lang: 'ru' }));
  check('the form address has no usp', url.searchParams.has('usp'), false);
  check('the version field', url.searchParams.get(FEEDBACK_FIELD_VERSION), '1.3.5');
  check('the device field', url.searchParams.get(FEEDBACK_FIELD_DEVICE), 'телефон, ru');
  check('only two fields are sent', [...url.searchParams.keys()].length, 2);
  check('a 390 × 844 screen is a phone', feedbackDeviceType(390, 844), 'phone');
  check('a 1366 × 768 screen is a computer', feedbackDeviceType(1366, 768), 'computer');
  const today = new Date(2026, 10, 20);
  const done = { checklistCelebrated: true };
  const profile = (daysAgo) => ({ createdAt: Dates.addDays(today, -daysAgo).toISOString() });
  check('invite: 7 days and First steps done', shouldInviteFeedback({ profile: profile(7), onboarding: done, today }), true);
  check('invite: only 6 days', shouldInviteFeedback({ profile: profile(6), onboarding: done, today }), false);
  check('invite: First steps not done', shouldInviteFeedback({ profile: profile(30), onboarding: {}, today }), false);
  check('invite: already answered', shouldInviteFeedback({ profile: profile(30), onboarding: { ...done, feedbackAsked: true }, today }), false);
  check('invite: not in the example', shouldInviteFeedback({ profile: profile(30), onboarding: { ...done, demoMode: true }, today }), false);
  console.group('[LifeOS] Feedback self-test');
  console.table(results);
  const failed = results.filter((row) => row.ok === '✗').length;
  if (failed) console.error(`${failed} of ${results.length} feedback tests failed`);
  else console.info(`All ${results.length} feedback tests passed`);
  console.groupEnd();
}

onAppReady(() => {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-feedback-open]');
    if (trigger) Feedback.open(trigger);
  });
  FeedbackInvite.render();
  if (new URLSearchParams(window.location.search).get('debug') === '1' && byId('first-steps')) runFeedbackSelfTest();
});
