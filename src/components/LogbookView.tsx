import React from 'react';
import { AnchorageStop, VoyageData, VoyageMetadata } from '../types';
import { 
  formatNauticalCoordinate, 
  formatKnots, 
  formatDegrees,
  formatNM, 
  formatDuration 
} from '../utils/geoUtils';
import { 
  Ship, 
  Anchor, 
  Compass, 
  Gauge, 
  Clock, 
  MapPin, 
  Calendar, 
  Activity,
  Award,
  Edit3
} from 'lucide-react';

interface LogbookViewProps {
  voyage: VoyageData;
  onUpdateMetadata: (metadata: Partial<VoyageMetadata>) => void;
  onSelectAnchorage: (anchorage: AnchorageStop) => void;
}

export const LogbookView: React.FC<LogbookViewProps> = ({
  voyage,
  onUpdateMetadata,
  onSelectAnchorage,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [metaDraft, setMetaDraft] = React.useState<VoyageMetadata>(voyage.metadata);

  const points = voyage.points;
  const startPt = points[0];
  const endPt = points[points.length - 1];

  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateMetadata(metaDraft);
    setIsEditing(false);
  };

  // Generate SVG points for speed profile chart
  const maxSog = Math.max(voyage.maxSpeedKnots, 10);
  const totalDist = voyage.totalDistanceNM || 1;
  const chartPoints = points.map((p) => {
    const xPercent = ((p.distanceFromStartNM || 0) / totalDist) * 100;
    const yPercent = 100 - ((p.sog || 0) / maxSog) * 100;
    return `${xPercent.toFixed(1)},${yPercent.toFixed(1)}`;
  });
  const svgPolyline = chartPoints.join(' ');

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-950 p-6 text-slate-100 select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header with Title & Vessel Metadata */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                AIS Reiselogbuch
              </span>
              <span className="text-xs text-slate-400 font-mono">MMSI: {voyage.metadata.mmsi || '--'}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">{voyage.metadata.title}</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {voyage.metadata.vesselName} • {voyage.metadata.vesselType || 'Segelyacht'} • Skipper: {voyage.metadata.skipper || 'Unbekannt'}
            </p>
          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors self-start md:self-auto"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isEditing ? 'Schließen' : 'Schiffsdaten bearbeiten'}</span>
          </button>
        </div>

        {/* Metadata Editor Form (Modal/Drawer style) */}
        {isEditing && (
          <form onSubmit={handleSaveMeta} className="bg-slate-900 border border-cyan-500/40 rounded-xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-cyan-300">Schiffs- & Törndaten anpassen</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Törn-Bezeichnung</label>
                <input
                  type="text"
                  value={metaDraft.title}
                  onChange={(e) => setMetaDraft({ ...metaDraft, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Schiffsname</label>
                <input
                  type="text"
                  value={metaDraft.vesselName}
                  onChange={(e) => setMetaDraft({ ...metaDraft, vesselName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Schiffstyp / Modell</label>
                <input
                  type="text"
                  value={metaDraft.vesselType || ''}
                  onChange={(e) => setMetaDraft({ ...metaDraft, vesselType: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">MMSI Nummer</label>
                <input
                  type="text"
                  value={metaDraft.mmsi || ''}
                  onChange={(e) => setMetaDraft({ ...metaDraft, mmsi: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Rufzeichen (Callsign)</label>
                <input
                  type="text"
                  value={metaDraft.callsign || ''}
                  onChange={(e) => setMetaDraft({ ...metaDraft, callsign: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Skipper / Schiffsführer</label>
                <input
                  type="text"
                  value={metaDraft.skipper || ''}
                  onChange={(e) => setMetaDraft({ ...metaDraft, skipper: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs transition-colors"
              >
                Speichern
              </button>
            </div>
          </form>
        )}

        {/* Primary Metrics Bento Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Gesamtdistanz</span>
            </div>
            <div className="text-2xl font-bold text-cyan-300 font-mono">
              {formatNM(voyage.totalDistanceNM)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              ca. {(voyage.totalDistanceNM * 1.852).toFixed(1)} km über Grund
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Gauge className="w-4 h-4 text-emerald-400" />
              <span>Durchschnitts-SOG</span>
            </div>
            <div className="text-2xl font-bold text-emerald-300 font-mono">
              {formatKnots(voyage.avgSpeedKnots)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Spitze: {formatKnots(voyage.maxSpeedKnots)}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Reisedauer</span>
            </div>
            <div className="text-2xl font-bold text-amber-300 font-mono">
              {formatDuration(voyage.durationSeconds)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {points.length} AIS Datenpunkte
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Anchor className="w-4 h-4 text-blue-400" />
              <span>Liegeplätze / Stopps</span>
            </div>
            <div className="text-2xl font-bold text-blue-300 font-mono">
              {voyage.anchorages.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Erkannte Anker-/Hafenstopps
            </div>
          </div>
        </div>

        {/* Speed Profile Chart over Nautical Miles */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Geschwindigkeitsprofil (SOG in Knoten)</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Max: {formatKnots(voyage.maxSpeedKnots)}</span>
          </div>

          {/* SVG Area / Line Chart */}
          <div className="relative h-40 w-full bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none text-[9px] text-slate-600 font-mono">
              <div className="border-b border-slate-800/60 w-full flex justify-between">
                <span>{maxSog.toFixed(0)} kn</span>
              </div>
              <div className="border-b border-slate-800/40 w-full flex justify-between">
                <span>{(maxSog / 2).toFixed(0)} kn</span>
              </div>
              <div className="w-full flex justify-between">
                <span>0 kn</span>
              </div>
            </div>

            <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Gradient definition */}
              <defs>
                <linearGradient id="speedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area fill */}
              {chartPoints.length > 1 && (
                <polygon
                  points={`0,100 ${svgPolyline} 100,100`}
                  fill="url(#speedGrad)"
                />
              )}

              {/* Stroke line */}
              <polyline
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={svgPolyline}
              />
            </svg>
          </div>

          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
            <span>0 sm (Start)</span>
            <span>{(voyage.totalDistanceNM / 2).toFixed(1)} sm</span>
            <span>{formatNM(voyage.totalDistanceNM)} (Ziel)</span>
          </div>
        </div>

        {/* Waypoints, Start & End Station Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Start Port */}
          {startPt && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-2">
                <MapPin className="w-4 h-4" />
                <span>Ablegepunkt / Start</span>
              </div>
              <div className="text-xs space-y-1 text-slate-300">
                <div className="font-mono text-white text-[13px]">{formatNauticalCoordinate(startPt.lat, startPt.lon)}</div>
                <div className="text-slate-400">
                  Zeit: {startPt.timestamp.toLocaleString('de-DE')}
                </div>
                <div className="text-slate-400">
                  Initialer Kurs: {formatDegrees(startPt.cog)}
                </div>
              </div>
            </div>
          )}

          {/* End Port */}
          {endPt && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-400 text-xs font-semibold mb-2">
                <MapPin className="w-4 h-4" />
                <span>Anlegepunkt / Ziel</span>
              </div>
              <div className="text-xs space-y-1 text-slate-300">
                <div className="font-mono text-white text-[13px]">{formatNauticalCoordinate(endPt.lat, endPt.lon)}</div>
                <div className="text-slate-400">
                  Zeit: {endPt.timestamp.toLocaleString('de-DE')}
                </div>
                <div className="text-slate-400">
                  Endstatus: {endPt.navStatus || 'Festgemacht'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Anchorages Table */}
        {voyage.anchorages.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Anchor className="w-4 h-4 text-amber-400" />
              <span>Erkannte Liegeplätze & Stopps ({voyage.anchorages.length})</span>
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-slate-400 bg-slate-800/60 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 rounded-l">Bezeichnung</th>
                    <th className="px-3 py-2">Position</th>
                    <th className="px-3 py-2">Dauer</th>
                    <th className="px-3 py-2">Ankunft</th>
                    <th className="px-3 py-2 rounded-r text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {voyage.anchorages.map((anc) => (
                    <tr key={anc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-white">{anc.name}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">
                        {formatNauticalCoordinate(anc.lat, anc.lon)}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-amber-400">
                        {Math.floor(anc.durationMinutes / 60)}h {anc.durationMinutes % 60}m
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {anc.startPoint.timestamp.toLocaleString('de-DE')}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => onSelectAnchorage(anc)}
                          className="text-cyan-400 hover:text-cyan-300 font-medium hover:underline text-[11px]"
                        >
                          Auf Karte zeigen →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
