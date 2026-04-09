import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { renderEventItem, extractVerdict, extractKnowledgeGaps, extractRecommendations, PRIORITY_COLORS } from './reportHelpers';

// ── Helpers ─────────────────────────────────────────────────────

function stripMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '  - ')
    .replace(/^\d+\.\s+/gm, (m) => '  ' + m)
    .trim();
}

function fmtMs(ms) {
  if (!ms) return '';
  return ms >= 60000
    ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
    : `${(ms / 1000).toFixed(1)}s`;
}

function isVerified(answer) {
  const v = String(answer || '').toLowerCase().trim();
  return ['true', 'yes', 'verified'].includes(v);
}
function isRefuted(answer) {
  const v = String(answer || '').toLowerCase().trim();
  return ['false', 'no', 'refuted'].includes(v);
}

function refTitle(ref) {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref.title || ref.name || ref.citation || JSON.stringify(ref);
}

function refUrl(ref) {
  if (!ref || typeof ref !== 'object') return null;
  return ref.url || ref.link || ref.doi_url
    || (ref.doi ? `https://doi.org/${ref.doi}` : null)
    || (ref.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/` : null);
}

function extractReportData(result) {
  const dxList = result.p2_differential || [];
  const hasCritical = result.has_critical_flags || dxList.some(dx => dx.critical_flags?.length > 0);
  return { dxList, hasCritical };
}

const DISCLAIMER = 'SECND Medical Platform  |  Decision support only. Does not replace clinical judgment. Not FDA-cleared. Research use only.';
const HEADER_TEXT = 'SECND Medical Platform  |  AI-Generated Second Opinion  |  Decision Support Only  |  Not a substitute for clinical judgment';


// ═══════════════════════════════════════════════════════════════
//  PDF EXPORT — Clinical consult report format
// ═══════════════════════════════════════════════════════════════

export function exportSdssPDF(result, mode = 'standard') {
  const { dxList, hasCritical } = extractReportData(result);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Page header/footer on every page ──
  function addHeaderFooter() {
    // Header line
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(HEADER_TEXT, margin, 8);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 10, pageW - margin, 10);
    // Footer
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.text(DISCLAIMER, margin, pageH - 8);
  }

  function checkPage(needed = 20) {
    if (y + needed > pageH - 18) {
      doc.addPage();
      addHeaderFooter();
      y = 16;
    }
  }

  function sectionTitle(text) {
    checkPage(14);
    y += 4;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 80);
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(55, 48, 163);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + doc.getTextWidth(text) + 2, y);
    y += 6;
  }

  function bodyText(text, indent = 0, bold = false) {
    doc.setFontSize(10);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentW - indent);
    lines.forEach(line => {
      checkPage(5);
      doc.text(line, margin + indent, y);
      y += 4.5;
    });
  }

  function labelValue(label, value, indent = 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text(label.toUpperCase(), margin + indent, y);
    const labelW = doc.getTextWidth(label.toUpperCase()) + 3;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(value, contentW - indent - labelW - 30);
    doc.text(lines[0] || '', margin + indent + Math.max(labelW, 32), y);
    y += 5.5;
    for (let i = 1; i < lines.length; i++) {
      doc.text(lines[i], margin + indent + Math.max(labelW, 32), y);
      y += 4.5;
    }
  }

  // ── Page 1 ──
  addHeaderFooter();
  y = 16;

  // Title block
  doc.setFillColor(55, 48, 163);
  doc.roundedRect(margin, y, contentW, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 255);
  doc.text('SECND', margin + 4, y + 6);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Second Opinion Clinical Analysis', margin + 4, y + 14);
  y += 26;

  // Meta line
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  const metaParts = [mode === 'zebra' ? 'Zebra Mode' : 'Standard Analysis', new Date().toLocaleDateString()];
  if (result.total_ms || result.total_latency_ms) metaParts.push(`Duration: ${fmtMs(result.total_ms || result.total_latency_ms)}`);
  doc.text(metaParts.join('  |  '), margin, y);
  y += 8;

  // ── Patient Summary Grid ──
  if (result.patient && Object.keys(result.patient).length > 0) {
    Object.entries(result.patient).forEach(([k, v]) => {
      if (v) {
        checkPage(6);
        labelValue(k.replace(/_/g, ' '), String(v));
      }
    });
    y += 2;
  }

  if (result.top_diagnosis) {
    checkPage(6);
    labelValue('Diagnosis', result.top_diagnosis);
    y += 2;
  }

  // Timeline
  if (result.temporal_events?.length > 0) {
    checkPage(10);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('CLINICAL TIMELINE', margin, y);
    y += 5;
    result.temporal_events.forEach(evt => {
      checkPage(5);
      bodyText(`- ${renderEventItem(evt)}`, 4);
    });
    y += 2;
  }

  // Investigations
  if (result.investigations_performed?.length > 0) {
    checkPage(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('INVESTIGATIONS', margin, y);
    y += 5;
    bodyText(result.investigations_performed.map(inv => renderEventItem(inv)).join('  |  '), 4);
    y += 2;
  }

  // ── Executive Verdict ──
  const verdict = extractVerdict(result);
  if (verdict) {
    checkPage(20);
    const verdictColors = { critical: [220, 38, 38], caution: [217, 119, 6], reassuring: [22, 163, 74] };
    const verdictBg = { critical: [254, 226, 226], caution: [254, 243, 199], reassuring: [220, 252, 231] };
    const vc = verdictColors[verdict.level] || verdictColors.caution;
    const vb = verdictBg[verdict.level] || verdictBg.caution;
    doc.setFillColor(...vb);
    doc.setDrawColor(...vc);
    doc.setLineWidth(0.8);
    const verdictText = `EXECUTIVE VERDICT: ${verdict.text}`;
    const verdictLines = doc.splitTextToSize(verdictText, contentW - 14);
    const rectH = 10 + verdictLines.length * 5;
    doc.roundedRect(margin, y, contentW, rectH, 2, 2, 'FD');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...vc);
    verdictLines.forEach((line, li) => {
      doc.text(line, margin + 7, y + 7 + li * 5);
    });
    y += rectH + 6;
  }

  // ── Critical Alert ──
  if (hasCritical) {
    checkPage(20);
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text('CRITICAL SAFETY ALERT', margin + 5, y + 6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('One or more findings require immediate clinical attention.', margin + 5, y + 11);
    y += 20;

    dxList.filter(dx => dx.critical_flags?.length > 0).forEach(dx => {
      checkPage(8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text(dx.diagnosis, margin + 5, y);
      y += 4;
      dx.critical_flags.forEach(flag => {
        doc.setFont('helvetica', 'normal');
        doc.text(`- ${flag}`, margin + 8, y);
        y += 4;
      });
    });
    y += 4;
  }

  // ── SECTION A — MedGemma Clinical Analysis ──
  const p1Text = result.p1_clean || result.p1_differential;
  if (p1Text) {
    sectionTitle('Section A — MedGemma Clinical Analysis');
    const p1Lines = stripMarkdown(p1Text).split('\n').filter(Boolean);
    p1Lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const isSubHeading = /^\d+\.\s+[A-Z]/.test(trimmed) || (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && trimmed.length > 3);
      if (isSubHeading) {
        checkPage(10);
        y += 2;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(trimmed, margin, y);
        y += 6;
      } else {
        bodyText(trimmed);
      }
    });
    y += 4;
  }

  // ── SECTION B — Knowledge Graph Verification ──
  if (dxList.length > 0) {
    sectionTitle('Section B — Knowledge Graph Verification');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text('Each hypothesis verified against PrimeKG knowledge graph:', margin, y);
    y += 6;

    dxList.forEach((dx, i) => {
      checkPage(20);
      const isCritical = dx.critical_flags?.length > 0;

      // Rank + diagnosis name
      doc.setFillColor(isCritical ? 220 : 55, isCritical ? 38 : 48, isCritical ? 38 : 163);
      doc.roundedRect(margin, y - 4, 8, 8, 1, 1, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), margin + 4, y + 1, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(dx.diagnosis || '', margin + 12, y + 1);

      // KG support badge
      const supportText = dx.kg_support || '';
      if (supportText) {
        const badgeX = margin + 12 + doc.getTextWidth(dx.diagnosis || '') + 4;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const supportColor = supportText.includes('Strongly') ? [22, 163, 74] : supportText.includes('Partially') ? [217, 119, 6] : supportText.includes('Questioned') ? [220, 38, 38] : [107, 114, 128];
        doc.setTextColor(...supportColor);
        doc.text(`[${supportText}]`, badgeX, y + 1);
      }
      y += 8;

      // KG score + counts
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      const scoreParts = [];
      if (dx.kg_score != null) scoreParts.push(`KG Score: ${(dx.kg_score * 100).toFixed(0)}%`);
      if (dx.likelihood) scoreParts.push(`Likelihood: ${dx.likelihood.replace('-', ' ')}`);
      if (dx.true_count != null) scoreParts.push(`${dx.true_count} supporting / ${dx.false_count || 0} against`);
      if (scoreParts.length > 0) {
        doc.text(scoreParts.join('  |  '), margin + 12, y);
        y += 5;
      }

      // Critical flags
      if (isCritical) {
        dx.critical_flags.forEach(flag => {
          checkPage(5);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(185, 28, 28);
          doc.text(`! ${flag}`, margin + 12, y);
          y += 4.5;
        });
      }

      // Triplets table
      const triplets = dx.triplets || [];
      if (triplets.length > 0) {
        checkPage(12);
        autoTable(doc, {
          startY: y,
          margin: { left: margin + 12, right: margin },
          head: [['Subject', 'Relation', 'Object', 'Verdict', 'Confidence']],
          body: triplets.map(t => [
            t.head || '',
            (t.relation || '').replace(/_/g, ' '),
            t.tail || '',
            isVerified(t.answer) ? 'Verified' : isRefuted(t.answer) ? 'Refuted' : String(t.answer || 'Unknown'),
            t.confidence || '',
          ]),
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [55, 48, 163], textColor: 255, fontStyle: 'bold', fontSize: 7 },
          bodyStyles: { textColor: [40, 40, 40] },
          alternateRowStyles: { fillColor: [248, 248, 255] },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
              const val = data.cell.text[0] || '';
              if (val === 'Verified') data.cell.styles.textColor = [22, 163, 74];
              else if (val === 'Refuted') data.cell.styles.textColor = [220, 38, 38];
            }
          },
        });
        y = doc.lastAutoTable.finalY + 6;
      }

      y += 4;
    });
  }

  // ── Knowledge Gaps ──
  const gaps = extractKnowledgeGaps(result);
  if (gaps.length > 0) {
    sectionTitle('Knowledge Gaps');
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Gap', 'Clinical Implication']],
      body: gaps.map(g => [g.gap, g.implication || '—']),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [55, 48, 163], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [248, 248, 255] },
      columnStyles: { 0: { cellWidth: contentW * 0.4 }, 1: { cellWidth: contentW * 0.6, fontStyle: 'italic' } },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── Clinical Recommendations ──
  const recs = extractRecommendations(result);
  if (recs.length > 0) {
    sectionTitle('Clinical Recommendations');
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Priority', 'Action']],
      body: recs.map((r, i) => [String(i + 1), r.priority, r.action]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [55, 48, 163], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [248, 248, 255] },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 25, fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const val = data.cell.text[0] || '';
          if (val === 'IMMEDIATE') data.cell.styles.textColor = [220, 38, 38];
          else if (val === 'HIGH') data.cell.styles.textColor = [234, 88, 12];
          else if (val === 'MODERATE') data.cell.styles.textColor = [37, 99, 235];
          else data.cell.styles.textColor = [107, 114, 128];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── SECTION C — Synthesised Second Opinion ──
  if (result.synthesis) {
    sectionTitle('Section C — Synthesised Second Opinion');
    const synLines = stripMarkdown(result.synthesis).split('\n').filter(Boolean);
    synLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const isSubHeading = /^\d+\.\s+[A-Z]/.test(trimmed) || (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && trimmed.length > 3);
      if (isSubHeading) {
        checkPage(10);
        y += 2;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(trimmed, margin, y);
        y += 6;
      } else {
        bodyText(trimmed);
      }
    });
    y += 4;
  }

  // ── References ──
  if (result.references?.length > 0) {
    sectionTitle(`References (${result.references.length})`);
    result.references.forEach((ref, i) => {
      checkPage(6);
      const title = refTitle(ref);
      const url = refUrl(ref);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      const refText = `[${i + 1}] ${title}`;
      const lines = doc.splitTextToSize(refText, contentW - 4);
      lines.forEach(line => {
        checkPage(4);
        doc.text(line, margin + 4, y);
        y += 4;
      });
      if (url) {
        doc.setFontSize(7);
        doc.setTextColor(79, 70, 229);
        doc.text(url, margin + 8, y);
        y += 3.5;
      }
      y += 1;
    });
  }

  // ── Literature Deep-Dive (if present) ──
  if (result.storm_article) {
    sectionTitle('Literature Deep-Dive');
    bodyText(stripMarkdown(result.storm_article));
    y += 4;
  }

  // Add headers/footers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addHeaderFooter();
  }

  doc.save(`SDSS_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}


// ═══════════════════════════════════════════════════════════════
//  DOCX EXPORT — Clinical consult report format
// ═══════════════════════════════════════════════════════════════

export async function exportSdssDOCX(result, mode = 'standard') {
  const { dxList, hasCritical } = extractReportData(result);
  const children = [];

  // ── Header ──
  children.push(
    new Paragraph({ children: [new TextRun({ text: HEADER_TEXT, size: 14, color: '9CA3AF', italics: true })], spacing: { after: 100 } }),
    new Paragraph({ children: [new TextRun({ text: 'SECND', size: 16, color: '6366F1' })], spacing: { after: 20 } }),
    new Paragraph({ children: [new TextRun({ text: 'Second Opinion Clinical Analysis', bold: true, size: 32, color: '3730A3' })], heading: HeadingLevel.TITLE, spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `${mode === 'zebra' ? 'Zebra Mode' : 'Standard Analysis'}  |  ${new Date().toLocaleDateString()}  |  Duration: ${fmtMs(result.total_ms || result.total_latency_ms)}`, size: 18, color: '6B7280' })], spacing: { after: 200 } }),
  );

  // ── Patient Summary ──
  if (result.patient && Object.keys(result.patient).length > 0) {
    Object.entries(result.patient).forEach(([k, v]) => {
      if (v) children.push(new Paragraph({
        children: [
          new TextRun({ text: `${k.replace(/_/g, ' ').toUpperCase()}    `, bold: true, size: 18, color: '6B7280' }),
          new TextRun({ text: String(v), size: 20 }),
        ],
        spacing: { after: 40 },
      }));
    });
  }

  if (result.top_diagnosis) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'DIAGNOSIS    ', bold: true, size: 18, color: '6B7280' }),
        new TextRun({ text: result.top_diagnosis, bold: true, size: 22, color: '3730A3' }),
      ],
      spacing: { after: 100 },
    }));
  }

  if (result.temporal_events?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'CLINICAL TIMELINE', bold: true, size: 18, color: '6B7280' })], spacing: { before: 100, after: 60 } }));
    result.temporal_events.forEach(evt => {
      children.push(new Paragraph({ children: [new TextRun({ text: `- ${renderEventItem(evt)}`, size: 20 })], spacing: { after: 30 } }));
    });
  }

  if (result.investigations_performed?.length > 0) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'INVESTIGATIONS    ', bold: true, size: 18, color: '6B7280' }),
        new TextRun({ text: result.investigations_performed.map(inv => renderEventItem(inv)).join('  |  '), size: 20 }),
      ],
      spacing: { before: 100, after: 100 },
    }));
  }

  // ── Executive Verdict (DOCX) ──
  const verdictDocx = extractVerdict(result);
  if (verdictDocx) {
    const verdictColorMap = { critical: 'DC2626', caution: 'D97706', reassuring: '16A34A' };
    const verdictBgMap = { critical: 'FEE2E2', caution: 'FEF3C7', reassuring: 'DCFCE7' };
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `EXECUTIVE VERDICT: `, bold: true, size: 24, color: verdictColorMap[verdictDocx.level] || 'D97706' }),
        new TextRun({ text: verdictDocx.text, bold: true, size: 24, color: verdictColorMap[verdictDocx.level] || 'D97706' }),
      ],
      shading: { type: 'clear', fill: verdictBgMap[verdictDocx.level] || 'FEF3C7' },
      spacing: { before: 100, after: 100 },
    }));
  }

  // ── Critical Alert ──
  if (hasCritical) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'CRITICAL SAFETY ALERT — One or more findings require immediate clinical attention.', bold: true, size: 22, color: 'DC2626' })],
      shading: { type: 'clear', fill: 'FEE2E2' },
      spacing: { before: 100, after: 60 },
    }));
    dxList.filter(dx => dx.critical_flags?.length > 0).forEach(dx => {
      children.push(new Paragraph({ children: [new TextRun({ text: dx.diagnosis, bold: true, size: 20, color: 'DC2626' })], spacing: { after: 20 } }));
      dx.critical_flags.forEach(flag => {
        children.push(new Paragraph({ children: [new TextRun({ text: `- ${flag}`, size: 18, color: 'B91C1C' })], spacing: { after: 20 } }));
      });
    });
    children.push(new Paragraph({ children: [], spacing: { after: 100 } }));
  }

  // ── SECTION A — MedGemma Clinical Analysis ──
  const p1Text = result.p1_clean || result.p1_differential;
  if (p1Text) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Section A — MedGemma Clinical Analysis', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    stripMarkdown(p1Text).split('\n').filter(Boolean).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const isSubHeading = /^\d+\.\s+[A-Z]/.test(trimmed) || (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && trimmed.length > 3);
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: isSubHeading, size: isSubHeading ? 22 : 20 })],
        spacing: { before: isSubHeading ? 120 : 0, after: isSubHeading ? 60 : 60 },
      }));
    });
  }

  // ── SECTION B — Knowledge Graph Verification ──
  if (dxList.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Section B — Knowledge Graph Verification', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Each hypothesis verified against PrimeKG knowledge graph:', italics: true, size: 18, color: '6B7280' })], spacing: { after: 100 } }));

    dxList.forEach((dx, i) => {
      const isCritical = dx.critical_flags?.length > 0;
      const supportText = dx.kg_support || '';
      const supportColor = supportText.includes('Strongly') ? '16A34A' : supportText.includes('Partially') ? 'D97706' : supportText.includes('Questioned') ? 'DC2626' : '6B7280';

      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}  `, bold: true, size: 24, color: '3730A3' }),
          new TextRun({ text: dx.diagnosis || '', bold: true, size: 24 }),
          ...(supportText ? [new TextRun({ text: `  [${supportText}]`, bold: true, size: 18, color: supportColor })] : []),
          ...(isCritical ? [new TextRun({ text: '  CRITICAL', bold: true, size: 16, color: 'DC2626' })] : []),
        ],
        spacing: { before: 120, after: 40 },
      }));

      // KG score + counts
      const metaParts = [];
      if (dx.kg_score != null) metaParts.push(`KG Score: ${(dx.kg_score * 100).toFixed(0)}%`);
      if (dx.likelihood) metaParts.push(`Likelihood: ${dx.likelihood.replace('-', ' ')}`);
      if (dx.true_count != null) metaParts.push(`${dx.true_count} supporting / ${dx.false_count || 0} against`);
      if (metaParts.length > 0) {
        children.push(new Paragraph({
          children: [new TextRun({ text: metaParts.join('  |  '), size: 16, color: '9CA3AF' })],
          spacing: { after: 40 },
        }));
      }

      if (isCritical) {
        dx.critical_flags.forEach(flag => {
          children.push(new Paragraph({ children: [new TextRun({ text: `! ${flag}`, bold: true, size: 18, color: 'DC2626' })], spacing: { after: 20 } }));
        });
      }

      // Triplets table
      const triplets = dx.triplets || [];
      if (triplets.length > 0) {
        const headerRow = new TableRow({
          tableHeader: true,
          children: ['Subject', 'Relation', 'Object', 'Verdict', 'Confidence'].map(h =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, color: 'FFFFFF' })], alignment: AlignmentType.LEFT })],
              shading: { type: 'clear', fill: '3730A3' },
              width: { size: 20, type: WidthType.PERCENTAGE },
            })
          ),
        });

        const dataRows = triplets.map(t => {
          const verdict = isVerified(t.answer) ? 'Verified' : isRefuted(t.answer) ? 'Refuted' : String(t.answer || 'Unknown');
          const verdictColor = verdict === 'Verified' ? '16A34A' : verdict === 'Refuted' ? 'DC2626' : '6B7280';
          return new TableRow({
            children: [
              t.head || '', (t.relation || '').replace(/_/g, ' '), t.tail || '', verdict, t.confidence || '',
            ].map((val, ci) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: val, size: 15, color: ci === 3 ? verdictColor : '1F2937' })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
              })
            ),
          });
        });

        children.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
        children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
      }
    });
  }

  // ── Knowledge Gaps (DOCX) ──
  const gapsDocx = extractKnowledgeGaps(result);
  if (gapsDocx.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Knowledge Gaps', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } }));
    const gapHeaderRow = new TableRow({
      tableHeader: true,
      children: ['Gap', 'Clinical Implication'].map(h =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, color: 'FFFFFF' })] })],
          shading: { type: 'clear', fill: '3730A3' },
          width: { size: 50, type: WidthType.PERCENTAGE },
        })
      ),
    });
    const gapDataRows = gapsDocx.map(g => new TableRow({
      children: [g.gap, g.implication || '—'].map(val =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: val, size: 18 })] })],
          width: { size: 50, type: WidthType.PERCENTAGE },
        })
      ),
    }));
    children.push(new Table({ rows: [gapHeaderRow, ...gapDataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }

  // ── Clinical Recommendations (DOCX) ──
  const recsDocx = extractRecommendations(result);
  if (recsDocx.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Clinical Recommendations', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } }));
    const recHeaderRow = new TableRow({
      tableHeader: true,
      children: ['#', 'Priority', 'Action'].map((h, hi) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, color: 'FFFFFF' })] })],
          shading: { type: 'clear', fill: '3730A3' },
          width: { size: hi === 0 ? 8 : hi === 1 ? 17 : 75, type: WidthType.PERCENTAGE },
        })
      ),
    });
    const priorityDocxColor = { IMMEDIATE: 'DC2626', HIGH: 'EA580C', MODERATE: '2563EB', MONITOR: '6B7280' };
    const recDataRows = recsDocx.map((r, i) => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 18 })] })], width: { size: 8, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.priority, bold: true, size: 16, color: priorityDocxColor[r.priority] || '6B7280' })] })], width: { size: 17, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.action, size: 18 })] })], width: { size: 75, type: WidthType.PERCENTAGE } }),
      ],
    }));
    children.push(new Table({ rows: [recHeaderRow, ...recDataRows], width: { size: 100, type: WidthType.PERCENTAGE } }));
    children.push(new Paragraph({ children: [], spacing: { after: 60 } }));
  }

  // ── SECTION C — Synthesised Second Opinion ──
  if (result.synthesis) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Section C — Synthesised Second Opinion', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    stripMarkdown(result.synthesis).split('\n').filter(Boolean).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const isSubHeading = /^\d+\.\s+[A-Z]/.test(trimmed) || (trimmed === trimmed.toUpperCase() && trimmed.length < 80 && trimmed.length > 3);
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, bold: isSubHeading, size: isSubHeading ? 22 : 20 })],
        spacing: { before: isSubHeading ? 120 : 0, after: isSubHeading ? 60 : 60 },
      }));
    });
  }

  // ── References ──
  if (result.references?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: `References (${result.references.length})`, bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } }));
    result.references.forEach((ref, i) => {
      const title = refTitle(ref);
      const url = refUrl(ref);
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `[${i + 1}] ${title}`, size: 18 }),
          ...(url ? [new TextRun({ text: `  ${url}`, size: 14, color: '4F46E5', italics: true })] : []),
        ],
        spacing: { after: 40 },
      }));
    });
  }

  // ── Literature Deep-Dive ──
  if (result.storm_article) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Literature Deep-Dive', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } }));
    stripMarkdown(result.storm_article).split('\n').filter(Boolean).forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 20 })], spacing: { after: 60 } }));
    });
  }

  // ── Disclaimer ──
  children.push(
    new Paragraph({ children: [], spacing: { before: 300 } }),
    new Paragraph({
      children: [new TextRun({ text: DISCLAIMER, italics: true, size: 14, color: '9CA3AF' })],
      shading: { type: 'clear', fill: 'F3F4F6' },
    }),
  );

  const document = new Document({
    sections: [{ children }],
    creator: 'SECND Medical Platform',
    title: 'SDSS Second Opinion Clinical Analysis',
  });

  const blob = await Packer.toBlob(document);
  saveAs(blob, `SDSS_Report_${new Date().toISOString().slice(0, 10)}.docx`);
}


// ═══════════════════════════════════════════════════════════════
//  HTML EXPORT — Clinical consult report format
// ═══════════════════════════════════════════════════════════════

export function exportSdssHTML(result, mode = 'standard') {
  const { dxList, hasCritical } = extractReportData(result);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SDSS Second Opinion - Clinical Analysis</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 0; color: #1f2937; line-height: 1.6; background: #f9fafb; }
  .header-bar { background: #f3f4f6; border-bottom: 1px solid #e5e7eb; padding: 8px 32px; font-size: 11px; color: #9ca3af; }
  .title-block { background: #3730a3; color: white; padding: 24px 32px; }
  .title-block .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #a5b4fc; }
  .title-block h1 { font-size: 22px; margin-top: 4px; }
  .title-block .meta { font-size: 12px; color: #c7d2fe; margin-top: 8px; }
  .content { background: white; border: 1px solid #e5e7eb; border-top: none; padding: 0; }
  .section { padding: 24px 32px; border-bottom: 1px solid #f3f4f6; }
  .section:last-child { border-bottom: none; }
  h2 { font-size: 16px; color: #111827; margin-bottom: 16px; padding-bottom: 6px; border-bottom: 2px solid #3730a3; display: inline-block; }
  .kv-grid { display: grid; grid-template-columns: 140px 1fr; gap: 6px 16px; }
  .kv-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding-top: 2px; }
  .kv-value { font-size: 14px; color: #111827; }
  .kv-value.diagnosis { font-weight: 700; color: #3730a3; }
  .critical-alert { background: #fef2f2; border: 2px solid #fca5a5; border-radius: 12px; padding: 20px; margin: 20px 0; }
  .critical-alert h3 { color: #b91c1c; font-size: 16px; margin-bottom: 8px; }
  .critical-alert p { color: #dc2626; font-size: 13px; }
  .synthesis { font-size: 14px; line-height: 1.8; color: #374151; white-space: pre-wrap; }
  .dx-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 12px; }
  .dx-card.critical { border-color: #fca5a5; background: #fef2f2; }
  .dx-card.high { border-color: #86efac; background: #f0fdf4; }
  .dx-card.moderate { border-color: #fed7aa; background: #fffbeb; }
  .dx-header { display: flex; align-items: flex-start; gap: 12px; }
  .dx-rank { width: 32px; height: 32px; border-radius: 8px; background: #3730a3; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
  .dx-rank.critical { background: #dc2626; }
  .dx-name { font-size: 16px; font-weight: 700; color: #111827; }
  .dx-meta { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .badge.high { background: #dcfce7; color: #16a34a; }
  .badge.moderate { background: #fef3c7; color: #d97706; }
  .badge.low { background: #f3f4f6; color: #6b7280; }
  .badge.must-exclude { background: #fee2e2; color: #dc2626; }
  .badge.critical-flag { background: #dc2626; color: white; }
  .evidence-group { margin-top: 12px; }
  .evidence-group h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .evidence-group.supporting h4 { color: #16a34a; }
  .evidence-group.against h4 { color: #dc2626; }
  .evidence-item { font-size: 12px; color: #374151; padding: 4px 8px; margin: 2px 0; border-radius: 6px; }
  .evidence-item.supporting { background: #f0fdf4; }
  .evidence-item.against { background: #fef2f2; }
  .ref-list { list-style: none; padding: 0; }
  .ref-list li { padding: 4px 0; font-size: 13px; }
  .ref-list a { color: #4f46e5; text-decoration: none; }
  .ref-list a:hover { text-decoration: underline; }
  .ref-meta { font-size: 11px; color: #9ca3af; }
  .timeline-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; font-size: 13px; }
  .timeline-dot { width: 6px; height: 6px; border-radius: 50%; background: #6366f1; margin-top: 6px; flex-shrink: 0; }
  .inv-tag { display: inline-block; padding: 4px 10px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; margin: 2px 4px 2px 0; }
  .footer { background: #f3f4f6; padding: 16px 32px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; }
  @media print { body { max-width: none; background: white; } .content { border: none; } }
</style>
</head>
<body>
<div class="header-bar">${HEADER_TEXT}</div>
<div class="title-block">
  <div class="brand">SECND</div>
  <h1>Second Opinion Clinical Analysis</h1>
  <div class="meta">${mode === 'zebra' ? 'Zebra Mode' : 'Standard Analysis'} &nbsp;|&nbsp; ${new Date().toLocaleDateString()}${(result.total_ms || result.total_latency_ms) ? ` &nbsp;|&nbsp; Duration: ${fmtMs(result.total_ms || result.total_latency_ms)}` : ''}</div>
</div>
<div class="content">
`;

  // Patient Summary
  if ((result.patient && Object.keys(result.patient).length > 0) || result.top_diagnosis || result.temporal_events?.length > 0 || result.investigations_performed?.length > 0) {
    html += `<div class="section"><div class="kv-grid">`;
    if (result.patient) {
      Object.entries(result.patient).forEach(([k, v]) => {
        if (v) html += `<div class="kv-label">${k.replace(/_/g, ' ')}</div><div class="kv-value">${String(v)}</div>`;
      });
    }
    if (result.top_diagnosis) {
      html += `<div class="kv-label">Diagnosis</div><div class="kv-value diagnosis">${result.top_diagnosis}</div>`;
    }
    html += `</div>`;

    if (result.temporal_events?.length > 0) {
      html += `<div style="margin-top:16px"><div class="kv-label" style="margin-bottom:8px">Clinical Timeline</div>`;
      result.temporal_events.forEach(evt => {
        html += `<div class="timeline-item"><div class="timeline-dot"></div><div>${renderEventItem(evt)}</div></div>`;
      });
      html += `</div>`;
    }

    if (result.investigations_performed?.length > 0) {
      html += `<div style="margin-top:16px"><div class="kv-label" style="margin-bottom:8px">Investigations</div><div>`;
      result.investigations_performed.forEach(inv => {
        html += `<span class="inv-tag">${renderEventItem(inv)}</span>`;
      });
      html += `</div></div>`;
    }
    html += `</div>`;
  }

  // Executive Verdict (HTML)
  const verdictHtml = extractVerdict(result);
  if (verdictHtml) {
    const vColorMap = { critical: '#dc2626', caution: '#d97706', reassuring: '#16a34a' };
    const vBgMap = { critical: '#fef2f2', caution: '#fef3c7', reassuring: '#dcfce7' };
    html += `<div class="section"><div style="background:${vBgMap[verdictHtml.level] || vBgMap.caution};border:2px solid ${vColorMap[verdictHtml.level] || vColorMap.caution};border-radius:12px;padding:20px">`;
    html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${vColorMap[verdictHtml.level] || vColorMap.caution};opacity:0.8">Executive Verdict</div>`;
    html += `<div style="font-size:18px;font-weight:700;color:${vColorMap[verdictHtml.level] || vColorMap.caution};margin-top:6px">${verdictHtml.text}</div>`;
    html += `</div></div>`;
  }

  // Critical Alert
  if (hasCritical) {
    html += `<div class="section"><div class="critical-alert"><h3>Critical Safety Alert</h3><p>One or more findings require immediate clinical attention.</p>`;
    dxList.filter(dx => dx.critical_flags?.length > 0).forEach(dx => {
      html += `<p style="margin-top:8px"><strong>${dx.diagnosis}</strong></p>`;
      dx.critical_flags.forEach(flag => { html += `<p style="margin-left:16px">- ${flag}</p>`; });
    });
    html += `</div></div>`;
  }

  // SECTION A — MedGemma Clinical Analysis
  const p1TextHtml = result.p1_clean || result.p1_differential;
  if (p1TextHtml) {
    html += `<div class="section"><h2>Section A — MedGemma Clinical Analysis</h2><div class="synthesis">${stripMarkdown(p1TextHtml)}</div></div>`;
  }

  // SECTION B — Knowledge Graph Verification
  if (dxList.length > 0) {
    html += `<div class="section"><h2>Section B — Knowledge Graph Verification</h2><p style="font-size:12px;color:#6b7280;margin-bottom:16px;font-style:italic">Each hypothesis verified against PrimeKG knowledge graph</p>`;
    dxList.forEach((dx, i) => {
      const isCritical = dx.critical_flags?.length > 0;
      const supportText = dx.kg_support || '';
      const supportClass = supportText.includes('Strongly') ? 'high' : supportText.includes('Partially') ? 'moderate' : supportText.includes('Questioned') ? 'critical' : '';
      const cardClass = isCritical ? 'critical' : supportClass;
      html += `<div class="dx-card ${cardClass}"><div class="dx-header">`;
      html += `<div class="dx-rank ${isCritical ? 'critical' : ''}">${i + 1}</div>`;
      html += `<div><div class="dx-name">${dx.diagnosis}`;
      if (supportText) {
        const badgeClass = supportText.includes('Strongly') ? 'high' : supportText.includes('Partially') ? 'moderate' : supportText.includes('Questioned') ? 'must-exclude' : 'low';
        html += ` <span class="badge ${badgeClass}">${supportText}</span>`;
      }
      if (isCritical) html += ` <span class="badge critical-flag">CRITICAL</span>`;
      html += `</div>`;

      const metaParts = [];
      if (dx.kg_score != null) metaParts.push(`KG Score: ${(dx.kg_score * 100).toFixed(0)}%`);
      if (dx.likelihood) metaParts.push(`Likelihood: ${dx.likelihood.replace('-', ' ')}`);
      if (dx.true_count != null) metaParts.push(`${dx.true_count} supporting / ${dx.false_count || 0} against`);
      html += `<div class="dx-meta">${metaParts.join(' &nbsp;|&nbsp; ')}</div>`;

      if (isCritical) {
        dx.critical_flags.forEach(flag => { html += `<p style="color:#dc2626;font-size:12px;font-weight:600;margin-top:4px">! ${flag}</p>`; });
      }

      // Triplets table
      const triplets = dx.triplets || [];
      if (triplets.length > 0) {
        html += `<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:12px">`;
        html += `<thead><tr style="background:#3730a3;color:white"><th style="padding:6px 8px;text-align:left">Subject</th><th style="padding:6px 8px;text-align:left">Relation</th><th style="padding:6px 8px;text-align:left">Object</th><th style="padding:6px 8px;text-align:left">Verdict</th><th style="padding:6px 8px;text-align:left">Confidence</th></tr></thead><tbody>`;
        triplets.forEach((t, ti) => {
          const verdict = isVerified(t.answer) ? 'Verified' : isRefuted(t.answer) ? 'Refuted' : String(t.answer || 'Unknown');
          const verdictColor = verdict === 'Verified' ? '#16a34a' : verdict === 'Refuted' ? '#dc2626' : '#6b7280';
          const rowBg = ti % 2 === 0 ? '#ffffff' : '#f8f8ff';
          html += `<tr style="background:${rowBg}"><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${t.head || ''}</td><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb"><em>${(t.relation || '').replace(/_/g, ' ')}</em></td><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${t.tail || ''}</td><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;color:${verdictColor};font-weight:600">${verdict}</td><td style="padding:4px 8px;border-bottom:1px solid #e5e7eb">${t.confidence || ''}</td></tr>`;
        });
        html += `</tbody></table>`;
      }

      html += `</div></div></div>`;
    });
    html += `</div>`;
  }

  // Knowledge Gaps (HTML)
  const gapsHtml = extractKnowledgeGaps(result);
  if (gapsHtml.length > 0) {
    html += `<div class="section"><h2>Knowledge Gaps</h2>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#3730a3;color:white"><th style="padding:8px 12px;text-align:left;width:45%">Gap</th><th style="padding:8px 12px;text-align:left;width:55%">Clinical Implication</th></tr></thead><tbody>`;
    gapsHtml.forEach((g, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f8f8ff';
      html += `<tr style="background:${bg}"><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500">${g.gap}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-style:italic">${g.implication || '—'}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Clinical Recommendations (HTML)
  const recsHtml = extractRecommendations(result);
  if (recsHtml.length > 0) {
    html += `<div class="section"><h2>Clinical Recommendations</h2>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#3730a3;color:white"><th style="padding:8px 8px;text-align:center;width:5%">#</th><th style="padding:8px 12px;text-align:left;width:15%">Priority</th><th style="padding:8px 12px;text-align:left;width:80%">Action</th></tr></thead><tbody>`;
    recsHtml.forEach((r, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f8f8ff';
      const pc = PRIORITY_COLORS[r.priority] || PRIORITY_COLORS.MODERATE;
      html += `<tr style="background:${bg}"><td style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:700;color:#9ca3af">${i + 1}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb"><span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;background:${pc.hexBg};color:${pc.hex}">${r.priority}</span></td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${r.action}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // SECTION C — Synthesised Second Opinion
  if (result.synthesis) {
    html += `<div class="section"><h2>Section C — Synthesised Second Opinion</h2><div class="synthesis">${stripMarkdown(result.synthesis)}</div></div>`;
  }

  // References
  if (result.references?.length > 0) {
    html += `<div class="section"><h2>References (${result.references.length})</h2><ol class="ref-list">`;
    result.references.forEach(ref => {
      const title = refTitle(ref);
      const url = refUrl(ref);
      html += `<li>${url ? `<a href="${url}" target="_blank">[${result.references.indexOf(ref) + 1}] ${title}</a>` : `[${result.references.indexOf(ref) + 1}] ${title}`}`;
      const isObj = ref && typeof ref === 'object';
      const source = isObj ? (ref.source || ref.journal) : null;
      const year = isObj ? ref.year : null;
      if (source || year) html += `<div class="ref-meta">${[source, year].filter(Boolean).join(' | ')}</div>`;
      html += `</li>`;
    });
    html += `</ol></div>`;
  }

  // Literature Deep-Dive
  if (result.storm_article) {
    html += `<div class="section"><h2>Literature Deep-Dive</h2><div class="synthesis">${stripMarkdown(result.storm_article)}</div></div>`;
  }

  html += `</div>
<div class="footer">${DISCLAIMER}</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  saveAs(blob, `SDSS_Report_${new Date().toISOString().slice(0, 10)}.html`);
}
