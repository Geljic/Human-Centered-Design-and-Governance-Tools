window.Synth = window.Synth || {};

Synth.deidentify = (function () {

  var state = {
    originalTurns: null,
    currentTurns: null,
    onComplete: null,
    onCancel: null,
    facNames: [],
    projectId: null,
    findTerm: '',
    replaceTerm: '',
    matches: [],
    currentMatch: -1,
    editingTurnIndex: -1
  };

  // --- Data Functions ---

  function detectNames(turns, facilitatorNames) {
    var facSet = new Set((facilitatorNames || []).map(function (n) { return n.toLowerCase().trim(); }));
    var counts = {};
    for (var i = 0; i < turns.length; i++) {
      var s = turns[i].speaker;
      counts[s] = (counts[s] || 0) + 1;
    }

    var speakers = Object.entries(counts)
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (entry) { return { name: entry[0], turnCount: entry[1] }; });

    var nonFac = speakers.filter(function (s) { return !facSet.has(s.name.toLowerCase()); });
    var participantNum = 0;

    return speakers.map(function (s) {
      var isFac = facSet.has(s.name.toLowerCase());
      var defaultReplacement;
      if (isFac) {
        defaultReplacement = s.name;
      } else {
        participantNum++;
        defaultReplacement = nonFac.length === 1 ? 'Participant' : 'Participant ' + participantNum;
      }
      return {
        name: s.name,
        turnCount: s.turnCount,
        isFacilitator: isFac,
        defaultReplacement: defaultReplacement
      };
    });
  }

  function applyNameReplacements(turns, replacements) {
    var map = {};
    for (var i = 0; i < replacements.length; i++) {
      if (replacements[i].original !== replacements[i].replacement) {
        map[replacements[i].original] = replacements[i].replacement;
      }
    }

    return turns.map(function (t) {
      var newSpeaker = map[t.speaker] !== undefined ? map[t.speaker] : t.speaker;
      var newContent = t.content;

      for (var orig in map) {
        var regex = new RegExp('\\b' + escapeRegex(orig) + '\\b', 'gi');
        newContent = newContent.replace(regex, map[orig]);
      }

      return { speaker: newSpeaker, timestamp: t.timestamp, content: newContent };
    });
  }

  function applyFindReplace(turns, rules) {
    if (!rules || rules.length === 0) return turns;

    return turns.map(function (t) {
      var newContent = t.content;
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (!r.find) continue;
        var regex = new RegExp('\\b' + escapeRegex(r.find) + '\\b', 'gi');
        newContent = newContent.replace(regex, r.replace || '');
      }
      return { speaker: t.speaker, timestamp: t.timestamp, content: newContent };
    });
  }

  function rebuildRawText(turns) {
    return turns.map(function (t) {
      return t.speaker + ' ' + t.timestamp + ' ' + t.content;
    }).join('\n');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // --- Search / Find & Replace ---

  function performSearch(term) {
    state.findTerm = term;
    state.matches = [];
    state.currentMatch = -1;

    if (!term.trim()) {
      updateMatchCount();
      renderPreview();
      return;
    }

    var regex = new RegExp(escapeRegex(term), 'gi');
    for (var i = 0; i < state.currentTurns.length; i++) {
      var content = state.currentTurns[i].content;
      var m;
      while ((m = regex.exec(content)) !== null) {
        state.matches.push({
          turnIndex: i,
          startPos: m.index,
          endPos: m.index + m[0].length
        });
      }
    }

    if (state.matches.length > 0) state.currentMatch = 0;
    updateMatchCount();
    renderPreview();

    if (state.matches.length > 0) scrollToCurrentMatch();
  }

  function navigateMatch(direction) {
    if (state.matches.length === 0) return;
    state.currentMatch += direction;
    if (state.currentMatch >= state.matches.length) state.currentMatch = 0;
    if (state.currentMatch < 0) state.currentMatch = state.matches.length - 1;
    updateMatchCount();
    renderPreview();
    scrollToCurrentMatch();
  }

  function scrollToCurrentMatch() {
    if (state.currentMatch < 0) return;
    var el = document.querySelector('.deid-match-current');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function replaceCurrentMatch() {
    if (state.currentMatch < 0 || state.matches.length === 0) return;
    var match = state.matches[state.currentMatch];
    var turn = state.currentTurns[match.turnIndex];
    var replacement = state.replaceTerm;

    turn.content = turn.content.substring(0, match.startPos) + replacement + turn.content.substring(match.endPos);

    performSearch(state.findTerm);
  }

  function replaceAllMatches() {
    if (state.matches.length === 0) return;
    var term = state.findTerm;
    var replacement = state.replaceTerm;
    var regex = new RegExp(escapeRegex(term), 'gi');
    var count = state.matches.length;

    for (var i = 0; i < state.currentTurns.length; i++) {
      state.currentTurns[i].content = state.currentTurns[i].content.replace(regex, replacement);
    }

    performSearch(state.findTerm);
    showDeidStatus('success', count + ' replacement(s) made.');
  }

  function updateMatchCount() {
    var el = document.getElementById('subpage-deid-match-count');
    if (!el) return;
    if (state.matches.length === 0 && state.findTerm.trim()) {
      el.textContent = 'No matches';
    } else if (state.matches.length > 0) {
      el.textContent = (state.currentMatch + 1) + ' of ' + state.matches.length;
    } else {
      el.textContent = '';
    }
  }

  function renderContentWithHighlights(content, turnIndex) {
    var escaped = escapeHtml(content);
    if (!state.findTerm.trim() || state.matches.length === 0) return escaped;

    var turnMatches = state.matches.filter(function (m) { return m.turnIndex === turnIndex; });
    if (turnMatches.length === 0) return escaped;

    var escapedTerm = escapeHtml(state.findTerm);
    var regex = new RegExp('(' + escapeRegex(escapedTerm) + ')', 'gi');

    var globalMatchIndex = 0;
    for (var i = 0; i < state.matches.length; i++) {
      if (state.matches[i].turnIndex === turnIndex) break;
      globalMatchIndex++;
    }

    var localIndex = 0;
    return escaped.replace(regex, function (match) {
      var isCurrentMatch = (globalMatchIndex + localIndex) === state.currentMatch;
      localIndex++;
      if (isCurrentMatch) {
        return '<mark class="deid-match-current">' + match + '</mark>';
      }
      return '<mark class="deid-match">' + match + '</mark>';
    });
  }

  // --- Facilitator Toggle (via role dropdown) ---

  async function saveFacilitatorsToFramework() {
    if (!state.projectId || state.facNames.length === 0) return;
    try {
      var fw = await Synth.db.getFramework(state.projectId);
      if (!fw) return;
      var existing = (fw.facilitator_names || []).map(function (n) { return n.toLowerCase().trim(); });
      var changed = false;
      for (var i = 0; i < state.facNames.length; i++) {
        if (existing.indexOf(state.facNames[i].toLowerCase().trim()) < 0) {
          fw.facilitator_names.push(state.facNames[i]);
          changed = true;
        }
      }
      if (changed) await Synth.db.saveFramework(fw);
    } catch (e) {
      console.error('Failed to save facilitators to framework:', e);
    }
  }

  // --- Inline Turn Editing ---

  function startEditingTurn(index) {
    state.editingTurnIndex = index;
    renderPreview();
    var textarea = document.querySelector('.deid-turn-textarea');
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }

  function saveEditingTurn(index) {
    var textarea = document.querySelector('.deid-turn-textarea');
    if (textarea) {
      state.currentTurns[index].content = textarea.value;
    }
    state.editingTurnIndex = -1;
    if (state.findTerm.trim()) performSearch(state.findTerm);
    else renderPreview();
  }

  function cancelEditingTurn() {
    state.editingTurnIndex = -1;
    renderPreview();
  }

  // --- UI Functions ---

  function show(pendingParse, facNames, projectId, onComplete, onCancel) {
    state.originalTurns = pendingParse.result.turns.map(function (t) {
      return { speaker: t.speaker, timestamp: t.timestamp, content: t.content };
    });
    state.currentTurns = state.originalTurns.map(function (t) {
      return { speaker: t.speaker, timestamp: t.timestamp, content: t.content };
    });
    state.onComplete = onComplete;
    state.onCancel = onCancel;
    state.facNames = (facNames || []).slice();
    state.projectId = projectId || null;
    state.findTerm = '';
    state.replaceTerm = '';
    state.matches = [];
    state.currentMatch = -1;
    state.editingTurnIndex = -1;

    var card = document.getElementById('subpage-deidentify');
    document.getElementById('subpage-deid-filename').textContent = pendingParse.file.name;

    var findInput = document.getElementById('subpage-deid-find-input');
    var replaceInput = document.getElementById('subpage-deid-replace-input');
    if (findInput) findInput.value = '';
    if (replaceInput) replaceInput.value = '';

    renderNameTable();
    renderPreview();
    updateProceedState();
    updateMatchCount();

    document.getElementById('subpage-deid-confirm-checkbox').checked = false;
    card.classList.remove('hidden');
  }

  function hide() {
    document.getElementById('subpage-deidentify').classList.add('hidden');
  }

  function renderNameTable() {
    var detected = detectNames(state.currentTurns, state.facNames);
    var container = document.getElementById('subpage-deid-name-list');
    container.innerHTML = '';

    detected.forEach(function (d) {
      var row = document.createElement('div');
      row.className = 'deid-name-row';

      var defaultRole = d.isFacilitator ? 'facilitator' : 'participant';

      row.innerHTML =
        '<span class="deid-name-original">' + escapeHtml(d.name) +
        '<span class="deid-name-turns">' + d.turnCount + ' turns</span></span>' +
        '<span class="deid-arrow">&rarr;</span>' +
        '<input type="text" class="deid-name-input" data-original="' + escapeHtml(d.name) +
        '" value="' + escapeHtml(d.defaultReplacement) + '">' +
        '<select class="deid-role-select" data-name="' + escapeHtml(d.name) + '">' +
          '<option value="participant"' + (defaultRole === 'participant' ? ' selected' : '') + '>Participant</option>' +
          '<option value="facilitator"' + (defaultRole === 'facilitator' ? ' selected' : '') + '>Facilitator</option>' +
          '<option value="observer">Observer</option>' +
          '<option value="exclude">Exclude</option>' +
        '</select>';
      container.appendChild(row);
    });
  }

  function getRoleAssignments() {
    var roleMap = {};
    var selects = document.querySelectorAll('.deid-role-select');
    var inputs = document.querySelectorAll('.deid-name-input');

    inputs.forEach(function (input) {
      var original = input.dataset.original;
      var replacement = input.value.trim() || original;
      var roleSelect = document.querySelector('.deid-role-select[data-name="' + original + '"]');
      var role = roleSelect ? roleSelect.value : 'participant';
      roleMap[replacement] = role;
    });

    return roleMap;
  }

  function renderPreview() {
    var previewDiv = document.getElementById('subpage-deid-preview');
    previewDiv.innerHTML = '';

    state.currentTurns.forEach(function (t, i) {
      var div = document.createElement('div');
      div.className = 'turn';
      div.dataset.index = i;

      if (state.editingTurnIndex === i) {
        div.innerHTML =
          '<div class="turn-header">' + escapeHtml(t.speaker) +
          '<span class="turn-timestamp">' + escapeHtml(t.timestamp) + '</span></div>' +
          '<textarea class="deid-turn-textarea" rows="3">' + escapeHtml(t.content) + '</textarea>' +
          '<div class="deid-turn-edit-actions">' +
          '<button class="btn btn-primary btn-sm deid-turn-save" data-index="' + i + '">Save</button>' +
          '<button class="btn btn-secondary btn-sm deid-turn-cancel">Cancel</button>' +
          '</div>';
      } else {
        var contentHtml = renderContentWithHighlights(t.content, i);
        div.innerHTML =
          '<div class="turn-header">' + escapeHtml(t.speaker) +
          '<span class="turn-timestamp">' + escapeHtml(t.timestamp) + '</span>' +
          '<button class="deid-turn-edit-btn" data-index="' + i + '" title="Edit this turn">&#9998;</button>' +
          '</div>' +
          '<div class="turn-content">' + contentHtml + '</div>';
      }

      previewDiv.appendChild(div);
    });
  }

  function readNameReplacements() {
    var inputs = document.querySelectorAll('.deid-name-input');
    var replacements = [];
    inputs.forEach(function (input) {
      replacements.push({
        original: input.dataset.original,
        replacement: input.value.trim() || input.dataset.original
      });
    });
    return replacements;
  }

  function applyAll() {
    if (state.editingTurnIndex >= 0) {
      saveEditingTurn(state.editingTurnIndex);
    }

    var nameReplacements = readNameReplacements();
    state.currentTurns = applyNameReplacements(state.currentTurns, nameReplacements);

    renderNameTable();
    if (state.findTerm.trim()) performSearch(state.findTerm);
    else renderPreview();
    showDeidStatus('success', 'Name replacements applied.');
  }

  function resetToOriginal() {
    state.currentTurns = state.originalTurns.map(function (t) {
      return { speaker: t.speaker, timestamp: t.timestamp, content: t.content };
    });
    state.findTerm = '';
    state.replaceTerm = '';
    state.matches = [];
    state.currentMatch = -1;
    state.editingTurnIndex = -1;

    var findInput = document.getElementById('subpage-deid-find-input');
    var replaceInput = document.getElementById('subpage-deid-replace-input');
    if (findInput) findInput.value = '';
    if (replaceInput) replaceInput.value = '';

    document.getElementById('subpage-deid-confirm-checkbox').checked = false;
    renderNameTable();
    renderPreview();
    updateProceedState();
    updateMatchCount();
    showDeidStatus('info', 'Transcript reset to original.');
  }

  function updateProceedState() {
    var checked = document.getElementById('subpage-deid-confirm-checkbox').checked;
    document.getElementById('btn-subpage-deid-proceed').disabled = !checked;
  }

  async function handleProceed() {
    if (state.editingTurnIndex >= 0) {
      saveEditingTurn(state.editingTurnIndex);
    }

    await saveFacilitatorsToFramework();

    var result = {
      turns: state.currentTurns,
      raw_text: rebuildRawText(state.currentTurns)
    };

    hide();
    if (state.onComplete) state.onComplete(result);
  }

  function handleCancel() {
    hide();
    if (state.onCancel) state.onCancel();
  }

  function showDeidStatus(type, message) {
    var el = document.getElementById('subpage-deid-status');
    el.className = 'status-msg ' + type;
    el.textContent = message;
  }

  // --- Event Binding ---

  function initEvents() {
    document.getElementById('btn-subpage-apply-names').addEventListener('click', applyAll);
    document.getElementById('btn-subpage-deid-proceed').addEventListener('click', handleProceed);
    document.getElementById('btn-subpage-deid-cancel').addEventListener('click', handleCancel);
    document.getElementById('btn-subpage-deid-reset').addEventListener('click', resetToOriginal);
    document.getElementById('subpage-deid-confirm-checkbox').addEventListener('change', updateProceedState);

    // Role select change — update facilitator list when role changes
    document.getElementById('subpage-deid-name-list').addEventListener('change', function (e) {
      var sel = e.target.closest('.deid-role-select');
      if (!sel) return;
      var name = sel.dataset.name;
      var lowerName = name.toLowerCase().trim();
      if (sel.value === 'facilitator') {
        if (!state.facNames.some(function (n) { return n.toLowerCase().trim() === lowerName; })) {
          state.facNames.push(name);
        }
        // Update replacement to keep original name for facilitators
        var input = document.querySelector('.deid-name-input[data-original="' + name + '"]');
        if (input) input.value = name;
      } else {
        state.facNames = state.facNames.filter(function (n) { return n.toLowerCase().trim() !== lowerName; });
      }
    });

    // Find & Replace
    document.getElementById('subpage-deid-find-input').addEventListener('input', function (e) {
      performSearch(e.target.value);
    });

    document.getElementById('subpage-deid-replace-input').addEventListener('input', function (e) {
      state.replaceTerm = e.target.value;
    });

    document.getElementById('btn-subpage-deid-prev').addEventListener('click', function () {
      navigateMatch(-1);
    });

    document.getElementById('btn-subpage-deid-next').addEventListener('click', function () {
      navigateMatch(1);
    });

    document.getElementById('btn-subpage-deid-replace').addEventListener('click', function () {
      replaceCurrentMatch();
    });

    document.getElementById('btn-subpage-deid-replace-all').addEventListener('click', function () {
      replaceAllMatches();
    });

    // Inline turn editing (delegated)
    document.getElementById('subpage-deid-preview').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.deid-turn-edit-btn');
      if (editBtn) {
        startEditingTurn(parseInt(editBtn.dataset.index, 10));
        return;
      }

      var saveBtn = e.target.closest('.deid-turn-save');
      if (saveBtn) {
        saveEditingTurn(parseInt(saveBtn.dataset.index, 10));
        return;
      }

      var cancelBtn = e.target.closest('.deid-turn-cancel');
      if (cancelBtn) {
        cancelEditingTurn();
        return;
      }
    });
  }

  return { show, hide, initEvents, detectNames, applyNameReplacements, applyFindReplace, rebuildRawText, getRoleAssignments };
})();
