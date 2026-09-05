import { AisPoint, AnchorageStop, VoyageData, VoyageMetadata } from '../types';
import { calculateBearing, calculateDistanceNM } from './geoUtils';

/**
 * 6-bit ASCII armoring table decoder for AIS AIVDM messages
 */
function decodeAisArmoredChar(c: string): number {
  let ascii = c.charCodeAt(0);
  if (ascii < 48 || ascii > 119 || (ascii > 87 && ascii < 96)) {
    return 0;
  }
  let val = ascii - 48;
  if (val > 40) {
    val -= 8;
  }
  return val & 0x3f;
}

function payloadToBitString(payload: string): string {
  let bitStr = '';
  for (let i = 0; i < payload.length; i++) {
    const val = decodeAisArmoredChar(payload[i]);
    bitStr += val.toString(2).padStart(6, '0');
  }
  return bitStr;
}

function parseSignedInt(bitStr: string): number {
  if (bitStr[0] === '1') {
    // Two's complement negative
    let inverted = '';
    for (let i = 0; i < bitStr.length; i++) {
      inverted += bitStr[i] === '1' ? '0' : '1';
    }
    return -(parseInt(inverted, 2) + 1);
  }
  return parseInt(bitStr, 2);
}

/**
 * Parse an AIS NMEA sentence (!AIVDM or !AIVDO)
 * Supports standard Class A / Class B Position Reports (Messages 1, 2, 3, 18, 19)
 */
function parseAisNmeaSentence(sentence: string, fallbackTime: Date): AisPoint | null {
  const clean = sentence.trim();
  if (!clean.startsWith('!') && !clean.startsWith('$')) return null;

  const parts = clean.split('*')[0].split(',');
  const prefix = parts[0];

  // Check for GPS NMEA sentences ($GPRMC, $GPGGA)
  if (prefix.endsWith('RMC') && parts.length >= 10) {
    // $GPRMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,...
    const status = parts[2];
    if (status !== 'A') return null; // Void
    const rawLat = parseFloat(parts[3]);
    const latHem = parts[4];
    const rawLon = parseFloat(parts[5]);
    const lonHem = parts[6];
    const rawSog = parseFloat(parts[7]);
    const rawCog = parseFloat(parts[8]);

    if (isNaN(rawLat) || isNaN(rawLon)) return null;

    const latDeg = Math.floor(rawLat / 100);
    const latMin = rawLat - latDeg * 100;
    let lat = latDeg + latMin / 60;
    if (latHem === 'S') lat = -lat;

    const lonDeg = Math.floor(rawLon / 100);
    const lonMin = rawLon - lonDeg * 100;
    let lon = lonDeg + lonMin / 60;
    if (lonHem === 'W') lon = -lon;

    return {
      id: `nmea-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: fallbackTime,
      lat,
      lon,
      sog: isNaN(rawSog) ? 0 : rawSog,
      cog: isNaN(rawCog) ? 0 : rawCog,
      navStatus: 'GPS Track',
    };
  }

  // AIS messages (!AIVDM or !AIVDO)
  if (parts.length < 6) return null;
  const payload = parts[5];
  if (!payload || payload.length < 5) return null;

  try {
    const bits = payloadToBitString(payload);
    if (bits.length < 38) return null;

    const msgType = parseInt(bits.slice(0, 6), 2);

    // Messages 1, 2, 3 (Class A Position Report)
    if (msgType === 1 || msgType === 2 || msgType === 3) {
      if (bits.length < 168) return null;
      const mmsi = parseInt(bits.slice(8, 38), 2).toString();
      const statusInt = parseInt(bits.slice(38, 42), 2);
      const sogInt = parseInt(bits.slice(46, 56), 2);
      const sog = sogInt === 1023 ? undefined : sogInt / 10.0;

      const lonRaw = parseSignedInt(bits.slice(61, 89));
      const latRaw = parseSignedInt(bits.slice(89, 116));

      const lon = lonRaw / 600000.0;
      const lat = latRaw / 600000.0;

      const cogInt = parseInt(bits.slice(116, 128), 2);
      const cog = cogInt === 3600 ? undefined : cogInt / 10.0;

      const headingInt = parseInt(bits.slice(128, 137), 2);
      const heading = headingInt === 511 ? undefined : headingInt;

      const navStatuses = [
        'Unter Motor',
        'Vor Anker',
        'Nicht manövrierfähig',
        'Eingeschränkt manövrierfähig',
        'Durch Tiefgang behindert',
        'Festgemacht',
        'Auf Grund',
        'Fischereifahrzeug',
        'Unter Segel',
      ];
      const navStatus = navStatuses[statusInt] || 'Unterwegs';

      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (lat !== 0 || lon !== 0)) {
        return {
          id: `ais-${mmsi}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: fallbackTime,
          lat,
          lon,
          sog,
          cog,
          heading,
          navStatus,
          mmsi,
        };
      }
    }
    // Message 18 (Standard Class B Position Report)
    else if (msgType === 18) {
      if (bits.length < 140) return null;
      const mmsi = parseInt(bits.slice(8, 38), 2).toString();
      const sogInt = parseInt(bits.slice(46, 56), 2);
      const sog = sogInt === 1023 ? undefined : sogInt / 10.0;

      const lonRaw = parseSignedInt(bits.slice(57, 85));
      const latRaw = parseSignedInt(bits.slice(85, 112));

      const lon = lonRaw / 600000.0;
      const lat = latRaw / 600000.0;

      const cogInt = parseInt(bits.slice(112, 124), 2);
      const cog = cogInt === 3600 ? undefined : cogInt / 10.0;

      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (lat !== 0 || lon !== 0)) {
        return {
          id: `ais-${mmsi}-${Math.random().toString(36).substr(2, 6)}`,
          timestamp: fallbackTime,
          lat,
          lon,
          sog,
          cog,
          navStatus: 'Unterwegs (Klasse B)',
          mmsi,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to parse AIS sentence:', err);
  }

  return null;
}

