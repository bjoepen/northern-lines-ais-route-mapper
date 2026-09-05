/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  // Main State
  const [voyage, setVoyage] = useState<VoyageData>(sampleOstseeVoyage);
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [activePointIndex, setActivePointIndex] = useState<number>(0);

  // Map Display State
  const [mapStyle, setMapStyle] = useState<MapStyleId>('nautical');
  const [showSeaMarks, setShowSeaMarks] = useState<boolean>(true);
  const [routeColorMode, setRouteColorMode] = useState<RouteColorMode>('speed');

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(5);
  const playbackTimerRef = useRef<number | null>(null);

  // Playback Loop
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(50, Math.floor(1000 / Math.min(30, playbackSpeed)));
      const step = Math.max(1, Math.floor(playbackSpeed / 20));

      playbackTimerRef.current = window.setInterval(() => {
        setActivePointIndex((prev) => {
          if (prev >= voyage.points.length - 1) {
            setIsPlaying(false);
            return voyage.points.length - 1;
          }
          return Math.min(voyage.points.length - 1, prev + step);
        });
      }, intervalMs);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, voyage.points.length]);

  // Load Preset
  const handleLoadPreset = (presetId: string) => {
    const found = PRESET_VOYAGES.find((p) => p.id === presetId);
    if (found) {
      setVoyage(found.data);
      setActivePointIndex(0);
      setIsPlaying(false);
    }
  };

  // Import New AIS Data
  const handleImportNewData = (newVoyage: VoyageData) => {
    setVoyage(newVoyage);
    setActivePointIndex(0);
    setIsPlaying(false);
    setActiveTab('map');
  };

  // Update Metadata
  const handleUpdateMetadata = (updated: Partial<VoyageMetadata>) => {
    setVoyage((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        ...updated,
      },
    }));
  };

  // Select Anchorage from Logbook
  const handleSelectAnchorage = (anchorage: AnchorageStop) => {
    const idx = voyage.points.findIndex((p) => p.id === anchorage.startPoint.id);
    if (idx !== -1) {
      setActivePointIndex(idx);
      setActiveTab('map');
    }
  };

  // Reset / New Empty Trip
  const handleNewTrip = () => {
    if (window.confirm('Möchtest du eine neue Reisekarte anlegen und die aktuellen Koordinaten leeren?')) {
      setActiveTab('data');
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* macOS Window Title Bar with Traffic Lights & Navigation */}
      <MacTitleBar
        title={voyage.metadata.title}
        vesselName={voyage.metadata.vesselName}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mapStyle={mapStyle}
        onMapStyleChange={setMapStyle}
        showSeaMarks={showSeaMarks}
        onToggleSeaMarks={() => setShowSeaMarks(!showSeaMarks)}
        onLoadPreset={handleLoadPreset}
        onNewTrip={handleNewTrip}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 relative overflow-hidden">
        {/* Tab 1: Interactive Nautical Voyage Map */}
        {activeTab === 'map' && (
          <div className="w-full h-full relative">
            <VoyageMap
              voyage={voyage}
              activePointIndex={activePointIndex}
              onPointSelect={(idx) => setActivePointIndex(idx)}
              mapStyle={mapStyle}
              showSeaMarks={showSeaMarks}
              routeColorMode={routeColorMode}
              onToggleRouteColorMode={() =>
                setRouteColorMode(routeColorMode === 'speed' ? 'monochrome' : 'speed')
              }
            />

            {/* Playback Controls and Telemetry HUD */}
            <PlaybackController
              points={voyage.points}
              currentIndex={activePointIndex}
              onIndexChange={setActivePointIndex}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              playbackSpeed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
            />
          </div>
        )}

        {/* Tab 2: Logbook & Speed Analytics */}
        {activeTab === 'logbook' && (
          <LogbookView
            voyage={voyage}
            onUpdateMetadata={handleUpdateMetadata}
            onSelectAnchorage={handleSelectAnchorage}
          />
        )}

        {/* Tab 3: AIS Data, Import & Table Editor */}
        {activeTab === 'data' && (
          <AisDataView
            voyage={voyage}
            onImportNewData={handleImportNewData}
          />
        )}

        {/* Tab 4: Travel Map Export Studio & High-Res Poster */}
        {activeTab === 'export' && (
          <ExportStudio voyage={voyage} />
        )}
      </main>

      {/* macOS Bottom Status Bar */}
      <footer className="h-6 bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between text-[11px] text-slate-400 shrink-0 select-none">
        <div className="flex items-center space-x-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>AIS Tracker Aktiv</span>
          </span>
          <span className="text-slate-600">|</span>
          <span>{voyage.points.length} Wegpunkte</span>
          <span className="text-slate-600">|</span>
          <span>Distanz: <strong className="text-slate-200">{voyage.totalDistanceNM} sm</strong></span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-slate-500">Tastatur: Leertaste (Start/Stop) • Pfeiltasten (Spulen)</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-cyan-400">{voyage.metadata.mmsi ? `MMSI ${voyage.metadata.mmsi}` : 'GPS Tracker'}</span>
        </div>
      </footer>
    </div>
  );
}
