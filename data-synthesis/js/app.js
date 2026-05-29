// ── CONSTANTS ──
const LS_PROXY      = 'hcd_synthesis_proxy_url';
const LS_KEY        = 'hcd_synthesis_api_key';
const LS_MODEL      = 'hcd_synthesis_model';
const LS_SKILLS_URL = 'hcd_synthesis_skills_url';
const LS_SP_HINT    = 'doe_synthesis_sharepoint_hint';

const DEFAULT_SKILLS_URL = 'https://raw.githubusercontent.com/Geljic/doe-synthesis-skills/main/skills';

const TOKEN_WARN_CHARS  = 150_000;
const TOKEN_LIMIT_CHARS = 750_000;
const FILE_LARGE_CHARS  = 50_000;

const TEXT_EXTS  = ['txt', 'md', 'vtt', 'docx'];
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

// ── SKILL DEFINITIONS ──
const SKILLS = [
  {
    slug: 'meeting-summary',
    icon: '📋',
    name: 'Meeting Summary',
    desc: 'Overview, key points, decisions & action items from a single meeting.',
  },
  {
    slug: 'action-items',
    icon: '✅',
    name: 'Action Items',
    desc: 'Extract every action, owner & due date — nothing else.',
  },
  {
    slug: 'pain-points',
    icon: '😤',
    name: 'Pain Points & Opportunities',
    desc: 'Surface friction, unmet needs & opportunities with evidence quotes.',
  },
  {
    slug: 'key-decisions',
    icon: '⚖️',
    name: 'Key Decisions',
    desc: 'Decisions made, rationale, who decided, and what was deferred.',
  },
  {
    slug: 'stakeholder-positions',
    icon: '🧭',
    name: 'Stakeholder Positions',
    desc: 'Map who said what — useful for alignment & conflict mapping.',
  },
  {
    slug: 'hcd-synthesis',
    icon: '🔬',
    name: 'HCD Synthesis',
    desc: 'Full HCD synthesis: themes, pain points, actions & data quality notes.',
  },
  {
    slug: 'custom',
    icon: '✏️',
    name: 'Custom Prompt',
    desc: 'Write your own system prompt — full control over the output.',
  },
];

