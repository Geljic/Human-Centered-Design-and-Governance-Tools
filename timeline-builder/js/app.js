// ── Layout constants ───────────────────────────────────────────────────────────
const SW = 13.33, SH = 7.5;
const LABEL_W = 1.8, TL = 1.8, TR = 12.95, TW = TR - TL;
const TITLE_H = 0.55, SUB_H = 0.22;
const YEAR_BAND_H = 0.22;  // height of the year band row (when showYearBands is on)
const HDR_Y = TITLE_H + SUB_H;
const HDR_H_BASE = 0.26;  // doubles when showWeeks is on
const SEC_H = 0.32, ROW_GAP = 0.10;
const BAR_H = 0.38;
const TRACK_H   = 0.48;
const ROW_V_PAD = 0.16;
const LEGEND_Y = SH - 0.52;

function calcRowH(nTracks) { return ROW_V_PAD + nTracks * TRACK_H + ROW_V_PAD; }
function barYForTrack(rowY, t) { return rowY + ROW_V_PAD + t * TRACK_H + (TRACK_H - BAR_H) / 2; }

function assignTracks(bars) {
  const valid = bars.map((b, i) => ({...b, _i: i})).filter(b => b.start && b.end);
  valid.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const trackEnd = [];
  const result   = new Array(bars.length).fill(0);
  valid.forEach(bar => {
    let t = trackEnd.findIndex(e => e <= bar.start);
    if (t === -1) t = trackEnd.length;
    trackEnd[t] = bar.end;
    result[bar._i] = t;
  });
  return { assignments: result, numTracks: Math.max(1, trackEnd.length) };
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CLR = {
  NAVY:'1F2D5A', NAVY_MID:'2E4070', WHITE:'FFFFFF', GRAY:'CCCCCC',
  ROW_BG:'EEF2F8', RED_MS:'CC2222', GREEN_LIVE:'00A651', ENDORSED:'008A4B',
};

// ── Bar type defaults & customisation ─────────────────────────────────────────
const BAR_TYPE_DEFAULTS = {
  servicedesign: { color:'7B5EA7', textColor:'FFFFFF', label:'Service Design'        },
  prototype:     { color:'F5C318', textColor:'1F2D5A', label:'Prototype / Content'   },
  development:   { color:'2E5EAA', textColor:'FFFFFF', label:'Development / SD'      },
  userresearch:  { color:'E87722', textColor:'FFFFFF', label:'User Research'         },
  change:        { color:'E87722', textColor:'FFFFFF', label:'Change / Comms'        },
  pas:           { color:'4AAF78', textColor:'FFFFFF', label:'Actions'               },
  golive:        { color:'00A651', textColor:'FFFFFF', label:'Go Live'               },
  hypercare:     { color:'00A693', textColor:'FFFFFF', label:'Hyper Care'            },
};

let customTypes = {};

function initCustomTypes(overrides) {
  customTypes = {};
  Object.entries(BAR_TYPE_DEFAULTS).forEach(([k, v]) => {
    customTypes[k] = { ...v, ...(overrides?.[k] || {}) };
  });
}

function typeColorCSS(type) {
  return '#' + (customTypes[type]?.color || BAR_TYPE_DEFAULTS[type]?.color || 'CCCCCC');
}

// Auto-pick white or navy text based on background luminance
function autoTextColor(hex6) {
  const r = parseInt(hex6.substr(0,2),16);
  const g = parseInt(hex6.substr(2,2),16);
  const b = parseInt(hex6.substr(4,2),16);
  return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.55 ? '1F2D5A' : 'FFFFFF';
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function genMonths(sy, sm, ey, em) {
  const out = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push({ year:y, month:m, name:MONTH_NAMES[m-1] });
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

// Returns all Mondays within the timeline date range
function genWeeks(sy, sm, ey, em) {
  const end = new Date(ey, em, 0); // last day of end month
  const d   = new Date(sy, sm - 1, 1);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 1 ? 0 : (8 - dow) % 7)); // first Monday
  const out = [];
  while (d <= end) {
    const dd  = String(d.getDate()).padStart(2,'0');
    const mmm = MONTH_NAMES[d.getMonth()];
    out.push({
      label:   `w/c ${dd} ${mmm}`,
      isoDate: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    });
    d.setDate(d.getDate() + 7);
  }
  return out;
}

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

function dateX(ds, months, MW) {
  if (!ds) return null;
  const [y, m, d] = ds.split('-').map(Number);
  const idx = months.findIndex(mo => mo.year===y && mo.month===m);
  if (idx < 0) return null;
  return TL + idx*MW + (d-1)/daysInMonth(y,m)*MW;
}

function spanDates(s, e, months, MW) {
  const x1 = dateX(s, months, MW), x2 = dateX(e, months, MW);
  if (x1===null || x2===null) return null;
  return { x:x1, w:Math.max(0, x2-x1) };
}

// ── Year band helpers ─────────────────────────────────────────────────────────
// Returns an array of { year, startIdx, endIdx } groupings over the months array
function genYearBands(months) {
  const bands = [];
  months.forEach((mo, i) => {
    if (!bands.length || bands[bands.length - 1].year !== mo.year) {
      bands.push({ year: mo.year, startIdx: i, endIdx: i });
    } else {
      bands[bands.length - 1].endIdx = i;
    }
  });
  return bands;
}

// ── Overflow detection & auto-scale ──────────────────────────────────────────
function checkOverflow(data) {
  const yearBandH = data.showYearBands ? YEAR_BAND_H : 0;
  const hdrH  = data.showWeeks ? HDR_H_BASE * 2 : HDR_H_BASE;
  const dataY = HDR_Y + yearBandH + hdrH;
  const avail = LEGEND_Y - dataY - SEC_H - 0.05;
  let   used  = 0;
  (data.rows || []).forEach((row, i) => {
    const { numTracks } = assignTracks(row.bars || []);
    used += calcRowH(numTracks);
    if (i < data.rows.length - 1) used += ROW_GAP;
  });
  const overflow  = used > avail;
  const autoScale = document.getElementById('auto-scale')?.checked ?? true;
  const scale     = (overflow && autoScale) ? avail / used : 1.0;
  return { used: +used.toFixed(2), avail: +avail.toFixed(2), overflow, autoScale, scale, yearBandH };
}

function updateOverflowWarning(data) {
  const { used, avail, overflow, autoScale, scale } = checkOverflow(data);
  const hint    = document.getElementById('overflow-hint');
  const warnBox = document.getElementById('overflow-warn');
  if (overflow && autoScale) {
    const pct = Math.round(scale * 100);
    const msg = `ℹ ${used}" auto-scaled to ${pct}% to fit ${avail}" — bars will be slightly smaller in the PPTX`;
    if (hint) { hint.textContent = msg; hint.style.color = '#b45309'; }
    if (warnBox) { warnBox.textContent = msg; warnBox.style.display = 'block'; warnBox.style.background = '#fffbeb'; warnBox.style.borderColor = '#fcd34d'; warnBox.style.color = '#92400e'; }
  } else if (overflow && !autoScale) {
    const msg = `⚠ Content ${used}" exceeds available ${avail}" — bottom rows may be cut off in the PPTX`;
    if (hint) { hint.textContent = msg; hint.style.color = '#CC2222'; }
    if (warnBox) { warnBox.textContent = msg; warnBox.style.display = 'block'; warnBox.style.background = '#fee2e2'; warnBox.style.borderColor = '#fca5a5'; warnBox.style.color = '#991b1b'; }
  } else {
    if (hint) { hint.textContent = `✓ ${used}" of ${avail}" used`; hint.style.color = '#00A651'; }
    if (warnBox) { warnBox.style.display = 'none'; }
  }
}

// ── SVG Preview ───────────────────────────────────────────────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgCreate(tag, attrs, textContent) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

function svgRect(x, y, w, h, fill, extra) {
  if (w <= 0) return null;
  return svgCreate('rect', { x, y, width:w, height:h, fill, ...(extra||{}) });
}

// Safe appendChild — silently skips null/undefined (returned by svgRect/svgText guards)
function svgAppend(parent, child) {
  if (child != null) parent.appendChild(child);
}

function svgText(str, x, y, opts) {
  if (!str) return null;
  const o = opts || {};
  const fontSize = (o.sz || 9) / 72;
  // Position the text element's baseline manually so rendering is identical across
  // browsers — `dominant-baseline: middle` is honoured by Chromium/WebKit but some
  // Firefox/Brave Linux builds fall back to alphabetic, which throws every label off.
  // Standard font metric: baseline sits ~0.32em below the visual middle of the em box,
  // and ~0.80em below the top.
  const base = o.base || 'middle';
  let textY = y;
  if (base === 'middle' || base === 'central') textY = y + fontSize * 0.32;
  else if (base === 'hanging')                 textY = y + fontSize * 0.80;
  // 'alphabetic' (or anything else) — leave y as the baseline.
  return svgCreate('text', {
    x, y: textY,
    fill:                 o.fill || '#1F2D5A',
    'font-family':        'Public Sans, -apple-system, sans-serif',
    'font-size':          fontSize,
    'font-weight':        o.bold   ? '700' : '400',
    'font-style':         o.italic ? 'italic' : 'normal',
    'text-anchor':        o.anchor || 'start',
  }, str);
}

function svgRoundedBar(x, y, w, h, fillHex, label, textHex, sz) {
  if (w <= 0.01) return null;
  const g = svgCreate('g', {});
  svgAppend(g, svgRect(x, y, w, h, '#'+fillHex, { rx:0.06, ry:0.06 }));
  if (label && w > 0.18) {
    const clipId = 'bc' + (Math.random()*1e9|0);
    const cp = svgCreate('clipPath', { id: clipId });
    svgAppend(cp, svgRect(x, y, w, h, 'black'));
    g.appendChild(cp);
    const t = svgText(label, x + w/2, y + h/2, {
      sz: sz||7.5, bold:true, fill:'#'+(textHex||'FFFFFF'),
      anchor:'middle', base:'middle',
    });
    t.setAttribute('clip-path', `url(#${clipId})`);
    g.appendChild(t);
  }
  return g;
}

function svgDiamond(cx, cy, sz, fillHex) {
  const s = sz || 0.17;
  return svgCreate('polygon', {
    points: `${cx},${cy-s/2} ${cx+s/2},${cy} ${cx},${cy+s/2} ${cx-s/2},${cy}`,
    fill: fillHex,
  });
}

function renderPreview() {
  const data = getFormData();
  updateOverflowWarning(data);

  const svg = document.getElementById('preview-svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const months = genMonths(data.startYear, data.startMonth, data.endYear, data.endMonth);
  if (!months.length) {
    svgAppend(svg, svgText('Invalid date range', SW/2, SH/2, { sz:14, anchor:'middle', fill:'#999' }));
    return;
  }

  const MW         = TW / months.length;
  const yearBandH  = data.showYearBands ? YEAR_BAND_H : 0;
  const hdrH       = data.showWeeks ? HDR_H_BASE * 2 : HDR_H_BASE;
  const monthRowY  = HDR_Y + yearBandH;          // month header starts after year band
  const dataY      = monthRowY + hdrH;
  const gridH      = LEGEND_Y - dataY + 0.05;
  const g          = svgCreate('g', {});

  // Slide background
  svgAppend(g, svgRect(0, 0, SW, SH, '#f5f6fa'));

  // Title bar
  svgAppend(g, svgRect(0, 0, SW, TITLE_H, '#1F2D5A'));
  svgAppend(g, svgText(data.title || 'Timeline', 0.2, TITLE_H/2, { sz:16, bold:true, fill:'#FFFFFF' }));

  // Badge
  if (data.showBadge && data.badgeText?.trim()) {
    const bx = SW-1.55, by = 0.08, bw = 1.35, bh = TITLE_H-0.16;
    svgAppend(g, svgRect(bx, by, bw, bh, '#008A4B', { rx:0.06, ry:0.06 }));
    const lines = data.badgeText.trim().split('\n');
    lines.forEach((ln, i) => {
      const ly = by + bh/2 + (i - (lines.length-1)/2) * (6/72);
      svgAppend(g, svgText(ln, bx+bw/2, ly, { sz:7, bold:true, fill:'#FFFFFF', anchor:'middle' }));
    });
  }

  // Subtitle
  if (data.subtitle) {
    svgAppend(g, svgText(data.subtitle, 0.2, TITLE_H + SUB_H/2, { sz:8.5, italic:true, fill:'#1F2D5A' }));
  }

  // ── Year band row (optional) ──────────────────────────────────────────────
  if (data.showYearBands) {
    svgAppend(g, svgRect(0,  HDR_Y, LABEL_W, yearBandH, '#141E3C'));
    svgAppend(g, svgRect(TL, HDR_Y, TW,      yearBandH, '#141E3C'));
    const bands = genYearBands(months);
    bands.forEach((band, bi) => {
      const bx = TL + band.startIdx * MW;
      const bw = (band.endIdx - band.startIdx + 1) * MW;
      // Divider before each band (except first)
      if (bi > 0) svgAppend(g, svgRect(bx - 0.004, HDR_Y, 0.008, yearBandH, '#FFFFFF'));
      svgAppend(g, svgText(String(band.year), bx + bw/2, HDR_Y + yearBandH/2, {
        sz:8, bold:true, fill:'#FFFFFF', anchor:'middle',
      }));
    });
  }

  // Month header area
  const monthH = data.showWeeks ? HDR_H_BASE : hdrH;
  svgAppend(g, svgRect(0,  monthRowY, LABEL_W, hdrH, '#1F2D5A'));
  svgAppend(g, svgRect(TL, monthRowY, TW,      hdrH, '#2E4070'));

  months.forEach((mo, i) => {
    const mx = TL + i * MW;
    if (i > 0) svgAppend(g, svgRect(mx-0.004, monthRowY, 0.008, hdrH+gridH, '#CCCCCC'));
    svgAppend(g, svgText(mo.name, mx+MW/2, monthRowY+monthH/2, { sz:9, bold:true, fill:'#FFFFFF', anchor:'middle' }));
  });

  // Week sub-header
  if (data.showWeeks) {
    const wkY = monthRowY + monthH;
    svgAppend(g, svgRect(TL, wkY, TW, monthH, '#334070'));
    const weeks = genWeeks(data.startYear, data.startMonth, data.endYear, data.endMonth);

    // Clip week labels to timeline area
    const wkClipId = 'wkclip';
    const wkClip = svgCreate('clipPath', { id: wkClipId });
    svgAppend(wkClip, svgRect(TL, wkY, TW, monthH, 'black'));
    g.appendChild(wkClip);

    weeks.forEach((wk, i) => {
      const wx = dateX(wk.isoDate, months, MW);
      if (wx === null || wx >= TR) return;
      svgAppend(g, svgRect(wx-0.003, wkY, 0.006, monthH*0.55, '#5A72A0'));
      const t = svgText(wk.label, wx+0.05, wkY+monthH/2, { sz:5.5, fill:'#FFFFFF' });
      if (t) { t.setAttribute('clip-path', `url(#${wkClipId})`); g.appendChild(t); }
    });
  }

  // "We are here" line
  if (data.showToday && data.todayDate) {
    const wx = dateX(data.todayDate, months, MW);
    if (wx !== null) {
      svgAppend(g, svgRect(wx-0.006, monthRowY, 0.012, LEGEND_Y-monthRowY-0.05, '#CC2222'));
      svgAppend(g, svgText('We are here', wx, monthRowY-0.14, { sz:7, bold:true, fill:'#CC2222', anchor:'middle' }));
    }
  }

  // Section bar
  svgAppend(g, svgRect(0, dataY, SW, SEC_H, '#1F2D5A'));
  svgAppend(g, svgText(data.sectionLabel, 0.15, dataY+SEC_H/2, { sz:10, bold:true, fill:'#FFFFFF' }));
  if (data.goLiveText) {
    svgAppend(g, svgText(data.goLiveText, TR-0.1, dataY+SEC_H/2, { sz:8.5, bold:true, fill:'#FFFFFF', anchor:'end' }));
  }

  // Rows — auto-scale bar heights to fit if needed
  const { scale: rowScale, overflow: isOverflow } = checkOverflow(data);
  const sBarH    = BAR_H    * rowScale;
  const sTrackH  = TRACK_H  * rowScale;
  const sRowVPad = ROW_V_PAD * rowScale;
  const sRowGap  = ROW_GAP  * rowScale;
  const calcRowHs     = n  => sRowVPad + n * sTrackH + sRowVPad;
  const barYForTracks = (ry, t) => ry + sRowVPad + t * sTrackH + (sTrackH - sBarH) / 2;

  let rowY = dataY + SEC_H;
  const usedTypes = new Set();
  let hasMilestones = false;

  (data.rows || []).forEach(row => {
    const { assignments, numTracks } = assignTracks(row.bars || []);
    const rowH    = calcRowHs(numTracks);
    const rowMidY = rowY + rowH / 2;

    svgAppend(g, svgRect(0, rowY, LABEL_W-0.06, rowH, '#EEF2F8'));

    const labelLines = (row.label || '').split('\n');
    const lineStep = 8/72;
    labelLines.forEach((ln, li) => {
      const ly = rowY + rowH/2 + (li - (labelLines.length-1)/2) * lineStep;
      svgAppend(g, svgText(ln, 0.1, ly, { sz:7.5, bold:true }));
    });

    (row.bars || []).forEach((bar, bi) => {
      const sp = spanDates(bar.start, bar.end, months, MW);
      if (!sp) return;
      const t = customTypes[bar.type] || customTypes.development || { color:'2E5EAA', textColor:'FFFFFF' };
      usedTypes.add(bar.type);
      const by = barYForTracks(rowY, assignments[bi]);
      const scaledSz    = 7.5 * rowScale;
      const approxCharW = (scaledSz / 72) * 0.58;
      const labelFits   = !bar.label || sp.w > bar.label.length * approxCharW + 0.06;
      // Suppress in-bar label only when the below-bar copy is taking over — otherwise
      // fall back to clipped in-bar so you still see what you can.
      const inBarLabel  = (labelFits || !data.labelBelow) ? bar.label : '';
      svgAppend(g, svgRoundedBar(sp.x, by, sp.w, sBarH, t.color, inBarLabel, t.textColor, scaledSz));
      if (!labelFits && bar.label && data.labelBelow) {
        svgAppend(g, svgText(bar.label, sp.x + sp.w/2, by + sBarH + 0.035, {
          sz: Math.max(5.5, scaledSz * 0.85), anchor:'middle', base:'hanging', fill:'#1F2D5A',
        }));
      }
    });

    (row.milestones || []).forEach(ms => {
      const mx = dateX(ms.date, months, MW);
      if (mx === null) return;
      hasMilestones = true;
      const msFill = ms.color === 'green' ? '#00A651' : '#CC2222';
      const msSize = ms.color === 'green' ? 0.18 : 0.17;
      svgAppend(g, svgDiamond(mx, rowMidY, msSize, msFill));
      const lbl = (ms.label || '').replace(/\\n/g, '\n').split('\n');
      if (ms.pos === 'right') {
        lbl.forEach((ln, li) => {
          const ly = rowMidY + (li - (lbl.length-1)/2) * (7/72);
          svgAppend(g, svgText(ln, mx + msSize/2 + 0.06, ly, { sz:6.5, base:'middle' }));
        });
      } else {
        const baseY = ms.pos === 'above'
          ? rowMidY - msSize/2 - 0.06 - lbl.length*(6.5/72)
          : rowMidY + msSize/2 + 0.06;
        lbl.forEach((ln, li) => {
          svgAppend(g, svgText(ln, mx, baseY+li*(7/72), { sz:6.5, anchor:'middle', base:'hanging' }));
        });
      }
    });

    rowY += rowH + sRowGap;
  });

  // If auto-scale is OFF and content overflows, show cut-off indicator
  if (isOverflow && !data.autoScale) {
    const cutY = LEGEND_Y - 0.12;
    for (let dx = TL; dx < TR; dx += 0.18) {
      svgAppend(g, svgRect(dx, cutY-0.005, 0.10, 0.01, '#CC2222'));
    }
    svgAppend(g, svgText('⚠ Content cut off below this line', TL+TW/2, cutY-0.1, {
      sz:7, bold:true, fill:'#CC2222', anchor:'middle',
    }));
  }

  // Legend
  let lx = 0.3;
  Object.entries(customTypes).filter(([k]) => usedTypes.has(k)).forEach(([, v]) => {
    svgAppend(g, svgRect(lx, LEGEND_Y+0.12, 0.22, 0.15, '#'+v.color));
    svgAppend(g, svgText(v.label, lx+0.28, LEGEND_Y+0.195, { sz:7 }));
    lx += 1.8;
  });
  if (hasMilestones) {
    svgAppend(g, svgDiamond(lx+0.11, LEGEND_Y+0.195, 0.14, '#CC2222'));
    svgAppend(g, svgText('Milestone', lx+0.26, LEGEND_Y+0.195, { sz:7 }));
  }

  svg.appendChild(g);
}

// ── PPTX shape helpers ────────────────────────────────────────────────────────
const noLine = () => ({ color:'FFFFFF', transparency:100, width:0 });

function filledRect(slide, x, y, w, h, color) {
  if (w <= 0) return;
  slide.addShape('rect', { x, y, w, h, fill:{color}, line:noLine() });
}
function roundedBar(slide, x, y, w, h, color, label, textColor, sz) {
  if (w <= 0.01) return;
  slide.addText(label && w > 0.2 ? label : '', {
    shape:'roundRect', rectRadius:0.08,
    x, y, w, h, fill:{color}, line:noLine(),
    fontSize:sz||7.5, bold:true, color:textColor||'FFFFFF',
    align:'center', valign:'middle', wrap:true, fontFace:'Public Sans',
  });
}
function diamond(slide, cx, cy, sz, color) {
  const s = sz||0.17;
  slide.addShape('diamond', { x:cx-s/2, y:cy-s/2, w:s, h:s, fill:{color}, line:noLine() });
}
function vLine(slide, x, y1, y2, color) {
  filledRect(slide, x-0.006, y1, 0.012, y2-y1, color);
}
function txtBox(slide, text, x, y, w, h, o={}) {
  if (!text) return;
  slide.addText(text, {
    x, y, w, h,
    fontSize:o.sz||9, bold:o.bold||false, italic:o.italic||false,
    color:o.col||'1F2D5A', align:o.align||'left', valign:o.va||'middle',
    wrap:o.wrap!==false, fontFace:'Public Sans',
  });
}

// ── PPTX Build ────────────────────────────────────────────────────────────────
function buildPPTX(data) {
  const months = genMonths(data.startYear, data.startMonth, data.endYear, data.endMonth);
  if (!months.length) { alert('Invalid date range.'); return; }
  const MW         = TW / months.length;
  const yearBandH  = data.showYearBands ? YEAR_BAND_H : 0;
  const hdrH       = data.showWeeks ? HDR_H_BASE * 2 : HDR_H_BASE;
  const monthRowY  = HDR_Y + yearBandH;
  const dataY      = monthRowY + hdrH;
  const gridH      = LEGEND_Y - dataY + 0.05;

  const pres = new PptxGenJS();
  pres.defineLayout({ name:'TIMELINE', width:SW, height:SH });
  pres.layout = 'TIMELINE';
  const slide = pres.addSlide();

  // Header
  filledRect(slide, 0, 0, SW, TITLE_H, CLR.NAVY);
  txtBox(slide, data.title, 0.2, 0.02, 10.8, TITLE_H-0.04, { sz:16, bold:true, col:CLR.WHITE, va:'middle' });
  if (data.showBadge && data.badgeText?.trim()) {
    slide.addText(data.badgeText.trim(), {
      shape:'roundRect', rectRadius:0.1,
      x:SW-1.55, y:0.08, w:1.35, h:TITLE_H-0.16,
      fill:{color:CLR.ENDORSED}, line:noLine(),
      fontSize:7.5, bold:true, color:CLR.WHITE, align:'center', valign:'middle', wrap:true, fontFace:'Public Sans',
    });
  }
  txtBox(slide, data.subtitle, 0.2, TITLE_H+0.02, 12.5, SUB_H-0.04, { sz:8.5, italic:true, col:CLR.NAVY, va:'middle' });

  // ── Year band row (optional) ──────────────────────────────────────────────
  if (data.showYearBands) {
    filledRect(slide, 0,  HDR_Y, LABEL_W, yearBandH, '0D1529');
    filledRect(slide, TL, HDR_Y, TW,      yearBandH, '0D1529');
    const bands = genYearBands(months);
    bands.forEach((band, bi) => {
      const bx = TL + band.startIdx * MW;
      const bw = (band.endIdx - band.startIdx + 1) * MW;
      if (bi > 0) filledRect(slide, bx - 0.004, HDR_Y, 0.008, yearBandH, CLR.WHITE);
      txtBox(slide, String(band.year), bx, HDR_Y, bw, yearBandH, {
        sz:8, bold:true, col:CLR.WHITE, align:'center', va:'middle',
      });
    });
  }

  // Month header row
  const monthH = data.showWeeks ? HDR_H_BASE : hdrH;
  filledRect(slide, 0,  monthRowY, LABEL_W, hdrH,   CLR.NAVY);
  filledRect(slide, TL, monthRowY, TW,      hdrH,   CLR.NAVY_MID);
  months.forEach((mo, i) => {
    const mx = TL + i*MW;
    txtBox(slide, mo.name, mx, monthRowY, MW, monthH, { sz:9, bold:true, col:CLR.WHITE, align:'center' });
    if (i > 0) filledRect(slide, mx-0.004, monthRowY, 0.008, hdrH+gridH, CLR.GRAY);
  });

  // Week sub-header row
  if (data.showWeeks) {
    const wkY = monthRowY + monthH;
    filledRect(slide, 0,  wkY, LABEL_W, monthH, '263660');
    filledRect(slide, TL, wkY, TW,      monthH, '334070');
    const weeks = genWeeks(data.startYear, data.startMonth, data.endYear, data.endMonth);
    weeks.forEach((wk, i) => {
      const wx = dateX(wk.isoDate, months, MW);
      if (wx === null || wx >= TR) return;
      const nextWx = (i < weeks.length-1) ? dateX(weeks[i+1].isoDate, months, MW) : TR;
      const slotW  = Math.min((nextWx||TR) - wx, TR - wx);
      filledRect(slide, wx-0.003, wkY, 0.006, monthH*0.55, '5A72A0');
      if (slotW > 0.28) {
        txtBox(slide, wk.label, wx+0.04, wkY, slotW-0.05, monthH, { sz:5.5, col:CLR.WHITE });
      }
    });
  }

  // "We are here"
  if (data.showToday && data.todayDate) {
    const wx = dateX(data.todayDate, months, MW);
    if (wx !== null) {
      vLine(slide, wx, monthRowY, LEGEND_Y-0.05, CLR.RED_MS);
      txtBox(slide, 'We are here', wx-0.45, monthRowY-0.28, 0.9, 0.26, { sz:7, bold:true, col:CLR.RED_MS, align:'center' });
    }
  }

  // Section bar
  filledRect(slide, 0, dataY, SW, SEC_H, CLR.NAVY);
  txtBox(slide, data.sectionLabel, 0.15, dataY, 8.5, SEC_H, { sz:10, bold:true, col:CLR.WHITE, va:'middle' });
  if (data.goLiveText) {
    txtBox(slide, data.goLiveText, TR-2.5, dataY, 2.5, SEC_H, { sz:8.5, bold:true, col:CLR.WHITE, align:'right', va:'middle' });
  }

  // Rows — apply same auto-scale as preview
  const { scale: rowScale } = checkOverflow(data);
  const sBarH    = BAR_H    * rowScale;
  const sTrackH  = TRACK_H  * rowScale;
  const sRowVPad = ROW_V_PAD * rowScale;
  const sRowGap  = ROW_GAP  * rowScale;
  const calcRowHs     = n      => sRowVPad + n * sTrackH + sRowVPad;
  const barYForTracks = (ry, t) => ry + sRowVPad + t * sTrackH + (sTrackH - sBarH) / 2;

  let rowY = dataY + SEC_H;
  const usedTypes = new Set();
  let hasMilestones = false;

  (data.rows || []).forEach(row => {
    const { assignments, numTracks } = assignTracks(row.bars || []);
    const rowH    = calcRowHs(numTracks);
    const rowMidY = rowY + rowH / 2;

    filledRect(slide, 0, rowY, LABEL_W-0.06, rowH, CLR.ROW_BG);
    txtBox(slide, row.label, 0.1, rowY+0.05, LABEL_W-0.16, rowH-0.1, { sz:8, bold:true, va:'middle', wrap:true });

    (row.bars || []).forEach((bar, bi) => {
      const sp = spanDates(bar.start, bar.end, months, MW);
      if (!sp) return;
      const t = customTypes[bar.type] || customTypes.development;
      usedTypes.add(bar.type);
      const by        = barYForTracks(rowY, assignments[bi]);
      const scaledSz  = 7.5 * rowScale;
      const approxCharW = (scaledSz / 72) * 0.58;
      const labelFits = !bar.label || sp.w > bar.label.length * approxCharW + 0.06;
      const inBarLabel = (labelFits || !data.labelBelow) ? bar.label : '';
      roundedBar(slide, sp.x, by, sp.w, sBarH, t.color, inBarLabel, t.textColor, scaledSz);
      if (!labelFits && bar.label && data.labelBelow) {
        txtBox(slide, bar.label, sp.x - 0.08, by + sBarH + 0.01, sp.w + 0.16, 0.2, {
          sz: Math.max(5.5, scaledSz * 0.85), align:'center', col:'1F2D5A',
        });
      }
    });

    (row.milestones || []).forEach(ms => {
      const mx = dateX(ms.date, months, MW);
      if (mx === null) return;
      hasMilestones = true;
      const msColor = ms.color==='green' ? CLR.GREEN_LIVE : CLR.RED_MS;
      const msSize  = ms.color==='green' ? 0.18 : 0.17;
      diamond(slide, mx, rowMidY, msSize, msColor);
      const lbl = ms.label.replace(/\\n/g,'\n');
      if (ms.pos==='right') {
        txtBox(slide, lbl, mx+msSize/2+0.04, rowMidY-0.18, 1.1, 0.36, { sz:6.5 });
      } else if (ms.pos==='above') {
        txtBox(slide, lbl, mx-0.45, rowMidY-msSize/2-0.38, 0.9, 0.36, { sz:6.5, align:'center' });
      } else {
        txtBox(slide, lbl, mx-0.45, rowMidY+msSize/2+0.04, 0.9, 0.36, { sz:6.5, align:'center' });
      }
    });

    rowY += rowH + sRowGap;
  });

  // Legend
  let lx = 0.3;
  Object.entries(customTypes).filter(([k]) => usedTypes.has(k)).forEach(([, v]) => {
    filledRect(slide, lx, LEGEND_Y+0.12, 0.22, 0.15, v.color);
    txtBox(slide, v.label, lx+0.27, LEGEND_Y+0.06, 1.6, 0.28, { sz:7 });
    lx += 1.8;
  });
  if (hasMilestones) {
    diamond(slide, lx+0.11, LEGEND_Y+0.19, 0.14, CLR.RED_MS);
    txtBox(slide, 'Milestone', lx+0.25, LEGEND_Y+0.06, 0.9, 0.28, { sz:7 });
  }

  const fname = (data.title||'timeline').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').substring(0,60);
  return pres.writeFile({ fileName: fname+'.pptx' });
}

// ── Type editor UI ────────────────────────────────────────────────────────────
function buildTypeEditor() {
  const grid = document.getElementById('type-editor-grid');
  grid.innerHTML = '';

  Object.entries(customTypes).forEach(([key, val]) => {
    const cssColor = '#' + val.color;
    const item = document.createElement('div');
    item.className = 'type-editor-item';
    item.dataset.type = key;
    item.innerHTML = `
      <div class="type-color-group">
        <div class="type-swatch" title="Click to pick colour" style="background:${cssColor}"
             onclick="document.getElementById('cp-${key}').click()"></div>
        <input type="color" id="cp-${key}" value="${cssColor}"
               style="position:absolute;opacity:0;width:0;height:0;pointer-events:none"
               oninput="onTypeColorPicker('${key}', this.value)">
        <input type="text" class="type-hex-input" value="${val.color}" maxlength="7"
               placeholder="HEX" title="6-digit hex colour (with or without #)"
               oninput="onTypeHexInput('${key}', this.value)">
      </div>
      <input type="text" class="type-label-input" value="${val.label}"
             placeholder="Type label" oninput="onTypeLabelInput('${key}', this.value)">
      <span class="type-preview-bar" style="background:${cssColor};color:#${val.textColor}">${val.label}</span>
    `;
    grid.appendChild(item);
  });
}

function onTypeColorPicker(type, cssHex) {
  const hex = cssHex.replace('#','');
  customTypes[type].color     = hex;
  customTypes[type].textColor = autoTextColor(hex);
  syncTypeEditorItem(type);
  schedulePreviewRefresh();
}

function onTypeHexInput(type, raw) {
  let hex = raw.replace('#','').toLowerCase().replace(/[^0-9a-f]/g,'');
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  if (hex.length !== 6) return;
  customTypes[type].color     = hex;
  customTypes[type].textColor = autoTextColor(hex);
  syncTypeEditorItem(type, hex); // sync picker but not hex field
  schedulePreviewRefresh();
}

function onTypeLabelInput(type, label) {
  customTypes[type].label = label;
  const item = document.querySelector(`.type-editor-item[data-type="${type}"]`);
  if (item) {
    const bar = item.querySelector('.type-preview-bar');
    if (bar) bar.textContent = label;
  }
  schedulePreviewRefresh();
}

function syncTypeEditorItem(type, skipHexField) {
  const item = document.querySelector(`.type-editor-item[data-type="${type}"]`);
  if (!item) return;
  const t      = customTypes[type];
  const cssHex = '#' + t.color;
  item.querySelector('.type-swatch').style.background = cssHex;
  item.querySelector(`#cp-${type}`).value = cssHex;
  if (!skipHexField) item.querySelector('.type-hex-input').value = t.color;
  const bar = item.querySelector('.type-preview-bar');
  if (bar) { bar.style.background = cssHex; bar.style.color = '#'+t.textColor; }
}

// ── Form management ───────────────────────────────────────────────────────────
let rowCount=0, barCount=0, msCount=0;

const EPIC_DEFAULTS = {
  servicedesign: 'Service Design\nDefine Phase',
  prototype:     'Prototype &\nContent Design',
  userresearch:  'User Research',
  development:   'Development',
  pas:           'Actions',
  change:        'Change & Comms',
  golive:        'Go Live',
  hypercare:     'Hyper Care',
};

function quickAddRow(epicType) { addRow(epicType, EPIC_DEFAULTS[epicType] || epicType); }

function addRow(epicType, epicLabel) {
  rowCount++;
  const id         = rowCount;
  const typeOpts   = buildTypeOptions(epicType || '');
  const color      = epicType ? typeColorCSS(epicType) : '#ccc';
  const badgeBg    = epicType ? color+'22' : '#f0f0f0';
  const badgeColor = epicType ? color : '#999';
  const badgeLabel = epicType ? (customTypes[epicType]?.label || epicType) : 'Custom row';

  const el = document.createElement('div');
  el.className = 'row-block';
  el.id = `row-${id}`;
  el.innerHTML = `
    <div class="row-type-strip" id="strip-${id}" style="background:${color}"></div>
    <div class="row-header">
      <span class="row-badge" id="badge-${id}" style="background:${badgeBg};color:${badgeColor}">
        <span class="dot" style="background:${color}"></span>
        ${badgeLabel}
      </span>
      <button type="button" class="btn-remove"
              onclick="document.getElementById('row-${id}').remove();schedulePreviewRefresh()">✕ Remove</button>
    </div>
    <div class="row-fields">
      <div class="field-col">
        <label>Row label</label>
        <textarea class="row-label-txt" rows="2" placeholder="e.g. Service Design\nDefine Phase">${epicLabel||''}</textarea>
      </div>
      <div class="field-col">
        <label>Row type (default bar colour)</label>
        <select class="row-epic-type" onchange="onRowTypeChange(${id}, this.value)">${typeOpts}</select>
      </div>
    </div>
    <div class="items-label">Bars &amp; milestones</div>
    <div class="bars-container" id="bars-${id}"></div>
    <div class="milestone-container" id="milestones-${id}"></div>
    <div class="row-actions">
      <button type="button" class="btn-add-item" onclick="addBar(${id})">+ Add bar</button>
      <button type="button" class="btn-add-item btn-add-ms" onclick="addMilestone(${id})">◇ Add milestone</button>
    </div>
  `;
  document.getElementById('rows-container').appendChild(el);
  schedulePreviewRefresh();
}

function buildTypeOptions(selected) {
  const blank = `<option value=""${!selected?' selected':''}>— None / Mixed —</option>`;
  return blank + Object.entries(customTypes).map(([k,v]) =>
    `<option value="${k}"${k===selected?' selected':''}>${v.label}</option>`
  ).join('');
}

function onRowTypeChange(rowId, type) {
  const color = type ? typeColorCSS(type) : '#ccc';
  const strip = document.getElementById(`strip-${rowId}`);
  const badge = document.getElementById(`badge-${rowId}`);
  if (strip) strip.style.background = color;
  if (badge) {
    badge.querySelector('.dot').style.background = color;
    badge.style.color      = type ? color : '#999';
    badge.style.background = type ? color+'22' : '#f0f0f0';
    // Update text node
    const nodes = Array.from(badge.childNodes);
    const textNode = nodes.find(n => n.nodeType === 3 && n.textContent.trim());
    if (textNode) textNode.textContent = '\n        ' + (type ? (customTypes[type]?.label||'Custom') : 'Custom row') + '\n      ';
  }
  schedulePreviewRefresh();
}

function addBar(rowId) {
  barCount++;
  const bc      = barCount;
  const rowType = document.querySelector(`#row-${rowId} .row-epic-type`)?.value || '';
  const typeOpts = Object.entries(customTypes).map(([k,v]) =>
    `<option value="${k}"${k===rowType?' selected':''}>${v.label}</option>`
  ).join('');

  const el = document.createElement('div');
  el.className = 'item-block bar-block';
  el.id = `bar-${bc}`;
  el.innerHTML = `
    <div class="item-header">
      <span>Bar</span>
      <button type="button" class="btn-remove-sm"
              onclick="document.getElementById('bar-${bc}').remove();schedulePreviewRefresh()">✕</button>
    </div>
    <div class="item-fields">
      <div class="field-inline"><label>Start date</label><input type="date" class="bar-start"></div>
      <div class="field-inline"><label>End date</label><input type="date" class="bar-end"></div>
      <div class="field-inline" style="grid-column:span 2">
        <label>Bar label</label>
        <input type="text" class="bar-label" placeholder="e.g. Define phase · Stakeholder mapping">
      </div>
      <div class="field-inline"><label>Type / colour</label><select class="bar-type">${typeOpts}</select></div>
    </div>
  `;
  document.getElementById(`bars-${rowId}`).appendChild(el);
}

function addMilestone(rowId) {
  msCount++;
  const mc = msCount;
  const el = document.createElement('div');
  el.className = 'item-block milestone-block';
  el.id = `ms-${mc}`;
  el.innerHTML = `
    <div class="item-header">
      <span>◇ Milestone</span>
      <button type="button" class="btn-remove-sm"
              onclick="document.getElementById('ms-${mc}').remove();schedulePreviewRefresh()">✕</button>
    </div>
    <div class="item-fields">
      <div class="field-inline"><label>Date</label><input type="date" class="ms-date"></div>
      <div class="field-inline" style="grid-column:span 2">
        <label>Label (use \\n for line breaks)</label>
        <textarea class="ms-label" rows="2" placeholder="29 Apr\nPrototype draft"></textarea>
      </div>
      <div class="field-inline"><label>Position</label>
        <select class="ms-pos">
          <option value="above">Above</option>
          <option value="below">Below</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div class="field-inline"><label>Diamond colour</label>
        <select class="ms-color">
          <option value="red">◆ Red (milestone)</option>
          <option value="green">◆ Green (go live)</option>
        </select>
      </div>
    </div>
  `;
  document.getElementById(`milestones-${rowId}`).appendChild(el);
}

// ── Form data get/apply ───────────────────────────────────────────────────────
function getFormData() {
  const rows = [];
  document.querySelectorAll('.row-block').forEach(rowEl => {
    const bars = [];
    rowEl.querySelectorAll('.bar-block').forEach(b => {
      bars.push({
        start: b.querySelector('.bar-start').value,
        end:   b.querySelector('.bar-end').value,
        label: b.querySelector('.bar-label').value,
        type:  b.querySelector('.bar-type').value,
      });
    });
    const milestones = [];
    rowEl.querySelectorAll('.milestone-block').forEach(ms => {
      milestones.push({
        date:  ms.querySelector('.ms-date').value,
        label: ms.querySelector('.ms-label').value,
        pos:   ms.querySelector('.ms-pos').value,
        color: ms.querySelector('.ms-color').value,
      });
    });
    rows.push({
      label:    rowEl.querySelector('.row-label-txt').value,
      epicType: rowEl.querySelector('.row-epic-type').value,
      bars, milestones,
    });
  });

  // Capture all custom type overrides
  const typeCustomizations = {};
  Object.entries(customTypes).forEach(([k, v]) => {
    typeCustomizations[k] = { color: v.color, textColor: v.textColor, label: v.label };
  });

  return {
    title:              document.getElementById('title').value || 'Timeline',
    subtitle:           document.getElementById('subtitle').value || '',
    showBadge:          document.getElementById('show-badge').checked,
    badgeText:          document.getElementById('badge-text').value || '',
    startMonth:         parseInt(document.getElementById('start-month').value),
    startYear:          parseInt(document.getElementById('start-year').value),
    endMonth:           parseInt(document.getElementById('end-month').value),
    endYear:            parseInt(document.getElementById('end-year').value),
    showToday:          document.getElementById('show-today').checked,
    todayDate:          document.getElementById('today-date').value,
    showWeeks:          document.getElementById('show-weeks').checked,
    showYearBands:      document.getElementById('show-year-bands').checked,
    autoScale:          document.getElementById('auto-scale').checked,
    labelBelow:         document.getElementById('label-below').checked,
    sectionLabel:       document.getElementById('section-label').value || '',
    goLiveText:         document.getElementById('golive-text').value || '',
    typeCustomizations,
    rows,
  };
}

function applyFormData(data) {
  document.getElementById('title').value              = data.title        || '';
  document.getElementById('subtitle').value           = data.subtitle     || '';
  document.getElementById('show-badge').checked       = !!data.showBadge;
  document.getElementById('badge-text').value         = data.badgeText    || '';
  document.getElementById('start-month').value        = data.startMonth   || 4;
  document.getElementById('start-year').value         = data.startYear    || 2026;
  document.getElementById('end-month').value          = data.endMonth     || 11;
  document.getElementById('end-year').value           = data.endYear      || 2026;
  document.getElementById('show-today').checked       = !!data.showToday;
  document.getElementById('today-date').value         = data.todayDate    || '';
  document.getElementById('show-weeks').checked       = !!data.showWeeks;
  document.getElementById('show-year-bands').checked  = !!data.showYearBands;
  document.getElementById('auto-scale').checked       = data.autoScale !== false;
  document.getElementById('label-below').checked      = data.labelBelow !== false;
  document.getElementById('section-label').value      = data.sectionLabel || '';
  document.getElementById('golive-text').value        = data.goLiveText   || '';

  // Restore custom types then rebuild editor
  initCustomTypes(data.typeCustomizations || {});
  buildTypeEditor();

  // Rebuild rows
  document.getElementById('rows-container').innerHTML = '';
  rowCount = 0; barCount = 0; msCount = 0;

  (data.rows || []).forEach(rowData => {
    addRow(rowData.epicType || '', rowData.label || '');
    const rowId = rowCount;
    document.querySelector(`#row-${rowId} .row-label-txt`).value = rowData.label || '';

    (rowData.bars || []).forEach(bar => {
      addBar(rowId);
      const el = document.getElementById(`bar-${barCount}`);
      el.querySelector('.bar-start').value = bar.start || '';
      el.querySelector('.bar-end').value   = bar.end   || '';
      el.querySelector('.bar-label').value = bar.label || '';
      el.querySelector('.bar-type').value  = bar.type  || 'development';
    });

    (rowData.milestones || []).forEach(ms => {
      addMilestone(rowId);
      const el = document.getElementById(`ms-${msCount}`);
      el.querySelector('.ms-date').value  = ms.date  || '';
      el.querySelector('.ms-label').value = ms.label || '';
      el.querySelector('.ms-pos').value   = ms.pos   || 'above';
      el.querySelector('.ms-color').value = ms.color || 'red';
    });
  });

  renderPreview();
}

// ── Save / Load ───────────────────────────────────────────────────────────────
function saveTimeline() {
  const data  = getFormData();
  const json  = JSON.stringify(data, null, 2);
  const fname = (data.title||'timeline').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').substring(0,50);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type:'application/json' }));
  a.download = fname + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function loadTimeline(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      applyFormData(JSON.parse(e.target.result));
      setStatus('✓ Loaded: ' + file.name, 'ok');
    } catch(err) {
      setStatus('Error reading file: ' + err.message, 'err');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ── Jira CSV export ───────────────────────────────────────────────────────────
function exportJiraCSV() {
  const data    = getFormData();
  const csvRows = [['Summary', 'Start date', 'Due date', 'Epic']];
  data.rows.forEach(row => {
    const epic = (row.label||'').replace(/\n/g,' ').trim();
    (row.bars||[]).forEach(bar => {
      if (!bar.label || !bar.start || !bar.end) return;
      csvRows.push([bar.label, bar.start, bar.end, epic]);
    });
  });
  if (csvRows.length === 1) { setStatus('No bars to export — add some tasks first.', 'err'); return; }
  const csv   = csvRows.map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const fname = (data.title||'timeline').replace(/[^\w\s-]/g,'').replace(/\s+/g,'_').substring(0,50);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
  a.download = fname + '_jira.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(`✓ Exported ${csvRows.length-1} task${csvRows.length>2?'s':''} to CSV`, 'ok');
}

// ── Generate ──────────────────────────────────────────────────────────────────
async function generatePPTX() {
  const btn = document.getElementById('generate-btn');
  btn.disabled = true; btn.textContent = 'Generating…';
  setStatus('', '');
  try {
    await buildPPTX(getFormData());
    setStatus('✓ PPTX downloaded', 'ok');
  } catch(e) {
    setStatus('Error: ' + e.message, 'err');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = '⬇ Generate PPTX';
  }
}

function setStatus(msg, cls) {
  const el = document.getElementById('status-msg');
  el.textContent = msg; el.className = cls;
}

// ── Debounced preview refresh ─────────────────────────────────────────────────
let previewTimer = null;
function schedulePreviewRefresh() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 350);
}

// ── Welcome screen ────────────────────────────────────────────────────────────

function showScreen(id) {
  ['welcome-screen', 'ai-screen', 'page-header', 'main-app'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = (id === 'page-header' || id === 'main-app') ? '' : 'flex';
}

function showApp() {
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('ai-screen').style.display      = 'none';
  document.getElementById('page-header').style.display    = '';
  document.getElementById('main-app').style.display       = '';
}

function backToWelcome() {
  document.getElementById('welcome-screen').style.display = 'flex';
  document.getElementById('ai-screen').style.display      = 'none';
  document.getElementById('page-header').style.display    = 'none';
  document.getElementById('main-app').style.display       = 'none';
}

function welcomeChooseManual() {
  showApp();
}

function welcomeChooseLoad() {
  document.getElementById('welcome-json-input').click();
}

function welcomeJsonSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      applyFormData(JSON.parse(e.target.result));
      showApp();
    } catch(err) {
      alert('Could not read timeline file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function welcomeChooseAi() {
  // Pre-fill saved credentials into the AI screen inputs
  document.getElementById('ai-endpoint').value = getEndpoint();
  document.getElementById('ai-key').value      = getApiKey();
  document.getElementById('ai-model').value    = getModel();
  updateCredsStatusBadge();

  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('ai-screen').style.display      = 'flex';
}

// ── AI credentials panel ──────────────────────────────────────────────────────

function toggleCredsPanel() {
  const body    = document.getElementById('ai-creds-body');
  const chevron = document.getElementById('ai-creds-chevron');
  const isOpen  = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  chevron.classList.toggle('open', !isOpen);
}

function saveAiCreds() {
  const endpoint = document.getElementById('ai-endpoint').value.trim();
  const key      = document.getElementById('ai-key').value.trim();
  const model    = document.getElementById('ai-model').value.trim();
  saveApiCredentials(endpoint, key, model);
  updateCredsStatusBadge();
  const msg = document.getElementById('ai-creds-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2000);
}

function updateCredsStatusBadge() {
  const icon = document.getElementById('ai-creds-status-icon');
  const text = document.getElementById('ai-creds-status-text');
  if (hasCredentials()) {
    icon.textContent = '✅';
    text.textContent = 'AI Settings — configured';
  } else {
    icon.textContent = '⚙️';
    text.textContent = 'AI Settings — not configured (click to expand)';
    // Auto-open if not configured
    const body    = document.getElementById('ai-creds-body');
    const chevron = document.getElementById('ai-creds-chevron');
    body.classList.add('open');
    chevron.classList.add('open');
  }
}

// ── Test connection & model picker ───────────────────────────────────────────

async function testAndLoadModels() {
  // Persist whatever is currently in the inputs first
  const endpoint = document.getElementById('ai-endpoint').value.trim();
  const key      = document.getElementById('ai-key').value.trim();
  const model    = document.getElementById('ai-model').value.trim();
  if (endpoint || key) saveApiCredentials(endpoint || getEndpoint(), key || getApiKey(), model || getModel());

  const btn        = document.getElementById('ai-test-btn');
  const statusEl   = document.getElementById('ai-conn-status');
  const modelList  = document.getElementById('ai-model-list');

  btn.disabled     = true;
  btn.textContent  = 'Testing…';
  statusEl.className = 'ai-conn-status';
  statusEl.textContent = '';
  modelList.innerHTML  = '';

  try {
    const result = await testConnection();

    statusEl.className   = 'ai-conn-status success';
    statusEl.textContent = '✅ Connected — ' + result.models.length + ' model' + (result.models.length !== 1 ? 's' : '') + ' available';

    // Prefer Anthropic models in the chip list; fall back to all models
    const display = result.anthropic.length ? result.anthropic : result.models;

    if (display.length) {
      const label = document.createElement('span');
      label.className   = 'ai-model-list-label';
      label.textContent = 'Click a model to select it:';
      modelList.appendChild(label);

      display.forEach(m => {
        const chip = document.createElement('button');
        chip.type      = 'button';
        chip.className = 'ai-model-chip' + (m === getModel() ? ' selected' : '');
        chip.textContent = m;
        chip.onclick = () => {
          document.getElementById('ai-model').value = m;
          saveApiCredentials(getEndpoint(), getApiKey(), m);
          modelList.querySelectorAll('.ai-model-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          updateCredsStatusBadge();
        };
        modelList.appendChild(chip);
      });
    }

    updateCredsStatusBadge();

  } catch (e) {
    statusEl.className   = 'ai-conn-status error';
    statusEl.textContent = '❌ ' + e.message;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Test Connection';
  }
}

// ── AI import ─────────────────────────────────────────────────────────────────

const AI_SYSTEM_PROMPT = `You are a timeline data extractor. The user will describe a project timeline in plain English.
Your job is to convert it into a structured JSON object that matches the Timeline Builder format exactly.

Return ONLY valid JSON — no markdown fences, no explanation, no extra text.

The JSON schema is:
{
  "title": "string — slide title",
  "subtitle": "string — slide subtitle (optional)",
  "showBadge": false,
  "badgeText": "",
  "startMonth": number (1-12),
  "startYear": number,
  "endMonth": number (1-12),
  "endYear": number,
  "showToday": true,
  "todayDate": "YYYY-MM-DD",
  "showWeeks": false,
  "autoScale": true,
  "labelBelow": true,
  "sectionLabel": "string (optional)",
  "goLiveText": "string (optional)",
  "typeCustomizations": {},
  "rows": [
    {
      "label": "string — swim lane name (can be multi-line with \\n)",
      "epicType": "one of: servicedesign | prototype | userresearch | pas | development | change | golive | hypercare",
      "bars": [
        {
          "label": "string — task name",
          "start": "YYYY-MM-DD",
          "end": "YYYY-MM-DD",
          "type": "one of the epicType values above"
        }
      ],
      "milestones": [
        {
          "date": "YYYY-MM-DD",
          "label": "string",
          "pos": "above or below",
          "color": "red or green"
        }
      ]
    }
  ]
}

Rules:
- Infer startMonth/startYear and endMonth/endYear from the earliest and latest dates mentioned, adding 1 month buffer each side if possible.
- Use todayDate = today's date in YYYY-MM-DD format.
- Map swim lanes to the closest epicType. Use "pas" for generic actions/tasks.
- If a task spans a range, create a bar. If it is a single date event, create a milestone.
- Go Live events should be milestones with color "green" in a "golive" row.
- Keep bar labels concise (under 40 chars).
- If no title is given, infer one from context.`;

// ── File upload helpers ───────────────────────────────────────────────────────

const TL_TEXT_EXTS  = ['txt', 'md', 'csv', 'docx'];
const TL_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const TL_IMAGE_MIME = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif' };

let tlUploadedFiles = [];

function tlHandleFileInput(ev) {
  tlHandleFiles(ev.target.files);
  ev.target.value = '';
}

async function tlHandleFiles(fileList) {
  for (const file of Array.from(fileList)) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (TL_IMAGE_EXTS.includes(ext)) {
      try {
        const { dataUrl, base64 } = await tlReadImage(file);
        tlUploadedFiles.push({ name: file.name, size: file.size, text: '', image: true, base64, mimeType: TL_IMAGE_MIME[ext] || 'image/png', dataUrl });
      } catch (err) {
        tlUploadedFiles.push({ name: file.name, size: file.size, text: '', error: err.message || 'Image read failed' });
      }
      tlRenderFileList();
      continue;
    }

    if (!TL_TEXT_EXTS.includes(ext)) {
      tlUploadedFiles.push({ name: file.name, size: file.size, text: '', error: `Unsupported type: .${ext}` });
      tlRenderFileList();
      continue;
    }

    try {
      const text = ext === 'docx' ? await tlReadDocx(file) : await tlReadText(file);
      tlUploadedFiles.push({ name: file.name, size: file.size, text });
    } catch (err) {
      tlUploadedFiles.push({ name: file.name, size: file.size, text: '', error: err.message || 'Read failed' });
    }
    tlRenderFileList();
  }
}

function tlReadText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsText(file);
  });
}

function tlReadDocx(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        if (typeof mammoth === 'undefined') { reject(new Error('mammoth.js not loaded — check internet connection')); return; }
        const result = await mammoth.extractRawText({ arrayBuffer: r.result });
        resolve(result.value || '');
      } catch (err) { reject(new Error('docx extraction failed: ' + err.message)); }
    };
    r.onerror = () => reject(new Error('Could not read docx file'));
    r.readAsArrayBuffer(file);
  });
}

function tlReadImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const dataUrl = r.result; resolve({ dataUrl, base64: dataUrl.split(',')[1] }); };
    r.onerror = () => reject(new Error('Could not read image file'));
    r.readAsDataURL(file);
  });
}

function tlRemoveFile(idx) {
  tlUploadedFiles.splice(idx, 1);
  tlRenderFileList();
}

function tlFormatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function tlEscapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function tlRenderFileList() {
  const ul = document.getElementById('tl-file-list');
  if (!ul) return;
  ul.innerHTML = '';
  tlUploadedFiles.forEach((f, idx) => {
    const li = document.createElement('li');
    li.className = 'tl-file-chip' + (f.error ? ' error' : '') + (f.image ? ' image' : '');
    const meta = f.error ? f.error
      : f.image ? `${tlFormatBytes(f.size)} · image`
      : `${tlFormatBytes(f.size)} · ${(f.text||'').length.toLocaleString()} chars`;
    const thumb = f.image ? `<img class="tl-fc-thumb" src="${f.dataUrl}" alt="${tlEscapeHtml(f.name)}" />` : '';
    li.innerHTML = `${thumb}<span class="tl-fc-name">${tlEscapeHtml(f.name)}</span><span class="tl-fc-meta">${tlEscapeHtml(meta)}</span><button type="button" class="tl-fc-remove" onclick="tlRemoveFile(${idx})">✕</button>`;
    ul.appendChild(li);
  });
}

