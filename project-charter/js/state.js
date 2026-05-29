// ============================================================
// GLOBAL STATE
// ============================================================
const STORAGE_KEY = 'doe-charter-v1';

let formData = {
  // Section 1 — Project Identity
  projectName: '', projectCode: '', version: '0.1 Draft', status: 'Draft',
  authors: '', date: '', orgUnit: '', program: '',
  // Section 2 — Sponsors & Team
  projectSponsorName: '', projectSponsorRole: '',
  execSponsors: [{ name: '', role: '' }],
  projectTeam: [{ name: '', role: '' }],
  sponsorTeam: [{ name: '', role: '' }],
  // Section 3 — Problem & Context
  problemRaw: '', whoAffected: '', painPoints: '', evidence: '',
  problemStatement: '', hmwQuestion: '',
  // Section 4 — Strategic Objective
  strategicContext: '', relevantPolicy: '', strategicObjective: '',
  // Section 5 — Success Measures
  programMeasures: [''], projectMeasures: [''],
  baselines: [{ metric: '', value: '' }],
  targets: [{ metric: '', value: '' }],
  measurementMethod: '',
  // Section 6 — Scope
  inScope: [''], outScope: [''], contingencies: [''],
  // Section 7 — Risks
  risks: [{ risk: '', mitigation: '', rating: 'Medium' }],
  // Section 8 — Timeline
  phases: [{ phase: '', start: '', end: '', duration: '' }],
  milestones: [{ milestone: '', date: '' }],
  // Section 9 — Dependencies & Stakeholders
  dependencies: [''],
  stakeholders: [{ name: '', interest: '', influence: 'Medium' }],
  // Section 10 — HCD & Agile
  researchApproach: '', userGroups: [''], accessibilityReqs: '',
  privacyNotes: '', definitionOfDone: '', waysOfWorking: '', governanceNotes: ''
};

let saveTimer = null;
