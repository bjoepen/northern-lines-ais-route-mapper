export type TrackLayer = 'raw' | 'canonical';

export type TrackSourceFormat =
  | 'ais-nmea'
  | 'gps-nmea'
  | 'csv'
  | 'gpx'
  | 'json'
  | 'geojson'
  | 'northern-lines-normalized-track'
  | 'northern-lines-mapper-review'
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

/** A continuous observed route section. No renderer may connect two segments implicitly. */
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

/** A coordinate used by Mapper Review geometry. It is not an AIS observation. */
export interface ReviewCoordinate {
  lat: number;
  lon: number;
}

export type MapperReviewLayer = 'observed_route' | 'reconstructed_route';

/**
 * Build 005R geometry supplied by Cartography for human Mapper review.
 * Reconstructed geometry is derived evidence and must never be promoted to observed AIS data.
 */
export interface MapperReviewRoute {
  id: string;
  routeLayer: MapperReviewLayer;
  evidenceClass?: string;
  sourceSegmentIndex?: number;
  sourceEventIndex?: number;
  method?: string;
  methodVersion?: string;
  reviewState?: string;
  visualAcceptance?: string;
  classification?: string;
  policyReason?: string;
  note?: string | null;
  points: ReviewCoordinate[];
}

export interface MapperReviewSource {
  schemaVersion?: number;
  journeyId?: string;
  purpose?: string;
  productionApproved?: boolean;
  motionContextPolicyVersion?: string;
  reconstructionPolicyVersion?: string;
  sourceBoundsPolicyVersion?: string;
}

export interface MapperReviewState {
  source: MapperReviewSource;
  observedRoutes: MapperReviewRoute[];
  reconstructedRoutes: MapperReviewRoute[];
  reviewRequiredCount: number;
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
  | 'northern-lines-mapper-review'
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

export type JourneyQualityStatus = 'pass' | 'warn' | 'fail' | 'unknown';

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
  supplied: boolean;
  report?: JourneyQualityReport;
  editorialReady: boolean;
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
  rawPoints: AisPoint[];
  points: AisPoint[];
  segments?: TrackSegment[];
  gaps?: TrackGap[];
  playbackAvailable?: boolean;
  geometryOnly?: boolean;
  northernLinesSource?: NorthernLinesJourneySource;
  /** Present only when a Cartography mapper-review GeoJSON was imported. */
  mapperReview?: MapperReviewState;
  trackContract: TrackContractSummary;
  importNormalization?: ImportNormalizationSummary;
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

export type MapStyleId = 'nautical' | 'osm';
export type RouteColorMode = 'speed' | 'monochrome' | 'gradient';
export type ActiveTab = 'map' | 'logbook' | 'data' | 'export';