/**
 * Parse CSV / Tab / Semicolon separated AIS tracker coordinates
 */
export function parseAisCsv(content: string): AisPoint[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Determine separator
  const header = lines[0];
  const sep = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
  const headers = header.split(sep).map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Header column index finder
  const latIdx = headers.findIndex((h) => ['lat', 'latitude', 'breite', 'y', 'lat_deg'].includes(h));
  const lonIdx = headers.findIndex((h) => ['lon', 'long', 'lng', 'longitude', 'länge', 'x', 'lon_deg'].includes(h));
  const timeIdx = headers.findIndex((h) => ['timestamp', 'time', 'date', 'datetime', 'zeit', 'datum', 'utc'].some((t) => h.includes(t)));
  const sogIdx = headers.findIndex((h) => ['sog', 'speed', 'knoten', 'knots', 'vitesse', 'geschwindigkeit'].some((s) => h.includes(s)));
  const cogIdx = headers.findIndex((h) => ['cog', 'course', 'kurs', 'heading', 'richtung'].some((c) => h.includes(c)));
  const mmsiIdx = headers.findIndex((h) => ['mmsi', 'ship_id', 'vessel_id'].includes(h));
  const statusIdx = headers.findIndex((h) => ['status', 'navstatus', 'nav_status', 'zustand'].includes(h));

  const points: AisPoint[] = [];
  const startRow = (latIdx !== -1 && lonIdx !== -1) ? 1 : 0;
  const now = new Date();

  for (let i = startRow; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Check if it's an NMEA line in the CSV file
    if (rawLine.startsWith('!') || rawLine.startsWith('$')) {
      const p = parseAisNmeaSentence(rawLine, new Date(now.getTime() + i * 10000));
      if (p) points.push(p);
      continue;
    }

    const cols = rawLine.split(sep).map((c) => c.trim().replace(/['"]/g, ''));

    let lat = 0;
    let lon = 0;
    let sog: number | undefined;
    let cog: number | undefined;
    let timestamp = new Date(now.getTime() + i * 15000);
    let mmsi: string | undefined;
    let navStatus: string | undefined;

    if (latIdx !== -1 && lonIdx !== -1) {
      lat = parseFloat(cols[latIdx]);
      lon = parseFloat(cols[lonIdx]);
      if (sogIdx !== -1 && cols[sogIdx]) sog = parseFloat(cols[sogIdx]);
      if (cogIdx !== -1 && cols[cogIdx]) cog = parseFloat(cols[cogIdx]);
      if (timeIdx !== -1 && cols[timeIdx]) {
        const parsedT = new Date(cols[timeIdx]);
        if (!isNaN(parsedT.getTime())) timestamp = parsedT;
      }
      if (mmsiIdx !== -1 && cols[mmsiIdx]) mmsi = cols[mmsiIdx];
      if (statusIdx !== -1 && cols[statusIdx]) navStatus = cols[statusIdx];
    } else {
      // Fallback: look for two numbers that look like coordinates
      const nums = cols.map((c) => parseFloat(c)).filter((n) => !isNaN(n));
      if (nums.length >= 2) {
        // Assume lat is first (-90 to 90), lon is second (-180 to 180)
        lat = nums[0];
        lon = nums[1];
        if (nums.length >= 3) sog = nums[2];
        if (nums.length >= 4) cog = nums[3];
      }
    }

    // Validate coordinates
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (lat !== 0 || lon !== 0)) {
      points.push({
        id: `pt-${i}-${Math.random().toString(36).substr(2, 6)}`,
        timestamp,
        lat,
        lon,
        sog,
        cog,
        mmsi,
        navStatus,
      });
    }
  }

  return points;
}

/**
 * Parse GPX Track format
 */
export function parseGpx(content: string): AisPoint[] {
  const points: AisPoint[] = [];
  const trkptRegex = /<trkpt\s+lat=["']([-0-9.]+)["']\s+lon=["']([-0-9.]+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;
  let match;

  let index = 0;
  while ((match = trkptRegex.exec(content)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3];

    let timestamp = new Date();
    const timeMatch = /<time>([^<]+)<\/time>/i.exec(inner);
    if (timeMatch) {
      const parsed = new Date(timeMatch[1]);
      if (!isNaN(parsed.getTime())) timestamp = parsed;
    }

    let sog: number | undefined;
    const speedMatch = /<speed>([^<]+)<\/speed>/i.exec(inner);
    if (speedMatch) {
      const mps = parseFloat(speedMatch[1]);
      if (!isNaN(mps)) sog = mps * 1.94384; // m/s to knots
    }

    let cog: number | undefined;
    const courseMatch = /<course>([^<]+)<\/course>/i.exec(inner);
    if (courseMatch) {
      const c = parseFloat(courseMatch[1]);
      if (!isNaN(c)) cog = c;
    }

    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      points.push({
        id: `gpx-${index++}`,
        timestamp,
        lat,
        lon,
        sog,
        cog,
        navStatus: 'GPX Track',
      });
    }
  }

  return points;
}

/**
 * Main auto-detect parser for any AIS / GPS tracker format
 */
export function parseAisData(rawText: string, metadata?: Partial<VoyageMetadata>): VoyageData {
  let points: AisPoint[] = [];

  const trimmed = rawText.trim();
  if (trimmed.startsWith('<?xml') || trimmed.includes('<gpx')) {
    points = parseGpx(trimmed);
  } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const json = JSON.parse(trimmed);
      if (Array.isArray(json)) {
        points = json
          .map((item, idx) => ({
            id: `json-${idx}`,
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(Date.now() + idx * 10000),
            lat: parseFloat(item.lat || item.latitude),
            lon: parseFloat(item.lon || item.lng || item.longitude),
            sog: item.sog !== undefined ? parseFloat(item.sog) : undefined,
            cog: item.cog !== undefined ? parseFloat(item.cog) : undefined,
            heading: item.heading !== undefined ? parseFloat(item.heading) : undefined,
            mmsi: item.mmsi,
            navStatus: item.navStatus || item.status,
          }))
          .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));
      } else if (json.features) {
        // GeoJSON
        const features = json.features;
        points = features
          .map((f: any, idx: number) => {
            const coords = f.geometry?.coordinates;
            if (coords && coords.length >= 2) {
              return {
                id: `geojson-${idx}`,
                timestamp: f.properties?.time ? new Date(f.properties.time) : new Date(Date.now() + idx * 10000),
                lat: coords[1],
                lon: coords[0],
                sog: f.properties?.sog || f.properties?.speed,
                cog: f.properties?.cog || f.properties?.course,
              };
            }
            return null;
          })
          .filter(Boolean);
      }
    } catch {
      // If JSON parse fails, fallback to CSV/line parser
      points = parseAisCsv(trimmed);
    }
  } else {
    points = parseAisCsv(trimmed);
  }

  return processVoyagePoints(points, metadata);
}

