import {
  AisPoint,
  ImportDetectedFormat,
  ImportNormalizationSummary,
  PointProvenance,
  TimestampProvenance,
  TrackSourceFormat,
} from '../types';

export interface NormalizedImportResult {
  points: AisPoint[];
  summary: ImportNormalizationSummary;
}

interface NmeaEnvelope {
  sentence: string;
  sourceIndex: number;
  timestamp: Date;
  timestampProvenance: TimestampProvenance;
}

interface FragmentBuffer {
  expected: number;
  payloads: Map<number, string>;
  fillBits: number;
  sourceIndices: number[];
  timestamp: Date;
  timestampProvenance: TimestampProvenance;
}

interface NmeaNormalizationResult {
  points: AisPoint[];
  assembledMessages: number;
  incompleteFragments: number;
  ignoredRecords: number;
}

function makeProvenance(
  sourceFormat: TrackSourceFormat,
  timestamp: TimestampProvenance,
  sourceIndex?: number,
  sourceId?: string,
): PointProvenance {
  return { sourceFormat, timestamp, sourceIndex, sourceId };
}

function syntheticTime(epoch: number, index: number, stepMs = 10_000): Date {
  return new Date(epoch + index * stepMs);
}

function validCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && (lat !== 0 || lon !== 0);
}

function parseReceiverTimestamp(prefix: string): Date | null {
  const iso = prefix.match(/\d{4}-\d{2}-\d{2}[T ][0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-][0-2]\d:?\d{2})?/);
  if (iso) {
    const value = new Date(iso[0].replace(' ', 'T'));
    if (!Number.isNaN(value.getTime())) return value;
  }

  const unixMs = prefix.match(/(?:^|\s)(\d{13})(?:\s|$)/);
  if (unixMs) {
    const value = new Date(Number(unixMs[1]));
    if (!Number.isNaN(value.getTime())) return value;
  }

  const unixSeconds = prefix.match(/(?:^|\s)(\d{10})(?:\.\d+)?(?:\s|$)/);
  if (unixSeconds) {
    const value = new Date(Number(unixSeconds[1]) * 1000);
    if (!Number.isNaN(value.getTime())) return value;
  }

  return null;
}

function extractNmeaEnvelope(rawLine: string, index: number, epoch: number): NmeaEnvelope | null {
  const bang = rawLine.indexOf('!');
  const dollar = rawLine.indexOf('$');
  const offsets = [bang, dollar].filter((value) => value >= 0);
  if (offsets.length === 0) return null;
  const start = Math.min(...offsets);
  const sentence = rawLine.slice(start).trim();
  const receiverTime = parseReceiverTimestamp(rawLine.slice(0, start));
  return {
    sentence,
    sourceIndex: index,
    timestamp: receiverTime ?? syntheticTime(epoch, index),
    timestampProvenance: receiverTime ? 'receiver' : 'synthetic',
  };
}

function decodeAisArmoredChar(char: string): number {
  const ascii = char.charCodeAt(0);
  if (ascii < 48 || ascii > 119 || (ascii > 87 && ascii < 96)) return 0;
  let value = ascii - 48;
  if (value > 40) value -= 8;
  return value & 0x3f;
}

function payloadToBitString(payload: string, fillBits = 0): string {
  let bits = '';
  for (const char of payload) bits += decodeAisArmoredChar(char).toString(2).padStart(6, '0');
  return fillBits > 0 ? bits.slice(0, -fillBits) : bits;
}

function parseSignedInt(bits: string): number {
  const value = parseInt(bits, 2);
  return bits[0] === '1' ? value - Math.pow(2, bits.length) : value;
}

