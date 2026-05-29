// ============================================================
// GLOBAL STATE — Persona Builder
// ============================================================
const STORAGE_KEY = 'doe-persona-v2';

// ── DEFAULT CONTENT SECTIONS ─────────────────────────────────
// One source of truth for the four sections every persona starts with.
// Declared up-front so it's available when formData is initialised below
// and from any later script (fields.js, ui.js, storage.js).
function defaultContentSections() {
  return [
    { id: 'jobs',        heading: 'Jobs to be Done', items: [''], style: 'box'  },
    { id: 'motivations', heading: 'Motivations',     items: [''], style: 'blue' },
    { id: 'needs',       heading: 'Needs',           items: [''], style: 'blue' },
    { id: 'challenges',  heading: 'Key challenges',  items: [''], style: 'blue' }
  ];
}

let formData = {
  // Identity
  name: '',
  role: '',
  team: '',
  bio: '',

  // Avatar
  avatarType: '',        // 'upload' | ''
  avatarDataUrl: '',     // base64 for uploaded image

  // Content sections — dynamic array, each has a heading + items[]
  // Designers can add, remove, rename sections
  contentSections: defaultContentSections(),

  // Tools & systems
  tools: [
    { name: '', iconType: 'library', iconKey: 'mobile', iconDataUrl: '' }
  ],

  // Attributes — fully editable: add/remove/rename/reorder
  attributes: [
    { label: 'TECHNOLOGY SAVVINESS',      leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
    { label: 'OPENNESS TO CHANGE',        leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
    { label: 'LEARNING AGILITY',          leftLabel: 'Low',    rightLabel: 'High',     value: 50 },
    { label: 'SYSTEM VS. CUSTOMER FOCUS', leftLabel: 'System', rightLabel: 'Customer', value: 50 }
  ]
};

// In-memory .md file content (not persisted — too large for localStorage)
let mdFileContent = '';
let mdFileName = '';

let saveTimer = null;

// ── RANDOM NAME GENERATOR ────────────────────────────────────
const RANDOM_FIRST_NAMES = [
  'Alex','Amara','Ben','Chloe','Daniel','Elena','Fatima','George',
  'Hannah','Ibrahim','Jasmine','Kevin','Layla','Marcus','Nadia',
  'Oliver','Priya','Quinn','Rachel','Samuel','Tanya','Uma','Victor',
  'Wendy','Xavier','Yuki','Zoe','Aaron','Bianca','Carlos','Diana',
  'Ethan','Fiona','Grace','Henry','Iris','James','Kira','Liam',
  'Maya','Noah','Olivia','Patrick','Rosa','Sophie','Thomas','Ursula'
];
const RANDOM_LAST_NAMES = [
  'Anderson','Brown','Chen','Davis','Evans','Foster','Garcia','Harris',
  'Ibrahim','Johnson','Kim','Lee','Martinez','Nguyen','O\'Brien','Patel',
  'Quinn','Robinson','Singh','Taylor','Upton','Vasquez','Williams','Xu',
  'Young','Zhang','Adams','Baker','Campbell','Dixon','Edwards','Fleming',
  'Green','Hall','Ingram','Jones','Khan','Lewis','Moore','Nelson',
  'Owen','Parker','Reed','Scott','Turner','Underwood','Vance','Walker'
];

function generateRandomName() {
  const first = RANDOM_FIRST_NAMES[Math.floor(Math.random() * RANDOM_FIRST_NAMES.length)];
  const last  = RANDOM_LAST_NAMES[Math.floor(Math.random() * RANDOM_LAST_NAMES.length)];
  return first + ' ' + last;
}

// ── SECTION ID GENERATOR ─────────────────────────────────────
function generateSectionId() {
  return 'section-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}
