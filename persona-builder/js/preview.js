// ============================================================
// PREVIEW — live persona card DOM renderer
// Matches the Dave Castillo template layout exactly
// ============================================================

function renderPreview() {
  const container = document.getElementById('persona-preview');
  if (!container) return;

  const p = formData;
  const avatarSrc = getCurrentAvatarSrc();

  // Migrate legacy flat content structure if needed
  if (typeof migrateLegacyContentSections === 'function') {
    migrateLegacyContentSections();
  }

  const sections = p.contentSections || [];

  // Split sections: first section goes in left column (box style), rest go right
  // Actually: left column gets the first "box" section + tools
  // Right column gets all "blue" sections + attributes
  // But we respect the designer's order — left gets sections with style='box', right gets style='blue'
  const leftSections  = sections.filter((s) => s.style === 'box');
  const rightSections = sections.filter((s) => s.style === 'blue');

  container.innerHTML = `
    <div class="persona-card">

      <!-- ── LEFT COLUMN ─────────────────────────────── -->
      <div class="persona-left">

        <!-- Avatar -->
        <div class="persona-avatar-wrap">
          ${avatarSrc
            ? `<img src="${avatarSrc}" alt="Persona avatar" class="persona-avatar" />`
            : `<div class="persona-avatar-placeholder">
                 <span class="persona-avatar-placeholder-icon">🖼️</span>
                 <span class="persona-avatar-placeholder-text">Upload a photo<br/>in the editor</span>
               </div>`
          }
        </div>

        <!-- Name / Role / Team -->
        <div class="persona-identity">
          <h1 class="persona-name">${escHtml(p.name) || '<span class="placeholder">Name</span>'}</h1>
          <h2 class="persona-role">${escHtml(p.role) || '<span class="placeholder">Role</span>'}${p.team ? ', ' + escHtml(p.team) : ''}</h2>
          <p class="persona-bio">${escHtml(p.bio) || '<span class="placeholder">Bio will appear here…</span>'}</p>
        </div>

        <!-- Box-style sections (e.g. Jobs to be Done) -->
        ${leftSections.map((section) => `
          <div class="persona-section-box">
            <div class="persona-section-box-header">${escHtml(section.heading)}</div>
            <ul class="persona-bullet-list">
              ${renderBulletItems(section.items)}
            </ul>
          </div>
        `).join('')}

        <!-- Tools & systems -->
        <div class="persona-tools-section">
          <div class="persona-tools-header">Tools &amp; systems</div>
          <div class="persona-tools-grid">
            ${renderToolsGrid(p.tools)}
          </div>
        </div>

      </div>

      <!-- ── RIGHT COLUMN ────────────────────────────── -->
      <div class="persona-right">

        <!-- Blue-header sections (Motivations, Needs, Key challenges, etc.) -->
        ${rightSections.map((section) => `
          <div class="persona-section-block">
            <div class="persona-section-header">
              <span>${escHtml(section.heading)}</span>
            </div>
            <ul class="persona-bullet-list">
              ${renderBulletItems(section.items)}
            </ul>
          </div>
        `).join('')}

        <!-- Attributes -->
        <div class="persona-attributes">
          <div class="persona-attributes-header">Attributes</div>
          <div class="persona-attributes-grid">
            ${renderAttributeSliders(p.attributes)}
          </div>
        </div>

      </div>

    </div>
  `;
}

// ── HELPERS ──────────────────────────────────────────────────

function renderBulletItems(items) {
  if (!items || items.length === 0) {
    return '<li class="placeholder-item">Add items in the editor…</li>';
  }
  const filtered = items.filter((item) => item && item.trim());
  if (filtered.length === 0) {
    return '<li class="placeholder-item">Add items in the editor…</li>';
  }
  return filtered.map((item) => `<li>${escHtml(item)}</li>`).join('');
}

function renderToolsGrid(tools) {
  if (!tools || tools.length === 0) {
    return '<div class="placeholder">Add tools in the editor…</div>';
  }
  const filtered = tools.filter((t) => t.name || t.iconKey);
  if (filtered.length === 0) {
    return '<div class="placeholder">Add tools in the editor…</div>';
  }
  return filtered.map((tool) => `
    <div class="tool-item">
      <div class="tool-icon">${getToolIconSvg(tool)}</div>
      <span class="tool-label">${escHtml(tool.name || '')}</span>
    </div>
  `).join('');
}

function renderAttributeSliders(attributes) {
  if (!attributes || attributes.length === 0) return '';

  return attributes.map((attr) => {
    const pct = Math.max(0, Math.min(100, attr.value || 50));
    return `
      <div class="attr-block">
        <div class="attr-block-label">${escHtml(attr.label)}</div>
        <div class="attr-track-wrap">
          <span class="attr-track-end">${escHtml(attr.leftLabel)}</span>
          <div class="attr-track">
            <div class="attr-fill" style="width:${pct}%"></div>
            <div class="attr-thumb" style="left:${pct}%"></div>
          </div>
          <span class="attr-track-end">${escHtml(attr.rightLabel)}</span>
        </div>
      </div>
    `;
  }).join('');
}
