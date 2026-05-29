// ============================================================
// RENDER ALL SECTIONS (Parts 2 & 3)
// ============================================================
function renderAllSections() {
  const container = document.getElementById('form-container');
  container.innerHTML = '';

  // ── SECTION 1: Project Identity ──────────────────────────
  container.appendChild(makeSection(1, 's1', 'Project Identity',
    'Name, version, status, author and date', function(body) {

    const r1 = el('div', { class: 'field-row' });
    r1.appendChild(makeField('Project Name', true, false, false,
      makeInput('text', 'projectName', 'e.g. Training Services Digital Forms', formData.projectName),
      'The full name of the project as it will appear on the charter.'));
    r1.appendChild(makeField('Project Code / Reference', false, true, false,
      makeInput('text', 'projectCode', 'e.g. TS-2026-001', formData.projectCode),
      'Internal reference number if applicable.'));
    body.appendChild(r1);

    const r2 = el('div', { class: 'field-row three' });
    r2.appendChild(makeField('Version', true, false, false,
      makeInput('text', 'version', '0.1 Draft', formData.version)));
    r2.appendChild(makeField('Status', true, false, false,
      makeSelect('status', [['Draft','Draft'],['Endorsed','Endorsed'],['Approved','Approved']], formData.status)));
    r2.appendChild(makeField('Date', true, false, false,
      makeInput('date', 'date', '', formData.date)));
    body.appendChild(r2);

    const r3 = el('div', { class: 'field-row' });
    r3.appendChild(makeField('Author(s)', true, false, false,
      makeInput('text', 'authors', 'e.g. Jane Smith & Alex Lee', formData.authors),
      'Names of people who authored this charter.'));
    r3.appendChild(makeField('Organisation Unit', false, true, false,
      makeInput('text', 'orgUnit', 'e.g. Service Design, Technology Enablement', formData.orgUnit)));
    body.appendChild(r3);

    body.appendChild(makeField('Program / Portfolio', false, true, false,
      makeInput('text', 'program', 'e.g. Digital Transformation Program', formData.program),
      'The broader program or portfolio this project belongs to.'));
  }));

  // ── SECTION 2: Sponsors & Team ───────────────────────────
  container.appendChild(makeSection(2, 's2', 'Sponsors & Team',
    'Project sponsor, executive sponsors, and team members', function(body) {

    body.appendChild(el('p', { class: 'subsection-label' }, 'Project Sponsor'));
    const r1 = el('div', { class: 'field-row' });
    r1.appendChild(makeField('Sponsor Name', true, false, false,
      makeInput('text', 'projectSponsorName', 'e.g. Jane Smith', formData.projectSponsorName)));
    r1.appendChild(makeField('Sponsor Role / Title', true, false, false,
      makeInput('text', 'projectSponsorRole', 'e.g. Director, Service Design Centre', formData.projectSponsorRole)));
    body.appendChild(r1);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Executive Sponsors'));
    body.appendChild(el('p', { class: 'field-help' }, 'Add all executive sponsors with name and role.'));
    body.appendChild(makeRepeatableObjectList('execSponsors', [
      { key: 'name', placeholder: 'Name' },
      { key: 'role', placeholder: 'Role / Title' }
    ]));

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Project Team'));
    body.appendChild(el('p', { class: 'field-help' }, 'List all project team members with their roles.'));
    body.appendChild(makeRepeatableObjectList('projectTeam', [
      { key: 'name', placeholder: 'Name' },
      { key: 'role', placeholder: 'Role (e.g. Service Designer, UX Researcher, Delivery Lead)' }
    ]));

    const teamWarn = el('div', { id: 'warn-team-hcd', class: 'gap-warning hidden' });
    teamWarn.innerHTML = '<span class="warn-icon">⚠️</span><span>No HCD practitioner detected. Consider adding a Service Designer or UX Researcher.</span>';
    body.appendChild(teamWarn);

    const agileWarn = el('div', { id: 'warn-team-agile', class: 'gap-warning hidden' });
    agileWarn.innerHTML = '<span class="warn-icon">⚠️</span><span>No Product Owner or Delivery Lead detected. Agile projects need a clear backlog decision-maker.</span>';
    body.appendChild(agileWarn);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Sponsor Team'));
    body.appendChild(el('p', { class: 'field-help' }, 'Directors and senior stakeholders supporting the project.'));
    body.appendChild(makeRepeatableObjectList('sponsorTeam', [
      { key: 'name', placeholder: 'Name' },
      { key: 'role', placeholder: 'Role / Title' }
    ]));
  }));

  // ── SECTION 3: Problem & Context ─────────────────────────
  container.appendChild(makeSection(3, 's3', 'Problem & Context',
    'Problem description, who is affected, and HMW question', function(body) {

    body.appendChild(makeField('Problem Description (raw notes)', true, false, false,
      makeTextarea('problemRaw', 'Describe the problem in your own words — rough notes are fine.', formData.problemRaw, true),
      'Write freely. The AI skill will condense this into a clear problem statement.'));

    body.appendChild(makeField('Who is Affected', true, false, false,
      makeTextarea('whoAffected', 'e.g. Teachers submitting leave requests, students applying for enrolment…', formData.whoAffected),
      'HCD best practice: name the specific user groups affected, not just "stakeholders".'));

    body.appendChild(makeField('Current Pain Points', true, false, false,
      makeTextarea('painPoints', 'e.g. Manual paperwork takes 3 days, errors cause delays, no visibility of status…', formData.painPoints)));

    body.appendChild(makeField('Evidence / Data', false, false, true,
      makeTextarea('evidence', 'e.g. 160,000 forms processed manually per year, 28 forms identified for digitisation…', formData.evidence),
      'HCD best practice: link solutions to evidence. Include data, research findings, or user feedback.'));

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'AI Skills — Problem Framing'));

    const aiBar = el('div', { class: 'ai-skill-bar' });

    aiBar.appendChild(makeCopyPromptBtn('Synthesise Problem Statement', function() {
      return getProjectContext() +
        '\n=== TASK ===\n' +
        'You are an expert HCD practitioner working in Australian government.\n' +
        'Condense the following raw problem description into a clear, concise 2-3 sentence problem statement suitable for a government project charter.\n' +
        'Focus on: who is affected, what the problem is, and why it matters.\n' +
        'Do not use jargon. Write in plain English. Do not include a heading.\n' +
        '\n=== INPUTS ===\n' +
        'Raw problem description: ' + (formData.problemRaw || '(not yet entered)') + '\n' +
        'Who is affected: ' + (formData.whoAffected || '(not yet entered)') + '\n' +
        'Current pain points: ' + (formData.painPoints || '(not yet entered)') + '\n' +
        'Evidence/data: ' + (formData.evidence || '(not yet entered)') + '\n' +
        '\n=== OUTPUT FORMAT ===\n' +
        'Write 2-3 sentences only. No heading. No bullet points.';
    }));

    aiBar.appendChild(makeCopyPromptBtn('Generate HMW Question', function() {
      const source = formData.problemStatement || formData.problemRaw || '(problem not yet entered)';
      return getProjectContext() +
        '\n=== TASK ===\n' +
        'You are an expert HCD practitioner working in Australian government.\n' +
        'Based on the following problem statement, write ONE clear "How Might We" question.\n' +
        'The HMW question should be: broad enough to allow creative solutions, narrow enough to be actionable, and focused on the user experience.\n' +
        '\n=== INPUTS ===\n' +
        'Problem statement: ' + source + '\n' +
        'Who is affected: ' + (formData.whoAffected || '(not yet entered)') + '\n' +
        '\n=== OUTPUT FORMAT ===\n' +
        'Write only the HMW question itself, starting with "How might we…". Nothing else.';
    }));

    aiBar.appendChild(el('span', { class: 'ai-note' }, '📋 Click to copy a ready-made prompt — paste into ChatGPT, Claude, or Copilot, then paste the response into the field below.'));
    body.appendChild(aiBar);

    body.appendChild(makeField('Problem Statement (refined)', false, false, true,
      makeAIOutput('field-problemStatement', 'problemStatement', 'AI-generated problem statement will appear here — or write your own.'),
      'The concise problem statement. AI can generate this from your raw notes above.'));

    body.appendChild(makeField('How Might We Question', true, false, false,
      makeAIOutput('field-hmwQuestion', 'hmwQuestion', 'e.g. How might we enable stakeholders to request and update services digitally instead of through manual paperwork?'),
      'The HMW question is the core HCD problem framing. It appears as the Problem Statement in the charter.'));

    const hmwTip = el('div', { class: 'gap-warning info' });
    hmwTip.innerHTML = '<span class="warn-icon">💡</span><span>A good HMW question is neither too broad ("fix everything") nor too narrow ("add a button"). Aim for the sweet spot that opens up design possibilities.</span>';
    body.appendChild(hmwTip);
  }));

  // ── SECTION 4: Strategic Objective ───────────────────────
  container.appendChild(makeSection(4, 's4', 'Strategic Objective',
    'Align the project to strategy and write the objective statement', function(body) {

    body.appendChild(makeField('Strategic Context (raw notes)', true, false, false,
      makeTextarea('strategicContext', 'Describe how this project connects to departmental strategy, policy, or program goals…', formData.strategicContext, true),
      'Write freely. The AI will shape this into a formal objective statement.'));

    body.appendChild(makeField('Relevant Strategy / Policy', false, false, true,
      makeInput('text', 'relevantPolicy', 'e.g. Digital Strategy 2025, Disability Inclusion Policy, Service Charter', formData.relevantPolicy),
      'Name the specific strategy, policy, or program this project supports.'));

    body.appendChild(el('hr', { class: 'field-divider' }));
    const aiBar2 = el('div', { class: 'ai-skill-bar' });

    aiBar2.appendChild(makeCopyPromptBtn('Draft Strategic Objective', function() {
      return getProjectContext() +
        '\n=== TASK ===\n' +
        'You are a senior strategist experienced in Australian government public sector projects.\n' +
        'Write a strategic objective statement for a project charter based on the following context.\n' +
        'The statement should: align to organisational strategy, be outcome-focused, be 2-4 sentences, and use plain English.\n' +
        'Avoid buzzwords. Be specific about what will change and for whom. Do not include a heading.\n' +
        '\n=== INPUTS ===\n' +
        'Strategic context: ' + (formData.strategicContext || '(not yet entered)') + '\n' +
        'Relevant policy or strategy: ' + (formData.relevantPolicy || '(not yet entered)') + '\n' +
        'Problem being solved: ' + (formData.hmwQuestion || formData.problemStatement || formData.problemRaw || '(not yet entered)') + '\n' +
        '\n=== OUTPUT FORMAT ===\n' +
        'Write 2-4 sentences only. No heading. Plain English. Outcome-focused.';
    }));

    aiBar2.appendChild(el('span', { class: 'ai-note' }, '📋 Click to copy a ready-made prompt — paste into ChatGPT, Claude, or Copilot, then paste the response into the field below.'));
    body.appendChild(aiBar2);

    body.appendChild(makeField('Strategic Objective', true, false, false,
      makeAIOutput('field-strategicObjective', 'strategicObjective', 'e.g. Align digital systems with the service ecosystem to enable teams to accurately capture, access, use, transform, and analyse data…'),
      'The formal strategic objective statement for the charter. Review and edit the AI output.'));
  }));

  // ── SECTION 5: Success Measures ──────────────────────────
  container.appendChild(makeSection(5, 's5', 'Success Measures',
    'Program measures, project measures, baseline and target', function(body) {

    body.appendChild(el('p', { class: 'subsection-label' }, 'Program Success Measures'));
    body.appendChild(el('p', { class: 'field-help' }, 'Outcome-level measures — what changes for users and the organisation if this project succeeds?'));
    const pmList = el('div', { class: 'repeatable-list', id: 'list-programMeasures' });
    renderRepeatableList(pmList, 'programMeasures', 'e.g. Easier access for students and providers to Training Services support');
    body.appendChild(pmList);

    const uxWarn = el('div', { id: 'warn-ux-measure', class: 'gap-warning hidden' });
    uxWarn.innerHTML = '<span class="warn-icon">⚠️</span><span>No user experience measure detected. Consider adding a measure for user satisfaction, task completion rate, or time-on-task.</span>';
    body.appendChild(uxWarn);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Project Success Measures'));
    body.appendChild(el('p', { class: 'field-help' }, 'Output-level measures — what does this project specifically deliver?'));
    const projList = el('div', { class: 'repeatable-list', id: 'list-projectMeasures' });
    renderRepeatableList(projList, 'projectMeasures', 'e.g. Prioritise forms to be digitally designed based on needs, risks and feasibility');
    body.appendChild(projList);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Baseline (Current State)'));
    body.appendChild(el('p', { class: 'field-help' }, 'For each key metric, record where you are now.'));
    body.appendChild(makeRepeatableObjectList('baselines', [
      { key: 'metric', placeholder: 'Metric (e.g. Forms processed manually)' },
      { key: 'value',  placeholder: 'Current value (e.g. 160,000 per year)' }
    ]));

    body.appendChild(el('p', { class: 'subsection-label mt-12' }, 'Target (Future State)'));
    body.appendChild(el('p', { class: 'field-help' }, 'Where do you want to be?'));
    body.appendChild(makeRepeatableObjectList('targets', [
      { key: 'metric', placeholder: 'Metric (e.g. Forms processed manually)' },
      { key: 'value',  placeholder: 'Target value (e.g. 0 — fully digital)' }
    ]));

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(makeField('How Will Success Be Measured?', false, false, true,
      makeTextarea('measurementMethod', 'e.g. User satisfaction surveys post-launch, form processing time tracked in Salesforce, quarterly reporting to steering committee…', formData.measurementMethod),
      'Agile best practice: define measurement methods upfront so you know how to collect data during delivery.'));
  }));

  // ── SECTION 6: Scope ─────────────────────────────────────
  container.appendChild(makeSection(6, 's6', 'Scope',
    'In scope, out of scope, and contingencies', function(body) {

    body.appendChild(el('p', { class: 'subsection-label' }, 'In Scope'));
    const inList = el('div', { class: 'repeatable-list', id: 'list-inScope' });
    renderRepeatableList(inList, 'inScope', 'e.g. Future state customer experience journey mapping');
    body.appendChild(inList);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Out of Scope'));
    body.appendChild(el('p', { class: 'field-help' }, 'Agile best practice: explicitly stating what is out of scope prevents scope creep.'));
    const outList = el('div', { class: 'repeatable-list', id: 'list-outScope' });
    renderRepeatableList(outList, 'outScope', 'e.g. CRM Salesforce single view solution');
    body.appendChild(outList);

    const outWarn = el('div', { id: 'warn-no-out-scope', class: 'gap-warning hidden' });
    outWarn.innerHTML = '<span class="warn-icon">⚠️</span><span>No out-of-scope items listed. Explicitly stating what is out of scope prevents scope creep in Agile delivery.</span>';
    body.appendChild(outWarn);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Contingencies & Assumptions'));
    const conList = el('div', { class: 'repeatable-list', id: 'list-contingencies' });
    renderRepeatableList(conList, 'contingencies', 'e.g. BA to complete functional requirements with Design team');
    body.appendChild(conList);
  }));

  // ── SECTION 7: Risks & Mitigations ───────────────────────
  container.appendChild(makeSection(7, 's7', 'Risks & Mitigations',
    'Known risks, mitigations, and risk ratings', function(body) {

    body.appendChild(el('p', { class: 'field-help' }, 'Add all known risks. Include a mitigation strategy and a risk rating for each.'));
    body.appendChild(makeRepeatableObjectList('risks', [
      { key: 'risk',       placeholder: 'Risk description' },
      { key: 'mitigation', placeholder: 'Mitigation strategy' },
      { key: 'rating',     type: 'select', default: 'Medium',
        options: [['High','High'],['Medium','Medium'],['Low','Low']] }
    ]));

    const userRiskWarn = el('div', { id: 'warn-no-user-risk', class: 'gap-warning hidden' });
    userRiskWarn.innerHTML = '<span class="warn-icon">⚠️</span><span>Consider adding a risk around access to users for research and testing — this is a common HCD project risk.</span>';
    body.appendChild(userRiskWarn);

    const aiBar3 = el('div', { class: 'ai-skill-bar mt-12' });

    aiBar3.appendChild(makeCopyPromptBtn('Enhance Risks with AI', function() {
      const riskText = (formData.risks || []).filter(r => r.risk)
        .map((r, i) => (i+1) + '. Risk: ' + r.risk + (r.mitigation ? '\n   Mitigation: ' + r.mitigation : '\n   Mitigation: (none provided)') + '\n   Rating: ' + (r.rating || 'not rated'))
        .join('\n') || '(no risks entered yet)';
      return getProjectContext() +
        '\n=== TASK ===\n' +
        'You are a risk analyst experienced in government digital projects and HCD.\n' +
        'Review the following risks for a government service design project and:\n' +
        '1. Suggest a risk rating (High/Medium/Low) for each if not already rated\n' +
        '2. Suggest a mitigation strategy if none is provided\n' +
        '3. List any common HCD or Agile project risks that appear to be missing\n' +
        'Be concise and practical.\n' +
        '\n=== CURRENT RISKS ===\n' + riskText + '\n' +
        '\n=== OUTPUT FORMAT ===\n' +
        'For each risk: Risk | Mitigation | Rating\n' +
        'Then list any missing risks as: MISSING: [risk description] | [suggested mitigation] | [rating]';
    }));

    aiBar3.appendChild(el('span', { class: 'ai-note' }, '📋 Click to copy a ready-made prompt — paste into ChatGPT, Claude, or Copilot, then update your risk rows above.'));
    body.appendChild(aiBar3);

    body.appendChild(makeField('AI Risk Analysis', false, true, false,
      makeAIOutput('field-riskEnhancement', 'riskEnhancement', 'AI risk analysis will appear here — use it to update your risk table above.'),
      'Review the AI suggestions and manually update your risk rows above.'));
  }));

  // ── SECTION 8: Timeline & Milestones ─────────────────────
  container.appendChild(makeSection(8, 's8', 'Timeline & Milestones',
    'Project phases, dates, and key milestones', function(body) {

    body.appendChild(el('p', { class: 'subsection-label' }, 'Project Phases'));
    body.appendChild(el('p', { class: 'field-help' }, 'Add each phase with start date, end date, and duration. Use HCD phase names where applicable (Discover, Define, Develop, Deliver).'));
    body.appendChild(makeRepeatableObjectList('phases', [
      { key: 'phase',    placeholder: 'Phase name (e.g. Discovery)' },
      { key: 'start',    placeholder: 'Start (e.g. 1 Apr)' },
      { key: 'end',      placeholder: 'End (e.g. 30 Apr)' },
      { key: 'duration', placeholder: 'Duration (e.g. 4 weeks)' }
    ]));

    const discoveryWarn = el('div', { id: 'warn-no-discovery', class: 'gap-warning hidden' });
    discoveryWarn.innerHTML = '<span class="warn-icon">⚠️</span><span>No Discovery phase detected. HCD projects should include a research phase before defining solutions.</span>';
    body.appendChild(discoveryWarn);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Key Milestones'));
    body.appendChild(makeRepeatableObjectList('milestones', [
      { key: 'milestone', placeholder: 'Milestone (e.g. Synthesis playback to steering committee)' },
      { key: 'date',      placeholder: 'Date (e.g. 30 Apr 2026)' }
    ]));

    const aiBar4 = el('div', { class: 'ai-skill-bar mt-12' });

    aiBar4.appendChild(makeCopyPromptBtn('Format Timeline with AI', function() {
      const phaseText = (formData.phases || []).filter(p => p.phase)
        .map(p => '• ' + p.phase + (p.start ? ': ' + p.start : '') + (p.end ? ' – ' + p.end : '') + (p.duration ? ' (' + p.duration + ')' : ''))
        .join('\n') || '(no phases entered yet)';
      const milestoneText = (formData.milestones || []).filter(m => m.milestone)
        .map(m => '• ' + m.milestone + (m.date ? ' — ' + m.date : ''))
        .join('\n') || '(none)';
      return getProjectContext() +
        '\n=== TASK ===\n' +
        'You are a project manager experienced in Agile and HCD delivery for Australian government.\n' +
        'Format the following project phases into a clear, structured timeline summary suitable for a project charter.\n' +
        'For each phase, include: phase name, indicative dates, duration, and 2-3 key activities.\n' +
        'Use the Double Diamond HCD model as a reference (Discover, Define, Develop, Deliver).\n' +
        'Flag if any standard HCD phases appear to be missing.\n' +
        'Be concise — this is for a one-page charter.\n' +
        '\n=== PHASES ENTERED ===\n' + phaseText + '\n' +
        '\n=== MILESTONES ===\n' + milestoneText + '\n' +
        '\n=== OUTPUT FORMAT ===\n' +
        'Bullet list of phases with dates and 2-3 key activities each. Flag any missing HCD phases at the end.';
    }));

    aiBar4.appendChild(el('span', { class: 'ai-note' }, '📋 Click to copy a ready-made prompt — paste into ChatGPT, Claude, or Copilot, then paste the response into the field below.'));
    body.appendChild(aiBar4);

    body.appendChild(makeField('Timeline Summary (AI formatted)', false, true, false,
      makeAIOutput('field-timelineSummary', 'timelineSummary', 'AI-formatted timeline summary will appear here.'),
      'Use this as the timeline narrative in the charter. Review and edit as needed.'));
  }));

  // ── SECTION 9: Dependencies & Stakeholders ───────────────
  container.appendChild(makeSection(9, 's9', 'Dependencies & Stakeholders',
    'Key dependencies and stakeholder influence/interest', function(body) {

    body.appendChild(el('p', { class: 'subsection-label' }, 'Key Dependencies'));
    body.appendChild(el('p', { class: 'field-help' }, 'What does this project depend on to succeed? Include people, systems, decisions, and other projects.'));
    const depList = el('div', { class: 'repeatable-list', id: 'list-dependencies' });
    renderRepeatableList(depList, 'dependencies', 'e.g. Workshop availability of relevant TS stakeholders and subject matter experts');
    body.appendChild(depList);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(el('p', { class: 'subsection-label' }, 'Key Stakeholders'));
    body.appendChild(el('p', { class: 'field-help' }, 'HCD best practice: map stakeholders by their interest in the project and their influence over it.'));
    body.appendChild(makeRepeatableObjectList('stakeholders', [
      { key: 'name',     placeholder: 'Name or group (e.g. Teachers, CIO office)' },
      { key: 'interest', placeholder: 'Interest / role in project' },
      { key: 'influence', type: 'select', default: 'Medium',
        options: [['High','High influence'],['Medium','Medium influence'],['Low','Low influence']] }
    ]));

    const endUserWarn = el('div', { id: 'warn-no-end-users', class: 'gap-warning hidden' });
    endUserWarn.innerHTML = '<span class="warn-icon">⚠️</span><span>No end users listed as stakeholders. HCD requires direct engagement with the people affected by the project (students, teachers, parents, etc.).</span>';
    body.appendChild(endUserWarn);
  }));

  // ── SECTION 10: HCD & Agile Considerations ───────────────
  container.appendChild(makeSection(10, 's10', 'HCD & Agile Considerations',
    'Best practice additions — research approach, accessibility, ways of working', function(body) {

    const bestPracticeBanner = el('div', { class: 'gap-warning info' });
    bestPracticeBanner.innerHTML = '<span class="warn-icon">💡</span><span>These fields are not in the standard charter template but represent HCD and Agile best practice. They are recommended for all HCD projects.</span>';
    body.appendChild(bestPracticeBanner);

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(makeField('Research Approach', false, false, true,
      makeTextarea('researchApproach', 'e.g. Semi-structured interviews with teachers and students, contextual inquiry in schools, co-design workshops with service staff…', formData.researchApproach),
      'What HCD research methods will be used? When will research happen in the project timeline?'));

    body.appendChild(makeField('User Groups to Engage', false, false, true,
      makeInput('text', 'userGroupsText', 'e.g. Teachers, students, parents, principals, departmental staff', formData.userGroupsText || (formData.userGroups || []).join(', ')),
      'Who will be involved in research, co-design, and testing?'));

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(makeField('Accessibility Requirements', false, false, true,
      makeTextarea('accessibilityReqs', 'e.g. All digital outputs must meet WCAG 2.1 AA minimum. Screen reader compatibility required. Colour contrast ratios to be tested.', formData.accessibilityReqs),
      'All digital products should meet WCAG 2.1 AA minimum.'));

    const a11yWarn = el('div', { id: 'warn-no-a11y', class: 'gap-warning hidden' });
    a11yWarn.innerHTML = '<span class="warn-icon">⚠️</span><span>No accessibility requirements noted. Digital projects should meet WCAG 2.1 AA minimum. Add this before submitting the charter.</span>';
    body.appendChild(a11yWarn);

    body.appendChild(makeField('Privacy & Data Handling', false, false, true,
      makeTextarea('privacyNotes', 'e.g. All research participants will provide informed consent. Raw interview notes will be de-identified before analysis. Data stored in approved systems only.', formData.privacyNotes),
      'Critical for research involving students and teachers. Include consent, de-identification, and storage approach.'));

    body.appendChild(el('hr', { class: 'field-divider' }));
    body.appendChild(makeField('Definition of Done', false, false, true,
      makeTextarea('definitionOfDone', 'e.g. All user stories accepted by Product Owner, accessibility tested, documentation complete, handoff to implementation team signed off…', formData.definitionOfDone),
      'Agile best practice: define what "complete" means for this project upfront to prevent ambiguity.'));

    body.appendChild(makeField('Ways of Working', false, false, true,
      makeTextarea('waysOfWorking', 'e.g. 2-week sprints, daily standups, fortnightly sprint reviews with stakeholders, monthly steering committee updates…', formData.waysOfWorking),
      'Agile cadence: sprint length, ceremonies, team norms, and communication rhythms.'));

    body.appendChild(makeField('Governance & Decision Rights', false, false, true,
      makeTextarea('governanceNotes', 'e.g. Scope changes require Project Sponsor approval. Budget variations >10% require Executive Sponsor sign-off. Design decisions made by Service Designer with Product Owner.', formData.governanceNotes),
      'Who can approve scope changes, budget variations, and design decisions? Prevents delays during delivery.'));
  }));

  // Open section 1 by default
  openSection('s1');
  updateAIButtons();
  checkGapWarnings();
}

