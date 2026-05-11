/**
 * app.js — Un{save} frontend logic
 *
 * What this file does (plain English):
 * 1. Runs the interactive demo (no login required)
 *    - Lets you pick a saved card
 *    - Pick what you want to do (intent)
 *    - Pick when (timing)
 *    - Shows a satisfying done/streak screen
 * 2. Handles the waitlist form
 *    - Validates the email
 *    - Sends to the server
 *    - Shows success or error message
 * 3. Detects UTM source for tracking (e.g. ?source=peerlist)
 */

'use strict';

/* ===========================================
   DEMO FLOW
   New flow: pick card → clarity → decision → done
   Streak only counts when a real decision is made (Step 3 → Step 4)
   =========================================== */

// Static data for each demo card (used to populate the clarity screen)
const CARD_DATA = [
  { icon: '🛠️', title: 'How I built a $5k/month side project' },
  { icon: '🍝', title: "The best pasta recipe I've seen" },
  { icon: '🎨', title: 'Design systems crash course' },
];

// Done-screen messages + streak % per decision type
const DECISION_MESSAGES = {
  now: {
    title: 'Locked in for Today ⚡',
    sub: 'One saved thing → one real action.\nThat\'s how the backlog shrinks.',
    pct: 100,
  },
  schedule: {
    title: 'Scheduled ✓ 🗓️',
    sub: 'Comes back when you\'re ready.\nNo more forgetting.',
    pct: 75,
  },
  keep: {
    title: 'Kept for later 📦',
    sub: 'Still in your queue, not lost.\nYou\'ll come back to it.',
    pct: 50,
  },
  drop: {
    title: 'Cleared 🗑️',
    sub: 'Less clutter. Cleaner queue.\nEven that is progress.',
    pct: 34,
  },
};

let demoState = {
  currentStep: 1,
  selectedCard: null,   // 0 | 1 | 2
  selectedDecision: null, // 'now' | 'schedule' | 'keep' | 'drop'
};

function goToStep(n) {
  document.querySelectorAll('.demo-step').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`step-${n}`);
  if (target) target.classList.add('active');

  const dots = document.querySelectorAll('.demo-progress span');
  dots.forEach((dot, i) => dot.classList.toggle('active', i < n));

  demoState.currentStep = n;
}

// ── Step 1: pick a saved card ──────────────────────────────────
document.querySelectorAll('.saved-card').forEach(card => {
  function selectCard() {
    document.querySelectorAll('.saved-card').forEach(c => {
      c.classList.remove('selected');
      c.querySelector('.card-check').textContent = '';
    });
    card.classList.add('selected');
    card.querySelector('.card-check').textContent = '✓';
    demoState.selectedCard = parseInt(card.dataset.card, 10);

    const nextBtn = document.getElementById('step1-next');
    nextBtn.disabled = false;
    nextBtn.removeAttribute('aria-disabled');
  }

  card.addEventListener('click', selectCard);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCard(); }
  });
});

document.getElementById('step1-next').addEventListener('click', () => {
  if (demoState.selectedCard === null) return;

  // Populate clarity display with the selected card's data
  const data = CARD_DATA[demoState.selectedCard];
  if (data) {
    document.getElementById('clarity-icon').textContent  = data.icon;
    document.getElementById('clarity-title').textContent = data.title;
  }

  goToStep(2);
});

// ── Step 2: clarity moment (no selection needed — just a pause) ─
document.getElementById('step2-back').addEventListener('click', () => goToStep(1));
document.getElementById('step2-next').addEventListener('click', () => goToStep(3));

// ── Step 3: decision ───────────────────────────────────────────
document.querySelectorAll('.decision-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.decision-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    demoState.selectedDecision = chip.dataset.decision;

    const nextBtn = document.getElementById('step3-next');
    nextBtn.disabled = false;
    nextBtn.removeAttribute('aria-disabled');
  });
});

document.getElementById('step3-back').addEventListener('click', () => {
  // Reset decision on back
  document.querySelectorAll('.decision-chip').forEach(c => c.classList.remove('active'));
  demoState.selectedDecision = null;
  const btn = document.getElementById('step3-next');
  btn.disabled = true; btn.setAttribute('aria-disabled', 'true');
  goToStep(2);
});

