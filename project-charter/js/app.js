// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadSaved();
  renderAllSections();
  renderPreview();
  updateProgress();
  initDragAndDrop();
  initSharePointModal();
  initAiDialog();
  initWelcome();
});
