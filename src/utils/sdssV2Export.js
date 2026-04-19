// SDSS v2 report exporter — PDF, DOCX, HTML.
//
// Unlike the v1 exporter (sdssExport.js) which walks a rich result object,
// v2 reports are authored as markdown by the pipeline's report_compilation
// stage. The export here preserves that markdown faithfully.
//
// Inputs: v2 report JSON shape
//   {
//     case_id, version, compiled_at, is_provisional,
//     verification_chain_complete, dev_mode_stamp,
//     primary_diagnosis, treatment_holds, completeness_added,
//     markdown
//   }

import jsPDF from 'jspdf';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';

const DISCLAIMER =
  'SECND Medical Platform  |  Decision support only. Does not replace clinical judgment. Not FDA-cleared. Research use only.';
const HEADER_TEXT =
  'SECND Medical Platform  |  AI-Generated Second Opinion  |  Decision Support Only';

function baseName(report) {
  const dx = (report?.primary_diagnosis || 'second-opinion')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  const ver = report?.version ? `v${report.version}` : 'v1';
  return `secnd-${dx}-${ver}-${stamp}`;
}

// ── Markdown parser ─────────────────────────────────────────────
//
// Intentionally small: the pipeline produces a known set of constructs
// (headings, bold, italics, bullet lists, numbered lists, tables,
// horizontal rules). No nested lists. No inline images.

function parseMarkdown(md) {
  const lines = (md || '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^={3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() });
      i += 1;
      continue;
    }

    // Blank line
    if (trimmed === '') {
      i += 1;
      continue;
    }

    // Table — `| a | b |` lines
    if (/^\|.*\|$/.test(trimmed) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const header = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph — consume contiguous non-blank, non-special lines
    const paraLines = [line];
    i += 1;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '' || /^(#{1,6})\s+/.test(t) || /^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t) || /^\|.*\|$/.test(t) || /^-{3,}$/.test(t)) break;
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'p', text: paraLines.join(' ').trim() });
  }
  return blocks;
}

