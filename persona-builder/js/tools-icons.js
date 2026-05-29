// ============================================================
// TOOLS ICON LIBRARY — common tools + custom upload
// ============================================================

// Icons as inline SVG strings — common workplace tools
const TOOLS_LIBRARY = {
  'mobile': {
    label: 'Mobile',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect x="12" y="4" width="24" height="40" rx="4" fill="#555" stroke="#333" stroke-width="1"/>
      <rect x="14" y="8" width="20" height="28" rx="1" fill="#87CEEB"/>
      <circle cx="24" cy="40" r="2" fill="#888"/>
    </svg>`
  },
  'teams': {
    label: 'Teams',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#5059C9"/>
      <circle cx="30" cy="14" r="6" fill="white"/>
      <rect x="22" y="22" width="16" height="14" rx="3" fill="white"/>
      <circle cx="18" cy="18" r="7" fill="#7B83EB"/>
      <rect x="10" y="27" width="16" height="13" rx="3" fill="#7B83EB"/>
    </svg>`
  },
  'email': {
    label: 'Email',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#0078D4"/>
      <rect x="6" y="12" width="36" height="24" rx="3" fill="white"/>
      <polyline points="6,12 24,28 42,12" fill="none" stroke="#0078D4" stroke-width="2.5"/>
    </svg>`
  },
  'excel': {
    label: 'Excel',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#217346"/>
      <rect x="6" y="6" width="22" height="36" rx="2" fill="#1E6B3E"/>
      <rect x="20" y="6" width="22" height="36" rx="2" fill="white" stroke="#217346" stroke-width="0.5"/>
      <line x1="31" y1="6" x2="31" y2="42" stroke="#217346" stroke-width="0.5"/>
      <line x1="20" y1="18" x2="42" y2="18" stroke="#217346" stroke-width="0.5"/>
      <line x1="20" y1="30" x2="42" y2="30" stroke="#217346" stroke-width="0.5"/>
      <text x="10" y="30" font-size="14" font-weight="bold" fill="white" font-family="Arial">X</text>
    </svg>`
  },
  'word': {
    label: 'Word',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#2B579A"/>
      <rect x="6" y="6" width="22" height="36" rx="2" fill="#1E3F7A"/>
      <rect x="20" y="6" width="22" height="36" rx="2" fill="white" stroke="#2B579A" stroke-width="0.5"/>
      <text x="8" y="30" font-size="14" font-weight="bold" fill="white" font-family="Arial">W</text>
    </svg>`
  },
  'sharepoint': {
    label: 'SharePoint',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#038387"/>
      <circle cx="20" cy="24" r="12" fill="#25A0A8"/>
      <circle cx="30" cy="24" r="10" fill="#038387" stroke="white" stroke-width="1.5"/>
      <circle cx="30" cy="24" r="5" fill="white"/>
    </svg>`
  },
  'trim': {
    label: 'TRIM',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#1A3A5C"/>
      <rect x="8" y="10" width="32" height="28" rx="3" fill="white"/>
      <line x1="12" y1="18" x2="36" y2="18" stroke="#1A3A5C" stroke-width="2"/>
      <line x1="12" y1="24" x2="36" y2="24" stroke="#1A3A5C" stroke-width="2"/>
      <line x1="12" y1="30" x2="28" y2="30" stroke="#1A3A5C" stroke-width="2"/>
      <text x="10" y="44" font-size="7" fill="white" font-family="Arial" font-weight="bold">TRIM</text>
    </svg>`
  },
  'dmf': {
    label: 'DMF',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#4A6FA5"/>
      <rect x="8" y="8" width="14" height="18" rx="2" fill="white"/>
      <rect x="26" y="8" width="14" height="18" rx="2" fill="white"/>
      <rect x="8" y="30" width="32" height="10" rx="2" fill="white"/>
      <text x="10" y="44" font-size="7" fill="white" font-family="Arial" font-weight="bold">DMF</text>
    </svg>`
  },
  'vip': {
    label: 'VIP',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#6B4C9A"/>
      <rect x="6" y="10" width="36" height="28" rx="3" fill="white"/>
      <rect x="6" y="10" width="36" height="10" rx="3" fill="#6B4C9A"/>
      <text x="11" y="20" font-size="8" fill="white" font-family="Arial" font-weight="bold">VIP</text>
      <line x1="10" y1="28" x2="38" y2="28" stroke="#DDD" stroke-width="1"/>
      <line x1="10" y1="33" x2="30" y2="33" stroke="#DDD" stroke-width="1"/>
    </svg>`
  },
  'ivets': {
    label: 'IVETS',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#D7153A"/>
      <rect x="8" y="8" width="32" height="32" rx="3" fill="white"/>
      <text x="9" y="26" font-size="9" fill="#D7153A" font-family="Arial" font-weight="bold">IVETS</text>
      <line x1="10" y1="30" x2="38" y2="30" stroke="#D7153A" stroke-width="1.5"/>
      <line x1="10" y1="35" x2="30" y2="35" stroke="#D7153A" stroke-width="1.5"/>
    </svg>`
  },
  'policies': {
    label: 'Policies',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#22272B"/>
      <rect x="10" y="6" width="28" height="36" rx="2" fill="white"/>
      <rect x="10" y="6" width="28" height="8" rx="2" fill="#D7153A"/>
      <line x1="14" y1="20" x2="34" y2="20" stroke="#333" stroke-width="1.5"/>
      <line x1="14" y1="25" x2="34" y2="25" stroke="#333" stroke-width="1.5"/>
      <line x1="14" y1="30" x2="34" y2="30" stroke="#333" stroke-width="1.5"/>
      <line x1="14" y1="35" x2="26" y2="35" stroke="#333" stroke-width="1.5"/>
    </svg>`
  },
  'powerbi': {
    label: 'Power BI',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#F2C811"/>
      <rect x="10" y="28" width="6" height="14" rx="1" fill="#333"/>
      <rect x="20" y="20" width="6" height="22" rx="1" fill="#333"/>
      <rect x="30" y="12" width="6" height="30" rx="1" fill="#333"/>
    </svg>`
  },
  'forms': {
    label: 'Forms',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#007A4D"/>
      <rect x="8" y="8" width="32" height="32" rx="3" fill="white"/>
      <rect x="12" y="14" width="24" height="4" rx="1" fill="#007A4D"/>
      <rect x="12" y="22" width="24" height="4" rx="1" fill="#007A4D"/>
      <rect x="12" y="30" width="16" height="4" rx="1" fill="#007A4D"/>
    </svg>`
  },
  'custom': {
    label: 'Custom',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect width="48" height="48" rx="8" fill="#EEE" stroke="#CCC" stroke-width="1"/>
      <text x="24" y="28" font-size="20" text-anchor="middle" fill="#999">+</text>
    </svg>`
  }
};

