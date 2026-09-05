import {
  JourneyQualityIssue,
  JourneyQualityReport,
  JourneyQualityState,
  JourneyQualityStatus,
} from '../types';

function asDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function asFiniteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeStatus(value: unknown): JourneyQualityStatus {
  const status = String(value ?? '').toLowerCase();
  if (status === 'pass' || status === 'warn' || status === 'fail') return status;
  return 'unknown';
}

function normalizeSeverity(value: unknown): JourneyQualityIssue['severity'] {
  const severity = String(value ?? '').toLowerCase();
  if (severity === 'fail' || severity === 'error') return 'fail';
  if (severity === 'warn' || severity === 'warning') return 'warn';
  return 'info';
}

function normalizeIssue(value: unknown): JourneyQualityIssue | null {
  if (!value || typeof value !== 'object') return null;
  const issue = value as Record<string, unknown>;
  const code = String(issue.code ?? issue.type ?? '').trim();
  if (!code) return null;

  return {
    code,
    severity: normalizeSeverity(issue.severity),
    message: issue.message !== undefined ? String(issue.message) : undefined,
    pointId: issue.pointId !== undefined ? String(issue.pointId) : undefined,
    fromPointId: issue.fromPointId !== undefined ? String(issue.fromPointId) : undefined,
    toPointId: issue.toPointId !== undefined ? String(issue.toPointId) : undefined,
    observedAt: asDate(issue.observedAt),
    details: issue.details && typeof issue.details === 'object'
      ? issue.details as Record<string, unknown>
      : undefined,
  };
}

/**
 * Accepts an upstream Tracker QA payload and normalizes naming differences only.
 * No geometric, land-mask or plausibility analysis is performed here.
 */
export function parseJourneyQualityReport(value: unknown): JourneyQualityReport | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const rawIssues = Array.isArray(input.issues) ? input.issues : [];
  const issues = rawIssues.map(normalizeIssue).filter((issue): issue is JourneyQualityIssue => issue !== null);

  return {
    contractVersion: '0.4.0',
    status: normalizeStatus(input.status ?? input.verdict),
    analyzer: input.analyzer !== undefined ? String(input.analyzer) : undefined,
    analyzerVersion: input.analyzerVersion !== undefined ? String(input.analyzerVersion) : undefined,
    analyzedAt: asDate(input.analyzedAt),
    journeyId: input.journeyId !== undefined ? String(input.journeyId) : undefined,
    mmsi: input.mmsi !== undefined ? String(input.mmsi) : undefined,
    pointCount: asFiniteNumber(input.pointCount),
    trollCrossings: asFiniteNumber(input.trollCrossings),
    gaps: asFiniteNumber(input.gaps),
    issues,
  };
}

export function evaluateJourneyQuality(report?: JourneyQualityReport): JourneyQualityState {
  if (!report) {
    return {
      supplied: false,
      editorialReady: false,
      reason: 'Kein Tracker-QA-Bericht vorhanden.',
    };
  }

  if (report.status !== 'pass') {
    return {
      supplied: true,
      report,
      editorialReady: false,
      reason: report.status === 'fail'
        ? 'Tracker QA meldet FAIL.'
        : report.status === 'warn'
          ? 'Tracker QA meldet WARN; redaktionelle Freigabe erforderlich.'
          : 'Tracker-QA-Status ist unbekannt.',
    };
  }

  return {
    supplied: true,
    report,
    editorialReady: true,
  };
}
