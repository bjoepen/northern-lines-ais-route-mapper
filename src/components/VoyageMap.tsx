import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AisPoint, MapStyleId, RouteColorMode, VoyageData } from '../types';
import { 
  formatNauticalCoordinate, 
  formatKnots, 
  formatDegrees, 
  formatNM,
  getSpeedColor 
} from '../utils/geoUtils';
import { 
  Navigation, 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  LocateFixed, 
  Anchor, 
  Ship,
  Info
} from 'lucide-react';

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
  const vesselMarkerRef = useRef<L.Marker | null>(null);

  const [cursorPos, setCursorPos] = useState<{ lat: number; lon: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(10);

  const points = voyage.points;
  const currentPoint = points[activePointIndex] || points[0];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Create Map
    const initialLat = points[0]?.lat || 54.428;
    const initialLon = points[0]?.lon || 10.169;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 9,
      zoomControl: false,
      attributionControl: false,
    });

    // Custom Nautical Scale (Metric and Nautical Miles)
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorPos({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    mapInstanceRef.current = map;
    routeLayersRef.current = L.layerGroup().addTo(map);

    // Initial fit bounds
    if (points.length > 1) {
      const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Tile Layer and Nautical Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }

    let url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let maxZoom = 19;

    if (mapStyle === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
    } else if (mapStyle === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    } else if (mapStyle === 'nautical') {
      // Clean marine background from CartoDB Voyager, overlaid with OpenSeaMap
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }

    baseTileLayerRef.current = L.tileLayer(url, {
      maxZoom,
      subdomains: ['a', 'b', 'c'],
    }).addTo(map);

    // OpenSeaMap Seamarks Layer
    if (showSeaMarks) {
      if (!seaMarksLayerRef.current) {
        seaMarksLayerRef.current = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
          maxZoom: 18,
          opacity: 0.95,
        });
      }
      seaMarksLayerRef.current.addTo(map);
    } else if (seaMarksLayerRef.current && map.hasLayer(seaMarksLayerRef.current)) {
      map.removeLayer(seaMarksLayerRef.current);
    }
  }, [mapStyle, showSeaMarks]);

  // Update Route Polylines and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeGroup = routeLayersRef.current;
    if (!map || !routeGroup) return;

    routeGroup.clearLayers();

    if (points.length < 2) return;

    // Draw route segments
    if (routeColorMode === 'speed') {
      // Color-coded by SOG (Speed over ground)
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const color = getSpeedColor(p1.sog);

        const segment = L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
          color,
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
      // Solid nautical blue or cyan route
      const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);
      const fullLine = L.polyline(latLngs, {
        color: '#06b6d4',
        weight: 4,
        opacity: 0.85,
        dashArray: undefined,
      });
      fullLine.addTo(routeGroup);
    }

    // Start Marker (Green buoy / flag)
    const startPt = points[0];
    const startIcon = L.divIcon({
      className: 'start-marker',
      html: `
        <div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold ring-4 ring-emerald-500/30">
          ⚓
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const startMarker = L.marker([startPt.lat, startPt.lon], { icon: startIcon });
    startMarker.bindPopup(`
      <div class="text-xs p-1 text-slate-900 font-sans">
        <div class="font-bold text-emerald-700 text-sm">Törn-Start</div>
        <div>${startPt.timestamp.toLocaleDateString('de-DE')} ${startPt.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="text-slate-600 font-mono text-[11px] mt-0.5">${formatNauticalCoordinate(startPt.lat, startPt.lon)}</div>
      </div>
    `);
    routeGroup.addLayer(startMarker);

    // End / Destination Marker (Checkered or Red Buoy)
    const endPt = points[points.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker',
      html: `
        <div class="w-8 h-8 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold ring-4 ring-red-500/30">
          🏁
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const endMarker = L.marker([endPt.lat, endPt.lon], { icon: endIcon });
    endMarker.bindPopup(`
      <div class="text-xs p-1 text-slate-900 font-sans">
        <div class="font-bold text-red-700 text-sm">Törn-Ziel / Letzter AIS Kontakt</div>
        <div>Distanz: <strong>${formatNM(voyage.totalDistanceNM)}</strong></div>
        <div>${endPt.timestamp.toLocaleDateString('de-DE')} ${endPt.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
        <div class="text-slate-600 font-mono text-[11px] mt-0.5">${formatNauticalCoordinate(endPt.lat, endPt.lon)}</div>
      </div>
    `);
    routeGroup.addLayer(endMarker);

    // Detected Anchorages / Port Stops
    voyage.anchorages.forEach((anc) => {
      const ancIcon = L.divIcon({
        className: 'anchorage-marker',
        html: `
          <div class="w-6 h-6 rounded-full bg-amber-500 border border-white shadow-md flex items-center justify-center text-white text-[11px]">
            ⚓
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const ancMarker = L.marker([anc.lat, anc.lon], { icon: ancIcon });
      ancMarker.bindPopup(`
        <div class="text-xs p-1 text-slate-900 font-sans">
          <div class="font-bold text-amber-700">${anc.name}</div>
          <div>Dauer: <strong>${Math.round(anc.durationMinutes / 60)}h ${anc.durationMinutes % 60}m</strong></div>
          <div class="text-slate-500 text-[10px] font-mono mt-0.5">${formatNauticalCoordinate(anc.lat, anc.lon)}</div>
        </div>
      `);
      routeGroup.addLayer(ancMarker);
    });

  }, [points, routeColorMode, voyage]);

  // Update Vessel Marker on playback / scrub
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentPoint) return;

    const heading = currentPoint.cog || currentPoint.heading || 0;

    const vesselHtml = `
      <div class="relative flex items-center justify-center" style="transform: rotate(${heading}deg); transition: transform 0.2s ease;">
        <!-- Vessel Shape -->
        <div class="w-10 h-10 flex items-center justify-center relative">
          <!-- Pulse ripple -->
          <div class="absolute inset-0 rounded-full bg-cyan-400/40 animate-ping"></div>
          
          <!-- Boat symbol vector -->
          <svg class="w-8 h-8 drop-shadow-md text-cyan-400 filter" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L17 19L12 16L7 19L12 2Z" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        </div>
      </div>
    `;

    const vesselIcon = L.divIcon({
      className: 'vessel-current-pos',
      html: vesselHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (!vesselMarkerRef.current) {
      vesselMarkerRef.current = L.marker([currentPoint.lat, currentPoint.lon], {
        icon: vesselIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      vesselMarkerRef.current.setLatLng([currentPoint.lat, currentPoint.lon]);
      vesselMarkerRef.current.setIcon(vesselIcon);
    }
  }, [currentPoint]);

  // Fit bounds helper
  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    if (!map || points.length === 0) return;
    const latLngs = points.map((p) => [p.lat, p.lon] as [number, number]);
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [60, 60] });
  };

  // Center on current vessel position
  const handleCenterVessel = () => {
    const map = mapInstanceRef.current;
    if (!map || !currentPoint) return;
    map.panTo([currentPoint.lat, currentPoint.lon], { animate: true });
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating macOS Floating Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 backdrop-blur-md shadow-xl flex flex-col gap-1">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Vergrößern (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Verkleinern (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-700/60 my-0.5" />
          <button
            onClick={handleFitBounds}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-md transition-colors"
            title="Gesamte Reiseroute anzeigen"
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            onClick={handleCenterVessel}
            className="p-2 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 rounded-md transition-colors"
            title="Auf Schiffszentrierung springen"
          >
            <LocateFixed className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Color Legend Toggle */}
        <button
          onClick={onToggleRouteColorMode}
          className="bg-slate-900/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 backdrop-blur-md shadow-xl text-slate-300 hover:text-white hover:bg-slate-800 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
          title="Farbmodus der AIS-Route umschalten"
        >
          <div className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
          </div>
          <span>{routeColorMode === 'speed' ? 'Tempo-Farben' : 'Monochrom'}</span>
        </button>
      </div>

      {/* Floating Speed Legend (Bottom Left when Speed Mode active) */}
      {routeColorMode === 'speed' && (
        <div className="absolute bottom-20 left-4 z-20 bg-slate-900/90 border border-slate-700/80 rounded-lg p-2.5 backdrop-blur-md shadow-xl text-[11px] text-slate-300 pointer-events-none hidden sm:block">
          <div className="font-semibold text-slate-200 text-xs mb-1.5 flex items-center gap-1">
            <span>AIS Geschwindigkeit (SOG)</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></span>
              <span>&lt; 0.3 kn (Liegeplatz)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]"></span>
              <span>0.3 – 3 kn (Hafen)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
              <span>3 – 6 kn (Marschfahrt)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span>
              <span>6 – 8.5 kn (Gute Fahrt)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]"></span>
              <span>8.5 – 12 kn (Schnell)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></span>
              <span>&gt; 12 kn (Gleitfahrt)</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating HUD: Coordinates & Compass Rose (Top Left) */}
      <div className="absolute top-4 left-4 z-20 bg-slate-900/90 border border-slate-700/80 rounded-lg p-3 backdrop-blur-md shadow-xl max-w-xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/70 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
              <Ship className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 truncate">{voyage.metadata.vesselName}</div>
              <div className="text-[10px] text-slate-400 font-mono">MMSI: {voyage.metadata.mmsi || '--'}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-cyan-400">{formatNM(voyage.totalDistanceNM)}</div>
            <div className="text-[10px] text-slate-400">Gesamtdistanz</div>
          </div>
        </div>

        {/* Current Active Point Telemetry */}
        {currentPoint && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 text-[11px]">Position:</span>
              <span className="font-mono text-cyan-300 text-[11px] font-medium">
                {formatNauticalCoordinate(currentPoint.lat, currentPoint.lon)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block">SOG (Fahrt ü. Grund):</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {formatKnots(currentPoint.sog)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">COG (Kurs ü. Grund):</span>
                <span className="text-xs font-bold text-amber-400 font-mono">
                  {formatDegrees(currentPoint.cog)}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
              <span>Distanz ab Start: {formatNM(currentPoint.distanceFromStartNM || 0)}</span>
              <span>{currentPoint.timestamp.toLocaleTimeString('de-DE')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Cursor Floating Nautical Coordinates (Bottom Right) */}
      {cursorPos && (
        <div className="absolute bottom-2 right-4 z-20 bg-slate-900/80 border border-slate-700/60 rounded px-2 py-1 backdrop-blur-xs text-[11px] font-mono text-slate-400 pointer-events-none hidden md:block">
          Mauszeiger: {formatNauticalCoordinate(cursorPos.lat, cursorPos.lon)}
        </div>
      )}
    </div>
  );
};
