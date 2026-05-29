window.Synth = window.Synth || {};

Synth.verify = (function () {

  var FILLER = /\b(um|uh|like|you know|kind of|sort of|i mean|basically|actually|literally)\b/gi;
  var PUNCT = /[.,;:!?"'()\[\]{}\-–—…]/g;

  function normalise(text) {
    return text
      .toLowerCase()
      .replace(FILLER, ' ')
      .replace(PUNCT, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getSignificantWords(text) {
    return normalise(text).split(' ').filter(function (w) { return w.length > 3; });
  }

  // Tier 1: JS fuzzy match
  function tier1Match(quote, transcriptText) {
    var normQuote = normalise(quote);
    var normTranscript = normalise(transcriptText);

    // Exact substring match
    if (normTranscript.indexOf(normQuote) !== -1) {
      return { matched: true, method: 'exact' };
    }

    // Sliding window of significant words
    var quoteWords = getSignificantWords(quote);
    if (quoteWords.length < 3) {
      // Very short quote — try exact match only
      return { matched: false };
    }

    var transcriptWords = getSignificantWords(transcriptText);
    var threshold = Math.ceil(quoteWords.length * 0.8);

    // Try windows of 6-8 consecutive significant words from the quote
    for (var winSize = Math.min(8, quoteWords.length); winSize >= Math.min(6, quoteWords.length); winSize--) {
      for (var i = 0; i <= quoteWords.length - winSize; i++) {
        var window = quoteWords.slice(i, i + winSize).join(' ');
        if (normTranscript.indexOf(window) !== -1) {
          return { matched: true, method: 'window' };
        }
      }
    }

    // Percentage-based: count how many significant words from the quote appear in the transcript
    var found = 0;
    for (var j = 0; j < quoteWords.length; j++) {
      if (transcriptWords.indexOf(quoteWords[j]) !== -1) found++;
    }

    if (found >= threshold) {
      return { matched: true, method: 'threshold' };
    }

    return { matched: false };
  }

  // Tier 2: Haiku API verification
  async function tier2Verify(quote, transcriptText) {
    var section = extractRelevantSection(quote, transcriptText, 2000);

    var response = await Synth.api.chatCompletion(
      'claude-haiku-4-5-20251001',
      [
        { role: 'system', content: Synth.prompts.VERIFICATION_SYSTEM },
        { role: 'user', content: Synth.prompts.buildVerificationUser(quote, section) }
      ],
      { max_tokens: 200, temperature: 0 }
    );

    try {
      var cleaned = response.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      var result = JSON.parse(cleaned);
      return {
        verdict: result.verdict || 'fabricated',
        explanation: result.explanation || ''
      };
    } catch (e) {
      return { verdict: 'fabricated', explanation: 'Failed to parse verification response.' };
    }
  }

  function extractRelevantSection(quote, transcriptText, maxChars) {
    var normQuote = normalise(quote);
    var quoteWords = getSignificantWords(quote);

    // Try exact anchor first (first 5 normalised words)
    var anchor = normQuote.split(' ').slice(0, 5).join(' ');
    var normTranscript = normalise(transcriptText);
    var idx = normTranscript.indexOf(anchor);

    if (idx !== -1) {
      var ratio = idx / normTranscript.length;
      var origPos = Math.floor(ratio * transcriptText.length);
      var start = Math.max(0, origPos - 500);
      return transcriptText.substring(start, start + maxChars);
    }

    // Anchor not found — search speaker turns for best word overlap
    var turns = transcriptText.split(/\n\n+/);
    var bestIdx = -1;
    var bestScore = 0;

    for (var i = 0; i < turns.length; i++) {
      var turnWords = getSignificantWords(turns[i]);
      if (turnWords.length === 0) continue;
      var overlap = 0;
      for (var j = 0; j < quoteWords.length; j++) {
        if (turnWords.indexOf(quoteWords[j]) !== -1) overlap++;
      }
      var score = overlap / quoteWords.length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestScore > 0.3) {
      // Build context: best turn plus surrounding turns
      var contextStart = Math.max(0, bestIdx - 2);
      var contextEnd = Math.min(turns.length, bestIdx + 3);
      var section = turns.slice(contextStart, contextEnd).join('\n\n');
      if (section.length > maxChars) section = section.substring(0, maxChars);
      return section;
    }

    // Last resort: return start of transcript (more useful than middle)
    return transcriptText.substring(0, maxChars);
  }

  // Full verification pipeline for an array of evidence objects
  async function verifyQuotes(evidenceList, transcriptText, onProgress) {
    var results = [];
    var tier2Pending = [];

    // Tier 1: run all JS fuzzy matches first (instant)
    for (var i = 0; i < evidenceList.length; i++) {
      var ev = evidenceList[i];
      var t1 = tier1Match(ev.quote, transcriptText);
      if (t1.matched) {
        results.push({ index: i, status: 'verified', method: t1.method });
      } else {
        tier2Pending.push({ index: i, quote: ev.quote });
      }
    }

    var tier1Count = results.length;
    if (onProgress) onProgress(tier1Count, evidenceList.length, tier2Pending.length);

    if (tier2Pending.length === 0) return results;

    // Tier 2: fire all Haiku calls concurrently, report as each completes
    var tier2Done = 0;
    var tier2Promises = tier2Pending.map(function (item) {
      return tier2Verify(item.quote, transcriptText)
        .then(function (t2) {
          return {
            index: item.index,
            status: t2.verdict === 'confirmed' ? 'confirmed' : 'fabricated',
            explanation: t2.explanation
          };
        })
        .catch(function (e) {
          return {
            index: item.index,
            status: 'fabricated',
            explanation: 'Verification API call failed: ' + e.message
          };
        })
        .then(function (result) {
          tier2Done++;
          if (onProgress) onProgress(tier1Count + tier2Done, evidenceList.length, tier2Pending.length - tier2Done);
          return result;
        });
    });

    var tier2Results = await Promise.all(tier2Promises);
    results = results.concat(tier2Results);

    return results;
  }

  return { tier1Match, tier2Verify, verifyQuotes };
})();
