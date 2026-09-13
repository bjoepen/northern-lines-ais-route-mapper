import React from 'react';
import { ActiveTab, MapStyleId } from '../types';
import { Map as MapIcon, BookOpen, FileCode, Download, Ship, Layers, Compass, Maximize2, FolderOpen, Save } from 'lucide-react';

interface MacTitleBarProps {
  title: string;
  vesselName: string;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  mapStyle: MapStyleId;
  onMapStyleChange: (style: MapStyleId) => void;
  showSeaMarks: boolean;
  onToggleSeaMarks: () => void;
  onNewTrip: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  canSave: boolean;
  dirty: boolean;
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
  onNewTrip,
  onOpenProject,
  onSaveProject,
  canSave,
  dirty,
}) => {
  const [showLayersMenu, setShowLayersMenu] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const tabs: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
    { id: 'map', label: 'Reisekarte', icon: MapIcon },
    { id: 'logbook', label: 'Logbuch', icon: BookOpen },
    { id: 'data', label: 'Daten', icon: FileCode },
    { id: 'export', label: 'Export', icon: Download },
  ];

  return (
    <header className="nl-chrome h-[72px] border-b px-5 grid grid-cols-[1fr_auto_1fr] items-center z-30 shrink-0 select-none shadow-[0_1px_10px_rgba(36,48,46,.06)]">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onNewTrip} className="w-9 h-9 rounded-full border border-[#d8d2c5] bg-[#f4f1e9] flex items-center justify-center text-[#31575d] hover:bg-[#ebe6da] transition-colors" title="Neue Reise / Daten importieren">
          <Compass className="w-4 h-4" />
        </button>
        <button onClick={onOpenProject} className="nl-button w-9 h-9 rounded-full flex items-center justify-center transition-colors" title=".nlroute öffnen">
          <FolderOpen className="w-4 h-4" />
        </button>
        <button onClick={onSaveProject} disabled={!canSave} className="nl-button w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-35 disabled:cursor-not-allowed" title="Route als .nlroute speichern">
          <Save className="w-4 h-4" />
        </button>
        <div className="min-w-0 ml-1">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[#6f7c68] font-semibold">Northern Lines · Route Mapper</div>
          <div className="text-[15px] leading-tight font-semibold tracking-[-0.01em] truncate flex items-center gap-2">
            <span className="truncate">{title || 'Keine Reise geladen'}</span>
            {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#b59668] shrink-0" title="Ungespeicherte Änderungen"/>}
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-1 bg-[#ebe6da]/70 rounded-full p-1 border border-[#ded8cb]">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onTabChange(id)} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-colors ${activeTab === id ? 'bg-[#31575d] text-[#fffdf8] shadow-sm' : 'text-[#66716d] hover:text-[#24302e] hover:bg-[#fffdf8]/70'}`}><Icon className="w-3.5 h-3.5"/><span>{label}</span></button>)}
      </nav>

      <div className="flex items-center justify-end gap-2 min-w-0">
        <div className="hidden lg:flex items-center gap-2 mr-1 text-[11px] text-[#66716d] max-w-[210px]">
          <Ship className="w-3.5 h-3.5 text-[#456f75] shrink-0"/><span className="truncate">{vesselName || 'Keine Route geladen'}</span>
        </div>
        <div className="relative">
          <button onClick={() => setShowLayersMenu(!showLayersMenu)} className="nl-button w-9 h-9 rounded-full flex items-center justify-center transition-colors" title="Karte & Seezeichen"><Layers className="w-4 h-4"/></button>
          {showLayersMenu && <div className="absolute right-0 mt-2 w-72 nl-panel rounded-xl py-2 z-50 text-xs">
            <div className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#6f7c68]">Kartengrundlage</div>
            {[{ id: 'nautical', label: 'Nautisch · OSM + OpenSeaMap' }, { id: 'osm', label: 'OpenStreetMap Standard' }].map((style) => <button key={style.id} onClick={() => { onMapStyleChange(style.id as MapStyleId); setShowLayersMenu(false); }} className={`w-full text-left px-3 py-2 flex items-center justify-between ${mapStyle === style.id ? 'text-[#31575d] font-semibold bg-[#ebe6da]' : 'hover:bg-[#f4f1e9]'}`}><span>{style.label}</span>{mapStyle === style.id && <span>✓</span>}</button>)}
            <div className="mx-3 my-2 border-t border-[#d8d2c5]"/>
            <button onClick={onToggleSeaMarks} className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#f4f1e9]"><span>Seezeichen · OpenSeaMap</span><span className={`text-[10px] font-semibold ${showSeaMarks ? 'text-[#31575d]' : 'text-[#8b918d]'}`}>{showSeaMarks ? 'AN' : 'AUS'}</span></button>
            <div className="px-3 pt-1 text-[10px] leading-relaxed text-[#8b918d]">Offene Kartendaten · kein API-Key erforderlich.</div>
          </div>}
        </div>
        <button onClick={toggleFullscreen} className="nl-button w-9 h-9 rounded-full flex items-center justify-center transition-colors" title="Vollbild"><Maximize2 className="w-4 h-4"/></button>
      </div>
    </header>
  );
};
