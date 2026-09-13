export type NaturalEarthResolution = '10m' | '50m' | '110m';

export type GeoPoint = { lat: number; lon: number };
export type GeoBounds = { minLat: number; maxLat: number; minLon: number; maxLon: number };

export type GeographicScene = {
  bounds: GeoBounds;
  resolution: NaturalEarthResolution;
  landPaths: string[];
  journeyPaths: string[];
  width: number;
  height: number;
};
