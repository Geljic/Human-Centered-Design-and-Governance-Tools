window.Synth = window.Synth || {};

Synth.pipeline = (function () {

  var MAX_RESYNTH_ATTEMPTS = 2;
  var SYNTH_MODEL_DEFAULT = 'claude-sonnet-4-6';

  function elapsed(startTime) {
    var secs = Math.round((Date.now() - startTime) / 1000);
    if (secs < 60) return secs + 's';
    return Math.floor(secs / 60) + 'm ' + (secs % 60) + 's';
  }

  // Process a single transcript through the full pipeline
  async function processTranscript(transcript, framework, themes, onStatus, modelOverride) {
    var participantId = transcript.participant_id;
    var speakerRoles = transcript.speaker_roles || {};
    var startTime = Date.now();

    var transcriptText = buildTranscriptText(transcript);

    var attempt = 0;
    var fabricatedQuotes = [];

    while (attempt <= MAX_RESYNTH_ATTEMPTS) {
      attempt++;
      var isRetry = attempt > 1;

      var synthModel = modelOverride || framework.default_synth_model || SYNTH_MODEL_DEFAULT;
      var txKb = (transcriptText.length / 1024).toFixed(1);
      if (isRetry) {
        onStatus('Re-synthesising (attempt ' + attempt + '/' + (MAX_RESYNTH_ATTEMPTS + 1) + ') with ' + synthModel, 'step');
      } else {
        onStatus('Synthesising with ' + synthModel + ' — ' + txKb + 'KB transcript, ' + themes.length + ' theme(s)', 'step');
      }

      var synthesisResult;
      try {
        synthesisResult = await callSynthesis(framework, themes, transcriptText, participantId, speakerRoles, isRetry ? fabricatedQuotes : null, synthModel, function (detail) {
          onStatus(detail + ' (' + elapsed(startTime) + ')', 'update');
        });
      } catch (e) {
        onStatus('Synthesis failed: ' + e.message, 'error');
        return { success: false, error: 'Synthesis failed: ' + e.message };
      }

      var allEvidence = collectEvidence(synthesisResult);
      var findingCount = collectAllFindings(synthesisResult).length;
      onStatus('Synthesis complete — ' + findingCount + ' finding(s), ' + allEvidence.length + ' quote(s) (' + elapsed(startTime) + ')', 'done');

      if (allEvidence.length === 0) {
        onStatus('No insights found in this transcript', 'done');
        return { success: true, synthesisResult: synthesisResult, stats: { themes_new: 0, themes_updated: 0, quotes_total: 0, quotes_verified: 0, quotes_fabricated: 0 } };
      }

      onStatus('Verifying ' + allEvidence.length + ' quote(s)', 'step');

      var verifyResults;
      try {
        verifyResults = await Synth.verify.verifyQuotes(allEvidence, transcript.raw_text, function (done, total, apiRemaining) {
          var detail = done + '/' + total + ' checked';
          if (apiRemaining > 0) detail += ' · ' + apiRemaining + ' via Haiku';
          onStatus(detail + ' (' + elapsed(startTime) + ')', 'update');
        });
      } catch (e) {
        onStatus('Quote verification failed: ' + e.message, 'error');
        return { success: false, error: 'Quote verification failed: ' + e.message };
      }

      var newFabricated = verifyResults.filter(function (r) { return r.status === 'fabricated'; });
      var verifiedCount = verifyResults.length - newFabricated.length;

      if (newFabricated.length === 0) {
        onStatus(verifiedCount + '/' + allEvidence.length + ' quotes verified (' + elapsed(startTime) + ')', 'done');
        applyVerificationStatus(synthesisResult, verifyResults, allEvidence);

        onStatus('Updating theme database', 'step');
        var stats;
        try {
          stats = await updateThemeDatabase(synthesisResult, transcript, themes);
        } catch (e) {
          onStatus('Failed to update theme database: ' + e.message, 'error');
          return { success: false, error: 'Failed to update theme database: ' + e.message };
        }
        onStatus(stats.themes_new + ' new, ' + stats.themes_updated + ' updated (' + elapsed(startTime) + ')', 'done');

        return { success: true, synthesisResult: synthesisResult, stats: stats };
      }

      fabricatedQuotes = newFabricated.map(function (r) { return allEvidence[r.index].quote; });

      if (attempt <= MAX_RESYNTH_ATTEMPTS) {
        onStatus(verifiedCount + ' verified, ' + newFabricated.length + ' fabricated — retrying', 'done');
        removeFabricatedQuotes(synthesisResult, verifyResults, allEvidence);
      } else {
        onStatus(verifiedCount + ' verified, ' + newFabricated.length + ' fabricated — flagged for review', 'done');
        removeFabricatedQuotes(synthesisResult, verifyResults, allEvidence);
        applyVerificationStatus(synthesisResult, verifyResults, allEvidence);

        onStatus('Updating theme database', 'step');
        var stats;
        try {
          stats = await updateThemeDatabase(synthesisResult, transcript, themes);
        } catch (e) {
          onStatus('Failed to update theme database: ' + e.message, 'error');
          return { success: false, error: 'Failed to update theme database: ' + e.message };
        }
        onStatus(stats.themes_new + ' new, ' + stats.themes_updated + ' updated (' + elapsed(startTime) + ')', 'done');

        return {
          success: true,
          flagged: true,
          fabricatedCount: newFabricated.length,
          synthesisResult: synthesisResult,
          stats: stats
        };
      }
    }
  }

  function buildTranscriptText(transcript) {
    return transcript.turns.map(function (t) {
      return t.speaker + ' ' + t.timestamp + '\n' + t.content;
    }).join('\n\n');
  }

  async function callSynthesis(framework, themes, transcriptText, participantId, speakerRoles, fabricatedQuotes, model, onProgress) {
    var systemPrompt = Synth.prompts.buildSynthesisSystem(framework);
    var userPrompt;

    if (fabricatedQuotes && fabricatedQuotes.length > 0) {
      userPrompt = Synth.prompts.buildResynthesisUser(framework, themes, transcriptText, participantId, speakerRoles, fabricatedQuotes);
    } else {
      userPrompt = Synth.prompts.buildSynthesisUser(framework, themes, transcriptText, participantId, speakerRoles);
    }

    var useModel = model || SYNTH_MODEL_DEFAULT;
    var lastProgressUpdate = 0;
    var response = await Synth.api.chatCompletionStream(useModel, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { max_tokens: 16000, temperature: 0 }, function (charCount, chunkCount, partialContent) {
      if (!onProgress) return;
      var now = Date.now();
      if (now - lastProgressUpdate < 500 && chunkCount > 1) return;
      lastProgressUpdate = now;

      var findings = (partialContent.match(/"label"\s*:/g) || []).length;
      var quotes = (partialContent.match(/"quote"\s*:/g) || []).length;
      var kb = (charCount / 1024).toFixed(1);

      var detail = kb + 'KB';
      if (findings > 0) detail += ' · ' + findings + ' finding' + (findings !== 1 ? 's' : '');
      if (quotes > 0) detail += ', ' + quotes + ' quote' + (quotes !== 1 ? 's' : '');
      onProgress(detail);
    });

    if (response.finish_reason === 'length') {
      throw new Error('Model response was cut off (hit max_tokens limit). The transcript may be too complex for a single pass.');
    }

    var content = response.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      var result = JSON.parse(content);
      result._usage = response.usage;
      result._model = response.model;
      return result;
    } catch (e) {
      throw new Error('Model returned invalid JSON. Response starts with: ' + content.substring(0, 200));
    }
  }

  function collectAllFindings(synthesisResult) {
    var findings = [];

    (synthesisResult.rq_findings || []).forEach(function (rqGroup) {
      (rqGroup.findings || []).forEach(function (f) {
        findings.push(f);
      });
    });

    (synthesisResult.emergent_findings || []).forEach(function (f) {
      findings.push(f);
    });

    return findings;
  }

  function collectEvidence(synthesisResult) {
    var all = [];
    var findings = collectAllFindings(synthesisResult);

    findings.forEach(function (f) {
      (f.supporting_evidence || []).forEach(function (ev) {
        all.push(ev);
      });
    });

    return all;
  }

  function applyVerificationStatus(synthesisResult, verifyResults, allEvidence) {
    var statusMap = {};
    verifyResults.forEach(function (r) {
      statusMap[r.index] = r.status;
    });

    var idx = 0;
    var findings = collectAllFindings(synthesisResult);
    findings.forEach(function (f) {
      (f.supporting_evidence || []).forEach(function (ev) {
        ev.verification_status = statusMap[idx] || 'pending';
        idx++;
      });
    });
  }

  function removeFabricatedQuotes(synthesisResult, verifyResults, allEvidence) {
    var fabricatedIndices = new Set(
      verifyResults.filter(function (r) { return r.status === 'fabricated'; }).map(function (r) { return r.index; })
    );

    var idx = 0;

    function filterFindings(findings) {
      (findings || []).forEach(function (f) {
        f.supporting_evidence = (f.supporting_evidence || []).filter(function () {
          return !fabricatedIndices.has(idx++);
        });
      });
      return (findings || []).filter(function (f) {
        return f.supporting_evidence && f.supporting_evidence.length > 0;
      });
    }

    (synthesisResult.rq_findings || []).forEach(function (rqGroup) {
      rqGroup.findings = filterFindings(rqGroup.findings);
    });

    synthesisResult.rq_findings = (synthesisResult.rq_findings || []).filter(function (rqGroup) {
      return rqGroup.findings && rqGroup.findings.length > 0;
    });

    synthesisResult.emergent_findings = filterFindings(synthesisResult.emergent_findings);
  }

  async function updateThemeDatabase(synthesisResult, transcript, existingThemes) {
    var projectId = transcript.project_id;
    var sessionId = transcript.participant_id;
    var stats = { themes_new: 0, themes_updated: 0, quotes_total: 0, quotes_verified: 0, quotes_fabricated: 0 };

    var allFindings = collectAllFindings(synthesisResult);

    // Build a map of rq_id for each finding by walking rq_findings
    var findingRqMap = new Map();
    (synthesisResult.rq_findings || []).forEach(function (rqGroup) {
      (rqGroup.findings || []).forEach(function (f) {
        findingRqMap.set(f, rqGroup.rq_id);
      });
    });

    for (var i = 0; i < allFindings.length; i++) {
      var finding = allFindings[i];
      var rqId = findingRqMap.get(finding) || null;

      var evidence = (finding.supporting_evidence || []).map(function (ev) {
        ev.session_id = sessionId;
        ev.participant_group = transcript.participant_group || null;
        stats.quotes_total++;
        if (ev.verification_status === 'verified' || ev.verification_status === 'confirmed') stats.quotes_verified++;
        if (ev.verification_status === 'fabricated') stats.quotes_fabricated++;
        return ev;
      });

      if (finding.theme_match) {
        var theme = await Synth.db.getTheme(finding.theme_match);
        if (!theme) {
          finding.theme_match = null;
        } else {
          theme.supporting_evidence = (theme.supporting_evidence || []).concat(evidence);
          if (finding.revised_description) {
            theme.current_description = finding.revised_description;
          }
          if (rqId) {
            var combined = new Set((theme.rq_mappings || []).concat([rqId]));
            theme.rq_mappings = Array.from(combined);
          }
          await Synth.db.saveTheme(theme);
          stats.themes_updated++;
          continue;
        }
      }

      var themeId = await Synth.db.getNextThemeId();
      var newTheme = {
        theme_id: themeId,
        project_id: projectId,
        label: finding.label,
        original_description: finding.analysis,
        current_description: finding.analysis,
        source: 'synthesised',
        supporting_evidence: evidence,
        rq_mappings: rqId ? [rqId] : [],
        related_themes: [],
        first_seen: sessionId,
        status: 'verified'
      };

      await Synth.db.saveTheme(newTheme);
      stats.themes_new++;
    }

    // Store session synthesis
    var synthesis = {
      synthesis_id: projectId + '_' + sessionId,
      project_id: projectId,
      participant_id: sessionId,
      rq_findings: synthesisResult.rq_findings || [],
      emergent_findings: synthesisResult.emergent_findings || [],
      synthesised_at: new Date().toISOString()
    };
    await Synth.db.saveSessionSynthesis(synthesis);

    // Mark transcript as processed
    transcript.status = 'processed';
    await Synth.db.saveTranscript(transcript);

    return stats;
  }

  // Process all unprocessed transcripts for a project
  async function processAll(projectId, onTranscriptStatus, onComplete) {
    var transcripts = await Synth.db.getTranscriptsByProject(projectId);
    var unprocessed = transcripts.filter(function (t) { return t.status === 'uploaded'; });

    if (unprocessed.length === 0) {
      onComplete({ message: 'No unprocessed transcripts found.' });
      return;
    }

    var framework = await Synth.db.getFramework(projectId);
    if (!framework) {
      onComplete({ message: 'No research framework found. Set one up in the Project tab.' });
      return;
    }

    var allStats = { processed: 0, flagged: 0, failed: 0, total: unprocessed.length };

    for (var i = 0; i < unprocessed.length; i++) {
      var tx = unprocessed[i];
      var themes = await Synth.db.getThemesByProject(projectId);

      onTranscriptStatus(i + 1, unprocessed.length, tx.participant_id, 'Starting…');

      var result = await processTranscript(tx, framework, themes, function (msg) {
        onTranscriptStatus(i + 1, unprocessed.length, tx.participant_id, msg);
      });

      if (result.success) {
        allStats.processed++;
        if (result.flagged) allStats.flagged++;
        onTranscriptStatus(i + 1, unprocessed.length, tx.participant_id,
          'Done. ' + (result.stats.themes_new || 0) + ' new theme(s), ' +
          (result.stats.themes_updated || 0) + ' updated, ' +
          (result.stats.quotes_total || 0) + ' quote(s).' +
          (result.flagged ? ' FLAGGED for review.' : '')
        );
      } else {
        allStats.failed++;
        onTranscriptStatus(i + 1, unprocessed.length, tx.participant_id,
          'FAILED: ' + result.error
        );
      }
    }

    onComplete(allStats);
  }

  var CONSOLIDATION_MODEL_DEFAULT = 'claude-sonnet-4-6';
  var CONSOLIDATION_MODEL_COMPLEX = 'claude-opus-4-7';
  var COMPLEX_THEME_THRESHOLD = 30;

  async function consolidate(projectId, modelOverride, onStatus) {
    var startTime = Date.now();

    var framework = await Synth.db.getFramework(projectId);
    if (!framework) {
      return { success: false, error: 'No research framework found. Set one up in the Project tab.' };
    }

    var themes = await Synth.db.getThemesByProject(projectId);
    if (themes.length === 0) {
      return { success: false, error: 'No themes in the database. Run synthesis first.' };
    }

    var sessionSyntheses = await Synth.db.getSessionSynthesesByProject(projectId);

    onStatus('Preparing consolidation data', 'step');

    var totalQuotes = themes.reduce(function (sum, t) {
      return sum + (t.supporting_evidence ? t.supporting_evidence.length : 0);
    }, 0);
    var uniqueParticipants = new Set();
    themes.forEach(function (t) {
      (t.supporting_evidence || []).forEach(function (e) { uniqueParticipants.add(e.participant_id); });
    });

    onStatus(themes.length + ' themes, ' + uniqueParticipants.size + ' participants, ' + totalQuotes + ' quotes', 'done');

    var model = modelOverride || (themes.length > COMPLEX_THEME_THRESHOLD ? CONSOLIDATION_MODEL_COMPLEX : CONSOLIDATION_MODEL_DEFAULT);

    onStatus('Generating report with ' + model, 'step');

    var systemPrompt = Synth.prompts.buildConsolidationSystem(framework);
    var userPrompt = Synth.prompts.buildConsolidationUser(framework, themes, sessionSyntheses);

    var promptKb = ((systemPrompt.length + userPrompt.length) / 1024).toFixed(1);
    onStatus(promptKb + 'KB prompt (' + elapsed(startTime) + ')', 'update');

    var lastProgressUpdate = 0;
    var response;
    try {
      response = await Synth.api.chatCompletionStream(model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { max_tokens: 16384, temperature: 0 }, function (charCount, chunkCount, partialContent) {
        var now = Date.now();
        if (now - lastProgressUpdate < 500 && chunkCount > 1) return;
        lastProgressUpdate = now;

        var kb = (charCount / 1024).toFixed(1);
        var sections = (partialContent.match(/^## /gm) || []).length;
        var detail = kb + 'KB';
        if (sections > 0) detail += ' · ' + sections + ' section' + (sections !== 1 ? 's' : '');
        onStatus(detail + ' (' + elapsed(startTime) + ')', 'update');
      });
    } catch (e) {
      onStatus('API call failed: ' + e.message, 'error');
      return { success: false, error: 'API call failed: ' + e.message };
    }

    if (response.finish_reason === 'length') {
      onStatus('Report was cut off (hit token limit)', 'error');
      return { success: false, error: 'Report was cut off (hit token limit). Try again with Opus for complex studies.' };
    }

    var report = response.content.trim();
    if (!report) {
      onStatus('Model returned empty response', 'error');
      return { success: false, error: 'Model returned empty response.' };
    }

    var tokenInfo = response.usage && response.usage.total_tokens ? ' · ' + response.usage.total_tokens + ' tokens' : '';
    onStatus('Report complete — ' + (report.length / 1024).toFixed(1) + 'KB' + tokenInfo + ' (' + elapsed(startTime) + ')', 'done');

    return {
      success: true,
      report: report,
      model: response.model,
      usage: response.usage
    };
  }

  var REVIEW_MODEL = 'claude-sonnet-4-6';

  async function reviewThemes(projectId, onStatus) {
    var startTime = Date.now();

    var framework = await Synth.db.getFramework(projectId);
    if (!framework) {
      return { success: false, error: 'No research framework found.' };
    }

    var themes = await Synth.db.getThemesByProject(projectId);
    if (themes.length < 5) {
      return { success: false, error: 'Too few themes (' + themes.length + ') for meaningful review. Continue synthesising.' };
    }

    onStatus('Analysing ' + themes.length + ' themes', 'step');

    var systemPrompt = Synth.prompts.THEME_REVIEW_SYSTEM;
    var userPrompt = Synth.prompts.buildThemeReviewUser(framework, themes);

    var promptKb = ((systemPrompt.length + userPrompt.length) / 1024).toFixed(1);
    onStatus(promptKb + 'KB prompt (' + elapsed(startTime) + ')', 'update');

    var lastProgressUpdate = 0;
    var response;
    try {
      response = await Synth.api.chatCompletionStream(REVIEW_MODEL, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { max_tokens: 8000, temperature: 0 }, function (charCount, chunkCount, partialContent) {
        var now = Date.now();
        if (now - lastProgressUpdate < 500 && chunkCount > 1) return;
        lastProgressUpdate = now;

        var clusters = (partialContent.match(/"cluster_id"\s*:/g) || []).length;
        var kb = (charCount / 1024).toFixed(1);
        var detail = kb + 'KB';
        if (clusters > 0) detail += ' · ' + clusters + ' cluster' + (clusters !== 1 ? 's' : '');
        onStatus(detail + ' (' + elapsed(startTime) + ')', 'update');
      });
    } catch (e) {
      onStatus('Review failed: ' + e.message, 'error');
      return { success: false, error: 'Review failed: ' + e.message };
    }

    var content = response.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    var result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      onStatus('Model returned invalid JSON', 'error');
      return { success: false, error: 'Model returned invalid JSON. Response starts with: ' + content.substring(0, 200) };
    }

    var themeIdSet = new Set(themes.map(function (t) { return t.theme_id; }));
    (result.clusters || []).forEach(function (cluster) {
      cluster.theme_ids = (cluster.theme_ids || []).filter(function (id) {
        return themeIdSet.has(id);
      });
    });
    result.clusters = (result.clusters || []).filter(function (c) {
      return c.theme_ids && c.theme_ids.length >= 2;
    });

    var clusterCount = result.clusters ? result.clusters.length : 0;
    var weakCount = result.weak_themes ? result.weak_themes.length : 0;
    onStatus(clusterCount + ' cluster(s), ' + weakCount + ' weak theme(s) identified (' + elapsed(startTime) + ')', 'done');

    return {
      success: true,
      clusters: result.clusters || [],
      weak_themes: result.weak_themes || [],
      summary: result.summary || '',
      usage: response.usage,
      model: response.model
    };
  }

  async function applyThemeMerge(projectId, themeIds, newLabel, newDescription) {
    var themes = [];
    for (var i = 0; i < themeIds.length; i++) {
      var theme = await Synth.db.getTheme(themeIds[i]);
      if (theme) themes.push(theme);
    }
    if (themes.length < 2) return null;

    var mergedId = await Synth.db.getNextThemeId();
    var allEvidence = [];
    var allRqMappings = new Set();
    var allRelated = new Set();
    var earliestSeen = null;

    themes.forEach(function (t) {
      allEvidence = allEvidence.concat(t.supporting_evidence || []);
      (t.rq_mappings || []).forEach(function (rq) { allRqMappings.add(rq); });
      (t.related_themes || []).forEach(function (rt) {
        if (themeIds.indexOf(rt) === -1) allRelated.add(rt);
      });
      if (!earliestSeen || (t.first_seen && t.first_seen < earliestSeen)) {
        earliestSeen = t.first_seen;
      }
    });

    var merged = {
      theme_id: mergedId,
      project_id: projectId,
      label: newLabel,
      original_description: newDescription,
      current_description: newDescription,
      source: 'merged',
      supporting_evidence: allEvidence,
      rq_mappings: Array.from(allRqMappings),
      related_themes: Array.from(allRelated),
      first_seen: earliestSeen,
      status: 'verified'
    };

    await Synth.db.saveTheme(merged);
    for (var j = 0; j < themeIds.length; j++) {
      await Synth.db.deleteTheme(themeIds[j]);
    }

    return merged;
  }

  return { processTranscript, processAll, consolidate, reviewThemes, applyThemeMerge, buildTranscriptText };
})();
