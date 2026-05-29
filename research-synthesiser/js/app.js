window.Synth = window.Synth || {};

Synth.app = (function () {
  let currentTab = 'project';
  let activeProjectId = null;
  let pendingParse = null;
  let pendingParticipantId = null;
  let selectedThemes = new Set();
  let cachedRqMap = {};

  async function init() {
    initNavigation();
    initSettingsModal();
    initProjectsView();
    initProjectTab();
    initSettingsTab();
    initParticipantsTab();
    Synth.deidentify.initEvents();
    initSynthesisControls();
    initThemesTab();
    initExportTab();
    initNudges();
    loadSavedCredentials();

    try {
      await Synth.db.open();
      await loadProjectList();
    } catch (e) {
      console.error('IndexedDB failed to open:', e);
      showStatus('api-status', 'error',
        'Database failed to initialise: ' + e.message +
        '. Some features may not work. Try a Chromium-based browser (Chrome, Edge).'
      );
    }
  }

  // ========== Navigation ==========

  function initNavigation() {
    document.querySelectorAll('#workspace-nav .tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
    });

    document.getElementById('btn-back-projects').addEventListener('click', exitProject);
  }

  function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('#workspace-nav .tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'tab-' + tabId);
    });
    if (tabId === 'themes') refreshThemes();
    if (tabId === 'participants') refreshParticipantList();
    if (tabId === 'settings') loadSettingsTab();
    if (tabId === 'export') loadExportDefaults();
  }

  function enterProject(projectId, projectName) {
    activeProjectId = projectId;
    document.getElementById('view-projects').classList.remove('active');
    document.getElementById('workspace-nav').classList.remove('hidden');
    document.getElementById('btn-back-projects').classList.remove('hidden');
    updateProjectIndicator(projectName);
    switchTab('project');
    loadFramework();
  }

  function exitProject() {
    activeProjectId = null;
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    document.getElementById('workspace-nav').classList.add('hidden');
    document.getElementById('btn-back-projects').classList.add('hidden');
    document.getElementById('view-projects').classList.add('active');
    updateProjectIndicator('');
    loadProjectList();
  }

  function updateProjectIndicator(name) {
    document.getElementById('project-indicator').textContent = name ? name : '';
  }

  // ========== Settings Modal ==========

  function initSettingsModal() {
    document.getElementById('btn-settings').addEventListener('click', function () {
      document.getElementById('settings-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-settings').addEventListener('click', function () {
      document.getElementById('settings-modal').classList.add('hidden');
    });
    document.getElementById('settings-modal').addEventListener('click', function (e) {
      if (e.target === this) this.classList.add('hidden');
    });
    document.getElementById('btn-save-api').addEventListener('click', saveCredentials);
    document.getElementById('btn-test-api').addEventListener('click', testConnection);
  }

  function loadSavedCredentials() {
    var endpoint = Synth.api.getEndpoint();
    var key = Synth.api.getApiKey();
    if (endpoint) document.getElementById('api-endpoint').value = endpoint;
    if (key) document.getElementById('api-key').value = key;
  }

  function saveCredentials() {
    var endpoint = document.getElementById('api-endpoint').value.trim();
    var key = document.getElementById('api-key').value.trim();
    if (!endpoint) { showStatus('api-status', 'error', 'Please enter a gateway endpoint.'); return; }
    if (!key) { showStatus('api-status', 'error', 'Please enter an API key.'); return; }
    Synth.api.saveCredentials(endpoint, key);
    showStatus('api-status', 'success', 'Credentials saved.');
  }

  async function testConnection() {
    var endpoint = document.getElementById('api-endpoint').value.trim();
    var key = document.getElementById('api-key').value.trim();
    if (!endpoint || !key) { showStatus('api-status', 'error', 'Enter your endpoint and API key first.'); return; }
    Synth.api.saveCredentials(endpoint, key);

    var btn = document.getElementById('btn-test-api');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Testing…';
    showStatus('api-status', 'info', 'Connecting to gateway…');

    try {
      var result = await Synth.api.testConnection();
      showStatus('api-status', 'success',
        'Connected. Found ' + result.models.length + ' model(s) (' + result.anthropic.length + ' Anthropic).');
      renderModelList(result.models);
    } catch (e) {
      showStatus('api-status', 'error', e.message);
      document.getElementById('api-models-card').classList.add('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Test Connection';
    }
  }

  function renderModelList(models) {
    var list = document.getElementById('api-models-list');
    list.innerHTML = '';
    models.forEach(function (id) {
      var li = document.createElement('li');
      li.textContent = id;
      if (/claude|sonnet|haiku|opus/i.test(id)) li.classList.add('anthropic');
      list.appendChild(li);
    });
    document.getElementById('api-models-card').classList.remove('hidden');
  }

  // ========== Projects View ==========

  function initProjectsView() {
    document.getElementById('btn-new-project').addEventListener('click', function () {
      document.getElementById('new-project-form').classList.remove('hidden');
    });
    document.getElementById('btn-cancel-project').addEventListener('click', function () {
      document.getElementById('new-project-form').classList.add('hidden');
    });
    document.getElementById('btn-create-project').addEventListener('click', createProject);
  }

  async function loadProjectList() {
    var projects = await Synth.db.getProjects();
    var container = document.getElementById('projects-list');
    var empty = document.getElementById('projects-empty');

    if (projects.length === 0) {
      container.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    container.innerHTML = '';

    projects.forEach(function (p) {
      var div = document.createElement('div');
      div.className = 'project-list-item';
      div.dataset.id = p.project_id;
      div.innerHTML =
        '<span class="project-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="project-meta">' + formatDate(p.created) + '</span>' +
        '<span class="project-arrow">&rsaquo;</span>';
      div.addEventListener('click', function () {
        enterProject(p.project_id, p.name);
      });
      container.appendChild(div);
    });
  }

  async function createProject() {
    var name = document.getElementById('new-project-name').value.trim();
    if (!name) { showStatus('project-status', 'error', 'Enter a project name.'); return; }

    var project = await Synth.db.createProject(name);
    await Synth.db.createDefaultFramework(project.project_id);
    document.getElementById('new-project-form').classList.add('hidden');
    document.getElementById('new-project-name').value = '';

    enterProject(project.project_id, name);
  }

  // ========== Project Info Tab ==========

  function initProjectTab() {
    document.getElementById('btn-save-framework').addEventListener('click', saveFramework);
    document.getElementById('btn-add-rq').addEventListener('click', addResearchQuestion);
    document.getElementById('btn-add-group').addEventListener('click', addParticipantGroup);
    document.getElementById('new-rq-label').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addResearchQuestion(); }
    });
    initBgHelper();
  }

  // ========== Background Generator ==========

  var bgDocFile = null;

  function initBgHelper() {
    document.getElementById('btn-open-bg-helper').addEventListener('click', function () {
      document.getElementById('bg-helper-panel').classList.remove('hidden');
      this.classList.add('hidden');
    });
    document.getElementById('btn-close-bg-helper').addEventListener('click', closeBgHelper);

    document.querySelectorAll('.bg-path-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.bg-path-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var path = btn.dataset.bgPath;
        document.getElementById('bg-path-questions').classList.toggle('hidden', path !== 'questions');
        document.getElementById('bg-path-document').classList.toggle('hidden', path !== 'document');
      });
    });

    document.getElementById('btn-bg-generate').addEventListener('click', generateBgFromQuestions);
    document.getElementById('btn-bg-extract').addEventListener('click', generateBgFromDocument);
    document.getElementById('btn-bg-use').addEventListener('click', useBgPreview);
    document.getElementById('btn-bg-regenerate').addEventListener('click', regenerateBg);

    var dropzone = document.getElementById('bg-doc-dropzone');
    var fileInput = document.getElementById('bg-doc-input');
    dropzone.addEventListener('click', function () { fileInput.click(); });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('drag-over'); });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      handleBgDocFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files[0]) handleBgDocFile(fileInput.files[0]);
    });
  }

  function closeBgHelper() {
    document.getElementById('bg-helper-panel').classList.add('hidden');
    document.getElementById('btn-open-bg-helper').classList.remove('hidden');
  }

  function handleBgDocFile(file) {
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'docx' && ext !== 'pptx') {
      showStatus('bg-helper-status', 'error', 'Unsupported file type. Please upload a .docx or .pptx file.');
      return;
    }
    bgDocFile = file;
    var nameEl = document.getElementById('bg-doc-filename');
    nameEl.textContent = file.name;
    nameEl.classList.remove('hidden');
    document.getElementById('btn-bg-extract').disabled = false;
  }

  function getBgModel() {
    var sel = document.getElementById('default-synth-model');
    return (sel && sel.value) ? sel.value : 'claude-sonnet-4-6';
  }

  async function generateBgFromQuestions() {
    if (!Synth.api.hasCredentials()) {
      showStatus('bg-helper-status', 'error', 'Configure your API credentials in Settings first.');
      return;
    }
    var project = document.getElementById('bg-q-project').value.trim();
    var goal = document.getElementById('bg-q-goal').value.trim();
    var method = document.getElementById('bg-q-method').value.trim();
    if (!project || !goal || !method) {
      showStatus('bg-helper-status', 'error', 'Please fill in at least the first three fields.');
      return;
    }
    var answers = {
      project: project,
      goal: goal,
      method: method,
      participants: document.getElementById('bg-q-participants').value.trim(),
      domain: document.getElementById('bg-q-domain').value.trim()
    };

    var existing = document.getElementById('fw-background').value.trim();
    var userPrompt = Synth.prompts.buildBgFromQuestionnaire(answers);
    if (existing) userPrompt += '\n\nExisting background (for reference):\n' + existing;

    await callBgGeneration(userPrompt);
  }

  async function generateBgFromDocument() {
    if (!Synth.api.hasCredentials()) {
      showStatus('bg-helper-status', 'error', 'Configure your API credentials in Settings first.');
      return;
    }
    if (!bgDocFile) {
      showStatus('bg-helper-status', 'error', 'Please upload a document first.');
      return;
    }

    var btn = document.getElementById('btn-bg-extract');
    btn.disabled = true;
    btn.textContent = 'Extracting...';
    showStatus('bg-helper-status', 'info', 'Reading document...');

    try {
      var ext = bgDocFile.name.split('.').pop().toLowerCase();
      var text;
      if (ext === 'pptx') {
        text = await Synth.parser.extractPptxText(bgDocFile);
      } else {
        text = await Synth.parser.extractDocxText(bgDocFile);
      }

      if (!text || text.trim().length < 20) {
        showStatus('bg-helper-status', 'error', 'Could not extract enough text from the document. Try a different file.');
        return;
      }

      var maxChars = 24000;
      if (text.length > maxChars) {
        text = text.substring(0, maxChars);
      }

      var note = document.getElementById('bg-doc-note').value.trim();
      var userPrompt = Synth.prompts.buildBgFromDocument(text, note);

      await callBgGeneration(userPrompt);
    } catch (err) {
      showStatus('bg-helper-status', 'error', 'Failed to read document: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Extract &amp; Generate';
    }
  }

  async function callBgGeneration(userPrompt) {
    var genBtn = document.getElementById('btn-bg-generate');
    var extBtn = document.getElementById('btn-bg-extract');
    genBtn.disabled = true;
    extBtn.disabled = true;
    genBtn.textContent = 'Generating...';
    showStatus('bg-helper-status', 'info', 'Generating background...');

    try {
      var model = getBgModel();
      var result = await Synth.api.chatCompletion(model, [
        { role: 'system', content: Synth.prompts.BG_GENERATOR_SYSTEM },
        { role: 'user', content: userPrompt }
      ], { max_tokens: 1024 });

      var text = result.content.trim();
      document.getElementById('bg-preview-text').value = text;
      document.getElementById('bg-preview-panel').classList.remove('hidden');
      showStatus('bg-helper-status', 'success', 'Background generated. Review the preview below.');
    } catch (err) {
      showStatus('bg-helper-status', 'error', 'Generation failed: ' + err.message);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Background';
      extBtn.disabled = !bgDocFile;
      extBtn.innerHTML = 'Extract &amp; Generate';
    }
  }

  function useBgPreview() {
    var text = document.getElementById('bg-preview-text').value.trim();
    if (!text) return;
    document.getElementById('fw-background').value = text;
    document.getElementById('bg-preview-panel').classList.add('hidden');
    closeBgHelper();
    showStatus('framework-status', 'info', 'Background updated. Click Save to keep your changes.');
  }

  function regenerateBg() {
    var activePath = document.querySelector('.bg-path-btn.active');
    if (activePath && activePath.dataset.bgPath === 'document') {
      generateBgFromDocument();
    } else {
      generateBgFromQuestions();
    }
  }

  // ========== Settings Tab ==========

  function initSettingsTab() {
    document.getElementById('btn-save-model-defaults').addEventListener('click', saveModelDefaults);
    document.getElementById('btn-reset-synthesis').addEventListener('click', resetSynthesis);
    document.getElementById('btn-delete-project').addEventListener('click', deleteProject);
    document.getElementById('btn-save-prompts').addEventListener('click', savePrompts);
    document.getElementById('btn-reset-synthesis-prompt').addEventListener('click', function () {
      document.getElementById('custom-synthesis-prompt').value = '';
      showStatus('prompt-settings-status', 'info', 'Synthesis prompt reverted to default. Save to apply.');
    });
    document.getElementById('btn-reset-consolidation-prompt').addEventListener('click', function () {
      document.getElementById('custom-consolidation-prompt').value = '';
      showStatus('prompt-settings-status', 'info', 'Consolidation prompt reverted to default. Save to apply.');
    });
    document.getElementById('btn-preview-synthesis-prompt').addEventListener('click', function () { previewPrompt('synthesis'); });
    document.getElementById('btn-preview-consolidation-prompt').addEventListener('click', function () { previewPrompt('consolidation'); });
    document.getElementById('btn-close-prompt-preview').addEventListener('click', function () {
      document.getElementById('prompt-preview-panel').classList.add('hidden');
    });
  }

  async function loadSettingsTab() {
    if (!activeProjectId) return;
    var fw = await Synth.db.getFramework(activeProjectId);
    if (!fw) return;

    document.getElementById('default-synth-model').value = fw.default_synth_model || 'claude-sonnet-4-6';
    document.getElementById('default-consolidation-model').value = fw.default_consolidation_model || '';

    document.getElementById('custom-synthesis-prompt').value = fw.custom_synthesis_prompt || '';
    document.getElementById('custom-consolidation-prompt').value = fw.custom_consolidation_prompt || '';

    // Show current effective prompt status
    var synthCurrent = document.getElementById('synthesis-prompt-current');
    var consolCurrent = document.getElementById('consolidation-prompt-current');

    if (fw.custom_synthesis_prompt) {
      synthCurrent.textContent = 'Using custom prompt. Edit below or revert to default.';
      synthCurrent.className = 'prompt-current-preview custom';
    } else {
      synthCurrent.textContent = 'Using default prompt. Edit below to customise.';
      synthCurrent.className = 'prompt-current-preview default';
    }

    if (fw.custom_consolidation_prompt) {
      consolCurrent.textContent = 'Using custom prompt. Edit below or revert to default.';
      consolCurrent.className = 'prompt-current-preview custom';
    } else {
      consolCurrent.textContent = 'Using default prompt. Edit below to customise.';
      consolCurrent.className = 'prompt-current-preview default';
    }
  }

  async function saveModelDefaults() {
    if (!activeProjectId) return;
    var fw = await Synth.db.getFramework(activeProjectId);
    fw.default_synth_model = document.getElementById('default-synth-model').value || 'claude-sonnet-4-6';
    fw.default_consolidation_model = document.getElementById('default-consolidation-model').value || '';
    await Synth.db.saveFramework(fw);
    showStatus('model-defaults-status', 'success', 'Model defaults saved.');
  }

  async function resetSynthesis() {
    if (!activeProjectId) return;
    if (!confirm('This will delete all themes and reset all participant synthesis statuses. Transcripts are kept. Continue?')) return;

    // Delete all themes for this project
    var themes = await Synth.db.getThemesByProject(activeProjectId);
    for (var i = 0; i < themes.length; i++) {
      await Synth.db.deleteTheme(themes[i].theme_id);
    }

    // Delete all session syntheses for this project
    var syntheses = await Synth.db.getSessionSynthesesByProject(activeProjectId);
    for (var i = 0; i < syntheses.length; i++) {
      await Synth.db.deleteSessionSynthesis(syntheses[i].synthesis_id);
    }

    // Reset participant statuses and transcript statuses
    var participants = await Synth.db.getParticipantsByProject(activeProjectId);
    for (var i = 0; i < participants.length; i++) {
      var pp = participants[i];
      if (pp.transcript_id) {
        pp.synthesis_status = 'pending';
        var tx = await Synth.db.getTranscript(pp.transcript_id);
        if (tx) {
          tx.status = 'uploaded';
          await Synth.db.saveTranscript(tx);
        }
      }
      await Synth.db.saveParticipant(pp);
    }

    showStatus('reset-synthesis-status', 'success', 'Cleared ' + themes.length + ' theme(s). All participants reset to pending.');
  }

  async function deleteProject() {
    if (!activeProjectId) return;
    var project = await Synth.db.getProject(activeProjectId);
    var projectName = project ? project.name : 'this project';
    if (!confirm('Permanently delete "' + projectName + '" and all its data? This cannot be undone.')) return;
    if (!confirm('Are you sure? All participants, transcripts, themes, and syntheses will be lost.')) return;

    // Delete all themes
    var themes = await Synth.db.getThemesByProject(activeProjectId);
    for (var i = 0; i < themes.length; i++) {
      await Synth.db.deleteTheme(themes[i].theme_id);
    }

    // Delete all session syntheses
    var syntheses = await Synth.db.getSessionSynthesesByProject(activeProjectId);
    for (var i = 0; i < syntheses.length; i++) {
      await Synth.db.deleteSessionSynthesis(syntheses[i].synthesis_id);
    }

    // Delete all participants and their transcripts/inquiries
    var participants = await Synth.db.getParticipantsByProject(activeProjectId);
    for (var i = 0; i < participants.length; i++) {
      var pp = participants[i];
      if (pp.transcript_id) {
        await Synth.db.deleteTranscript(pp.transcript_id);
      }
      var displayId = pp.display_id || pp.participant_id;
      var participantKey = activeProjectId + '_' + displayId;
      var inquiries = await Synth.db.getInquiriesByParticipant(participantKey);
      for (var q = 0; q < inquiries.length; q++) {
        await Synth.db.deleteInquiry(inquiries[q].inquiry_id);
      }
      await Synth.db.deleteParticipant(pp.participant_id);
    }

    // Delete framework and project
    await Synth.db.saveFramework({ project_id: activeProjectId });
    await Synth.db.deleteProject(activeProjectId);

    exitProject();
  }

  async function loadFramework() {
    if (!activeProjectId) return;

    var fw = await Synth.db.getFramework(activeProjectId);
    if (!fw) {
      fw = await Synth.db.createDefaultFramework(activeProjectId);
    }

    document.getElementById('fw-background').value = fw.background || '';
    renderResearchQuestions(fw.research_questions || []);
    renderParticipantGroups(fw.participant_groups || []);
    updateRqDropdowns(fw.research_questions || []);
    updateGroupDropdown(fw.participant_groups || []);
  }

  async function saveFramework() {
    if (!activeProjectId) return;
    var fw = await Synth.db.getFramework(activeProjectId);
    fw.background = document.getElementById('fw-background').value.trim();
    await Synth.db.saveFramework(fw);
    showStatus('framework-status', 'success', 'Framework saved.');
  }

  async function savePrompts() {
    if (!activeProjectId) return;
    var fw = await Synth.db.getFramework(activeProjectId);
    var synthVal = document.getElementById('custom-synthesis-prompt').value.trim();
    var consolVal = document.getElementById('custom-consolidation-prompt').value.trim();
    fw.custom_synthesis_prompt = synthVal || null;
    fw.custom_consolidation_prompt = consolVal || null;
    await Synth.db.saveFramework(fw);
    showStatus('prompt-settings-status', 'success', 'Prompt settings saved.');
  }

  async function previewPrompt(type) {
    if (!activeProjectId) return;
    var fw = await Synth.db.getFramework(activeProjectId);
    var previewFw = Object.assign({}, fw);
    previewFw.custom_synthesis_prompt = document.getElementById('custom-synthesis-prompt').value.trim() || null;
    previewFw.custom_consolidation_prompt = document.getElementById('custom-consolidation-prompt').value.trim() || null;

    var title, content;
    if (type === 'synthesis') {
      title = 'Full Per-Session Synthesis System Prompt';
      content = Synth.prompts.buildSynthesisSystem(previewFw);
    } else {
      title = 'Full Consolidation System Prompt';
      content = Synth.prompts.buildConsolidationSystem(previewFw);
    }

    document.getElementById('prompt-preview-title').textContent = title;
    document.getElementById('prompt-preview-content').textContent = content;
    document.getElementById('prompt-preview-panel').classList.remove('hidden');
  }

  // --- Facilitators ---

  // --- Research Questions ---

  function renderResearchQuestions(rqs) {
    var container = document.getElementById('rq-list');
    container.innerHTML = '';
    rqs.forEach(function (rq, i) {
      var div = document.createElement('div');
      div.className = 'fw-item';
      div.innerHTML =
        '<div class="fw-item-content">' +
          '<div class="fw-item-label">' + escapeHtml(rq.label) + '</div>' +
        '</div>' +
        '<div class="fw-item-actions">' +
          '<button class="btn-icon btn-icon-edit" data-action="edit-rq" data-index="' + i + '" title="Edit">&#9998;</button>' +
          '<button class="btn-icon" data-action="remove-rq" data-index="' + i + '" title="Remove">&times;</button>' +
        '</div>';
      container.appendChild(div);
    });
    container.addEventListener('click', handleRqAction);
  }

  async function addResearchQuestion() {
    var label = document.getElementById('new-rq-label').value.trim();
    if (!label || !activeProjectId) return;

    var fw = await Synth.db.getFramework(activeProjectId);
    var order = fw.research_questions.length + 1;
    var rq = {
      rq_id: 'rq_' + String(order).padStart(3, '0'),
      label: label,
      order: order
    };
    fw.research_questions.push(rq);
    await Synth.db.saveFramework(fw);

    document.getElementById('new-rq-label').value = '';
    renderResearchQuestions(fw.research_questions);
    updateRqDropdowns(fw.research_questions);
  }

  async function handleRqAction(e) {
    var editBtn = e.target.closest('[data-action="edit-rq"]');
    var removeBtn = e.target.closest('[data-action="remove-rq"]');

    if (editBtn && activeProjectId) {
      var idx = parseInt(editBtn.dataset.index, 10);
      var fw = await Synth.db.getFramework(activeProjectId);
      var rq = fw.research_questions[idx];
      if (!rq) return;

      var item = editBtn.closest('.fw-item');
      var content = item.querySelector('.fw-item-content');
      var actions = item.querySelector('.fw-item-actions');

      content.innerHTML =
        '<input type="text" class="rq-edit-input" value="' + escapeHtml(rq.label) + '" style="width:100%">';
      actions.innerHTML =
        '<button class="btn btn-sm btn-primary" data-action="save-rq" data-index="' + idx + '">Save</button>' +
        '<button class="btn btn-sm btn-secondary" data-action="cancel-rq">Cancel</button>';

      var input = content.querySelector('.rq-edit-input');
      input.focus();
      input.addEventListener('keydown', async function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          await saveRqEdit(idx, input.value.trim());
        } else if (ev.key === 'Escape') {
          renderResearchQuestions(fw.research_questions);
        }
      });
      return;
    }

    var saveBtn = e.target.closest('[data-action="save-rq"]');
    if (saveBtn) {
      var idx = parseInt(saveBtn.dataset.index, 10);
      var input = saveBtn.closest('.fw-item').querySelector('.rq-edit-input');
      await saveRqEdit(idx, input.value.trim());
      return;
    }

    var cancelBtn = e.target.closest('[data-action="cancel-rq"]');
    if (cancelBtn && activeProjectId) {
      var fw = await Synth.db.getFramework(activeProjectId);
      renderResearchQuestions(fw.research_questions);
      return;
    }

    if (removeBtn && activeProjectId) {
      var idx = parseInt(removeBtn.dataset.index, 10);
      var fw = await Synth.db.getFramework(activeProjectId);
      fw.research_questions.splice(idx, 1);
      await Synth.db.saveFramework(fw);
      renderResearchQuestions(fw.research_questions);
      updateRqDropdowns(fw.research_questions);
    }
  }

  async function saveRqEdit(idx, newLabel) {
    if (!newLabel || !activeProjectId) return;
    var fw = await Synth.db.getFramework(activeProjectId);
    if (!fw.research_questions[idx]) return;
    fw.research_questions[idx].label = newLabel;
    await Synth.db.saveFramework(fw);
    renderResearchQuestions(fw.research_questions);
    updateRqDropdowns(fw.research_questions);
  }

  // --- Participant Groups ---

  function renderParticipantGroups(groups) {
    var container = document.getElementById('group-list');
    container.innerHTML = '';
    groups.forEach(function (g, i) {
      var div = document.createElement('div');
      div.className = 'fw-item';
      div.innerHTML =
        '<div class="fw-item-content">' +
          '<div class="fw-item-label">' + escapeHtml(g.label) + '</div>' +
          '<div class="fw-item-desc">' + escapeHtml(g.description || '') + '</div>' +
        '</div>' +
        '<button class="btn-icon" data-action="remove-group" data-index="' + i + '">&times;</button>';
      container.appendChild(div);
    });
    container.addEventListener('click', handleGroupRemove);
  }

  async function addParticipantGroup() {
    var label = document.getElementById('new-group-label').value.trim();
    var desc = document.getElementById('new-group-desc').value.trim();
    if (!label || !activeProjectId) return;

    var fw = await Synth.db.getFramework(activeProjectId);
    var order = fw.participant_groups.length + 1;
    var group = {
      group_id: 'group_' + String(order).padStart(3, '0'),
      label: label,
      description: desc
    };
    fw.participant_groups.push(group);
    await Synth.db.saveFramework(fw);

    document.getElementById('new-group-label').value = '';
    document.getElementById('new-group-desc').value = '';
    renderParticipantGroups(fw.participant_groups);
    updateGroupDropdown(fw.participant_groups);
  }

  async function handleGroupRemove(e) {
    var btn = e.target.closest('[data-action="remove-group"]');
    if (!btn || !activeProjectId) return;
    var idx = parseInt(btn.dataset.index, 10);
    var fw = await Synth.db.getFramework(activeProjectId);
    fw.participant_groups.splice(idx, 1);
    await Synth.db.saveFramework(fw);
    renderParticipantGroups(fw.participant_groups);
    updateGroupDropdown(fw.participant_groups);
  }

  // --- Dropdown helpers ---

  function updateRqDropdowns(rqs) {
    var sel = document.getElementById('theme-filter-rq');
    if (!sel) return;
    var val = sel.value;
    sel.innerHTML = '<option value="">All RQs</option>';
    rqs.forEach(function (rq) {
      var opt = document.createElement('option');
      opt.value = rq.rq_id;
      opt.textContent = rq.label;
      sel.appendChild(opt);
    });
    sel.value = val;
  }

  function updateGroupDropdown(groups) {
    var sel = document.getElementById('pp-detail-group');
    if (!sel) return;
    sel.innerHTML = '<option value="">No group</option>';
    groups.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g.group_id;
      opt.textContent = g.label;
      sel.appendChild(opt);
    });
  }

  // ========== Participants Tab ==========

  var currentParticipantId = null;
  var isNewParticipant = false;

  function initParticipantsTab() {
    document.getElementById('btn-add-participant').addEventListener('click', addNewParticipant);
    document.getElementById('btn-back-to-list').addEventListener('click', backToParticipantList);
    document.getElementById('btn-save-pp-details').addEventListener('click', saveParticipantDetails);
    document.getElementById('btn-run-pp-synthesis').addEventListener('click', runParticipantSynthesis);
    document.getElementById('btn-submit-inquiry').addEventListener('click', submitInquiry);
    document.getElementById('btn-reupload-transcript').addEventListener('click', function () {
      document.getElementById('subpage-transcript-view').classList.add('hidden');
      document.getElementById('subpage-transcript-upload').classList.remove('hidden');
    });

    // Sub-page nav
    document.querySelectorAll('.subpage-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.classList.contains('disabled')) return;
        switchSubpage(btn.dataset.subpage);
      });
    });

    // Drop zone for transcript upload
    var dropZone = document.getElementById('subpage-drop-zone');
    var fileInput = document.getElementById('subpage-file-input');

    dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('drag-over'); });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      handleFile(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', function () { handleFile(fileInput.files); fileInput.value = ''; });
  }

  function switchSubpage(name) {
    document.querySelectorAll('.subpage-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.subpage === name);
    });
    document.querySelectorAll('.subpage-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'subpage-' + name);
    });
  }

  function updateSubpageAccess(participant) {
    var transcriptBtn = document.querySelector('.subpage-btn[data-subpage="transcript"]');
    var synthesisBtn = document.querySelector('.subpage-btn[data-subpage="synthesis"]');
    var inquiryBtn = document.querySelector('.subpage-btn[data-subpage="inquiry"]');

    var detailsSaved = !!participant;
    var hasTranscript = detailsSaved && !!participant.transcript_id;

    transcriptBtn.classList.toggle('disabled', !detailsSaved);
    synthesisBtn.classList.toggle('disabled', !hasTranscript);
    inquiryBtn.classList.toggle('disabled', !hasTranscript);
  }

  function resetSubpageState() {
    // Reset transcript sub-page
    document.getElementById('subpage-transcript-upload').classList.remove('hidden');
    document.getElementById('subpage-deidentify').classList.add('hidden');
    document.getElementById('subpage-transcript-view').classList.add('hidden');
    document.getElementById('subpage-transcript-preview').innerHTML = '';
    document.getElementById('subpage-upload-status').className = '';
    document.getElementById('subpage-upload-status').textContent = '';

    // Reset synthesis sub-page
    document.getElementById('pp-synthesis-results').classList.add('hidden');
    document.getElementById('pp-rq-findings').innerHTML = '';
    document.getElementById('pp-emergent-findings').innerHTML = '';
    document.getElementById('pp-theme-summary').classList.add('hidden');
    document.getElementById('pp-theme-blocks').innerHTML = '';
    document.getElementById('btn-run-pp-synthesis').textContent = 'Run Synthesis';
    showStatus('pp-synthesis-status', '', '');
    showStatus('pp-detail-status', '', '');

    // Reset inquiry sub-page
    document.getElementById('inquiry-input').value = '';
    document.getElementById('inquiry-history').innerHTML = '';
    document.getElementById('inquiry-empty').classList.add('hidden');
    showStatus('inquiry-status', '', '');

    // Reset pending parse
    pendingParse = null;
  }

  async function addNewParticipant() {
    if (!activeProjectId) return;
    isNewParticipant = true;
    currentParticipantId = null;

    var nextNum = await Synth.db.getNextParticipantNumber(activeProjectId);
    document.getElementById('pp-detail-id').value = 'P-' + String(nextNum).padStart(2, '0');
    document.getElementById('pp-detail-id').disabled = true;
    document.getElementById('pp-detail-name').value = '';
    document.getElementById('pp-detail-desc').value = '';
    document.getElementById('pp-detail-group').value = '';

    var fw = await Synth.db.getFramework(activeProjectId);
    if (fw) updateGroupDropdown(fw.participant_groups || []);

    document.getElementById('participant-subpage-title').textContent = 'New Participant';
    resetSubpageState();
    updateSubpageAccess(null);
    switchSubpage('details');

    document.getElementById('participant-list-card').classList.add('hidden');
    document.getElementById('synthesis-controls-card').classList.add('hidden');
    document.getElementById('participant-subpages').classList.remove('hidden');
  }

  async function openParticipantSubpages(ppId) {
    var participant = await Synth.db.getParticipant(ppId);
    if (!participant) return;

    isNewParticipant = false;
    currentParticipantId = ppId;
    var displayId = participant.display_id || participant.participant_id;

    resetSubpageState();

    document.getElementById('pp-detail-id').value = displayId;
    document.getElementById('pp-detail-id').disabled = true;
    document.getElementById('pp-detail-name').value = participant.real_name || '';
    document.getElementById('pp-detail-desc').value = participant.description || '';
    document.getElementById('pp-detail-group').value = participant.group_id || '';

    var fw = await Synth.db.getFramework(activeProjectId);
    if (fw) updateGroupDropdown(fw.participant_groups || []);

    document.getElementById('participant-subpage-title').textContent = displayId;
    updateSubpageAccess(participant);

    // Prepare transcript sub-page
    if (participant.transcript_id) {
      await loadTranscriptView(participant);
    } else {
      document.getElementById('subpage-upload-pp-id').textContent = displayId;
      document.getElementById('subpage-transcript-upload').classList.remove('hidden');
      document.getElementById('subpage-deidentify').classList.add('hidden');
      document.getElementById('subpage-transcript-view').classList.add('hidden');
    }

    // Prepare synthesis sub-page
    await loadSynthesisView(participant);

    // Prepare inquiry sub-page
    if (participant.transcript_id) {
      var participantKey = activeProjectId + '_' + (participant.display_id || participant.participant_id);
      await loadInquiryHistory(participantKey);
    }

    switchSubpage('details');

    document.getElementById('participant-list-card').classList.add('hidden');
    document.getElementById('synthesis-controls-card').classList.add('hidden');
    document.getElementById('participant-subpages').classList.remove('hidden');
  }

  async function loadTranscriptView(participant) {
    var tx = await Synth.db.getTranscript(participant.transcript_id);
    if (tx) {
      document.getElementById('subpage-transcript-upload').classList.add('hidden');
      document.getElementById('subpage-deidentify').classList.add('hidden');
      document.getElementById('subpage-transcript-view').classList.remove('hidden');
      renderTranscriptPreviewInto(document.getElementById('subpage-transcript-preview'), tx.turns, tx.speaker_roles);
    }
  }

  async function loadSynthesisView(participant) {
    var displayId = participant.display_id || participant.participant_id;
    var resultsContainer = document.getElementById('pp-synthesis-results');
    var rqContainer = document.getElementById('pp-rq-findings');
    var emergentContainer = document.getElementById('pp-emergent-findings');
    var themeSection = document.getElementById('pp-theme-summary');
    var themeBlocks = document.getElementById('pp-theme-blocks');
    var synthBtn = document.getElementById('btn-run-pp-synthesis');

    resultsContainer.classList.add('hidden');
    rqContainer.innerHTML = '';
    emergentContainer.innerHTML = '';
    themeSection.classList.add('hidden');
    themeBlocks.innerHTML = '';

    var logEl = document.getElementById('pp-synthesis-log');
    if (logEl) { logEl.innerHTML = ''; logEl.classList.add('hidden'); }

    // Set model dropdown to project default
    var fw = await Synth.db.getFramework(activeProjectId);
    var modelSelect = document.getElementById('pp-synth-model');
    if (fw && fw.default_synth_model) {
      modelSelect.value = fw.default_synth_model;
    } else {
      modelSelect.value = 'claude-sonnet-4-6';
    }

    var syntheses = await Synth.db.getSessionSynthesesByParticipant(displayId);
    var synthesis = syntheses.find(function (s) { return s.project_id === activeProjectId; });

    if (!synthesis) {
      synthBtn.textContent = 'Run Synthesis';
      showStatus('pp-synthesis-status', '', '');
      return;
    }

    synthBtn.textContent = 'Re-run Synthesis';

    // Build RQ label map from already-loaded framework
    var rqMap = {};
    if (fw && fw.research_questions) {
      fw.research_questions.forEach(function (rq) { rqMap[rq.rq_id] = rq.label; });
    }

    // Render RQ findings
    (synthesis.rq_findings || []).forEach(function (rqGroup) {
      var section = document.createElement('div');
      section.className = 'rq-findings-section';

      var header = document.createElement('div');
      header.className = 'theme-rq-header';
      header.innerHTML =
        '<div class="theme-rq-label">' + escapeHtml(rqMap[rqGroup.rq_id] || rqGroup.rq_id) + '</div>';
      section.appendChild(header);

      (rqGroup.findings || []).forEach(function (f) {
        section.appendChild(renderFindingCard(f, participant));
      });

      rqContainer.appendChild(section);
    });

    // Render emergent findings
    if (synthesis.emergent_findings && synthesis.emergent_findings.length > 0) {
      var emergentSection = document.createElement('div');
      emergentSection.className = 'rq-findings-section';

      var emergentHeader = document.createElement('div');
      emergentHeader.className = 'theme-rq-header';
      emergentHeader.innerHTML =
        '<div class="theme-rq-id">Emergent</div>' +
        '<div class="theme-rq-label">Findings not mapped to a research question</div>';
      emergentSection.appendChild(emergentHeader);

      synthesis.emergent_findings.forEach(function (f) {
        emergentSection.appendChild(renderFindingCard(f, participant));
      });

      emergentContainer.appendChild(emergentSection);
    }

    // Render theme blocks for this participant
    var themes = await Synth.db.getThemesByProject(activeProjectId);
    var participantThemes = [];
    themes.forEach(function (t) {
      if (t.supporting_evidence) {
        var evidence = t.supporting_evidence.filter(function (ev) { return ev.participant_id === displayId; });
        if (evidence.length > 0) {
          participantThemes.push({ theme: t, evidence: evidence });
        }
      }
    });

    if (participantThemes.length > 0) {
      themeSection.classList.remove('hidden');
      participantThemes.forEach(function (item) {
        var block = document.createElement('button');
        block.className = 'theme-block';
        block.textContent = item.theme.label;
        block.addEventListener('click', function () {
          showQuoteInContext(currentParticipantId, item.theme, item.evidence[0]);
        });
        themeBlocks.appendChild(block);
      });
    }

    resultsContainer.classList.remove('hidden');
    showStatus('pp-synthesis-status', 'success', 'Synthesised ' + new Date(synthesis.synthesised_at).toLocaleString());
  }

  function renderFindingCard(finding, participant) {
    var card = document.createElement('div');
    card.className = 'finding-card';

    var matchHtml = '';
    if (finding.theme_match) {
      matchHtml = '<div class="finding-match"><span class="match-tag">' + escapeHtml(finding.theme_match) + '</span> ' + escapeHtml(finding.theme_match_rationale || '') + '</div>';
    } else {
      matchHtml = '<div class="finding-match"><span class="match-tag new-tag">New theme</span> ' + escapeHtml(finding.theme_match_rationale || '') + '</div>';
    }

    card.innerHTML =
      '<div class="finding-label">' + escapeHtml(finding.label) + '</div>' +
      '<div class="finding-analysis">' + escapeHtml(finding.analysis || '') + '</div>' +
      matchHtml +
      '<div class="finding-evidence"></div>';

    var evidenceContainer = card.querySelector('.finding-evidence');
    (finding.supporting_evidence || []).forEach(function (ev) {
      var item = document.createElement('div');
      item.className = 'evidence-item';
      var vClass = ev.verification_status || 'pending';
      item.innerHTML =
        '<div class="evidence-quote">"' + escapeHtml(ev.quote) + '"</div>' +
        '<div class="evidence-meta">' + escapeHtml(ev.speaker || '') + ' at ' + escapeHtml(ev.timestamp || '') +
        '<span class="evidence-verification ' + vClass + '">' + vClass + '</span></div>';
      item.addEventListener('click', function () {
        showQuoteInContextByEvidence(participant, finding.label, ev);
      });
      evidenceContainer.appendChild(item);
    });

    return card;
  }

  async function showQuoteInContextByEvidence(participant, findingLabel, evidence) {
    if (!participant || !participant.transcript_id) return;
    var tx = await Synth.db.getTranscript(participant.transcript_id);
    if (!tx) return;

    var displayId = participant.display_id || participant.participant_id;
    document.getElementById('quote-modal-title').textContent = findingLabel + ' — ' + displayId;
    var body = document.getElementById('quote-modal-body');
    body.innerHTML = '';

    var highlightIndex = -1;
    var quote = evidence.quote || '';

    if (quote) {
      for (var i = 0; i < tx.turns.length; i++) {
        if (tx.turns[i].content.indexOf(quote.substring(0, 50)) !== -1) {
          highlightIndex = i;
          break;
        }
      }
    }

    tx.turns.forEach(function (t, i) {
      var role = tx.speaker_roles[t.speaker] || 'unassigned';
      var div = document.createElement('div');
      div.className = 'turn role-' + role + (i === highlightIndex ? ' quote-highlight' : '');
      div.dataset.index = i;
      div.innerHTML =
        '<div class="turn-header">' + escapeHtml(t.speaker) +
        '<span class="turn-timestamp">' + escapeHtml(t.timestamp) + '</span></div>' +
        '<div class="turn-content">' + escapeHtml(t.content) + '</div>';
      body.appendChild(div);
    });

    document.getElementById('quote-modal').classList.remove('hidden');

    if (highlightIndex >= 0) {
      setTimeout(function () {
        var el = body.querySelector('.quote-highlight');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    document.getElementById('btn-close-quote-modal').onclick = function () {
      document.getElementById('quote-modal').classList.add('hidden');
    };
    document.getElementById('quote-modal').onclick = function (e) {
      if (e.target === this) this.classList.add('hidden');
    };
  }

  async function saveParticipantDetails() {
    var ppId = document.getElementById('pp-detail-id').value.trim();
    if (!ppId || !activeProjectId) return;

    if (isNewParticipant) {
      var storageKey = activeProjectId + '_' + ppId;
      var participant = {
        participant_id: storageKey,
        display_id: ppId,
        project_id: activeProjectId,
        real_name: document.getElementById('pp-detail-name').value.trim(),
        description: document.getElementById('pp-detail-desc').value.trim(),
        group_id: document.getElementById('pp-detail-group').value || null,
        transcript_id: null,
        synthesis_status: 'pending',
        created: new Date().toISOString()
      };
      await Synth.db.saveParticipant(participant);
      currentParticipantId = storageKey;
      isNewParticipant = false;

      document.getElementById('pp-detail-id').disabled = true;
      document.getElementById('participant-subpage-title').textContent = ppId;
      document.getElementById('subpage-upload-pp-id').textContent = ppId;
      updateSubpageAccess(participant);
      showStatus('pp-detail-status', 'success', 'Participant saved. You can now upload a transcript.');
    } else {
      var participant = await Synth.db.getParticipant(currentParticipantId);
      if (!participant) return;
      participant.real_name = document.getElementById('pp-detail-name').value.trim();
      participant.description = document.getElementById('pp-detail-desc').value.trim();
      participant.group_id = document.getElementById('pp-detail-group').value || null;
      await Synth.db.saveParticipant(participant);
      showStatus('pp-detail-status', 'success', 'Details updated.');
    }
  }

  function backToParticipantList() {
    document.getElementById('participant-subpages').classList.add('hidden');
    document.getElementById('participant-list-card').classList.remove('hidden');
    currentParticipantId = null;
    isNewParticipant = false;
    showSynthesisControlsIfNeeded();
    refreshParticipantList();
  }

  async function handleFile(fileList) {
    var files = Array.from(fileList).filter(function (f) { return f.name.toLowerCase().endsWith('.docx'); });
    if (files.length === 0) { showStatus('subpage-upload-status', 'error', 'Please select a .docx file.'); return; }

    var file = files[0];
    showStatus('subpage-upload-status', 'info', 'Parsing ' + file.name + '…');

    try {
      var result = await Synth.parser.parseDocx(file);

      var facNames = [];
      if (activeProjectId) {
        var fw = await Synth.db.getFramework(activeProjectId);
        if (fw) facNames = fw.facilitator_names || [];
      }

      pendingParse = { file: file, result: result, speakers: null };
      showStatus('subpage-upload-status', 'success', 'Parsed ' + result.turns.length + ' speaker turns. De-identify before saving.');

      document.getElementById('subpage-transcript-upload').classList.add('hidden');

      Synth.deidentify.show(
        pendingParse,
        facNames,
        activeProjectId,
        async function (deidentifiedResult) {
          await finishTranscriptSave(deidentifiedResult);
        },
        function () {
          pendingParse = null;
          document.getElementById('subpage-deidentify').classList.add('hidden');
          document.getElementById('subpage-transcript-upload').classList.remove('hidden');
          showStatus('subpage-upload-status', 'info', 'De-identification cancelled.');
        }
      );
    } catch (e) {
      showStatus('subpage-upload-status', 'error', 'Failed to parse ' + file.name + ': ' + e.message);
    }
  }

  async function finishTranscriptSave(deidentifiedResult) {
    var storageKey = currentParticipantId;
    var file = pendingParse.file;

    var roleMap = Synth.deidentify.getRoleAssignments();
    var participant = await Synth.db.getParticipant(storageKey);
    var displayId = participant ? (participant.display_id || storageKey) : storageKey;

    var transcript = {
      transcript_id: 'tx_' + Date.now(),
      project_id: activeProjectId || '',
      filename: file.name,
      participant_id: displayId,
      participant_group: participant ? participant.group_id : null,
      metadata: pendingParse.result.metadata,
      turns: deidentifiedResult.turns,
      raw_text: deidentifiedResult.raw_text,
      speaker_roles: roleMap,
      status: 'uploaded',
      created: new Date().toISOString()
    };

    if (participant) {
      participant.transcript_id = transcript.transcript_id;
      await Synth.db.saveParticipant(participant);
    }

    await Synth.db.saveTranscript(transcript);
    pendingParse = null;

    // Update sub-page state
    updateSubpageAccess(participant);
    await loadTranscriptView(participant);
    showStatus('subpage-upload-status', '', '');
  }

  async function runParticipantSynthesis() {
    if (!currentParticipantId || !activeProjectId) return;
    if (!Synth.api.hasCredentials()) {
      showStatus('pp-synthesis-status', 'error', 'Configure your API credentials in Settings first.');
      return;
    }

    var participant = await Synth.db.getParticipant(currentParticipantId);
    if (!participant || !participant.transcript_id) {
      showStatus('pp-synthesis-status', 'error', 'No transcript found. Upload one first.');
      return;
    }

    var transcript = await Synth.db.getTranscript(participant.transcript_id);
    if (!transcript) {
      showStatus('pp-synthesis-status', 'error', 'Transcript not found in database.');
      return;
    }

    var framework = await Synth.db.getFramework(activeProjectId);
    if (!framework) {
      showStatus('pp-synthesis-status', 'error', 'No research framework found. Set one up in the Project Info tab.');
      return;
    }

    var btn = document.getElementById('btn-run-pp-synthesis');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Running…';

    var modelSelect = document.getElementById('pp-synth-model');
    var modelOverride = modelSelect.value || null;

    var themes = await Synth.db.getThemesByProject(activeProjectId);

    var logEl = document.getElementById('pp-synthesis-log');
    logEl.innerHTML = '';
    logEl.classList.remove('hidden');
    showStatus('pp-synthesis-status', '', '');
    var activeLine = null;

    var result = await Synth.pipeline.processTranscript(transcript, framework, themes, function (msg, type) {
      if (type === 'step') {
        if (activeLine) {
          activeLine.classList.remove('active');
          activeLine.classList.add('done');
        }
        activeLine = document.createElement('div');
        activeLine.className = 'log-line active';
        activeLine.textContent = msg;
        logEl.appendChild(activeLine);
        logEl.scrollTop = logEl.scrollHeight;
      } else if (type === 'update') {
        if (activeLine) {
          activeLine.setAttribute('data-label', activeLine.getAttribute('data-label') || activeLine.textContent);
          activeLine.textContent = activeLine.getAttribute('data-label') + ' — ' + msg;
        }
      } else if (type === 'done') {
        if (activeLine) {
          activeLine.classList.remove('active');
          activeLine.classList.add('done');
          activeLine.textContent = msg;
          activeLine = null;
        }
      } else if (type === 'error') {
        if (activeLine) {
          activeLine.classList.remove('active');
          activeLine.classList.add('error');
          activeLine.textContent = msg;
          activeLine = null;
        }
      }
    }, modelOverride);

    btn.disabled = false;

    if (result.success) {
      participant.synthesis_status = 'synthesised';
      await Synth.db.saveParticipant(participant);
      transcript.status = 'processed';
      await Synth.db.saveTranscript(transcript);
      btn.textContent = 'Re-run Synthesis';

      var summary = (result.stats.themes_new || 0) + ' new theme(s), ' +
        (result.stats.themes_updated || 0) + ' updated, ' +
        (result.stats.quotes_total || 0) + ' quote(s).';
      if (result.flagged) summary += ' FLAGGED for review.';
      showStatus('pp-synthesis-status', 'success', summary);

      await loadSynthesisView(participant);
    } else {
      participant.synthesis_status = 'failed';
      await Synth.db.saveParticipant(participant);
      btn.textContent = 'Run Synthesis';
      showStatus('pp-synthesis-status', 'error', result.error);
    }
  }

  // ========== Inquiry ==========

  async function submitInquiry() {
    if (!currentParticipantId || !activeProjectId) return;

    var question = document.getElementById('inquiry-input').value.trim();
    if (!question) {
      showStatus('inquiry-status', 'error', 'Please enter a question.');
      return;
    }

    if (!Synth.api.hasCredentials()) {
      showStatus('inquiry-status', 'error', 'Configure your API credentials in Settings first.');
      return;
    }

    var participant = await Synth.db.getParticipant(currentParticipantId);
    if (!participant || !participant.transcript_id) {
      showStatus('inquiry-status', 'error', 'No transcript found for this participant.');
      return;
    }

    var transcript = await Synth.db.getTranscript(participant.transcript_id);
    if (!transcript) {
      showStatus('inquiry-status', 'error', 'Transcript not found in database.');
      return;
    }

    var framework = await Synth.db.getFramework(activeProjectId);
    var displayId = participant.display_id || participant.participant_id;
    var participantKey = activeProjectId + '_' + displayId;

    var btn = document.getElementById('btn-submit-inquiry');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Asking…';
    showStatus('inquiry-status', 'info', 'Sending question…');

    try {
      var userPrompt = Synth.prompts.buildInquiryUser(framework || {}, transcript.raw_text, displayId, question);
      var result = await Synth.api.chatCompletion('claude-sonnet-4-6', [
        { role: 'system', content: Synth.prompts.INQUIRY_SYSTEM },
        { role: 'user', content: userPrompt }
      ], { max_tokens: 4096, temperature: 0 });

      var inquiry = {
        inquiry_id: 'inq_' + Date.now(),
        participant_key: participantKey,
        project_id: activeProjectId,
        participant_id: displayId,
        question: question,
        response: result.content,
        model: result.model || 'claude-sonnet-4-6',
        created: new Date().toISOString()
      };

      await Synth.db.saveInquiry(inquiry);
      document.getElementById('inquiry-input').value = '';
      showStatus('inquiry-status', 'success', 'Response received.');
      await loadInquiryHistory(participantKey);
    } catch (e) {
      showStatus('inquiry-status', 'error', 'Inquiry failed: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ask';
    }
  }

  async function loadInquiryHistory(participantKey) {
    var container = document.getElementById('inquiry-history');
    var emptyMsg = document.getElementById('inquiry-empty');
    container.innerHTML = '';

    var inquiries = await Synth.db.getInquiriesByParticipant(participantKey);
    inquiries.sort(function (a, b) { return new Date(b.created) - new Date(a.created); });

    if (inquiries.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }

    emptyMsg.classList.add('hidden');
    inquiries.forEach(function (inq) {
      container.appendChild(renderInquiryCard(inq));
    });
  }

  function renderInquiryCard(inquiry) {
    var card = document.createElement('div');
    card.className = 'inquiry-card';

    var date = new Date(inquiry.created);
    var timeStr = date.toLocaleString();

    card.innerHTML =
      '<div class="inquiry-question-row">' +
        '<strong>Q:</strong> ' + escapeHtml(inquiry.question) +
        '<button class="btn btn-danger btn-sm inquiry-delete-btn" data-inquiry-id="' + escapeHtml(inquiry.inquiry_id) + '" title="Delete">×</button>' +
      '</div>' +
      '<div class="inquiry-response">' + formatMarkdown(inquiry.response) + '</div>' +
      '<div class="inquiry-meta">' + escapeHtml(timeStr) + ' · ' + escapeHtml(inquiry.model || '') + '</div>';

    card.querySelector('.inquiry-delete-btn').addEventListener('click', async function () {
      if (confirm('Delete this inquiry?')) {
        await Synth.db.deleteInquiry(inquiry.inquiry_id);
        var participant = await Synth.db.getParticipant(currentParticipantId);
        var displayId = participant ? (participant.display_id || currentParticipantId) : currentParticipantId;
        var participantKey = activeProjectId + '_' + displayId;
        await loadInquiryHistory(participantKey);
      }
    });

    return card;
  }

  function formatMarkdown(text) {
    if (!text) return '';
    var escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
  }

  async function refreshParticipantList() {
    if (!activeProjectId) return;

    var participants = await Synth.db.getParticipantsByProject(activeProjectId);
    var container = document.getElementById('participant-list');
    var empty = document.getElementById('participants-empty');

    if (participants.length === 0) {
      container.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');
    container.innerHTML = '';

    var themes = await Synth.db.getThemesByProject(activeProjectId);

    participants.forEach(function (p) {
      var displayId = p.display_id || p.participant_id;
      var themeCount = 0;
      themes.forEach(function (t) {
        if (t.supporting_evidence) {
          var hasEvidence = t.supporting_evidence.some(function (ev) { return ev.participant_id === displayId; });
          if (hasEvidence) themeCount++;
        }
      });

      var statusClass = 'status-pending';
      var statusText = 'No transcript';
      if (p.synthesis_status === 'synthesised') {
        statusClass = 'status-synthesised';
        statusText = 'Synthesised';
      } else if (p.synthesis_status === 'failed') {
        statusClass = 'status-failed';
        statusText = 'Failed';
      } else if (p.transcript_id) {
        statusClass = 'status-uploaded';
        statusText = 'Transcript uploaded';
      }

      var metaParts = [];
      if (p.real_name) metaParts.push(p.real_name);
      if (p.description) metaParts.push(p.description);

      var div = document.createElement('div');
      div.className = 'participant-item';
      div.innerHTML =
        '<div class="participant-info" data-id="' + escapeHtml(p.participant_id) + '">' +
          '<div class="participant-id">' + escapeHtml(displayId) + '</div>' +
          (metaParts.length ? '<div class="participant-meta">' + escapeHtml(metaParts.join(' — ')) + '</div>' : '') +
        '</div>' +
        '<span class="participant-status ' + statusClass + '">' + statusText + '</span>' +
        (themeCount > 0 ? '<span class="badge badge-count">' + themeCount + ' themes</span>' : '') +
        '<div class="participant-actions">' +
          '<button class="btn btn-secondary btn-sm" data-action="view-participant" data-id="' + escapeHtml(p.participant_id) + '">View</button>' +
          '<button class="btn btn-danger btn-sm" data-action="delete-participant" data-id="' + escapeHtml(p.participant_id) + '">Delete</button>' +
        '</div>';
      container.appendChild(div);
    });

    container.onclick = handleParticipantAction;
    showSynthesisControlsIfNeeded();
  }

  async function handleParticipantAction(e) {
    var btn = e.target.closest('[data-action]');
    var infoEl = e.target.closest('.participant-info');

    if (btn) {
      var id = btn.dataset.id;
      if (btn.dataset.action === 'view-participant') {
        await openParticipantSubpages(id);
      } else if (btn.dataset.action === 'delete-participant') {
        if (confirm('Delete this participant? This will also delete their transcript and synthesis.')) {
          var participant = await Synth.db.getParticipant(id);
          if (participant && participant.transcript_id) {
            await Synth.db.deleteTranscript(participant.transcript_id);
          }
          var displayId = participant ? (participant.display_id || id) : id;
          var synthId = activeProjectId + '_' + displayId;
          await Synth.db.deleteSessionSynthesis(synthId).catch(function () {});
          var participantKey = activeProjectId + '_' + displayId;
          var inquiries = await Synth.db.getInquiriesByParticipant(participantKey);
          for (var q = 0; q < inquiries.length; q++) {
            await Synth.db.deleteInquiry(inquiries[q].inquiry_id);
          }
          await Synth.db.deleteParticipant(id);
          await refreshParticipantList();
        }
      }
    } else if (infoEl) {
      await openParticipantSubpages(infoEl.dataset.id);
    }
  }

  async function showQuoteInContext(ppId, theme, evidence) {
    var participant = await Synth.db.getParticipant(ppId);
    if (!participant || !participant.transcript_id) return;

    var tx = await Synth.db.getTranscript(participant.transcript_id);
    if (!tx) return;

    var displayId = participant.display_id || participant.participant_id;
    document.getElementById('quote-modal-title').textContent = theme.label + ' — ' + displayId;
    var body = document.getElementById('quote-modal-body');
    body.innerHTML = '';

    var highlightIndex = -1;
    var quote = evidence.quote || '';

    if (quote) {
      for (var i = 0; i < tx.turns.length; i++) {
        if (tx.turns[i].content.indexOf(quote.substring(0, 50)) !== -1) {
          highlightIndex = i;
          break;
        }
      }
    }

    tx.turns.forEach(function (t, i) {
      var role = tx.speaker_roles[t.speaker] || 'unassigned';
      var div = document.createElement('div');
      div.className = 'turn role-' + role + (i === highlightIndex ? ' quote-highlight' : '');
      div.dataset.index = i;
      div.innerHTML =
        '<div class="turn-header">' + escapeHtml(t.speaker) +
        '<span class="turn-timestamp">' + escapeHtml(t.timestamp) + '</span></div>' +
        '<div class="turn-content">' + escapeHtml(t.content) + '</div>';
      body.appendChild(div);
    });

    document.getElementById('quote-modal').classList.remove('hidden');

    if (highlightIndex >= 0) {
      setTimeout(function () {
        var el = body.querySelector('.quote-highlight');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    document.getElementById('btn-close-quote-modal').onclick = function () {
      document.getElementById('quote-modal').classList.add('hidden');
    };
    document.getElementById('quote-modal').onclick = function (e) {
      if (e.target === this) this.classList.add('hidden');
    };
  }

  function renderTranscriptPreviewInto(container, turns, speakerRoles) {
    container.innerHTML = '';
    turns.forEach(function (t) {
      var role = speakerRoles[t.speaker] || 'unassigned';
      var div = document.createElement('div');
      div.className = 'turn role-' + role;
      div.innerHTML =
        '<div class="turn-header">' + escapeHtml(t.speaker) +
        '<span class="turn-timestamp">' + escapeHtml(t.timestamp) + '</span></div>' +
        '<div class="turn-content">' + escapeHtml(t.content) + '</div>';
      container.appendChild(div);
    });
  }

  async function showSynthesisControlsIfNeeded() {
    if (!activeProjectId) return;
    if (currentParticipantId || isNewParticipant) return;
    var transcripts = await Synth.db.getTranscriptsByProject(activeProjectId);
    var hasPending = transcripts.some(function (t) { return t.status === 'uploaded'; });
    var card = document.getElementById('synthesis-controls-card');
    if (hasPending) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }
  }

  // ========== Synthesis ==========

  var synthesisRunning = false;

  function initSynthesisControls() {
    document.getElementById('btn-run-synthesis').addEventListener('click', runSynthesis);
  }

  async function runSynthesis() {
    if (!activeProjectId) {
      showStatus('synthesis-status', 'error', 'No project selected.');
      return;
    }
    if (!Synth.api.hasCredentials()) {
      showStatus('synthesis-status', 'error', 'Configure your API credentials in Settings first.');
      return;
    }
    if (synthesisRunning) return;
    synthesisRunning = true;

    var btn = document.getElementById('btn-run-synthesis');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Running…';

    var logCard = document.getElementById('synthesis-log-card');
    var logDiv = document.getElementById('synthesis-log');
    var progressCard = document.getElementById('synthesis-progress-card');
    var progressDiv = document.getElementById('synthesis-progress');

    logCard.classList.remove('hidden');
    progressCard.classList.remove('hidden');
    logDiv.innerHTML = '';
    progressDiv.innerHTML = '<div class="progress-bar"><div class="progress-bar-fill" id="synth-bar" style="width:0%"></div></div><div class="progress-text" id="synth-progress-text">Starting…</div>';

    showStatus('synthesis-status', 'info', 'Synthesis running…');

    await Synth.pipeline.processAll(
      activeProjectId,
      function (current, total, pid, msg) {
        var pct = Math.round((current - 1) / total * 100);
        var bar = document.getElementById('synth-bar');
        var text = document.getElementById('synth-progress-text');
        if (bar) bar.style.width = pct + '%';
        if (text) text.textContent = 'Transcript ' + current + ' of ' + total + ' (' + pid + '): ' + msg;

        addLogEntry(pid, msg);
      },
      async function (stats) {
        var bar = document.getElementById('synth-bar');
        if (bar) bar.style.width = '100%';

        if (stats.message) {
          showStatus('synthesis-status', 'warning', stats.message);
        } else {
          var summary = stats.processed + ' of ' + stats.total + ' transcript(s) processed.';
          if (stats.flagged > 0) summary += ' ' + stats.flagged + ' flagged for review.';
          if (stats.failed > 0) summary += ' ' + stats.failed + ' failed.';
          showStatus('synthesis-status', stats.failed > 0 ? 'warning' : 'success', summary);
        }

        // Update participant synthesis statuses
        var participants = await Synth.db.getParticipantsByProject(activeProjectId);
        var transcripts = await Synth.db.getTranscriptsByProject(activeProjectId);
        for (var i = 0; i < participants.length; i++) {
          var pp = participants[i];
          if (pp.transcript_id) {
            var ptx = transcripts.find(function (t) { return t.transcript_id === pp.transcript_id; });
            if (ptx && ptx.status === 'processed') {
              pp.synthesis_status = 'synthesised';
              await Synth.db.saveParticipant(pp);
            } else if (ptx && ptx.status === 'failed') {
              pp.synthesis_status = 'failed';
              await Synth.db.saveParticipant(pp);
            }
          }
        }

        synthesisRunning = false;
        btn.disabled = false;
        btn.textContent = 'Synthesise All Pending';
        await refreshParticipantList();

        var allThemes = await Synth.db.getThemesByProject(activeProjectId);
        if (allThemes.length > 30) {
          var nudge = document.getElementById('synthesis-theme-nudge');
          var nudgeText = document.getElementById('synthesis-nudge-text');
          nudgeText.textContent = 'You have ' + allThemes.length + ' themes. Consider reviewing to consolidate related findings.';
          nudge.classList.remove('hidden');
        }
      }
    );
  }

  function addLogEntry(pid, msg) {
    var logDiv = document.getElementById('synthesis-log');
    var entry = document.createElement('div');
    var cls = 'log-entry';
    if (msg.indexOf('FAILED') !== -1) cls += ' log-error';
    else if (msg.indexOf('Done') !== -1) cls += ' log-success';
    else if (msg.indexOf('FLAGGED') !== -1 || msg.indexOf('fabricated') !== -1) cls += ' log-warning';

    entry.className = cls;
    entry.innerHTML = '<span class="log-label">' + escapeHtml(pid) + '</span><span class="log-msg">' + escapeHtml(msg) + '</span>';
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  // ========== Themes Tab ==========

  function initThemesTab() {
    document.getElementById('theme-filter-source').addEventListener('change', refreshThemes);
    document.getElementById('theme-filter-rq').addEventListener('change', refreshThemes);
    document.getElementById('theme-sort').addEventListener('change', refreshThemes);
    document.getElementById('btn-merge-themes').addEventListener('click', mergeSelectedThemes);
    document.getElementById('btn-cancel-merge').addEventListener('click', function () {
      selectedThemes.clear();
      refreshThemes();
    });
    document.getElementById('btn-review-themes').addEventListener('click', startThemeReview);
    document.getElementById('btn-close-review').addEventListener('click', closeThemeReview);
  }

  function initNudges() {
    document.getElementById('btn-synthesis-nudge-review').addEventListener('click', function () {
      Synth.app.switchTab('themes');
      startThemeReview();
    });
    document.getElementById('btn-dismiss-synthesis-nudge').addEventListener('click', function () {
      document.getElementById('synthesis-theme-nudge').classList.add('hidden');
    });
    document.getElementById('btn-export-nudge-review').addEventListener('click', function () {
      Synth.app.switchTab('themes');
      startThemeReview();
    });
    document.getElementById('btn-dismiss-export-nudge').addEventListener('click', function () {
      document.getElementById('export-theme-nudge').classList.add('hidden');
    });
  }

  async function refreshThemes() {
    if (!activeProjectId) {
      document.getElementById('themes-empty').classList.remove('hidden');
      document.getElementById('theme-cards').innerHTML = '';
      document.getElementById('theme-summary').textContent = '';
      return;
    }

    var themes = await Synth.db.getThemesByProject(activeProjectId);
    var filterSource = document.getElementById('theme-filter-source').value;
    var filterRq = document.getElementById('theme-filter-rq').value;
    var sortBy = document.getElementById('theme-sort').value;

    if (filterSource) themes = themes.filter(function (t) { return t.source === filterSource; });
    if (filterRq) themes = themes.filter(function (t) { return t.rq_mappings && t.rq_mappings.includes(filterRq); });

    themes = sortThemes(themes, sortBy);

    var emptyEl = document.getElementById('themes-empty');
    if (themes.length === 0) {
      emptyEl.classList.remove('hidden');
      document.getElementById('theme-cards').innerHTML = '';
      document.getElementById('theme-summary').textContent = '';
      return;
    }
    emptyEl.classList.add('hidden');

    var totalEvidence = themes.reduce(function (sum, t) { return sum + (t.supporting_evidence ? t.supporting_evidence.length : 0); }, 0);
    document.getElementById('theme-summary').textContent =
      themes.length + ' theme(s), ' + totalEvidence + ' piece(s) of evidence';

    var fw = await Synth.db.getFramework(activeProjectId);
    renderThemeCards(themes, fw);
    updateMergeBar();

    var allThemes = await Synth.db.getThemesByProject(activeProjectId);
    var reviewSection = document.getElementById('theme-review-section');
    if (reviewSection) reviewSection.style.display = allThemes.length >= 20 ? '' : 'none';
  }

  function sortThemes(themes, sortBy) {
    switch (sortBy) {
      case 'participants':
        return themes.sort(function (a, b) { return getParticipantCount(b) - getParticipantCount(a); });
      case 'sessions':
        return themes.sort(function (a, b) { return getSessionCount(b) - getSessionCount(a); });
      case 'label':
        return themes.sort(function (a, b) { return a.label.localeCompare(b.label); });
      case 'first_seen':
        return themes.sort(function (a, b) { return (a.first_seen || '').localeCompare(b.first_seen || ''); });
      default:
        return themes;
    }
  }

  function getParticipantCount(theme) {
    if (!theme.supporting_evidence) return 0;
    return new Set(theme.supporting_evidence.map(function (e) { return e.participant_id; })).size;
  }

  function getSessionCount(theme) {
    if (!theme.supporting_evidence) return 0;
    return new Set(theme.supporting_evidence.map(function (e) { return e.session_id; })).size;
  }

  function renderThemeCards(themes, framework) {
    var container = document.getElementById('theme-cards');
    container.innerHTML = '';

    var hasRqs = framework && framework.research_questions && framework.research_questions.length > 0;
    var filterRq = document.getElementById('theme-filter-rq').value;

    if (hasRqs) {
      cachedRqMap = {};
      framework.research_questions.forEach(function (rq) { cachedRqMap[rq.rq_id] = rq.label; });
    }

    if (hasRqs && !filterRq) {
      var rqMap = cachedRqMap;

      var grouped = {};
      var unmapped = [];
      themes.forEach(function (theme) {
        var mapped = false;
        (theme.rq_mappings || []).forEach(function (rqId) {
          if (!grouped[rqId]) grouped[rqId] = [];
          grouped[rqId].push(theme);
          mapped = true;
        });
        if (!mapped) unmapped.push(theme);
      });

      framework.research_questions.forEach(function (rq) {
        var rqThemes = grouped[rq.rq_id];
        if (!rqThemes || rqThemes.length === 0) return;

        var header = document.createElement('div');
        header.className = 'theme-rq-header';
        header.innerHTML =
          '<div class="theme-rq-label">' + escapeHtml(rq.label) + '</div>';
        container.appendChild(header);

        rqThemes.forEach(function (theme) {
          container.appendChild(buildThemeCard(theme));
        });
      });

      if (unmapped.length > 0) {
        var header = document.createElement('div');
        header.className = 'theme-rq-header';
        header.innerHTML =
          '<div class="theme-rq-id">Emergent</div>' +
          '<div class="theme-rq-label">Themes not mapped to a research question</div>';
        container.appendChild(header);

        unmapped.forEach(function (theme) {
          container.appendChild(buildThemeCard(theme));
        });
      }
      return;
    }

    themes.forEach(function (theme) {
      container.appendChild(buildThemeCard(theme));
    });
  }

  function buildThemeCard(theme) {
      var card = document.createElement('div');
      card.className = 'theme-card' + (selectedThemes.has(theme.theme_id) ? ' selected' : '');
      card.dataset.id = theme.theme_id;

      var pCount = getParticipantCount(theme);
      var sCount = getSessionCount(theme);
      var eCount = theme.supporting_evidence ? theme.supporting_evidence.length : 0;

      var badgeClass = 'badge-' + theme.source;
      var rqLabels = (theme.rq_mappings || []).map(function (id) { return cachedRqMap[id] || id; }).join(', ');

      card.innerHTML =
        '<div class="theme-card-header">' +
          '<span class="theme-label">' + escapeHtml(theme.label) + '</span>' +
          '<div class="theme-badges">' +
            '<span class="badge ' + badgeClass + '">' + theme.source + '</span>' +
            (pCount ? '<span class="badge badge-count">' + pCount + 'P / ' + sCount + 'S</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="theme-desc">' + escapeHtml(theme.current_description || '') + '</div>' +
        '<div class="theme-meta">' +
          '<span>' + eCount + ' quote(s)</span>' +
          (rqLabels ? '<span>RQ: ' + escapeHtml(rqLabels) + '</span>' : '') +
          '<span>First: ' + escapeHtml(theme.first_seen || '—') + '</span>' +
        '</div>' +
        '<div class="theme-evidence hidden"></div>';

      card.addEventListener('click', function (e) {
        if (e.shiftKey) {
          toggleThemeSelection(theme.theme_id, card);
        } else {
          toggleThemeExpand(theme, card);
        }
      });

      return card;
  }

  function toggleThemeExpand(theme, card) {
    var evidenceDiv = card.querySelector('.theme-evidence');
    if (evidenceDiv.classList.contains('hidden')) {
      evidenceDiv.classList.remove('hidden');
      evidenceDiv.innerHTML = '';

      if (!theme.supporting_evidence || theme.supporting_evidence.length === 0) {
        evidenceDiv.innerHTML = '<div class="text-secondary text-small">No evidence yet.</div>';
        return;
      }

      theme.supporting_evidence.forEach(function (ev) {
        var div = document.createElement('div');
        div.className = 'evidence-item clickable';
        var vClass = ev.verification_status || 'pending';
        div.innerHTML =
          '<div class="evidence-quote">"' + escapeHtml(ev.quote) + '"</div>' +
          '<div class="evidence-attr">' +
            escapeHtml(ev.speaker || '') + ' (' + escapeHtml(ev.participant_id || '') + ')' +
            ' at ' + escapeHtml(ev.timestamp || '') +
            '<span class="evidence-verification ' + vClass + '">' + vClass + '</span>' +
          '</div>';
        div.addEventListener('click', function (e) {
          e.stopPropagation();
          openQuoteFromTheme(theme, ev);
        });
        evidenceDiv.appendChild(div);
      });
    } else {
      evidenceDiv.classList.add('hidden');
    }
  }

  async function openQuoteFromTheme(theme, evidence) {
    if (!evidence.participant_id) return;

    var participants = await Synth.db.getParticipantsByProject(activeProjectId);
    var participant = participants.find(function (p) {
      return (p.display_id || p.participant_id) === evidence.participant_id;
    });

    if (!participant || !participant.transcript_id) return;

    var tx = await Synth.db.getTranscript(participant.transcript_id);
    if (!tx) return;

    document.getElementById('quote-modal-title').textContent = theme.label + ' — ' + evidence.participant_id;
    var body = document.getElementById('quote-modal-body');
    body.innerHTML = '';

    var highlightIndex = -1;
    var quote = evidence.quote || '';

    if (quote) {
      for (var i = 0; i < tx.turns.length; i++) {
        if (tx.turns[i].content.indexOf(quote.substring(0, 50)) !== -1) {
          highlightIndex = i;
          break;
        }
      }
    }

    tx.turns.forEach(function (t, i) {
      var role = tx.speaker_roles[t.speaker] || 'unassigned';
      var div = document.createElement('div');
      div.className = 'turn role-' + role + (i === highlightIndex ? ' quote-highlight' : '');
      div.dataset.index = i;
      div.innerHTML =
        '<div class="turn-header">' + escapeHtml(t.speaker) +
        '<span class="turn-timestamp">' + escapeHtml(t.timestamp) + '</span></div>' +
        '<div class="turn-content">' + escapeHtml(t.content) + '</div>';
      body.appendChild(div);
    });

    document.getElementById('quote-modal').classList.remove('hidden');

    if (highlightIndex >= 0) {
      setTimeout(function () {
        var el = body.querySelector('.quote-highlight');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    document.getElementById('btn-close-quote-modal').onclick = function () {
      document.getElementById('quote-modal').classList.add('hidden');
    };
    document.getElementById('quote-modal').onclick = function (e) {
      if (e.target === this) this.classList.add('hidden');
    };
  }

  function toggleThemeSelection(themeId, card) {
    if (selectedThemes.has(themeId)) {
      selectedThemes.delete(themeId);
      card.classList.remove('selected');
    } else {
      if (selectedThemes.size >= 2) return;
      selectedThemes.add(themeId);
      card.classList.add('selected');
    }
    updateMergeBar();
  }

  function updateMergeBar() {
    var bar = document.getElementById('merge-bar');
    if (selectedThemes.size === 2) {
      document.getElementById('merge-label').textContent = '2 themes selected for merge';
      bar.classList.remove('hidden');
    } else if (selectedThemes.size === 1) {
      document.getElementById('merge-label').textContent = '1 theme selected — shift-click another to merge';
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  }

  async function mergeSelectedThemes() {
    if (selectedThemes.size !== 2) return;
    var ids = Array.from(selectedThemes);
    var theme1 = await Synth.db.getTheme(ids[0]);
    var theme2 = await Synth.db.getTheme(ids[1]);
    if (!theme1 || !theme2) return;

    var mergedLabel = prompt('Enter label for merged theme:', theme1.label + ' + ' + theme2.label);
    if (!mergedLabel) return;

    var mergedDesc = prompt('Enter description for merged theme:',
      theme1.current_description + ' ' + theme2.current_description);
    if (mergedDesc === null) return;

    await Synth.pipeline.applyThemeMerge(activeProjectId, ids, mergedLabel, mergedDesc);
    selectedThemes.clear();
    await refreshThemes();
  }

  // ========== Theme Review ==========

  async function startThemeReview() {
    if (!activeProjectId) return;
    if (!Synth.api.hasCredentials()) {
      showStatus('review-log', 'error', 'Configure your API credentials first.');
      return;
    }

    document.getElementById('theme-review-panel').classList.remove('hidden');
    document.getElementById('theme-cards').classList.add('hidden');
    document.getElementById('themes-empty').classList.add('hidden');
    document.getElementById('merge-bar').classList.add('hidden');

    var logEl = document.getElementById('review-log');
    logEl.innerHTML = '';
    logEl.classList.remove('hidden');
    document.getElementById('review-summary').classList.add('hidden');
    document.getElementById('review-clusters').innerHTML = '';
    document.getElementById('review-weak-themes').classList.add('hidden');

    var activeLine = null;

    var result = await Synth.pipeline.reviewThemes(activeProjectId, function (msg, type) {
      if (type === 'step') {
        if (activeLine) { activeLine.classList.remove('active'); activeLine.classList.add('done'); }
        activeLine = document.createElement('div');
        activeLine.className = 'log-line active';
        activeLine.textContent = msg;
        logEl.appendChild(activeLine);
        logEl.scrollTop = logEl.scrollHeight;
      } else if (type === 'update') {
        if (activeLine) {
          activeLine.setAttribute('data-label', activeLine.getAttribute('data-label') || activeLine.textContent);
          activeLine.textContent = activeLine.getAttribute('data-label') + ' — ' + msg;
        }
      } else if (type === 'done') {
        if (activeLine) { activeLine.classList.remove('active'); activeLine.classList.add('done'); activeLine.textContent = msg; activeLine = null; }
      } else if (type === 'error') {
        if (activeLine) { activeLine.classList.remove('active'); activeLine.classList.add('error'); activeLine.textContent = msg; activeLine = null; }
      }
    });

    if (!result.success) {
      return;
    }

    if (result.summary) {
      var summaryEl = document.getElementById('review-summary');
      summaryEl.textContent = result.summary;
      summaryEl.classList.remove('hidden');
    }

    await renderReviewClusters(result.clusters);
    renderWeakThemes(result.weak_themes);
  }

  async function renderReviewClusters(clusters) {
    var container = document.getElementById('review-clusters');
    container.innerHTML = '';

    if (!clusters || clusters.length === 0) {
      container.innerHTML = '<div class="card"><p>No theme clusters identified. Your themes appear distinct.</p></div>';
      return;
    }

    for (var i = 0; i < clusters.length; i++) {
      var card = await buildClusterCard(clusters[i], i);
      container.appendChild(card);
    }
  }

  async function buildClusterCard(cluster, idx) {
    var card = document.createElement('div');
    card.className = 'cluster-card';

    var recClass = (cluster.recommendation || '').replace(/ /g, '_');
    var recLabel = cluster.recommendation === 'merge' ? 'Merge' :
                   cluster.recommendation === 'group' ? 'Group as Sub-themes' :
                   cluster.recommendation === 'keep_separate' ? 'Keep Separate' : cluster.recommendation;

    var html = '<span class="cluster-recommendation ' + escapeHtml(recClass) + '">' + escapeHtml(recLabel) + '</span>';
    html += '<span class="cluster-confidence">' + escapeHtml(cluster.confidence || '') + ' confidence</span>';
    html += '<div class="cluster-rationale">' + escapeHtml(cluster.rationale || '') + '</div>';

    html += '<div class="cluster-themes">';
    for (var i = 0; i < (cluster.theme_ids || []).length; i++) {
      var theme = await Synth.db.getTheme(cluster.theme_ids[i]);
      if (!theme) continue;
      var pCount = getParticipantCount(theme);
      var eCount = theme.supporting_evidence ? theme.supporting_evidence.length : 0;
      html += '<div class="cluster-theme-item">';
      html += '<div class="theme-label">' + escapeHtml(theme.label) + '</div>';
      html += '<div class="theme-desc">' + escapeHtml(theme.current_description || '') + '</div>';
      html += '<div class="theme-meta">' + pCount + ' participant(s), ' + eCount + ' quote(s)';
      if (theme.rq_mappings && theme.rq_mappings.length) html += ' · RQ: ' + theme.rq_mappings.map(function (id) { return cachedRqMap[id] || id; }).join(', ');
      html += '</div></div>';
    }
    html += '</div>';

    if (cluster.recommendation !== 'keep_separate' && cluster.suggested_label) {
      html += '<div class="cluster-suggestion">';
      html += '<strong>Suggested label:</strong> ' + escapeHtml(cluster.suggested_label) + '<br>';
      html += '<strong>Suggested description:</strong> ' + escapeHtml(cluster.suggested_description || '');
      html += '</div>';
    }

    html += '<div class="cluster-actions">';
    if (cluster.recommendation === 'merge') {
      html += '<button class="btn btn-primary btn-sm" data-action="merge">Accept Merge</button>';
      html += '<button class="btn btn-secondary btn-sm" data-action="reject">Keep Separate</button>';
    } else if (cluster.recommendation === 'group') {
      html += '<button class="btn btn-primary btn-sm" data-action="merge">Merge</button>';
      html += '<button class="btn btn-secondary btn-sm" data-action="reject">Keep Separate</button>';
    } else {
      html += '<button class="btn btn-secondary btn-sm" data-action="merge">Merge Anyway</button>';
      html += '<button class="btn btn-primary btn-sm" data-action="reject">Confirmed Separate</button>';
    }
    html += '<button class="btn btn-secondary btn-sm" data-action="skip">Skip</button>';
    html += '</div>';

    card.innerHTML = html;

    card.querySelector('[data-action="merge"]').addEventListener('click', function () {
      handleClusterMerge(cluster, card);
    });
    card.querySelector('[data-action="reject"]').addEventListener('click', function () {
      card.classList.add('resolved');
    });
    card.querySelector('[data-action="skip"]').addEventListener('click', function () {
      card.classList.add('resolved');
    });

    return card;
  }

  async function handleClusterMerge(cluster, card) {
    var label = cluster.suggested_label || cluster.theme_ids.join(' + ');
    var desc = cluster.suggested_description || '';

    var userLabel = prompt('Label for merged theme:', label);
    if (!userLabel) return;
    var userDesc = prompt('Description for merged theme:', desc);
    if (userDesc === null) return;

    try {
      var merged = await Synth.pipeline.applyThemeMerge(activeProjectId, cluster.theme_ids, userLabel, userDesc);
      if (merged) {
        card.classList.add('resolved');
      }
    } catch (e) {
      alert('Merge failed: ' + e.message);
    }
  }

  function renderWeakThemes(weakThemes) {
    var container = document.getElementById('review-weak-themes');
    var list = document.getElementById('review-weak-list');
    list.innerHTML = '';

    if (!weakThemes || weakThemes.length === 0) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    weakThemes.forEach(function (wt) {
      var div = document.createElement('div');
      div.className = 'weak-theme-item';
      div.innerHTML = '<div class="theme-label">' + escapeHtml(wt.label || wt.theme_id) + '</div>' +
        '<div class="weak-reason">' + escapeHtml(wt.reason || '') + '</div>';
      list.appendChild(div);
    });
  }

  function closeThemeReview() {
    document.getElementById('theme-review-panel').classList.add('hidden');
    document.getElementById('theme-cards').classList.remove('hidden');
    refreshThemes();
  }

  // ========== Export Tab ==========

  var lastReport = null;
  var showingRaw = false;

  function initExportTab() {
    document.getElementById('btn-consolidate').addEventListener('click', runConsolidation);
    document.getElementById('btn-download-md').addEventListener('click', downloadReport);
    document.getElementById('btn-toggle-raw').addEventListener('click', toggleRawView);
    document.getElementById('btn-export-json').addEventListener('click', exportJson);
    document.getElementById('import-json-input').addEventListener('change', importJson);
  }

  async function loadExportDefaults() {
    if (!activeProjectId) return;
    var fw = await Synth.db.getFramework(activeProjectId);
    if (fw && fw.default_consolidation_model) {
      document.getElementById('consolidation-model').value = fw.default_consolidation_model;
    }
    await loadConsolidationStats();

    var themes = await Synth.db.getThemesByProject(activeProjectId);
    var exportNudge = document.getElementById('export-theme-nudge');
    if (themes.length > 30 && exportNudge) {
      document.getElementById('export-nudge-text').textContent =
        'You have ' + themes.length + ' themes. Reviewing themes before generating a report can improve the final synthesis.';
      exportNudge.classList.remove('hidden');
    } else if (exportNudge) {
      exportNudge.classList.add('hidden');
    }
  }

  async function loadConsolidationStats() {
    var statsEl = document.getElementById('consolidation-stats');
    if (!statsEl || !activeProjectId) { if (statsEl) statsEl.classList.add('hidden'); return; }

    var themes = await Synth.db.getThemesByProject(activeProjectId);
    var syntheses = await Synth.db.getSessionSynthesesByProject(activeProjectId);

    if (themes.length === 0 && syntheses.length === 0) {
      statsEl.classList.add('hidden');
      return;
    }

    var totalQuotes = 0;
    var verifiedQuotes = 0;
    var uniqueParticipants = {};
    themes.forEach(function (t) {
      (t.supporting_evidence || []).forEach(function (e) {
        totalQuotes++;
        if (e.verification_status === 'verified' || e.verification_status === 'confirmed') verifiedQuotes++;
        if (e.participant_id) uniqueParticipants[e.participant_id] = true;
      });
    });
    var participantCount = Object.keys(uniqueParticipants).length;

    statsEl.innerHTML = '<strong>' + themes.length + '</strong> themes &middot; <strong>' + participantCount + '</strong> participants &middot; <strong>' + syntheses.length + '</strong> sessions &middot; <strong>' + totalQuotes + '</strong> quotes (' + verifiedQuotes + ' verified)';
    statsEl.classList.remove('hidden');
  }

  async function runConsolidation() {
    if (!activeProjectId) {
      showStatus('consolidation-status', 'error', 'No project selected.');
      return;
    }
    if (!Synth.api.hasCredentials()) {
      showStatus('consolidation-status', 'error', 'Configure your API credentials in Settings first.');
      return;
    }

    var modelSelect = document.getElementById('consolidation-model');
    var modelOverride = modelSelect.value || null;

    var btn = document.getElementById('btn-consolidate');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Generating…';

    var logEl = document.getElementById('consolidation-log');
    logEl.innerHTML = '';
    logEl.classList.remove('hidden');
    showStatus('consolidation-status', '', '');
    var activeLine = null;

    var result = await Synth.pipeline.consolidate(
      activeProjectId,
      modelOverride,
      function (msg, type) {
        if (type === 'step') {
          if (activeLine) {
            activeLine.classList.remove('active');
            activeLine.classList.add('done');
          }
          activeLine = document.createElement('div');
          activeLine.className = 'log-line active';
          activeLine.textContent = msg;
          logEl.appendChild(activeLine);
          logEl.scrollTop = logEl.scrollHeight;
        } else if (type === 'update') {
          if (activeLine) {
            activeLine.setAttribute('data-label', activeLine.getAttribute('data-label') || activeLine.textContent);
            activeLine.textContent = activeLine.getAttribute('data-label') + ' — ' + msg;
          }
        } else if (type === 'done') {
          if (activeLine) {
            activeLine.classList.remove('active');
            activeLine.classList.add('done');
            activeLine.textContent = msg;
            activeLine = null;
          }
        } else if (type === 'error') {
          if (activeLine) {
            activeLine.classList.remove('active');
            activeLine.classList.add('error');
            activeLine.textContent = msg;
            activeLine = null;
          }
        }
      }
    );

    btn.disabled = false;
    btn.textContent = 'Generate Report';

    if (!result.success) {
      showStatus('consolidation-status', 'error', result.error);
      return;
    }

    lastReport = result.report;
    showingRaw = false;

    var previewCard = document.getElementById('report-preview-card');
    var previewDiv = document.getElementById('report-preview');
    var rawDiv = document.getElementById('report-raw');

    previewDiv.innerHTML = Synth.export.renderMarkdownPreview(result.report);
    rawDiv.textContent = result.report;
    previewDiv.classList.remove('hidden');
    rawDiv.classList.add('hidden');
    previewCard.classList.remove('hidden');

    var tokenInfo = '';
    if (result.usage && result.usage.total_tokens) {
      tokenInfo = ' (' + result.usage.total_tokens + ' tokens)';
    }
    showStatus('consolidation-status', 'success', 'Report generated with ' + result.model + tokenInfo + '.');
  }

  function downloadReport() {
    if (!lastReport) return;
    var projectName = document.getElementById('project-indicator').textContent || 'report';
    Synth.export.downloadMarkdown(lastReport, projectName);
  }

  function toggleRawView() {
    var previewDiv = document.getElementById('report-preview');
    var rawDiv = document.getElementById('report-raw');
    var btn = document.getElementById('btn-toggle-raw');

    showingRaw = !showingRaw;
    if (showingRaw) {
      previewDiv.classList.add('hidden');
      rawDiv.classList.remove('hidden');
      btn.textContent = 'View Preview';
    } else {
      previewDiv.classList.remove('hidden');
      rawDiv.classList.add('hidden');
      btn.textContent = 'View Raw';
    }
  }

  async function exportJson() {
    if (!activeProjectId) {
      showStatus('export-status', 'error', 'No project selected.');
      return;
    }
    var project = await Synth.db.getProject(activeProjectId);
    var count = await Synth.export.exportThemeDatabase(activeProjectId, project ? project.name : '');
    showStatus('export-status', 'success', 'Exported ' + count + ' theme(s).');
  }

  async function importJson() {
    var input = document.getElementById('import-json-input');
    var file = input.files[0];
    if (!file) return;
    input.value = '';

    if (!activeProjectId) {
      showStatus('export-status', 'error', 'No project selected.');
      return;
    }

    try {
      var text = await file.text();
      var result = await Synth.export.importThemeDatabase(activeProjectId, text);
      showStatus('export-status', 'success',
        'Imported ' + result.imported + ' theme(s). ' +
        (result.skipped > 0 ? result.skipped + ' skipped (duplicates or invalid).' : '')
      );
      refreshThemes();
    } catch (e) {
      showStatus('export-status', 'error', 'Import failed: ' + e.message);
    }
  }

  // ========== Helpers ==========

  function showStatus(elementId, type, message) {
    var el = document.getElementById(elementId);
    if (!el) return;
    el.className = 'status-msg ' + type;
    el.textContent = message;
  }

  function escapeHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    var d = new Date(isoStr);
    return d.toLocaleDateString();
  }

  return { init, switchTab, getActiveProjectId: function () { return activeProjectId; } };
})();

document.addEventListener('DOMContentLoaded', function () {
  Synth.app.init().catch(function (e) {
    console.error('Failed to initialise app:', e);
    var el = document.getElementById('api-status');
    if (el) {
      el.className = 'status-msg error';
      el.textContent = 'App failed to start: ' + e.message;
    }
  });
});
