import {
  AisPoint,
  AnchorageStop,
  PointProvenance,
  TrackSourceFormat,
  TimestampProvenance,
  VoyageData,
  VoyageMetadata,
} from '../types';
import { calculateBearing, calculateDistanceNM } from './geoUtils';

type TrackPointInput = Omit<AisPoint, 'layer' | 'provenance'> & {
  layer?: AisPoint['layer'];
  provenance?: PointProvenance;
};

function decodeAisArmoredChar(c: string): number {
  const ascii = c.charCodeAt(0);
  if (ascii < 48 || ascii > 119 || (ascii > 87 && ascii < 96)) return 0;
  let val = ascii - 48;
  if (val > 40) val -= 8;
  return val & 0x3f;
}

function payloadToBitString(payload: string): string {
  let bitStr = '';
  for (const char of payload) {
    bitStr += decodeAisArmoredChar(char).toString(2).padStart(6, '0');
  }
  return bitStr;
}

function parseSignedInt(bitStr: string): number {
  const value = parseInt(bitStr, 2);
  if (bitStr[0] !== '1') return value;
  return value - Math.pow(2, bitStr.length);
}

function provenance(
  sourceFormat: TrackSourceFormat,
  timestamp: TimestampProvenance,
  sourceIndex?: number,
): PointProvenance {
  return { sourceFormat, timestamp, sourceIndex };
}

function parseRmcTimestamp(parts: string[], fallbackTime: Date): { value: Date; provenance: TimestampProvenance } {
  const rawTime = parts[1];
  const rawDate = parts[9];
  if (!rawTime || !rawDate || rawTime.length < 6 || rawDate.length !== 6) {
    return { value: fallbackTime, provenance: 'synthetic' };
  }

  const day = Number(rawDate.slice(0, 2));
  const month = Number(rawDate.slice(2, 4));
  const yy = Number(rawDate.slice(4, 6));
  const year = yy >= 80 ? 1900 + yy : 2000 + yy;
  const hour = Number(rawTime.slice(0, 2));
  const minute = Number(rawTime.slice(2, 4));
  const second = Number(rawTime.slice(4, 6));
  const millis = rawTime.includes('.') ? Math.round(Number(`0.${rawTime.split('.')[1]}`) * 1000) : 0;
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millis));

  if (Number.isNaN(parsed.getTime())) return { value: fallbackTime, provenance: 'synthetic' };
  return { value: parsed, provenance: 'source' };
}

