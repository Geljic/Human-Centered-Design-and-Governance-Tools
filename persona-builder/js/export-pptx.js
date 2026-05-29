// ============================================================
// PPTX EXPORT — PptxGenJS, Portrait A4 (7.5" × 10.63")
// ============================================================

// ── SVG → PNG DATA URL (canvas rasterisation) ────────────────
// PptxGenJS cannot render data:image/svg+xml — must convert to PNG first.
function svgToPngDataUrl(svgString, sizePx) {
  return new Promise((resolve) => {
    const canvas  = document.createElement('canvas');
    canvas.width  = sizePx;
    canvas.height = sizePx;
    const ctx     = canvas.getContext('2d');
    const img     = new Image();
    const blob    = new Blob([svgString], { type: 'image/svg+xml' });
    const url     = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, sizePx, sizePx);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// ── ESTIMATE TEXT HEIGHT ──────────────────────────────────────
// Rough heuristic: chars per line based on width + font size, then line height.
function estimateTextHeight(text, widthInches, fontSizePt, lineHeightFactor) {
  if (!text) return 0;
  const charsPerLine = Math.max(1, Math.floor(widthInches * 10.5 * (10 / fontSizePt)));
  const lines        = Math.ceil(text.length / charsPerLine);
  const lineHeightIn = (fontSizePt / 72) * (lineHeightFactor || 1.4);
  return lines * lineHeightIn;
}

// ── ESTIMATE BULLET BLOCK HEIGHT ──────────────────────────────
// Sum wrapped-line counts per item; account for bullet indent eating ~0.18" of width.
// Matches addBulletText's lineSpacingMultiple (1.05) and paraSpaceAfter (0).
function estimateBulletBlockHeight(items, widthInches, fontSizePt, lineHeightFactor) {
  const filtered = (items || []).filter((i) => i && i.trim());
  if (filtered.length === 0) return 0;
  const usableW = Math.max(0.5, widthInches - 0.18);
  let totalH = 0;
  filtered.forEach((item) => {
    totalH += estimateTextHeight(item, usableW, fontSizePt, lineHeightFactor);
  });
  return totalH;
}

// ── BULLET TEXT HELPER ────────────────────────────────────────
// PptxGenJS: array of text runs renders as ONE paragraph unless each run has
// breakLine:true. Without breakLine, bullet:true at container level produces
// only one bullet for the whole block — which looks like no bullets at all.
function addBulletText(slide, items, opts) {
  const filtered = (items || []).filter((i) => i && i.trim());
  if (filtered.length === 0) return;
  slide.addText(
    filtered.map((item, idx) => ({
      text: item,
      options: { bullet: { type: 'bullet', indent: 12 }, breakLine: idx < filtered.length - 1 }
    })),
    Object.assign({ paraSpaceAfter: 0, lineSpacingMultiple: 1.05 }, opts)
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────
async function exportPPTX() {
  if (typeof PptxGenJS === 'undefined') {
    showToast('PptxGenJS library not loaded. Check your internet connection.', 'error');
    return;
  }
  showToast('Generating PPTX…', 'info');

  const p    = formData;
  const pptx = new PptxGenJS();

  // A4 portrait: 7.5" × 10.63"
  pptx.defineLayout({ name: 'A4_PORTRAIT', width: 7.5, height: 10.63 });
  pptx.layout = 'A4_PORTRAIT';

  // ── BRAND COLOURS ────────────────────────────────────────
  const NAVY      = '1A3A5C';
  const BLUE      = '4A90D9';
  const BLUE_LITE = 'EBF4FF';
  const RED       = 'D7153A';
  const WHITE     = 'FFFFFF';
  const DARK      = '22272B';
  const LGREY     = 'F3F4F6';
  const FONT      = 'Public Sans';

  // ── SLIDE DIMENSIONS ─────────────────────────────────────
  const W   = 7.5;
  const H   = 10.63;
  const PAD = 0.15;

  // Column split: left ~40%, right ~60%
  const LEFT_W  = 3.0;
  const GAP     = 0.12;
  const RIGHT_X = LEFT_W + GAP;
  const RIGHT_W = W - RIGHT_X - PAD;

  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  // ── PRE-RASTERISE TOOL ICONS ─────────────────────────────
  // Must be done before addSlide operations (async canvas work).
  const tools       = (p.tools || []).filter((t) => t.name || t.iconKey);
  const toolPngUrls = await Promise.all(
    tools.slice(0, 10).map(async (tool) => {
      if (tool.iconType === 'upload' && tool.iconDataUrl) {
        return tool.iconDataUrl; // already a raster data URL
      }
      const lib = (typeof TOOLS_LIBRARY !== 'undefined')
        ? (TOOLS_LIBRARY[tool.iconKey] || TOOLS_LIBRARY['custom'])
        : null;
      if (!lib) return null;
      return svgToPngDataUrl(lib.svg, 96);
    })
  );

  // ── AVATAR ───────────────────────────────────────────────
  const avatarSrc = getCurrentAvatarSrc();
  const AVATAR_H  = 2.6;
  const AVATAR_W  = LEFT_W;

  slide.addShape(pptx.ShapeType.rect, {
    x: PAD, y: PAD, w: AVATAR_W - PAD, h: AVATAR_H,
    fill: { color: 'F5C842' }
  });

  try {
    slide.addImage({
      data: avatarSrc,
      x: PAD, y: PAD, w: AVATAR_W - PAD, h: AVATAR_H,
      sizing: { type: 'contain', w: AVATAR_W - PAD, h: AVATAR_H }
    });
  } catch (e) {
    // Leave yellow background if image fails
  }

  // ── NAME / ROLE / BIO ────────────────────────────────────
  // Use dynamic heights so content below doesn't overlap.
  const TEXT_W   = LEFT_W - PAD - 0.05;
  const NAME_Y   = PAD + AVATAR_H + 0.1;
  const NAME_FS  = 16;
  const ROLE_FS  = 9;
  const BIO_FS   = 7.5;

  const nameText = p.name || 'Name';
  const roleText = [p.role, p.team].filter(Boolean).join(', ') || 'Role, Team';
  const bioText  = p.bio || '';

  // Estimate heights with generous line-height factors
  const nameH = Math.max(0.3, estimateTextHeight(nameText, TEXT_W, NAME_FS, 1.5));
  const roleH = Math.max(0.2, estimateTextHeight(roleText, TEXT_W, ROLE_FS, 1.4));
  const bioH  = Math.max(0.2, estimateTextHeight(bioText,  TEXT_W, BIO_FS,  1.45));

  const VGAP = 0.06;

  slide.addText(nameText, {
    x: PAD, y: NAME_Y, w: TEXT_W, h: nameH,
    fontSize: NAME_FS, bold: true, color: DARK, fontFace: FONT, wrap: true
  });

  slide.addText(roleText, {
    x: PAD, y: NAME_Y + nameH + VGAP, w: TEXT_W, h: roleH,
    fontSize: ROLE_FS, color: DARK, fontFace: FONT, wrap: true
  });

  const bioY = NAME_Y + nameH + VGAP + roleH + VGAP;
  if (bioText) {
    slide.addText(bioText, {
      x: PAD, y: bioY, w: TEXT_W, h: bioH,
      fontSize: BIO_FS, color: DARK, fontFace: FONT, wrap: true
    });
  }

  // ── LEFT COLUMN — BOX SECTIONS ───────────────────────────
  const sections    = p.contentSections || [];
  const boxSections = sections.filter((s) => s.style === 'box');
  const blueSections = sections.filter((s) => s.style === 'blue');

  // Start below bio with a small gap; ensure minimum clearance from avatar block
  let leftY = Math.max(bioY + bioH + 0.15, NAME_Y + 2.0);

  // Pin Tools at a fixed position from the bottom so it always renders on-page.
  // Reserve enough vertical space for heading + 2 rows of icons + labels.
  const TOOLS_BLOCK_H = 1.35;
  const TOOLS_Y       = H - PAD - TOOLS_BLOCK_H;
  const BOX_MAX_Y     = TOOLS_Y - 0.1; // boxes must fit above tools

  const BOX_HEADER_H = 0.22;
  const BOX_PAD_V    = 0.12;
  const BOX_BODY_W   = LEFT_W - PAD - 0.1;
  const BOX_FS       = 7;

  boxSections.forEach((section) => {
    const items    = (section.items || []).filter((j) => j && j.trim());
    const bodyH    = items.length > 0
      ? estimateBulletBlockHeight(items, BOX_BODY_W, BOX_FS, 1.45) + BOX_PAD_V
      : 0.3;
    let totalH     = BOX_HEADER_H + bodyH + 0.08;
    // Clip if it would overlap the pinned Tools block
    const remaining = BOX_MAX_Y - leftY;
    if (remaining <= BOX_HEADER_H + 0.1) return; // no room left
    if (totalH > remaining) totalH = remaining;

    slide.addShape(pptx.ShapeType.rect, {
      x: PAD, y: leftY, w: LEFT_W - PAD, h: totalH,
      fill: { color: BLUE_LITE }, line: { color: BLUE, width: 0.5 }
    });
    slide.addText(section.heading, {
      x: PAD + 0.08, y: leftY + 0.04, w: LEFT_W - PAD - 0.1, h: BOX_HEADER_H,
      fontSize: 8, bold: true, color: NAVY, fontFace: FONT
    });

    if (items.length > 0) {
      addBulletText(slide, items, {
        x: PAD + 0.06, y: leftY + BOX_HEADER_H + 0.04,
        w: BOX_BODY_W, h: totalH - BOX_HEADER_H - 0.08,
        fontSize: BOX_FS, color: DARK, fontFace: FONT, wrap: true,
        valign: 'top'
      });
    }

    leftY += totalH + 0.1;
  });

  // ── TOOLS & SYSTEMS ──────────────────────────────────────
  slide.addText('Tools & systems', {
    x: PAD, y: TOOLS_Y, w: LEFT_W - PAD, h: 0.2,
    fontSize: 8.5, bold: true, color: DARK, fontFace: FONT
  });

  if (tools.length > 0) {
    const ICON_SIZE = 0.38;
    const ICON_GAP  = 0.08;
    const COLS      = 5;
    const ICON_Y    = TOOLS_Y + 0.25;

    tools.slice(0, 10).forEach((tool, i) => {
      const col    = i % COLS;
      const row    = Math.floor(i / COLS);
      const ix     = PAD + col * (ICON_SIZE + ICON_GAP);
      const iy     = ICON_Y + row * (ICON_SIZE + 0.22);
      const pngUrl = toolPngUrls[i];

      slide.addShape(pptx.ShapeType.rect, {
        x: ix, y: iy, w: ICON_SIZE, h: ICON_SIZE,
        fill: { color: LGREY }, line: { color: 'DDDDDD', width: 0.5 }
      });

      if (pngUrl) {
        try {
          slide.addImage({
            data: pngUrl,
            x: ix + 0.04, y: iy + 0.04,
            w: ICON_SIZE - 0.08, h: ICON_SIZE - 0.08,
            sizing: { type: 'contain', w: ICON_SIZE - 0.08, h: ICON_SIZE - 0.08 }
          });
        } catch (e) {
          // Fallback: first letter of tool name
          slide.addText((tool.name || '?').charAt(0).toUpperCase(), {
            x: ix, y: iy + 0.08, w: ICON_SIZE, h: ICON_SIZE - 0.08,
            fontSize: 12, bold: true, color: NAVY, fontFace: FONT, align: 'center'
          });
        }
      } else {
        slide.addText((tool.name || '?').charAt(0).toUpperCase(), {
          x: ix, y: iy + 0.08, w: ICON_SIZE, h: ICON_SIZE - 0.08,
          fontSize: 12, bold: true, color: NAVY, fontFace: FONT, align: 'center'
        });
      }

      slide.addText(tool.name || '', {
        x: ix - 0.02, y: iy + ICON_SIZE + 0.02, w: ICON_SIZE + 0.04, h: 0.18,
        fontSize: 5.5, color: DARK, fontFace: FONT, align: 'center', wrap: false
      });
    });
  }

  // ── RIGHT COLUMN — BLUE SECTIONS ─────────────────────────
  let rightY = PAD;

  blueSections.forEach((section) => {
    rightY = addRightSection(
      slide, section.heading, section.items,
      RIGHT_X, rightY, RIGHT_W, BLUE, WHITE, DARK, FONT, pptx
    );
  });

  // ── ATTRIBUTES ───────────────────────────────────────────
  const ATTR_Y = rightY + 0.08;

  slide.addText('Attributes', {
    x: RIGHT_X, y: ATTR_Y, w: RIGHT_W, h: 0.22,
    fontSize: 9, bold: true, color: DARK, fontFace: FONT
  });

  const ATTR_COL_W = RIGHT_W / 2 - 0.06;
  (p.attributes || []).forEach((attr, i) => {
    const col    = i % 2;
    const row    = Math.floor(i / 2);
    const ax     = RIGHT_X + col * (ATTR_COL_W + 0.12);
    const ay     = ATTR_Y + 0.28 + row * 0.72;
    const pct    = Math.max(0, Math.min(100, attr.value || 50)) / 100;
    const TRACK_W = ATTR_COL_W;
    const TRACK_H = 0.08;
    const TRACK_Y = ay + 0.32;

    slide.addText(attr.label, {
      x: ax, y: ay, w: ATTR_COL_W, h: 0.18,
      fontSize: 6, bold: true, color: RED, fontFace: FONT
    });
    slide.addText(attr.leftLabel, {
      x: ax, y: TRACK_Y + TRACK_H + 0.02, w: ATTR_COL_W / 2, h: 0.14,
      fontSize: 5.5, color: DARK, fontFace: FONT
    });
    slide.addText(attr.rightLabel, {
      x: ax + ATTR_COL_W / 2, y: TRACK_Y + TRACK_H + 0.02, w: ATTR_COL_W / 2, h: 0.14,
      fontSize: 5.5, color: DARK, fontFace: FONT, align: 'right'
    });
    // Track background
    slide.addShape(pptx.ShapeType.rect, {
      x: ax, y: TRACK_Y, w: TRACK_W, h: TRACK_H,
      fill: { color: 'CCCCCC' }, line: { color: 'CCCCCC', width: 0 }
    });
    // Track fill
    if (pct > 0) {
      slide.addShape(pptx.ShapeType.rect, {
        x: ax, y: TRACK_Y, w: TRACK_W * pct, h: TRACK_H,
        fill: { color: BLUE }, line: { color: BLUE, width: 0 }
      });
    }
    // Thumb dot
    slide.addShape(pptx.ShapeType.ellipse, {
      x: ax + TRACK_W * pct - 0.07, y: TRACK_Y - 0.04,
      w: 0.14, h: 0.14,
      fill: { color: BLUE }, line: { color: WHITE, width: 1 }
    });
  });

  // ── SAVE ─────────────────────────────────────────────────
  const filename = (p.name || 'persona').replace(/\s+/g, '-').toLowerCase() + '-persona.pptx';
  pptx.writeFile({ fileName: filename })
    .then(() => showToast('PPTX exported: ' + filename, 'success'))
    .catch((err) => showToast('PPTX export failed: ' + err.message, 'error'));
}

// ── RIGHT SECTION HELPER ─────────────────────────────────────
function addRightSection(slide, title, items, x, y, w, headerColor, headerText, bodyText, font, pptx) {
  const HEADER_H  = 0.22;
  const PAD_V     = 0.12;
  const FS        = 7;
  const BODY_W    = w - 0.1;
  const filtered  = (items || []).filter((i) => i && i.trim());
  const BODY_H    = filtered.length > 0
    ? estimateBulletBlockHeight(filtered, BODY_W, FS, 1.45) + PAD_V
    : 0.3;

  // Header bar
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h: HEADER_H,
    fill: { color: headerColor }
  });
  slide.addText(title, {
    x: x + 0.08, y: y + 0.03, w: w - 0.16, h: HEADER_H - 0.04,
    fontSize: 8, bold: true, color: headerText, fontFace: font
  });

  if (filtered.length > 0) {
    slide.addText(
      filtered.map((item, idx) => ({
        text: item,
        options: { bullet: { type: 'bullet', indent: 12 }, breakLine: idx < filtered.length - 1 }
      })),
      {
        x: x + 0.08, y: y + HEADER_H + 0.04,
        w: BODY_W, h: BODY_H,
        fontSize: FS, color: bodyText, fontFace: font, wrap: true,
        paraSpaceAfter: 2, valign: 'top'
      }
    );
  }

  return y + HEADER_H + BODY_H + 0.1;
}
