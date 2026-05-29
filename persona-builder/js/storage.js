// ============================================================
// STORAGE — JSON import/export + .md file reader
// ============================================================

// ── RANDOM NAME ──────────────────────────────────────────────
function randomiseName() {
  const name = generateRandomName();
  formData.name = name;
  const nameInput = document.getElementById('field-name');
  if (nameInput) nameInput.value = name;
  triggerSave();
  renderPreview();
  showToast('🎲 ' + name, 'success');
}


// ── JSON EXPORT ─────────────────────────────────────────────
function exportJSON() {
  const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const name = (formData.name || 'persona').replace(/\s+/g, '-').toLowerCase();
  a.href     = url;
  a.download = name + '-persona.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Persona exported as JSON.', 'success');
}

// ── JSON IMPORT ─────────────────────────────────────────────
function importJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Not a valid persona JSON object.');
      }
      Object.assign(formData, data);
      // Migrate legacy flat structure if needed
      migrateLegacyContentSections();
      // Ensure attributes integrity
      if (!formData.attributes || formData.attributes.length === 0) {
        formData.attributes = [
          { label: 'TECHNOLOGY SAVVINESS',      leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
          { label: 'OPENNESS TO CHANGE',        leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
          { label: 'LEARNING AGILITY',          leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
          { label: 'SYSTEM VS. CUSTOMER FOCUS', leftLabel: 'System', rightLabel: 'Customer', value: 50 }
        ];
      }
      triggerSave();
      renderAllSections();
      renderPreview();
      showToast('Persona imported successfully.', 'success');
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// ── MARKDOWN FILE IMPORT ─────────────────────────────────────
function importMarkdown(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const rawText  = e.target.result;
    const fileName = file.name;
    // Determine if we're already in the builder (toolbar import) or coming from welcome
    const appVisible = document.getElementById('app')?.style.display !== 'none';
    const returnTo   = appVisible ? 'builder' : 'welcome';
    // Route through de-identification screen
    showDeIdScreen(rawText, fileName, function (cleanedText, cleanedFileName) {
      mdFileContent = cleanedText;
      mdFileName    = cleanedFileName;
      // Update both md indicators (toolbar + AI Setup tab)
      ['md-file-indicator', 'md-file-indicator-2'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = '📄 ' + cleanedFileName;
          if (el.classList) el.classList.add('loaded');
        }
      });
      showToast('Research notes loaded: ' + cleanedFileName + '. Click "Generate with AI" to use it.', 'success');
    }, returnTo);
  };
  reader.readAsText(file);
}