// ── BUNDLED FALLBACKS ──
// These are used if the remote skill fetch fails.
const BUNDLED_SKILLS = {
  'meeting-summary': `You are a meeting analyst for an HCD team.

Produce a clear, structured summary of the meeting transcript or notes provided. Follow the output structure exactly. Do not invent content not present in the source.

Rules:
- Overview: 3–5 sentences on purpose, attendees, and main outcomes.
- Key Points Discussed: substantive topics only — not procedural chat.
- Decisions: only explicitly stated decisions — not implied ones.
- Action Items: only explicitly agreed actions, with owner and due date where mentioned.
- If de-identification is requested, replace speaker names with P1, P2, P3… in order of first appearance.
- Flag PII in Notes — do not redact.
- Output Markdown only. No preamble.

Output structure:

# Meeting Summary: [Meeting Name or Topic]
**Date:** [YYYY-MM-DD]
**Attendees:** [Names or P1, P2…]
**Summarised by:** Claude (HCD Data Synthesis Tool)
**Status:** DRAFT — requires review before distribution

---

## Overview
[3–5 sentences]

## Key Points Discussed
- [Point]

## Decisions Made
- [Decision] — [context]

## Action Items
- [ ] [Action] — [Owner] — [Due]

## Next Steps & Follow-ups
- [Item]

## Notes
[PII flags or blank]

---
*AI-generated summary. Review before distributing.*`,

  'action-items': `You are a meeting analyst for an HCD team.

Extract every action item, commitment, and follow-up task from the provided transcript or notes. Be exhaustive.

Rules:
- Only include explicitly stated or agreed actions. Do not infer.
- Capture: task, owner (or [Unassigned]), due date (or [No date set]).
- Group by owner if more than 6 items.
- If de-identification is requested, replace names with P1, P2, P3… in order of first appearance.
- Flag PII in Notes — do not redact.
- Output Markdown only. No preamble.

Output structure:

# Action Items: [Meeting Name or Topic]
**Date:** [YYYY-MM-DD]
**Extracted by:** Claude (HCD Data Synthesis Tool)
**Status:** DRAFT — verify with attendees

---

## Action Items

| # | Action | Owner | Due |
|---|--------|-------|-----|
| 1 | [Action] | [Owner or Unassigned] | [Date or No date set] |

## Deferred / Parked Items
- [Item] — [context]

## Notes
[PII flags or blank]

---
*AI-generated extraction. Verify with attendees before treating as the official action register.*`,

  'pain-points': `You are an HCD analyst for a service design and change team.

Extract pain points, friction, unmet needs, and opportunities from the provided transcript or notes.

Rules:
- Extract pain points explicitly stated or clearly implied. Do not invent.
- Include a verbatim quote as evidence (one sentence max) with speaker attribution.
- Map each pain point to an opportunity where evident. Leave blank if not.
- Categorise by theme (e.g. Process, Communication, Tools & Systems, Information, Support).
- Capture workarounds — strong signals of broken processes.
- If de-identification is requested, replace names with P1, P2, P3… in order of first appearance.
- Flag PII in Notes — do not redact.
- Output Markdown only. No preamble.

Output structure:

# Pain Points & Opportunities: [Session Name]
**Date:** [YYYY-MM-DD]
**Analysed by:** Claude (HCD Data Synthesis Tool)
**Status:** DRAFT — requires practitioner review

---

## Summary
[2–3 sentences on dominant pain themes and standout opportunities]

## Pain Points & Opportunities

| Theme | Pain Point | Evidence | Workaround | Opportunity |
|-------|-----------|----------|------------|-------------|
| [Theme] | [Pain point] | "[Quote]" — [Speaker/P1] | [Workaround or —] | [Opportunity or —] |

## Standout Signals
- [Most significant or repeated pain points]

## Notes
[PII flags or blank]

---
*AI-generated analysis. Practitioner review required before use in deliverables.*`,

  'key-decisions': `You are a meeting analyst for an HCD team.

Extract every decision made in the provided transcript or notes, along with rationale, who made it, and what was deferred.

Rules:
- Only include explicitly stated decisions — not discussion or suggestions.
- A decision = something agreed, approved, chosen, or confirmed.
- Capture: what was decided, rationale (if given), who decided, conditions/caveats.
- Capture deferred decisions and open questions separately.
- If de-identification is requested, replace names with P1, P2, P3… in order of first appearance.
- Flag PII in Notes — do not redact.
- Output Markdown only. No preamble.

Output structure:

# Key Decisions: [Meeting Name or Topic]
**Date:** [YYYY-MM-DD]
**Extracted by:** Claude (HCD Data Synthesis Tool)
**Status:** DRAFT — verify with attendees

---

## Decisions Made

### Decision 1: [Short title]
**What was decided:** [Description]
**Rationale:** [Why, if stated]
**Decided by:** [Name/role or P1, or "Group consensus"]
**Conditions / caveats:** [Any conditions, or "None stated"]

## Deferred Decisions
- **[Topic]** — [Why deferred and what's needed to resolve]

## Open Questions
- [Question] — [Context]

## Notes
[PII flags or blank]

---
*AI-generated extraction. Verify with attendees before treating as the official decision log.*`,

  'stakeholder-positions': `You are an HCD analyst for a service design and change team.

Map the positions, perspectives, concerns, and priorities of each stakeholder or speaker in the provided transcript or notes.

Rules:
- Identify each distinct speaker or stakeholder. Include roles if mentioned.
- For each: stated priorities, concerns, positions on key topics, tensions with others.
- Use verbatim quotes as evidence (one sentence max per quote).
- Capture alignment (where stakeholders agree) and divergence (where they conflict).
- Do not infer positions not stated. Mark unclear positions as "Not stated".
- If de-identification is requested, replace names with P1, P2, P3… in order of first appearance.
- Flag PII in Notes — do not redact.
- Output Markdown only. No preamble.

Output structure:

# Stakeholder Positions: [Meeting Name or Topic]
**Date:** [YYYY-MM-DD]
**Mapped by:** Claude (HCD Data Synthesis Tool)
**Status:** DRAFT — requires practitioner review

---

## Stakeholder Map

### [Name / P1] — [Role if known]
**Priorities:** [What they care most about]
**Concerns:** [What they're worried about]
**Key positions:**
- [Topic]: "[Quote or paraphrase]"

## Alignment & Divergence

### Areas of Agreement
- [Topic]: [Who agrees and what they agree on]

### Areas of Tension or Divergence
- [Topic]: [Who disagrees and what each position is]

## Notes
[PII flags or blank]

---
*AI-generated mapping. Practitioner review required before use in stakeholder engagement work.*`,

  'hcd-synthesis': `You are an HCD synthesis assistant for a service design and change team.

Synthesise the provided input into a structured HCD synthesis document for a single source — a research interview, co-design session, or stakeholder consultation. Follow the output structure exactly. Do not invent content not present in the source.

Rules:
- Extract themes explicitly supported by the source. Label each theme clearly.
- Include verbatim quotes as evidence (one sentence max).
- If de-identification is requested, replace speaker names with P1, P2, P3… in order of first appearance.
- Flag PII (names of non-staff, clients, vulnerable persons) in Data Quality Notes — do not redact.
- Flag data quality issues: crosstalk, inaudible sections, missing context.
- Do not summarise away disagreement or tension — preserve it.
- Action items: only explicitly agreed actions.
- Decisions: only explicitly stated decisions.
- Output Markdown only. No preamble.

Output structure:

# HCD Synthesis: [Session Name]
**Date:** [YYYY-MM-DD]
**Input type:** [Interview / Co-design / Consultation / Other]
**Synthesised by:** Claude (HCD Data Synthesis Tool)
**Status:** DRAFT — requires practitioner review before use

---

## Overview
[2–3 sentence summary]

## Key Themes

### [Theme 1]
[2–3 sentence description]
> "[Supporting quote]" — [Speaker or P1]

## Pain Points & Opportunities
| Pain Point | Evidence | Opportunity |
|-----------|----------|-------------|
| [Pain point] | "[Quote]" — [Speaker/P1] | [Opportunity or —] |

## Action Items
- [ ] [Action] — [Owner] — [Due]

## Decisions Made
- [Decision] — [Context]

## Data Quality Notes
[PII flags, crosstalk, gaps — or blank]

---
*This synthesis is AI-generated. Practitioner review is required before use in deliverables.*`,
};