function parseAisNmeaSentence(sentence: string, fallbackTime: Date, sourceIndex?: number): AisPoint | null {
  const clean = sentence.trim();
  if (!clean.startsWith('!') && !clean.startsWith('$')) return null;

  const parts = clean.split('*')[0].split(',');
  const prefix = parts[0];

  if (prefix.endsWith('RMC') && parts.length >= 10) {
    if (parts[2] !== 'A') return null;
    const rawLat = parseFloat(parts[3]);
    const rawLon = parseFloat(parts[5]);
    if (Number.isNaN(rawLat) || Number.isNaN(rawLon)) return null;

    const latDeg = Math.floor(rawLat / 100);
    const lonDeg = Math.floor(rawLon / 100);
    let lat = latDeg + (rawLat - latDeg * 100) / 60;
    let lon = lonDeg + (rawLon - lonDeg * 100) / 60;
    if (parts[4] === 'S') lat = -lat;
    if (parts[6] === 'W') lon = -lon;

    const timestamp = parseRmcTimestamp(parts, fallbackTime);
    const rawSog = parseFloat(parts[7]);
    const rawCog = parseFloat(parts[8]);

    return {
      id: `nmea-rmc-${sourceIndex ?? 0}`,
      timestamp: timestamp.value,
      lat,
      lon,
      sog: Number.isNaN(rawSog) ? undefined : rawSog,
      cog: Number.isNaN(rawCog) ? undefined : rawCog,
      navStatus: 'GPS Track',
      layer: 'raw',
      provenance: provenance('gps-nmea', timestamp.provenance, sourceIndex),
    };
  }

  if (!prefix.includes('VDM') && !prefix.includes('VDO')) return null;
  if (parts.length < 6) return null;

  // Build 002 only accepts single-fragment AIVDM/AIVDO payloads. Multi-fragment
  // assembly belongs to the import-normalization build and must not be guessed here.
  const fragmentCount = Number(parts[1]);
  const fragmentNumber = Number(parts[2]);
  if (fragmentCount > 1 || fragmentNumber > 1) return null;

  const payload = parts[5];
  if (!payload || payload.length < 5) return null;

  try {
    const bits = payloadToBitString(payload);
    const msgType = parseInt(bits.slice(0, 6), 2);

    if (msgType === 1 || msgType === 2 || msgType === 3) {
      if (bits.length < 168) return null;
      const mmsi = parseInt(bits.slice(8, 38), 2).toString();
      const statusInt = parseInt(bits.slice(38, 42), 2);
      const sogInt = parseInt(bits.slice(46, 56), 2);
      const lonRaw = parseSignedInt(bits.slice(61, 89));
      const latRaw = parseSignedInt(bits.slice(89, 116));
      const cogInt = parseInt(bits.slice(116, 128), 2);
      const headingInt = parseInt(bits.slice(128, 137), 2);
      const lon = lonRaw / 600000;
      const lat = latRaw / 600000;

      const navStatuses = [
        'Unter Motor', 'Vor Anker', 'Nicht manövrierfähig', 'Eingeschränkt manövrierfähig',
        'Durch Tiefgang behindert', 'Festgemacht', 'Auf Grund', 'Fischereifahrzeug', 'Unter Segel',
      ];

      if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) return null;

      return {
        id: `ais-${mmsi}-${sourceIndex ?? 0}`,
        timestamp: fallbackTime,
        lat,
        lon,
        sog: sogInt === 1023 ? undefined : sogInt / 10,
        cog: cogInt === 3600 ? undefined : cogInt / 10,
        heading: headingInt === 511 ? undefined : headingInt,
        navStatus: navStatuses[statusInt] || 'Unterwegs',
        mmsi,
        layer: 'raw',
        provenance: provenance('ais-nmea', 'synthetic', sourceIndex),
      };
    }

    if (msgType === 18) {
      if (bits.length < 140) return null;
      const mmsi = parseInt(bits.slice(8, 38), 2).toString();
      const sogInt = parseInt(bits.slice(46, 56), 2);
      const lon = parseSignedInt(bits.slice(57, 85)) / 600000;
      const lat = parseSignedInt(bits.slice(85, 112)) / 600000;
      const cogInt = parseInt(bits.slice(112, 124), 2);

      if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0)) return null;

      return {
        id: `ais-${mmsi}-${sourceIndex ?? 0}`,
        timestamp: fallbackTime,
        lat,
        lon,
        sog: sogInt === 1023 ? undefined : sogInt / 10,
        cog: cogInt === 3600 ? undefined : cogInt / 10,
        navStatus: 'Unterwegs (Klasse B)',
        mmsi,
        layer: 'raw',
        provenance: provenance('ais-nmea', 'synthetic', sourceIndex),
      };
    }
  } catch (error) {
    console.warn('Failed to parse AIS sentence:', error);
  }

  return null;
}

