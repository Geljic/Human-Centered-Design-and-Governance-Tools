// ============================================================
// FIELD BINDING — update formData and trigger save/preview
// ============================================================
function setField(key, value) {
  formData[key] = value;
  triggerSave();
  renderPreview();
}

function setNestedField(arrayKey, index, field, value) {
  if (!formData[arrayKey]) formData[arrayKey] = [];
  if (!formData[arrayKey][index]) formData[arrayKey][index] = {};
  formData[arrayKey][index][field] = value;
  triggerSave();
  renderPreview();
}

function setArrayItem(arrayKey, index, value) {
  if (!formData[arrayKey]) formData[arrayKey] = [];
  formData[arrayKey][index] = value;
  triggerSave();
  renderPreview();
}

function setAttributeValue(index, value) {
  if (!formData.attributes[index]) return;
  formData.attributes[index].value = parseInt(value, 10);
  triggerSave();
  renderPreview();
}

// ============================================================
// REPEATABLE ROW HELPERS
// ============================================================
function addRow(arrayKey, template, renderFn) {
  if (!formData[arrayKey]) formData[arrayKey] = [];
  formData[arrayKey].push(
    typeof template === 'function'
      ? template()
      : JSON.parse(JSON.stringify(template))
  );
  triggerSave();
  renderFn();
}

function removeRow(arrayKey, index, renderFn) {
  if (formData[arrayKey].length <= 1) {
    showToast('At least one row is required.', 'warning');
    return;
  }
  formData[arrayKey].splice(index, 1);
  triggerSave();
  renderFn();
}

// ============================================================
// SAVE / LOAD
// ============================================================
function triggerSave() {
  clearTimeout(saveTimer);
  setSaveIndicator('saving');
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      setSaveIndicator('saved');
    } catch (e) {
      setSaveIndicator('error');
      showToast('Could not save — localStorage may be full (images too large?).', 'error');
    }
  }, 600);
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(formData, saved);
      // Migrate legacy flat content structure to new contentSections
      if (typeof migrateLegacyContentSections === 'function') {
        migrateLegacyContentSections();
      }
      // Ensure attributes array exists
      if (!formData.attributes || formData.attributes.length === 0) {
        formData.attributes = [
          { label: 'TECHNOLOGY SAVVINESS',      leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
          { label: 'OPENNESS TO CHANGE',        leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
          { label: 'LEARNING AGILITY',          leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
          { label: 'SYSTEM VS. CUSTOMER FOCUS', leftLabel: 'System', rightLabel: 'Customer', value: 50 }
        ];
      }
      // Ensure contentSections exists and isn't an empty array
      if (!Array.isArray(formData.contentSections) || formData.contentSections.length === 0) {
        formData.contentSections = defaultContentSections();
      }
    }
  } catch (e) {
    console.warn('Could not load saved data:', e);
  }
}

function setSaveIndicator(state) {
  const dot  = document.getElementById('save-dot');
  const text = document.getElementById('save-text');
  if (!dot || !text) return;
  if (state === 'saving') {
    dot.style.color  = '#F0AD4E';
    text.textContent = 'Saving…';
  } else if (state === 'saved') {
    dot.style.color  = '#5CB85C';
    text.textContent = 'All changes saved';
  } else {
    dot.style.color  = '#D9534F';
    text.textContent = 'Save error';
  }
}