// Wire up drag-and-drop on the dropzone
function initTlDropzone() {
  const dz = document.getElementById('tl-dropzone');
  if (!dz) return;
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', e => tlHandleFiles(e.dataTransfer.files));
}

// ── AI status & import ────────────────────────────────────────────────────────

function setAiStatus(msg, cls) {
  const el = document.getElementById('ai-status-msg');
  el.textContent = msg;
  el.className   = 'ai-status-msg' + (cls ? ' ' + cls : '');
}

async function runAiImport() {
  const text = document.getElementById('ai-text-input').value.trim();
  const hasFiles = tlUploadedFiles.some(f => !f.error && (f.text || f.image));

  if (!text && !hasFiles) {
    setAiStatus('Please enter some text or upload a file describing your timeline.', 'err');
    return;
  }

  // Save any credentials the user may have just typed (without clicking Save)
  const endpoint = document.getElementById('ai-endpoint').value.trim();
  const key      = document.getElementById('ai-key').value.trim();
  const model    = document.getElementById('ai-model').value.trim();
  if (endpoint || key) saveApiCredentials(endpoint || getEndpoint(), key || getApiKey(), model || getModel());

  if (!getApiKey()) {
    setAiStatus('API key required — expand AI Settings above.', 'err');
    const body    = document.getElementById('ai-creds-body');
    const chevron = document.getElementById('ai-creds-chevron');
    body.classList.add('open');
    chevron.classList.add('open');
    return;
  }

  const btn = document.getElementById('ai-generate-btn');
  btn.disabled = true;
  setAiStatus('⏳ Generating timeline…', '');

  try {
    const today = new Date().toISOString().split('T')[0];

    // Build user message content — may be multipart if images are included
    const imageFiles = tlUploadedFiles.filter(f => f.image && !f.error);
    const textFiles  = tlUploadedFiles.filter(f => !f.image && !f.error && f.text);

    // Assemble text context
    let textContext = `Today's date is ${today}.\n\n`;
    if (textFiles.length) {
      textFiles.forEach(f => {
        textContext += `--- File: ${f.name} ---\n${f.text}\n\n`;
      });
    }
    if (text) textContext += text;

    let userContent;
    if (imageFiles.length) {
      // Multipart content with images
      userContent = [{ type: 'text', text: textContext }];
      imageFiles.forEach(f => {
        userContent.push({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.base64}` } });
      });
    } else {
      userContent = textContext;
    }

    const result = await chatCompletion([
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user',   content: userContent }
    ], { max_tokens: 4096, temperature: 0 });

    // Strip any accidental markdown fences
    let raw = result.content.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    const data = JSON.parse(raw);
    applyFormData(data);
    showApp();
    setStatus('✓ Timeline imported from AI', 'ok');

  } catch(e) {
    console.error('AI import error:', e);
    setAiStatus('Error: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
(function init() {
  ['start-month','end-month'].forEach(id => {
    const sel = document.getElementById(id);
    MONTH_NAMES.forEach((n,i) => {
      const o = document.createElement('option');
      o.value = i+1; o.textContent = n; sel.appendChild(o);
    });
  });
  document.getElementById('start-month').value = '4';
  document.getElementById('end-month').value   = '11';
  document.getElementById('today-date').value  = new Date().toISOString().split('T')[0];

  initCustomTypes();
  buildTypeEditor();

  // Auto-refresh preview on any form input
  document.getElementById('main-app').addEventListener('input',  schedulePreviewRefresh);
  document.getElementById('main-app').addEventListener('change', schedulePreviewRefresh);

  renderPreview();

  // Wire up file drop zone on AI screen
  initTlDropzone();

  // Show welcome screen on load
  backToWelcome();
})();
