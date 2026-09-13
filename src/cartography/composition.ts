import { GeoBounds } from './types';

export type EditorialOrientation = 'portrait' | 'landscape';

export interface EditorialComposition {
  width: number;
  height: number;
  orientation: EditorialOrientation;
  headerHeight: number;
  footerHeight: number;
  journeyField: { x: number; y: number; width: number; height: number };
}

function score(bounds: GeoBounds, width: number, height: number): number {
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const cosLat = Math.max(0.2, Math.cos(centerLat * Math.PI / 180));
  const routeW = Math.max(0.01, (bounds.maxLon - bounds.minLon) * cosLat);
  const routeH = Math.max(0.01, bounds.maxLat - bounds.minLat);
  const fieldW = width - 112;
  const fieldH = height - 300;
  const scale = Math.min(fieldW / routeW, fieldH / routeH);
  return routeW * routeH * scale * scale;
}

export function composeJourney(bounds: GeoBounds): EditorialComposition {
  const portrait = { width: 960, height: 1320 };
  const landscape = { width: 1320, height: 960 };
  const orientation: EditorialOrientation = score(bounds, portrait.width, portrait.height) >= score(bounds, landscape.width, landscape.height)
    ? 'portrait'
    : 'landscape';
  const page = orientation === 'portrait' ? portrait : landscape;
  const headerHeight = 154;
  const footerHeight = 112;
  return {
    ...page,
    orientation,
    headerHeight,
    footerHeight,
    journeyField: {
      x: 56,
      y: headerHeight,
      width: page.width - 112,
      height: page.height - headerHeight - footerHeight,
    },
  };
}
