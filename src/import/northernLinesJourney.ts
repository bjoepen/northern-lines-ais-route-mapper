import {
  AisPoint,
  ImportNormalizationSummary,
  TrackGap,
  TrackSegment,
  VoyageData,
  VoyageMetadata,
} from '../types';
import { calculateBearing, calculateDistanceNM } from '../utils/geoUtils';

interface NormalizedTrackItem {
  kind: 'observed' | 'normalized' | 'gap';
  sourceObservationIndices?: number[];
  sourceSegmentIndex?: number;
  sourceEventIndex?: number;
  reason?: string;
  confidence?: string;
  position?: { lon?: number; lat?: number };
  observedAt?: string;
}

interface NorthernLinesNormalizedTrack {
  schemaVersion: number;
  journeyId: string;
  createdAt?: string;
  algorithmVersion?: string;
  sourceObservationCount?: number;
  sourceObservationSha256?: string;
  qualityInput?: {
    policyVersion?: string;
    reportSha256?: string;
  };
  normalizationPolicy?: {
    version?: string;
  };
  items: NormalizedTrackItem[];
}

interface GeoJsonFeature {
  type?: string;
  properties?: Record<string, unknown>;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
}

interface GeoJsonCollection {
  type?: string;
  features?: GeoJsonFeature[];
}

function isFiniteCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function looksLikeNormalizedTrack(value: unknown): value is NorthernLinesNormalizedTrack {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NorthernLinesNormalizedTrack>;
  return candidate.schemaVersion === 1 && typeof candidate.journeyId === 'string' && Array.isArray(candidate.items);
}

function looksLikeSegmentedGeoJson(value: unknown): value is GeoJsonCollection {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as GeoJsonCollection;
  return candidate.type === 'FeatureCollection'
    && Array.isArray(candidate.features)
    && candidate.features.some((feature) => feature.geometry?.type === 'LineString');
}

function fallbackMetadata(journeyId: string, metadata?: Partial<VoyageMetadata>): VoyageMetadata {
  const title = metadata?.title && metadata.title !== 'normalized-track'
    ? metadata.title
    : journeyId.replace(/-/g, ' ');
  return {
    title,
    vesselName: metadata?.vesselName || 'Unbekanntes Schiff',
    mmsi: metadata?.mmsi,
    callsign: metadata?.callsign,
    skipper: metadata?.skipper,
    vesselType: metadata?.vesselType,
    notes: metadata?.notes,
  };
}

function emptyBounds() {
  return { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 };
}

function boundsFor(points: AisPoint[]) {
  if (!points.length) return emptyBounds();
  return {
    minLat: Math.min(...points.map((point) => point.lat)),
    maxLat: Math.max(...points.map((point) => point.lat)),
    minLon: Math.min(...points.map((point) => point.lon)),
    maxLon: Math.max(...points.map((point) => point.lon)),
  };
}

function summarizeImport(detectedFormat: ImportNormalizationSummary['detectedFormat'], inputRecords: number, points: number, ignoredRecords = 0): ImportNormalizationSummary {
  return {
    version: '0.3.0',
    detectedFormat,
    inputRecords,
    normalizedPoints: points,
    ignoredRecords,
    assembledNmeaMessages: 0,
    incompleteNmeaFragments: 0,
  };
}

function decorateSegments(segments: TrackSegment[]): {
  points: AisPoint[];
  totalDistanceNM: number;
  avgSpeedKnots: number;
  maxSpeedKnots: number;
  startTime: Date | null;
  endTime: Date | null;
  durationSeconds: number;
} {
  const flat = segments.flatMap((segment) => segment.points);
  const realTimes = flat.filter((point) => point.provenance.timestamp === 'source');
  const startTime = realTimes[0]?.timestamp ?? null;
  const endTime = realTimes.at(-1)?.timestamp ?? null;
  const startEpoch = startTime?.getTime() ?? 0;
  let totalDistanceNM = 0;
  let speedSum = 0;
  let speedCount = 0;
  let maxSpeedKnots = 0;

  for (const segment of segments) {
    for (let index = 0; index < segment.points.length; index++) {
      const point = segment.points[index];
      let sog = point.sog;
      let cog = point.cog;
      let derivedSog = false;
      let derivedCog = false;

      if (index > 0) {
        const previous = segment.points[index - 1];
        const distance = calculateDistanceNM(previous.lat, previous.lon, point.lat, point.lon);
        totalDistanceNM += distance;
        const deltaHours = (point.timestamp.getTime() - previous.timestamp.getTime()) / 3_600_000;
        if ((sog === undefined || Number.isNaN(sog)) && deltaHours > 0 && point.provenance.timestamp === 'source' && previous.provenance.timestamp === 'source') {
          sog = Math.min(distance / deltaHours, 45);
          derivedSog = true;
        }
        if (cog === undefined || Number.isNaN(cog)) {
          cog = calculateBearing(previous.lat, previous.lon, point.lat, point.lon);
          derivedCog = true;
        }
      }

      point.sog = sog !== undefined ? Math.round(sog * 10) / 10 : undefined;
      point.cog = cog !== undefined ? Math.round(cog) : undefined;
      point.derivedSog = derivedSog;
      point.derivedCog = derivedCog;
      point.distanceFromStartNM = Math.round(totalDistanceNM * 100) / 100;
      point.elapsedSeconds = startEpoch && point.provenance.timestamp === 'source'
        ? Math.round((point.timestamp.getTime() - startEpoch) / 1000)
        : undefined;

      if (sog !== undefined && Number.isFinite(sog)) {
        speedSum += sog;
        speedCount++;
        maxSpeedKnots = Math.max(maxSpeedKnots, sog);
      }
    }
  }

  return {
    points: flat,
    totalDistanceNM: Math.round(totalDistanceNM * 10) / 10,
    avgSpeedKnots: speedCount ? Math.round((speedSum / speedCount) * 10) / 10 : 0,
    maxSpeedKnots: Math.round(maxSpeedKnots * 10) / 10,
    startTime,
    endTime,
    durationSeconds: startTime && endTime ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000)) : 0,
  };
}

