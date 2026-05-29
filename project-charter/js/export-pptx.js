// PPTX EXPORT — PptxGenJS
// ============================================================
function exportPPTX() {
  if (typeof PptxGenJS === 'undefined') {
    showToast('PptxGenJS library not loaded. Check your internet connection.', 'error');
    return;
  }
  const p = formData;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"

  // ── CONSTANTS ───────────────────────────────────────────
  const NAVY   = '1a3a5c';
  const NAVY2  = '2a5080';
  const WHITE  = 'FFFFFF';
  const LGREY  = 'F3F4F6';
  const DGREY  = '374151';
  const FONT   = 'Public Sans';

  // Slide dimensions: 13.33" wide × 7.5" tall
  const SLIDE_W = 13.33;
  const SLIDE_H = 7.5;
  const PAD     = 0.1;   // inner padding for text boxes

  // Two-column split: left ~70%, right ~30%
  const LEFT_W  = 9.25;
  const GAP     = 0.08;
  const RIGHT_X = LEFT_W + GAP;
  const RIGHT_W = SLIDE_W - RIGHT_X; // ~3.98"

  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };

  // ── HEADER BAR (y=0, h=0.55) ────────────────────────────
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 0.55,
    fill: { color: NAVY }
  });
  slide.addText('Project Charter: ' + (p.projectName || 'Untitled Project'), {
    x: PAD, y: 0.05, w: SLIDE_W - PAD * 2, h: 0.26,
    fontSize: 14, bold: true, color: WHITE, fontFace: FONT
  });
  const headerMeta = 'Version: ' + (p.version || '0.1 Draft') + '   |   ' + (p.status || 'Draft') + '   |   Author: ' + (p.authors || '') + '   ' + (p.date || '');
  slide.addText(headerMeta, {
    x: PAD, y: 0.32, w: SLIDE_W - PAD * 2, h: 0.18,
    fontSize: 7.5, color: 'AACCEE', fontFace: FONT
  });

  // ── SPONSOR BAR (y=0.55, h=0.32) ────────────────────────
  const SPONSOR_Y = 0.55;
  const SPONSOR_H = 0.32;
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: SPONSOR_Y, w: SLIDE_W / 2, h: SPONSOR_H,
    fill: { color: NAVY2 }
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: SLIDE_W / 2, y: SPONSOR_Y, w: SLIDE_W / 2, h: SPONSOR_H,
    fill: { color: NAVY2 }
  });
  const sponsorText = 'Project Sponsor: ' + (p.projectSponsorName || '—') + (p.projectSponsorRole ? ', ' + p.projectSponsorRole : '');
  const execText    = 'Executive Sponsors: ' + ((p.execSponsors || []).filter(s => s.name).map(s => s.name + (s.role ? ' (' + s.role + ')' : '')).join(', ') || '—');
  slide.addText(sponsorText, {
    x: PAD, y: SPONSOR_Y + 0.04, w: SLIDE_W / 2 - PAD * 2, h: SPONSOR_H - 0.06,
    fontSize: 8, bold: true, color: WHITE, fontFace: FONT
  });
  slide.addText(execText, {
    x: SLIDE_W / 2 + PAD, y: SPONSOR_Y + 0.04, w: SLIDE_W / 2 - PAD * 2, h: SPONSOR_H - 0.06,
    fontSize: 8, bold: true, color: WHITE, fontFace: FONT
  });

  // ── TEAM ROW (y=0.87, h=0.38) ───────────────────────────
  const TEAM_Y = SPONSOR_Y + SPONSOR_H;
  const TEAM_H = 0.38;
  const teamMembers = (p.projectTeam || []).filter(m => m.name).map(m => m.name + (m.role ? ' (' + m.role + ')' : '')).join(', ') || '—';
  const sponsorMembers = (p.sponsorTeam || []).filter(m => m.name).map(m => m.name + (m.role ? ' (' + m.role + ')' : '')).join(', ');
  const teamLines = [{ text: 'Project team: ', options: { bold: true } }, { text: teamMembers }];
  if (sponsorMembers) {
    teamLines.push({ text: '\nSponsor team: ', options: { bold: true } });
    teamLines.push({ text: sponsorMembers });
  }
  slide.addText(teamLines, {
    x: PAD, y: TEAM_Y + 0.04, w: SLIDE_W - PAD * 2, h: TEAM_H - 0.06,
    fontSize: 7.5, color: DGREY, fontFace: FONT, wrap: true
  });

  // ── PROBLEM STATEMENT (y=1.25, h=0.22 label + 0.30 text) ─
  const PROB_Y = TEAM_Y + TEAM_H;
  const PROB_LABEL_H = 0.22;
  const PROB_TEXT_H  = 0.30;
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: PROB_Y, w: SLIDE_W, h: PROB_LABEL_H,
    fill: { color: NAVY }
  });
  slide.addText('Problem Statement', {
    x: PAD, y: PROB_Y + 0.03, w: SLIDE_W - PAD * 2, h: PROB_LABEL_H - 0.04,
    fontSize: 8, bold: true, color: WHITE, fontFace: FONT
  });
  slide.addText(p.hmwQuestion || p.problemStatement || '—', {
    x: PAD, y: PROB_Y + PROB_LABEL_H + 0.04, w: SLIDE_W - PAD * 2, h: PROB_TEXT_H,
    fontSize: 8, color: DGREY, fontFace: FONT, wrap: true
  });

  // ── STRATEGIC OBJECTIVE ─────────────────────────────────
  const STRAT_Y = PROB_Y + PROB_LABEL_H + PROB_TEXT_H + 0.06;
  const STRAT_LABEL_H = 0.22;
  const STRAT_TEXT_H  = 0.44;
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: STRAT_Y, w: SLIDE_W, h: STRAT_LABEL_H,
    fill: { color: NAVY }
  });
  slide.addText('Strategic Objective', {
    x: PAD, y: STRAT_Y + 0.03, w: SLIDE_W - PAD * 2, h: STRAT_LABEL_H - 0.04,
    fontSize: 8, bold: true, color: WHITE, fontFace: FONT
  });
  slide.addText(p.strategicObjective || '—', {
    x: PAD, y: STRAT_Y + STRAT_LABEL_H + 0.04, w: SLIDE_W - PAD * 2, h: STRAT_TEXT_H,
    fontSize: 7.5, color: DGREY, fontFace: FONT, wrap: true
  });

  // ── TWO-COLUMN SECTION ───────────────────────────────────
  // Starts after strategic objective text
  const COL_Y = STRAT_Y + STRAT_LABEL_H + STRAT_TEXT_H + 0.08;
  // Footer at y=7.3, so available height for two-col section:
  const FOOTER_Y = 7.3;
  const COL_AVAIL = FOOTER_Y - COL_Y; // total height available

  // Left column: Measures (top) + Risks (bottom)
  // Right column: Scope (top) + Project Plan (middle) + Dependencies (bottom)
  // Split left col: measures gets 55%, risks gets 45%
  const MEAS_H  = COL_AVAIL * 0.50;
  const RISKS_H = COL_AVAIL * 0.50;

  // Right col: scope 48%, plan 28%, deps 24%
  const SCOPE_H = COL_AVAIL * 0.48;
  const PLAN_H  = COL_AVAIL * 0.28;
  const DEPS_H  = COL_AVAIL * 0.24;

  const LABEL_H = 0.22; // section header bar height

  // ── MEASURES (left, top) ────────────────────────────────
  const MEAS_Y = COL_Y;
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: MEAS_Y, w: LEFT_W, h: LABEL_H,
    fill: { color: NAVY }
  });
  slide.addText('Program & Project Success Measures', {
    x: PAD, y: MEAS_Y + 0.03, w: LEFT_W - PAD * 2, h: LABEL_H - 0.04,
    fontSize: 7.5, bold: true, color: WHITE, fontFace: FONT
  });

  // Build measures table: Program Outcomes | Project Measures | Baseline | Target
  const pmItems   = (p.programMeasures || []).filter(m => m);
  const projItems = (p.projectMeasures || []).filter(m => m);
  const baseItems = (p.baselines || []).filter(b => b.metric).map(b => b.metric + (b.value ? ': ' + b.value : ''));
  const targItems = (p.targets  || []).filter(t => t.metric).map(t => t.metric + (t.value ? ': ' + t.value : ''));
  const maxRows   = Math.max(pmItems.length, projItems.length, baseItems.length, targItems.length, 1);

  const measuresRows = [[
    { text: 'Program  Outcomes', options: { bold: true, fill: { color: LGREY }, fontSize: 7, fontFace: FONT, color: DGREY } },
    { text: 'Project Measures',  options: { bold: true, fill: { color: LGREY }, fontSize: 7, fontFace: FONT, color: DGREY } },
    { text: 'Baseline',          options: { bold: true, fill: { color: LGREY }, fontSize: 7, fontFace: FONT, color: DGREY } },
    { text: 'Target',            options: { bold: true, fill: { color: LGREY }, fontSize: 7, fontFace: FONT, color: DGREY } }
  ]];
  for (let i = 0; i < maxRows; i++) {
    measuresRows.push([
      { text: pmItems[i]   || '', options: { fontSize: 6.5, fontFace: FONT, color: DGREY, valign: 'top' } },
      { text: projItems[i] || '', options: { fontSize: 6.5, fontFace: FONT, color: DGREY, valign: 'top' } },
      { text: baseItems[i] || '', options: { fontSize: 6.5, fontFace: FONT, color: DGREY, valign: 'top' } },
      { text: targItems[i] || '', options: { fontSize: 6.5, fontFace: FONT, color: DGREY, valign: 'top' } }
    ]);
  }

  slide.addTable(measuresRows, {
    x: 0, y: MEAS_Y + LABEL_H, w: LEFT_W, h: MEAS_H - LABEL_H,
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    fill: { color: WHITE },
    colW: [LEFT_W * 0.28, LEFT_W * 0.28, LEFT_W * 0.22, LEFT_W * 0.22],
    autoPage: false
  });

  // ── RISKS (left, bottom) ─────────────────────────────────
  const RISKS_Y = MEAS_Y + MEAS_H;
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: RISKS_Y, w: LEFT_W, h: LABEL_H,
    fill: { color: NAVY }
  });
  slide.addText('Risks', {
    x: PAD, y: RISKS_Y + 0.03, w: LEFT_W - PAD * 2, h: LABEL_H - 0.04,
    fontSize: 7.5, bold: true, color: WHITE, fontFace: FONT
  });

  const riskRows = [[
    { text: 'Risk',       options: { bold: true, fill: { color: LGREY }, fontSize: 7, fontFace: FONT, color: DGREY } },
    { text: 'Mitigation', options: { bold: true, fill: { color: LGREY }, fontSize: 7, fontFace: FONT, color: DGREY } },
    { text: 'Rating',     options: { bold: true, fill: { color: LGREY }, fontSize: 7, fontFace: FONT, color: DGREY } }
  ]];
  const filteredRisks = (p.risks || []).filter(r => r.risk);
  if (filteredRisks.length === 0) {
    riskRows.push([
      { text: 'No risks recorded', options: { fontSize: 6.5, fontFace: FONT, color: DGREY } },
      { text: '', options: {} },
      { text: '', options: {} }
    ]);
  } else {
    filteredRisks.forEach(r => {
      const ratingColor = r.rating === 'High' ? 'D9534F' : r.rating === 'Low' ? '5CB85C' : 'F0AD4E';
      riskRows.push([
        { text: r.risk || '',       options: { fontSize: 6.5, fontFace: FONT, color: DGREY, valign: 'top' } },
        { text: r.mitigation || '', options: { fontSize: 6.5, fontFace: FONT, color: DGREY, valign: 'top' } },
        { text: r.rating || 'Medium', options: { fontSize: 6.5, fontFace: FONT, color: ratingColor, bold: true, valign: 'top' } }
      ]);
    });
  }

  slide.addTable(riskRows, {
    x: 0, y: RISKS_Y + LABEL_H, w: LEFT_W, h: RISKS_H - LABEL_H,
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    fill: { color: WHITE },
    colW: [LEFT_W * 0.40, LEFT_W * 0.45, LEFT_W * 0.15],
    autoPage: false
  });

  // ── SCOPE (right, top) ───────────────────────────────────
  const SCOPE_Y = COL_Y;
  slide.addShape(pptx.ShapeType.rect, {
    x: RIGHT_X, y: SCOPE_Y, w: RIGHT_W, h: LABEL_H,
    fill: { color: NAVY }
  });
  slide.addText('Scope', {
    x: RIGHT_X + PAD, y: SCOPE_Y + 0.03, w: RIGHT_W - PAD * 2, h: LABEL_H - 0.04,
    fontSize: 7.5, bold: true, color: WHITE, fontFace: FONT
  });

  // Build scope text with inline bold labels
  const inScopeItems  = (p.inScope  || []).filter(s => s).map(s => '• ' + s).join('\n') || '—';
  const outScopeItems = (p.outScope || []).filter(s => s).map(s => '• ' + s).join('\n') || '—';
  const contingItems  = (p.contingencies || []).filter(s => s).map(s => '• ' + s).join('\n') || '—';

  const scopeTextRuns = [
    { text: 'In scope:\n', options: { bold: true, fontSize: 6.5, fontFace: FONT, color: DGREY } },
    { text: inScopeItems + '\n\n', options: { fontSize: 6.5, fontFace: FONT, color: DGREY } },
    { text: 'Out of scope:\n', options: { bold: true, fontSize: 6.5, fontFace: FONT, color: DGREY } },
    { text: outScopeItems + '\n\n', options: { fontSize: 6.5, fontFace: FONT, color: DGREY } },
    { text: 'Contingencies:\n', options: { bold: true, fontSize: 6.5, fontFace: FONT, color: DGREY } },
    { text: contingItems, options: { fontSize: 6.5, fontFace: FONT, color: DGREY } }
  ];
  slide.addText(scopeTextRuns, {
    x: RIGHT_X + PAD, y: SCOPE_Y + LABEL_H + 0.04, w: RIGHT_W - PAD * 2, h: SCOPE_H - LABEL_H - 0.06,
    wrap: true, valign: 'top'
  });

  // ── INDICATIVE PROJECT PLAN (right, middle) ──────────────
  const PLAN_Y = SCOPE_Y + SCOPE_H;
  slide.addShape(pptx.ShapeType.rect, {
    x: RIGHT_X, y: PLAN_Y, w: RIGHT_W, h: LABEL_H,
    fill: { color: NAVY }
  });
  slide.addText('Indicative Project Plan', {
    x: RIGHT_X + PAD, y: PLAN_Y + 0.03, w: RIGHT_W - PAD * 2, h: LABEL_H - 0.04,
    fontSize: 7.5, bold: true, color: WHITE, fontFace: FONT
  });

  const phaseLines = (p.phases || []).filter(ph => ph.phase)
    .map(ph => '• ' + ph.phase + (ph.start ? ': ' + ph.start : '') + (ph.end ? ' – ' + ph.end : '') + (ph.duration ? ' (' + ph.duration + ')' : ''))
    .join('\n') || '—';

  slide.addText(phaseLines, {
    x: RIGHT_X + PAD, y: PLAN_Y + LABEL_H + 0.04, w: RIGHT_W - PAD * 2, h: PLAN_H - LABEL_H - 0.06,
    fontSize: 6.5, color: DGREY, fontFace: FONT, wrap: true, valign: 'top'
  });

  // ── DEPENDENCIES & STAKEHOLDERS (right, bottom) ──────────
  const DEPS_Y = PLAN_Y + PLAN_H;
  slide.addShape(pptx.ShapeType.rect, {
    x: RIGHT_X, y: DEPS_Y, w: RIGHT_W, h: LABEL_H,
    fill: { color: NAVY }
  });
  slide.addText('Dependencies & Stakeholders', {
    x: RIGHT_X + PAD, y: DEPS_Y + 0.03, w: RIGHT_W - PAD * 2, h: LABEL_H - 0.04,
    fontSize: 7.5, bold: true, color: WHITE, fontFace: FONT
  });

  const depsLines = (p.dependencies || []).filter(d => d).map(d => '• ' + d).join('\n') || '—';
  slide.addText(depsLines, {
    x: RIGHT_X + PAD, y: DEPS_Y + LABEL_H + 0.04, w: RIGHT_W - PAD * 2, h: DEPS_H - LABEL_H - 0.06,
    fontSize: 6.5, color: DGREY, fontFace: FONT, wrap: true, valign: 'top'
  });

  // ── FOOTER ──────────────────────────────────────────────
  slide.addText('Generated by HCD Project Charter Generator · ' + new Date().toLocaleDateString('en-AU'), {
    x: 0, y: FOOTER_Y, w: SLIDE_W, h: 0.18,
    fontSize: 6, color: '9CA3AF', fontFace: FONT, align: 'center'
  });

  // ── SAVE ────────────────────────────────────────────────
  const filename = 'charter-' + (p.projectName || 'draft').replace(/\s+/g, '-').toLowerCase() + '-' + (p.version || 'v0.1').replace(/\s+/g, '-').toLowerCase() + '.pptx';
  pptx.writeFile({ fileName: filename })
    .then(() => showToast('✅ PPTX exported: ' + filename, 'success'))
    .catch(err => showToast('PPTX export failed: ' + err.message, 'error'));
}

