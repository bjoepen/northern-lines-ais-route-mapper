export interface AisPoint {
  id: string;
  timestamp: Date;
  lat: number;
  lon: number;
  sog?: number; // Speed Over Ground in knots
  cog?: number; // Course Over Ground in degrees (0-360)
  heading?: number; // True heading
  navStatus?: string; // e.g. "Under way using engine", "At anchor", "Moored"
  mmsi?: string;
  distanceFromStartNM?: number;
  elapsedSeconds?: number;
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
  vesselType?: string; // e.g. "Segelyacht (SY)", "Motoryacht (MY)", "Katamaran"
  notes?: string;
}

export interface VoyageData {
  metadata: VoyageMetadata;
  points: AisPoint[];
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

export type MapStyleId = 'nautical' | 'osm' | 'satellite' | 'dark' | 'topo';

export type RouteColorMode = 'speed' | 'monochrome' | 'gradient';

export type ActiveTab = 'map' | 'logbook' | 'data' | 'export';
