// ============================================================
// GAP WARNINGS
// ============================================================
function checkGapWarnings() {
  // Team HCD role
  const teamRoles = (formData.projectTeam || []).map(m => (m.role || '').toLowerCase()).join(' ');
  const hasHCD = /designer|researcher|ux|hcd|service design/.test(teamRoles);
  const hasAgile = /product owner|po|delivery lead|scrum|agile lead/.test(teamRoles);
  toggleWarning('warn-team-hcd', !hasHCD);
  toggleWarning('warn-team-agile', !hasAgile);

  // UX measure
  const measures = (formData.programMeasures || []).concat(formData.projectMeasures || []).join(' ').toLowerCase();
  const hasUXMeasure = /user|experience|satisfaction|task|usability/.test(measures);
  toggleWarning('warn-ux-measure', !hasUXMeasure);

  // End users in stakeholders
  const stakeholders = (formData.stakeholders || []).map(s => (s.name || '') + ' ' + (s.interest || '')).join(' ').toLowerCase();
  const hasEndUsers = /student|teacher|parent|principal|user|school/.test(stakeholders);
  toggleWarning('warn-no-end-users', !hasEndUsers);

  // Discovery phase
  const phases = (formData.phases || []).map(p => (p.phase || '').toLowerCase()).join(' ');
  const hasDiscovery = /discover|research|explore/.test(phases);
  toggleWarning('warn-no-discovery', !hasDiscovery);

  // Out of scope
  const hasOutScope = (formData.outScope || []).some(s => s && s.trim() !== '');
  toggleWarning('warn-no-out-scope', !hasOutScope);

  // Access to users risk
  const risks = (formData.risks || []).map(r => (r.risk || '').toLowerCase()).join(' ');
  const hasUserRisk = /user|access|research|participant|recruit/.test(risks);
  toggleWarning('warn-no-user-risk', !hasUserRisk);

  // Accessibility
  const hasA11y = formData.accessibilityReqs && formData.accessibilityReqs.trim() !== '';
  toggleWarning('warn-no-a11y', !hasA11y);
}

function toggleWarning(id, show) {
  const el2 = document.getElementById(id);
  if (el2) {
    if (show) el2.classList.remove('hidden');
    else el2.classList.add('hidden');
  }
}
