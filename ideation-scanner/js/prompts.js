// ============================================================
// PROMPTS — Two-stage agentic workflow for Innovative Ideation Scan
// Stage 1: Global Innovation Scanner
// Stage 2: Ideation & Unpacking Engine
// ============================================================

// ── SCAN FOCUS OPTIONS ──────────────────────────────────────
const SCAN_FOCUS_OPTIONS = [
  { value: 'all',             label: 'All Sectors' },
  { value: 'public-sector',   label: 'Public Sector / Government' },
  { value: 'tech-saas',       label: 'Tech / SaaS' },
  { value: 'healthcare',      label: 'Healthcare' },
  { value: 'education',       label: 'Education' },
  { value: 'financial',       label: 'Financial Services' },
  { value: 'cross-industry',  label: 'Cross-Industry Innovation' },
  { value: 'global-best',     label: 'Global Best Practice' },
];

// ── STAGE 1: GLOBAL INNOVATION SCANNER ──────────────────────

const STAGE1_SYSTEM_PROMPT = [
  'You are a Global Innovation Research Analyst specialising in Human-Centred Design (HCD), service design, and digital transformation.',
  '',
  'Your role is to conduct a deep "innovation scan" — drawing on your extensive knowledge of:',
  '- Global HCD and service design best practices (UK GDS, Singapore GovTech, IDEO, Nesta, etc.)',
  '- Digital transformation case studies across public and private sectors',
  '- Emerging design patterns, interaction paradigms, and UX innovations',
  '- Industry benchmarks and maturity models',
  '- Cross-industry analogies and transferable solutions',
  '',
  'You will be given:',
  '1. A PROJECT CONTEXT describing the current state, problem statement, user personas, and constraints',
  '2. HIGH-LEVEL OPPORTUNITIES — raw solution ideas or improvement areas identified by the team',
  '3. A SCAN FOCUS indicating which sector lens to prioritise (may be "All Sectors")',
  '',
  'Your task:',
  '- Identify 4–6 relevant global best practices from organisations that have solved similar problems',
  '- Find 3–5 analogous solutions from related or different sectors',
  '- Surface 3–4 current design trends relevant to this problem space',
  '- Recommend 3–4 inspiration sources the team should explore',
  '- Be specific — name real organisations, real frameworks, real design patterns.',
  '- Every insight must be clearly connected back to the project context.',
  '',
  'IMPORTANT:',
  '- Respond with a JSON object ONLY. No markdown fencing, no preamble.',
  '- Keep descriptions concise (1-2 sentences each).',
  '',
  'JSON SCHEMA:',
  '{',
  '  "scan_summary": "<2-3 sentence overview>",',
  '  "best_practices": [',
  '    {',
  '      "title": "<practice name>",',
  '      "source_domain": "<org or country>",',
  '      "description": "<1-2 sentences>",',
  '      "relevance": "<1 sentence>",',
  '      "url_hint": "<URL or search term>"',
  '    }',
  '  ],',
  '  "analogous_solutions": [',
  '    {',
  '      "title": "<solution name>",',
  '      "sector": "<industry>",',
  '      "description": "<1-2 sentences>",',
  '      "transferable_insight": "<1 sentence>"',
  '    }',
  '  ],',
  '  "design_trends": [',
  '    {',
  '      "trend": "<trend name>",',
  '      "description": "<1 sentence>",',
  '      "application": "<1 sentence>"',
  '    }',
  '  ],',
  '  "inspiration_sources": [',
  '    {',
  '      "name": "<source name>",',
  '      "type": "<Report | Case Study | Framework | Tool | Book | Community>",',
  '      "why_relevant": "<1 sentence>"',
  '    }',
  '  ]',
  '}',
].join('\n');

/**
 * Build the user prompt for Stage 1.
 */
function buildStage1UserPrompt(context, opportunities, scanFocus) {
  const focusLabel = SCAN_FOCUS_OPTIONS.find(o => o.value === scanFocus)?.label || 'All Sectors';

  const parts = [
    '## PROJECT CONTEXT',
    '',
    context.trim(),
    '',
    '## HIGH-LEVEL OPPORTUNITIES',
    '',
    opportunities.trim(),
    '',
    '## SCAN FOCUS',
    '',
    focusLabel,
    '',
    '---',
    'Conduct your global innovation scan and respond with the JSON object only.',
  ];

  return parts.join('\n');
}


// ── STAGE 1 OUTPUT COMPRESSION ──────────────────────────────

/**
 * Compress Stage 1 output into a condensed summary for Stage 2.
 * This reduces the token count significantly while preserving key insights.
 */
