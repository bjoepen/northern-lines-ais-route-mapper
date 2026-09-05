import { VoyageData } from '../types';
import { processVoyagePoints } from '../utils/aisParser';

// Generator helper to produce realistic smooth AIS track points between waypoints
function generateAisTrack(
  waypoints: { lat: number; lon: number; sog: number; durationMin: number; note?: string }[],
  startDate: Date,
  vesselInfo: { title: string; vesselName: string; mmsi: string; callsign: string; skipper: string; vesselType: string }
): VoyageData {
  const points = [];
  let currentTime = new Date(startDate);
  let ptIndex = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const wp1 = waypoints[i];
    const wp2 = waypoints[i + 1];

    // Number of interpolated points (e.g. 1 point every 3-5 minutes)
    const steps = Math.max(4, Math.round(wp1.durationMin / 4));

    for (let s = 0; s < steps; s++) {
      const frac = s / steps;
      // Slight natural wind/tide wander
      const wanderLat = Math.sin(s * 0.8) * 0.0015;
      const wanderLon = Math.cos(s * 0.7) * 0.002;

      const lat = wp1.lat + (wp2.lat - wp1.lat) * frac + wanderLat;
      const lon = wp1.lon + (wp2.lon - wp1.lon) * frac + wanderLon;

      // Speed with slight gust/current variation
      const sog = Math.max(0, wp1.sog + (wp2.sog - wp1.sog) * frac + Math.sin(s * 1.2) * 0.4);

      // COG derived from direction to next point
      const dLat = wp2.lat - wp1.lat;
      const dLon = wp2.lon - wp1.lon;
      let cog = (Math.atan2(dLon, dLat) * 180) / Math.PI;
      if (cog < 0) cog += 360;

      const stepTimeMs = (wp1.durationMin * 60 * 1000) / steps;
      currentTime = new Date(currentTime.getTime() + stepTimeMs);

      points.push({
        id: `ais-pt-${ptIndex++}`,
        timestamp: new Date(currentTime),
        lat,
        lon,
        sog: Math.round(sog * 10) / 10,
        cog: Math.round(cog),
        mmsi: vesselInfo.mmsi,
        navStatus: sog < 1.0 ? 'Im Hafen / Vor Anker' : 'Unter Segel',
      });
    }
  }

  // Add final destination point
  const lastWp = waypoints[waypoints.length - 1];
  points.push({
    id: `ais-pt-${ptIndex++}`,
    timestamp: new Date(currentTime.getTime() + 10 * 60 * 1000),
    lat: lastWp.lat,
    lon: lastWp.lon,
    sog: lastWp.sog,
    cog: 90,
    mmsi: vesselInfo.mmsi,
    navStatus: 'Festgemacht',
  });

  return processVoyagePoints(points, vesselInfo);
}

// 1. Ostsee-Törn: Kiel Schilksee -> Fehmarnbelt -> Gedser -> Bornholm (Rønne)
export const sampleOstseeVoyage: VoyageData = generateAisTrack(
  [
    { lat: 54.428, lon: 10.169, sog: 2.1, durationMin: 20, note: 'Auslaufen Olympiahafen Schilksee' },
    { lat: 54.498, lon: 10.275, sog: 6.2, durationMin: 45, note: 'Passieren Kieler Leuchtturm' },
    { lat: 54.552, lon: 10.650, sog: 7.4, durationMin: 90, note: 'Querab Schönberger Strand' },
    { lat: 54.460, lon: 11.120, sog: 5.8, durationMin: 80, note: 'Fehmarnsund-Passage' },
    { lat: 54.420, lon: 11.310, sog: 7.8, durationMin: 60, note: 'Staberhuk Leuchtturm' },
    { lat: 54.510, lon: 11.750, sog: 8.4, durationMin: 75, note: 'Einfahrt Mecklenburger Bucht' },
    { lat: 54.560, lon: 12.020, sog: 7.9, durationMin: 65, note: 'Gedser Rev Großschifffahrtsweg' },
    { lat: 54.720, lon: 12.350, sog: 7.2, durationMin: 85, note: 'Darßer Schwelle' },
    { lat: 54.950, lon: 12.580, sog: 6.9, durationMin: 70, note: 'Südlich Møn Kreidefelsen' },
    { lat: 55.080, lon: 13.350, sog: 7.5, durationMin: 95, note: 'Kriegers Flak Windpark' },
    { lat: 55.150, lon: 14.100, sog: 8.1, durationMin: 90, note: 'Ansteuerung Bornholmsgat' },
    { lat: 55.120, lon: 14.520, sog: 6.5, durationMin: 60, note: 'Hammer Odde Leuchtturm' },
    { lat: 55.097, lon: 14.685, sog: 2.2, durationMin: 35, note: 'Einlaufen Rønne Marina' },
  ],
  new Date('2024-07-12T07:30:00Z'),
  {
    title: 'Großer Ostsee-Törn: Kiel nach Bornholm',
    vesselName: 'SY Nordwind',
    mmsi: '211849200',
    callsign: 'DB9821',
    skipper: 'Markus Jansen',
    vesselType: 'Segelyacht (Hallberg-Rassy 40C)',
  }
);