document.getElementById('step3-next').addEventListener('click', () => {
  if (!demoState.selectedDecision) return;

  const msg = DECISION_MESSAGES[demoState.selectedDecision];
  document.getElementById('done-message').textContent = msg.title;
  // Handle newlines in sub text
  const subEl = document.getElementById('done-sub');
  subEl.innerHTML = msg.sub.replace(/\n/g, '<br>');

  goToStep(4);

  // ── Streak bar — only fires here, after a real decision ──────
  setTimeout(() => {
    const fill    = document.getElementById('streak-fill');
    const pct     = document.getElementById('streak-pct');
    const bar     = fill.closest('[role="progressbar"]');
    const target  = msg.pct;

    fill.style.width = target + '%';
    pct.textContent  = target + '%';
    bar.setAttribute('aria-valuenow', target);
  }, 300);
});

// ── Restart ────────────────────────────────────────────────────
document.getElementById('demo-restart-btn').addEventListener('click', () => {
  demoState = { currentStep: 1, selectedCard: null, selectedDecision: null };

  document.querySelectorAll('.saved-card').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('.card-check').textContent = '';
  });
  document.querySelectorAll('.decision-chip').forEach(c => c.classList.remove('active'));

  ['step1-next', 'step3-next'].forEach(id => {
    const btn = document.getElementById(id);
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
  });

  const fill = document.getElementById('streak-fill');
  fill.style.width = '0%';
  document.getElementById('streak-pct').textContent = '0%';

  goToStep(1);
});


/* ===========================================
   SOURCE TRACKING
   =========================================== */

(function detectSource() {
  const params = new URLSearchParams(window.location.search);
  const src = params.get('source') || params.get('utm_source') || 'direct';
  const allowed = ['peerlist', 'twitter', 'linkedin', 'instagram', 'direct', 'other'];
  const sourceInput = document.getElementById('wl-source');
  if (sourceInput) {
    sourceInput.value = allowed.includes(src) ? src : 'other';
  }
})();

/* ===========================================
   WAITLIST FORM
   =========================================== */

const form       = document.getElementById('waitlist-form');
const emailInput = document.getElementById('wl-email');
const emailError = document.getElementById('email-error');
const submitBtn  = document.getElementById('waitlist-submit-btn');
const successBox = document.getElementById('waitlist-success');
const successMsg = document.getElementById('success-msg');

function showEmailError(msg) {
  emailError.textContent = msg;
  emailError.style.display = 'block';
  emailInput.classList.add('error');
  emailInput.setAttribute('aria-invalid', 'true');
}
function clearEmailError() {
  emailError.textContent = '';
  emailError.style.display = 'none';
  emailInput.classList.remove('error');
  emailInput.removeAttribute('aria-invalid');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

emailInput.addEventListener('input', clearEmailError);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearEmailError();

  const email     = emailInput.value.trim();
  const name      = document.getElementById('wl-name').value.trim();
  const savesMost = document.getElementById('wl-saves').value;
  const source    = document.getElementById('wl-source').value;

  // Client-side validation
  if (!email) {
    showEmailError('Please enter your email address.');
    emailInput.focus();
    return;
  }
  if (!isValidEmail(email)) {
    showEmailError('That doesn\'t look like a valid email. Try again.');
    emailInput.focus();
    return;
  }

  // Disable button and show loading
  submitBtn.disabled = true;
  submitBtn.textContent = 'Joining…';

  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, saves_most: savesMost, source }),
    });

    const data = await response.json();

    if (data.ok) {
      // Show success
      form.style.display = 'none';
      successBox.classList.add('show');

      if (data.duplicate) {
        successMsg.textContent = 'You\'re already on the list! We\'ll be in touch. 🎉';
      }
    } else {
      // Server returned a validation error
      showEmailError(data.message || 'Something went wrong. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get early access →';
    }

  } catch (err) {
    // Network error
    showEmailError('Could not connect. Check your internet and try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get early access →';
  }
});

