// ============================================================
// APP — UI state, file handling, tab switching, rendering
// ============================================================

// ── STATE ──
let uploadedFiles = [];    // { name, size, text }
let lastResult = null;     // { stage1, stage2, elapsed, model, usage }
let projectSlug = '';

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // CORS warning for file:// protocol
  if (window.location.protocol === 'file:') {
    const cw = document.getElementById('cors-warning');
    if (cw) cw.classList.add('show');
  }

  // Populate scan focus dropdown
  const sel = document.getElementById('scan-focus');
  if (sel) {
    SCAN_FOCUS_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    });
  }

  // Dropzone events
  const dz = document.getElementById('dropzone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
  }

  // Character counters
  setupCharCount('project-context', 'context-chars');
  setupCharCount('opportunities-text', 'opps-chars');

  // Navbar dropdown toggle
  document.querySelectorAll('.nav-group-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const li = this.closest('li');
      const wasOpen = li.classList.contains('open');
      document.querySelectorAll('.hcd-navbar__links > li').forEach(l => l.classList.remove('open'));
      if (!wasOpen) li.classList.add('open');
    });
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.hcd-navbar__links > li')) {
      document.querySelectorAll('.hcd-navbar__links > li').forEach(l => l.classList.remove('open'));
    }
  });
});

function setupCharCount(textareaId, countId) {
  const ta = document.getElementById(textareaId);
  const ct = document.getElementById(countId);
  if (!ta || !ct) return;
  ta.addEventListener('input', () => {
    ct.textContent = ta.value.length.toLocaleString() + ' chars';
  });
}

