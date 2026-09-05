import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapStyleId, RouteColorMode, VoyageData } from '../types';
import {
  formatNauticalCoordinate,
  formatKnots,
  formatDegrees,
  formatNM,
  getSpeedColor,
} from '../utils/geoUtils';
import { Compass, ZoomIn, ZoomOut, LocateFixed, Ship } from 'lucide-react';

interface VoyageMapProps {
  voyage: VoyageData;
  activePointIndex: number;
  onPointSelect: (index: number) => void;
  mapStyle: MapStyleId;
  showSeaMarks: boolean;
  routeColorMode: RouteColorMode;
  onToggleRouteColorMode: () => void;
}

export const VoyageMap: React.FC<VoyageMapProps> = ({
  voyage,
  activePointIndex,
  onPointSelect,
  mapStyle,
  showSeaMarks,
  routeColorMode,
  onToggleRouteColorMode,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const seaMarksLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayersRef = useRef<L.LayerGroup | null>(null);
  const playbackLayersRef = useRef<L.LayerGroup | null>(null);
  const vesselMarkerRef = useRef<L.Marker | null>(null);
  const progressLineRef = useRef<L.Polyline | null>(null);

  const [cursorPos, setCursorPos] = useState<{ lat: number; lon: number } | null>(null);

  const points = voyage.points;
  const currentPoint = points[activePointIndex] || points[0];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = points[0]?.lat || 54.428;
    const initialLon = points[0]?.lon || 10.169;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 9,
      zoomControl: false,
      attributionControl: true,
    });

    map.createPane('playback');
    const playbackPane = map.getPane('playback');
    if (playbackPane) {
      playbackPane.style.zIndex = '680';
      playbackPane.style.pointerEvents = 'none';
    }

    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorPos({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    mapInstanceRef.current = map;
    routeLayersRef.current = L.layerGroup().addTo(map);
    playbackLayersRef.current = L.layerGroup().addTo(map);

    if (points.length > 1) {
      const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);
      map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      vesselMarkerRef.current = null;
      progressLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);

    baseTileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const seamarksEnabled = mapStyle === 'nautical' && showSeaMarks;
    if (seamarksEnabled) {
      if (!seaMarksLayerRef.current) {
        seaMarksLayerRef.current = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
          maxZoom: 18,
          opacity: 0.95,
          attribution: 'Map data &copy; OpenSeaMap contributors',
        });
      }
      seaMarksLayerRef.current.addTo(map);
    } else if (seaMarksLayerRef.current && map.hasLayer(seaMarksLayerRef.current)) {
      map.removeLayer(seaMarksLayerRef.current);
    }
  }, [mapStyle, showSeaMarks]);

  useEffect(() => {
    const routeGroup = routeLayersRef.current;
    if (!routeGroup) return;

    routeGroup.clearLayers();
    if (points.length < 2) return;

    if (routeColorMode === 'speed') {
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const segment = L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
          color: getSpeedColor(p1.sog),
          weight: 4,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        });
        const segmentIdx = i;
        segment.on('click', () => onPointSelect(segmentIdx));
        routeGroup.addLayer(segment);
      }
    } else {
      L.polyline(points.map((p) => [p.lat, p.lon] as [number, number]), {
        color: '#06b6d4',
        weight: 4,
        opacity: 0.85,
      }).addTo(routeGroup);
    }

    const startPt = points[0];
    const startIcon = L.divIcon({
      className: 'start-marker',
      html: '<div style="width:32px;height:32px;border-radius:50%;background:#10b981;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:14px">⚓</div>',
      iconSize: [32, 32], iconAnchor: [16, 16],
    });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon });
    startMarker.bindPopup(`<div style="font-size:12px;color:#0f172a"><strong>Törn-Start</strong><br>${startPt.timestamp.toLocaleDateString('de-DE')} ${startPt.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}<br><span style="font-family:monospace">${formatNauticalCoordinate(startPt.lat, startPt.lon)}</span></div>`);
    routeGroup.addLayer(startMarker);

    const endPt = points[points.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker',
      html: '<div style="width:32px;height:32px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:14px">🏁</div>',
      iconSize: [32, 32], iconAnchor: [16, 16],
    });
    const endMarker = L.marker([endPt.lat, endPt.lon], { icon: endIcon });
    endMarker.bindPopup(`<div style="font-size:12px;color:#0f172a"><strong>Törn-Ziel / Letzter AIS Kontakt</strong><br>Distanz: <strong>${formatNM(voyage.totalDistanceNM)}</strong><br>${endPt.timestamp.toLocaleDateString('de-DE')} ${endPt.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>`);
    routeGroup.addLayer(endMarker);

    voyage.anchorages.forEach((anc) => {
      const icon = L.divIcon({
        className: 'anchorage-marker',
        html: '<div style="width:24px;height:24px;border-radius:50%;background:#f59e0b;border:1px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:11px">⚓</div>',
        iconSize: [24, 24], iconAnchor: [12, 12],
      });
      const marker = L.marker([anc.lat, anc.lon], { icon });
      marker.bindPopup(`<div style="font-size:12px;color:#0f172a"><strong>${anc.name}</strong><br>Dauer: ${Math.round(anc.durationMinutes / 60)}h ${anc.durationMinutes % 60}m<br><span style="font-family:monospace">${formatNauticalCoordinate(anc.lat, anc.lon)}</span></div>`);
      routeGroup.addLayer(marker);
    });
  }, [points, routeColorMode, voyage, onPointSelect]);

  // Build 002B: explicit playback overlay independent of Tailwind-generated marker classes.
  useEffect(() => {
    const playbackGroup = playbackLayersRef.current;
    if (!playbackGroup || !currentPoint) return;

    const heading = Number.isFinite(currentPoint.cog)
      ? currentPoint.cog!
      : Number.isFinite(currentPoint.heading)
        ? currentPoint.heading!
        : 0;

    const vesselHtml = `
      <div style="width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 4px rgba(0,0,0,.55));">
        <div style="position:absolute;width:30px;height:30px;border-radius:50%;background:rgba(6,182,212,.20);border:2px solid rgba(255,255,255,.92);box-shadow:0 0 0 5px rgba(6,182,212,.24);"></div>
        <div style="position:absolute;width:7px;height:7px;border-radius:50%;background:#ffffff;box-shadow:0 0 0 3px #0891b2;"></div>
        <svg width="34" height="34" viewBox="0 0 34 34" style="position:absolute;transform:rotate(${heading}deg);transition:transform .18s linear;overflow:visible;">
          <path d="M17 2 L26 29 L17 24 L8 29 Z" fill="#06b6d4" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/>
        </svg>
      </div>`;

    const vesselIcon = L.divIcon({
      className: '',
      html: vesselHtml,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    if (!vesselMarkerRef.current) {
      vesselMarkerRef.current = L.marker([currentPoint.lat, currentPoint.lon], {
        icon: vesselIcon,
        pane: 'playback',
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
      });
      playbackGroup.addLayer(vesselMarkerRef.current);
    } else {
      vesselMarkerRef.current.setLatLng([currentPoint.lat, currentPoint.lon]);
      vesselMarkerRef.current.setIcon(vesselIcon);
    }

    const travelled = points
      .slice(0, Math.min(activePointIndex + 1, points.length))
      .map((p) => [p.lat, p.lon] as [number, number]);

    if (travelled.length >= 2) {
      if (!progressLineRef.current) {
        progressLineRef.current = L.polyline(travelled, {
          pane: 'playback',
          color: '#ffffff',
          weight: 2,
          opacity: 0.75,
          dashArray: '5 7',
          interactive: false,
        });
        playbackGroup.addLayer(progressLineRef.current);
      } else {
        progressLineRef.current.setLatLngs(travelled);
      }
    } else if (progressLineRef.current) {
      playbackGroup.removeLayer(progressLineRef.current);
      progressLineRef.current = null;
    }
  }, [currentPoint, activePointIndex, points]);

  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || points.length === 0) return;
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])), { padding: [60, 60] });
  };

  const handleCenterVessel = () => {
    const map = mapInstanceRef.current;
    if (!map || !currentPoint) return;
    map.panTo([currentPoint.lat, currentPoint.lon], { animate: true });
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 backdrop-blur-md shadow-xl flex flex-col gap-1">
          <button onClick={() => mapInstanceRef.current?.zoomIn()} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors" title="Vergrößern (+)"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => mapInstanceRef.current?.zoomOut()} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors" title="Verkleinern (-)"><ZoomOut className="w-4 h-4" /></button>
          <div className="h-px bg-slate-700/60 my-0.5" />
          <button onClick={handleFitBounds} className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-md transition-colors" title="Gesamte Reiseroute anzeigen"><Compass className="w-4 h-4" /></button>
          <button onClick={handleCenterVessel} className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-md transition-colors" title="Auf Schiffsposition springen"><LocateFixed className="w-4 h-4" /></button>
        </div>
        <button onClick={onToggleRouteColorMode} className="bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 backdrop-blur-md shadow-xl text-slate-300 hover:text-white hover:bg-slate-800 text-[11px] font-medium flex items-center gap-1.5 transition-colors" title="Farbmodus der AIS-Route umschalten">
          <span>{routeColorMode === 'speed' ? 'Tempo-Farben' : 'Monochrom'}</span>
        </button>
      </div>

      {routeColorMode === 'speed' && (
        <div className="absolute bottom-20 left-4 z-20 bg-slate-900/90 border border-slate-700/80 rounded-lg p-2.5 backdrop-blur-md shadow-xl text-[11px] text-slate-300 pointer-events-none hidden sm:block">
          <div className="font-semibold text-slate-200 text-xs mb-1.5">AIS Geschwindigkeit (SOG)</div>
          <div>&lt; 0.3 kn · Liegeplatz &nbsp; | &nbsp; 0.3–3 kn · Hafen &nbsp; | &nbsp; 3–6 kn · Marschfahrt &nbsp; | &nbsp; &gt; 12 kn · Schnell</div>
        </div>
      )}

      <div className="absolute top-4 left-4 z-20 bg-slate-900/90 border border-slate-700/80 rounded-lg p-3 backdrop-blur-md shadow-xl max-w-xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/70 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center"><Ship className="w-3.5 h-3.5" /></div>
            <div><div className="text-xs font-bold text-slate-100 truncate">{voyage.metadata.vesselName}</div><div className="text-[10px] text-slate-400 font-mono">MMSI: {voyage.metadata.mmsi || '--'}</div></div>
          </div>
          <div className="text-right"><div className="text-xs font-bold text-cyan-400">{formatNM(voyage.totalDistanceNM)}</div><div className="text-[10px] text-slate-400">Gesamtdistanz</div></div>
        </div>
        {currentPoint && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300"><span className="text-slate-400 text-[11px]">Position:</span><span className="font-mono text-cyan-300 text-[11px] font-medium">{formatNauticalCoordinate(currentPoint.lat, currentPoint.lon)}</span></div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div><span className="text-[10px] text-slate-400 block">SOG:</span><span className="text-xs font-bold text-emerald-400 font-mono">{formatKnots(currentPoint.sog)}</span></div>
              <div><span className="text-[10px] text-slate-400 block">COG:</span><span className="text-xs font-bold text-amber-400 font-mono">{formatDegrees(currentPoint.cog)}</span></div>
            </div>
            <div className="text-[10px] text-slate-400 pt-1 flex justify-between"><span>Ab Start: {formatNM(currentPoint.distanceFromStartNM || 0)}</span><span>{currentPoint.timestamp.toLocaleTimeString('de-DE')}</span></div>
          </div>
        )}
      </div>

      {cursorPos && <div className="absolute bottom-2 right-4 z-20 bg-slate-900/80 border border-slate-700/60 rounded px-2 py-1 text-[11px] font-mono text-slate-400 pointer-events-none hidden md:block">Mauszeiger: {formatNauticalCoordinate(cursorPos.lat, cursorPos.lon)}</div>}
    </div>
  );
};
