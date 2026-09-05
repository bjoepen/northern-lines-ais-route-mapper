/** @license SPDX-License-Identifier: Apache-2.0 */
import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, AnchorageStop, MapStyleId, RouteColorMode, VoyageData, VoyageMetadata } from './types';
import { sampleOstseeVoyage, PRESET_VOYAGES } from './data/sampleVoyages';
import { MacTitleBar } from './components/MacTitleBar';
import { VoyageMap } from './components/VoyageMap';
import { PlaybackController } from './components/PlaybackController';
import { LogbookView } from './components/LogbookView';
import { AisDataView } from './components/AisDataView';
import { ExportStudio } from './components/ExportStudio';

export default function App() {
  const [voyage, setVoyage] = useState<VoyageData>(sampleOstseeVoyage);
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [activePointIndex, setActivePointIndex] = useState(0);
  const [mapStyle, setMapStyle] = useState<MapStyleId>('nautical');
  const [showSeaMarks, setShowSeaMarks] = useState(true);
  const [routeColorMode, setRouteColorMode] = useState<RouteColorMode>('speed');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const playbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(50, Math.floor(1000 / Math.min(30, playbackSpeed)));
      const step = Math.max(1, Math.floor(playbackSpeed / 20));
      playbackTimerRef.current = window.setInterval(() => setActivePointIndex((prev) => {
        if (prev >= voyage.points.length - 1) { setIsPlaying(false); return voyage.points.length - 1; }
        return Math.min(voyage.points.length - 1, prev + step);
      }), intervalMs);
    } else if (playbackTimerRef.current) { clearInterval(playbackTimerRef.current); playbackTimerRef.current = null; }
    return () => { if (playbackTimerRef.current) clearInterval(playbackTimerRef.current); };
  }, [isPlaying, playbackSpeed, voyage.points.length]);

  const handleLoadPreset = (presetId: string) => { const found = PRESET_VOYAGES.find((p) => p.id === presetId); if (found) { setVoyage(found.data); setActivePointIndex(0); setIsPlaying(false); } };
  const handleImportNewData = (newVoyage: VoyageData) => { setVoyage(newVoyage); setActivePointIndex(0); setIsPlaying(false); setActiveTab('map'); };
  const handleUpdateMetadata = (updated: Partial<VoyageMetadata>) => setVoyage((prev) => ({ ...prev, metadata: { ...prev.metadata, ...updated } }));
  const handleSelectAnchorage = (anchorage: AnchorageStop) => { const idx = voyage.points.findIndex((p) => p.id === anchorage.startPoint.id); if (idx !== -1) { setActivePointIndex(idx); setActiveTab('map'); } };
  const handleNewTrip = () => { if (window.confirm('Möchtest du eine neue Reisekarte anlegen und neue Trackdaten importieren?')) setActiveTab('data'); };

  return <div className="nl-app w-screen h-screen flex flex-col overflow-hidden select-none">
    <MacTitleBar title={voyage.metadata.title} vesselName={voyage.metadata.vesselName} activeTab={activeTab} onTabChange={setActiveTab} mapStyle={mapStyle} onMapStyleChange={setMapStyle} showSeaMarks={showSeaMarks} onToggleSeaMarks={() => setShowSeaMarks(!showSeaMarks)} onLoadPreset={handleLoadPreset} onNewTrip={handleNewTrip}/>
    <main className={`flex-1 relative overflow-hidden ${activeTab === 'map' ? '' : 'nl-workspace'}`}>
      {activeTab === 'map' && <div className="w-full h-full relative"><VoyageMap voyage={voyage} activePointIndex={activePointIndex} onPointSelect={setActivePointIndex} mapStyle={mapStyle} showSeaMarks={showSeaMarks} routeColorMode={routeColorMode} onToggleRouteColorMode={() => setRouteColorMode(routeColorMode === 'speed' ? 'monochrome' : 'speed')}/><PlaybackController points={voyage.points} currentIndex={activePointIndex} onIndexChange={setActivePointIndex} isPlaying={isPlaying} onTogglePlay={() => setIsPlaying(!isPlaying)} playbackSpeed={playbackSpeed} onSpeedChange={setPlaybackSpeed}/></div>}
      {activeTab === 'logbook' && <LogbookView voyage={voyage} onUpdateMetadata={handleUpdateMetadata} onSelectAnchorage={handleSelectAnchorage}/>} 
      {activeTab === 'data' && <AisDataView voyage={voyage} onImportNewData={handleImportNewData}/>} 
      {activeTab === 'export' && <ExportStudio voyage={voyage}/>} 
    </main>
    <footer className="nl-chrome h-7 border-t px-4 flex items-center justify-between text-[10px] text-[#66716d] shrink-0 tracking-[0.01em]">
      <div className="flex items-center gap-3"><span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#6f7c68]"/>Track geladen</span><span className="text-[#c2bbad]">·</span><span>{voyage.points.length} Wegpunkte</span><span className="text-[#c2bbad]">·</span><span>{voyage.totalDistanceNM} sm</span></div>
      <div className="flex items-center gap-3"><span className="uppercase tracking-[0.16em] text-[#6f7c68]">Northern Lines</span><span className="text-[#c2bbad]">·</span><span>{voyage.metadata.mmsi ? `MMSI ${voyage.metadata.mmsi}` : 'GPS Track'}</span></div>
    </footer>
  </div>;
}
