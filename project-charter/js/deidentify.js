// ============================================================
// DE-IDENTIFICATION — lightweight find-and-replace for .md text
// Used on the de-id screen before research notes are sent to AI.
// ============================================================

// ── PURE ENGINE (no DOM) ─────────────────────────────────────

/**
 * Apply an array of find/replace rules to a text string.
 * Rules are applied in order. Matching is case-insensitive, whole-word.
 *
 * @param {string} text - The original markdown text
 * @param {Array<{find: string, replace: string}>} rules
 * @returns {string} - The cleaned text
 */
function applyDeIdRules(text, rules) {
  if (!text || !rules || rules.length === 0) return text;
  let result = text;
  rules.forEach(function (r) {
    if (!r.find || !r.find.trim()) return;
    try {
      const escaped = r.find.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex   = new RegExp('\\b' + escaped + '\\b', 'gi');
      result = result.replace(regex, r.replace || '');
    } catch (_) {
      // Invalid regex — skip this rule silently
    }
  });
  return result;
}

/**
 * Count how many matches a single find term has in the text.
 * @param {string} text
 * @param {string} find
 * @returns {number}
 */
function countMatches(text, find) {
  if (!text || !find || !find.trim()) return 0;
  try {
    const escaped = find.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp('\\b' + escaped + '\\b', 'gi');
    return (text.match(regex) || []).length;
  } catch (_) {
    return 0;
  }
}

/**
 * Highlight all matches of a find term in HTML-escaped text.
 * Returns HTML string with <mark> tags around matches.
 * @param {string} text
 * @param {string} find
 * @returns {string}
 */
function highlightMatches(text, find) {
  const escaped_html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (!find || !find.trim()) return escaped_html;

  try {
    const escaped = find.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp('\\b' + escaped + '\\b', 'gi');
    return escaped_html.replace(regex, (m) => '<mark class="deid-match">' + m + '</mark>');
  } catch (_) {
    return escaped_html;
  }
}

// ── DE-ID SCREEN STATE ────────────────────────────────────────

let _deIdRawText    = '';   // original .md text loaded from file
let _deIdFileName   = '';   // original filename
let _deIdOnComplete = null; // callback(cleanedText, fileName) when user applies

/**
 * Show the de-identification screen with the given file content.
 * @param {string} rawText - The raw .md file content
 * @param {string} fileName - The original filename
 * @param {function} onComplete - Called with (cleanedText, fileName) when user clicks Apply
 */
function showDeIdScreen(rawText, fileName, onComplete) {
  _deIdRawText    = rawText;
  _deIdFileName   = fileName;
  _deIdOnComplete = onComplete;

  // Switch screens
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('deid-screen').style.display    = '';
  document.getElementById('app').style.display            = 'none';

  // Populate the editable textarea
  const editor = document.getElementById('deid-editor');
  if (editor) editor.value = rawText;

  // Reset consent checkbox and Apply button
  const checkbox = document.getElementById('deid-consent-checkbox');
  const applyBtn = document.getElementById('btn-deid-apply');
  if (checkbox) checkbox.checked = false;
  if (applyBtn) applyBtn.disabled = true;

  // Reset the rules list to one empty row
  const rulesList = document.getElementById('deid-rules-list');
  if (rulesList) {
    rulesList.innerHTML = '';
    addDeIdRow();
  }
}

/**
 * Called when the user edits the textarea directly.
 * Updates the internal raw text so find/replace counts stay accurate.
 * @param {string} value
 */
function onDeIdEditorInput(value) {
  _deIdRawText = value;
  // Refresh match counts on all rows
  document.querySelectorAll('#deid-rules-list .deid-rule-row').forEach(function (row) {
    const find  = (row.querySelector('.deid-find')?.value || '').trim();
    const badge = row.querySelector('.deid-match-count');
    if (badge) {
      const count = countMatches(_deIdRawText, find);
      badge.textContent = count > 0 ? count + ' match' + (count !== 1 ? 'es' : '') : '';
      badge.className   = 'deid-match-count' + (count > 0 ? ' has-matches' : '');
    }
  });
}