// ── STATE ──
let currentSkill  = 'meeting-summary';
let lastOutput    = '';
let uploadedFiles = [];
let skillCache    = {};

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  // Restore settings
  document.getElementById('proxy-url').value  = localStorage.getItem(LS_PROXY)  || '';
  document.getElementById('api-key').value    = localStorage.getItem(LS_KEY)    || '';
  document.getElementById('model-name').value = localStorage.getItem(LS_MODEL)  || 'claude-sonnet-4-6';
  document.getElementById('skills-url').value = localStorage.getItem(LS_SKILLS_URL) || DEFAULT_SKILLS_URL;
  document.getElementById('sharepoint-hint-input').value = localStorage.getItem(LS_SP_HINT) || '';

  document.getElementById('session-date').value = new Date().toISOString().slice(0, 10);

  if (window.location.protocol === 'file:') {
    document.getElementById('cors-warning').classList.add('show');
  }

  if (!localStorage.getItem(LS_PROXY) || !localStorage.getItem(LS_KEY)) {
    openSettings();
  }

  // Render skill grid
  renderSkillGrid();

  // Wire up drop zone
  const dz = document.getElementById('dropzone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    dz.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    dz.classList.remove('dragover');
  }));
  dz.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

  document.getElementById('transcript-text').addEventListener('input', updateTokenEstimate);

  updateSharePointHint();
  updateTokenEstimate();
});

// ── SKILL GRID ──
function renderSkillGrid() {
  const grid = document.getElementById('skill-grid');
  grid.innerHTML = '';
  SKILLS.forEach(skill => {
    const btn = document.createElement('button');
    btn.className = 'skill-btn' + (skill.slug === currentSkill ? ' active' : '');
    btn.dataset.skill = skill.slug;
    btn.innerHTML = `
      <span class="skill-icon">${skill.icon}</span>
      <span class="skill-name">${skill.name}</span>
      <span class="skill-desc">${skill.desc}</span>`;
    btn.addEventListener('click', () => selectSkill(skill.slug));
    grid.appendChild(btn);
  });
  updateCustomPromptVisibility();
}

function selectSkill(slug) {
  currentSkill = slug;
  document.querySelectorAll('.skill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.skill === slug);
  });
  updateCustomPromptVisibility();
  updateTokenEstimate();
}

function updateCustomPromptVisibility() {
  const wrap = document.getElementById('custom-prompt-wrap');
  if (wrap) wrap.classList.toggle('show', currentSkill === 'custom');
}

// ── SETTINGS ──
function openSettings()  { document.getElementById('settings-modal').classList.add('open'); }
function closeSettings() { document.getElementById('settings-modal').classList.remove('open'); }

function saveSettings() {
  const url       = document.getElementById('proxy-url').value.trim().replace(/\/$/, '');
  const key       = document.getElementById('api-key').value.trim();
  const model     = document.getElementById('model-name').value.trim() || 'claude-sonnet-4-6';
  const skillsUrl = document.getElementById('skills-url').value.trim().replace(/\/$/, '');
  const spHint    = document.getElementById('sharepoint-hint-input').value.trim();
  if (!url || !key) { alert('Please enter both the proxy URL and your virtual key.'); return; }
  localStorage.setItem(LS_PROXY, url);
  localStorage.setItem(LS_KEY,   key);
  localStorage.setItem(LS_MODEL, model);
  localStorage.setItem(LS_SKILLS_URL, skillsUrl);
  localStorage.setItem(LS_SP_HINT, spHint);
  skillCache = {};
  closeSettings();
  setStatus('Settings saved.', 'success');
  updateSharePointHint();
}

