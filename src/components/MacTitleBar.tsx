import React from 'react';
import { ActiveTab, MapStyleId } from '../types';
import {
  Map as MapIcon,
  BookOpen,
  FileCode,
  Download,
  Ship,
  Layers,
  Compass,
  Maximize2,
  Anchor,
} from 'lucide-react';
import { PRESET_VOYAGES } from '../data/sampleVoyages';

interface MacTitleBarProps {
  title: string;
  vesselName: string;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  mapStyle: MapStyleId;
  onMapStyleChange: (style: MapStyleId) => void;
  showSeaMarks: boolean;
  onToggleSeaMarks: () => void;
  onLoadPreset: (id: string) => void;
  onNewTrip: () => void;
}

export const MacTitleBar: React.FC<MacTitleBarProps> = ({
  title,
  vesselName,
  activeTab,
  onTabChange,
  mapStyle,
  onMapStyleChange,
  showSeaMarks,
  onToggleSeaMarks,
  onLoadPreset,
  onNewTrip,
}) => {
  const [showPresetsMenu, setShowPresetsMenu] = React.useState(false);
  const [showLayersMenu, setShowLayersMenu] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className="h-12 bg-slate-900/95 border-b border-slate-700/80 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0 select-none">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 mr-2">
          <button
            id="mac-traffic-close"
            onClick={onNewTrip}
            title="Neuen Törn erstellen / Daten löschen"
            className="w-3 h-3 rounded-full bg-red-500/90 hover:bg-red-600 border border-red-600/40 flex items-center justify-center group shadow-sm transition-all"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-red-950 font-bold leading-none">×</span>
          </button>
          <button
            id="mac-traffic-min"
            title="Minimieren"
            className="w-3 h-3 rounded-full bg-amber-500/90 hover:bg-amber-600 border border-amber-600/40 flex items-center justify-center group shadow-sm transition-all"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] text-amber-950 font-bold leading-none">−</span>
          </button>
          <button
            id="mac-traffic-max"
            onClick={toggleFullscreen}
            title="Vollbild umschalten"
            className="w-3 h-3 rounded-full bg-emerald-500/90 hover:bg-emerald-600 border border-emerald-600/40 flex items-center justify-center group shadow-sm transition-all"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[7px] text-emerald-950 font-bold leading-none">+</span>
          </button>
        </div>

        <div className="relative">
          <button
            id="btn-sample-voyages"
            onClick={() => {
              setShowPresetsMenu(!showPresetsMenu);
              setShowLayersMenu(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 rounded-md shadow-xs transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Beispiel-Törns</span>
            <span className="text-[10px] text-slate-400">▾</span>
          </button>

          {showPresetsMenu && (
            <div className="absolute left-0 mt-1.5 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 animate-in fade-in-50 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60">
                Vorgefertigte AIS-Reisen
              </div>
              {PRESET_VOYAGES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onLoadPreset(preset.id);
                    setShowPresetsMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-200 flex items-center gap-2 transition-colors"
                >
                  <Anchor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{preset.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center">
        <div className="bg-slate-800/90 border border-slate-700/80 p-0.5 rounded-lg flex space-x-1 shadow-inner">
          <button
            id="nav-tab-map"
            onClick={() => onTabChange('map')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'map'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Reisekarte</span>
          </button>

          <button
            id="nav-tab-logbook"
            onClick={() => onTabChange('logbook')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'logbook'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Logbuch & Analyse</span>
          </button>

          <button
            id="nav-tab-data"
            onClick={() => onTabChange('data')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'data'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>AIS-Daten & Import</span>
          </button>

          <button
            id="nav-tab-export"
            onClick={() => onTabChange('export')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
              activeTab === 'export'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Karte Exportieren</span>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/40 border border-slate-700/50 rounded-md text-xs text-slate-300 max-w-[200px] truncate">
          <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate font-medium">{vesselName || 'AIS Schiff'}</span>
        </div>

        <div className="relative">
          <button
            id="btn-map-layers"
            onClick={() => {
              setShowLayersMenu(!showLayersMenu);
              setShowPresetsMenu(false);
            }}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-md transition-colors"
            title="Kartenansichten & Seezeichen"
          >
            <Layers className="w-4 h-4 text-slate-300" />
          </button>

          {showLayersMenu && (
            <div className="absolute right-0 mt-1.5 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1.5 z-50 text-xs">
              <div className="px-3 py-1 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                Keyless Karten-Stil
              </div>
              {[
                { id: 'nautical', label: 'Nautisch · OSM + OpenSeaMap' },
                { id: 'osm', label: 'OpenStreetMap Standard' },
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => {
                    onMapStyleChange(style.id as MapStyleId);
                    setShowLayersMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
                    mapStyle === style.id
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-700/60'
                  }`}
                >
                  <span>{style.label}</span>
                  {mapStyle === style.id && <span className="text-cyan-400">✓</span>}
                </button>
              ))}

              <div className="px-3 py-1.5 text-[10px] leading-relaxed text-slate-500">
                Kein API-Key, kein Kartenkonto und kein Cloud-Secret erforderlich.
              </div>

              <div className="my-1 border-t border-slate-700/60" />

              <div className="px-3 py-1 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                Nautische Overlays
              </div>
              <button
                onClick={onToggleSeaMarks}
                className="w-full text-left px-3 py-1.5 flex items-center justify-between text-slate-300 hover:bg-slate-700/60 transition-colors"
              >
                <span>Seezeichen & Tonnen (OpenSeaMap)</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${showSeaMarks ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {showSeaMarks ? 'AN' : 'AUS'}
                </span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-md transition-colors"
          title="Vollbild"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
