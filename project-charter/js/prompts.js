// ============================================================
// PROMPTS — AI charter field extraction from research notes
// ============================================================

const CHARTER_SYSTEM_PROMPT = [
  'You are an experienced project manager and service designer.',
  'You are helping a team draft a project charter from research notes, interview transcripts, or synthesis documents.',
  '',
  'You will be given:',
  '1. Research content (markdown format — may be interview notes, transcripts, observations, or synthesis documents)',
  '2. A list of charter sections to populate',
  '',
  'Your task:',
  '- Read the research content carefully and extract information relevant to each requested section.',
  '- Write in clear, professional language appropriate for a government project charter.',
  '- Be concise and specific — avoid vague generalisations.',
  '- For list fields (measures, scope items, risks): return 3–5 items unless the research clearly supports more or fewer.',
  '- For risks: always include a mitigation strategy and default rating to "Medium" unless evidence suggests otherwise.',
  '- If there is insufficient evidence for a field, use null for that field.',
  '- Do NOT invent information not supported by the research content.',
  '- Do NOT include markdown fencing, preamble, or explanation — return ONLY the JSON object.',
].join('\n');

// ── SECTION FIELD DEFINITIONS ────────────────────────────────

const CHARTER_SECTION_FIELDS = {

  problem: {
    label: 'Problem & Context',
    description: [
      'problemRaw: string — A 2–4 sentence description of the problem or challenge this project addresses, grounded in the research.',
      'whoAffected: string — Who is affected by this problem (user groups, staff, stakeholders).',
      'painPoints: string — Key pain points or friction points identified in the research (2–4 sentences or bullet points).',
      'evidence: string — Evidence or data points from the research that support the problem statement.',
      'hmwQuestion: string — A "How might we…" question that frames the design challenge (one sentence).',
    ].join('\n'),
    responseShape: {
      problemRaw:   'string or null',
      whoAffected:  'string or null',
      painPoints:   'string or null',
      evidence:     'string or null',
      hmwQuestion:  'string or null'
    }
  },

  strategic: {
    label: 'Strategic Objective',
    description: [
      'strategicContext: string — The broader strategic context or organisational driver for this project (2–3 sentences).',
      'relevantPolicy: string — Any relevant government policies, strategies, or frameworks mentioned in the research.',
      'strategicObjective: string — A clear, outcome-focused statement of what this project aims to achieve (1–2 sentences).',
    ].join('\n'),
    responseShape: {
      strategicContext:   'string or null',
      relevantPolicy:     'string or null',
      strategicObjective: 'string or null'
    }
  },

  measures: {
    label: 'Success Measures',
    description: [
      'programMeasures: array of strings — 3–5 program-level success measures (outcomes the broader program aims to achieve).',
      'projectMeasures: array of strings — 3–5 project-level success measures (specific, measurable outcomes for this project).',
    ].join('\n'),
    responseShape: {
      programMeasures: ['string'],
      projectMeasures: ['string']
    }
  },

  scope: {
    label: 'Scope',
    description: [
      'inScope: array of strings — 3–6 items that are explicitly within scope for this project.',
      'outScope: array of strings — 3–5 items that are explicitly out of scope (to manage expectations).',
    ].join('\n'),
    responseShape: {
      inScope:  ['string'],
      outScope: ['string']
    }
  },

  risks: {
    label: 'Risks',
    description: [
      'risks: array of objects — 3–5 risks identified from the research. Each object must have:',
      '  - risk: string (description of the risk)',
      '  - mitigation: string (how the risk will be managed)',
      '  - rating: "Low" | "Medium" | "High" (default to "Medium" unless evidence suggests otherwise)',
    ].join('\n'),
    responseShape: {
      risks: [{ risk: 'string', mitigation: 'string', rating: 'Low|Medium|High' }]
    }
  },

  hcd: {
    label: 'HCD & Agile Notes',
    description: [
      'researchApproach: string — The research or discovery approach used or planned (methods, participants, timeline).',
      'userGroupsText: string — The user groups or participant types involved in the research (comma-separated or short description).',
      'accessibilityReqs: string — Any accessibility requirements or considerations identified.',
      'privacyNotes: string — Any privacy, data handling, or consent considerations relevant to this project.',
    ].join('\n'),
    responseShape: {
      researchApproach: 'string or null',
      userGroupsText:   'string or null',
      accessibilityReqs:'string or null',
      privacyNotes:     'string or null'
    }
  }

};

// ── PROMPT BUILDER ────────────────────────────────────────────

function buildCharterPrompt(mdContent, selectedSections) {
  const sections = selectedSections
    .map((key) => CHARTER_SECTION_FIELDS[key])
    .filter(Boolean);

  if (sections.length === 0) {
    throw new Error('No valid sections selected for generation.');
  }

  const fieldDescriptions = sections
    .map((s) => '### ' + s.label + '\n' + s.description)
    .join('\n\n');

  // Build combined response shape
  const responseShape = {};
  sections.forEach((s) => {
    Object.assign(responseShape, s.responseShape);
  });

  return [
    'Please extract the following charter fields from the research content below.',
    '',
    'FIELDS TO POPULATE:',
    fieldDescriptions,
    '',
    'RESPONSE FORMAT (JSON only, no markdown fencing):',
    JSON.stringify(responseShape, null, 2),
    '',
    '---',
    'RESEARCH CONTENT:',
    mdContent
  ].join('\n');
}

// ── AI RESPONSE MERGER ────────────────────────────────────────
// Merges AI-returned JSON into formData, handling arrays and objects.
// Returns count of fields successfully populated.

function mergeCharterAiResponse(aiJson) {
  let filled = 0;

  const stringFields = [
    'problemRaw', 'whoAffected', 'painPoints', 'evidence', 'hmwQuestion',
    'strategicContext', 'relevantPolicy', 'strategicObjective',
    'researchApproach', 'userGroupsText', 'accessibilityReqs', 'privacyNotes'
  ];

  stringFields.forEach((key) => {
    if (aiJson[key] != null && typeof aiJson[key] === 'string' && aiJson[key].trim()) {
      formData[key] = aiJson[key].trim();
      filled++;
    }
  });

  // Array of strings
  ['programMeasures', 'projectMeasures', 'inScope', 'outScope'].forEach((key) => {
    if (Array.isArray(aiJson[key]) && aiJson[key].length > 0) {
      formData[key] = aiJson[key].filter((v) => v && typeof v === 'string' && v.trim());
      if (formData[key].length > 0) filled++;
    }
  });

  // Risks — array of objects
  if (Array.isArray(aiJson.risks) && aiJson.risks.length > 0) {
    const validRisks = aiJson.risks
      .filter((r) => r && typeof r === 'object' && r.risk)
      .map((r) => ({
        risk:       (r.risk || '').trim(),
        mitigation: (r.mitigation || '').trim(),
        rating:     ['Low', 'Medium', 'High'].includes(r.rating) ? r.rating : 'Medium'
      }));
    if (validRisks.length > 0) {
      formData.risks = validRisks;
      filled++;
    }
  }

  return filled;
}
