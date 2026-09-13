import { VoyageData } from '../types';
import { GapDisplayAdjustment } from '../project/nlroute';
import { GeoPoint } from './types';

export function buildEditorialJourneyLines(voyage: VoyageData, adjustments: GapDisplayAdjustment[]): GeoPoint[][] {
  if (voyage.mapperReview) {
    const adjustmentByRoute = new Map(adjustments.map((adjustment) => [adjustment.routeId, adjustment]));
    const observed = voyage.mapperReview.observedRoutes.map((route) => route.points.map((point) => ({ lat: point.lat, lon: point.lon })));
    const reconstructed = voyage.mapperReview.reconstructedRoutes.map((route) => {
      const adjustment = adjustmentByRoute.get(route.id);
      if (!adjustment || route.points.length < 2) return route.points.map((point) => ({ lat: point.lat, lon: point.lon }));
      const first = route.points[0];
      const last = route.points[route.points.length - 1];
      return [
        { lat: first.lat, lon: first.lon },
        ...adjustment.controlPoints.map((point) => ({ lat: point.lat, lon: point.lon })),
        { lat: last.lat, lon: last.lon },
      ];
    });
    return [...observed, ...reconstructed];
  }

  const segments = voyage.segments?.length ? voyage.segments : [{ id: 'legacy', points: voyage.points }];
  return segments
    .filter((segment) => segment.points.length > 1)
    .map((segment) => segment.points.map((point) => ({ lat: point.lat, lon: point.lon })));
}
