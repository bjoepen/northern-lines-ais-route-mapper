import {
  AisPoint,
  AnchorageStop,
  PointProvenance,
  TrackSourceFormat,
  TimestampProvenance,
  VoyageData,
  VoyageMetadata,
} from '../types';
import { normalizeImportText, parseAisCsv, parseGpx } from '../import/normalizeImport';
import { calculateBearing, calculateDistanceNM } from './geoUtils';

export { parseAisCsv, parseGpx } from '../import/normalizeImport';

type TrackPointInput = Omit<AisPoint, 'layer' | 'provenance'> & {
  layer?: AisPoint['layer'];
  provenance?: PointProvenance;
};

function provenance(
  sourceFormat: TrackSourceFormat,
  timestamp: TimestampProvenance,
  sourceIndex?: number,
): PointProvenance {
  return { sourceFormat, timestamp, sourceIndex };
}

export function parseAisData(rawText: string, metadata?: Partial<VoyageMetadata>): VoyageData {
  const normalized = normalizeImportText(rawText);
  const voyage = processVoyagePoints(normalized.points, metadata);
  return {
    ...voyage,
    importNormalization: normalized.summary,
  };
}

function normalizeRawPoint(point: TrackPointInput, index: number): AisPoint {
  const {
    distanceFromStartNM: _distance,
    elapsedSeconds: _elapsed,
    derivedCog: _derivedCog,
    derivedSog: _derivedSog,
    ...source
  } = point;

  return {
    ...source,
    id: point.id || `raw-${index}`,
    timestamp: new Date(point.timestamp),
    layer: 'raw',
    provenance: point.provenance ?? provenance('unknown', 'unknown', index),
  };
}

export function processVoyagePoints(
  rawInput: TrackPointInput[],
  metadataOverride?: Partial<VoyageMetadata>,
): VoyageData {
  const rawPoints = rawInput.map(normalizeRawPoint);
  const observedMmsi = [
    ...new Set(rawPoints.map((point) => point.mmsi).filter((mmsi): mmsi is string => Boolean(mmsi))),
  ];
  const primaryMmsi = metadataOverride?.mmsi ?? (observedMmsi.length === 1 ? observedMmsi[0] : undefined);

  if (rawPoints.length === 0) {
    return {
      metadata: {
        title: metadataOverride?.title || 'Unbenannter Track',
        vesselName: metadataOverride?.vesselName || 'Unbekanntes Schiff',
        ...metadataOverride,
      },
      rawPoints: [],
      points: [],
      trackContract: {
        version: '0.2.0',
        rawPointCount: 0,
        canonicalPointCount: 0,
        sourceFormats: [],
        timestampProvenance: [],
        observedMmsi: [],
        mixedMmsi: false,
      },
      totalDistanceNM: 0,
      avgSpeedKnots: 0,
      maxSpeedKnots: 0,
      durationSeconds: 0,
      startTime: null,
      endTime: null,
      anchorages: [],
      bounds: { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 },
    };
  }

  const sorted = [...rawPoints].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let totalDistNM = 0;
  let maxSog = 0;
  let speedSum = 0;
  let speedCount = 0;
  const processedPoints: AisPoint[] = [];
  const startEpoch = sorted[0].timestamp.getTime();

  for (let index = 0; index < sorted.length; index++) {
    const source = sorted[index];
    let sog = source.sog;
    let cog = source.cog;
    let derivedSog = false;
    let derivedCog = false;

    if (index > 0) {
      const previous = processedPoints[index - 1];
      const distance = calculateDistanceNM(previous.lat, previous.lon, source.lat, source.lon);
      totalDistNM += distance;
      const deltaHours = (source.timestamp.getTime() - previous.timestamp.getTime()) / 3_600_000;

      if ((sog === undefined || Number.isNaN(sog)) && deltaHours > 0) {
        sog = Math.min(distance / deltaHours, 45);
        derivedSog = true;
      }
      if (cog === undefined || Number.isNaN(cog)) {
        cog = calculateBearing(previous.lat, previous.lon, source.lat, source.lon);
        derivedCog = true;
      }
    }

    if (sog !== undefined && !Number.isNaN(sog)) {
      maxSog = Math.max(maxSog, sog);
      speedSum += sog;
      speedCount++;
    }

    processedPoints.push({
      ...source,
      id: `canonical-${source.id}`,
      layer: 'canonical',
      sog: sog !== undefined ? Math.round(sog * 10) / 10 : undefined,
      cog: cog !== undefined ? Math.round(cog) : undefined,
      derivedSog,
      derivedCog,
      distanceFromStartNM: Math.round(totalDistNM * 100) / 100,
      elapsedSeconds: Math.round((source.timestamp.getTime() - startEpoch) / 1000),
    });
  }

  const anchorages: AnchorageStop[] = [];
  let stopStart: AisPoint | null = null;

  for (const point of processedPoints) {
    const status = point.navStatus?.toLowerCase() || '';
    const isSlow = (point.sog ?? 0) < 0.6 || status.includes('anker') || status.includes('fest');

    if (isSlow && !stopStart) stopStart = point;
    if (!isSlow && stopStart) {
      const durationMinutes = (point.timestamp.getTime() - stopStart.timestamp.getTime()) / 60_000;
      if (durationMinutes >= 25) {
        anchorages.push({
          id: `anchorage-${anchorages.length + 1}`,
          name: `Liegeplatz / Ankerplatz #${anchorages.length + 1}`,
          startPoint: stopStart,
          endPoint: point,
          lat: stopStart.lat,
          lon: stopStart.lon,
          durationMinutes: Math.round(durationMinutes),
        });
      }
      stopStart = null;
    }
  }

  const startTime = processedPoints[0]?.timestamp || null;
  const endTime = processedPoints.at(-1)?.timestamp || null;
  const durationSeconds = startTime && endTime
    ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
    : 0;
  const sourceFormats = [...new Set(rawPoints.map((point) => point.provenance.sourceFormat))];
  const timestampProvenance = [...new Set(rawPoints.map((point) => point.provenance.timestamp))];

  return {
    metadata: {
      title: metadataOverride?.title || 'Importierter AIS Track',
      vesselName: metadataOverride?.vesselName || (primaryMmsi ? `AIS ${primaryMmsi}` : 'Unbekanntes Schiff'),
      mmsi: primaryMmsi,
      callsign: metadataOverride?.callsign,
      skipper: metadataOverride?.skipper,
      vesselType: metadataOverride?.vesselType,
      notes: metadataOverride?.notes,
    },
    rawPoints,
    points: processedPoints,
    trackContract: {
      version: '0.2.0',
      rawPointCount: rawPoints.length,
      canonicalPointCount: processedPoints.length,
      sourceFormats,
      timestampProvenance,
      primaryMmsi,
      observedMmsi,
      mixedMmsi: observedMmsi.length > 1,
    },
    totalDistanceNM: Math.round(totalDistNM * 10) / 10,
    avgSpeedKnots: speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : 0,
    maxSpeedKnots: Math.round(maxSog * 10) / 10,
    durationSeconds,
    startTime,
    endTime,
    anchorages,
    bounds: {
      minLat: Math.min(...processedPoints.map((point) => point.lat)),
      maxLat: Math.max(...processedPoints.map((point) => point.lat)),
      minLon: Math.min(...processedPoints.map((point) => point.lon)),
      maxLon: Math.max(...processedPoints.map((point) => point.lon)),
    },
  };
}