function parseNormalizedTrack(track: NorthernLinesNormalizedTrack, metadata?: Partial<VoyageMetadata>): VoyageData {
  const segments: TrackSegment[] = [];
  const gaps: TrackGap[] = [];
  let currentPoints: AisPoint[] = [];
  let pendingGap: TrackGap | null = null;
  let positionIndex = 0;
  let missingTimestampCount = 0;
  const syntheticEpoch = Date.parse(track.createdAt || '') || Date.now();

  const finishSegment = () => {
    if (!currentPoints.length) return;
    segments.push({ id: `segment-${segments.length + 1}`, points: currentPoints });
    currentPoints = [];
  };

  track.items.forEach((item, itemIndex) => {
    if (item.kind === 'gap') {
      finishSegment();
      const gap: TrackGap = {
        id: `gap-${gaps.length + 1}`,
        reason: item.reason || 'track_gap',
        confidence: item.confidence,
        sourceSegmentIndex: item.sourceSegmentIndex,
        sourceEventIndex: item.sourceEventIndex,
        afterPointId: segments.at(-1)?.points.at(-1)?.id,
      };
      gaps.push(gap);
      pendingGap = gap;
      return;
    }

    const lat = Number(item.position?.lat);
    const lon = Number(item.position?.lon);
    if (!isFiniteCoordinate(lat, lon)) return;
    const parsedTime = item.observedAt ? new Date(item.observedAt) : null;
    const hasTime = parsedTime !== null && !Number.isNaN(parsedTime.getTime());
    if (!hasTime) missingTimestampCount++;
    const timestamp = hasTime ? parsedTime! : new Date(syntheticEpoch + positionIndex * 1000);
    const sourceIndices = item.sourceObservationIndices ?? [];
    const point: AisPoint = {
      id: `nl-${item.kind}-${sourceIndices.join('-') || itemIndex}`,
      timestamp,
      lat,
      lon,
      layer: 'canonical',
      provenance: {
        sourceFormat: 'northern-lines-normalized-track',
        timestamp: hasTime ? 'source' : 'synthetic',
        sourceIndex: sourceIndices[0],
        sourceId: sourceIndices.length ? `observations:${sourceIndices.join(',')}` : `item:${itemIndex}`,
      },
      navStatus: item.kind === 'normalized' ? item.reason : undefined,
    };
    if (pendingGap && !pendingGap.beforePointId) {
      pendingGap.beforePointId = point.id;
      pendingGap = null;
    }
    currentPoints.push(point);
    positionIndex++;
  });
  finishSegment();

  const metrics = decorateSegments(segments);
  const playbackAvailable = metrics.points.length > 1 && missingTimestampCount === 0;
  const sourceObservationCount = Number.isFinite(track.sourceObservationCount) ? track.sourceObservationCount : undefined;

  return {
    metadata: fallbackMetadata(track.journeyId, metadata),
    rawPoints: [],
    points: metrics.points,
    segments,
    gaps,
    playbackAvailable,
    geometryOnly: false,
    northernLinesSource: {
      schemaVersion: track.schemaVersion,
      journeyId: track.journeyId,
      algorithmVersion: track.algorithmVersion,
      sourceObservationCount,
      sourceObservationSha256: track.sourceObservationSha256,
      qualityPolicyVersion: track.qualityInput?.policyVersion,
      qualityReportSha256: track.qualityInput?.reportSha256,
      normalizationPolicyVersion: track.normalizationPolicy?.version,
    },
    trackContract: {
      version: '0.2.0',
      rawPointCount: 0,
      canonicalPointCount: metrics.points.length,
      sourceFormats: ['northern-lines-normalized-track'],
      timestampProvenance: missingTimestampCount ? ['source', 'synthetic'] : ['source'],
      observedMmsi: [],
      mixedMmsi: false,
    },
    importNormalization: summarizeImport('northern-lines-normalized-track', track.items.length, metrics.points.length, track.items.length - metrics.points.length - gaps.length),
    journeyQuality: {
      supplied: false,
      editorialReady: false,
      reason: 'Normalized Track enthält eine QA-Referenz, aber keinen geladenen Journey-Quality-Report.',
    },
    totalDistanceNM: metrics.totalDistanceNM,
    avgSpeedKnots: metrics.avgSpeedKnots,
    maxSpeedKnots: metrics.maxSpeedKnots,
    durationSeconds: metrics.durationSeconds,
    startTime: metrics.startTime,
    endTime: metrics.endTime,
    anchorages: [],
    bounds: boundsFor(metrics.points),
  };
}