function compressStage1ForStage2(stage1) {
  const lines = [];

  lines.push('INNOVATION SCAN INSIGHTS (condensed):');
  lines.push('');

  // Best practices — just title + relevance
  if (stage1.best_practices && stage1.best_practices.length > 0) {
    lines.push('Best Practices:');
    stage1.best_practices.forEach((bp, i) => {
      lines.push((i + 1) + '. ' + bp.title + ' (' + (bp.source_domain || '') + ') — ' + (bp.relevance || bp.description || ''));
    });
    lines.push('');
  }

  // Analogous solutions — just title + transferable insight
  if (stage1.analogous_solutions && stage1.analogous_solutions.length > 0) {
    lines.push('Analogous Solutions:');
    stage1.analogous_solutions.forEach((as, i) => {
      lines.push((i + 1) + '. ' + as.title + ' (' + (as.sector || '') + ') — ' + (as.transferable_insight || as.description || ''));
    });
    lines.push('');
  }

  // Design trends — just trend + application
  if (stage1.design_trends && stage1.design_trends.length > 0) {
    lines.push('Design Trends:');
    stage1.design_trends.forEach((dt, i) => {
      lines.push((i + 1) + '. ' + dt.trend + ' — ' + (dt.application || dt.description || ''));
    });
    lines.push('');
  }

  return lines.join('\n');
}


// ── STAGE 2: IDEATION & UNPACKING ENGINE ────────────────────

const STAGE2_SYSTEM_PROMPT = [
  'You are a Senior Service Designer and Product Strategist specialising in Human-Centred Design (HCD).',
  '',
  'Your role is to unpack high-level solution opportunities into detailed, actionable solution concepts with concrete features.',
  '',
  'You will be given:',
  '1. PROJECT CONTEXT — current state, problem, personas, constraints',
  '2. OPPORTUNITIES — raw solution ideas to unpack',
  '3. INNOVATION SCAN INSIGHTS — condensed best practices and trends from a research scan',
  '',
  'Your task:',
  '- Create one solution concept per opportunity',
  '- Each concept gets 3–4 concrete features (not more)',
  '- Each feature needs: name, description (1-2 sentences), HCD value prop (1 sentence), best practice reference, complexity (Low/Medium/High), rationale (1 sentence)',
  '- Add 2-3 cross-cutting themes and 2-3 risks with mitigations',
  '',
  'Complexity: Low = existing tools, <1 sprint | Medium = some new tooling, 1-3 sprints | High = significant new capability, 3+ sprints',
  '',
  'IMPORTANT:',
  '- Respond with JSON ONLY. No markdown fencing, no preamble.',
  '- Be concise — 1-2 sentences per field maximum.',
  '',
  'JSON SCHEMA:',
  '{',
  '  "solution_overview": "<2-3 sentences>",',
  '  "solution_concepts": [',
  '    {',
  '      "opportunity_source": "<which opportunity>",',
  '      "concept_name": "<name>",',
  '      "concept_description": "<2-3 sentences>",',
  '      "features": [',
  '        {',
  '          "feature_name": "<name>",',
  '          "description": "<1-2 sentences>",',
  '          "hcd_value_proposition": "<1 sentence>",',
  '          "best_practice_reference": "<which scan insight>",',
  '          "implementation_complexity": "<Low|Medium|High>",',
  '          "complexity_rationale": "<1 sentence>"',
  '        }',
  '      ]',
  '    }',
  '  ],',
  '  "cross_cutting_themes": [{"theme":"<name>","description":"<1 sentence>"}],',
  '  "risks_and_considerations": [{"risk":"<description>","mitigation":"<1 sentence>"}]',
  '}',
].join('\n');

/**
 * Build the user prompt for Stage 2 (single batch).
 * Uses compressed Stage 1 output to reduce token count.
 */
function buildStage2UserPrompt(context, opportunities, stage1, batchLabel) {
  const compressed = compressStage1ForStage2(stage1);

  const parts = [
    '## PROJECT CONTEXT',
    '',
    context.trim(),
    '',
    '## OPPORTUNITIES TO UNPACK' + (batchLabel ? ' (' + batchLabel + ')' : ''),
    '',
    opportunities.trim(),
    '',
    '## ' + compressed,
    '',
    '---',
    'Unpack each opportunity into a solution concept with 3-4 features. Respond with JSON only.',
  ];

  return parts.join('\n');
}

/**
 * Split opportunities text into batches of N items.
 * Detects numbered lists (1. 2. 3.) or bullet lists (- or *).
 * Returns array of strings, each containing up to batchSize items.
 */
function splitOpportunities(opportunitiesText, batchSize) {
  if (!batchSize || batchSize < 1) batchSize = 3;

  const text = opportunitiesText.trim();

  // Try to split on numbered list items (1. 2. 3. etc.)
  const numberedPattern = /(?:^|\n)\s*\d+[\.\)]\s+/;
  let items = [];

  if (numberedPattern.test(text)) {
    // Split on numbered items, keeping the content
    items = text.split(/(?=(?:^|\n)\s*\d+[\.\)]\s+)/m)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  } else if (/(?:^|\n)\s*[-*]\s+/.test(text)) {
    // Split on bullet items
    items = text.split(/(?=(?:^|\n)\s*[-*]\s+)/m)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  // If we couldn't parse items, or there are few enough, return as single batch
  if (items.length <= batchSize) {
    return [text];
  }

  // Chunk into batches
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize).join('\n'));
  }
  return batches;
}
