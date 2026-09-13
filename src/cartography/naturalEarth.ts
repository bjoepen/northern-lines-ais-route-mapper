import { createEditorialProjection, paddedBounds, pointsToPath } from './projection';
import { GeoBounds, GeoPoint, GeographicScene, NaturalEarthResolution } from './types';

type Geometry = {
  type?: 'Polygon' | 'MultiPolygon';
  coordinates?: unknown;
};

type Feature = { geometry?: Geometry | null };
type FeatureCollection = { type?: string; features?: Feature[] };

const FILES: Record<NaturalEarthResolution, string> = {
  '10m': '/data/natural-earth/ne_10m_land.geojson',
  '50m': '/data/natural-earth/ne_50m_land.geojson',
  '110m': '/data/natural-earth/ne_110m_land.geojson',
};

export function chooseNaturalEarthResolution(bounds: GeoBounds): NaturalEarthResolution {
  const span = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLon - bounds.minLon);
  if (span <= 22) return '10m';
  if (span <= 65) return '50m';
  return '110m';
}

function ringToPoints(value: unknown): GeoPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return [];
    const lon = Number(coordinate[0]);
    const lat = Number(coordinate[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    return [{ lat, lon }];
  });
}

function ringIntersectsBounds(points: GeoPoint[], bounds: GeoBounds): boolean {
  if (!points.length) return false;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  points.forEach((point) => {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  });
  return !(maxLat < bounds.minLat || minLat > bounds.maxLat || maxLon < bounds.minLon || minLon > bounds.maxLon);
}

function geometryRings(geometry?: Geometry | null): GeoPoint[][] {
  if (!geometry?.coordinates) return [];
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as unknown[]).map(ringToPoints).filter((ring) => ring.length > 2);
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as unknown[]).flatMap((polygon) =>
      Array.isArray(polygon) ? polygon.map(ringToPoints).filter((ring) => ring.length > 2) : [],
    );
  }
  return [];
}

async function fetchCollection(resolution: NaturalEarthResolution): Promise<FeatureCollection> {
  const response = await fetch(FILES[resolution]);
  if (!response.ok) {
    throw new Error(`Natural Earth ${resolution} fehlt (${response.status}). Bitte npm run cartography:fetch-data ausführen.`);
  }
  const value = await response.json() as FeatureCollection;
  if (value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error(`Natural Earth ${resolution} ist kein gültiges GeoJSON FeatureCollection.`);
  }
  return value;
}

export async function buildGeographicScene(
  bounds: GeoBounds,
  journeyLines: GeoPoint[][],
  width = 960,
  height = 1320,
): Promise<GeographicScene> {
  const padded = paddedBounds(bounds, 0.1);
  const resolution = chooseNaturalEarthResolution(padded);
  const collection = await fetchCollection(resolution);
  const project = createEditorialProjection(padded, width, height, 48);
  const landPaths = collection.features
    .flatMap((feature) => geometryRings(feature.geometry))
    .filter((ring) => ringIntersectsBounds(ring, padded))
    .map((ring) => `${pointsToPath(ring, project)} Z`)
    .filter(Boolean);
  const journeyPaths = journeyLines
    .filter((line) => line.length > 1)
    .map((line) => pointsToPath(line, project))
    .filter(Boolean);

  return { bounds: padded, resolution, landPaths, journeyPaths, width, height };
}
