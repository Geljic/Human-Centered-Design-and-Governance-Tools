window.Synth = window.Synth || {};

Synth.prompts = (function () {

  // --- 10.1 Per-Session Synthesis ---

  var SYNTHESIS_SYSTEM = [
    'You are a qualitative research analyst synthesising findings from a user research interview transcript.',
    '',
    'You will be given:',
    '1. A project context describing the research study',
    '2. A research framework (may include research questions and participant group definitions)',
    '3. A theme database containing themes already identified from previous sessions (may be empty if this is the first session)',
    '4. A transcript from a single research interview session',
    '',
    'Your task:',
    '- Read the transcript carefully and identify meaningful findings relevant to the project context.',
    '- Group your findings by research question (RQ). For each RQ, identify all findings from this session that relate to it. A single RQ may yield multiple findings. Findings that do not relate to any RQ go in emergent_findings.',
    '- If NO research questions are defined, put ALL findings in emergent_findings.',
    '- Aim for Level 2–3 analysis depth:',
    '  - Level 1 (INSUFFICIENT): "The participant said they use Excel for data." — This is mere description.',
    '  - Level 2 (MINIMUM): "The participant\'s reliance on Excel suggests a need for export functionality, as they are unlikely to abandon familiar tools entirely." — This is interpretation.',
    '  - Level 3 (TARGET): "The participant\'s reliance on Excel, combined with similar patterns from other technical users, indicates that the tool\'s value for power users lies in data discovery rather than replacing analysis workflows." — This is insight.',
    '- Focus on PARTICIPANT responses. Facilitator questions and observer comments provide context only — do not synthesise them as findings.',
    '- For EACH finding, check the existing theme database. The database includes example_quotes for each theme — use these to understand what kind of evidence belongs to that theme. Two findings may use different words but describe the same underlying concept.',
    '  - If it matches an existing theme, set theme_match to that theme\'s ID.',
    '  - If it is related to but meaningfully distinct from an existing theme, set theme_match to null (a new theme will be created).',
    '  - If it is entirely new, set theme_match to null.',
    '- When a finding matches an existing theme, provide a revised_description that synthesises across all participants who have contributed to that theme (not just this session). The description should be a cross-participant summary, not specific to one participant. Keep it to 2–3 concise sentences. If no revision is needed, set revised_description to null.',
    '- When in doubt about whether a finding matches an existing theme, KEEP THEM SEPARATE. It is easier for a human to merge later than to split incorrectly merged themes.',
    '- Every finding MUST be supported by one or more VERBATIM QUOTES from the transcript. Copy the quote exactly as it appears — do not paraphrase, truncate, clean up grammar, or edit in any way. Include the speaker name and timestamp exactly as they appear in the transcript.',
    '- A finding without a verbatim quote is invalid. Do not include it.',
    '- If you cannot find a verbatim quote to support an observation, do not include that observation.',
    '- Finding labels should be short (under 10 words) and descriptive.',
    '- The analysis field should be 2–3 sentences of Level 2–3 interpretive analysis.',
  ].join('\n');

  var RQ_SECTION_TEMPLATE = [
    '',
    'RESEARCH QUESTIONS:',
    'The following research questions guide this study. Group your findings under the relevant RQ. Findings that do not relate to any RQ should go in emergent_findings.',
    '',
  ].join('\n');

  var SYNTHESIS_FORMAT = [
    '',
    'Respond with a JSON object in the following structure (no markdown fencing, no preamble):',
    '',
    '{',
    '  "session_id": "<participant ID for this session>",',
    '  "rq_findings": [',
    '    {',
    '      "rq_id": "<research question ID>",',
    '      "findings": [',
    '        {',
    '          "label": "<short finding/theme label>",',
    '          "analysis": "<2-3 sentence Level 2-3 analysis>",',
    '          "supporting_evidence": [',
    '            {',
    '              "quote": "<verbatim quote from transcript>",',
    '              "speaker": "<speaker name as in transcript>",',
    '              "timestamp": "<MM:SS>",',
    '              "participant_id": "<participant ID>"',
    '            }',
    '          ],',
    '          "theme_match": "<existing theme_id or null if new>",',
    '          "theme_match_rationale": "<why this matches an existing theme, or why it is new>",',
    '          "revised_description": "<updated cross-participant description for matched themes, or null>"',
    '        }',
    '      ]',
    '    }',
    '  ],',
    '  "emergent_findings": [',
    '    {',
    '      "label": "<finding outside any RQ>",',
    '      "analysis": "<2-3 sentence analysis>",',
    '      "supporting_evidence": [',
    '        {',
    '          "quote": "<verbatim quote from transcript>",',
    '          "speaker": "<speaker name as in transcript>",',
    '          "timestamp": "<MM:SS>",',
    '          "participant_id": "<participant ID>"',
    '        }',
    '      ],',
    '      "theme_match": "<existing theme_id or null if new>",',
    '      "theme_match_rationale": "<why this matches or is new>",',
    '      "revised_description": "<updated cross-participant description, or null>"',
    '    }',
    '  ]',
    '}',
    '',
    'IMPORTANT NOTES:',
    '- rq_findings should ONLY be present if research questions are defined. If no RQs exist, use only emergent_findings.',
    '- A finding with theme_match set to an existing theme ID means this finding adds new evidence to that theme.',
    '- A finding with theme_match set to null means a new theme should be created from this finding.',
    '- Multiple findings within one RQ are expected — do not artificially merge distinct insights.',
  ].join('\n');

  // --- 10.2 Quote Verification (Tier 2 — Haiku) ---

  var VERIFICATION_SYSTEM = [
    'You are a verification agent. Your task is to check whether a quote actually appears in a transcript.',
    '',
    'You will be given:',
    '1. A QUOTE that was extracted during research synthesis',
    '2. A section of TRANSCRIPT from a research interview',
    '',
    'Determine whether the quote exists in the transcript. Account for minor transcription differences: filler words (um, uh, like, you know) may be added or removed by transcription software, and slight phrasing differences are acceptable. The core meaning and key words must match.',
    '',
    'Respond with a JSON object (no markdown fencing, no preamble):',
    '',
    '{',
    '  "verdict": "confirmed" or "fabricated",',
    '  "explanation": "<brief explanation of your determination>"',
    '}',
  ].join('\n');

  // --- 10.3 Re-Synthesis feedback ---

  var RESYNTHESIS_WARNING = [
    '',
    'IMPORTANT: A previous synthesis of this transcript contained fabricated quotes that do not appear in the source material. The following quotes were identified as fabricated — do NOT use them or anything similar:',
    '',
  ].join('\n');

  var RESYNTHESIS_SUFFIX = [
    '',
    'Re-synthesise this transcript with extra care. Every quote you provide must be copied EXACTLY from the transcript text. If you cannot find a verbatim quote to support an insight, do not include that insight.',
  ].join('\n');

  // --- 10.4 Final Consolidation ---

  var CONSOLIDATION_SYSTEM = [
    'You are a qualitative research analyst producing a final synthesis report for a user research study.',
    '',
    'You will be given:',
    '1. A project context describing the research study',
    '2. A research framework (may include research questions and participant group definitions)',
    '3. Per-session synthesis responses — the analytical findings from each participant session, grouped by research question',
    '4. A complete theme database containing all themes and their supporting evidence collected across all sessions',
    '',
    'Your task is to produce a well-structured synthesis report in Markdown format.',
    '',
    'Guidelines:',
    '- Draw on BOTH the per-session analyses (for narrative and interpretation) and the theme database (for cross-session patterns and evidence).',
    '- Every claim must be traceable to the provided data. Do not invent or fabricate any content.',
    '- For each theme, include: the theme name, description, participant count (out of total), and a curated selection of the most illustrative verbatim quotes (3-5 for major themes, 1-2 for minor ones), each attributed with participant ID.',
    '- Distinguish between themes that emerged strongly across multiple participants and those supported by fewer voices.',
    '- Note meaningful relationships or tensions between themes where you observe them.',
    '- Keep the tone analytical and grounded. Do not speculate beyond what the evidence supports.',
    '- Aim for Level 2-3 analysis: interpret significance and implications, don\'t just describe findings.',
  ].join('\n');

  var CONSOLIDATION_RQ = [
    '',
    'REPORT STRUCTURE:',
    'Organise the report by research question. For each RQ:',
    '- State the question',
    '- Present the themes that relate to it, ordered by significance',
    '- Include supporting evidence with quotes',
    '- Synthesise findings across themes for that question',
    '',
    'After the RQ sections, include:',
    '- A "Cross-Cutting Themes" section for themes that span multiple RQs',
    '- An "Emergent Findings" section for themes that don\'t map to any RQ',
  ].join('\n');

  var CONSOLIDATION_GROUPS = [
    '',
    'GROUP ANALYSIS:',
    'Where relevant, note differences in findings across participant groups. For example: "4 of 6 teachers reported this theme, compared to 1 of 4 parents." Include group-level observations where patterns diverge meaningfully.',
  ].join('\n');

  var CONSOLIDATION_SIMPLE = [
    '',
    'REPORT STRUCTURE:',
    'Organise themes from most significant (highest participant count) to least significant.',
  ].join('\n');

  // --- Composition Functions ---

  function buildSynthesisSystem(framework) {
    var system = (framework.custom_synthesis_prompt && framework.custom_synthesis_prompt.trim())
      ? framework.custom_synthesis_prompt.trim()
      : SYNTHESIS_SYSTEM;

    if (framework.research_questions && framework.research_questions.length > 0) {
      system += RQ_SECTION_TEMPLATE;
      framework.research_questions.forEach(function (rq) {
        system += '- ' + rq.rq_id + ': ' + rq.label + '\n';
      });
    }

    system += SYNTHESIS_FORMAT;
    return system;
  }

  function buildSynthesisUser(framework, themes, transcript, participantId, speakerRoles) {
    var parts = [];

    parts.push('PROJECT CONTEXT:');
    parts.push(framework.background || 'No project background provided.');
    parts.push('');

    if (framework.participant_groups && framework.participant_groups.length > 0) {
      parts.push('PARTICIPANT GROUPS:');
      framework.participant_groups.forEach(function (g) {
        parts.push('- ' + g.group_id + ': ' + g.label + ' — ' + (g.description || ''));
      });
      parts.push('');
    }

    parts.push('EXISTING THEME DATABASE:');
    if (themes.length === 0) {
      parts.push('(empty — this is the first session)');
    } else {
      parts.push(JSON.stringify(themes.map(function (t) {
        var curated = curateQuotes(t.supporting_evidence, 2);
        return {
          theme_id: t.theme_id,
          label: t.label,
          current_description: t.current_description,
          source: t.source,
          rq_mappings: t.rq_mappings,
          participant_count: t.supporting_evidence ? new Set(t.supporting_evidence.map(function (e) { return e.participant_id; })).size : 0,
          example_quotes: curated.map(function (e) {
            return { quote: e.quote, participant_id: e.participant_id };
          })
        };
      }), null, 2));
    }
    parts.push('');

    parts.push('SPEAKER ROLES:');
    Object.entries(speakerRoles).forEach(function (entry) {
      parts.push('- ' + entry[0] + ': ' + entry[1]);
    });
    parts.push('');

    parts.push('PARTICIPANT ID: ' + participantId);
    parts.push('');
    parts.push('TRANSCRIPT:');
    parts.push(transcript);

    return parts.join('\n');
  }

  function buildResynthesisUser(framework, themes, transcript, participantId, speakerRoles, fabricatedQuotes) {
    var base = buildSynthesisUser(framework, themes, transcript, participantId, speakerRoles);
    var warning = RESYNTHESIS_WARNING;
    fabricatedQuotes.forEach(function (q) {
      warning += '- "' + q + '"\n';
    });
    warning += RESYNTHESIS_SUFFIX;
    return base + warning;
  }

  function buildVerificationUser(quote, transcriptSection) {
    return 'QUOTE:\n"' + quote + '"\n\nTRANSCRIPT:\n' + transcriptSection;
  }

  function buildConsolidationSystem(framework) {
    var system = (framework.custom_consolidation_prompt && framework.custom_consolidation_prompt.trim())
      ? framework.custom_consolidation_prompt.trim()
      : CONSOLIDATION_SYSTEM;

    var hasRqs = framework.research_questions && framework.research_questions.length > 0;
    var hasGroups = framework.participant_groups && framework.participant_groups.length > 0;

    if (hasRqs) {
      system += CONSOLIDATION_RQ;
    } else {
      system += CONSOLIDATION_SIMPLE;
    }

    if (hasGroups) {
      system += CONSOLIDATION_GROUPS;
    }

    system += '\n\nOutput the report as clean Markdown, ready for download.';
    return system;
  }

  function curateQuotes(evidence, maxQuotes) {
    var usable = (evidence || []).filter(function (e) {
      return e.verification_status !== 'fabricated';
    });

    usable.sort(function (a, b) {
      var rank = { verified: 0, confirmed: 0, pending: 1 };
      return (rank[a.verification_status] || 2) - (rank[b.verification_status] || 2);
    });

    var selected = [];
    var seenParticipants = new Set();

    usable.forEach(function (e) {
      if (selected.length >= maxQuotes) return;
      if (!seenParticipants.has(e.participant_id)) {
        selected.push(e);
        seenParticipants.add(e.participant_id);
      }
    });

    usable.forEach(function (e) {
      if (selected.length >= maxQuotes) return;
      if (selected.indexOf(e) === -1) {
        selected.push(e);
      }
    });

    return selected;
  }

  function strengthLabel(count) {
    if (count >= 4) return 'strong';
    if (count >= 2) return 'moderate';
    return 'limited';
  }

  function buildThemeSummaries(themes, totalParticipants, hasGroups) {
    return themes.map(function (t) {
      var evidence = t.supporting_evidence || [];
      var participantIds = [];
      var seen = {};
      evidence.forEach(function (e) {
        if (e.participant_id && !seen[e.participant_id]) {
          seen[e.participant_id] = true;
          participantIds.push(e.participant_id);
        }
      });
      var count = participantIds.length;

      var lines = [];
      lines.push('THEME: ' + t.label);
      lines.push('Description: ' + (t.current_description || t.original_description || ''));
      if (t.rq_mappings && t.rq_mappings.length > 0) {
        lines.push('Research questions: ' + t.rq_mappings.join(', '));
      }
      lines.push('Participants: ' + count + ' of ' + totalParticipants + ' (' + strengthLabel(count) + ') — ' + participantIds.join(', '));

      if (hasGroups) {
        var groupPids = {};
        evidence.forEach(function (e) {
          if (e.participant_group) {
            if (!groupPids[e.participant_group]) groupPids[e.participant_group] = {};
            groupPids[e.participant_group][e.participant_id] = true;
          }
        });
        var groupParts = Object.keys(groupPids).map(function (g) {
          return g + ': ' + Object.keys(groupPids[g]).length;
        });
        if (groupParts.length > 0) {
          lines.push('Group breakdown: ' + groupParts.join(', '));
        }
      }

      var curated = curateQuotes(evidence, 5);
      if (curated.length > 0) {
        lines.push('Key quotes:');
        curated.forEach(function (e) {
          lines.push('  - "' + e.quote + '" — ' + e.participant_id);
        });
      } else {
        lines.push('Key quotes: (none verified)');
      }

      return lines.join('\n');
    }).join('\n\n');
  }

  function buildSessionNarratives(sessionSyntheses) {
    return (sessionSyntheses || []).map(function (s) {
      var lines = ['SESSION: ' + s.participant_id];

      (s.rq_findings || []).forEach(function (rqGroup) {
        (rqGroup.findings || []).forEach(function (f) {
          lines.push('  ' + rqGroup.rq_id + ': ' + f.label + ' — ' + (f.analysis || ''));
        });
      });

      (s.emergent_findings || []).forEach(function (f) {
        lines.push('  Emergent: ' + f.label + ' — ' + (f.analysis || ''));
      });

      return lines.join('\n');
    }).join('\n\n');
  }

  function buildEvidenceMatrix(themes, totalParticipants) {
    var rows = themes.map(function (t) {
      var seen = {};
      (t.supporting_evidence || []).forEach(function (e) {
        if (e.participant_id) seen[e.participant_id] = true;
      });
      var pids = Object.keys(seen);
      return { label: t.label, pids: pids, count: pids.length };
    });

    rows.sort(function (a, b) { return b.count - a.count; });

    return rows.map(function (r) {
      return r.label + ' → ' + r.pids.join(', ') + ' (' + r.count + ' of ' + totalParticipants + ', ' + strengthLabel(r.count) + ')';
    }).join('\n');
  }

  function buildConsolidationUser(framework, themes, sessionSyntheses) {
    var parts = [];
    var totalParticipants = (sessionSyntheses || []).length;
    var hasGroups = framework.participant_groups && framework.participant_groups.length > 0;

    parts.push('PROJECT CONTEXT:');
    parts.push(framework.background || 'No project background provided.');
    parts.push('');

    if (framework.research_questions && framework.research_questions.length > 0) {
      parts.push('RESEARCH QUESTIONS:');
      framework.research_questions.forEach(function (rq) {
        parts.push('- ' + rq.rq_id + ': ' + rq.label);
      });
      parts.push('');
    }

    if (hasGroups) {
      parts.push('PARTICIPANT GROUPS:');
      framework.participant_groups.forEach(function (g) {
        parts.push('- ' + g.group_id + ': ' + g.label + ' — ' + (g.description || ''));
      });
      parts.push('');
    }

    parts.push('EVIDENCE MATRIX:');
    parts.push(buildEvidenceMatrix(themes, totalParticipants));
    parts.push('');

    parts.push('THEME SUMMARIES:');
    parts.push(buildThemeSummaries(themes, totalParticipants, hasGroups));
    parts.push('');

    parts.push('PER-SESSION ANALYTICAL NARRATIVES:');
    parts.push(buildSessionNarratives(sessionSyntheses));

    return parts.join('\n');
  }

  // --- 10.5 Theme Review ---

  var THEME_REVIEW_SYSTEM = [
    'You are a qualitative research analyst reviewing a theme database from a user research study.',
    '',
    'You will be given:',
    '1. A project context describing the research study',
    '2. A research framework (may include research questions)',
    '3. The complete theme database, including labels, descriptions, participant counts, RQ mappings, and representative quotes',
    '',
    'Your task is to identify clusters of themes that may benefit from consolidation. For each cluster, recommend one of:',
    '',
    '1. MERGE — themes that describe the same underlying concept using different words or from different angles. These should be combined into a single theme.',
    '   Example: "Time pressure in classroom activities" and "Not enough time for planned lessons" are the same theme expressed differently.',
    '',
    '2. GROUP — themes that are distinct but closely related, and could be presented as sub-themes under a parent concept. Only recommend this when a clear parent concept exists.',
    '   Example: "Difficulty navigating the portal" and "Confusion about portal terminology" are distinct but both relate to portal usability.',
    '',
    '3. KEEP_SEPARATE — themes that are related by topic but genuinely distinct. Include these to confirm the separation is intentional.',
    '   Example: "Teachers want more training" and "Teachers lack confidence with technology" are related but address different problems.',
    '',
    'Guidelines:',
    '- Be conservative. Only recommend merging themes that clearly describe the same concept. Researchers prefer fewer false positives.',
    '- A cluster must contain at least 2 themes.',
    '- Themes with evidence from only 1 participant should be flagged as "limited evidence" in the weak_themes array.',
    '- Use the example quotes to judge similarity — labels and descriptions alone can be misleading.',
    '- Do not cluster themes just because they are in the same topic area.',
    '- A theme may appear in at most one cluster.',
    '- If no themes warrant clustering, return an empty clusters array. This is a valid outcome.',
    '',
    'Respond with a JSON object (no markdown fencing, no preamble):',
    '',
    '{',
    '  "clusters": [',
    '    {',
    '      "cluster_id": 1,',
    '      "recommendation": "merge | group | keep_separate",',
    '      "theme_ids": ["theme_001", "theme_005"],',
    '      "rationale": "Brief explanation of why these themes are related and what the recommendation is based on.",',
    '      "suggested_label": "Proposed label for the merged/parent theme (null if keep_separate)",',
    '      "suggested_description": "Proposed 2-3 sentence description synthesising across all contributing participants (null if keep_separate)",',
    '      "confidence": "high | medium | low"',
    '    }',
    '  ],',
    '  "weak_themes": [',
    '    {',
    '      "theme_id": "theme_042",',
    '      "label": "Current theme label",',
    '      "reason": "Single participant, limited evidence — may need more data before being actionable"',
    '    }',
    '  ],',
    '  "summary": "Brief overview: X themes reviewed, Y clusters identified, Z themes flagged as weak."',
    '}',
  ].join('\n');

  function buildThemeReviewUser(framework, themes) {
    var parts = [];

    parts.push('PROJECT CONTEXT:');
    parts.push(framework.background || 'No project background provided.');
    parts.push('');

    if (framework.research_questions && framework.research_questions.length > 0) {
      parts.push('RESEARCH QUESTIONS:');
      framework.research_questions.forEach(function (rq) {
        parts.push('- ' + rq.rq_id + ': ' + rq.label);
      });
      parts.push('');
    }

    parts.push('THEME DATABASE (' + themes.length + ' themes):');
    parts.push(JSON.stringify(themes.map(function (t) {
      var curated = curateQuotes(t.supporting_evidence, 3);
      var seen = {};
      var participantIds = [];
      (t.supporting_evidence || []).forEach(function (e) {
        if (e.participant_id && !seen[e.participant_id]) {
          seen[e.participant_id] = true;
          participantIds.push(e.participant_id);
        }
      });

      return {
        theme_id: t.theme_id,
        label: t.label,
        current_description: t.current_description,
        source: t.source,
        rq_mappings: t.rq_mappings,
        participant_count: participantIds.length,
        participants: participantIds,
        evidence_count: (t.supporting_evidence || []).length,
        example_quotes: curated.map(function (e) {
          return { quote: e.quote, participant_id: e.participant_id };
        })
      };
    }), null, 2));

    return parts.join('\n');
  }

  // --- 10.6 Transcript Inquiry ---

  var INQUIRY_SYSTEM = [
    'You are a qualitative research analyst. You have been given the transcript of a research interview.',
    'Answer the researcher\'s question based solely on what is in the transcript.',
    'Ground your answer in specific quotes and observations from the transcript, citing the speaker name and timestamp.',
    'If the transcript does not contain relevant information, say so clearly.',
    'Do not speculate beyond what the evidence supports.',
  ].join(' ');

  function buildInquiryUser(framework, transcriptText, participantId, question) {
    var parts = [];
    parts.push('PROJECT CONTEXT:');
    parts.push(framework.background || 'No project background provided.');
    parts.push('');
    parts.push('PARTICIPANT ID: ' + participantId);
    parts.push('');
    parts.push('TRANSCRIPT:');
    parts.push(transcriptText);
    parts.push('');
    parts.push('QUESTION:');
    parts.push(question);
    return parts.join('\n');
  }

  // --- Background Generator ---

  var BG_GENERATOR_SYSTEM = [
    'You are helping a UX researcher write a project background for a qualitative research synthesis tool.',
    '',
    'The project background will be used as context in every synthesis prompt — it helps the AI understand the domain, the research goals, and how to interpret participant responses.',
    '',
    'Write a concise, information-dense project background based on the input below. The output should be:',
    '- 2–3 short paragraphs (150–250 words total)',
    '- Written in third person ("This study..." not "We are...")',
    '- Focused on information that would help an AI analyst understand the research context',
    '- Include any domain-specific terminology, acronyms, or internal tool names mentioned',
    '- Free of filler or generic methodology descriptions — only include what is specific to this study',
    '',
    'Do not include headings, bullet points, or markdown formatting. Write in plain flowing paragraphs.',
  ].join('\n');

  function buildBgFromQuestionnaire(answers) {
    var parts = [];
    if (answers.project) parts.push('Project: ' + answers.project);
    if (answers.goal) parts.push('Research goal: ' + answers.goal);
    if (answers.method) parts.push('Methodology: ' + answers.method);
    if (answers.participants) parts.push('Participants: ' + answers.participants);
    if (answers.domain) parts.push('Domain context: ' + answers.domain);
    return parts.join('\n');
  }

  function buildBgFromDocument(documentText, note) {
    var parts = [];
    parts.push('Document type: ' + (note || 'Not specified'));
    parts.push('');
    parts.push('Document content:');
    parts.push(documentText);
    return parts.join('\n');
  }

  return {
    buildSynthesisSystem,
    buildSynthesisUser,
    buildResynthesisUser,
    buildVerificationUser,
    buildConsolidationSystem,
    buildConsolidationUser,
    buildThemeReviewUser,
    buildInquiryUser,
    buildBgFromQuestionnaire,
    buildBgFromDocument,
    BG_GENERATOR_SYSTEM: BG_GENERATOR_SYSTEM,
    VERIFICATION_SYSTEM: VERIFICATION_SYSTEM,
    THEME_REVIEW_SYSTEM: THEME_REVIEW_SYSTEM,
    INQUIRY_SYSTEM: INQUIRY_SYSTEM,
    DEFAULT_SYNTHESIS_SYSTEM: SYNTHESIS_SYSTEM,
    DEFAULT_CONSOLIDATION_SYSTEM: CONSOLIDATION_SYSTEM
  };
})();
