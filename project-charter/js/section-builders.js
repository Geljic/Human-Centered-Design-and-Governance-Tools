// ============================================================
// SECTION BUILDER HELPERS
// ============================================================
function el(tag, attrs, ...children) {
  attrs = attrs || {};
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  });
  children.forEach(c => { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}

function makeSection(num, id, title, subtitle, bodyFn) {
  const section = el('div', { class: 'form-section', id: 'section-' + id });
  const header = el('div', { class: 'section-header', id: 'header-' + id });
  header.setAttribute('onclick', "toggleSection('" + id + "')");
  const left = el('div', { class: 'section-header-left' });
  const numBadge = el('div', { class: 'section-number', id: 'num-' + id }, String(num));
  const titleGroup = el('div', { class: 'section-title-group' });
  titleGroup.appendChild(el('h2', {}, title));
  titleGroup.appendChild(el('p', {}, subtitle));
  left.appendChild(numBadge);
  left.appendChild(titleGroup);
  header.appendChild(left);
  header.appendChild(el('span', { class: 'section-chevron' }, '▼'));
  const body = el('div', { class: 'section-body', id: 'body-' + id });
  bodyFn(body);
  section.appendChild(header);
  section.appendChild(body);
  return section;
}

function makeField(labelText, required, optional, recommended, inputEl, helpText) {
  const group = el('div', { class: 'field-group' });
  const lbl = el('label');
  lbl.textContent = labelText;
  if (required)    lbl.appendChild(el('span', { class: 'required' }, ' *'));
  if (optional)    lbl.appendChild(el('span', { class: 'optional' }, ' (optional)'));
  if (recommended) lbl.appendChild(el('span', { class: 'recommended' }, ' ★ recommended'));
  group.appendChild(lbl);
  group.appendChild(inputEl);
  if (helpText) group.appendChild(el('p', { class: 'field-help' }, helpText));
  return group;
}

function makeInput(type, key, placeholder, value) {
  const inp = el('input', { type: type, placeholder: placeholder || '', value: value || '' });
  inp.addEventListener('input', () => setField(key, inp.value));
  return inp;
}

function makeTextarea(key, placeholder, value, tall) {
  const ta = el('textarea', { placeholder: placeholder || '' });
  if (tall) ta.classList.add('tall');
  ta.value = value || '';
  ta.addEventListener('input', () => setField(key, ta.value));
  return ta;
}

function makeSelect(key, options, value) {
  const sel = el('select');
  options.forEach(function(pair) {
    const opt = el('option', { value: pair[0] }, pair[1]);
    if (pair[0] === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => setField(key, sel.value));
  return sel;
}

function makeCopyPromptBtn(label, promptFn) {
  const btn = el('button', { class: 'ai-btn', type: 'button' });
  btn.title = 'Copy AI prompt to clipboard — paste into ChatGPT, Claude, or Copilot';
  btn.innerHTML = '📋 Copy Prompt: ' + label;
  btn.addEventListener('click', function() {
    const prompt = promptFn();
    copyPrompt(prompt, label);
  });
  return btn;
}

function makeAIOutput(id, key, placeholder) {
  const ta = el('textarea', { id: id, class: 'ai-output', placeholder: placeholder || 'AI output will appear here — review and edit before using.' });
  ta.value = formData[key] || '';
  ta.addEventListener('input', () => setField(key, ta.value));
  return ta;
}

function makeRepeatableList(arrayKey, placeholder) {
  const container = el('div', { class: 'repeatable-list', id: 'list-' + arrayKey });
  renderRepeatableList(container, arrayKey, placeholder);
  return container;
}

function renderRepeatableList(container, arrayKey, placeholder) {
  container.innerHTML = '';
  const arr = formData[arrayKey] && formData[arrayKey].length ? formData[arrayKey] : [''];
  arr.forEach(function(val, i) {
    const row = el('div', { class: 'repeatable-row' });
    const inp = el('input', { type: 'text', placeholder: placeholder || '', value: val || '' });
    inp.addEventListener('input', () => setArrayItem(arrayKey, i, inp.value));
    const rmBtn = el('button', { class: 'remove-btn', type: 'button', title: 'Remove' }, '×');
    rmBtn.addEventListener('click', () => removeRow(arrayKey, i, () => renderRepeatableList(container, arrayKey, placeholder)));
    row.appendChild(inp);
    row.appendChild(rmBtn);
    container.appendChild(row);
  });
  const addBtn = el('button', { class: 'add-row-btn', type: 'button' }, '+ Add item');
  addBtn.addEventListener('click', () => addRow(arrayKey, '', () => renderRepeatableList(container, arrayKey, placeholder)));
  container.appendChild(addBtn);
}

function makeRepeatableObjectList(arrayKey, fields) {
  const container = el('div', { class: 'repeatable-list', id: 'objlist-' + arrayKey });
  renderRepeatableObjectList(container, arrayKey, fields);
  return container;
}

function renderRepeatableObjectList(container, arrayKey, fields) {
  container.innerHTML = '';
  const arr = formData[arrayKey] && formData[arrayKey].length ? formData[arrayKey] : [{}];
  arr.forEach(function(obj, i) {
    const row = el('div', { class: 'repeatable-row' });
    fields.forEach(function(f) {
      if (f.type === 'select') {
        const sel = el('select');
        f.options.forEach(function(pair) {
          const opt = el('option', { value: pair[0] }, pair[1]);
          if ((obj[f.key] || f.default) === pair[0]) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', () => setNestedField(arrayKey, i, f.key, sel.value));
        row.appendChild(sel);
      } else {
        const inp = el('input', { type: 'text', placeholder: f.placeholder || '', value: obj[f.key] || '' });
        inp.addEventListener('input', () => setNestedField(arrayKey, i, f.key, inp.value));
        row.appendChild(inp);
      }
    });
    const rmBtn = el('button', { class: 'remove-btn', type: 'button', title: 'Remove' }, '×');
    rmBtn.addEventListener('click', () => removeRow(arrayKey, i, () => renderRepeatableObjectList(container, arrayKey, fields)));
    row.appendChild(rmBtn);
    container.appendChild(row);
  });
  const addBtn = el('button', { class: 'add-row-btn', type: 'button' }, '+ Add row');
  addBtn.addEventListener('click', function() {
    const template = {};
    fields.forEach(f => { template[f.key] = f.default || ''; });
    addRow(arrayKey, template, () => renderRepeatableObjectList(container, arrayKey, fields));
  });
  container.appendChild(addBtn);
}