// ── FILE HANDLING ──
function handleFileInput(ev) {
  handleFiles(ev.target.files);
  ev.target.value = '';
}

async function handleFiles(fileList) {
  for (const file of Array.from(fileList)) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (IMAGE_EXTS.includes(ext)) {
      try {
        const { dataUrl, base64 } = await readImage(file);
        uploadedFiles.push({
          name: file.name, size: file.size,
          text: '',
          image: true,
          base64,
          mimeType: IMAGE_MIME[ext] || 'image/png',
          dataUrl,
        });
      } catch (err) {
        uploadedFiles.push({ name: file.name, size: file.size, text: '', error: err.message || 'Image read failed' });
      }
      renderFileList();
      updateTokenEstimate();
      continue;
    }

    if (!TEXT_EXTS.includes(ext)) {
      uploadedFiles.push({ name: file.name, size: file.size, text: '', error: `Unsupported type: .${ext}` });
      renderFileList();
      continue;
    }

    try {
      const text = ext === 'docx' ? await readDocx(file) : await readText(file);
      const warn = text.length > FILE_LARGE_CHARS;
      uploadedFiles.push({ name: file.name, size: file.size, text, warn });
    } catch (err) {
      uploadedFiles.push({ name: file.name, size: file.size, text: '', error: err.message || 'Read failed' });
    }
    renderFileList();
    updateTokenEstimate();
  }
}

function readText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read text file'));
    r.readAsText(file);
  });
}

function readDocx(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        if (typeof mammoth === 'undefined') {
          reject(new Error('mammoth.js failed to load (check internet / CDN)'));
          return;
        }
        const result = await mammoth.extractRawText({ arrayBuffer: r.result });
        resolve(result.value || '');
      } catch (err) {
        reject(new Error('docx extraction failed: ' + err.message));
      }
    };
    r.onerror = () => reject(new Error('Could not read docx file'));
      r.readAsArrayBuffer(file);
    });
  }
  
  function readImage(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const dataUrl = r.result;
        const base64  = dataUrl.split(',')[1];
        resolve({ dataUrl, base64 });
      };
      r.onerror = () => reject(new Error('Could not read image file'));
      r.readAsDataURL(file);
    });
  }
  
  function removeFile(idx) {
  uploadedFiles.splice(idx, 1);
  renderFileList();
  updateTokenEstimate();
}