export function parseAisCsv(content: string): AisPoint[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0];
  const sep = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
  const headers = header.split(sep).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  const latIdx = headers.findIndex((h) => ['lat', 'latitude', 'breite', 'y', 'lat_deg'].includes(h));
  const lonIdx = headers.findIndex((h) => ['lon', 'long', 'lng', 'longitude', 'länge', 'x', 'lon_deg'].includes(h));
  const timeIdx = headers.findIndex((h) => ['timestamp', 'time', 'date', 'datetime', 'zeit', 'datum', 'utc'].some((t) => h.includes(t)));
  const sogIdx = headers.findIndex((h) => ['sog', 'speed', 'knoten', 'knots', 'vitesse', 'geschwindigkeit'].some((s) => h.includes(s)));
  const cogIdx = headers.findIndex((h) => ['cog', 'course', 'kurs', 'heading', 'richtung'].some((c) => h.includes(c)));
  const mmsiIdx = headers.findIndex((h) => ['mmsi', 'ship_id', 'vessel_id'].includes(h));
  const statusIdx = headers.findIndex((h) => ['status', 'navstatus', 'nav_status', 'zustand'].includes(h));

  const points: AisPoint[] = [];
  const startRow = latIdx !== -1 && lonIdx !== -1 ? 1 : 0;
  const syntheticEpoch = Date.now();

  for (let i = startRow; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    if (rawLine.startsWith('!') || rawLine.startsWith('$')) {
      const point = parseAisNmeaSentence(rawLine, new Date(syntheticEpoch + i * 10_000), i);
      if (point) points.push(point);
      continue;
    }

    const cols = rawLine.split(sep).map((c) => c.trim().replace(/['"]/g, ''));
    let lat = 0;
    let lon = 0;
    let sog: number | undefined;
    let cog: number | undefined;
    let mmsi: string | undefined;
    let navStatus: string | undefined;
    let timestamp = new Date(syntheticEpoch + i * 15_000);
    let timestampProvenance: TimestampProvenance = 'synthetic';

    if (latIdx !== -1 && lonIdx !== -1) {
      lat = parseFloat(cols[latIdx]);
      lon = parseFloat(cols[lonIdx]);
      if (sogIdx !== -1 && cols[sogIdx]) sog = parseFloat(cols[sogIdx]);
      if (cogIdx !== -1 && cols[cogIdx]) cog = parseFloat(cols[cogIdx]);
      if (timeIdx !== -1 && cols[timeIdx]) {
        const parsed = new Date(cols[timeIdx]);
        if (!Number.isNaN(parsed.getTime())) {
          timestamp = parsed;
          timestampProvenance = 'source';
        }
      }
      if (mmsiIdx !== -1 && cols[mmsiIdx]) mmsi = cols[mmsiIdx];
      if (statusIdx !== -1 && cols[statusIdx]) navStatus = cols[statusIdx];
    } else {
      const nums = cols.map((c) => parseFloat(c)).filter((n) => !Number.isNaN(n));
      if (nums.length >= 2) {
        lat = nums[0];
        lon = nums[1];
        if (nums.length >= 3) sog = nums[2];
        if (nums.length >= 4) cog = nums[3];
      }
    }

    if (!Number.isNaN(lat) && !Number.isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (lat !== 0 || lon !== 0)) {
      points.push({
        id: `csv-${i}`,
        timestamp,
        lat,
        lon,
        sog: sog !== undefined && !Number.isNaN(sog) ? sog : undefined,
        cog: cog !== undefined && !Number.isNaN(cog) ? cog : undefined,
        mmsi,
        navStatus,
        layer: 'raw',
        provenance: provenance('csv', timestampProvenance, i),
      });
    }
  }

  return points;
}

export function parseGpx(content: string): AisPoint[] {
  const points: AisPoint[] = [];
  const trkptRegex = /<trkpt\s+lat=["']([-0-9.]+)["']\s+lon=["']([-0-9.]+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  const syntheticEpoch = Date.now();

  while ((match = trkptRegex.exec(content)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3];
    let timestamp = new Date(syntheticEpoch + index * 10_000);
    let timestampProvenance: TimestampProvenance = 'synthetic';

    const timeMatch = /<time>([^<]+)<\/time>/i.exec(inner);
    if (timeMatch) {
      const parsed = new Date(timeMatch[1]);
      if (!Number.isNaN(parsed.getTime())) {
        timestamp = parsed;
        timestampProvenance = 'source';
      }
    }

    const speedMatch = /<speed>([^<]+)<\/speed>/i.exec(inner);
    const courseMatch = /<course>([^<]+)<\/course>/i.exec(inner);
    const mps = speedMatch ? parseFloat(speedMatch[1]) : Number.NaN;
    const course = courseMatch ? parseFloat(courseMatch[1]) : Number.NaN;

    if (!Number.isNaN(lat) && !Number.isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      points.push({
        id: `gpx-${index}`,
        timestamp,
        lat,
        lon,
        sog: Number.isNaN(mps) ? undefined : mps * 1.94384,
        cog: Number.isNaN(course) ? undefined : course,
        navStatus: 'GPX Track',
        layer: 'raw',
        provenance: provenance('gpx', timestampProvenance, index),
      });
      index++;
    }
  }

  return points;
}

export function parseAisData(rawText: string, metadata?: Partial<VoyageMetadata>): VoyageData {
  let points: AisPoint[] = [];
  const trimmed = rawText.trim();

  if (trimmed.startsWith('<?xml') || trimmed.includes('<gpx')) {
    points = parseGpx(trimmed);
  } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (Array.isArray(json)) {
        points = json.map((item, idx) => {
          const hasTimestamp = item.timestamp !== undefined && !Number.isNaN(new Date(item.timestamp).getTime());
          return {
            id: `json-${idx}`,
            timestamp: hasTimestamp ? new Date(item.timestamp) : new Date(Date.now() + idx * 10_000),
            lat: parseFloat(item.lat ?? item.latitude),
            lon: parseFloat(item.lon ?? item.lng ?? item.longitude),
            sog: item.sog !== undefined ? parseFloat(item.sog) : undefined,
            cog: item.cog !== undefined ? parseFloat(item.cog) : undefined,
            heading: item.heading !== undefined ? parseFloat(item.heading) : undefined,
            mmsi: item.mmsi !== undefined ? String(item.mmsi) : undefined,
            navStatus: item.navStatus ?? item.status,
            layer: 'raw' as const,
            provenance: provenance('json', hasTimestamp ? 'source' : 'synthetic', idx),
          };
        }).filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lon));
      } else if (Array.isArray(json.features)) {
        points = json.features.map((feature: any, idx: number) => {
          const coords = feature.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2 || feature.geometry?.type !== 'Point') return null;
          const hasTimestamp = feature.properties?.time !== undefined && !Number.isNaN(new Date(feature.properties.time).getTime());
          return {
            id: `geojson-${idx}`,
            timestamp: hasTimestamp ? new Date(feature.properties.time) : new Date(Date.now() + idx * 10_000),
            lat: Number(coords[1]),
            lon: Number(coords[0]),
            sog: feature.properties?.sog ?? feature.properties?.speed,
            cog: feature.properties?.cog ?? feature.properties?.course,
            mmsi: feature.properties?.mmsi !== undefined ? String(feature.properties.mmsi) : undefined,
            layer: 'raw' as const,
            provenance: provenance('geojson', hasTimestamp ? 'source' : 'synthetic', idx),
          } as AisPoint;
        }).filter((p: AisPoint | null): p is AisPoint => Boolean(p));
      }
    } catch {
      points = parseAisCsv(trimmed);
    }
  } else {
    points = parseAisCsv(trimmed);
  }

  return processVoyagePoints(points, metadata);
}

