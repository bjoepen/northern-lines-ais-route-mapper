import { GeoBounds, GeoPoint } from './types';

export function paddedBounds(bounds: GeoBounds, fraction = 0.08): GeoBounds {
  const latSpan = Math.max(0.01, bounds.maxLat - bounds.minLat);
  const lonSpan = Math.max(0.01, bounds.maxLon - bounds.minLon);
  return {
    minLat: bounds.minLat - latSpan * fraction,
    maxLat: bounds.maxLat + latSpan * fraction,
    minLon: bounds.minLon - lonSpan * fraction,
    maxLon: bounds.maxLon + lonSpan * fraction,
  };
}

export function createEditorialProjection(bounds: GeoBounds, width: number, height: number, inset = 36) {
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const cosLat = Math.max(0.2, Math.cos(centerLat * Math.PI / 180));
  const lonSpan = Math.max(0.01, (bounds.maxLon - bounds.minLon) * cosLat);
  const latSpan = Math.max(0.01, bounds.maxLat - bounds.minLat);
  const usableW = Math.max(1, width - inset * 2);
  const usableH = Math.max(1, height - inset * 2);
  const scale = Math.min(usableW / lonSpan, usableH / latSpan);
  const contentW = lonSpan * scale;
  const contentH = latSpan * scale;
  const offsetX = (width - contentW) / 2;
  const offsetY = (height - contentH) / 2;

  return (point: GeoPoint) => ({
    x: offsetX + (point.lon - bounds.minLon) * cosLat * scale,
    y: offsetY + (bounds.maxLat - point.lat) * scale,
  });
}

export function pointsToPath(points: GeoPoint[], project: ReturnType<typeof createEditorialProjection>): string {
  if (!points.length) return '';
  return points.map((point, index) => {
    const p = project(point);
    return `${index === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ');
}