// ── RENDER TOOLS ICON PICKER ─────────────────────────────────
function renderToolsIconPicker(containerId, toolIndex) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentKey = (formData.tools[toolIndex] || {}).iconKey || '';

  container.innerHTML = Object.entries(TOOLS_LIBRARY).map(([key, icon]) => {
    if (key === 'custom') return ''; // custom handled separately
    const isSelected = currentKey === key && (formData.tools[toolIndex] || {}).iconType === 'library';
    return `<div class="tool-icon-thumb ${isSelected ? 'selected' : ''}"
                 onclick="selectLibraryToolIcon(${toolIndex}, '${key}')"
                 title="${icon.label}">
      ${icon.svg}
      <span>${icon.label}</span>
    </div>`;
  }).join('');
}

function selectLibraryToolIcon(toolIndex, key) {
  if (!formData.tools[toolIndex]) return;
  formData.tools[toolIndex].iconType    = 'library';
  formData.tools[toolIndex].iconKey     = key;
  formData.tools[toolIndex].iconDataUrl = '';
  triggerSave();
  // Re-render the tools editor so the icon updates in the row immediately
  renderToolsSection();
  renderPreview();
  closeToolIconPicker();
}

// ── GET TOOL ICON SVG ────────────────────────────────────────
function getToolIconSvg(tool) {
  if (tool.iconType === 'upload' && tool.iconDataUrl) {
    return `<img src="${tool.iconDataUrl}" alt="${tool.name}" style="width:100%;height:100%;object-fit:contain;"/>`;
  }
  const lib = TOOLS_LIBRARY[tool.iconKey] || TOOLS_LIBRARY['custom'];
  return lib.svg;
}

function getToolIconDataUrl(tool) {
  if (tool.iconType === 'upload' && tool.iconDataUrl) {
    return tool.iconDataUrl;
  }
  const lib = TOOLS_LIBRARY[tool.iconKey] || TOOLS_LIBRARY['custom'];
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(lib.svg);
}

// ── CUSTOM ICON UPLOAD ───────────────────────────────────────
function handleToolIconUpload(file, toolIndex) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file (PNG, JPG, SVG).', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    if (!formData.tools[toolIndex]) return;
    formData.tools[toolIndex].iconType    = 'upload';
    formData.tools[toolIndex].iconKey     = 'custom';
    formData.tools[toolIndex].iconDataUrl = e.target.result;
    triggerSave();
    renderToolsSection();
    renderPreview();
    showToast('Tool icon uploaded.', 'success');
  };
  reader.readAsDataURL(file);
}

// ── ICON PICKER MODAL STATE ──────────────────────────────────
let activeIconPickerIndex = -1;

function openToolIconPicker(toolIndex) {
  activeIconPickerIndex = toolIndex;
  const picker = document.getElementById('tool-icon-picker-modal');
  if (!picker) return;
  renderToolsIconPicker('tool-icon-picker-grid', toolIndex);
  picker.classList.add('open');
}

function closeToolIconPicker() {
  activeIconPickerIndex = -1;
  const picker = document.getElementById('tool-icon-picker-modal');
  if (picker) picker.classList.remove('open');
}
