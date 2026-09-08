export type TrackLayer = 'raw' | 'canonical';

export type TrackSourceFormat =
  | 'ais-nmea'
  | 'gps-nmea'
  | 'csv'
  | 'gpx'
  | 'json'
  | 'geojson'
  | 'northern-lines-normalized-track'
  | 'synthetic'
  | 'unknown';

export type TimestampProvenance = 'source' | 'receiver' | 'synthetic' | 'unknown';

export interface PointProvenance {
  sourceFormat: TrackSourceFormat;
  timestamp: TimestampProvenance;
  sourceIndex?: number;
  sourceId?: string;
}

export interface AisPoint {
  id: string;
  timestamp: Date;
  lat: number;
  lon: number;
  sog?: number;
  cog?: number;
  heading?: number;
  navStatus?: string;
  mmsi?: string;
  layer: TrackLayer;
  provenance: PointProvenance;
  derivedSog?: boolean;
  derivedCog?: boolean;
  distanceFromStartNM?: number;
  elapsedSeconds?: number;
}

/** A continuous route section. No renderer may connect two segments implicitly. */
export interface TrackSegment {
  id: string;
  points: AisPoint[];
}

/** Explicit upstream discontinuity emitted by Tracker/Cartography QA. */
export interface TrackGap {
  id: string;
  reason: string;
  confidence?: string;
  sourceSegmentIndex?: number;
  sourceEventIndex?: number;
  afterPointId?: string;
  beforePointId?: string;
}

export interface NorthernLinesJourneySource {
  schemaVersion: number;
  journeyId: string;
  algorithmVersion?: string;
  sourceObservationCount?: number;
  sourceObservationSha256?: string;
  qualityPolicyVersion?: string;
  qualityReportSha256?: string;
  normalizationPolicyVersion?: string;
}

export interface TrackContractSummary {
  version: '0.2.0';
  rawPointCount: number;
  canonicalPointCount: number;
  sourceFormats: TrackSourceFormat[];
  timestampProvenance: TimestampProvenance[];
  primaryMmsi?: string;
  observedMmsi: string[];
  mixedMmsi: boolean;
}

export type ImportDetectedFormat =
  | 'nmea'
  | 'csv'
  | 'gpx'
  | 'json'
  | 'geojson'
  | 'northern-lines-normalized-track'
  | 'mixed'
  | 'unknown';

export interface ImportNormalizationSummary {
  version: '0.3.0';
  detectedFormat: ImportDetectedFormat;
  inputRecords: number;
  normalizedPoints: number;
  ignoredRecords: number;
  assembledNmeaMessages: number;
  incompleteNmeaFragments: number;
}

/** Overall verdict emitted by Northern Lines Tracker QA and consumed read-only by the Mapper. */
export type JourneyQualityStatus = 'pass' | 'warn' | 'fail' | 'unknown';

/** Known QA issue families. Unknown future codes remain representable as strings. */
export type JourneyQualityIssueCode =
  | 'TROLL_CROSSING'
  | 'TRACK_GAP'
  | 'POSITION_OUTLIER'
  | 'IMPOSSIBLE_SPEED'
  | 'DUPLICATE_POINT'
  | 'OUT_OF_ORDER_TIMESTAMP'
  | 'MMSI_MISMATCH'
  | string;

export interface JourneyQualityIssue {
  code: JourneyQualityIssueCode;
  severity: 'info' | 'warn' | 'fail';
  message?: string;
  pointId?: string;
  fromPointId?: string;
  toPointId?: string;
  observedAt?: Date;
  details?: Record<string, unknown>;
}

/**
 * Build 004 boundary: this report is produced upstream by Tracker QA.
 * The Route Mapper may display and gate on it, but must not recompute it.
 */
export interface JourneyQualityReport {
  contractVersion: '0.4.0';
  status: JourneyQualityStatus;
  analyzer?: string;
  analyzerVersion?: string;
  analyzedAt?: Date;
  journeyId?: string;
  mmsi?: string;
  pointCount?: number;
  trollCrossings?: number;
  gaps?: number;
  issues: JourneyQualityIssue[];
}

export interface JourneyQualityState {
  /** Whether a Tracker QA report accompanied this voyage. */
  supplied: boolean;
  /** Parsed upstream report; absent for legacy/demo/general imports. */
  report?: JourneyQualityReport;
  /** Editorial export should only be trusted when this is true. */
  editorialReady: boolean;
  /** Human-readable reason when editorialReady is false. */
  reason?: string;
}

export interface AnchorageStop {
  id: string;
  name?: string;
  startPoint: AisPoint;
  endPoint: AisPoint;
  lat: number;
  lon: number;
  durationMinutes: number;
}

export interface VoyageMetadata {
  title: string;
  vesselName: string;
  mmsi?: string;
  callsign?: string;
  skipper?: string;
  vesselType?: string;
  notes?: string;
}

export interface VoyageData {
  metadata: VoyageMetadata;
  /** Immutable source observations when the imported format actually contains them. */
  rawPoints: AisPoint[];
  /** Flat canonical index retained for current UI/playback selection. */
  points: AisPoint[];
  /** Continuous route sections. Renderers must never bridge between them. */
  segments?: TrackSegment[];
  /** Explicit discontinuities supplied upstream; Mapper never invents gap geometry. */
  gaps?: TrackGap[];
  /** False for geometry-only review artifacts without trustworthy timestamps. */
  playbackAvailable?: boolean;
  /** True for GeoJSON review artifacts that contain geometry but no journey time basis. */
  geometryOnly?: boolean;
  /** Provenance of a native Northern Lines Normalized Track import. */
  northernLinesSource?: NorthernLinesJourneySource;
  trackContract: TrackContractSummary;
  /** Present for text/file imports normalized by Build 003/005. */
  importNormalization?: ImportNormalizationSummary;
  /** Upstream Tracker QA state. Mapper consumes this contract but never recomputes QA. */
  journeyQuality?: JourneyQualityState;
  totalDistanceNM: number;
  avgSpeedKnots: number;
  maxSpeedKnots: number;
  durationSeconds: number;
  startTime: Date | null;
  endTime: Date | null;
  anchorages: AnchorageStop[];
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

/** Keyless map styles guaranteed by the Northern Lines map baseline. */
export type MapStyleId = 'nautical' | 'osm';
export type RouteColorMode = 'speed' | 'monochrome' | 'gradient';
export type ActiveTab = 'map' | 'logbook' | 'data' | 'export';