function renderPreview() {
  checkGapWarnings();
  const p = formData;
  const preview = document.getElementById('charter-preview');
  if (!preview) return;

  const execList = (p.execSponsors || []).filter(s => s.name).map(s => s.name + (s.role ? ' (' + s.role + ')' : '')).join(', ') || '—';
  const teamList = (p.projectTeam || []).filter(m => m.name).map(m => m.name + (m.role ? ' — ' + m.role : '')).join(', ') || '—';
  const sponsorTeamList = (p.sponsorTeam || []).filter(m => m.name).map(m => m.name + (m.role ? ' (' + m.role + ')' : '')).join(', ');
  const inScopeList = (p.inScope || []).filter(s => s).map(s => '• ' + s).join('<br>') || '<span class="cp-placeholder">—</span>';
  const outScopeList = (p.outScope || []).filter(s => s).map(s => '• ' + s).join('<br>') || '<span class="cp-placeholder">—</span>';
  const contingList = (p.contingencies || []).filter(s => s).map(s => '• ' + s).join('<br>') || '<span class="cp-placeholder">—</span>';
  const riskRows = (p.risks || []).filter(r => r.risk).map(r =>
    '<tr><td style="padding:3px 6px;border:1px solid #e5e7eb;">' + r.risk + '</td><td style="padding:3px 6px;border:1px solid #e5e7eb;">' + (r.mitigation || '—') + '</td><td style="padding:3px 6px;border:1px solid #e5e7eb;font-weight:600;color:' + (r.rating === 'High' ? '#d9534f' : r.rating === 'Low' ? '#5cb85c' : '#f0ad4e') + '">' + (r.rating || 'Medium') + '</td></tr>'
  ).join('');
  const phaseList = (p.phases || []).filter(ph => ph.phase).map(ph => '• ' + ph.phase + (ph.start ? ': ' + ph.start : '') + (ph.end ? ' – ' + ph.end : '') + (ph.duration ? ' (' + ph.duration + ')' : '')).join('<br>') || '<span class="cp-placeholder">—</span>';
  const depList = (p.dependencies || []).filter(d => d).map(d => '• ' + d).join('<br>') || '<span class="cp-placeholder">—</span>';
  const pmList = (p.programMeasures || []).filter(m => m).map(m => '• ' + m).join('<br>') || '<span class="cp-placeholder">—</span>';
  const projMList = (p.projectMeasures || []).filter(m => m).map(m => '• ' + m).join('<br>') || '<span class="cp-placeholder">—</span>';

  preview.innerHTML =
    '<div class="cp-header">' +
      '<h2>' + (p.projectName || '<span class="cp-placeholder">Project name…</span>') + '</h2>' +
      '<p>' + [p.version, p.status, p.authors, p.date].filter(Boolean).join(' · ') + '</p>' +
    '</div>' +
    '<div class="cp-sponsors">' +
      '<div><strong>Project Sponsor:</strong> ' + (p.projectSponsorName ? p.projectSponsorName + (p.projectSponsorRole ? ', ' + p.projectSponsorRole : '') : '<span class="cp-placeholder">—</span>') + '</div>' +
      '<div><strong>Executive Sponsors:</strong> ' + execList + '</div>' +
    '</div>' +
    '<div class="cp-team"><strong>Project team:</strong> ' + teamList + (sponsorTeamList ? '<br><strong>Sponsor team:</strong> ' + sponsorTeamList : '') + '</div>' +
    '<div class="cp-section"><div class="cp-section-title">Problem Statement</div><div class="cp-section-body">' + (p.hmwQuestion || p.problemStatement || '<span class="cp-placeholder">HMW question will appear here…</span>') + '</div></div>' +
    '<div class="cp-section"><div class="cp-section-title">Strategic Objective</div><div class="cp-section-body">' + (p.strategicObjective || '<span class="cp-placeholder">Strategic objective will appear here…</span>') + '</div></div>' +
    '<div class="cp-section"><div class="cp-grid">' +
      '<div><div class="cp-section-title" style="margin:-8px -14px 8px;">Program Success Measures</div>' + pmList + '<br><br><strong style="font-size:0.68rem;">Project Measures:</strong><br>' + projMList + '</div>' +
      '<div><div class="cp-section-title" style="margin:-8px -14px 8px;">Scope</div><strong style="font-size:0.68rem;">In scope:</strong><br>' + inScopeList + '<br><br><strong style="font-size:0.68rem;">Out of scope:</strong><br>' + outScopeList + '<br><br><strong style="font-size:0.68rem;">Contingencies:</strong><br>' + contingList + '</div>' +
    '</div></div>' +
    (riskRows ? '<div class="cp-section"><div class="cp-section-title">Risks</div><div class="cp-section-body"><table style="width:100%;border-collapse:collapse;font-size:0.68rem;"><tr style="background:#f3f4f6;"><th style="padding:3px 6px;border:1px solid #e5e7eb;text-align:left;">Risk</th><th style="padding:3px 6px;border:1px solid #e5e7eb;text-align:left;">Mitigation</th><th style="padding:3px 6px;border:1px solid #e5e7eb;text-align:left;">Rating</th></tr>' + riskRows + '</table></div></div>' : '') +
    '<div class="cp-section"><div class="cp-grid">' +
      '<div><div class="cp-section-title" style="margin:-8px -14px 8px;">Indicative Timeline</div>' + phaseList + '</div>' +
      '<div><div class="cp-section-title" style="margin:-8px -14px 8px;">Dependencies &amp; Stakeholders</div>' + depList + '</div>' +
    '</div></div>';

  updateProgress();
}

