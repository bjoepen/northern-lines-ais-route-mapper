import { AisPoint } from '../types';

/** Earth radius in kilometers */
const EARTH_RADIUS_KM = 6371.0;
/** 1 Nautical Mile in kilometers */
const KM_PER_NM = 1.852;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates Great-Circle distance between two coordinates in Nautical Miles (NM).
 */
export function calculateDistanceNM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = EARTH_RADIUS_KM * c;
  return distanceKm / KM_PER_NM;
}

/**
 * Calculates the initial bearing (course) in degrees (0..360) from point 1 to point 2.
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  let brng = toDegrees(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Formats decimal degrees into nautical standard degrees and decimal minutes:
 * e.g. 54.321 -> 54° 19.260' N
 */
export function formatNauticalCoordinate(lat: number, lon: number): string {
  const latHemi = lat >= 0 ? 'N' : 'S';
  const lonHemi = lon >= 0 ? 'E' : 'W';

  const absLat = Math.abs(lat);
  const latDeg = Math.floor(absLat);
  const latMin = ((absLat - latDeg) * 60).toFixed(3).padStart(6, '0');

  const absLon = Math.abs(lon);
  const lonDeg = Math.floor(absLon);
  const lonMin = ((absLon - lonDeg) * 60).toFixed(3).padStart(6, '0');

  return `${latDeg.toString().padStart(2, '0')}° ${latMin}' ${latHemi}, ${lonDeg.toString().padStart(3, '0')}° ${lonMin}' ${lonHemi}`;
}

export function formatKnots(kn?: number): string {
  if (kn === undefined || isNaN(kn)) return '-- kn';
  return `${kn.toFixed(1)} kn`;
}

export function formatDegrees(deg?: number): string {
  if (deg === undefined || isNaN(deg)) return '--°';
  return `${Math.round(deg).toString().padStart(3, '0')}°`;
}

export function formatNM(nm: number): string {
  return `${nm.toFixed(1)} sm`;
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0h 0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) {
    const remHrs = hrs % 24;
    return `${days}d ${remHrs}h ${mins}m`;
  }
  return `${hrs}h ${mins}m`;
}

/**
 * Returns color hex code based on vessel speed in knots (SOG)
 */
export function getSpeedColor(speedKnots?: number): string {
  if (speedKnots === undefined || speedKnots < 0.3) return '#3b82f6'; // Blue / Moored or drifting
  if (speedKnots < 3.0) return '#06b6d4'; // Cyan / Slow harbor maneuvering
  if (speedKnots < 6.0) return '#10b981'; // Emerald / Moderate cruising
  if (speedKnots < 8.5) return '#eab308'; // Amber / Good sailing breeze
  if (speedKnots < 12.0) return '#f97316'; // Orange / High sailing speed
  return '#ef4444'; // Red / Very fast / planing
}