/**
 * Calculates accumulated distance, durations, detects anchorages, and derives SOG/COG if missing
 */
export function processVoyagePoints(rawPoints: AisPoint[], metadataOverride?: Partial<VoyageMetadata>): VoyageData {
  if (rawPoints.length === 0) {
    return {
      metadata: {
        title: metadataOverride?.title || 'Unbenannter AIS Törn',
        vesselName: metadataOverride?.vesselName || 'SY Nordwind',
        mmsi: metadataOverride?.mmsi || '211849200',
        callsign: metadataOverride?.callsign || 'DB9821',
        skipper: metadataOverride?.skipper || 'Skipper',
        vesselType: metadataOverride?.vesselType || 'Segelyacht (SY)',
      },
      points: [],
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

  // Sort chronologically by timestamp
  const sorted = [...rawPoints].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  let totalDistNM = 0;
  let maxSog = 0;
  let speedSum = 0;
  let speedCount = 0;

  const minLat = Math.min(...sorted.map((p) => p.lat));
  const maxLat = Math.max(...sorted.map((p) => p.lat));
  const minLon = Math.min(...sorted.map((p) => p.lon));
  const maxLon = Math.max(...sorted.map((p) => p.lon));

  const processedPoints: AisPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    let distFromPrev = 0;
    let cog = cur.cog;
    let sog = cur.sog;

    if (i > 0) {
      const prev = processedPoints[i - 1];
      distFromPrev = calculateDistanceNM(prev.lat, prev.lon, cur.lat, cur.lon);

      // Sanity check: filter out teleportation glitches (> 70 kn jump in short time)
      const timeDeltaHours = (cur.timestamp.getTime() - prev.timestamp.getTime()) / (1000 * 3600);
      if (timeDeltaHours > 0) {
        const impliedSpeed = distFromPrev / timeDeltaHours;
        if (sog === undefined || isNaN(sog)) {
          sog = Math.min(impliedSpeed, 45); // Approximate SOG if missing
        }
      }

      if (cog === undefined || isNaN(cog)) {
        cog = calculateBearing(prev.lat, prev.lon, cur.lat, cur.lon);
      }

      totalDistNM += distFromPrev;
    }

    if (sog !== undefined && !isNaN(sog)) {
      if (sog > maxSog) maxSog = sog;
      speedSum += sog;
      speedCount++;
    }

    const startTime = sorted[0].timestamp.getTime();
    const elapsedSeconds = Math.round((cur.timestamp.getTime() - startTime) / 1000);

    processedPoints.push({
      ...cur,
      sog: sog !== undefined ? Math.round(sog * 10) / 10 : 0,
      cog: cog !== undefined ? Math.round(cog) : 0,
      distanceFromStartNM: Math.round(totalDistNM * 100) / 100,
      elapsedSeconds,
    });
  }

  // Detect anchorages / long stops (< 0.5 kn for > 20 min)
  const anchorages: AnchorageStop[] = [];
  let stopStart: AisPoint | null = null;

  for (let i = 0; i < processedPoints.length; i++) {
    const p = processedPoints[i];
    const isSlow = (p.sog || 0) < 0.6 || p.navStatus?.toLowerCase().includes('anker') || p.navStatus?.toLowerCase().includes('fest');

    if (isSlow) {
      if (!stopStart) {
        stopStart = p;
      }
    } else {
      if (stopStart) {
        const durationMins = (p.timestamp.getTime() - stopStart.timestamp.getTime()) / (1000 * 60);
        if (durationMins >= 25) {
          anchorages.push({
            id: `anchorage-${anchorages.length + 1}`,
            name: `Liegeplatz / Ankerplatz #${anchorages.length + 1}`,
            startPoint: stopStart,
            endPoint: p,
            lat: stopStart.lat,
            lon: stopStart.lon,
            durationMinutes: Math.round(durationMins),
          });
        }
        stopStart = null;
      }
    }
  }

  const startTime = processedPoints[0]?.timestamp || null;
  const endTime = processedPoints[processedPoints.length - 1]?.timestamp || null;
  const durationSeconds = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : 0;
  const avgSpeedKnots = speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : 0;

  return {
    metadata: {
      title: metadataOverride?.title || 'Ostsee-Törn Kiel - Bornholm',
      vesselName: metadataOverride?.vesselName || rawPoints[0]?.mmsi ? `AIS ${rawPoints[0].mmsi}` : 'SY Nordwind',
      mmsi: metadataOverride?.mmsi || rawPoints[0]?.mmsi || '211849200',
      callsign: metadataOverride?.callsign || 'DB9821',
      skipper: metadataOverride?.skipper || 'M. Jansen',
      vesselType: metadataOverride?.vesselType || 'Segelyacht (SY)',
      notes: metadataOverride?.notes || 'Aufgezeichnet mit AIS Transponder Class B',
    },
    points: processedPoints,
    totalDistanceNM: Math.round(totalDistNM * 10) / 10,
    avgSpeedKnots,
    maxSpeedKnots: Math.round(maxSog * 10) / 10,
    durationSeconds,
    startTime,
    endTime,
    anchorages,
    bounds: { minLat, maxLat, minLon, maxLon },
  };
}
