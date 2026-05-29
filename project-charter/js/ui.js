// ============================================================
// WELCOME SCREEN
// ============================================================

function initWelcome() {
  const name    = (formData.projectName || '').trim();
  const hasData = name ||
    (formData.problemRaw || '').trim() ||
    (formData.strategicObjective || '').trim();

  if (hasData) {
    const continueBtn  = document.getElementById('welcome-continue-btn');
    const continueName = document.getElementById('welcome-continue-name');
    const sep          = document.getElementById('welcome-sep');
    if (continueBtn)  continueBtn.style.display  = '';
    if (continueName) continueName.textContent    = name || 'last session';
    if (sep)          sep.style.display           = '';
  }
}

function enterBuilder() {
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('deid-screen').style.display    = 'none';
  document.getElementById('app').style.display            = '';
  // Show SharePoint onboarding modal on first entry (deferred from initSharePointModal)
  if (!localStorage.getItem(SP_ONBOARDED_KEY)) {
    openSharePointModal();
  }
  _updateMdIndicator();
}

function welcomeChooseAi() {
  document.getElementById('welcome-md-input').click();
}

function welcomeMdSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    showDeIdScreen(e.target.result, file.name, function (cleanedText, fileName) {
      _storeMarkdown(cleanedText, fileName);
      enterBuilder();
      setTimeout(function () {
        showToast('Research notes loaded. Click "✨ AI Generate" in the toolbar to draft the charter.', 'info');
      }, 150);
    });
  };
  reader.readAsText(file);
}

function welcomeChooseManual() {
  enterBuilder();
}

function welcomeChooseLoad() {
  document.getElementById('welcome-json-input').click();
}

function welcomeJsonSelected(file) {
  if (!file) return;
  enterBuilder();
  _processImportFile(file);
}

function welcomeContinue() {
  enterBuilder();
}

// ============================================================
// MARKDOWN STATE (shared between welcome flow and toolbar import)
// ============================================================

let mdFileContent = '';
let mdFileName    = '';

function _storeMarkdown(text, fileName) {
  mdFileContent = text;
  mdFileName    = fileName;
  _updateMdIndicator();
}

function _updateMdIndicator() {
  const el = document.getElementById('md-file-indicator');
  if (!el) return;
  if (mdFileName) {
    el.textContent = '📄 ' + mdFileName;
    el.classList.add('loaded');
  } else {
    el.textContent = '';
    el.classList.remove('loaded');
  }
}

// ============================================================
// AI SETUP PANEL (collapsible below toolbar)
// ============================================================

function toggleAiSetup() {
  const panel = document.getElementById('ai-setup-panel');
  if (!panel) return;
  const isOpen = panel.classList.toggle('open');
  const btn    = document.getElementById('btn-ai-setup-toggle');
  if (btn) btn.classList.toggle('active', isOpen);
  if (isOpen) {
    // Restore saved values into inputs
    const epInput = document.getElementById('ai-endpoint');
    const keyInput = document.getElementById('ai-key');
    const modelInput = document.getElementById('ai-model-input');
    if (epInput    && !epInput.value)    epInput.value    = getEndpoint();
    if (keyInput   && !keyInput.value)   keyInput.value   = getApiKey();
    if (modelInput && !modelInput.value) modelInput.value = getModel();
  }
}

function importMarkdownForCharter(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    showDeIdScreen(e.target.result, file.name, function (cleanedText, fileName) {
      _storeMarkdown(cleanedText, fileName);
      showToast('Research notes loaded: ' + fileName + '. Click "✨ AI Generate" to draft the charter.', 'success');
    });
  };
  reader.readAsText(file);
}

async function testAndLoadModels() {
  const btn    = document.getElementById('btn-test-conn');
  const status = document.getElementById('conn-status');
  const list   = document.getElementById('model-list');

  if (!btn || !status || !list) return;

  btn.disabled    = true;
  btn.textContent = 'Testing…';
  status.textContent = '';
  status.className   = 'conn-status';
  list.innerHTML     = '';

  // Save current input values first
  const ep    = (document.getElementById('ai-endpoint')?.value    || '').trim();
  const key   = (document.getElementById('ai-key')?.value         || '').trim();
  const model = (document.getElementById('ai-model-input')?.value || '').trim();
  saveApiCredentials(ep || undefined, key || undefined, model || undefined);

  try {
    const result = await testConnection();
    status.textContent = '✅ Connected — ' + result.models.length + ' model(s) available';
    status.className   = 'conn-status success';

    if (result.models.length > 0) {
      list.innerHTML = '<p class="model-list-label">Click a model to select it:</p>' +
        result.models.map((m) =>
          '<button class="model-chip' + (getModel() === m ? ' selected' : '') + '" ' +
          'onclick="selectModel(\'' + m + '\')">' + m + '</button>'
        ).join('');
    }
  } catch (err) {
    status.textContent = '❌ ' + err.message;
    status.className   = 'conn-status error';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Test Connection';
  }
}

function selectModel(modelId) {
  saveApiCredentials(undefined, undefined, modelId);
  const modelInput = document.getElementById('ai-model-input');
  if (modelInput) modelInput.value = modelId;
  document.querySelectorAll('.model-chip').forEach(function (chip) {
    chip.classList.toggle('selected', chip.textContent === modelId);
  });
  showToast('Model set to: ' + modelId, 'success');
}

// ============================================================
// AI FIELD SELECTOR DIALOG
// ============================================================

