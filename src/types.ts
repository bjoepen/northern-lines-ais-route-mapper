export type TrackLayer = 'raw' | 'canonical';

export type TrackSourceFormat =
  | 'ais-nmea'
  | 'gps-nmea'
  | 'csv'
  | 'gpx'
  | 'json'
  | 'geojson'
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

export type ImportDetectedFormat = 'nmea' | 'csv' | 'gpx' | 'json' | 'geojson' | 'mixed' | 'unknown';

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
  /** Immutable source observations as imported. */
  rawPoints: AisPoint[];
  /** Canonical, chronologically ordered route points used by the current UI. */
  points: AisPoint[];
  trackContract: TrackContractSummary;
  /** Present for text/file imports normalized by Build 003. */
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