function renderFileList() {
  const ul = document.getElementById('file-list');
  ul.innerHTML = '';
  uploadedFiles.forEach((f, idx) => {
    const li = document.createElement('li');
    li.className = 'file-chip' + (f.error ? ' error' : (f.warn ? ' warn' : '') + (f.image ? ' image' : ''));

    let meta;
    if (f.error)      meta = f.error;
    else if (f.image) meta = `${formatBytes(f.size)} · image`;
    else              meta = `${formatBytes(f.size)} · ${f.text.length.toLocaleString()} chars` + (f.warn ? ' · large' : '');

    const thumb = f.image
      ? `<img class="fc-thumb" src="${f.dataUrl}" alt="${escapeHtml(f.name)}" />`
      : '';

    li.innerHTML = `
      ${thumb}
      <span class="fc-name">${escapeHtml(f.name)}</span>
      <span class="fc-meta">${escapeHtml(meta)}</span>
      <button type="button" class="fc-remove" title="Remove" onclick="removeFile(${idx})">✕</button>`;
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ── TOKEN ESTIMATE ──
function totalChars() {
  const fileChars  = uploadedFiles.reduce((sum, f) => sum + (f.text || '').length, 0);
  const pasteChars = document.getElementById('transcript-text').value.length;
  return fileChars + pasteChars;
}

function countSources() {
  let n = uploadedFiles.filter(f => !f.error && (f.text || f.image)).length;
  if (document.getElementById('transcript-text').value.trim()) n += 1;
  return n;
}

function countImages() {
  return uploadedFiles.filter(f => f.image && !f.error).length;
}

function updateTokenEstimate() {
  const chars   = totalChars();
  const imgs    = countImages();
  const sources = countSources();
  const el = document.getElementById('token-estimate');
  if (chars === 0 && imgs === 0) { el.textContent = 'No content yet'; el.className = ''; return; }
  const tokens = Math.round(chars / 4);
  const parts = [];
  if (chars > 0) parts.push(`~${tokens.toLocaleString()} input tokens · ${chars.toLocaleString()} chars`);
  if (imgs > 0)  parts.push(`${imgs} image${imgs === 1 ? '' : 's'}`);
  parts.push(`${sources} source${sources === 1 ? '' : 's'}`);
  let msg = parts.join(' · ');
  let cls = '';
  if (chars > TOKEN_LIMIT_CHARS) { msg += ' · ⚠ exceeds context limit'; cls = 'error'; }
  else if (chars > TOKEN_WARN_CHARS) { msg += ' · ⚠ large input'; cls = 'warn'; }
  el.textContent = msg;
  el.className = cls;
}

// ── BUILD CONTENT ──
// Returns { textContent: string, imageBlocks: [{base64, mimeType, name}] }
function buildCombinedContent() {
  const textBlocks  = [];
  const imageBlocks = [];
  let n = 1;

  uploadedFiles.forEach(f => {
    if (f.error) return;
    if (f.image) {
      imageBlocks.push({ base64: f.base64, mimeType: f.mimeType, name: f.name });
      return;
    }
    if (!f.text) return;
    textBlocks.push(`=== Source ${n}: ${f.name} ===\n\n${f.text.trim()}\n`);
    n++;
  });

  const pasted = document.getElementById('transcript-text').value.trim();
  if (pasted) textBlocks.push(`=== Source ${n}: pasted-text ===\n\n${pasted}\n`);

  return { textContent: textBlocks.join('\n'), imageBlocks };
}

// ── SKILL FETCH ──
async function loadSkill(skillSlug) {
  // Custom skill — use the textarea content directly
  if (skillSlug === 'custom') {
    const prompt = document.getElementById('custom-prompt').value.trim();
    if (!prompt) throw new Error('Please enter a custom prompt in the text area below the skill grid.');
    return prompt;
  }

  if (skillCache[skillSlug]) return skillCache[skillSlug];

  const baseUrl = (localStorage.getItem(LS_SKILLS_URL) || DEFAULT_SKILLS_URL).replace(/\/$/, '');
  const warnEl  = document.getElementById('skill-warning');
  warnEl.classList.remove('show');

  if (baseUrl) {
    try {
      const url = `${baseUrl}/${skillSlug}.md`;
      const r   = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = stripFrontmatter(await r.text());
      skillCache[skillSlug] = text;
      return text;
    } catch (err) {
      warnEl.textContent = `⚠ Could not fetch skill "${skillSlug}" from remote (${err.message}). Using bundled fallback.`;
      warnEl.classList.add('show');
    }
  }

  const bundled = BUNDLED_SKILLS[skillSlug];
  if (!bundled) throw new Error(`No bundled fallback for skill "${skillSlug}".`);
  skillCache[skillSlug] = stripFrontmatter(bundled);
  return skillCache[skillSlug];
}

function stripFrontmatter(md) {
  if (!md) return '';
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end > 0) return md.slice(end + 4).replace(/^\s+/, '');
  }
  return md;
}

// ── CONSOLIDATION PROMPT (used in multi-pass final step) ──
const CONSOLIDATION_PROMPT = `You are a synthesis analyst for an HCD team.

You have been given the skill outputs for multiple individual sources. Each output was produced by running the same skill against a single source file.

Your task is to produce a consolidated view across all sources. Specifically:

1. **What is consistent** — findings, themes, decisions, or action items that appear in two or more sources. Cite which sources.
2. **What differs or conflicts** — where sources diverge, contradict, or show different perspectives. Preserve the divergence — do not flatten it.
3. **What is unique** — findings that appear in only one source but are notable enough to flag.
4. **Consolidated output** — produce a single merged version of the skill output that integrates all sources, clearly attributing findings to their source where relevant.

Rules:
- Do not invent content not present in the per-source outputs.
- Preserve verbatim quotes from the per-source outputs where they are used as evidence.
- If de-identification was applied in the per-source pass, maintain it in the consolidated output.
- Output Markdown only. No preamble, no explanation — output the document directly.

Structure your output as:

# Consolidated [Skill Name]: [Session Name]
**Date:** [YYYY-MM-DD]
**Sources:** [list filenames]
**Consolidated by:** Claude (HCD Data Synthesis Tool — multi-pass)
**Status:** DRAFT — requires practitioner review before use

---

## Consistent Findings
[What appears across 2+ sources]

## Divergences & Conflicts
[Where sources differ — cite which source holds which position]

## Single-source Highlights
[Notable findings from individual sources only]

## Consolidated Output
[The merged skill output integrating all sources]

---
*AI-generated consolidation. Practitioner review is required before use in deliverables.*`;

// ── LITELLM CALL ──
// userContent can be a plain string OR an array of content blocks (for vision)
async function callLiteLLM(systemPrompt, userContent) {
  const proxyUrl = localStorage.getItem(LS_PROXY);
  const apiKey   = localStorage.getItem(LS_KEY);
  const model    = localStorage.getItem(LS_MODEL) || 'claude-sonnet-4-6';

  const response = await fetch(`${proxyUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      max_tokens: 4096,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HTTP ${response.status}: ${err}`);
  }
  const data    = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in response. Check the proxy response format.');
  return { content, tokens: data.usage?.total_tokens ?? 0 };
}