function parseSegmentedGeoJson(collection: GeoJsonCollection, metadata?: Partial<VoyageMetadata>): VoyageData {
  const segments: TrackSegment[] = [];
  const gaps: TrackGap[] = [];
  let globalPointIndex = 0;
  let lastPointId: string | undefined;
  let pendingGap: TrackGap | null = null;
  const epoch = Date.now();
  let detectedKind = 'geojson';

  for (const feature of collection.features ?? []) {
    const properties = feature.properties ?? {};
    if (typeof properties.kind === 'string') detectedKind = properties.kind;

    if (feature.geometry?.type === 'LineString' && Array.isArray(feature.geometry.coordinates)) {
      const points: AisPoint[] = [];
      for (const coordinate of feature.geometry.coordinates as unknown[]) {
        if (!Array.isArray(coordinate) || coordinate.length < 2) continue;
        const lon = Number(coordinate[0]);
        const lat = Number(coordinate[1]);
        if (!isFiniteCoordinate(lat, lon)) continue;
        const point: AisPoint = {
          id: `geojson-${segments.length + 1}-${points.length + 1}`,
          timestamp: new Date(epoch + globalPointIndex * 1000),
          lat,
          lon,
          layer: properties.kind === 'raw' ? 'raw' : 'canonical',
          provenance: {
            sourceFormat: 'geojson',
            timestamp: 'synthetic',
            sourceIndex: globalPointIndex,
            sourceId: `segment:${segments.length + 1}`,
          },
        };
        if (pendingGap && !pendingGap.beforePointId) {
          pendingGap.beforePointId = point.id;
          pendingGap = null;
        }
        points.push(point);
        lastPointId = point.id;
        globalPointIndex++;
      }
      if (points.length) segments.push({ id: `segment-${segments.length + 1}`, points });
      continue;
    }

    if (properties.kind === 'gap' || feature.geometry === null) {
      const gap: TrackGap = {
        id: `gap-${gaps.length + 1}`,
        reason: typeof properties.reason === 'string' ? properties.reason : 'track_gap',
        confidence: typeof properties.confidence === 'string' ? properties.confidence : undefined,
        sourceSegmentIndex: Number.isFinite(Number(properties.sourceSegmentIndex)) ? Number(properties.sourceSegmentIndex) : undefined,
        sourceEventIndex: Number.isFinite(Number(properties.sourceEventIndex)) ? Number(properties.sourceEventIndex) : undefined,
        afterPointId: lastPointId,
      };
      gaps.push(gap);
      pendingGap = gap;
    }
  }

  const metrics = decorateSegments(segments);
  const journeyName = typeof collection.features?.[0]?.properties?.name === 'string'
    ? String(collection.features?.[0]?.properties?.name).replace(/\s+(raw|normalized)$/i, '')
    : metadata?.title || 'GeoJSON Track';

  return {
    metadata: fallbackMetadata(journeyName, metadata),
    rawPoints: detectedKind === 'raw' ? metrics.points : [],
    points: metrics.points,
    segments,
    gaps,
    playbackAvailable: false,
    geometryOnly: true,
    trackContract: {
      version: '0.2.0',
      rawPointCount: detectedKind === 'raw' ? metrics.points.length : 0,
      canonicalPointCount: metrics.points.length,
      sourceFormats: ['geojson'],
      timestampProvenance: ['synthetic'],
      observedMmsi: [],
      mixedMmsi: false,
    },
    importNormalization: summarizeImport('geojson', collection.features?.length ?? 0, metrics.points.length, 0),
    journeyQuality: {
      supplied: false,
      editorialReady: false,
      reason: 'GeoJSON wurde als Geometry-only Review-Artefakt importiert; Zeitbasis und vollständiger QA-Contract fehlen.',
    },
    totalDistanceNM: metrics.totalDistanceNM,
    avgSpeedKnots: 0,
    maxSpeedKnots: 0,
    durationSeconds: 0,
    startTime: null,
    endTime: null,
    anchorages: [],
    bounds: boundsFor(metrics.points),
  };
}

/**
 * Build 005 native adapter. Returns null for non-Northern-Lines/generic imports so the
 * existing Build 003 normalization path can continue unchanged.
 */
export function parseNorthernLinesJourneyText(rawText: string, metadata?: Partial<VoyageMetadata>): VoyageData | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('{')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (looksLikeNormalizedTrack(parsed)) return parseNormalizedTrack(parsed, metadata);
  if (looksLikeSegmentedGeoJson(parsed)) return parseSegmentedGeoJson(parsed, metadata);
  return null;
}
