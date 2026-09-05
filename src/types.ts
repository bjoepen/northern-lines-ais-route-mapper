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
