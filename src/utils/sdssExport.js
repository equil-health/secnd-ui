import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

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
  if (!ms) return 'N/A';
  return ms >= 60000
    ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
    : `${(ms / 1000).toFixed(1)}s`;
}

function verdictLabel(answer) {
  const v = String(answer || '').toLowerCase().trim();
  if (['true', 'yes', 'verified'].includes(v)) return 'Verified';
  if (['false', 'no', 'refuted'].includes(v)) return 'Refuted';
  return 'Unknown';
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

// ── Shared data extraction ──────────────────────────────────────

function extractReportData(result, mode) {
  const dxList = result.p2_differential || [];
  const totalTriplets = dxList.reduce((s, dx) => s + (dx.triplets?.length || 0), 0);
  const verifiedTriplets = dxList.reduce((s, dx) => s + (dx.true_count || 0), 0);
  const hasCritical = result.has_critical_flags || dxList.some(dx => dx.critical_flags?.length > 0);

  return { dxList, totalTriplets, verifiedTriplets, hasCritical };
}

// ═══════════════════════════════════════════════════════════════
//  PDF EXPORT
// ═══════════════════════════════════════════════════════════════

export function exportSdssPDF(result, mode = 'standard') {
  const { dxList, totalTriplets, verifiedTriplets, hasCritical } = extractReportData(result, mode);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  function checkPage(needed = 20) {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = margin;
    }
  }

  function heading(text, size = 14) {
    checkPage(size + 6);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 80);
    doc.text(text, margin, y);
    y += size * 0.5 + 3;
  }

  function bodyText(text, indent = 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentW - indent);
    lines.forEach(line => {
      checkPage(5);
      doc.text(line, margin + indent, y);
      y += 4.5;
    });
    y += 2;
  }

  // ── Title ──
  doc.setFillColor(55, 48, 163); // indigo-700
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('SECND SDSS - Second Opinion Report', margin, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${mode === 'zebra' ? 'Zebra Mode' : 'Standard'} Analysis  |  ${new Date().toLocaleDateString()}  |  ${fmtMs(result.total_ms || result.total_latency_ms)}`, margin, 22);
  y = 36;

  // ── Critical flag ──
  if (hasCritical) {
    doc.setFillColor(220, 38, 38);
    doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('CRITICAL SAFETY FLAG DETECTED - Immediate clinical attention required', margin + 4, y + 8);
    y += 18;
  }

  // ── Top diagnosis ──
  if (result.top_diagnosis) {
    heading('Top KG-Verified Diagnosis');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(55, 48, 163);
    doc.text(result.top_diagnosis, margin, y);
    y += 10;
  }

  // ── Summary stats ──
  heading('Summary');
  bodyText(`Hypotheses: ${dxList.length}  |  KG Triplets: ${totalTriplets} (${totalTriplets ? ((verifiedTriplets / totalTriplets) * 100).toFixed(0) : 0}% verified)`);
  if (result.evidence_count != null) bodyText(`Evidence items: ${result.evidence_count}`);
  if (result.hallucination_issues != null) bodyText(`Hallucination flags: ${result.hallucination_issues}`);

  // ── Patient context ──
  if (result.patient && Object.keys(result.patient).length > 0) {
    heading('Patient Demographics');
    Object.entries(result.patient).forEach(([k, v]) => {
      if (v) bodyText(`${k.replace(/_/g, ' ')}: ${v}`, 4);
    });
  }

  if (result.temporal_events?.length > 0) {
    heading('Timeline');
    result.temporal_events.forEach(evt => bodyText(`- ${typeof evt === 'string' ? evt : JSON.stringify(evt)}`, 4));
  }

  if (result.investigations_performed?.length > 0) {
    heading('Investigations Performed');
    bodyText(result.investigations_performed.map(inv => typeof inv === 'string' ? inv : JSON.stringify(inv)).join(', '), 4);
  }

  // ── Synthesis ──
  if (result.synthesis) {
    heading('Reconciled Second Opinion');
    bodyText(stripMarkdown(result.synthesis));
  }

  // ── Differential table ──
  if (dxList.length > 0) {
    heading('KG-Verified Differential Diagnosis');

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Diagnosis', 'Likelihood', 'KG Support', 'KG Score', 'Verified', 'Refuted', 'Flags']],
      body: dxList.map((dx, i) => [
        i + 1,
        dx.diagnosis,
        dx.likelihood || '',
        dx.kg_support || '',
        dx.kg_score != null ? `${(dx.kg_score * 100).toFixed(0)}%` : '',
        dx.true_count || 0,
        dx.false_count || 0,
        dx.critical_flags?.join('; ') || '-',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [55, 48, 163], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 255] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 40 },
        4: { cellWidth: 15 },
        5: { cellWidth: 14 },
        6: { cellWidth: 14 },
      },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── Triplet details per diagnosis ──
    dxList.forEach((dx, i) => {
      if (!dx.triplets?.length) return;
      checkPage(20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text(`Triplets for #${i + 1}: ${dx.diagnosis}`, margin, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        margin: { left: margin + 4, right: margin },
        head: [['Head', 'Relation', 'Tail', 'Verdict', 'Confidence', 'Note']],
        body: dx.triplets.map(t => [
          t.head || '',
          t.relation || '',
          t.tail || '',
          verdictLabel(t.answer),
          t.confidence || '',
          t.clinical_note || '',
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255 },
      });
      y = doc.lastAutoTable.finalY + 6;
    });
  }

  // ── References ──
  if (result.references?.length > 0) {
    checkPage(20);
    heading('References');
    result.references.forEach((ref, i) => {
      const title = refTitle(ref);
      const url = refUrl(ref);
      bodyText(`[${i + 1}] ${title}${url ? '  ' + url : ''}`);
    });
  }

  // ── STORM article ──
  if (result.storm_article) {
    heading('Deep-Dive Article');
    bodyText(stripMarkdown(result.storm_article));
  }

  // ── P1 raw reasoning ──
  if (result.p1_differential) {
    heading('AI Full Reasoning (P1)');
    bodyText(stripMarkdown(result.p1_differential));
  }

  // ── Latency breakdown ──
  if (result.latency_stages) {
    heading('Pipeline Latency', 10);
    const ls = result.latency_stages;
    const parts = [];
    if (ls.p1_ms) parts.push(`P1: ${fmtMs(ls.p1_ms)}`);
    if (ls.extraction_ms) parts.push(`Extract: ${fmtMs(ls.extraction_ms)}`);
    if (ls.p2_ms) parts.push(`P2: ${fmtMs(ls.p2_ms)}`);
    if (ls.synthesis_ms) parts.push(`Synth: ${fmtMs(ls.synthesis_ms)}`);
    bodyText(parts.join('  |  '));
  }

  // ── Disclaimer ──
  checkPage(20);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  const disclaimer = 'This report is generated by the SECND SDSS v1.0 pipeline using AI analysis and knowledge graph verification. It is intended for informational and research purposes only and is not a confirmatory clinical diagnosis. Do not use for medical emergencies.';
  doc.splitTextToSize(disclaimer, contentW).forEach(line => {
    checkPage(4);
    doc.text(line, margin, y);
    y += 3.5;
  });

  doc.save(`SDSS_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}


// ═══════════════════════════════════════════════════════════════
//  DOCX EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportSdssDOCX(result, mode = 'standard') {
  const { dxList, totalTriplets, verifiedTriplets, hasCritical } = extractReportData(result, mode);

  const children = [];

  // ── Title ──
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'SECND SDSS - Second Opinion Report', bold: true, size: 36, color: '3730A3' })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${mode === 'zebra' ? 'Zebra Mode' : 'Standard'} Analysis  |  ${new Date().toLocaleDateString()}  |  Duration: ${fmtMs(result.total_ms || result.total_latency_ms)}`, size: 20, color: '6B7280' })],
      spacing: { after: 200 },
    }),
  );

  // ── Critical flag ──
  if (hasCritical) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'CRITICAL SAFETY FLAG DETECTED - Immediate clinical attention required', bold: true, size: 24, color: 'DC2626' })],
      spacing: { before: 100, after: 200 },
      shading: { type: 'clear', fill: 'FEE2E2' },
    }));
  }

  // ── Top diagnosis ──
  if (result.top_diagnosis) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'Top KG-Verified Diagnosis', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
      new Paragraph({ children: [new TextRun({ text: result.top_diagnosis, bold: true, size: 28, color: '3730A3' })], spacing: { after: 200 } }),
    );
  }

  // ── Summary ──
  children.push(
    new Paragraph({ children: [new TextRun({ text: 'Summary', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ children: [new TextRun({ text: `Hypotheses: ${dxList.length}  |  KG Triplets: ${totalTriplets} (${totalTriplets ? ((verifiedTriplets / totalTriplets) * 100).toFixed(0) : 0}% verified)`, size: 20 })], spacing: { after: 100 } }),
  );
  if (result.evidence_count != null) children.push(new Paragraph({ children: [new TextRun({ text: `Evidence items: ${result.evidence_count}`, size: 20 })] }));
  if (result.hallucination_issues != null) children.push(new Paragraph({ children: [new TextRun({ text: `Hallucination flags: ${result.hallucination_issues}`, size: 20 })], spacing: { after: 200 } }));

  // ── Patient ──
  if (result.patient && Object.keys(result.patient).length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Patient Demographics', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    Object.entries(result.patient).forEach(([k, v]) => {
      if (v) children.push(new Paragraph({ children: [new TextRun({ text: `${k.replace(/_/g, ' ')}: `, bold: true, size: 20 }), new TextRun({ text: String(v), size: 20 })], spacing: { after: 40 } }));
    });
  }

  if (result.temporal_events?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Timeline', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    result.temporal_events.forEach(evt => {
      children.push(new Paragraph({ children: [new TextRun({ text: `- ${typeof evt === 'string' ? evt : JSON.stringify(evt)}`, size: 20 })], spacing: { after: 40 } }));
    });
  }

  if (result.investigations_performed?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Investigations Performed', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: result.investigations_performed.map(inv => typeof inv === 'string' ? inv : JSON.stringify(inv)).join(', '), size: 20 })], spacing: { after: 200 } }));
  }

  // ── Synthesis ──
  if (result.synthesis) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Reconciled Second Opinion', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    stripMarkdown(result.synthesis).split('\n').filter(Boolean).forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 20 })], spacing: { after: 80 } }));
    });
  }

  // ── Differential table ──
  if (dxList.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'KG-Verified Differential Diagnosis', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));

    const headerCells = ['#', 'Diagnosis', 'Likelihood', 'KG Support', 'Score', 'Verified', 'Refuted'].map(h =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
        shading: { fill: '3730A3' },
        width: { size: h === 'Diagnosis' ? 30 : h === 'KG Support' ? 18 : 8, type: WidthType.PERCENTAGE },
      })
    );

    const dataRows = dxList.map((dx, i) =>
      new TableRow({
        children: [
          String(i + 1),
          dx.diagnosis || '',
          dx.likelihood || '',
          dx.kg_support || '',
          dx.kg_score != null ? `${(dx.kg_score * 100).toFixed(0)}%` : '',
          String(dx.true_count || 0),
          String(dx.false_count || 0),
        ].map((val, ci) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: val, size: 18 })], alignment: ci === 0 ? AlignmentType.CENTER : AlignmentType.LEFT })],
            shading: i % 2 === 1 ? { fill: 'F5F5FF' } : undefined,
          })
        ),
      })
    );

    children.push(new Table({
      rows: [new TableRow({ children: headerCells }), ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));

    // Triplets detail
    dxList.forEach((dx, i) => {
      if (!dx.triplets?.length) return;
      children.push(new Paragraph({ children: [new TextRun({ text: `Triplets for #${i + 1}: ${dx.diagnosis}`, bold: true, size: 22 })], spacing: { before: 200, after: 100 } }));
      dx.triplets.forEach(t => {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${t.head || ''} `, bold: true, size: 18 }),
            new TextRun({ text: `--[${t.relation || ''}]--> `, italics: true, size: 18, color: '6B7280' }),
            new TextRun({ text: `${t.tail || ''}  `, bold: true, size: 18 }),
            new TextRun({ text: `[${verdictLabel(t.answer)}]`, size: 18, color: verdictLabel(t.answer) === 'Verified' ? '16A34A' : verdictLabel(t.answer) === 'Refuted' ? 'DC2626' : 'D97706' }),
            ...(t.clinical_note ? [new TextRun({ text: `  ${t.clinical_note}`, italics: true, size: 16, color: '9CA3AF' })] : []),
          ],
          spacing: { after: 40 },
        }));
      });
    });
  }

  // ── References ──
  if (result.references?.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'References', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    result.references.forEach((ref, i) => {
      const title = refTitle(ref);
      const url = refUrl(ref);
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `[${i + 1}] ${title}`, size: 18 }),
          ...(url ? [new TextRun({ text: `  ${url}`, size: 16, color: '4F46E5', italics: true })] : []),
        ],
        spacing: { after: 60 },
      }));
    });
  }

  // ── STORM article ──
  if (result.storm_article) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Deep-Dive Article', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    stripMarkdown(result.storm_article).split('\n').filter(Boolean).forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 20 })], spacing: { after: 80 } }));
    });
  }

  // ── P1 ──
  if (result.p1_differential) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'AI Full Reasoning (P1)', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }));
    stripMarkdown(result.p1_differential).split('\n').filter(Boolean).forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 20 })], spacing: { after: 80 } }));
    });
  }

  // ── Disclaimer ──
  children.push(
    new Paragraph({ children: [], spacing: { before: 300 } }),
    new Paragraph({
      children: [new TextRun({ text: 'Disclaimer: This report is generated by the SECND SDSS v1.0 pipeline using AI analysis and knowledge graph verification. It is intended for informational and research purposes only and is not a confirmatory clinical diagnosis. Do not use for medical emergencies.', italics: true, size: 16, color: '9CA3AF' })],
      shading: { type: 'clear', fill: 'F3F4F6' },
    }),
  );

  const doc = new Document({
    sections: [{ children }],
    creator: 'SECND SDSS',
    title: 'SDSS Second Opinion Report',
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `SDSS_Report_${new Date().toISOString().slice(0, 10)}.docx`);
}


// ═══════════════════════════════════════════════════════════════
//  HTML EXPORT
// ═══════════════════════════════════════════════════════════════

export function exportSdssHTML(result, mode = 'standard') {
  const { dxList, totalTriplets, verifiedTriplets, hasCritical } = extractReportData(result, mode);

  const likelihoodColor = { high: '#16a34a', moderate: '#d97706', low: '#6b7280', 'must-exclude': '#dc2626' };
  const kgColor = { 'Strongly Supported': '#16a34a', 'Partially Supported': '#d97706', 'Structurally Questioned': '#dc2626', 'Not Found in KG': '#9ca3af' };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SDSS Second Opinion Report</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #1f2937; line-height: 1.6; }
  h1 { color: #3730a3; border-bottom: 3px solid #3730a3; padding-bottom: 8px; }
  h2 { color: #374151; margin-top: 32px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .critical { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px; color: #dc2626; font-weight: bold; font-size: 16px; margin: 16px 0; }
  .top-dx { background: #eef2ff; border-radius: 8px; padding: 16px; margin: 16px 0; }
  .top-dx .label { font-size: 11px; text-transform: uppercase; color: #6366f1; letter-spacing: 1px; }
  .top-dx .name { font-size: 22px; font-weight: bold; color: #3730a3; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
  .stat-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
  .stat-card .value { font-size: 24px; font-weight: bold; color: #111827; }
  .stat-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #3730a3; color: white; padding: 8px 10px; text-align: left; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .triplet { display: flex; align-items: center; gap: 6px; padding: 6px 8px; margin: 4px 0; border-radius: 6px; font-size: 12px; flex-wrap: wrap; }
  .triplet.verified { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .triplet.refuted { background: #fef2f2; border: 1px solid #fecaca; }
  .triplet.unknown { background: #fefce8; border: 1px solid #fde68a; }
  .entity { background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px; }
  .relation { color: #6b7280; font-style: italic; font-size: 11px; }
  .ref-list { counter-reset: ref; list-style: none; padding: 0; }
  .ref-list li { counter-increment: ref; padding: 4px 0; font-size: 13px; }
  .ref-list li::before { content: "[" counter(ref) "] "; font-weight: bold; color: #6366f1; }
  .ref-list a { color: #4f46e5; }
  .disclaimer { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; font-size: 12px; color: #6b7280; margin-top: 32px; font-style: italic; }
  .section-content { white-space: pre-wrap; }
  @media print { body { max-width: none; } }
</style>
</head>
<body>
<h1>SECND SDSS - Second Opinion Report</h1>
<p style="color:#6b7280">${mode === 'zebra' ? 'Zebra Mode' : 'Standard'} Analysis &nbsp;|&nbsp; ${new Date().toLocaleDateString()} &nbsp;|&nbsp; Duration: ${fmtMs(result.total_ms || result.total_latency_ms)}</p>
`;

  if (hasCritical) {
    html += `<div class="critical">CRITICAL SAFETY FLAG DETECTED &mdash; Immediate clinical attention required</div>\n`;
  }

  if (result.top_diagnosis) {
    html += `<div class="top-dx"><div class="label">Top KG-Verified Diagnosis</div><div class="name">${result.top_diagnosis}</div></div>\n`;
  }

  // Summary grid
  html += `<div class="summary-grid">
  <div class="stat-card"><div class="value">${dxList.length}</div><div class="label">Hypotheses</div></div>
  <div class="stat-card"><div class="value">${totalTriplets}</div><div class="label">KG Triplets (${totalTriplets ? ((verifiedTriplets / totalTriplets) * 100).toFixed(0) : 0}% verified)</div></div>
  <div class="stat-card"><div class="value">${result.evidence_count ?? '-'}</div><div class="label">Evidence Items</div></div>
</div>\n`;

  // Patient context
  if (result.patient && Object.keys(result.patient).length > 0) {
    html += `<h2>Patient Demographics</h2>\n`;
    Object.entries(result.patient).forEach(([k, v]) => {
      if (v) html += `<p><strong>${k.replace(/_/g, ' ')}:</strong> ${String(v)}</p>\n`;
    });
  }

  if (result.temporal_events?.length > 0) {
    html += `<h2>Timeline</h2><ul>\n`;
    result.temporal_events.forEach(evt => { html += `<li>${typeof evt === 'string' ? evt : JSON.stringify(evt)}</li>\n`; });
    html += `</ul>\n`;
  }

  if (result.investigations_performed?.length > 0) {
    html += `<h2>Investigations</h2><p>${result.investigations_performed.map(inv => `<span class="badge" style="background:#f0fdfa;color:#0d9488;margin:2px">${typeof inv === 'string' ? inv : JSON.stringify(inv)}</span>`).join(' ')}</p>\n`;
  }

  // Synthesis
  if (result.synthesis) {
    html += `<h2>Reconciled Second Opinion</h2>\n<div class="section-content">${stripMarkdown(result.synthesis)}</div>\n`;
  }

  // Differential table
  if (dxList.length > 0) {
    html += `<h2>KG-Verified Differential Diagnosis</h2>
<table>
<tr><th>#</th><th>Diagnosis</th><th>Likelihood</th><th>KG Support</th><th>KG Score</th><th>Verified</th><th>Refuted</th></tr>\n`;
    dxList.forEach((dx, i) => {
      const lc = likelihoodColor[dx.likelihood] || '#6b7280';
      const kc = kgColor[dx.kg_support] || '#9ca3af';
      html += `<tr>
  <td>${i + 1}</td>
  <td><strong>${dx.diagnosis}</strong>${dx.critical_flags?.length ? ' <span class="badge" style="background:#dc2626;color:white">CRITICAL</span>' : ''}</td>
  <td><span class="badge" style="background:${lc}20;color:${lc}">${dx.likelihood || ''}</span></td>
  <td><span class="badge" style="background:${kc}20;color:${kc}">${dx.kg_support || ''}</span></td>
  <td>${dx.kg_score != null ? `${(dx.kg_score * 100).toFixed(0)}%` : ''}</td>
  <td>${dx.true_count || 0}</td>
  <td>${dx.false_count || 0}</td>
</tr>\n`;
    });
    html += `</table>\n`;

    // Triplets
    dxList.forEach((dx, i) => {
      if (!dx.triplets?.length) return;
      html += `<h3>Triplets for #${i + 1}: ${dx.diagnosis}</h3>\n`;
      dx.triplets.forEach(t => {
        const v = verdictLabel(t.answer).toLowerCase();
        html += `<div class="triplet ${v}">
  <span class="entity">${t.head || ''}</span>
  <span class="relation">&mdash;[${t.relation || ''}]&rarr;</span>
  <span class="entity">${t.tail || ''}</span>
  <span class="badge" style="background:${v === 'verified' ? '#dcfce7;color:#16a34a' : v === 'refuted' ? '#fee2e2;color:#dc2626' : '#fef9c3;color:#ca8a04'}">${verdictLabel(t.answer)}</span>
  ${t.confidence ? `<span style="font-size:10px;color:#6b7280">${t.confidence}</span>` : ''}
  ${t.clinical_note ? `<div style="width:100%;font-size:11px;color:#9ca3af;font-style:italic;margin-top:2px;padding-left:4px">${t.clinical_note}</div>` : ''}
</div>\n`;
      });
    });
  }

  // References
  if (result.references?.length > 0) {
    html += `<h2>References</h2><ol class="ref-list">\n`;
    result.references.forEach(ref => {
      const title = refTitle(ref);
      const url = refUrl(ref);
      html += `<li>${url ? `<a href="${url}" target="_blank">${title}</a>` : title}</li>\n`;
    });
    html += `</ol>\n`;
  }

  if (result.storm_article) {
    html += `<h2>Deep-Dive Article</h2><div class="section-content">${stripMarkdown(result.storm_article)}</div>\n`;
  }

  if (result.p1_differential) {
    html += `<h2>AI Full Reasoning (P1)</h2><div class="section-content">${stripMarkdown(result.p1_differential)}</div>\n`;
  }

  // Latency
  if (result.latency_stages) {
    const ls = result.latency_stages;
    const parts = [];
    if (ls.p1_ms) parts.push(`P1: ${fmtMs(ls.p1_ms)}`);
    if (ls.extraction_ms) parts.push(`Extract: ${fmtMs(ls.extraction_ms)}`);
    if (ls.p2_ms) parts.push(`P2: ${fmtMs(ls.p2_ms)}`);
    if (ls.synthesis_ms) parts.push(`Synth: ${fmtMs(ls.synthesis_ms)}`);
    html += `<p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:16px">${parts.join(' &nbsp;|&nbsp; ')}</p>\n`;
  }

  html += `<div class="disclaimer">This report is generated by the SECND SDSS v1.0 pipeline using AI analysis and knowledge graph verification. It is intended for informational and research purposes only and is <strong>not</strong> a confirmatory clinical diagnosis. Do not use for medical emergencies.</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  saveAs(blob, `SDSS_Report_${new Date().toISOString().slice(0, 10)}.html`);
}