function normalizeRawPoint(point: TrackPointInput, index: number): AisPoint {
  const { distanceFromStartNM: _distance, elapsedSeconds: _elapsed, derivedCog: _derivedCog, derivedSog: _derivedSog, ...source } = point;
  return {
    ...source,
    id: point.id || `raw-${index}`,
    timestamp: new Date(point.timestamp),
    layer: 'raw',
    provenance: point.provenance ?? provenance('unknown', 'unknown', index),
  };
}

export function processVoyagePoints(rawInput: TrackPointInput[], metadataOverride?: Partial<VoyageMetadata>): VoyageData {
  const rawPoints = rawInput.map(normalizeRawPoint);
  const observedMmsi = [...new Set(rawPoints.map((p) => p.mmsi).filter((m): m is string => Boolean(m)))];
  const primaryMmsi = metadataOverride?.mmsi ?? (observedMmsi.length === 1 ? observedMmsi[0] : undefined);

  if (rawPoints.length === 0) {
    return {
      metadata: {
        title: metadataOverride?.title || 'Unbenannter Track',
        vesselName: metadataOverride?.vesselName || 'Unbekanntes Schiff',
        ...metadataOverride,
      },
      rawPoints: [],
      points: [],
      trackContract: {
        version: '0.2.0', rawPointCount: 0, canonicalPointCount: 0,
        sourceFormats: [], timestampProvenance: [], observedMmsi: [], mixedMmsi: false,
      },
      totalDistanceNM: 0,
      avgSpeedKnots: 0,
      maxSpeedKnots: 0,
      durationSeconds: 0,
      startTime: null,
      endTime: null,
      anchorages: [],
      bounds: { minLat: 0, maxLat: 0, minLon: 0, maxLon: 0 },
    };
  }

  const sorted = [...rawPoints].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let totalDistNM = 0;
  let maxSog = 0;
  let speedSum = 0;
  let speedCount = 0;
  const processedPoints: AisPoint[] = [];
  const startEpoch = sorted[0].timestamp.getTime();

  for (let i = 0; i < sorted.length; i++) {
    const source = sorted[i];
    let sog = source.sog;
    let cog = source.cog;
    let derivedSog = false;
    let derivedCog = false;

    if (i > 0) {
      const prev = processedPoints[i - 1];
      const distance = calculateDistanceNM(prev.lat, prev.lon, source.lat, source.lon);
      totalDistNM += distance;
      const deltaHours = (source.timestamp.getTime() - prev.timestamp.getTime()) / 3_600_000;

      if ((sog === undefined || Number.isNaN(sog)) && deltaHours > 0) {
        sog = Math.min(distance / deltaHours, 45);
        derivedSog = true;
      }
      if (cog === undefined || Number.isNaN(cog)) {
        cog = calculateBearing(prev.lat, prev.lon, source.lat, source.lon);
        derivedCog = true;
      }
    }

    if (sog !== undefined && !Number.isNaN(sog)) {
      maxSog = Math.max(maxSog, sog);
      speedSum += sog;
      speedCount++;
    }

    processedPoints.push({
      ...source,
      id: `canonical-${source.id}`,
      layer: 'canonical',
      sog: sog !== undefined ? Math.round(sog * 10) / 10 : undefined,
      cog: cog !== undefined ? Math.round(cog) : undefined,
      derivedSog,
      derivedCog,
      distanceFromStartNM: Math.round(totalDistNM * 100) / 100,
      elapsedSeconds: Math.round((source.timestamp.getTime() - startEpoch) / 1000),
    });
  }

  const anchorages: AnchorageStop[] = [];
  let stopStart: AisPoint | null = null;
  for (const point of processedPoints) {
    const status = point.navStatus?.toLowerCase() || '';
    const isSlow = (point.sog ?? 0) < 0.6 || status.includes('anker') || status.includes('fest');
    if (isSlow && !stopStart) stopStart = point;
    if (!isSlow && stopStart) {
      const durationMinutes = (point.timestamp.getTime() - stopStart.timestamp.getTime()) / 60_000;
      if (durationMinutes >= 25) {
        anchorages.push({
          id: `anchorage-${anchorages.length + 1}`,
          name: `Liegeplatz / Ankerplatz #${anchorages.length + 1}`,
          startPoint: stopStart,
          endPoint: point,
          lat: stopStart.lat,
          lon: stopStart.lon,
          durationMinutes: Math.round(durationMinutes),
        });
      }
      stopStart = null;
    }
  }

  const startTime = processedPoints[0]?.timestamp || null;
  const endTime = processedPoints.at(-1)?.timestamp || null;
  const durationSeconds = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : 0;
  const sourceFormats = [...new Set(rawPoints.map((p) => p.provenance.sourceFormat))];
  const timestampProvenance = [...new Set(rawPoints.map((p) => p.provenance.timestamp))];

  return {
    metadata: {
      title: metadataOverride?.title || 'Importierter AIS Track',
      vesselName: metadataOverride?.vesselName || (primaryMmsi ? `AIS ${primaryMmsi}` : 'Unbekanntes Schiff'),
      mmsi: primaryMmsi,
      callsign: metadataOverride?.callsign,
      skipper: metadataOverride?.skipper,
      vesselType: metadataOverride?.vesselType,
      notes: metadataOverride?.notes,
    },
    rawPoints,
    points: processedPoints,
    trackContract: {
      version: '0.2.0',
      rawPointCount: rawPoints.length,
      canonicalPointCount: processedPoints.length,
      sourceFormats,
      timestampProvenance,
      primaryMmsi,
      observedMmsi,
      mixedMmsi: observedMmsi.length > 1,
    },
    totalDistanceNM: Math.round(totalDistNM * 10) / 10,
    avgSpeedKnots: speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : 0,
    maxSpeedKnots: Math.round(maxSog * 10) / 10,
    durationSeconds,
    startTime,
    endTime,
    anchorages,
    bounds: {
      minLat: Math.min(...processedPoints.map((p) => p.lat)),
      maxLat: Math.max(...processedPoints.map((p) => p.lat)),
      minLon: Math.min(...processedPoints.map((p) => p.lon)),
      maxLon: Math.max(...processedPoints.map((p) => p.lon)),
    },
  };
}