function decodeAisPosition(
  payload: string,
  fillBits: number,
  timestamp: Date,
  timestampProvenance: TimestampProvenance,
  sourceIndex: number,
  sourceId: string,
): AisPoint | null {
  try {
    const bits = payloadToBitString(payload, fillBits);
    if (bits.length < 38) return null;
    const messageType = parseInt(bits.slice(0, 6), 2);

    if (messageType === 1 || messageType === 2 || messageType === 3) {
      if (bits.length < 137) return null;
      const mmsi = parseInt(bits.slice(8, 38), 2).toString();
      const statusInt = parseInt(bits.slice(38, 42), 2);
      const sogInt = parseInt(bits.slice(46, 56), 2);
      const lon = parseSignedInt(bits.slice(61, 89)) / 600000;
      const lat = parseSignedInt(bits.slice(89, 116)) / 600000;
      const cogInt = parseInt(bits.slice(116, 128), 2);
      const headingInt = parseInt(bits.slice(128, 137), 2);
      if (!validCoordinate(lat, lon)) return null;

      const navStatuses = [
        'Unter Motor', 'Vor Anker', 'Nicht manövrierfähig', 'Eingeschränkt manövrierfähig',
        'Durch Tiefgang behindert', 'Festgemacht', 'Auf Grund', 'Fischereifahrzeug', 'Unter Segel',
      ];

      return {
        id: `ais-${mmsi}-${sourceIndex}`,
        timestamp,
        lat,
        lon,
        sog: sogInt === 1023 ? undefined : sogInt / 10,
        cog: cogInt === 3600 ? undefined : cogInt / 10,
        heading: headingInt === 511 ? undefined : headingInt,
        navStatus: navStatuses[statusInt] || 'Unterwegs',
        mmsi,
        layer: 'raw',
        provenance: makeProvenance('ais-nmea', timestampProvenance, sourceIndex, sourceId),
      };
    }

    if (messageType === 18) {
      if (bits.length < 124) return null;
      const mmsi = parseInt(bits.slice(8, 38), 2).toString();
      const sogInt = parseInt(bits.slice(46, 56), 2);
      const lon = parseSignedInt(bits.slice(57, 85)) / 600000;
      const lat = parseSignedInt(bits.slice(85, 112)) / 600000;
      const cogInt = parseInt(bits.slice(112, 124), 2);
      if (!validCoordinate(lat, lon)) return null;

      return {
        id: `ais-${mmsi}-${sourceIndex}`,
        timestamp,
        lat,
        lon,
        sog: sogInt === 1023 ? undefined : sogInt / 10,
        cog: cogInt === 3600 ? undefined : cogInt / 10,
        navStatus: 'Unterwegs (Klasse B)',
        mmsi,
        layer: 'raw',
        provenance: makeProvenance('ais-nmea', timestampProvenance, sourceIndex, sourceId),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function parseRmc(envelope: NmeaEnvelope): AisPoint | null {
  const parts = envelope.sentence.split('*')[0].split(',');
  if (!parts[0].endsWith('RMC') || parts.length < 10 || parts[2] !== 'A') return null;
  const rawLat = parseFloat(parts[3]);
  const rawLon = parseFloat(parts[5]);
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLon)) return null;

  const latDegrees = Math.floor(rawLat / 100);
  const lonDegrees = Math.floor(rawLon / 100);
  let lat = latDegrees + (rawLat - latDegrees * 100) / 60;
  let lon = lonDegrees + (rawLon - lonDegrees * 100) / 60;
  if (parts[4] === 'S') lat = -lat;
  if (parts[6] === 'W') lon = -lon;
  if (!validCoordinate(lat, lon)) return null;

  let timestamp = envelope.timestamp;
  let timestampProvenance = envelope.timestampProvenance;
  const rawTime = parts[1];
  const rawDate = parts[9];
  if (rawTime?.length >= 6 && rawDate?.length === 6) {
    const day = Number(rawDate.slice(0, 2));
    const month = Number(rawDate.slice(2, 4));
    const yy = Number(rawDate.slice(4, 6));
    const year = yy >= 80 ? 1900 + yy : 2000 + yy;
    const hour = Number(rawTime.slice(0, 2));
    const minute = Number(rawTime.slice(2, 4));
    const second = Number(rawTime.slice(4, 6));
    const fraction = rawTime.includes('.') ? Number(`0.${rawTime.split('.')[1]}`) : 0;
    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second, Math.round(fraction * 1000)));
    if (!Number.isNaN(parsed.getTime())) {
      timestamp = parsed;
      timestampProvenance = 'source';
    }
  }

  const sog = parseFloat(parts[7]);
  const cog = parseFloat(parts[8]);
  return {
    id: `nmea-rmc-${envelope.sourceIndex}`,
    timestamp,
    lat,
    lon,
    sog: Number.isFinite(sog) ? sog : undefined,
    cog: Number.isFinite(cog) ? cog : undefined,
    navStatus: 'GPS Track',
    layer: 'raw',
    provenance: makeProvenance('gps-nmea', timestampProvenance, envelope.sourceIndex, `rmc:${envelope.sourceIndex}`),
  };
}