// ── CLEAR ALL ────────────────────────────────────────────────
function clearAll() {
  showModal(
    'Clear Persona',
    'This will clear all fields and reset the persona. Are you sure?',
    () => {
      localStorage.removeItem(STORAGE_KEY);
      formData.name          = '';
      formData.role          = '';
      formData.team          = '';
      formData.bio           = '';
      formData.avatarType    = '';
      formData.avatarDataUrl = '';
      formData.contentSections = defaultContentSections();
      formData.tools = [{ name: '', iconType: 'library', iconKey: 'mobile', iconDataUrl: '' }];
      formData.attributes = [
        { label: 'TECHNOLOGY SAVVINESS',      leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
        { label: 'OPENNESS TO CHANGE',        leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
        { label: 'LEARNING AGILITY',          leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
        { label: 'SYSTEM VS. CUSTOMER FOCUS', leftLabel: 'System', rightLabel: 'Customer', value: 50 }
      ];
      mdFileContent = '';
      mdFileName    = '';
      ['md-file-indicator', 'md-file-indicator-2'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.classList.remove('loaded'); }
      });
      renderAllSections();
      renderPreview();
      showToast('Persona cleared.', 'success');
    }
  );
}

// ── LOAD EXAMPLE ─────────────────────────────────────────────
function loadExample() {
  Object.assign(formData, {
    name: 'Dave Castillo',
    role: 'Training Advisor',
    team: 'RTS team',
    bio: 'As part of the Regional Training Services team in the Illawarra region, Dave works with learners, employers (and sometimes providers) every day. When he is out in the field, he enjoys building relationships and supporting parties with roles and responsibilities under the A&T Act, resolving issues and mediation, and when he\'s back in the office he is busy processing and ensuring records are accurate. He is often whisked away by the priority matters of the week.',
    avatarType: '',
    avatarDataUrl: '',
    contentSections: [
      {
        id: 'jobs', heading: 'Jobs to be Done', style: 'box',
        items: [
          'Ensure contractual obligations are being met and address risks early',
          'Resolve issues between learners, employers and RTOs so progress can continue',
          'Create shared understanding of roles, responsibilities, and obligations to prevent non-compliance',
          'Assess and approve contractual changes to keep agreements accurate.'
        ]
      },
      {
        id: 'motivations', heading: 'Motivations', style: 'blue',
        items: [
          'Making direct impacts to learners and employers about their rights and obligations in relation to their training contracts, through education and conversation',
          'Bridging the gap in policy and the complex everyday experience of learners and employers',
          'Helping learners and employers getting through to completion and resolving issues',
          'Supporting training providers so they can deliver effectively'
        ]
      },
      {
        id: 'needs', heading: 'Needs', style: 'blue',
        items: [
          'One source of truth to understand, input/vary and extract information about learners, employers and other stakeholders like providers for full context around their situation and needs',
          'Efficient and standardised team processes to ensure he\'s doing the right thing and using his time in the best way'
        ]
      },
      {
        id: 'challenges', heading: 'Key challenges', style: 'blue',
        items: [
          'Reactive delivery of services means unpredictability in scheduling and capacity - Dave often feels under the pump',
          'System limitations and scatted information mean Dave is relying on his printed notes to validate information, taking up more time to collect and input back into the system (double handling)',
          'Information arrives to Training Services late as it has trickled in from other channels and stakeholders - by the time Dave is mediating the situation has changed drastically, often requiring rework'
        ]
      }
    ],
    tools: [
      { name: 'Mobile',   iconType: 'library', iconKey: 'mobile',   iconDataUrl: '' },
      { name: 'Teams',    iconType: 'library', iconKey: 'teams',    iconDataUrl: '' },
      { name: 'Email',    iconType: 'library', iconKey: 'email',    iconDataUrl: '' },
      { name: 'Excel',    iconType: 'library', iconKey: 'excel',    iconDataUrl: '' },
      { name: 'Word',     iconType: 'library', iconKey: 'word',     iconDataUrl: '' },
      { name: 'IVETS',    iconType: 'library', iconKey: 'ivets',    iconDataUrl: '' },
      { name: 'VIP',      iconType: 'library', iconKey: 'vip',      iconDataUrl: '' },
      { name: 'TRIM',     iconType: 'library', iconKey: 'trim',     iconDataUrl: '' },
      { name: 'DMF',      iconType: 'library', iconKey: 'dmf',      iconDataUrl: '' },
      { name: 'Policies', iconType: 'library', iconKey: 'policies', iconDataUrl: '' }
    ],
    attributes: [
      { label: 'TECHNOLOGY SAVVINESS',      leftLabel: 'Low',    rightLabel: 'High',     value: 55 },
      { label: 'OPENNESS TO CHANGE',        leftLabel: 'Low',    rightLabel: 'High',     value: 65 },
      { label: 'LEARNING AGILITY',          leftLabel: 'Low',    rightLabel: 'High',     value: 60 },
      { label: 'SYSTEM VS. CUSTOMER FOCUS', leftLabel: 'System', rightLabel: 'Customer', value: 35 }
    ]
  });
  triggerSave();
  renderAllSections();
  renderPreview();
  if (typeof restoreAvatarUploadUI === 'function') restoreAvatarUploadUI();
  showToast('Example persona loaded — Dave Castillo.', 'success');
}
