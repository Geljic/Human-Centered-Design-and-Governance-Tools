// ============================================================
// PROMPTS — AI persona field extraction
// ============================================================

const PERSONA_SYSTEM_PROMPT = [
  'You are a UX researcher and service designer synthesising a user persona from research notes, interview transcripts, or observation data.',
  '',
  'You will be given:',
  '1. Research content (markdown format — may be interview notes, transcripts, observations, or synthesis documents)',
  '2. A list of persona fields to populate',
  '',
  'Your task:',
  '- Read the research content carefully and extract information relevant to each requested field.',
  '- Write in third-person (e.g. "Dave works with..." not "I work with...").',
  '- Keep bullet points concise — 1–2 sentences each, grounded in the research.',
  '- For the bio field: write 3–5 sentences describing who the person is, their context, and what they do day-to-day.',
  '- For contentSections: populate each section with 3–5 bullet points based on the research.',
  '- For attribute values: return integers 0–100 based on evidence in the research.',
  '  - 0 = strongly left label (e.g. Low / System)',
  '  - 100 = strongly right label (e.g. High / Customer)',
  '  - 50 = neutral / unclear from research',
  '- If there is insufficient evidence for a field, use null for that field.',
  '- Do NOT invent information not supported by the research content.',
  '- Do NOT include markdown fencing, preamble, or explanation — return ONLY the JSON object.',
].join('\n');

function buildPersonaPrompt(mdContent, selectedFields) {
  const fieldDescriptions = {
    name:            'name: The persona\'s first and last name (string)',
    role:            'role: Their job title or role (string)',
    team:            'team: Their team or organisational unit (string)',
    bio:             'bio: A 3–5 sentence third-person biography describing who they are and their day-to-day context (string)',
    contentSections: buildContentSectionsDescription(),
    attributes:      buildAttributesDescription()
  };

  const requestedFields = selectedFields
    .map((f) => fieldDescriptions[f])
    .filter(Boolean)
    .join('\n');

  const responseShape = buildResponseShape(selectedFields);

  return [
    'Please extract the following persona fields from the research content below.',
    '',
    'FIELDS TO POPULATE:',
    requestedFields,
    '',
    'RESPONSE FORMAT (JSON only, no markdown fencing):',
    responseShape,
    '',
    '---',
    'RESEARCH CONTENT:',
    mdContent
  ].join('\n');
}

function buildContentSectionsDescription() {
  const sections = (formData.contentSections || []);
  if (sections.length === 0) {
    return 'contentSections: Array of section objects with items populated from research';
  }
  const sectionList = sections.map((s) => `  - "${s.heading}": array of 3–5 bullet point strings`).join('\n');
  return [
    'contentSections: Populate the items for each of these sections based on the research:',
    sectionList,
    'Return as an object keyed by section heading, each value being an array of strings.'
  ].join('\n');
}

function buildAttributesDescription() {
  const attrs = (formData.attributes || []);
  if (attrs.length === 0) {
    return 'attributes: Object with integer values 0–100 for each attribute';
  }
  const attrList = attrs.map((a) => `  "${a.label}": integer (0=${a.leftLabel}, 100=${a.rightLabel})`).join('\n');
  return ['attributes: Object with integer values 0–100:', attrList].join('\n');
}

function buildResponseShape(selectedFields) {
  const parts = [];

  if (selectedFields.includes('name'))  parts.push('  "name": "..."');
  if (selectedFields.includes('role'))  parts.push('  "role": "..."');
  if (selectedFields.includes('team'))  parts.push('  "team": "..."');
  if (selectedFields.includes('bio'))   parts.push('  "bio": "..."');

  if (selectedFields.includes('contentSections')) {
    const sections = (formData.contentSections || []);
    const sectionShape = sections.map((s) =>
      `    "${s.heading}": ["...", "..."]`
    ).join(',\n');
    parts.push('  "contentSections": {\n' + sectionShape + '\n  }');
  }

  if (selectedFields.includes('attributes')) {
    const attrs = (formData.attributes || []);
    const attrShape = attrs.map((a) => `    "${a.label}": 50`).join(',\n');
    parts.push('  "attributes": {\n' + attrShape + '\n  }');
  }

  return '{\n' + parts.join(',\n') + '\n}';
}

// ── MERGE AI RESPONSE INTO formData ─────────────────────────
function mergeAiResponse(aiJson, selectedFields) {
  let filled = 0;

  selectedFields.forEach((field) => {
    const val = aiJson[field];
    if (val === null || val === undefined) return;

    if (field === 'contentSections' && typeof val === 'object' && !Array.isArray(val)) {
      // val is keyed by section heading
      formData.contentSections.forEach((section, i) => {
        const aiItems = val[section.heading];
        if (Array.isArray(aiItems) && aiItems.length > 0) {
          formData.contentSections[i].items = aiItems.filter((v) => typeof v === 'string' && v.trim());
          if (formData.contentSections[i].items.length === 0) formData.contentSections[i].items = [''];
          filled++;
        }
      });
    } else if (field === 'attributes' && typeof val === 'object' && !Array.isArray(val)) {
      formData.attributes.forEach((attr, i) => {
        const aiVal = val[attr.label];
        if (typeof aiVal === 'number') {
          formData.attributes[i].value = Math.max(0, Math.min(100, aiVal));
          filled++;
        }
      });
    } else if (typeof val === 'string' && val.trim()) {
      formData[field] = val.trim();
      filled++;
    }
  });

  return filled;
}