function normalizeNmea(lines: string[], epoch: number): NmeaNormalizationResult {
  const points: AisPoint[] = [];
  const fragments = new Map<string, FragmentBuffer>();
  let assembledMessages = 0;
  let ignoredRecords = 0;

  lines.forEach((rawLine, index) => {
    const envelope = extractNmeaEnvelope(rawLine, index, epoch);
    if (!envelope) {
      ignoredRecords++;
      return;
    }

    const rmc = parseRmc(envelope);
    if (rmc) {
      points.push(rmc);
      return;
    }

    const parts = envelope.sentence.split('*')[0].split(',');
    const prefix = parts[0];
    if ((!prefix.includes('VDM') && !prefix.includes('VDO')) || parts.length < 7) {
      ignoredRecords++;
      return;
    }

    const fragmentCount = Number(parts[1]);
    const fragmentNumber = Number(parts[2]);
    const sequenceId = parts[3] || '';
    const channel = parts[4] || '';
    const payload = parts[5];
    const fillBits = Number(parts[6]) || 0;
    if (!payload || fragmentCount < 1 || fragmentNumber < 1 || fragmentNumber > fragmentCount) {
      ignoredRecords++;
      return;
    }

    if (fragmentCount === 1) {
      const point = decodeAisPosition(payload, fillBits, envelope.timestamp, envelope.timestampProvenance, index, `nmea:${index}`);
      if (point) points.push(point); else ignoredRecords++;
      return;
    }

    const key = `${prefix}|${sequenceId || `anonymous-${channel}`}|${channel}|${fragmentCount}`;
    if (fragmentNumber === 1 || !fragments.has(key)) {
      fragments.set(key, {
        expected: fragmentCount,
        payloads: new Map(),
        fillBits: 0,
        sourceIndices: [],
        timestamp: envelope.timestamp,
        timestampProvenance: envelope.timestampProvenance,
      });
    }

    const buffer = fragments.get(key)!;
    buffer.payloads.set(fragmentNumber, payload);
    buffer.sourceIndices.push(index);
    if (fragmentNumber === fragmentCount) buffer.fillBits = fillBits;

    if (buffer.payloads.size === buffer.expected) {
      const ordered: string[] = [];
      for (let part = 1; part <= buffer.expected; part++) {
        const item = buffer.payloads.get(part);
        if (!item) return;
        ordered.push(item);
      }
      assembledMessages++;
      const firstIndex = Math.min(...buffer.sourceIndices);
      const sourceId = `nmea-fragments:${buffer.sourceIndices.join('-')}`;
      const point = decodeAisPosition(ordered.join(''), buffer.fillBits, buffer.timestamp, buffer.timestampProvenance, firstIndex, sourceId);
      if (point) points.push(point); else ignoredRecords++;
      fragments.delete(key);
    }
  });

  return {
    points,
    assembledMessages,
    incompleteFragments: fragments.size,
    ignoredRecords,
  };
}