/* ===========================================
   SMOOTH SCROLL for anchor links
   =========================================== */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ===========================================
   PASTE-LINK FEATURE
   What this block does (plain English):
   1. User pastes a URL into the input (or clicks a sample chip)
   2. We send it to /api/preview-link
   3. Server fetches the page metadata and returns a card object
   4. We show the card preview with emoji + title + description
   5. User picks a timing (today / tomorrow / weekend / someday)
   6. User clicks "Save this card"
   7. We send it to /api/links and show a success screen
   =========================================== */

(function initPasteLink() {

  // DOM refs
  const pasteForm       = document.getElementById('paste-form');
  const pasteUrl        = document.getElementById('paste-url');
  const pasteSubmitBtn  = document.getElementById('paste-submit-btn');
  const pasteClearBtn   = document.getElementById('paste-clear-btn');
  const pasteLoading    = document.getElementById('paste-loading');
  const pasteResult     = document.getElementById('paste-result');
  const pasteSaved      = document.getElementById('paste-saved');
  const pasteError      = document.getElementById('paste-error');

  const previewEmoji    = document.getElementById('preview-emoji');
  const previewTitle    = document.getElementById('preview-title');
  const previewDesc     = document.getElementById('preview-desc');
  const previewDomain   = document.getElementById('preview-domain');
  const pasteFallback   = document.getElementById('paste-fallback-msg');

  const saveLinkBtn     = document.getElementById('save-link-btn');
  const savedTitle      = document.getElementById('paste-saved-title');
  const customDateWrap  = document.getElementById('custom-date-wrap');
  const customDateInput = document.getElementById('custom-date');

  // Loading tip messages (shown while fetching)
  const LOADING_TIPS = [
    "Un{save} reads the page's Open Graph metadata — the same data LinkedIn and Slack use to make link previews.",
    "No images are fetched. Just the title and description — fast and lightweight.",
    "Some links (login-only, paywalled) can't be previewed — we'll show you a fallback card instead.",
    "Paste any public URL: article, product page, recipe, docs, video — and we'll turn it into a card.",
  ];
  let loadingTipIdx = 0;
  let loadingTipInterval = null;

  // State
  let currentCard = null;   // { url, title, description, domain, typeGuess, emoji }
  let selectedTiming = null;

  // Saved timing label → display text map
  const TIMING_LABELS = {
    today:    'Saved for Today ⚡',
    tomorrow: 'Saved for Tomorrow 🌅',
    weekend:  'Saved for the Weekend ☀️',
    later:    'Archived safely 📦',
  };

  /* ── Helpers ── */
  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }
  function setError(msg) {
    pasteError.textContent = msg;
    show(pasteError);
  }
  function clearError() { hide(pasteError); pasteError.textContent = ''; }

  function updateClearBtnVisibility() {
    if (pasteUrl.value.trim() || currentCard) {
      show(pasteClearBtn);
    } else {
      hide(pasteClearBtn);
    }
  }

  function isValidUrl(str) {
    try {
      const u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
  }

  /* ── Reset the whole paste section back to initial state ── */
  function resetPasteSection() {
    hide(pasteLoading);
    hide(pasteResult);
    hide(pasteSaved);
    clearError();
    pasteUrl.value = '';
    currentCard = null;
    selectedTiming = null;
    saveLinkBtn.disabled = true;
    saveLinkBtn.setAttribute('aria-disabled', 'true');
    saveLinkBtn.textContent = 'Save this card →';
    document.querySelectorAll('.reminder-chip').forEach(c => c.classList.remove('active'));
    hide(customDateWrap);
    customDateInput.value = '';
    stopLoadingTips();
    updateClearBtnVisibility();
  }

  /* ── Loading tip rotation ── */
  function startLoadingTips() {
    const tipEl = document.getElementById('loading-tip');
    loadingTipIdx = 0;
    tipEl.textContent = LOADING_TIPS[0];
    loadingTipInterval = setInterval(() => {
      loadingTipIdx = (loadingTipIdx + 1) % LOADING_TIPS.length;
      tipEl.style.opacity = '0';
      setTimeout(() => {
        tipEl.textContent = LOADING_TIPS[loadingTipIdx];
        tipEl.style.opacity = '1';
      }, 250);
    }, 3500);
  }
  function stopLoadingTips() {
    if (loadingTipInterval) { clearInterval(loadingTipInterval); loadingTipInterval = null; }
  }

  /* ── Show preview card from API response ── */
  function showPreviewCard(card, isFallback) {
    previewEmoji.textContent  = card.emoji  || '🔗';
    previewTitle.textContent  = card.title  || 'Untitled link';
    previewDesc.textContent   = card.description || '';
    previewDomain.textContent = card.domain || '';

    if (card.description) { show(previewDesc); } else { previewDesc.textContent = ''; }

    if (isFallback) { show(pasteFallback); } else { hide(pasteFallback); }

    show(pasteResult);
  }

  /* ── Call /api/preview-link ── */
  async function fetchPreview(url) {
    clearError();
    hide(pasteResult);
    hide(pasteSaved);
    show(pasteLoading);
    pasteSubmitBtn.disabled = true;
    startLoadingTips();

    try {
      const res = await fetch('/api/preview-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      stopLoadingTips();
      hide(pasteLoading);
      pasteSubmitBtn.disabled = false;

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message || 'Something went wrong. Please try again.');
        return;
      }

      const data = await res.json();

      if (!data.ok) {
        setError(data.message || 'Could not fetch a preview. Please check the URL and try again.');
        return;
      }

      currentCard = data.card;
      showPreviewCard(data.card, data.fallback);

    } catch (netErr) {
      stopLoadingTips();
      hide(pasteLoading);
      pasteSubmitBtn.disabled = false;
      // Distinguish network vs server errors
      if (!navigator.onLine) {
        setError('⚠️ You appear to be offline. Please check your internet connection and try again.');
      } else {
        setError('⚠️ Sorry, we\'re having trouble on our side right now. Please try again in a moment.');
      }
    } finally {
      updateClearBtnVisibility();
    }
  }

  /* ── Form submit ── */
  pasteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = pasteUrl.value.trim();
    if (!url) { setError('Please paste a URL first.'); return; }
    if (!isValidUrl(url)) {
      setError('That doesn\'t look like a valid URL. Make sure it starts with https:// or http://');
      return;
    }
    await fetchPreview(url);
  });

  /* ── Input listener for Clear button ── */
  pasteUrl.addEventListener('input', updateClearBtnVisibility);

  /* ── Clear button click ── */
  pasteClearBtn.addEventListener('click', resetPasteSection);

  /* ── Sample chips ── */
  document.querySelectorAll('.sample-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const url = chip.dataset.url;
      if (!url) return;
      pasteUrl.value = url;
      await fetchPreview(url);
    });
  });

  /* ── Reminder chips ── */
  document.querySelectorAll('.reminder-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.reminder-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedTiming = chip.dataset.timing;

      // Show custom date picker only for "later/someday"
      if (selectedTiming === 'later') {
        show(customDateWrap);
      } else {
        hide(customDateWrap);
        customDateInput.value = '';
      }

      // Enable save button
      saveLinkBtn.disabled = false;
      saveLinkBtn.removeAttribute('aria-disabled');
    });
  });

  /* ── Save card + reminder to backend ── */
  saveLinkBtn.addEventListener('click', async () => {
    if (!currentCard || !selectedTiming) return;

    saveLinkBtn.disabled = true;
    saveLinkBtn.textContent = 'Saving…';

    const payload = {
      ...currentCard,
      timing: selectedTiming,
      customDateTime: selectedTiming === 'later' && customDateInput.value
        ? new Date(customDateInput.value).toISOString()
        : null,
    };

    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.ok) {
        hide(pasteResult);
        savedTitle.textContent = TIMING_LABELS[selectedTiming] || 'Saved! ✓';
        show(pasteSaved);
      } else {
        saveLinkBtn.disabled = false;
        saveLinkBtn.textContent = 'Save this card →';
        setError(data.message || 'Could not save. Please try again.');
      }

    } catch {
      saveLinkBtn.disabled = false;
      saveLinkBtn.textContent = 'Save this card →';
      setError('Could not connect to save your card. Check your internet and try again.');
    }
  });

  /* ── Reset buttons ── */
  document.getElementById('paste-reset-btn').addEventListener('click', resetPasteSection);
  document.getElementById('paste-saved-reset').addEventListener('click', resetPasteSection);

})(); // end initPasteLink