const AI_CHARTER_SECTIONS = [
  { key: 'problem',   label: 'Problem & Context',     hint: 'Problem statement, who is affected, pain points, evidence, HMW question' },
  { key: 'strategic', label: 'Strategic Objective',   hint: 'Strategic context, relevant policy, objective statement' },
  { key: 'measures',  label: 'Success Measures',      hint: 'Program-level and project-level success measures' },
  { key: 'scope',     label: 'Scope',                 hint: 'In scope and out of scope items' },
  { key: 'risks',     label: 'Risks',                 hint: 'Risks with mitigations and ratings' },
  { key: 'hcd',       label: 'HCD & Agile Notes',     hint: 'Research approach, user groups, accessibility, privacy notes' }
];

function openAiDialog() {
  if (!mdFileContent) {
    showToast('Please import a .md research notes file first.', 'warning');
    return;
  }
  if (!hasCredentials()) {
    showToast('Please configure your API endpoint and key in AI Setup.', 'warning');
    const panel = document.getElementById('ai-setup-panel');
    if (panel && !panel.classList.contains('open')) toggleAiSetup();
    return;
  }

  const dialog = document.getElementById('ai-dialog');
  if (!dialog) return;

  const list = document.getElementById('ai-field-list');
  list.innerHTML = AI_CHARTER_SECTIONS.map(function (s) {
    return '<label class="ai-field-check">' +
      '<input type="checkbox" value="' + s.key + '" checked />' +
      '<span><strong>' + s.label + '</strong><br/><small>' + s.hint + '</small></span>' +
      '</label>';
  }).join('');

  const mdInfo = document.getElementById('ai-md-info');
  if (mdInfo) mdInfo.textContent = '📄 Using: ' + (mdFileName || 'loaded file');

  dialog.classList.add('open');
}

function closeAiDialog() {
  const dialog = document.getElementById('ai-dialog');
  if (dialog) dialog.classList.remove('open');
}

async function runAiGeneration() {
  const checkboxes = document.querySelectorAll('#ai-field-list input[type="checkbox"]:checked');
  const selectedSections = Array.from(checkboxes).map(function (cb) { return cb.value; });

  if (selectedSections.length === 0) {
    showToast('Please select at least one section to generate.', 'warning');
    return;
  }

  closeAiDialog();

  const btn = document.getElementById('btn-ai-generate');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

  try {
    const userPrompt = buildCharterPrompt(mdFileContent, selectedSections);
    const result = await chatCompletion([
      { role: 'system', content: CHARTER_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt }
    ]);

    let aiJson;
    try {
      const cleaned = result.content.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
      aiJson = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error('AI returned invalid JSON. Try again or check the model output.');
    }

    const filled = mergeCharterAiResponse(aiJson);
    triggerSave();
    renderAllSections();
    renderPreview();
    updateProgress();
    showToast('AI populated ' + filled + ' section' + (filled !== 1 ? 's' : '') + ' — review and edit as needed.', 'success');

    // Open the first populated section
    if (aiJson.problemRaw || aiJson.hmwQuestion) openSection('s3');
    else if (aiJson.strategicObjective)           openSection('s4');

  } catch (err) {
    showToast('AI generation failed: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✨ AI Generate'; }
  }
}

function initAiDialog() {
  const dialog = document.getElementById('ai-dialog');
  if (!dialog) return;
  document.getElementById('ai-dialog-cancel').addEventListener('click', closeAiDialog);
  document.getElementById('ai-dialog-run').addEventListener('click', runAiGeneration);
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeAiDialog();
  });
}

// ============================================================
// PROGRESS BAR
// ============================================================
function updateProgress() {
  const required = [
    formData.projectName, formData.version, formData.status,
    formData.authors, formData.date,
    formData.projectSponsorName, formData.projectSponsorRole,
    formData.execSponsors?.[0]?.name,
    formData.projectTeam?.[0]?.name,
    formData.hmwQuestion || formData.problemRaw,
    formData.strategicObjective || formData.strategicContext,
    formData.programMeasures?.[0],
    formData.projectMeasures?.[0],
    formData.inScope?.[0],
    formData.outScope?.[0],
    formData.risks?.[0]?.risk,
    formData.phases?.[0]?.phase,
    formData.dependencies?.[0],
    formData.stakeholders?.[0]?.name
  ];
  const filled = required.filter(v => v && v.toString().trim() !== '').length;
  const pct = Math.round((filled / required.length) * 100);
  document.getElementById('progress-bar-fill').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';
}

// ============================================================
// ACCORDION
// ============================================================
function toggleSection(id) {
  const header = document.getElementById('header-' + id);
  const body   = document.getElementById('body-' + id);
  const isOpen = body.classList.contains('open');
  // Close all
  document.querySelectorAll('.section-body').forEach(b => b.classList.remove('open'));
  document.querySelectorAll('.section-header').forEach(h => h.classList.remove('open'));
  // Open clicked if it was closed
  if (!isOpen) {
    body.classList.add('open');
    header.classList.add('open');
  }
}

function openSection(id) {
  document.getElementById('body-' + id).classList.add('open');
  document.getElementById('header-' + id).classList.add('open');
}

// ============================================================
// AI BUTTON STATE
// ============================================================
function updateAIButtons() {
  const btn = document.getElementById('btn-ai-generate');
  if (!btn) return;
  const ready = mdFileContent && hasCredentials();
  btn.title = ready
    ? 'Use AI to fill charter sections from imported research notes'
    : (!mdFileContent ? 'Import a .md research notes file first' : 'Configure API credentials in AI Setup first');
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

// ============================================================
// MODAL
// ============================================================
let modalCallback = null;

function showModal(title, message, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-overlay').classList.add('open');
  modalCallback = onConfirm;
}

document.getElementById('modal-cancel').onclick = () => {
  document.getElementById('modal-overlay').classList.remove('open');
  modalCallback = null;
};

document.getElementById('modal-confirm').onclick = () => {
  document.getElementById('modal-overlay').classList.remove('open');
  if (modalCallback) modalCallback();
  modalCallback = null;
};