// Parse inline **bold** / *italic* / `code` into runs.
function parseInline(text) {
  const runs = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) runs.push({ text: m[3], italic: true });
    else if (m[4] !== undefined) runs.push({ text: m[4], code: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

function stripMarkdown(text) {
  return parseInline(text).map((r) => r.text).join('');
}

// ═══════════════════════════════════════════════════════════════
// HTML export — standalone styled document
// ═══════════════════════════════════════════════════════════════

export function exportV2HTML(report) {
  if (!report?.markdown) throw new Error('Report has no markdown content');

  const blocks = parseMarkdown(report.markdown);

  const escape = (s) => String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const renderInline = (text) => parseInline(text).map((r) => {
    const t = escape(r.text);
    if (r.bold) return `<strong>${t}</strong>`;
    if (r.italic) return `<em>${t}</em>`;
    if (r.code) return `<code>${t}</code>`;
    return t;
  }).join('');

  const bodyParts = blocks.map((b) => {
    switch (b.type) {
      case 'heading': return `<h${b.level}>${renderInline(b.text)}</h${b.level}>`;
      case 'p':       return `<p>${renderInline(b.text)}</p>`;
      case 'ul':      return `<ul>${b.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ul>`;
      case 'ol':      return `<ol>${b.items.map((it) => `<li>${renderInline(it)}</li>`).join('')}</ol>`;
      case 'hr':      return '<hr>';
      case 'table': {
        const head = b.header.map((c) => `<th>${renderInline(c)}</th>`).join('');
        const body = b.rows.map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('');
        return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      }
      default: return '';
    }
  }).join('\n');

  const meta = [
    report.primary_diagnosis ? `Primary: ${escape(report.primary_diagnosis)}` : null,
    `Report v${report.version}${report.is_provisional ? ' (provisional)' : ''}`,
    report.verification_chain_complete ? 'Verification chain complete' : 'Verification chain incomplete',
  ].filter(Boolean).join('  •  ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SECND Second Opinion — ${escape(report.primary_diagnosis || 'Case ' + (report.case_id || ''))}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1.5rem; color: #1f2937; line-height: 1.55; }
  header { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.75rem; margin-bottom: 1.5rem; }
  header h1 { font-size: 1.25rem; margin: 0 0 0.25rem; color: #111827; }
  header .meta { font-size: 0.75rem; color: #6b7280; }
  h1, h2, h3, h4 { color: #111827; margin-top: 1.75rem; }
  h2 { border-bottom: 1px solid #f3f4f6; padding-bottom: 0.25rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }
  th, td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
  th { background: #f9fafb; font-weight: 600; }
  code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 0.25rem; font-size: 0.9em; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
  ul, ol { padding-left: 1.5rem; }
  footer { border-top: 1px solid #e5e7eb; margin-top: 2.5rem; padding-top: 0.75rem; font-size: 0.7rem; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>Verified Second Opinion</h1>
  <div class="meta">${meta}</div>
</header>
${bodyParts}
<footer>${escape(DISCLAIMER)}</footer>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  saveAs(blob, `${baseName(report)}.html`);
}

// ═══════════════════════════════════════════════════════════════
// PDF export — jsPDF, text-based
// ═══════════════════════════════════════════════════════════════

export function exportV2PDF(report) {
  if (!report?.markdown) throw new Error('Report has no markdown content');
  const blocks = parseMarkdown(report.markdown);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  const addHeaderFooter = () => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(HEADER_TEXT, margin, 8);
    const pageNum = doc.internal.getCurrentPageInfo().pageNumber;
    doc.text(`Page ${pageNum}`, pageW - margin, 8, { align: 'right' });
    doc.setFontSize(7);
    doc.text(DISCLAIMER, pageW / 2, pageH - 6, { align: 'center', maxWidth: contentW });
    doc.setTextColor(0, 0, 0);
  };

  const checkPage = (needed = 10) => {
    if (y + needed > pageH - margin) {
      addHeaderFooter();
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text, opts = {}) => {
    const { size = 10, bold = false, italic = false, indent = 0, color = [0, 0, 0] } = opts;
    doc.setFontSize(size);
    const style = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
    doc.setFont('helvetica', style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentW - indent);
    for (const line of lines) {
      checkPage(size * 0.42 + 1);
      doc.text(line, margin + indent, y);
      y += size * 0.42 + 1;
    }
  };

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(17, 24, 39);
  doc.text('Verified Second Opinion', margin, y);
  y += 7;

  const metaBits = [
    report.primary_diagnosis ? `Primary: ${report.primary_diagnosis}` : null,
    `Report v${report.version}${report.is_provisional ? ' (provisional)' : ''}`,
    report.verification_chain_complete ? 'Verification chain complete' : 'Verification chain incomplete',
  ].filter(Boolean);
  writeWrapped(metaBits.join('   •   '), { size: 8, color: [107, 114, 128] });
  y += 2;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Body
  for (const b of blocks) {
    switch (b.type) {
      case 'heading': {
        y += 2;
        const sizes = { 1: 14, 2: 12, 3: 11, 4: 10, 5: 10, 6: 10 };
        writeWrapped(stripMarkdown(b.text), {
          size: sizes[b.level] || 10, bold: true, color: [17, 24, 39],
        });
        y += 1;
        break;
      }
      case 'p':
        writeWrapped(stripMarkdown(b.text), { size: 10 });
        y += 1;
        break;
      case 'ul':
        for (const it of b.items) {
          writeWrapped('• ' + stripMarkdown(it), { size: 10, indent: 3 });
        }
        y += 1;
        break;
      case 'ol':
        b.items.forEach((it, idx) => {
          writeWrapped(`${idx + 1}. ${stripMarkdown(it)}`, { size: 10, indent: 3 });
        });
        y += 1;
        break;
      case 'hr':
        checkPage(4);
        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y + 1, pageW - margin, y + 1);
        y += 4;
        break;
      case 'table': {
        // Simple table: render header in bold then rows. jspdf-autotable
        // would be prettier but adds complexity; keep this self-contained.
        y += 1;
        writeWrapped(b.header.map(stripMarkdown).join('  |  '), { size: 9, bold: true });
        for (const row of b.rows) {
          writeWrapped(row.map(stripMarkdown).join('  |  '), { size: 9 });
        }
        y += 1;
        break;
      }
      default: break;
    }
  }

  addHeaderFooter();
  doc.save(`${baseName(report)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// DOCX export — docx library
// ═══════════════════════════════════════════════════════════════

function mkRuns(text) {
  return parseInline(text).map((r) => new TextRun({
    text: r.text,
    bold: r.bold || false,
    italics: r.italic || false,
    font: r.code ? 'Consolas' : undefined,
  }));
}

export function exportV2DOCX(report) {
  if (!report?.markdown) throw new Error('Report has no markdown content');
  const blocks = parseMarkdown(report.markdown);

  const headingLevels = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };

  const children = [];

  // Header
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: 'Verified Second Opinion', bold: true, size: 32 })],
  }));
  const metaBits = [
    report.primary_diagnosis ? `Primary: ${report.primary_diagnosis}` : null,
    `Report v${report.version}${report.is_provisional ? ' (provisional)' : ''}`,
    report.verification_chain_complete ? 'Verification chain complete' : 'Verification chain incomplete',
  ].filter(Boolean);
  children.push(new Paragraph({
    children: [new TextRun({ text: metaBits.join('   •   '), italics: true, color: '6B7280', size: 18 })],
  }));
  children.push(new Paragraph({ children: [new TextRun('')] }));

  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        children.push(new Paragraph({ heading: headingLevels[b.level] || HeadingLevel.HEADING_3, children: mkRuns(b.text) }));
        break;
      case 'p':
        children.push(new Paragraph({ children: mkRuns(b.text) }));
        break;
      case 'ul':
        for (const it of b.items) {
          children.push(new Paragraph({ bullet: { level: 0 }, children: mkRuns(it) }));
        }
        break;
      case 'ol':
        for (const it of b.items) {
          children.push(new Paragraph({ numbering: { reference: 'ordered', level: 0 }, children: mkRuns(it) }));
        }
        break;
      case 'hr':
        children.push(new Paragraph({
          children: [new TextRun({ text: '─'.repeat(50), color: 'D1D5DB' })],
          alignment: AlignmentType.CENTER,
        }));
        break;
      case 'table':
        // Render as aligned paragraphs for simplicity. The docx Table API
        // works but the lines often look better as plain text with the
        // same monospaced feel as the markdown source.
        children.push(new Paragraph({
          children: [new TextRun({ text: b.header.map(stripMarkdown).join('  |  '), bold: true })],
        }));
        for (const row of b.rows) {
          children.push(new Paragraph({
            children: [new TextRun({ text: row.map(stripMarkdown).join('  |  ') })],
          }));
        }
        break;
      default: break;
    }
  }

  children.push(new Paragraph({ children: [new TextRun('')] }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: DISCLAIMER, italics: true, size: 16, color: '9CA3AF' })],
  }));

  const docx = new Document({
    numbering: {
      config: [{
        reference: 'ordered',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.START,
        }],
      }],
    },
    sections: [{ properties: {}, children }],
  });

  Packer.toBlob(docx).then((blob) => {
    saveAs(blob, `${baseName(report)}.docx`);
  });
}
