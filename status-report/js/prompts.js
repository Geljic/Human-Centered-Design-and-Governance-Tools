// ============================================================
// Status Report — prompts.js
// AI prompt construction + response parsing
// ============================================================

const SR_SYSTEM_PROMPT = `You are a senior project manager writing a weekly status report for a director audience.

Your job is to take informal notes, plain-language updates, or rough bullet points and rewrite them as concise, professional status report entries suitable for a director-level audience.

You must return ONLY valid JSON — no markdown fences, no explanation, no preamble.

The JSON must match this exact schema:
{
  "projectName": "string — project or programme name",
  "weekDate": "YYYY-MM-DD — the Monday of the week being reported (ISO date)",
  "nextWeekDate": "YYYY-MM-DD — the Monday of the following week (ISO date)",
  "streams": [
    {
      "id": "unique short string e.g. stream-1",
      "name": "Stream name — short descriptive label",
      "rag": "green | amber | red | navy",
      "subSections": false,
      "achieved": "Bullet points of what was achieved this week, one per line, each starting with •",
      "next": "Bullet points of what will happen next week, one per line, each starting with •",
      "achievedProjectDev": "",
      "achievedGovernance": "",
      "nextProjectDev": "",
      "nextGovernance": ""
    }
  ],
  "supportText": "Optional — any support required from directors or escalations. Leave empty string if none."
}

RAG status rules:
- green = on track, no issues
- amber = at risk, some concerns or delays
- red = off track, blocked, or significant issues
- navy = informational / FYI, no delivery risk

Writing style rules — apply these strictly to every bullet point and stream name:
- Write in plain, direct, professional English suitable for a government director audience
- Use active voice and past tense for achieved items (e.g. "Completed stakeholder review" not "Stakeholder review was completed")
- Use active voice and future tense for next week items (e.g. "Present findings to steering committee")
- Keep each bullet point to one clear action or outcome — under 100 characters
- Do NOT use em dashes (—) anywhere in the output
- Do NOT use en dashes (–) in bullet text (stream names may use them for numbering e.g. "Stream 1 – Discovery")
- Avoid overusing corporate or AI-sounding phrases such as "leverage", "synergies", "robust", "seamless", "streamline", "holistic", "actionable insights", "moving forward", "going forward", "it is worth noting", "in order to" — use them only where they are genuinely the clearest word choice, not as filler
- Do NOT use filler words or hedging language
- Do NOT start bullet points with "We" — use the action directly
- Capitalise the first word of each bullet; do not add a full stop at the end
- Stream names should be short and descriptive (under 50 characters)
- Group related tasks into logical work streams (aim for 2 to 6 streams)
- Infer which tasks happened THIS week vs NEXT week from context (dates, tense, words like "completed", "will", "planning to", "next week")
- If the user mentions specific dates, use them to determine week/next-week boundaries
- If no dates are given, use today's date to infer the current week (Monday) and next week
- Do NOT invent tasks not mentioned in the input
- Do NOT include personal names unless they are clearly part of the task description`;

/**
 * Build the user prompt from free-text input + today's date context
 * @param {string} userText - raw text from the user
 * @param {string} todayIso - today's date in YYYY-MM-DD format
 * @param {object|null} prevWeekJson - optional previous week's report JSON
 * @returns {string}
 */
function buildStatusReportPrompt(userText, todayIso, prevWeekJson) {
  let prevContext = '';
  if (prevWeekJson && prevWeekJson.streams && prevWeekJson.streams.length > 0) {
    const streamNames = prevWeekJson.streams.map(s => `  - "${s.name}" (${s.rag})`).join('\n');
    const prevDate = prevWeekJson.weekDate ? `week of ${prevWeekJson.weekDate}` : 'previous week';
    prevContext = `

The user has also provided their PREVIOUS week's status report (${prevDate}) for context.
Use the same stream names and structure where possible, updating the content for this week.
Previous streams were:
${streamNames}

Previous report JSON (for reference only — do not copy content verbatim):
${JSON.stringify(prevWeekJson, null, 2)}
`;
  }

  const notesSection = userText && userText.trim()
    ? `User notes for this week:
---
${userText.trim()}
---`
    : '(No additional notes provided — use the previous report structure and advance the dates by one week.)';

  return `Today's date is ${todayIso} (${formatDayName(todayIso)}).
${prevContext}
${notesSection}

Please analyse the above and produce a structured weekly status report JSON.

Identify:
1. What work streams / themes are present (reuse previous stream names if a previous report was provided)
2. Which tasks were completed THIS week (past tense, or dated within the current week)
3. Which tasks are planned for NEXT week (future tense, or dated next week)
4. The overall RAG status for each stream based on the language used
5. Any support or escalation items mentioned

Return ONLY the JSON object. No markdown, no explanation.`;
}

/**
 * Parse and validate AI response into state-compatible object
 * @param {string} rawContent - raw string from AI
 * @returns {object} parsed state object
 */
function parseAiStatusReport(rawContent) {
  // Strip markdown code fences if present
  const cleaned = rawContent
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  // Validate required fields
  if (!parsed.streams || !Array.isArray(parsed.streams)) {
    throw new Error('AI response missing streams array');
  }

  // Normalise each stream
  parsed.streams = parsed.streams.map((s, i) => ({
    id: s.id || ('stream-' + (i + 1)),
    name: s.name || ('Stream ' + (i + 1)),
    rag: ['green', 'amber', 'red', 'navy'].includes(s.rag) ? s.rag : 'green',
    subSections: !!s.subSections,
    achieved: s.achieved || '',
    next: s.next || '',
    achievedProjectDev: s.achievedProjectDev || '',
    achievedGovernance: s.achievedGovernance || '',
    nextProjectDev: s.nextProjectDev || '',
    nextGovernance: s.nextGovernance || '',
  }));

  // Ensure dates are valid ISO strings
  if (parsed.weekDate && !isValidIsoDate(parsed.weekDate)) {
    parsed.weekDate = '';
  }
  if (parsed.nextWeekDate && !isValidIsoDate(parsed.nextWeekDate)) {
    parsed.nextWeekDate = '';
  }

  return parsed;
}

function isValidIsoDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

function formatDayName(isoDate) {
  try {
    return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch (_) {
    return isoDate;
  }
}

/**
 * Main entry point: call AI and return parsed state
 * @param {string} userText
 * @param {object|null} prevWeekJson - optional previous week's report for context
 * @returns {Promise<object>} parsed state object
 */
async function generateStatusReportFromText(userText, prevWeekJson) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const userPrompt = buildStatusReportPrompt(userText, todayIso, prevWeekJson || null);

  const result = await srChatCompletion([
    { role: 'system', content: SR_SYSTEM_PROMPT },
    { role: 'user',   content: userPrompt },
  ]);

  return parseAiStatusReport(result.content);
}
