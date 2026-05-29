window.Synth = window.Synth || {};

Synth.export = (function () {

  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadMarkdown(content, projectName) {
    var safeName = (projectName || 'synthesis').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-');
    var date = new Date().toISOString().slice(0, 10);
    downloadFile(content, safeName + '-synthesis-' + date + '.md', 'text/markdown');
  }

  async function exportThemeDatabase(projectId, projectName) {
    var themes = await Synth.db.getThemesByProject(projectId);
    var framework = await Synth.db.getFramework(projectId);

    var exportData = {
      export_version: 1,
      exported_at: new Date().toISOString(),
      project_name: projectName || '',
      framework: framework || null,
      themes: themes
    };

    var json = JSON.stringify(exportData, null, 2);
    var safeName = (projectName || 'themes').replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '-');
    var date = new Date().toISOString().slice(0, 10);
    downloadFile(json, safeName + '-themes-' + date + '.json', 'application/json');

    return themes.length;
  }

  async function importThemeDatabase(projectId, jsonString) {
    var data;
    try {
      data = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Invalid JSON file.');
    }

    if (!data.themes || !Array.isArray(data.themes)) {
      throw new Error('No themes array found in the import file.');
    }

    var imported = 0;
    var skipped = 0;

    for (var i = 0; i < data.themes.length; i++) {
      var theme = data.themes[i];

      if (!theme.theme_id || !theme.label) {
        skipped++;
        continue;
      }

      var existing = await Synth.db.getTheme(theme.theme_id);
      if (existing) {
        skipped++;
        continue;
      }

      theme.project_id = projectId;
      await Synth.db.saveTheme(theme);
      imported++;
    }

    return { imported: imported, skipped: skipped, total: data.themes.length };
  }

  function renderMarkdownPreview(markdown) {
    var lines = markdown.split('\n');
    var html = [];
    var inList = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (/^#{1,6}\s/.test(line)) {
        if (inList) { html.push('</ul>'); inList = false; }
        var level = line.match(/^(#+)/)[1].length;
        var text = escapeHtml(line.replace(/^#+\s*/, ''));
        html.push('<h' + level + '>' + text + '</h' + level + '>');
      } else if (/^>\s/.test(line)) {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<blockquote>' + formatInline(line.replace(/^>\s*/, '')) + '</blockquote>');
      } else if (/^[-*]\s/.test(line)) {
        if (!inList) { html.push('<ul>'); inList = true; }
        html.push('<li>' + formatInline(line.replace(/^[-*]\s*/, '')) + '</li>');
      } else if (/^\d+\.\s/.test(line)) {
        if (!inList) { html.push('<ol>'); inList = true; }
        html.push('<li>' + formatInline(line.replace(/^\d+\.\s*/, '')) + '</li>');
      } else if (line.trim() === '---' || line.trim() === '***') {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<hr>');
      } else if (line.trim() === '') {
        if (inList) { html.push('</ul>'); inList = false; }
      } else {
        if (inList) { html.push('</ul>'); inList = false; }
        html.push('<p>' + formatInline(line) + '</p>');
      }
    }

    if (inList) html.push('</ul>');
    return html.join('\n');
  }

  function formatInline(text) {
    var s = escapeHtml(text);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/"([^"]+)"/g, '<q>$1</q>');
    return s;
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { downloadMarkdown, exportThemeDatabase, importThemeDatabase, renderMarkdownPreview };
})();