/**
 * Called when the consent checkbox changes.
 * Enables/disables the Apply & Continue button.
 */
function onDeIdConsentChange() {
  const checkbox = document.getElementById('deid-consent-checkbox');
  const applyBtn = document.getElementById('btn-deid-apply');
  if (applyBtn) applyBtn.disabled = !(checkbox && checkbox.checked);
}

/**
 * Add a new find/replace row to the de-id rules list.
 */
function addDeIdRow() {
  const list = document.getElementById('deid-rules-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'deid-rule-row';
  row.innerHTML = [
    '<input type="text" class="deid-find" placeholder="Find (e.g. Jane Smith)" />',
    '<span class="deid-arrow">→</span>',
    '<input type="text" class="deid-replace" placeholder="Replace with (e.g. Participant)" />',
    '<span class="deid-match-count"></span>',
    '<button class="toolbar-btn deid-remove-btn" title="Remove row" onclick="removeDeIdRow(this)">x</button>'
  ].join('');

  // Live match count on find input
  const findInput = row.querySelector('.deid-find');
  findInput.addEventListener('input', function () {
    const count = countMatches(_deIdRawText, this.value);
    const badge = row.querySelector('.deid-match-count');
    if (badge) {
      badge.textContent = count > 0 ? count + ' match' + (count !== 1 ? 'es' : '') : '';
      badge.className   = 'deid-match-count' + (count > 0 ? ' has-matches' : '');
    }
  });

  list.appendChild(row);
}

/**
 * Remove a de-id rule row.
 * @param {HTMLElement} btn - The remove button that was clicked
 */
function removeDeIdRow(btn) {
  const row = btn.closest('.deid-rule-row');
  if (row) row.remove();
}

/**
 * Collect all current find/replace rules from the UI.
 * @returns {Array<{find: string, replace: string}>}
 */
function _collectDeIdRules() {
  const rows = document.querySelectorAll('#deid-rules-list .deid-rule-row');
  const rules = [];
  rows.forEach(function (row) {
    const find    = (row.querySelector('.deid-find')?.value    || '').trim();
    const replace = (row.querySelector('.deid-replace')?.value || '').trim();
    if (find) rules.push({ find, replace });
  });
  return rules;
}

/**
 * Apply all find/replace rules to the current editor text, update the editor,
 * then proceed to the builder.
 */
function applyDeIdAndContinue() {
  // Read current editor content (may have been manually edited)
  const editor = document.getElementById('deid-editor');
  const currentText = editor ? editor.value : _deIdRawText;

  const rules       = _collectDeIdRules();
  const cleanedText = applyDeIdRules(currentText, rules);
  const ruleCount   = rules.length;

  if (ruleCount > 0) {
    showToast(ruleCount + ' replacement rule' + (ruleCount !== 1 ? 's' : '') + ' applied. Research notes cleaned.', 'success');
  } else {
    showToast('Research notes loaded.', 'success');
  }

  if (_deIdOnComplete) _deIdOnComplete(cleanedText, _deIdFileName);
}

/**
 * Skip de-identification and proceed with the current editor text.
 */
function skipDeId() {
  const editor = document.getElementById('deid-editor');
  const currentText = editor ? editor.value : _deIdRawText;
  if (_deIdOnComplete) _deIdOnComplete(currentText, _deIdFileName);
}

/**
 * Go back to the welcome screen from the de-id screen.
 */
function backToWelcome() {
  document.getElementById('deid-screen').style.display    = 'none';
  document.getElementById('welcome-screen').style.display = '';
  document.getElementById('app').style.display            = 'none';
  _deIdFileName   = '';
  _deIdOnComplete = null;
  _deIdRawText    = '';
}