// 2. Nordsee Helgoland Törn: Hamburg Elbe -> Cuxhaven -> Helgoland
export const sampleHelgolandVoyage: VoyageData = generateAisTrack(
  [
    { lat: 53.545, lon: 9.967, sog: 3.5, durationMin: 20, note: 'Start Hamburg City Sporthafen' },
    { lat: 53.555, lon: 9.805, sog: 7.8, durationMin: 45, note: 'Vorbei an Blankenese & Wittenbergen' },
    { lat: 53.570, lon: 9.680, sog: 8.2, durationMin: 30, note: 'Schulau Willkomm-Höft' },
    { lat: 53.725, lon: 9.410, sog: 8.9, durationMin: 50, note: 'Glückstadt Reede' },
    { lat: 53.885, lon: 9.130, sog: 9.1, durationMin: 40, note: 'Brunsbüttel NOK Schleuse' },
    { lat: 53.870, lon: 8.710, sog: 8.5, durationMin: 60, note: 'Cuxhaven Alte Liebe' },
    { lat: 53.940, lon: 8.420, sog: 8.1, durationMin: 45, note: 'Elbe 1 Feuerschiff-Position' },
    { lat: 54.080, lon: 8.080, sog: 7.4, durationMin: 65, note: 'Offene Deutsche Bucht' },
    { lat: 54.180, lon: 7.895, sog: 3.0, durationMin: 30, note: 'Helgoland Südhafen Mole' },
  ],
  new Date('2024-08-04T05:45:00Z'),
  {
    title: 'Nordsee-Raid: Elbe & Helgoland',
    vesselName: 'MY Hanseatic',
    mmsi: '211993410',
    callsign: 'DJ4412',
    skipper: 'Kpt. Dirk Petersen',
    vesselType: 'Motoryacht (Targa 37)',
  }
);

// 3. Balearen Törn: Mallorca -> Cabrera -> Formentera -> Ibiza
export const sampleBalearenVoyage: VoyageData = generateAisTrack(
  [
    { lat: 39.565, lon: 2.635, sog: 2.5, durationMin: 25, note: 'Palma de Mallorca Club de Mar' },
    { lat: 39.460, lon: 2.750, sog: 6.4, durationMin: 50, note: 'Cala Blava' },
    { lat: 39.290, lon: 2.920, sog: 7.2, durationMin: 60, note: 'Cap de ses Salines' },
    { lat: 39.145, lon: 2.935, sog: 0.3, durationMin: 40, note: 'Ankerfeld Nationalpark Cabrera' },
    { lat: 38.980, lon: 2.450, sog: 7.6, durationMin: 90, note: 'Offenes Mittelmeer Richtung Pityusen' },
    { lat: 38.780, lon: 1.430, sog: 6.8, durationMin: 80, note: 'Espalmador Bucht Formentera' },
    { lat: 38.910, lon: 1.445, sog: 3.2, durationMin: 35, note: 'Ibiza Marina Botafoch' },
  ],
  new Date('2024-09-18T09:00:00Z'),
  {
    title: 'Balearen-Passage: Mallorca - Cabrera - Ibiza',
    vesselName: 'SY Tramuntana',
    mmsi: '224719880',
    callsign: 'EA8721',
    skipper: 'Sophia Alvarez',
    vesselType: 'Katamaran (Lagoon 46)',
  }
);

export const PRESET_VOYAGES = [
  { id: 'ostsee', label: 'Ostsee: Kiel → Bornholm', data: sampleOstseeVoyage, icon: 'Compass' },
  { id: 'helgoland', label: 'Nordsee: Hamburg → Helgoland', data: sampleHelgolandVoyage, icon: 'Anchor' },
  { id: 'balearen', label: 'Balearen: Mallorca → Ibiza', data: sampleBalearenVoyage, icon: 'Sailboat' },
];
