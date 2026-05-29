window.Synth = window.Synth || {};

Synth.db = (function () {
  const DB_NAME = 'research-synthesiser';
  const DB_VERSION = 4;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        const tx = e.target.transaction;

        if (!d.objectStoreNames.contains('projects')) {
          const store = d.createObjectStore('projects', { keyPath: 'project_id' });
          store.createIndex('name', 'name', { unique: false });
        }

        if (!d.objectStoreNames.contains('frameworks')) {
          d.createObjectStore('frameworks', { keyPath: 'project_id' });
        }

        if (!d.objectStoreNames.contains('transcripts')) {
          const store = d.createObjectStore('transcripts', { keyPath: 'transcript_id' });
          store.createIndex('project_id', 'project_id', { unique: false });
          store.createIndex('participant_id', 'participant_id', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        } else {
          const txStore = tx.objectStore('transcripts');
          if (!txStore.indexNames.contains('participant_id')) {
            txStore.createIndex('participant_id', 'participant_id', { unique: false });
          }
        }

        if (!d.objectStoreNames.contains('themes')) {
          const store = d.createObjectStore('themes', { keyPath: 'theme_id' });
          store.createIndex('project_id', 'project_id', { unique: false });
          store.createIndex('source', 'source', { unique: false });
        }

        if (!d.objectStoreNames.contains('participants')) {
          const store = d.createObjectStore('participants', { keyPath: 'participant_id' });
          store.createIndex('project_id', 'project_id', { unique: false });
        }

        if (!d.objectStoreNames.contains('session_syntheses')) {
          const store = d.createObjectStore('session_syntheses', { keyPath: 'synthesis_id' });
          store.createIndex('project_id', 'project_id', { unique: false });
          store.createIndex('participant_id', 'participant_id', { unique: false });
        }

        if (!d.objectStoreNames.contains('inquiries')) {
          const store = d.createObjectStore('inquiries', { keyPath: 'inquiry_id' });
          store.createIndex('participant_key', 'participant_key', { unique: false });
          store.createIndex('project_id', 'project_id', { unique: false });
        }

        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      req.onerror = (e) => {
        reject(new Error('Failed to open database: ' + e.target.error?.message));
      };
    });
  }

  function tx(storeName, mode) {
    const transaction = db.transaction(storeName, mode || 'readonly');
    return transaction.objectStore(storeName);
  }

  function promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error(req.error?.message || 'IndexedDB request failed'));
    });
  }

  // --- Generic CRUD ---

  function put(storeName, record) {
    return promisify(tx(storeName, 'readwrite').put(record));
  }

  function get(storeName, key) {
    return promisify(tx(storeName, 'readonly').get(key));
  }

  function getAll(storeName) {
    return promisify(tx(storeName, 'readonly').getAll());
  }

  function del(storeName, key) {
    return promisify(tx(storeName, 'readwrite').delete(key));
  }

  function getAllByIndex(storeName, indexName, value) {
    const store = tx(storeName, 'readonly');
    const index = store.index(indexName);
    return promisify(index.getAll(value));
  }

  // --- Projects ---

  function createProject(name) {
    const project = {
      project_id: 'proj_' + Date.now(),
      name: name,
      created: new Date().toISOString(),
      active: true
    };
    return put('projects', project).then(() => project);
  }

  function getProjects() {
    return getAll('projects');
  }

  function getProject(projectId) {
    return get('projects', projectId);
  }

  function updateProject(project) {
    return put('projects', project);
  }

  function deleteProject(projectId) {
    return del('projects', projectId);
  }

  // --- Frameworks ---

  function getFramework(projectId) {
    return get('frameworks', projectId);
  }

  function saveFramework(framework) {
    return put('frameworks', framework);
  }

  function createDefaultFramework(projectId) {
    const framework = {
      project_id: projectId,
      background: '',
      facilitator_names: [],
      research_questions: [],
      participant_groups: []
    };
    return put('frameworks', framework).then(() => framework);
  }

  // --- Transcripts ---

  function saveTranscript(transcript) {
    return put('transcripts', transcript);
  }

  function getTranscript(transcriptId) {
    return get('transcripts', transcriptId);
  }

  function getTranscriptsByProject(projectId) {
    return getAllByIndex('transcripts', 'project_id', projectId);
  }

  function deleteTranscript(transcriptId) {
    return del('transcripts', transcriptId);
  }

  // --- Participants ---

  function saveParticipant(participant) {
    return put('participants', participant);
  }

  function getParticipant(participantId) {
    return get('participants', participantId);
  }

  function getParticipantsByProject(projectId) {
    return getAllByIndex('participants', 'project_id', projectId);
  }

  function deleteParticipant(participantId) {
    return del('participants', participantId);
  }

  async function getNextParticipantNumber(projectId) {
    var participants = await getParticipantsByProject(projectId);
    var max = 0;
    for (var i = 0; i < participants.length; i++) {
      var displayId = participants[i].display_id || participants[i].participant_id;
      var num = parseInt(displayId.replace(/^P-/, ''), 10);
      if (!isNaN(num) && num > max) max = num;
    }
    return max + 1;
  }

  // --- Themes ---

  function saveTheme(theme) {
    return put('themes', theme);
  }

  function getTheme(themeId) {
    return get('themes', themeId);
  }

  function getThemesByProject(projectId) {
    return getAllByIndex('themes', 'project_id', projectId);
  }

  function deleteTheme(themeId) {
    return del('themes', themeId);
  }

  function getNextThemeId() {
    return getAll('themes').then((themes) => {
      let max = 0;
      for (const t of themes) {
        const num = parseInt(t.theme_id.replace('theme_', ''), 10);
        if (num > max) max = num;
      }
      return 'theme_' + String(max + 1).padStart(3, '0');
    });
  }

  // --- Session Syntheses ---

  function saveSessionSynthesis(synthesis) {
    return put('session_syntheses', synthesis);
  }

  function getSessionSynthesis(synthesisId) {
    return get('session_syntheses', synthesisId);
  }

  function getSessionSynthesesByProject(projectId) {
    return getAllByIndex('session_syntheses', 'project_id', projectId);
  }

  function getSessionSynthesesByParticipant(participantId) {
    return getAllByIndex('session_syntheses', 'participant_id', participantId);
  }

  function deleteSessionSynthesis(synthesisId) {
    return del('session_syntheses', synthesisId);
  }

  // --- Inquiries ---

  function saveInquiry(inquiry) {
    return put('inquiries', inquiry);
  }

  function getInquiriesByParticipant(participantKey) {
    return getAllByIndex('inquiries', 'participant_key', participantKey);
  }

  function deleteInquiry(inquiryId) {
    return del('inquiries', inquiryId);
  }

  // --- Settings ---

  function getSetting(key) {
    return get('settings', key).then((rec) => rec ? rec.value : null);
  }

  function saveSetting(key, value) {
    return put('settings', { key: key, value: value });
  }

  // --- Utilities ---

  function clearStore(storeName) {
    return promisify(tx(storeName, 'readwrite').clear());
  }

  return {
    open,
    createProject, getProjects, getProject, updateProject, deleteProject,
    getFramework, saveFramework, createDefaultFramework,
    saveParticipant, getParticipant, getParticipantsByProject, deleteParticipant, getNextParticipantNumber,
    saveTranscript, getTranscript, getTranscriptsByProject, deleteTranscript,
    saveTheme, getTheme, getThemesByProject, deleteTheme, getNextThemeId,
    saveSessionSynthesis, getSessionSynthesis, getSessionSynthesesByProject, getSessionSynthesesByParticipant, deleteSessionSynthesis,
    saveInquiry, getInquiriesByParticipant, deleteInquiry,
    getSetting, saveSetting,
    clearStore
  };
})();