export function parseAisCsv(content: string): AisPoint[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const epoch = Date.now();
  if (lines.some((line) => line.includes('!AIVDM') || line.includes('!AIVDO') || line.includes('$GPRMC') || line.includes('$GNRMC'))) {
    return normalizeNmea(lines, epoch).points;
  }

  const header = lines[0];
  const separator = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
  const headers = header.split(separator).map((value) => value.trim().toLowerCase().replace(/['"]/g, ''));
  const find = (candidates: string[]) => headers.findIndex((headerValue) => candidates.some((candidate) => headerValue === candidate || headerValue.includes(candidate)));
  const latIndex = find(['lat', 'latitude', 'breite', 'lat_deg']);
  const lonIndex = find(['lon', 'lng', 'longitude', 'länge', 'lon_deg']);
  const timeIndex = find(['timestamp', 'datetime', 'time', 'datum', 'zeit', 'utc']);
  const sogIndex = find(['sog', 'speed', 'knots', 'geschwindigkeit']);
  const cogIndex = find(['cog', 'course', 'kurs', 'richtung']);
  const mmsiIndex = find(['mmsi', 'ship_id', 'vessel_id']);
  const statusIndex = find(['navstatus', 'nav_status', 'status', 'zustand']);
  const startRow = latIndex >= 0 && lonIndex >= 0 ? 1 : 0;
  const points: AisPoint[] = [];

  for (let index = startRow; index < lines.length; index++) {
    const columns = lines[index].split(separator).map((value) => value.trim().replace(/['"]/g, ''));
    let lat: number;
    let lon: number;
    if (latIndex >= 0 && lonIndex >= 0) {
      lat = parseFloat(columns[latIndex]);
      lon = parseFloat(columns[lonIndex]);
    } else {
      const numeric = columns.map(Number).filter(Number.isFinite);
      if (numeric.length < 2) continue;
      [lat, lon] = numeric;
    }
    if (!validCoordinate(lat, lon)) continue;

    let timestamp = syntheticTime(epoch, index, 15_000);
    let timestampProvenance: TimestampProvenance = 'synthetic';
    if (timeIndex >= 0 && columns[timeIndex]) {
      const parsed = new Date(columns[timeIndex]);
      if (!Number.isNaN(parsed.getTime())) {
        timestamp = parsed;
        timestampProvenance = 'source';
      }
    }

    const numberAt = (columnIndex: number): number | undefined => {
      if (columnIndex < 0 || !columns[columnIndex]) return undefined;
      const value = Number(columns[columnIndex]);
      return Number.isFinite(value) ? value : undefined;
    };

    points.push({
      id: `csv-${index}`,
      timestamp,
      lat,
      lon,
      sog: numberAt(sogIndex),
      cog: numberAt(cogIndex),
      mmsi: mmsiIndex >= 0 && columns[mmsiIndex] ? columns[mmsiIndex] : undefined,
      navStatus: statusIndex >= 0 && columns[statusIndex] ? columns[statusIndex] : undefined,
      layer: 'raw',
      provenance: makeProvenance('csv', timestampProvenance, index, `csv:${index}`),
    });
  }
  return points;
}

export function parseGpx(content: string): AisPoint[] {
  const points: AisPoint[] = [];
  const regex = /<trkpt\s+lat=["']([-0-9.]+)["']\s+lon=["']([-0-9.]+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;
  const epoch = Date.now();
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = regex.exec(content)) !== null) {
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (!validCoordinate(lat, lon)) continue;
    const inner = match[3];
    const timeMatch = /<time>([^<]+)<\/time>/i.exec(inner);
    const speedMatch = /<speed>([^<]+)<\/speed>/i.exec(inner);
    const courseMatch = /<course>([^<]+)<\/course>/i.exec(inner);
    const parsedTime = timeMatch ? new Date(timeMatch[1]) : null;
    const hasTime = parsedTime !== null && !Number.isNaN(parsedTime.getTime());
    const speedMps = speedMatch ? Number(speedMatch[1]) : Number.NaN;
    const course = courseMatch ? Number(courseMatch[1]) : Number.NaN;
    points.push({
      id: `gpx-${index}`,
      timestamp: hasTime ? parsedTime! : syntheticTime(epoch, index),
      lat,
      lon,
      sog: Number.isFinite(speedMps) ? speedMps * 1.94384 : undefined,
      cog: Number.isFinite(course) ? course : undefined,
      navStatus: 'GPX Track',
      layer: 'raw',
      provenance: makeProvenance('gpx', hasTime ? 'source' : 'synthetic', index, `gpx:${index}`),
    });
    index++;
  }
  return points;
}

function parseJson(content: string): { points: AisPoint[]; format: ImportDetectedFormat } {
  const json = JSON.parse(content);
  const epoch = Date.now();
  if (Array.isArray(json)) {
    const points = json.map((item, index) => {
      const lat = Number(item.lat ?? item.latitude);
      const lon = Number(item.lon ?? item.lng ?? item.longitude);
      if (!validCoordinate(lat, lon)) return null;
      const parsedTime = item.timestamp !== undefined ? new Date(item.timestamp) : null;
      const hasTime = parsedTime !== null && !Number.isNaN(parsedTime.getTime());
      const numberValue = (value: unknown): number | undefined => {
        const number = Number(value);
        return value !== undefined && Number.isFinite(number) ? number : undefined;
      };
      return {
        id: `json-${index}`,
        timestamp: hasTime ? parsedTime! : syntheticTime(epoch, index),
        lat,
        lon,
        sog: numberValue(item.sog),
        cog: numberValue(item.cog),
        heading: numberValue(item.heading),
        mmsi: item.mmsi !== undefined ? String(item.mmsi) : undefined,
        navStatus: item.navStatus ?? item.status,
        layer: 'raw' as const,
        provenance: makeProvenance('json', hasTime ? 'source' : 'synthetic', index, `json:${index}`),
      };
    }).filter((point): point is AisPoint => point !== null);
    return { points, format: 'json' };
  }

  if (Array.isArray(json?.features)) {
    const points = json.features.map((feature: any, index: number) => {
      if (feature.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) return null;
      const lon = Number(feature.geometry.coordinates[0]);
      const lat = Number(feature.geometry.coordinates[1]);
      if (!validCoordinate(lat, lon)) return null;
      const rawTime = feature.properties?.time ?? feature.properties?.timestamp;
      const parsedTime = rawTime !== undefined ? new Date(rawTime) : null;
      const hasTime = parsedTime !== null && !Number.isNaN(parsedTime.getTime());
      return {
        id: `geojson-${index}`,
        timestamp: hasTime ? parsedTime! : syntheticTime(epoch, index),
        lat,
        lon,
        sog: Number.isFinite(Number(feature.properties?.sog ?? feature.properties?.speed)) ? Number(feature.properties?.sog ?? feature.properties?.speed) : undefined,
        cog: Number.isFinite(Number(feature.properties?.cog ?? feature.properties?.course)) ? Number(feature.properties?.cog ?? feature.properties?.course) : undefined,
        mmsi: feature.properties?.mmsi !== undefined ? String(feature.properties.mmsi) : undefined,
        navStatus: feature.properties?.navStatus ?? feature.properties?.status,
        layer: 'raw' as const,
        provenance: makeProvenance('geojson', hasTime ? 'source' : 'synthetic', index, `geojson:${index}`),
      };
    }).filter((point: AisPoint | null): point is AisPoint => point !== null);
    return { points, format: 'geojson' };
  }
  return { points: [], format: 'unknown' };
}

export function normalizeImportText(rawText: string): NormalizedImportResult {
  const trimmed = rawText.trim();
  const records = trimmed ? trimmed.split(/\r?\n/).filter((line) => line.trim()).length : 0;
  let points: AisPoint[] = [];
  let detectedFormat: ImportDetectedFormat = 'unknown';
  let assembledNmeaMessages = 0;
  let incompleteNmeaFragments = 0;
  let ignoredRecords = 0;

  if (trimmed.startsWith('<?xml') || trimmed.includes('<gpx')) {
    detectedFormat = 'gpx';
    points = parseGpx(trimmed);
  } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const result = parseJson(trimmed);
      detectedFormat = result.format;
      points = result.points;
    } catch {
      detectedFormat = 'csv';
      points = parseAisCsv(trimmed);
    }
  } else {
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
    const nmeaLike = lines.filter((line) => line.includes('!AIVDM') || line.includes('!AIVDO') || line.includes('$GPRMC') || line.includes('$GNRMC'));
    if (nmeaLike.length > 0) {
      const result = normalizeNmea(lines, Date.now());
      detectedFormat = nmeaLike.length === lines.length ? 'nmea' : 'mixed';
      points = result.points;
      assembledNmeaMessages = result.assembledMessages;
      incompleteNmeaFragments = result.incompleteFragments;
      ignoredRecords = result.ignoredRecords;
    } else {
      detectedFormat = 'csv';
      points = parseAisCsv(trimmed);
    }
  }

  if (ignoredRecords === 0) ignoredRecords = Math.max(0, records - points.length);
  return {
    points,
    summary: {
      version: '0.3.0',
      detectedFormat,
      inputRecords: records,
      normalizedPoints: points.length,
      ignoredRecords,
      assembledNmeaMessages,
      incompleteNmeaFragments,
    },
  };
}
