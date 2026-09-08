import React, { useState, useRef } from 'react';
import { VoyageData } from '../types';
import { parseAisData } from '../utils/aisParser';
import { formatNauticalCoordinate, formatKnots, formatDegrees } from '../utils/geoUtils';
import { Upload, CheckCircle2, AlertCircle, Download, Trash2, FileSpreadsheet, Code } from 'lucide-react';

interface AisDataViewProps {
  voyage: VoyageData;
  onImportNewData: (data: VoyageData) => void;
}

export const AisDataView: React.FC<AisDataViewProps> = ({ voyage, onImportNewData }) => {
  const [inputText, setInputText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const points = voyage.points;

  const successMessage = (label: string, parsed: VoyageData) => {
    const segmentCount = parsed.segments?.length || (parsed.points.length ? 1 : 0);
    const gapCount = parsed.gaps?.length || 0;
    const mode = parsed.geometryOnly ? ' · Geometry-only' : parsed.northernLinesSource ? ' · Northern Lines Normalized Track' : '';
    return `${label} erfolgreich importiert (${parsed.points.length} Punkte · ${segmentCount} Segmente · ${gapCount} Gaps${mode})!`;
  };

  const handleProcessText = () => {
    if (!inputText.trim()) {
      setParseError('Bitte AIS-Daten, Northern-Lines-Track oder Koordinaten in das Textfeld eingeben.');
      return;
    }

    try {
      const parsed = parseAisData(inputText, { title: 'Benutzerdefinierter AIS Törn' });
      if (parsed.points.length === 0) {
        setParseError('Es konnten keine gültigen Koordinaten erkannt werden. Bitte Format prüfen.');
        return;
      }
      onImportNewData(parsed);
      setParseError(null);
      setParseSuccess(successMessage('Daten', parsed));
      setInputText('');
      setTimeout(() => setParseSuccess(null), 5000);
    } catch (err: any) {
      setParseError(`Fehler beim Parsen: ${err.message || err}`);
    }
  };

  const handleFileDrop = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;
      try {
        const parsed = parseAisData(content, { title: file.name.replace(/\.[^/.]+$/, '') });
        if (parsed.points.length === 0) {
          setParseError(`Keine gültigen AIS-Positionen in "${file.name}" gefunden.`);
          return;
        }
        onImportNewData(parsed);
        setParseError(null);
        setParseSuccess(successMessage(`"${file.name}"`, parsed));
        setTimeout(() => setParseSuccess(null), 5000);
      } catch (err: any) {
        setParseError(`Fehler beim Verarbeiten von ${file.name}: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileDrop(e.dataTransfer.files[0]);
  };

  // Export Clean GPX. Build 005 preserves route discontinuities as separate trkseg elements.
  const handleExportGpx = () => {
    if (points.length === 0) return;
    const segments = voyage.segments?.length ? voyage.segments : [{ id: 'legacy-segment', points }];
    const gpxSegments = segments.map(segment => {
      const gpxPoints = segment.points.map(p => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">
        ${p.provenance.timestamp !== 'synthetic' ? `<time>${p.timestamp.toISOString()}</time>` : ''}
        ${p.sog !== undefined ? `<speed>${(p.sog / 1.94384).toFixed(2)}</speed>` : ''}
        ${p.cog !== undefined ? `<course>${p.cog.toFixed(1)}</course>` : ''}
      </trkpt>`).join('\n');
      return `    <trkseg>\n${gpxPoints}\n    </trkseg>`;
    }).join('\n');

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Northern Lines AIS Route Mapper" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${voyage.metadata.title}</name>
    <desc>${voyage.metadata.vesselName} (MMSI: ${voyage.metadata.mmsi || ''})</desc>
  </metadata>
  <trk>
    <name>${voyage.metadata.title}</name>
${gpxSegments}
  </trk>
</gpx>`;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${voyage.metadata.title.replace(/\s+/g, '_')}.gpx`; a.click(); URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (points.length === 0) return;
    const segmentByPoint = new Map<string, string>();
    (voyage.segments || []).forEach(segment => segment.points.forEach(point => segmentByPoint.set(point.id, segment.id)));
    const header = 'segment,timestamp,latitude,longitude,sog_knots,cog_degrees,distance_nm,status\n';
    const rows = points.map(p => `${segmentByPoint.get(p.id) || 'segment-1'},${p.provenance.timestamp !== 'synthetic' ? p.timestamp.toISOString() : ''},${p.lat.toFixed(6)},${p.lon.toFixed(6)},${p.sog || 0},${p.cog || 0},${p.distanceFromStartNM || 0},"${p.navStatus || ''}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${voyage.metadata.title.replace(/\s+/g, '_')}_ais_track.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-950 p-6 text-slate-100 select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {parseError && <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 flex items-center gap-2 text-red-300 text-xs"><AlertCircle className="w-4 h-4 shrink-0 text-red-400"/><span>{parseError}</span></div>}
        {parseSuccess && <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-2 text-emerald-300 text-xs"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400"/><span>{parseSuccess}</span></div>}

        <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-900'}`}>
          <input ref={fileInputRef} type="file" accept=".csv,.txt,.nmea,.gpx,.json,.geojson,.log" className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFileDrop(e.target.files[0]); }}/>
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center"><Upload className="w-6 h-6"/></div>
          <h3 className="text-sm font-semibold text-white mb-1">Track-Datei hier ablegen oder klicken</h3>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">Bevorzugt: Northern Lines <strong>normalized-track.json</strong>. Zusätzlich CSV, NMEA 0183, GPX, JSON sowie segmentierte GeoJSON-Review-Artefakte.</p>
          <p className="text-[11px] text-slate-500 mt-2">GeoJSON ohne Zeitbasis wird bewusst als Geometry-only geladen; Playback bleibt dann deaktiviert.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Code className="w-4 h-4 text-cyan-400"/><h3 className="text-sm font-bold text-white">Trackdaten direkt einfügen</h3></div><span className="text-[11px] text-slate-400">CSV, NMEA, JSON oder Northern Lines Contract</span></div>
          <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={`Beispiel-CSV:\n54.428, 10.169, 5.2, 045\n54.498, 10.275, 6.8, 052\n\nOder NMEA:\n!AIVDM,1,1,,B,13aEO:0P00OpvK0N4bc00?vN0000,0*13`} rows={5} className="w-full bg-slate-950 border border-slate-700/70 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"/>
          <div className="flex items-center justify-between"><button onClick={() => setInputText('')} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/><span>Text leeren</span></button><button onClick={handleProcessText} className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs transition-colors">Track verarbeiten & Törn aktualisieren</button></div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div><h3 className="text-sm font-bold text-white flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-emerald-400"/><span>Aktuell geladene Trackpoints ({points.length})</span></h3><p className="text-xs text-slate-400 mt-0.5">{voyage.startTime&&voyage.endTime?`Von ${voyage.startTime.toLocaleDateString('de-DE')} bis ${voyage.endTime.toLocaleDateString('de-DE')}`:'Keine verlässliche Zeitbasis'} · {voyage.segments?.length||1} Segmente · {voyage.gaps?.length||0} Gaps</p></div>
            <div className="flex items-center gap-2"><button onClick={handleExportGpx} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors" title="Als GPX exportieren"><Download className="w-3.5 h-3.5 text-cyan-400"/><span>GPX</span></button><button onClick={handleExportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors" title="Als CSV Tabelle exportieren"><Download className="w-3.5 h-3.5 text-emerald-400"/><span>CSV</span></button></div>
          </div>

          <div className="overflow-x-auto max-h-96 border border-slate-800 rounded-lg"><table className="w-full text-xs text-left"><thead className="text-[11px] text-slate-400 bg-slate-800/80 sticky top-0 uppercase tracking-wider"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Zeitstempel</th><th className="px-3 py-2">Position (Nautisch)</th><th className="px-3 py-2">SOG</th><th className="px-3 py-2">COG</th><th className="px-3 py-2">Distanz</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-slate-800/80 font-mono">{points.slice(0, 100).map((pt, idx) => <tr key={pt.id} className="hover:bg-slate-800/30 transition-colors"><td className="px-3 py-1.5 text-slate-500">{idx + 1}</td><td className="px-3 py-1.5 text-slate-300">{pt.provenance.timestamp==='synthetic'?'—':<>{pt.timestamp.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}{' '}{pt.timestamp.toLocaleTimeString('de-DE')}</>}</td><td className="px-3 py-1.5 text-cyan-300 font-semibold">{formatNauticalCoordinate(pt.lat, pt.lon)}</td><td className="px-3 py-1.5 text-emerald-400 font-bold">{formatKnots(pt.sog)}</td><td className="px-3 py-1.5 text-amber-400">{formatDegrees(pt.cog)}</td><td className="px-3 py-1.5 text-slate-400">{(pt.distanceFromStartNM || 0).toFixed(1)} sm</td><td className="px-3 py-1.5 font-sans text-slate-400 text-[11px]">{pt.navStatus || '--'}</td></tr>)}</tbody></table></div>
          {points.length > 100 && <div className="text-[11px] text-slate-500 text-center">(Zeige die ersten 100 von {points.length} Punkten)</div>}
        </div>
      </div>
    </div>
  );
};
