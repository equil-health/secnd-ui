/**
 * Shared utilities for SDSS clinical report rendering and export.
 * Used by SecondOpinionPage.jsx (web UI) and sdssExport.js (PDF/DOCX/HTML).
 */


// ── Smart object-to-readable conversion ─────────────────────────

/**
 * Convert a temporal_event or investigation item to readable text.
 * Handles strings, known object shapes, and arbitrary key-value objects.
 * Never returns raw JSON.
 */
export function renderEventItem(item) {
  if (typeof item === 'string') return item;
  if (item == null) return '';
  if (typeof item !== 'object') return String(item);

  const primary = item.event || item.description || item.finding
    || item.name || item.title || item.text || item.summary;
  const date = item.date || item.timestamp || item.time || item.when;
  const detail = item.details || item.detail || item.notes || item.note || item.value;

  if (primary) {
    let text = String(primary);
    if (date) text = `[${date}] ${text}`;
    if (detail) text += ` — ${detail}`;
    return text;
  }

  // Fallback: join all values, excluding internal IDs
  const vals = Object.entries(item)
    .filter(([k]) => !['id', '_id', 'index', 'type'].includes(k))
    .map(([k, v]) => {
      if (v == null || v === '') return null;
      return `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : v}`;
    })
    .filter(Boolean);

  return vals.length > 0 ? vals.join(' | ') : '';
}

/**
 * Parse structured fields from an event object for rich JSX rendering.
 * Returns { primary, date, detail } — all strings or null.
 */
export function parseEventFields(item) {
  if (typeof item === 'string' || item == null || typeof item !== 'object') {
    return { primary: typeof item === 'string' ? item : String(item || ''), date: null, detail: null };
  }

  const primary = item.event || item.description || item.finding
    || item.name || item.title || item.text || item.summary || null;
  const date = item.date || item.timestamp || item.time || item.when || null;
  const detail = item.details || item.detail || item.notes || item.note || item.value || null;

  if (primary) {
    return { primary: String(primary), date: date ? String(date) : null, detail: detail ? String(detail) : null };
  }

  // Fallback to renderEventItem
  return { primary: renderEventItem(item), date: null, detail: null };
}


// ── Executive Verdict extraction ────────────────────────────────

