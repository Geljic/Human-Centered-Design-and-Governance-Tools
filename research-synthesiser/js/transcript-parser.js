window.Synth = window.Synth || {};

Synth.parser = (function () {

  const ENTITIES = {
    '&apos;': "'", '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>'
  };

  const ARTIFACT_PHRASES = [
    'Play song', 'Mute', 'Next section', 'Indeed',
    'Of employment', 'None', 'Thank you'
  ];

  const STANDALONE_SKIP = new Set([
    'i', 'you', 'so', 'and', 'well', 'the', 'a', 'it', 'is', 'to'
  ]);

  const LEGIT_SHORT = new Set([
    'yeah', 'yes', 'no', 'ok', 'okay', 'right', 'sure', 'thanks',
    'mm-hmm', 'uh-huh', 'oh', 'hmm', 'yep', 'nope', 'maybe'
  ]);

  const STRIP_PATTERNS = [
    /\s*Play song\.\s*/g,
    /\s*Mute\.\s*/g,
    /\s*Next section\.\s*/g,
    /\s*Of employment\.\s*/g,
    /\s*\*\*\*\*\.\s*/g,
    /\s*Oh \*\*\*\*\.\s*/g
  ];

  async function parseDocx(file) {
    const zip = await JSZip.loadAsync(file);
    const docXml = zip.file('word/document.xml');
    if (!docXml) {
      throw new Error('Not a valid .docx file — word/document.xml not found.');
    }

    const xml = await docXml.async('string');
    let text = stripXml(xml);
    text = decodeEntities(text);

    const metadata = extractMetadata(text, file.name);
    const turns = parseSpeakerTurns(text);

    const rawText = turns.map((t) => t.speaker + ' ' + t.timestamp + ' ' + t.content).join('\n');

    return { metadata, turns, raw_text: rawText };
  }

  function stripXml(xml) {
    return xml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  function decodeEntities(text) {
    for (const [entity, char] of Object.entries(ENTITIES)) {
      text = text.split(entity).join(char);
    }
    return text;
  }

  function extractMetadata(text, filename) {
    const meta = { title: '', date: '', duration: '' };

    const headerMatch = text.match(/^(.+?)([A-Z][a-z]+\s+\d+,\s+\d{4}.*?)(\d+m\s+\d+s)/);
    if (headerMatch) {
      meta.title = headerMatch[1].trim();
      meta.date = headerMatch[2].trim();
      meta.duration = headerMatch[3].trim();
    }

    if (!meta.title && filename) {
      meta.title = filename.replace(/\.docx$/i, '');
    }

    return meta;
  }

  function parseSpeakerTurns(text) {
    // Name part: "Adams" or "Adams-Erwin" or "Jean-Pierre" (uppercase after hyphen)
    var NP = '[A-Z][a-z]+(?:-[A-Z][a-z]+)*';
    var NAME = NP + '(?:\\s+' + NP + ')+';
    var pattern = new RegExp(
      '(\\d+)(' + NAME + ')\\s+(\\d+:\\d+)(.*?)(?=\\d+' + NAME + '\\s+\\d+:\\d+|$)', 'gs'
    );

    const raw = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const speaker = match[2].trim();
      const timestamp = match[3].trim();
      let content = match[4].trim();

      content = cleanContent(content);
      if (!content) continue;

      if (isSkippable(content)) continue;

      raw.push({ speaker, timestamp, content });
    }

    return raw;
  }

  function cleanContent(text) {
    for (const p of STRIP_PATTERNS) {
      text = text.replace(p, ' ');
    }

    for (let i = 0; i < 3; i++) {
      text = text.replace(/(\w+)\.([A-Z]\w+)/g, '$1. $2');
    }

    text = text.replace(/ {2,}/g, ' ').trim();
    return text;
  }

  function isSkippable(content) {
    const words = content.split(/\s+/);

    if (words.length === 1) {
      const w = words[0].replace(/[.,!?]+$/, '').toLowerCase();
      if (STANDALONE_SKIP.has(w)) return true;
      if (w.length < 4 && !LEGIT_SHORT.has(w)) return true;
      if (LEGIT_SHORT.has(w)) return false;
      return false;
    }

    if (content.length < 4 && !content.endsWith('?')) return true;

    return false;
  }

  function extractSpeakers(turns) {
    const counts = {};
    for (const t of turns) {
      counts[t.speaker] = (counts[t.speaker] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, turn_count: count }));
  }

  function suggestSpeakerName(filename) {
    const match = filename.replace(/\.docx$/i, '').match(/[-–—]\s*(.+)/);
    if (!match) return null;
    return match[1].replace(/\s*\(.*?\)\s*/g, '').trim() || null;
  }

  function autoAssignRoles(speakers, facilitatorNames, filename) {
    const facSet = new Set((facilitatorNames || []).map((n) => n.toLowerCase().trim()));
    const suggestedParticipant = suggestSpeakerName(filename);

    return speakers.map((s) => {
      let role = 'unassigned';

      if (facSet.has(s.name.toLowerCase())) {
        role = 'facilitator';
      } else if (suggestedParticipant && s.name.toLowerCase() === suggestedParticipant.toLowerCase()) {
        role = 'participant';
      }

      return { ...s, role };
    });
  }

  function suggestParticipantId(filename) {
    const match = filename.match(/^(?:User\s+)?(\d+)/i);
    if (match) return 'P-' + match[1].padStart(2, '0');

    const pMatch = filename.match(/P-(\d+)/i);
    if (pMatch) return 'P-' + pMatch[1].padStart(2, '0');

    return '';
  }

  async function extractDocxText(file) {
    var zip = await JSZip.loadAsync(file);
    var docXml = zip.file('word/document.xml');
    if (!docXml) throw new Error('Not a valid .docx file.');
    var xml = await docXml.async('string');
    return stripXml(xml);
  }

  async function extractPptxText(file) {
    var zip = await JSZip.loadAsync(file);
    var slideFiles = [];
    zip.forEach(function (path) {
      if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) slideFiles.push(path);
    });
    slideFiles.sort(function (a, b) {
      var numA = parseInt(a.match(/slide(\d+)/)[1]);
      var numB = parseInt(b.match(/slide(\d+)/)[1]);
      return numA - numB;
    });
    var parts = [];
    for (var i = 0; i < slideFiles.length; i++) {
      var xml = await zip.file(slideFiles[i]).async('string');
      var text = xml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      text = decodeEntities(text);
      if (text) parts.push(text);
    }
    return parts.join('\n\n');
  }

  return {
    parseDocx,
    extractDocxText,
    extractPptxText,
    extractSpeakers,
    autoAssignRoles,
    suggestParticipantId,
    suggestSpeakerName
  };
})();
