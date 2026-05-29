// ============================================================
// UI HELPERS — toast, modal, AI field-selector dialog,
//              editor section renderers
// ============================================================

// ── TOAST ────────────────────────────────────────────────────
function showToast(message, type) {
  if (type === undefined) type = 'info';
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── MODAL ────────────────────────────────────────────────────
let _modalConfirmFn = null;

function showModal(title, message, onConfirm) {
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-message').textContent = message;
  _modalConfirmFn = onConfirm;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  _modalConfirmFn = null;
}

function initModal() {
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-confirm').addEventListener('click', () => {
    if (_modalConfirmFn) _modalConfirmFn();
    closeModal();
  });
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
}

// ── TAB SWITCHING ────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + target);
      if (panel) panel.classList.add('active');
    });
  });
}

// ── AI FIELD SELECTOR DIALOG ─────────────────────────────────
const AI_FIELDS = [
  { key: 'name',            label: 'Name & Role & Team' },
  { key: 'bio',             label: 'Biography' },
  { key: 'contentSections', label: 'All content sections (Jobs, Motivations, Needs, Challenges…)' },
  { key: 'attributes',      label: 'Attribute Slider Values' }
];

function openAiDialog() {
  if (!mdFileContent) {
    showToast('Please import a .md file first using "Import .md".', 'warning');
    return;
  }
  if (!hasCredentials()) {
    showToast('Please configure your API endpoint and key in the AI Setup tab.', 'warning');
    const aiTab = document.querySelector('[data-tab="ai-setup"]');
    if (aiTab) aiTab.click();
    return;
  }

  const dialog = document.getElementById('ai-dialog');
  if (!dialog) return;

  const list = document.getElementById('ai-field-list');
  list.innerHTML = AI_FIELDS.map((f) => `
    <label class="ai-field-check">
      <input type="checkbox" value="${f.key}" checked />
      <span>${f.label}</span>
    </label>
  `).join('');

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
  const selectedFields = Array.from(checkboxes).map((cb) => cb.value);

  const expandedFields = [];
  selectedFields.forEach((f) => {
    if (f === 'name') {
      expandedFields.push('name', 'role', 'team');
    } else {
      expandedFields.push(f);
    }
  });

  if (expandedFields.length === 0) {
    showToast('Please select at least one field to generate.', 'warning');
    return;
  }

  closeAiDialog();

  const btn = document.getElementById('btn-generate-ai');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

  const previewOverlay = document.getElementById('preview-loading');
  if (previewOverlay) previewOverlay.classList.add('show');

  try {
    const userPrompt = buildPersonaPrompt(mdFileContent, expandedFields);
    const result = await chatCompletion([
      { role: 'system', content: PERSONA_SYSTEM_PROMPT },
      { role: 'user',   content: userPrompt }
    ]);

    let aiJson;
    try {
      const cleaned = result.content.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
      aiJson = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error('AI returned invalid JSON. Try again or check the model output.');
    }

    const filled = mergeAiResponse(aiJson, expandedFields);
    triggerSave();
    renderAllSections();
    renderPreview();
    showToast('AI filled ' + filled + ' field' + (filled !== 1 ? 's' : '') + ' — review and edit as needed.', 'success');

  } catch (err) {
    showToast('AI generation failed: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✨ AI Generate'; }
    if (previewOverlay) previewOverlay.classList.remove('show');
  }
}

function initAiDialog() {
  const dialog = document.getElementById('ai-dialog');
  if (!dialog) return;

  document.getElementById('ai-dialog-cancel').addEventListener('click', closeAiDialog);
  document.getElementById('ai-dialog-run').addEventListener('click', runAiGeneration);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeAiDialog();
  });
}

// ── WELCOME SCREEN ────────────────────────────────────────────
function initWelcome() {
  const name = (formData.name || '').trim();
  const hasData = name || (formData.bio || '').trim() || (formData.role || '').trim();

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
  const welcome = document.getElementById('welcome-screen');
  const deid    = document.getElementById('deid-screen');
  const app     = document.getElementById('app');
  if (welcome) welcome.style.display = 'none';
  if (deid)    deid.style.display    = 'none';
  if (app)     app.style.display     = '';
}

function welcomeChooseAi() {
  document.getElementById('welcome-md-input').click();
}

function welcomeMdSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    showDeIdScreen(e.target.result, file.name, function (cleanedText, fileName) {
      // Store cleaned markdown
      mdFileContent = cleanedText;
      mdFileName    = fileName;
      ['md-file-indicator', 'md-file-indicator-2'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) { el.textContent = '📄 ' + fileName; el.classList.add('loaded'); }
      });
      enterBuilder();
      setTimeout(function () {
        showToast('Research notes loaded. Click "AI Generate" in the toolbar to draft the persona.', 'info');
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
  importJSON(file);
}

function welcomeLoadExample() {
  loadExample();
  enterBuilder();
}

function welcomeContinue() {
  enterBuilder();
}

// ── EDITOR SECTION RENDERERS ─────────────────────────────────

function renderAllSections() {
  // Run each renderer independently so a thrown error in one doesn't stop the others.
  const renderers = [
    ['identity',   renderIdentitySection],
    ['content',    renderContentSection],
    ['tools',      renderToolsSection],
    ['attributes', renderAttributesSection],
    ['aiSetup',    renderAiSetupSection]
  ];
  renderers.forEach(([name, fn]) => {
    try { fn(); }
    catch (err) { console.error('[Persona Builder] render ' + name + ' failed:', err); }
  });
}

// ── IDENTITY TAB ─────────────────────────────────────────────
function renderIdentitySection() {
  const el = (id) => document.getElementById(id);

  if (el('field-name'))  el('field-name').value  = formData.name  || '';
  if (el('field-role'))  el('field-role').value  = formData.role  || '';
  if (el('field-team'))  el('field-team').value  = formData.team  || '';
  if (el('field-bio'))   el('field-bio').value   = formData.bio   || '';

  // Restore upload preview state
  const preview   = el('avatar-upload-preview');
  const hint      = el('avatar-upload-hint');
  const removeBtn = el('avatar-remove-btn');
  if (formData.avatarType === 'upload' && formData.avatarDataUrl) {
    if (preview)   { preview.src = formData.avatarDataUrl; preview.style.display = 'block'; }
    if (hint)      hint.style.display      = 'none';
    if (removeBtn) removeBtn.style.display = '';
  } else {
    if (preview)   { preview.src = ''; preview.style.display = 'none'; }
    if (hint)      hint.style.display      = '';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

// ── CONTENT TAB — dynamic sections ───────────────────────────
function renderContentSection() {
  const container = document.getElementById('content-sections-container');
  if (!container) return;

  // Migrate old flat structure if needed
  migrateLegacyContentSections();

  // If contentSections somehow ended up empty, reseed with the four defaults
  // so practitioners always start with Jobs / Motivations / Needs / Key challenges.
  if (!Array.isArray(formData.contentSections) || formData.contentSections.length === 0) {
    formData.contentSections = defaultContentSections();
    triggerSave();
  }

  const sections = formData.contentSections;

  container.innerHTML = sections.map((section, si) => `
    <div class="content-section-block" data-section-index="${si}">
      <div class="content-section-header">
        <input type="text" class="section-heading-input"
          value="${escHtml(section.heading)}"
          placeholder="Section heading…"
          oninput="updateSectionHeading(${si}, this.value)" />
        <div class="section-header-actions">
          <select class="section-style-select" onchange="updateSectionStyle(${si}, this.value)" title="Section style">
            <option value="box"  ${section.style === 'box'  ? 'selected' : ''}>📦 Box</option>
            <option value="blue" ${section.style === 'blue' ? 'selected' : ''}>🔵 Blue header</option>
          </select>
          ${si > 0 ? `<button class="section-move-btn" onclick="moveSectionUp(${si})" title="Move up">↑</button>` : ''}
          ${si < sections.length - 1 ? `<button class="section-move-btn" onclick="moveSectionDown(${si})" title="Move down">↓</button>` : ''}
          <button class="row-remove-btn" onclick="removeContentSection(${si})" title="Remove section">✕</button>
        </div>
      </div>
      <div class="bullet-list-container" id="section-items-${si}">
        ${renderSectionItems(section.items, si)}
      </div>
      <button class="add-row-btn" onclick="addSectionItem(${si})">+ Add item</button>
    </div>
  `).join('');

  // Auto-resize all bullet textareas after DOM is updated
  requestAnimationFrame(autoResizeAll);
}

function renderSectionItems(items, si) {
  return (items || ['']).map((item, ii) => `
    <div class="bullet-row">
      <span class="bullet-dot">•</span>
      <textarea class="bullet-input" rows="1"
        oninput="updateSectionItem(${si}, ${ii}, this.value); autoResizeTextarea(this)"
        placeholder="Add item…">${escHtml(item)}</textarea>
      <button class="row-remove-btn"
        onclick="removeSectionItem(${si}, ${ii})"
        title="Remove" aria-label="Remove item">✕</button>
    </div>
  `).join('');
}

function updateSectionHeading(si, value) {
  if (!formData.contentSections[si]) return;
  formData.contentSections[si].heading = value;
  triggerSave();
  renderPreview();
}

function updateSectionStyle(si, value) {
  if (!formData.contentSections[si]) return;
  formData.contentSections[si].style = value;
  triggerSave();
  renderPreview();
}

function updateSectionItem(si, ii, value) {
  if (!formData.contentSections[si]) return;
  formData.contentSections[si].items[ii] = value;
  triggerSave();
  renderPreview();
}

function addSectionItem(si) {
  if (!formData.contentSections[si]) return;
  formData.contentSections[si].items.push('');
  triggerSave();
  renderContentSection();
  renderPreview();
}

function removeSectionItem(si, ii) {
  if (!formData.contentSections[si]) return;
  const items = formData.contentSections[si].items;
  if (items.length <= 1) {
    showToast('At least one item is required.', 'warning');
    return;
  }
  items.splice(ii, 1);
  triggerSave();
  renderContentSection();
  renderPreview();
}

function addContentSection() {
  // Guard: ensure array exists and isn't empty
  if (!Array.isArray(formData.contentSections) || formData.contentSections.length === 0) {
    formData.contentSections = defaultContentSections();
  }
  formData.contentSections.push({
    id:      generateSectionId(),
    heading: 'New Section',
    items:   [''],
    style:   'blue'
  });
  triggerSave();
  renderContentSection();
  renderPreview();
}

function removeContentSection(si) {
  if (formData.contentSections.length <= 1) {
    showToast('At least one section is required.', 'warning');
    return;
  }
  formData.contentSections.splice(si, 1);
  triggerSave();
  renderContentSection();
  renderPreview();
}

function moveSectionUp(si) {
  if (si <= 0) return;
  const tmp = formData.contentSections[si];
  formData.contentSections[si]     = formData.contentSections[si - 1];
  formData.contentSections[si - 1] = tmp;
  triggerSave();
  renderContentSection();
  renderPreview();
}

function moveSectionDown(si) {
  if (si >= formData.contentSections.length - 1) return;
  const tmp = formData.contentSections[si];
  formData.contentSections[si]     = formData.contentSections[si + 1];
  formData.contentSections[si + 1] = tmp;
  triggerSave();
  renderContentSection();
  renderPreview();
}

// Migrate old flat structure (jobsToBeDone, motivations, etc.) to new contentSections.
// Also re-seeds the four defaults if contentSections ended up missing or empty.
function migrateLegacyContentSections() {
  const hasSections = Array.isArray(formData.contentSections) && formData.contentSections.length > 0;
  if (hasSections) return;

  const legacy = formData.jobsToBeDone || formData.motivations || formData.needs || formData.keyChallenges;
  if (legacy) {
    formData.contentSections = [
      { id: 'jobs',        heading: 'Jobs to be Done', items: formData.jobsToBeDone  || [''], style: 'box'  },
      { id: 'motivations', heading: 'Motivations',     items: formData.motivations   || [''], style: 'blue' },
      { id: 'needs',       heading: 'Needs',           items: formData.needs         || [''], style: 'blue' },
      { id: 'challenges',  heading: 'Key challenges',  items: formData.keyChallenges || [''], style: 'blue' }
    ];
  } else {
    formData.contentSections = defaultContentSections();
  }

  // Clean up old keys
  delete formData.jobsToBeDone;
  delete formData.motivations;
  delete formData.needs;
  delete formData.keyChallenges;
}

// ── TOOLS TAB ────────────────────────────────────────────────
function renderToolsSection() {
  const container = document.getElementById('tools-list');
  if (!container) return;

  const tools = formData.tools || [];
  container.innerHTML = tools.map((tool, i) => `
    <div class="tool-row" id="tool-row-${i}">
      <div class="tool-icon-preview" onclick="openToolIconPicker(${i})" title="Click to change icon">
        ${getToolIconSvg(tool)}
      </div>
      <input type="text" class="tool-name-input"
        value="${escHtml(tool.name || '')}"
        placeholder="Tool name…"
        oninput="setNestedField('tools', ${i}, 'name', this.value)" />
      <button class="icon-pick-btn" onclick="openToolIconPicker(${i})" title="Pick icon">🎨</button>
      <label class="icon-upload-label" title="Upload custom icon">
        📁
        <input type="file" accept="image/*" style="display:none"
          onchange="handleToolIconUpload(this.files[0], ${i})" />
      </label>
      <button class="row-remove-btn" onclick="removeRow('tools', ${i}, renderToolsSection)"
        title="Remove tool" aria-label="Remove tool">✕</button>
    </div>
  `).join('');
}

// ── ATTRIBUTES TAB — fully editable ──────────────────────────
function renderAttributesSection() {
  const container = document.getElementById('attributes-list');
  if (!container) return;

  if (!formData.attributes || formData.attributes.length === 0) {
    formData.attributes = [
      { label: 'TECHNOLOGY SAVVINESS',      leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
      { label: 'OPENNESS TO CHANGE',        leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
      { label: 'LEARNING AGILITY',          leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
      { label: 'SYSTEM VS. CUSTOMER FOCUS', leftLabel: 'System', rightLabel: 'Customer', value: 50 }
    ];
  }

  container.innerHTML = formData.attributes.map((attr, i) => `
    <div class="attribute-row">
      <div class="attr-edit-row">
        <input type="text" class="attr-label-input"
          value="${escHtml(attr.label)}"
          placeholder="Attribute name…"
          oninput="updateAttributeLabel(${i}, this.value)" />
        <button class="row-remove-btn" onclick="removeAttributeRow(${i})" title="Remove attribute">✕</button>
      </div>
      <div class="attr-end-labels-row">
        <input type="text" class="attr-end-input"
          value="${escHtml(attr.leftLabel)}"
          placeholder="Left label"
          oninput="updateAttributeEndLabel(${i}, 'leftLabel', this.value)" />
        <input type="text" class="attr-end-input right"
          value="${escHtml(attr.rightLabel)}"
          placeholder="Right label"
          oninput="updateAttributeEndLabel(${i}, 'rightLabel', this.value)" />
      </div>
      <div class="attr-slider-row">
        <span class="attr-end-label">${escHtml(attr.leftLabel)}</span>
        <input type="range" min="0" max="100" value="${attr.value}"
          class="attr-slider"
          style="--val: ${attr.value}%"
          oninput="setAttributeValue(${i}, this.value); updateSliderDisplay(${i}, this.value); this.style.setProperty('--val', this.value + '%')" />
        <span class="attr-end-label">${escHtml(attr.rightLabel)}</span>
      </div>
      <div class="attr-value-display" id="attr-val-${i}">${attr.value}%</div>
    </div>
  `).join('');
}

function updateAttributeLabel(index, value) {
  if (!formData.attributes[index]) return;
  formData.attributes[index].label = value;
  triggerSave();
  renderPreview();
}

function updateAttributeEndLabel(index, side, value) {
  if (!formData.attributes[index]) return;
  formData.attributes[index][side] = value;
  triggerSave();
  renderAttributesSection();
  renderPreview();
}

function removeAttributeRow(index) {
  if (formData.attributes.length <= 1) {
    showToast('At least one attribute is required.', 'warning');
    return;
  }
  formData.attributes.splice(index, 1);
  triggerSave();
  renderAttributesSection();
  renderPreview();
}

function addAttribute() {
  // Guard: ensure array exists
  if (!formData.attributes) {
    formData.attributes = [
      { label: 'TECHNOLOGY SAVVINESS',      leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
      { label: 'OPENNESS TO CHANGE',        leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
      { label: 'LEARNING AGILITY',          leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
      { label: 'SYSTEM VS. CUSTOMER FOCUS', leftLabel: 'System', rightLabel: 'Customer', value: 50 }
    ];
  }
  formData.attributes.push({
    label:      'NEW ATTRIBUTE',
    leftLabel:  'Low',
    rightLabel: 'High',
    value:      50
  });
  triggerSave();
  renderAttributesSection();
  renderPreview();
}

function updateSliderDisplay(index, value) {
  const el = document.getElementById('attr-val-' + index);
  if (el) el.textContent = value + '%';
}

// ── AI SETUP TAB ─────────────────────────────────────────────
function renderAiSetupSection() {
  const endpointEl = document.getElementById('ai-endpoint');
  const keyEl      = document.getElementById('ai-key');
  const modelEl    = document.getElementById('ai-model-select');

  if (endpointEl) endpointEl.value = getEndpoint();
  if (keyEl)      keyEl.value      = getApiKey();
  if (modelEl)    modelEl.value    = getModel();
}

// ── AUTO-RESIZE TEXTAREA ──────────────────────────────────────
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function autoResizeAll() {
  document.querySelectorAll('.bullet-input').forEach(autoResizeTextarea);
}

// ── UTILITY ──────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
