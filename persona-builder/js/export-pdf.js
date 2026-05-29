// ============================================================
// PDF EXPORT — window.print() with print-optimised CSS
// ============================================================

function exportPDF() {
  showToast('Opening print dialog — select "Save as PDF" in your browser.', 'info');
  // Small delay so toast renders before print dialog blocks
  setTimeout(() => {
    window.print();
  }, 400);
}
