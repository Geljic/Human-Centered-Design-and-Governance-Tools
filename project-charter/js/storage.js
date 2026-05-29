// ============================================================
// LOCAL STORAGE — AUTO SAVE
// ============================================================
function triggerSave() {
  setSaveIndicator('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    setSaveIndicator('saved');
  }, 800);
}

function setSaveIndicator(state) {
  const el = document.getElementById('save-indicator');
  const txt = document.getElementById('save-text');
  el.className = state;
  if (state === 'saving') txt.textContent = 'Saving…';
  if (state === 'saved')  txt.textContent = 'All changes saved';
}

function loadSaved() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      formData = { ...formData, ...parsed };
      showToast('Previous session restored.', 'success');
    } catch(e) {
      console.warn('Could not restore saved data:', e);
    }
  }
}

// ============================================================
// JSON IMPORT / EXPORT
// ============================================================
function _exportTimestamp() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hh   = String(now.getHours()).padStart(2, '0');
  const mm   = String(now.getMinutes()).padStart(2, '0');
  return `${date}-${hh}${mm}`;
}

function exportJSON() {
  const payload = { ...formData, savedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `charter-${(formData.projectName || 'draft').replace(/\s+/g,'-').toLowerCase()}-${_exportTimestamp()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Charter data exported. Upload to your SharePoint project folder to share with your team.', 'success');
}

function importJSON() {
  document.getElementById('json-file-input').click();
}

function handleJSONImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  _processImportFile(file);
  // Reset input so the same file can be re-imported if needed
  setTimeout(() => { e.target.value = ''; }, 100);
}

function _processImportFile(file) {
  if (!file || !file.name.endsWith('.json')) {
    showToast('❌ Please drop a .json file exported from this tool.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);

      // Normalise userGroups array → userGroupsText string for the form field
      if (Array.isArray(parsed.userGroups) && !parsed.userGroupsText) {
        parsed.userGroupsText = parsed.userGroups.filter(Boolean).join(', ');
      }

      // Ensure all array fields have at least one entry so repeatable lists render
      const arrayDefaults = {
        execSponsors:    [{ name: '', role: '' }],
        projectTeam:     [{ name: '', role: '' }],
        sponsorTeam:     [{ name: '', role: '' }],
        programMeasures: [''],
        projectMeasures: [''],
        baselines:       [{ metric: '', value: '' }],
        targets:         [{ metric: '', value: '' }],
        inScope:         [''],
        outScope:        [''],
        contingencies:   [''],
        risks:           [{ risk: '', mitigation: '', rating: 'Medium' }],
        phases:          [{ phase: '', start: '', end: '', duration: '' }],
        milestones:      [{ milestone: '', date: '' }],
        dependencies:    [''],
        stakeholders:    [{ name: '', interest: '', influence: 'Medium' }]
      };
      Object.keys(arrayDefaults).forEach(key => {
        if (!parsed[key] || !Array.isArray(parsed[key]) || parsed[key].length === 0) {
          parsed[key] = arrayDefaults[key];
        }
      });

      formData = { ...formData, ...parsed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));

      // Re-render after a short tick to ensure DOM is ready
      setTimeout(() => {
        renderAllSections();
        renderPreview();
        updateProgress();
        const savedAtMsg = parsed.savedAt
          ? ` (saved ${new Date(parsed.savedAt).toLocaleString()})`
          : '';
        showToast(`✅ Charter imported — ${Object.keys(parsed).length} fields loaded${savedAtMsg}.`, 'success');
      }, 50);

    } catch(err) {
      console.error('JSON import error:', err);
      showToast('❌ Could not parse JSON file: ' + err.message, 'error');
    }
  };
  reader.onerror = () => showToast('❌ Could not read file.', 'error');
  reader.readAsText(file);
}

// ============================================================
// DRAG-AND-DROP IMPORT
// ============================================================
function initDragAndDrop() {
  const app = document.getElementById('app');
  if (!app) return;

  app.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    app.classList.add('drag-over');
  });

  app.addEventListener('dragleave', (e) => {
    // Only remove if leaving the app entirely (not a child element)
    if (!app.contains(e.relatedTarget)) {
      app.classList.remove('drag-over');
    }
  });

  app.addEventListener('drop', (e) => {
    e.preventDefault();
    app.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) _processImportFile(file);
  });
}

// ============================================================
// SHAREPOINT ONBOARDING MODAL
// ============================================================
const SP_ONBOARDED_KEY = 'hcd_onboarded';

function initSharePointModal() {
  // Inject modal HTML — critical layout styles inlined so it works regardless of CSS load/cache state
  const modalHtml = `
<div id="sp-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sp-modal-title"
  style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;align-items:center;justify-content:center;padding:24px;">
  <div style="background:#fff;border-radius:10px;padding:36px 32px 28px;max-width:480px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.2);text-align:center;font-family:inherit;">
    <div style="font-size:2.4rem;margin-bottom:12px;">📁</div>
    <h2 id="sp-modal-title" style="font-size:1.2rem;font-weight:700;margin-bottom:12px;color:#1a3a5c;">Saving &amp; sharing your work</h2>
    <p style="font-size:0.9rem;color:#4b5563;margin-bottom:16px;line-height:1.6;">This tool auto-saves to <strong>your browser only</strong>. To share with your team or continue on another device, use the <strong>Export JSON</strong> button and upload the file to your team's SharePoint folder.</p>
    <ol style="text-align:left;padding-left:20px;margin-bottom:16px;">
      <li style="font-size:0.88rem;color:#4b5563;margin-bottom:8px;line-height:1.5;"><strong>Export JSON</strong> when you finish a session</li>
      <li style="font-size:0.88rem;color:#4b5563;margin-bottom:8px;line-height:1.5;">Upload the file to <strong>SharePoint → HCD Tools — Project Data → [Your Project]</strong></li>
      <li style="font-size:0.88rem;color:#4b5563;margin-bottom:8px;line-height:1.5;">Your teammate downloads the file and clicks <strong>Import JSON</strong> to pick up where you left off</li>
    </ol>
    <p style="font-size:0.78rem;color:#6b7280;background:#f3f4f6;border-radius:6px;padding:8px 12px;margin-bottom:20px;">Files are named with date &amp; time (e.g. <code style="font-family:monospace;background:#e5e7eb;padding:1px 4px;border-radius:3px;">charter-my-project-2026-05-11-1430.json</code>) so you always know which is latest.</p>
    <div style="display:flex;justify-content:center;">
      <button class="toolbar-btn primary" id="sp-modal-dismiss" style="min-width:120px;">Got it</button>
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('sp-modal-dismiss').addEventListener('click', () => {
    closeSharePointModal();
    localStorage.setItem(SP_ONBOARDED_KEY, '1');
  });

  document.getElementById('sp-modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('sp-modal-overlay')) {
      closeSharePointModal();
      localStorage.setItem(SP_ONBOARDED_KEY, '1');
    }
  });

  // NOTE: First-load modal is now triggered from enterBuilder() so it
  // only appears after the user has passed the welcome screen.
}

function openSharePointModal() {
  // Use inline style toggling — not CSS classes — so it works regardless of CSS load/cache state
  document.getElementById('sp-modal-overlay').style.display = 'flex';
}

function closeSharePointModal() {
  document.getElementById('sp-modal-overlay').style.display = 'none';
}

// ============================================================
// CLEAR ALL
// ============================================================
function confirmClear() {
  showModal(
    'Clear all data?',
    'This will permanently delete all form data. This cannot be undone.',
    () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  );
}
