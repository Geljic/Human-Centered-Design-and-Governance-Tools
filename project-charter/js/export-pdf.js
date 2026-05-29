// PDF EXPORT — browser print
// ============================================================
function exportPDF() {
  showToast('Opening print dialog — choose "Save as PDF" in your browser.', 'info');
  setTimeout(() => window.print(), 400);
}
