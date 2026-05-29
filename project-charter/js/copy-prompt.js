// ============================================================
// COPY PROMPT TO CLIPBOARD
// ============================================================
function getProjectContext() {
  const p = formData;
  let ctx = '=== PROJECT CONTEXT ===\n';
  if (p.projectName) ctx += 'Project: ' + p.projectName + (p.projectCode ? ' (' + p.projectCode + ')' : '') + '\n';
  if (p.program) ctx += 'Program: ' + p.program + '\n';
  if (p.orgUnit) ctx += 'Organisation: ' + p.orgUnit + '\n';
  if (p.authors) ctx += 'Author: ' + p.authors + '\n';
  if (p.date) ctx += 'Date: ' + p.date + '\n';
  if (p.projectSponsorName) ctx += 'Sponsor: ' + p.projectSponsorName + (p.projectSponsorRole ? ', ' + p.projectSponsorRole : '') + '\n';
  const team = (p.projectTeam || []).filter(m => m.name).map(m => m.name + (m.role ? ' (' + m.role + ')' : ''));
  if (team.length) ctx += 'Team: ' + team.join(', ') + '\n';
  if (p.hmwQuestion) ctx += 'Problem (HMW): ' + p.hmwQuestion + '\n';
  else if (p.problemStatement) ctx += 'Problem: ' + p.problemStatement + '\n';
  if (p.strategicObjective) ctx += 'Strategic Objective: ' + p.strategicObjective + '\n';
  return ctx;
}

function copyPrompt(promptText, label) {
  navigator.clipboard.writeText(promptText).then(() => {
    showToast('📋 Copied "' + label + '" prompt to clipboard — paste into your AI tool.', 'success');
  }).catch(() => {
    // Fallback for older browsers / file:// protocol
    const ta = document.createElement('textarea');
    ta.value = promptText;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('📋 Copied "' + label + '" prompt to clipboard — paste into your AI tool.', 'success');
  });
}
