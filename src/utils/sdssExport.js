import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } from 'docx';
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
      bodyText(`- ${typeof evt === 'string' ? evt : JSON.stringify(evt)}`, 4);
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
    bodyText(result.investigations_performed.map(inv => typeof inv === 'string' ? inv : JSON.stringify(inv)).join('  |  '), 4);
    y += 2;
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

  // ── Clinical Analysis (synthesis) ──
  if (result.synthesis) {
    sectionTitle('Clinical Analysis');
    const synLines = stripMarkdown(result.synthesis).split('\n').filter(Boolean);
    synLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      // Detect sub-headings (lines that are all caps or numbered)
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

  // ── Differential Diagnosis ──
  if (dxList.length > 0) {
    sectionTitle('Differential Diagnosis');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120, 120, 120);
    doc.text('Ranked by likelihood given the full clinical picture:', margin, y);
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

      // Likelihood badge
      const likeText = dx.likelihood?.replace('-', ' ') || '';
      if (likeText) {
        const badgeX = margin + 12 + doc.getTextWidth(dx.diagnosis || '') + 4;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const likeColor = dx.likelihood === 'high' ? [22, 163, 74] : dx.likelihood === 'must-exclude' ? [220, 38, 38] : dx.likelihood === 'moderate' ? [217, 119, 6] : [107, 114, 128];
        doc.setTextColor(...likeColor);
        doc.text(`[${likeText}]`, badgeX, y + 1);
      }
      y += 8;

      // Supporting/against counts
      if (dx.true_count != null) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`Confidence: ${dx.kg_score != null ? (dx.kg_score * 100).toFixed(0) + '%' : '-'}  |  ${dx.true_count} supporting  /  ${dx.false_count || 0} against`, margin + 12, y);
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

      // Supporting evidence bullets
      const verified = dx.triplets?.filter(t => isVerified(t.answer)) || [];
      const refuted = dx.triplets?.filter(t => isRefuted(t.answer)) || [];

      if (verified.length > 0) {
        checkPage(8);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 163, 74);
        doc.text(`Supporting Evidence (${verified.length}):`, margin + 12, y);
        y += 4;
        verified.slice(0, 5).forEach(t => {
          checkPage(5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          doc.setFontSize(8);
          const text = `+ ${t.head} ${t.relation?.replace(/_/g, ' ')} ${t.tail}`;
          doc.text(text, margin + 16, y);
          y += 3.5;
        });
        if (verified.length > 5) {
          doc.setTextColor(120, 120, 120);
          doc.text(`... and ${verified.length - 5} more`, margin + 16, y);
          y += 3.5;
        }
      }

      if (refuted.length > 0) {
        checkPage(8);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        doc.text(`Against (${refuted.length}):`, margin + 12, y);
        y += 4;
        refuted.slice(0, 3).forEach(t => {
          checkPage(5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          doc.setFontSize(8);
          doc.text(`- ${t.head} ${t.relation?.replace(/_/g, ' ')} ${t.tail}`, margin + 16, y);
          y += 3.5;
        });
      }

      y += 5;
    });
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

  // ── Deep-dive & P1 (if present) ──
  if (result.storm_article) {
    sectionTitle('Literature Deep-Dive');
    bodyText(stripMarkdown(result.storm_article));
    y += 4;
  }

  if (result.p1_differential) {
    sectionTitle('Full AI Reasoning');
    bodyText(stripMarkdown(result.p1_differential));
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
      children.push(new Paragraph({ children: [new TextRun({ text: `- ${typeof evt === 'string' ? evt : JSON.stringify(evt)}`, size: 20 })], spacing: { after: 30 } }));
    });
  }

  if (result.investigations_performed?.length > 0) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'INVESTIGATIONS    ', bold: true, size: 18, color: '6B7280' }),
        new TextRun({ text: result.investigations_performed.map(inv => typeof inv === 'string' ? inv : JSON.stringify(inv)).join('  |  '), size: 20 }),
      ],
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

  // ── Clinical Analysis ──
  if (result.synthesis) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Clinical Analysis', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
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

  // ── Differential ──
  if (dxList.length > 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Differential Diagnosis', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Ranked by likelihood given the full clinical picture:', italics: true, size: 18, color: '6B7280' })], spacing: { after: 100 } }));

    dxList.forEach((dx, i) => {
      const isCritical = dx.critical_flags?.length > 0;
      const likeColor = dx.likelihood === 'high' ? '16A34A' : dx.likelihood === 'must-exclude' ? 'DC2626' : dx.likelihood === 'moderate' ? 'D97706' : '6B7280';

      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}  `, bold: true, size: 24, color: '3730A3' }),
          new TextRun({ text: dx.diagnosis || '', bold: true, size: 24 }),
          new TextRun({ text: `  [${dx.likelihood?.replace('-', ' ') || ''}]`, bold: true, size: 18, color: likeColor }),
          ...(isCritical ? [new TextRun({ text: '  CRITICAL', bold: true, size: 16, color: 'DC2626' })] : []),
        ],
        spacing: { before: 120, after: 40 },
      }));

      if (dx.true_count != null) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Confidence: ${dx.kg_score != null ? (dx.kg_score * 100).toFixed(0) + '%' : '-'}  |  ${dx.true_count} supporting  /  ${dx.false_count || 0} against`, size: 16, color: '9CA3AF' })],
          spacing: { after: 40 },
        }));
      }

      if (isCritical) {
        dx.critical_flags.forEach(flag => {
          children.push(new Paragraph({ children: [new TextRun({ text: `! ${flag}`, bold: true, size: 18, color: 'DC2626' })], spacing: { after: 20 } }));
        });
      }

      // Evidence
      const verified = dx.triplets?.filter(t => isVerified(t.answer)) || [];
      const refuted = dx.triplets?.filter(t => isRefuted(t.answer)) || [];

      if (verified.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: `Supporting Evidence (${verified.length}):`, bold: true, size: 16, color: '16A34A' })], spacing: { before: 40, after: 20 } }));
        verified.slice(0, 5).forEach(t => {
          children.push(new Paragraph({ children: [new TextRun({ text: `+ ${t.head} ${t.relation?.replace(/_/g, ' ')} ${t.tail}`, size: 16 })], spacing: { after: 10 } }));
        });
      }

      if (refuted.length > 0) {
        children.push(new Paragraph({ children: [new TextRun({ text: `Against (${refuted.length}):`, bold: true, size: 16, color: 'DC2626' })], spacing: { before: 40, after: 20 } }));
        refuted.slice(0, 3).forEach(t => {
          children.push(new Paragraph({ children: [new TextRun({ text: `- ${t.head} ${t.relation?.replace(/_/g, ' ')} ${t.tail}`, size: 16 })], spacing: { after: 10 } }));
        });
      }
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

  // ── Deep-dive & P1 ──
  if (result.storm_article) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Literature Deep-Dive', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } }));
    stripMarkdown(result.storm_article).split('\n').filter(Boolean).forEach(line => {
      children.push(new Paragraph({ children: [new TextRun({ text: line.trim(), size: 20 })], spacing: { after: 60 } }));
    });
  }

  if (result.p1_differential) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Full AI Reasoning', bold: true, size: 26 })], heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } }));
    stripMarkdown(result.p1_differential).split('\n').filter(Boolean).forEach(line => {
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
        html += `<div class="timeline-item"><div class="timeline-dot"></div><div>${typeof evt === 'string' ? evt : JSON.stringify(evt)}</div></div>`;
      });
      html += `</div>`;
    }

    if (result.investigations_performed?.length > 0) {
      html += `<div style="margin-top:16px"><div class="kv-label" style="margin-bottom:8px">Investigations</div><div>`;
      result.investigations_performed.forEach(inv => {
        html += `<span class="inv-tag">${typeof inv === 'string' ? inv : JSON.stringify(inv)}</span>`;
      });
      html += `</div></div>`;
    }
    html += `</div>`;
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

  // Clinical Analysis
  if (result.synthesis) {
    html += `<div class="section"><h2>Clinical Analysis</h2><div class="synthesis">${stripMarkdown(result.synthesis)}</div></div>`;
  }

  // Differential
  if (dxList.length > 0) {
    html += `<div class="section"><h2>Differential Diagnosis</h2><p style="font-size:12px;color:#6b7280;margin-bottom:16px;font-style:italic">Ranked by likelihood given the full clinical picture</p>`;
    dxList.forEach((dx, i) => {
      const isCritical = dx.critical_flags?.length > 0;
      const cardClass = isCritical ? 'critical' : (dx.likelihood || '');
      html += `<div class="dx-card ${cardClass}"><div class="dx-header">`;
      html += `<div class="dx-rank ${isCritical ? 'critical' : ''}">${i + 1}</div>`;
      html += `<div><div class="dx-name">${dx.diagnosis} <span class="badge ${dx.likelihood || ''}">${dx.likelihood?.replace('-', ' ') || ''}</span>`;
      if (isCritical) html += ` <span class="badge critical-flag">CRITICAL</span>`;
      html += `</div>`;
      html += `<div class="dx-meta">Confidence: ${dx.kg_score != null ? (dx.kg_score * 100).toFixed(0) + '%' : '-'} &nbsp;|&nbsp; ${dx.true_count || 0} supporting / ${dx.false_count || 0} against</div>`;

      if (isCritical) {
        dx.critical_flags.forEach(flag => { html += `<p style="color:#dc2626;font-size:12px;font-weight:600;margin-top:4px">! ${flag}</p>`; });
      }

      const verified = dx.triplets?.filter(t => isVerified(t.answer)) || [];
      const refuted = dx.triplets?.filter(t => isRefuted(t.answer)) || [];

      if (verified.length > 0) {
        html += `<div class="evidence-group supporting"><h4>Supporting Evidence (${verified.length})</h4>`;
        verified.slice(0, 5).forEach(t => {
          html += `<div class="evidence-item supporting">+ ${t.head} <em style="color:#6b7280">${t.relation?.replace(/_/g, ' ')}</em> ${t.tail}</div>`;
        });
        if (verified.length > 5) html += `<div style="font-size:11px;color:#9ca3af;margin-top:4px">... and ${verified.length - 5} more</div>`;
        html += `</div>`;
      }
      if (refuted.length > 0) {
        html += `<div class="evidence-group against"><h4>Against (${refuted.length})</h4>`;
        refuted.slice(0, 3).forEach(t => {
          html += `<div class="evidence-item against">- ${t.head} <em style="color:#6b7280">${t.relation?.replace(/_/g, ' ')}</em> ${t.tail}</div>`;
        });
        html += `</div>`;
      }

      html += `</div></div></div>`;
    });
    html += `</div>`;
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

  // Deep-dive & P1
  if (result.storm_article) {
    html += `<div class="section"><h2>Literature Deep-Dive</h2><div class="synthesis">${stripMarkdown(result.storm_article)}</div></div>`;
  }
  if (result.p1_differential) {
    html += `<div class="section"><h2>Full AI Reasoning</h2><div class="synthesis">${stripMarkdown(result.p1_differential)}</div></div>`;
  }

  html += `</div>
<div class="footer">${DISCLAIMER}</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  saveAs(blob, `SDSS_Report_${new Date().toISOString().slice(0, 10)}.html`);
}
