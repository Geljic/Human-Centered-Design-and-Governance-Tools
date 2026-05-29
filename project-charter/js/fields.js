// ============================================================
// FIELD BINDING — update formData and trigger save/preview
// ============================================================
function setField(key, value) {
  formData[key] = value;
  triggerSave();
  renderPreview();
  updateProgress();
}

function setNestedField(arrayKey, index, field, value) {
  if (!formData[arrayKey]) formData[arrayKey] = [];
  if (!formData[arrayKey][index]) formData[arrayKey][index] = {};
  formData[arrayKey][index][field] = value;
  triggerSave();
  renderPreview();
  updateProgress();
}

function setArrayItem(arrayKey, index, value) {
  if (!formData[arrayKey]) formData[arrayKey] = [];
  formData[arrayKey][index] = value;
  triggerSave();
  renderPreview();
  updateProgress();
}

// ============================================================
// REPEATABLE ROW HELPERS
// ============================================================
function addRow(arrayKey, template, renderFn) {
  if (!formData[arrayKey]) formData[arrayKey] = [];
  formData[arrayKey].push(typeof template === 'function' ? template() : JSON.parse(JSON.stringify(template)));
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