const VERDICT_LEVELS = {
  critical: { label: 'CRITICAL', bg: 'bg-red-600', border: 'border-red-700', text: 'text-white' },
  caution: { label: 'CAUTION', bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white' },
  reassuring: { label: 'REASSURING', bg: 'bg-green-600', border: 'border-green-700', text: 'text-white' },
};

export function classifyVerdictLevel(text) {
  if (!text) return 'caution';
  const lower = text.toLowerCase();
  if (lower.includes('critical') || lower.includes('urgent') || lower.includes('immediate danger')) return 'critical';
  if (lower.includes('reassuring') || lower.includes('benign') || lower.includes('low risk') || lower.includes('no concern')) return 'reassuring';
  return 'caution';
}

/**
 * Extract executive verdict from result with 3-tier fallback.
 * Returns { level, text, support } or null.
 */
export function extractVerdict(result) {
  if (!result) return null;

  // Tier 1: dedicated field
  if (result.executive_verdict) {
    if (typeof result.executive_verdict === 'string') {
      return { level: classifyVerdictLevel(result.executive_verdict), text: result.executive_verdict, support: null };
    }
    return {
      level: result.executive_verdict.level || classifyVerdictLevel(result.executive_verdict.text || ''),
      text: result.executive_verdict.text || result.executive_verdict.summary || '',
      support: result.executive_verdict.support || null,
    };
  }

  // Tier 2: parse from synthesis
  if (result.synthesis) {
    // Try "Executive Verdict:" or "VERDICT:" patterns
    const verdictRegex = /(?:##?\s*)?(?:executive\s+verdict|verdict)\s*[:—\-]\s*(.+?)(?:\n\n|\n##|\n---|\n\*\*|$)/is;
    const match = result.synthesis.match(verdictRegex);
    if (match) {
      const text = match[1].trim().replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
      return { level: classifyVerdictLevel(text), text, support: null };
    }
  }

  // Tier 3: construct from available data
  if (result.top_diagnosis) {
    const level = result.has_critical_flags ? 'critical' : 'caution';
    const topDx = (result.p2_differential || [])[0];
    const support = topDx?.kg_support || null;
    const kgNote = support ? ` — ${support}` : '';
    return { level, text: `${result.top_diagnosis}${kgNote}`, support };
  }

  return null;
}

export { VERDICT_LEVELS };


// ── Knowledge Gaps extraction ───────────────────────────────────

/**
 * Extract knowledge gaps from result.
 * Returns array of { gap, implication }.
 */
export function extractKnowledgeGaps(result) {
  if (!result) return [];

  // Tier 1: dedicated field
  if (Array.isArray(result.knowledge_gaps) && result.knowledge_gaps.length > 0) {
    return result.knowledge_gaps.map(gap => {
      if (typeof gap === 'string') return { gap, implication: '' };
      return {
        gap: gap.gap || gap.description || gap.text || gap.knowledge_gap || '',
        implication: gap.implication || gap.clinical_implication || gap.impact || gap.significance || '',
      };
    });
  }

  // Tier 2: parse from synthesis
  if (result.synthesis) {
    const sectionRegex = /(?:##?\s*(?:Knowledge\s+Gaps?|Gaps?\s+in\s+Evidence|Information\s+Gaps?|Diagnostic\s+Gaps?))\s*\n([\s\S]*?)(?=\n##?\s|\n---|\n\*\*\d|$)/i;
    const sectionMatch = result.synthesis.match(sectionRegex);
    if (sectionMatch) {
      const bullets = sectionMatch[1].match(/[-*]\s+(.+)/g);
      if (bullets && bullets.length > 0) {
        return bullets.map(b => {
          const text = b.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim();
          // Split on common delimiters
          const delimMatch = text.match(/^(.+?)\s*[:—\-–]\s+(.+)$/);
          if (delimMatch) {
            return { gap: delimMatch[1].trim(), implication: delimMatch[2].trim() };
          }
          return { gap: text, implication: '' };
        });
      }
    }
  }

  return [];
}


// ── Clinical Recommendations extraction ─────────────────────────

const PRIORITY_ORDER = { IMMEDIATE: 0, HIGH: 1, MODERATE: 2, MONITOR: 3 };

export function classifyPriority(text) {
  if (!text) return 'MODERATE';
  const lower = text.toLowerCase();
  if (lower.includes('immediate') || lower.includes('urgent') || lower.includes('stat')
    || lower.includes('emergency') || lower.includes('must rule out')) return 'IMMEDIATE';
  if (lower.includes('high') || lower.includes('within 24') || lower.includes('today')
    || lower.includes('priority')) return 'HIGH';
  if (lower.includes('monitor') || lower.includes('follow-up') || lower.includes('follow up')
    || lower.includes('routine') || lower.includes('long-term') || lower.includes('serial')) return 'MONITOR';
  return 'MODERATE';
}

/**
 * Extract clinical recommendations from result.
 * Returns sorted array of { priority, action }.
 */
export function extractRecommendations(result) {
  if (!result) return [];

  let recs = [];

  // Tier 1: dedicated field
  if (Array.isArray(result.clinical_recommendations) && result.clinical_recommendations.length > 0) {
    recs = result.clinical_recommendations.map(rec => {
      if (typeof rec === 'string') return { priority: classifyPriority(rec), action: rec };
      return {
        priority: rec.priority?.toUpperCase() || classifyPriority(rec.action || rec.recommendation || ''),
        action: rec.action || rec.recommendation || rec.text || rec.description || '',
      };
    });
  }

  // Tier 2: parse from synthesis
  if (recs.length === 0 && result.synthesis) {
    const sectionRegex = /(?:##?\s*(?:Clinical\s+)?Recommendations?)\s*\n([\s\S]*?)(?=\n##?\s|\n---|\n\*\*\d|$)/i;
    const sectionMatch = result.synthesis.match(sectionRegex);
    if (sectionMatch) {
      const bullets = sectionMatch[1].match(/(?:[-*]|\d+[.)]\s)\s*(.+)/g);
      if (bullets && bullets.length > 0) {
        recs = bullets.map(b => {
          const text = b.replace(/^(?:[-*]|\d+[.)]\s)\s*/, '').replace(/\*\*/g, '').trim();
          return { priority: classifyPriority(text), action: text };
        });
      }
    }
  }

  // Sort by priority
  recs.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  return recs;
}

export { PRIORITY_ORDER };


// ── Priority badge colors (for JSX and HTML export) ─────────────

export const PRIORITY_COLORS = {
  IMMEDIATE: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', hex: '#dc2626', hexBg: '#fee2e2' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', hex: '#ea580c', hexBg: '#ffedd5' },
  MODERATE: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', hex: '#2563eb', hexBg: '#dbeafe' },
  MONITOR: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', hex: '#6b7280', hexBg: '#f3f4f6' },
};