// ── SETTINGS ──
function openSettings() {
  document.getElementById('proxy-url').value = getEndpoint();
  document.getElementById('api-key').value = getApiKey();
  document.getElementById('model-name').value = getModel();
  document.getElementById('settings-modal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

function saveSettings() {
  const endpoint = document.getElementById('proxy-url').value.trim();
  const key = document.getElementById('api-key').value.trim();
  const model = document.getElementById('model-name').value.trim();
  saveApiCredentials(endpoint, key, model);
  closeSettings();
  showToast('Settings saved');
}

async function testConn() {
  const btn = document.getElementById('test-conn-btn');
  const status = document.getElementById('conn-status');
  btn.disabled = true;
  btn.textContent = 'Testing…';
  status.textContent = '';

  // Temporarily save current values for testing
  const endpoint = document.getElementById('proxy-url').value.trim();
  const key = document.getElementById('api-key').value.trim();
  saveApiCredentials(endpoint, key, document.getElementById('model-name').value.trim());

  try {
    const result = await testConnection();
    status.innerHTML = '<span style="color:var(--doe-green)">✓ Connected — ' + result.models.length + ' models available</span>';
  } catch (e) {
    status.innerHTML = '<span style="color:var(--doe-red)">✗ ' + e.message + '</span>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test Connection';
  }
}

// ── FILE HANDLING ──
function handleFileInput(e) {
  handleFiles(e.target.files);
  e.target.value = '';
}

async function handleFiles(fileList) {
  for (const file of fileList) {
    const ext = file.name.split('.').pop().toLowerCase();
    let text = '';

    try {
      if (ext === 'txt' || ext === 'md') {
        text = await readFileAsText(file);
      } else if (ext === 'docx') {
        text = await extractDocx(file);
      } else if (ext === 'pdf') {
        text = await extractPdf(file);
      } else {
        showToast('Unsupported file type: .' + ext);
        continue;
      }
    } catch (e) {
      showToast('Error reading ' + file.name + ': ' + e.message);
      continue;
    }

    uploadedFiles.push({ name: file.name, size: file.size, text: text });
    renderFileList();
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function extractDocx(file) {
  if (typeof mammoth === 'undefined') {
    throw new Error('mammoth.js not loaded — DOCX extraction unavailable');
  }
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractPdf(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('pdf.js not loaded — PDF extraction unavailable');
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pages.push(text);
  }
  return pages.join('\n\n');
}

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  const list = document.getElementById('file-list');
  if (!list) return;
  list.innerHTML = '';
  uploadedFiles.forEach((f, i) => {
    const li = document.createElement('li');
    const sizeKb = (f.size / 1024).toFixed(1);
    li.innerHTML = '<span class="file-name">📄 ' + escHtml(f.name) + '</span>'
      + '<span class="file-size">' + sizeKb + ' KB · ' + f.text.length.toLocaleString() + ' chars</span>'
      + '<button class="file-remove" onclick="removeFile(' + i + ')" title="Remove">✕</button>';
    list.appendChild(li);
  });
}

// ── GATHER INPUT ──
function gatherOpportunities() {
  const pastedText = (document.getElementById('opportunities-text')?.value || '').trim();
  const fileTexts = uploadedFiles.map(f => f.text).filter(Boolean);
  const parts = [];
  if (pastedText) parts.push(pastedText);
  if (fileTexts.length > 0) parts.push(...fileTexts);
  return parts.join('\n\n---\n\n');
}

// ── RUN SCAN ──
async function runScan() {
  const context = (document.getElementById('project-context')?.value || '').trim();
  const opportunities = gatherOpportunities();
  const scanFocus = document.getElementById('scan-focus')?.value || 'all';
  projectSlug = (document.getElementById('project-slug')?.value || '').trim();

  // Validate
  if (!context) {
    showToast('Please enter a project context.');
    document.getElementById('project-context')?.focus();
    return;
  }
  if (!opportunities) {
    showToast('Please enter opportunities or upload a file.');
    document.getElementById('opportunities-text')?.focus();
    return;
  }
  if (!hasCredentials()) {
    showToast('Please configure your API settings first.');
    openSettings();
    return;
  }

  // Disable button, clear output
  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Running…';
  clearStatus();
  clearOutput();

  try {
    lastResult = await runPipeline(context, opportunities, scanFocus, onStatus);
    renderOutput(lastResult);
    enableExportButtons(true);
  } catch (e) {
    onStatus('Pipeline failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '▶ Run Ideation Scan';
  }
}

// ── STATUS DISPLAY ──
function onStatus(message, type) {
  const container = document.getElementById('status');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'status-' + type;
  div.textContent = message;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Update progress bar — handles multi-batch Stage 2
  const bar = document.getElementById('progress-fill');
  if (bar) {
    if (type === 'step' && message.includes('Stage 1')) bar.style.width = '10%';
    else if (type === 'done' && message.includes('Stage 1 complete')) bar.style.width = '40%';
    else if (type === 'step' && message.includes('Stage 2')) {
      // Parse batch info if present
      const batchMatch = message.match(/batch (\d+)\/(\d+)/);
      if (batchMatch) {
        const batchNum = parseInt(batchMatch[1]);
        const totalBatches = parseInt(batchMatch[2]);
        bar.style.width = (40 + (batchNum - 1) / totalBatches * 50) + '%';
      } else {
        bar.style.width = '45%';
      }
    }
    else if (type === 'done' && message.includes('Stage 2') && message.includes('complete')) {
      const batchMatch = message.match(/batch (\d+)\/(\d+)/);
      if (batchMatch) {
        const batchNum = parseInt(batchMatch[1]);
        const totalBatches = parseInt(batchMatch[2]);
        bar.style.width = (40 + batchNum / totalBatches * 50) + '%';
      } else {
        bar.style.width = '90%';
      }
    }
    else if (type === 'done' && message.includes('Pipeline complete')) bar.style.width = '100%';
    else if (type === 'done' && message.includes('All batches merged')) bar.style.width = '95%';
    else if (type === 'error') {
      bar.style.width = bar.style.width; // Keep current position on error
    }
  }
}

function clearStatus() {
  const container = document.getElementById('status');
  if (container) container.innerHTML = '';
  const bar = document.getElementById('progress-fill');
  if (bar) bar.style.width = '0%';
}

// ── TAB SWITCHING ──
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(tc => {
    tc.classList.toggle('active', tc.id === tabId);
  });
}

// ── OUTPUT RENDERING ──
function clearOutput() {
  document.getElementById('tab-scan').innerHTML = '';
  document.getElementById('tab-solution').innerHTML = '';
  enableExportButtons(false);
  lastResult = null;

  // Show empty state
  document.getElementById('tab-scan').innerHTML = '<div class="output-empty"><div class="empty-icon">🔍</div>Run an ideation scan to see innovation insights here…</div>';
  document.getElementById('tab-solution').innerHTML = '<div class="output-empty"><div class="empty-icon">💡</div>Unpacked solution concepts will appear here…</div>';
}

function enableExportButtons(enabled) {
  document.querySelectorAll('.export-btn').forEach(btn => btn.disabled = !enabled);
}

function renderOutput(result) {
  renderStage1(result.stage1);
  renderStage2(result.stage2);

  // Usage stats
  const usageEl = document.getElementById('usage-stats');
  if (usageEl && result.usage) {
    usageEl.textContent = 'Model: ' + result.model
      + ' · Tokens: ' + (result.usage.total_tokens || 0).toLocaleString()
      + ' · Time: ' + result.elapsed;
  }

  // Switch to first tab
  switchTab('tab-scan');
}

function renderStage1(data) {
  const container = document.getElementById('tab-scan');
  container.innerHTML = '';

  // Scan Summary
  const summary = document.createElement('div');
  summary.className = 'summary-card blue';
  summary.innerHTML = '<strong>🌐 Scan Summary:</strong> ' + escHtml(data.scan_summary || '');
  container.appendChild(summary);

  // Best Practices
  container.appendChild(sectionHeader('🏆', 'Best Practices'));
  const bpGrid = document.createElement('div');
  bpGrid.className = 'card-grid';
  (data.best_practices || []).forEach(bp => {
    bpGrid.appendChild(bestPracticeCard(bp));
  });
  container.appendChild(bpGrid);

  // Analogous Solutions
  container.appendChild(sectionHeader('🔄', 'Analogous Solutions'));
  const asGrid = document.createElement('div');
  asGrid.className = 'card-grid';
  (data.analogous_solutions || []).forEach(as => {
    asGrid.appendChild(analogousCard(as));
  });
  container.appendChild(asGrid);

  // Design Trends
  container.appendChild(sectionHeader('📈', 'Design Trends'));
  const dtGrid = document.createElement('div');
  dtGrid.className = 'trend-grid';
  (data.design_trends || []).forEach(dt => {
    dtGrid.appendChild(trendCard(dt));
  });
  container.appendChild(dtGrid);

  // Inspiration Sources
  container.appendChild(sectionHeader('📚', 'Inspiration Sources'));
  const inspList = document.createElement('ul');
  inspList.className = 'inspiration-list';
  (data.inspiration_sources || []).forEach(is => {
    const li = document.createElement('li');
    li.innerHTML = '<span class="insp-type">' + escHtml(is.type || 'Resource') + '</span>'
      + '<span><span class="insp-name">' + escHtml(is.name || '') + '</span>'
      + ' — <span class="insp-why">' + escHtml(is.why_relevant || '') + '</span></span>';
    inspList.appendChild(li);
  });
  container.appendChild(inspList);
}

function renderStage2(data) {
  const container = document.getElementById('tab-solution');
  container.innerHTML = '';

  // Solution Overview
  const summary = document.createElement('div');
  summary.className = 'summary-card green';
  summary.innerHTML = '<strong>💡 Solution Overview:</strong> ' + escHtml(data.solution_overview || '');
  container.appendChild(summary);

  // Solution Concepts
  container.appendChild(sectionHeader('🧩', 'Solution Concepts'));
  (data.solution_concepts || []).forEach((concept, ci) => {
    container.appendChild(conceptCard(concept, ci));
  });

  // Cross-Cutting Themes
  if (data.cross_cutting_themes && data.cross_cutting_themes.length > 0) {
    container.appendChild(sectionHeader('🔗', 'Cross-Cutting Themes'));
    const themeList = document.createElement('div');
    themeList.className = 'theme-list';
    data.cross_cutting_themes.forEach(t => {
      const chip = document.createElement('div');
      chip.className = 'theme-chip';
      chip.innerHTML = '<div class="theme-name">' + escHtml(t.theme || '') + '</div>'
        + '<div class="theme-desc">' + escHtml(t.description || '') + '</div>';
      themeList.appendChild(chip);
    });
    container.appendChild(themeList);
  }

  // Risks & Considerations
  if (data.risks_and_considerations && data.risks_and_considerations.length > 0) {
    container.appendChild(sectionHeader('⚠️', 'Risks & Considerations'));
    const riskList = document.createElement('div');
    riskList.className = 'risk-list';
    data.risks_and_considerations.forEach(r => {
      const card = document.createElement('div');
      card.className = 'risk-card';
      card.innerHTML = '<div class="risk-title">⚠ ' + escHtml(r.risk || '') + '</div>'
        + '<div class="risk-mitigation"><strong>Mitigation:</strong> ' + escHtml(r.mitigation || '') + '</div>';
      riskList.appendChild(card);
    });
    container.appendChild(riskList);
  }
}

// ── CARD BUILDERS ──
function sectionHeader(icon, text) {
  const h = document.createElement('div');
  h.className = 'section-header';
  h.innerHTML = '<span class="section-icon">' + icon + '</span> ' + escHtml(text);
  return h;
}

function bestPracticeCard(bp) {
  const card = document.createElement('div');
  card.className = 'insight-card';
  card.innerHTML = '<div class="card-title">' + escHtml(bp.title || '') + '</div>'
    + '<span class="card-badge badge-domain">' + escHtml(bp.source_domain || '') + '</span>'
    + '<div class="card-desc">' + escHtml(bp.description || '') + '</div>'
    + '<div class="card-relevance">💡 ' + escHtml(bp.relevance || '') + '</div>'
    + (bp.url_hint ? '<div class="card-link">🔗 ' + escHtml(bp.url_hint) + '</div>' : '');
  return card;
}

function analogousCard(as) {
  const card = document.createElement('div');
  card.className = 'insight-card';
  card.innerHTML = '<div class="card-title">' + escHtml(as.title || '') + '</div>'
    + '<span class="card-badge badge-sector">' + escHtml(as.sector || '') + '</span>'
    + '<div class="card-desc">' + escHtml(as.description || '') + '</div>'
    + '<div class="card-relevance">🔄 ' + escHtml(as.transferable_insight || '') + '</div>';
  return card;
}

function trendCard(dt) {
  const card = document.createElement('div');
  card.className = 'trend-card';
  card.innerHTML = '<div class="trend-name">' + escHtml(dt.trend || '') + '</div>'
    + '<div class="trend-desc">' + escHtml(dt.description || '') + '</div>'
    + '<div class="trend-app">→ ' + escHtml(dt.application || '') + '</div>';
  return card;
}

function conceptCard(concept, index) {
  const card = document.createElement('div');
  card.className = 'concept-card open';

  const header = document.createElement('div');
  header.className = 'concept-header';
  header.innerHTML = '<div>'
    + '<span class="concept-title">Concept ' + (index + 1) + ': ' + escHtml(concept.concept_name || '') + '</span>'
    + '<span class="concept-meta"> · ' + (concept.features?.length || 0) + ' features</span>'
    + '</div>'
    + '<span class="chevron">▼</span>';
  header.addEventListener('click', () => card.classList.toggle('open'));
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'concept-body';

  if (concept.opportunity_source) {
    body.innerHTML += '<div class="concept-source">📌 Opportunity: ' + escHtml(concept.opportunity_source) + '</div>';
  }
  body.innerHTML += '<div class="concept-desc">' + escHtml(concept.concept_description || '') + '</div>';

  // Feature table
  if (concept.features && concept.features.length > 0) {
    const table = document.createElement('table');
    table.className = 'feature-table';
    table.innerHTML = '<thead><tr>'
      + '<th>Feature</th>'
      + '<th>Description</th>'
      + '<th>HCD Value</th>'
      + '<th>Best Practice Ref</th>'
      + '<th>Complexity</th>'
      + '</tr></thead>';

    const tbody = document.createElement('tbody');
    concept.features.forEach(f => {
      const cx = (f.implementation_complexity || 'Medium').toLowerCase();
      const cxClass = cx === 'low' ? 'complexity-low' : cx === 'high' ? 'complexity-high' : 'complexity-medium';
      const tr = document.createElement('tr');
      tr.innerHTML = '<td class="feat-name">' + escHtml(f.feature_name || '') + '</td>'
        + '<td>' + escHtml(f.description || '') + '</td>'
        + '<td class="feat-hcd">' + escHtml(f.hcd_value_proposition || '') + '</td>'
        + '<td class="feat-ref">' + escHtml(f.best_practice_reference || '') + '</td>'
        + '<td><span class="complexity-badge ' + cxClass + '">' + escHtml(f.implementation_complexity || 'Medium') + '</span></td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);
  }

  card.appendChild(body);
  return card;
}

// ── EXPORT HANDLERS ──
function doExportMd() {
  if (!lastResult) return;
  exportMarkdown(lastResult.stage1, lastResult.stage2, projectSlug);
}

function doExportDocx() {
  if (!lastResult) return;
  exportDocx(lastResult.stage1, lastResult.stage2, projectSlug);
}

function doExportPptx() {
  if (!lastResult) return;
  exportPptx(lastResult.stage1, lastResult.stage2, projectSlug);
}

function doCopy() {
  if (!lastResult) return;
  copyToClipboard(lastResult.stage1, lastResult.stage2, projectSlug);
}

// ── UTILITIES ──
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