// ── SYNTHESISE ──
async function synthesise() {
  const proxyUrl = localStorage.getItem(LS_PROXY);
  const apiKey   = localStorage.getItem(LS_KEY);
  if (!proxyUrl || !apiKey) {
    openSettings();
    setStatus('Please configure your proxy URL and virtual key first.', 'error');
    return;
  }

  const date = document.getElementById('session-date').value;
  const name = document.getElementById('session-name').value.trim();
  if (!date || !name) { setStatus('Please fill in the date and session name.', 'error'); return; }

  if (countSources() === 0) { setStatus('Please upload at least one file or paste some content.', 'error'); return; }

  const btn = document.getElementById('synthesise-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Running…';
  clearOutput();

  try {
    setStatus('Loading skill…');
    const systemPrompt = await loadSkill(currentSkill);
    const deident      = document.getElementById('deidentify').value;
    const deidentLabel = deident === 'yes' ? 'Yes (use P1, P2, P3…)' : 'No';

    // ── Collect individual sources ──
    const sources = [];
    uploadedFiles.forEach(f => {
      if (f.error) return;
      if (f.image) sources.push({ name: f.name, image: true, base64: f.base64, mimeType: f.mimeType });
      else if (f.text) sources.push({ name: f.name, text: f.text });
    });
    const pasted = document.getElementById('transcript-text').value.trim();
    if (pasted) sources.push({ name: 'pasted-text', text: pasted });

    let totalTokens = 0;
    let output;

    if (sources.length <= 1) {
      // ── SINGLE-PASS: one source, run skill directly ──
      const src = sources[0];
      const textPrompt = [
        `Date: ${date}`,
        `Session name: ${name}`,
        `De-identify speakers: ${deidentLabel}`,
        `Source count: 1`,
        ``,
        `---`,
        src.text || '',
      ].join('\n');

      let userContent;
      if (src.image) {
        userContent = [
          { type: 'text', text: textPrompt },
          { type: 'image_url', image_url: { url: `data:${src.mimeType};base64,${src.base64}` } },
        ];
      } else {
        userContent = textPrompt;
      }

      setStatus('Sending to LiteLLM proxy…');
      const r = await callLiteLLM(systemPrompt, userContent);
      output = r.content;
      totalTokens = r.tokens;

    } else {
      // ── MULTI-PASS: run skill on each source, then consolidate ──
      const perSourceOutputs = [];

      for (let i = 0; i < sources.length; i++) {
        const src = sources[i];
        setStatus(`Pass 1 of 2 — processing source ${i + 1} of ${sources.length}: ${src.name}…`);

        const textPrompt = [
          `Date: ${date}`,
          `Session name: ${name} — source ${i + 1} of ${sources.length}`,
          `Source file: ${src.name}`,
          `De-identify speakers: ${deidentLabel}`,
          ``,
          `---`,
          src.text || '',
        ].join('\n');

        let userContent;
        if (src.image) {
          userContent = [
            { type: 'text', text: textPrompt },
            { type: 'image_url', image_url: { url: `data:${src.mimeType};base64,${src.base64}` } },
          ];
        } else {
          userContent = textPrompt;
        }

        const r = await callLiteLLM(systemPrompt, userContent);
        perSourceOutputs.push(`=== Source ${i + 1}: ${src.name} ===\n\n${r.content.trim()}\n`);
        totalTokens += r.tokens;
      }

      // ── Consolidation pass ──
      setStatus(`Pass 2 of 2 — consolidating ${sources.length} sources…`);
      const skillName = SKILLS.find(s => s.slug === currentSkill)?.name || currentSkill;
      const consolidationUserPrompt = [
        `Skill applied: ${skillName}`,
        `Date: ${date}`,
        `Session name: ${name}`,
        `De-identify speakers: ${deidentLabel}`,
        `Source count: ${sources.length}`,
        `Source files: ${sources.map(s => s.name).join(', ')}`,
        ``,
        `Below are the per-source skill outputs. Consolidate them per your instructions.`,
        ``,
        `---`,
        perSourceOutputs.join('\n'),
      ].join('\n');

      const r = await callLiteLLM(CONSOLIDATION_PROMPT, consolidationUserPrompt);
      output = r.content;
      totalTokens += r.tokens;
    }

    lastOutput = output;
    showOutput(output);
    const passLabel = sources.length > 1 ? ` (${sources.length}-source multi-pass)` : '';
    setStatus(`Done${passLabel}. Tokens used: ${totalTokens.toLocaleString()}`, 'success');
    document.getElementById('download-btn').disabled = false;
    document.getElementById('download-docx-btn').disabled = false;
    document.getElementById('copy-btn').disabled = false;
    updateSharePointHint();

  } catch (err) {
    let msg = err.message;
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      msg = 'Could not reach the proxy. Check the URL in Settings, and see the CORS notice at the top of the page.';
    }
    setStatus('Error: ' + msg, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Run';
  }
}

// ── OUTPUT HELPERS ──
function showOutput(text) {
  const el = document.getElementById('output-area');
  el.classList.remove('empty');
  el.textContent = text;
}

function clearOutput() {
  const el = document.getElementById('output-area');
  el.classList.add('empty');
  el.textContent = 'Your output will appear here after you click Run…';
  lastOutput = '';
  document.getElementById('download-btn').disabled = true;
  document.getElementById('download-docx-btn').disabled = true;
  document.getElementById('copy-btn').disabled = true;
  document.getElementById('sharepoint-hint').classList.remove('show');
}

function downloadMd() {
  if (!lastOutput) return;
  const date     = document.getElementById('session-date').value;
  const name     = document.getElementById('session-name').value.trim().replace(/\s+/g, '-') || 'output';
  const filename = `${currentSkill}-${date}-${name}.md`;
  const blob = new Blob([lastOutput], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadDocx() {
  if (!lastOutput) return;
  if (typeof marked === 'undefined' || typeof htmlDocx === 'undefined') {
    alert('Export libraries failed to load. Check your internet connection and reload the page.');
    return;
  }
  const date     = document.getElementById('session-date').value;
  const name     = document.getElementById('session-name').value.trim().replace(/\s+/g, '-') || 'output';
  const filename = `${currentSkill}-${date}-${name}.docx`;
  const bodyHtml = marked.parse(lastOutput);
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${bodyHtml}</body></html>`;
  const blob = htmlDocx.asBlob(fullHtml);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function copyOutput() {
  if (!lastOutput) return;
  navigator.clipboard.writeText(lastOutput).then(() => setStatus('Copied to clipboard.', 'success'));
}

function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = type;
}

function updateSharePointHint() {
  const hint  = (localStorage.getItem(LS_SP_HINT) || '').trim();
  const panel = document.getElementById('sharepoint-hint');
  document.getElementById('sharepoint-hint-text').textContent = hint;
  panel.classList.toggle('show', !!(hint && lastOutput));
}

// ── DE-IDENTIFICATION MODAL ──────────────────────────────────

let _deIdModalCurrentText = ''; // tracks current editor content

/**
 * Assemble all text sources into a single string for the de-id editor.
 * Images are excluded (can't de-id binary content).
 */
function _assembleTextForDeId() {
  const parts = [];
  uploadedFiles.forEach(function (f) {
    if (f.error || f.image) return;
    if (f.text) parts.push('=== ' + f.name + ' ===\n\n' + f.text);
  });
  const pasted = (document.getElementById('transcript-text').value || '').trim();
  if (pasted) parts.push('=== pasted-text ===\n\n' + pasted);
  return parts.join('\n\n---\n\n');
}

/**
 * Open the de-identification modal.
 * Validates inputs first, then assembles content for review.
 */
function openDeIdModal() {
  const proxyUrl = localStorage.getItem(LS_PROXY);
  const apiKey   = localStorage.getItem(LS_KEY);
  if (!proxyUrl || !apiKey) {
    openSettings();
    setStatus('Please configure your proxy URL and virtual key first.', 'error');
    return;
  }

  const date = document.getElementById('session-date').value;
  const name = document.getElementById('session-name').value.trim();
  if (!date || !name) { setStatus('Please fill in the date and session name.', 'error'); return; }

  if (countSources() === 0) { setStatus('Please upload at least one file or paste some content.', 'error'); return; }

  // Assemble combined text
  _deIdModalCurrentText = _assembleTextForDeId();

  // Populate editor
  const editor = document.getElementById('deid-modal-editor');
  if (editor) editor.value = _deIdModalCurrentText;

  // Reset consent + button
  const checkbox = document.getElementById('deid-modal-consent');
  const runBtn   = document.getElementById('btn-deid-modal-run');
  if (checkbox) checkbox.checked = false;
  if (runBtn)   runBtn.disabled  = true;

  // Reset rules list
  const rulesList = document.getElementById('deid-modal-rules-list');
  if (rulesList) {
    rulesList.innerHTML = '';
    addDeIdModalRow();
  }

  // Show modal
  const modal = document.getElementById('deid-modal');
  if (modal) modal.style.display = 'flex';
}

function closeDeIdModal() {
  const modal = document.getElementById('deid-modal');
  if (modal) modal.style.display = 'none';
}

function onDeIdModalEditorInput(value) {
  _deIdModalCurrentText = value;
  // Refresh match counts
  document.querySelectorAll('.deid-modal-rule-row').forEach(function (row) {
    const find  = (row.querySelector('input.deid-find') || {}).value || '';
    const badge = row.querySelector('.deid-modal-match-count');
    if (badge && find.trim()) {
      const count = _deIdModalCountMatches(_deIdModalCurrentText, find.trim());
      badge.textContent = count > 0 ? count + ' match' + (count !== 1 ? 'es' : '') : '';
      badge.className   = 'deid-modal-match-count' + (count > 0 ? ' has-matches' : '');
    } else if (badge) {
      badge.textContent = '';
      badge.className   = 'deid-modal-match-count';
    }
  });
}

function onDeIdModalConsentChange() {
  const checkbox = document.getElementById('deid-modal-consent');
  const runBtn   = document.getElementById('btn-deid-modal-run');
  if (runBtn) runBtn.disabled = !(checkbox && checkbox.checked);
}

function addDeIdModalRow() {
  const list = document.getElementById('deid-modal-rules-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'deid-modal-rule-row';
  row.innerHTML =
    '<input type="text" class="deid-find" placeholder="Find (e.g. Jane Smith)" />' +
    '<span class="deid-modal-arrow">→</span>' +
    '<input type="text" class="deid-replace" placeholder="Replace with" />' +
    '<span class="deid-modal-match-count"></span>';

  const findInput = row.querySelector('.deid-find');
  findInput.addEventListener('input', function () {
    const count = _deIdModalCountMatches(_deIdModalCurrentText, this.value.trim());
    const badge = row.querySelector('.deid-modal-match-count');
    if (badge) {
      badge.textContent = count > 0 ? count + ' match' + (count !== 1 ? 'es' : '') : '';
      badge.className   = 'deid-modal-match-count' + (count > 0 ? ' has-matches' : '');
    }
  });

  list.appendChild(row);
}

function _deIdModalCountMatches(text, find) {
  if (!text || !find) return 0;
  try {
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex   = new RegExp('\\b' + escaped + '\\b', 'gi');
    return (text.match(regex) || []).length;
  } catch (_) { return 0; }
}

function _deIdModalApplyRules(text, rules) {
  let result = text;
  rules.forEach(function (r) {
    if (!r.find) return;
    try {
      const escaped = r.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex   = new RegExp('\\b' + escaped + '\\b', 'gi');
      result = result.replace(regex, r.replace || '');
    } catch (_) {}
  });
  return result;
}

function _collectDeIdModalRules() {
  const rules = [];
  document.querySelectorAll('.deid-modal-rule-row').forEach(function (row) {
    const find    = ((row.querySelector('.deid-find') || {}).value || '').trim();
    const replace = ((row.querySelector('.deid-replace') || {}).value || '').trim();
    if (find) rules.push({ find: find, replace: replace });
  });
  return rules;
}

/**
 * Apply de-id rules to the current editor text, close the modal,
 * and run synthesis with the cleaned combined text.
 */
async function applyDeIdAndRun() {
  const editor = document.getElementById('deid-modal-editor');
  const currentText = editor ? editor.value : _deIdModalCurrentText;

  const rules       = _collectDeIdModalRules();
  const cleanedText = _deIdModalApplyRules(currentText, rules);

  closeDeIdModal();

  // Run synthesis using the cleaned combined text
  await synthesiseWithCleanedText(cleanedText);
}

/**
 * Run synthesis using a pre-cleaned combined text string.
 * Bypasses the normal file/paste assembly — uses the cleaned text as a single source.
 */
async function synthesiseWithCleanedText(cleanedText) {
  const proxyUrl = localStorage.getItem(LS_PROXY);
  const apiKey   = localStorage.getItem(LS_KEY);
  const date     = document.getElementById('session-date').value;
  const name     = document.getElementById('session-name').value.trim();

  const btn = document.getElementById('synthesise-btn');
  btn.disabled    = true;
  btn.innerHTML   = '<span class="spinner"></span>Running…';
  clearOutput();

  try {
    setStatus('Loading skill…');
    const systemPrompt = await loadSkill(currentSkill);
    const deident      = document.getElementById('deidentify').value;
    const deidentLabel = deident === 'yes' ? 'Yes (use P1, P2, P3…)' : 'No';

    const textPrompt = [
      'Date: ' + date,
      'Session name: ' + name,
      'De-identify speakers: ' + deidentLabel,
      '',
      '---',
      cleanedText,
    ].join('\n');

    setStatus('Sending to LiteLLM proxy…');
    const r = await callLiteLLM(systemPrompt, textPrompt);

    lastOutput = r.content;
    showOutput(lastOutput);
    setStatus('Done — ' + (r.tokens || 0).toLocaleString() + ' tokens used.', 'success');
    document.getElementById('download-btn').disabled = false;
    document.getElementById('download-docx-btn').disabled = false;
    document.getElementById('copy-btn').disabled     = false;
    updateSharePointHint();

  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = 'Review and Run';
  }
}
