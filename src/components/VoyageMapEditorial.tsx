import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapStyleId, MapperReviewRoute, RouteColorMode, VoyageData } from '../types';
import { GapDisplayAdjustment } from '../project/nlroute';
import { formatNauticalCoordinate, formatKnots, formatDegrees, formatNM, getSpeedColor } from '../utils/geoUtils';
import { Compass, LocateFixed, Plus, RotateCcw, Ship, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

interface VoyageMapProps {
  voyage: VoyageData;
  activePointIndex: number;
  onPointSelect: (index: number) => void;
  mapStyle: MapStyleId;
  showSeaMarks: boolean;
  routeColorMode: RouteColorMode;
  onToggleRouteColorMode: () => void;
  gapAdjustments: GapDisplayAdjustment[];
  onGapAdjustmentsChange: (adjustments: GapDisplayAdjustment[]) => void;
}

type Coordinate = { lat: number; lon: number };

function midpoint(a: Coordinate, b: Coordinate): Coordinate {
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
}

function seedControlPoint(route: MapperReviewRoute): Coordinate | null {
  if (route.points.length < 2) return null;
  if (route.points.length > 2) return { ...route.points[Math.floor(route.points.length / 2)] };
  return midpoint(route.points[0], route.points[1]);
}

function effectiveRoute(route: MapperReviewRoute, adjustment?: GapDisplayAdjustment): Coordinate[] {
  if (!adjustment || route.points.length < 2) return route.points;
  return [route.points[0], ...adjustment.controlPoints, route.points[route.points.length - 1]];
}

function distanceScore(a: Coordinate, b: Coordinate): number {
  const latScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dx = (b.lon - a.lon) * latScale;
  const dy = b.lat - a.lat;
  return dx * dx + dy * dy;
}

function addPointToLongestLeg(route: MapperReviewRoute, adjustment: GapDisplayAdjustment): GapDisplayAdjustment {
  const geometry = effectiveRoute(route, adjustment);
  if (geometry.length < 2) return adjustment;
  let leg = 0;
  let best = -1;
  for (let i = 0; i < geometry.length - 1; i++) {
    const score = distanceScore(geometry[i], geometry[i + 1]);
    if (score > best) { best = score; leg = i; }
  }
  const controlPoints = [...adjustment.controlPoints];
  controlPoints.splice(leg, 0, midpoint(geometry[leg], geometry[leg + 1]));
  return { ...adjustment, controlPoints };
}

export const VoyageMap: React.FC<VoyageMapProps> = ({
  voyage, activePointIndex, onPointSelect, mapStyle, showSeaMarks, routeColorMode,
  onToggleRouteColorMode, gapAdjustments, onGapAdjustmentsChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const seaMarksLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayersRef = useRef<L.LayerGroup | null>(null);
  const playbackLayersRef = useRef<L.LayerGroup | null>(null);
  const vesselMarkerRef = useRef<L.Marker | null>(null);
  const [cursorPos, setCursorPos] = useState<Coordinate | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedControlIndex, setSelectedControlIndex] = useState<number | null>(null);

  const points = voyage.points;
  const segments = useMemo(() => voyage.segments?.length ? voyage.segments : [{ id: 'legacy-segment', points }], [voyage.segments, points]);
  const pointIndex = useMemo(() => new Map(points.map((point, index) => [point.id, index])), [points]);
  const currentPoint = points[activePointIndex] || points[0];
  const selectedRoute = voyage.mapperReview?.reconstructedRoutes.find(route => route.id === selectedRouteId) || null;
  const selectedAdjustment = selectedRoute ? gapAdjustments.find(item => item.routeId === selectedRoute.id) : undefined;

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, { center: [points[0]?.lat || 54.428, points[0]?.lon || 10.169], zoom: 9, zoomControl: false, attributionControl: true });
    map.createPane('playback');
    const pane = map.getPane('playback');
    if (pane) { pane.style.zIndex = '680'; pane.style.pointerEvents = 'none'; }
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);
    map.on('mousemove', (e: L.LeafletMouseEvent) => setCursorPos({ lat: e.latlng.lat, lon: e.latlng.lng }));
    map.on('click', () => setSelectedControlIndex(null));
    mapInstanceRef.current = map;
    routeLayersRef.current = L.layerGroup().addTo(map);
    playbackLayersRef.current = L.layerGroup().addTo(map);
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lon] as [number, number])), { padding: [50, 50] });
    return () => { map.remove(); mapInstanceRef.current = null; vesselMarkerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    baseTileLayerRef.current = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    const enabled = mapStyle === 'nautical' && showSeaMarks;
    if (enabled) {
      if (!seaMarksLayerRef.current) seaMarksLayerRef.current = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 18, opacity: .95, attribution: 'Map data &copy; OpenSeaMap contributors' });
      seaMarksLayerRef.current.addTo(map);
    } else if (seaMarksLayerRef.current && map.hasLayer(seaMarksLayerRef.current)) map.removeLayer(seaMarksLayerRef.current);
  }, [mapStyle, showSeaMarks]);

  useEffect(() => {
    const group = routeLayersRef.current;
    if (!group) return;
    group.clearLayers();
    if (points.length < 2) return;

    if (voyage.mapperReview) {
      voyage.mapperReview.observedRoutes.forEach(route => {
        L.polyline(route.points.map(p => [p.lat, p.lon] as [number, number]), { color: '#456f75', weight: 4, opacity: .9, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(group);
      });

      voyage.mapperReview.reconstructedRoutes.forEach(route => {
        const adjustment = gapAdjustments.find(item => item.routeId === route.id);
        const displayPoints = effectiveRoute(route, adjustment);
        const reviewRequired = route.reviewState === 'review_required';
        const selected = route.id === selectedRouteId;
        const line = L.polyline(displayPoints.map(p => [p.lat, p.lon] as [number, number]), {
          color: adjustment ? '#9a7749' : reviewRequired ? '#b59668' : '#6f7c68',
          weight: selected ? 7 : 5,
          opacity: .95,
          dashArray: adjustment ? undefined : reviewRequired ? '9 7' : undefined,
          lineCap: 'round', lineJoin: 'round',
        });
        const detail = [
          '<strong>Reconstructed Route</strong>',
          adjustment ? 'Editorial: angepasst' : null,
          route.method ? `Methode: ${route.method}${route.methodVersion ? ` · ${route.methodVersion}` : ''}` : null,
          route.classification ? `Klasse: ${route.classification}` : null,
          route.reviewState ? `Review: ${route.reviewState}` : null,
          route.visualAcceptance ? `Visual: ${route.visualAcceptance}` : null,
          route.sourceSegmentIndex !== undefined ? `Source Segment: ${route.sourceSegmentIndex}` : null,
          route.policyReason ? `<br>${route.policyReason}` : null,
        ].filter(Boolean).join('<br>');
        line.bindPopup(detail);
        line.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          setSelectedRouteId(route.id);
          setSelectedControlIndex(null);
        });
        line.addTo(group);

        if (selected && adjustment) {
          adjustment.controlPoints.forEach((point, index) => {
            const isSelected = selectedControlIndex === index;
            const size = isSelected ? 18 : 14;
            const icon = L.divIcon({
              className: '',
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#fffdf8;border:3px solid #9a7749;box-shadow:0 2px 7px rgba(36,48,46,.35)"></div>`,
              iconSize: [size, size], iconAnchor: [size / 2, size / 2],
            });
            const marker = L.marker([point.lat, point.lon], { icon, draggable: true, zIndexOffset: 1600 });
            marker.on('click', (event) => { L.DomEvent.stopPropagation(event); setSelectedControlIndex(index); });
            marker.on('dragend', () => {
              const nextPos = marker.getLatLng();
              const next = gapAdjustments.map(item => item.routeId === route.id
                ? { ...item, controlPoints: item.controlPoints.map((cp, cpIndex) => cpIndex === index ? { lat: nextPos.lat, lon: nextPos.lng } : cp) }
                : item);
              onGapAdjustmentsChange(next);
            });
            marker.addTo(group);
          });
        }
      });
    } else {
      segments.forEach(section => {
        const routePoints = section.points;
        if (routePoints.length < 2) return;
        if (routeColorMode === 'speed') {
          for (let i = 0; i < routePoints.length - 1; i++) {
            const p1 = routePoints[i], p2 = routePoints[i + 1];
            const line = L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], { color: getSpeedColor(p1.sog), weight: 4, opacity: .9, lineCap: 'round', lineJoin: 'round' });
            const idx = pointIndex.get(p1.id) ?? 0;
            line.on('click', () => onPointSelect(idx));
            group.addLayer(line);
          }
        } else L.polyline(routePoints.map(p => [p.lat, p.lon] as [number, number]), { color: '#456f75', weight: 4, opacity: .9, lineCap: 'round', lineJoin: 'round' }).addTo(group);
      });
    }

    const start = points[0], end = points[points.length - 1];
    const mk = (bg: string, emoji: string, size = 32) => L.divIcon({ className: '', html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid #fffdf8;box-shadow:0 2px 8px rgba(36,48,46,.35);display:flex;align-items:center;justify-content:center;font-size:13px">${emoji}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    const sm = L.marker([start.lat, start.lon], { icon: mk('#6f7c68', '⚓') });
    sm.bindPopup(`<strong>Reise-Start</strong><br>${start.timestamp.toLocaleString('de-DE')}`); group.addLayer(sm);
    const em = L.marker([end.lat, end.lon], { icon: mk('#b59668', '●') });
    em.bindPopup(`<strong>Reise-Ziel</strong><br>${end.timestamp.toLocaleString('de-DE')}`); group.addLayer(em);
  }, [points, segments, pointIndex, routeColorMode, voyage, onPointSelect, gapAdjustments, onGapAdjustmentsChange, selectedRouteId, selectedControlIndex]);

  useEffect(() => {
    const group = playbackLayersRef.current;
    if (!group) return;
    if (voyage.playbackAvailable === false || !currentPoint) {
      if (vesselMarkerRef.current) { group.removeLayer(vesselMarkerRef.current); vesselMarkerRef.current = null; }
      return;
    }
    const heading = Number.isFinite(currentPoint.cog) ? currentPoint.cog! : Number.isFinite(currentPoint.heading) ? currentPoint.heading! : 0;
    const html = `<div style="width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 4px rgba(36,48,46,.45))"><div style="position:absolute;width:30px;height:30px;border-radius:50%;background:rgba(69,111,117,.18);border:2px solid #fffdf8"></div><svg width="34" height="34" viewBox="0 0 34 34" style="position:absolute;transform:rotate(${heading}deg)"><path d="M17 2 L26 29 L17 24 L8 29 Z" fill="#456f75" stroke="#fffdf8" stroke-width="2.4"/></svg></div>`;
    const icon = L.divIcon({ className: '', html, iconSize: [48, 48], iconAnchor: [24, 24] });
    if (!vesselMarkerRef.current) { vesselMarkerRef.current = L.marker([currentPoint.lat, currentPoint.lon], { icon, pane: 'playback', interactive: false, zIndexOffset: 2000 }); group.addLayer(vesselMarkerRef.current); }
    else { vesselMarkerRef.current.setLatLng([currentPoint.lat, currentPoint.lon]); vesselMarkerRef.current.setIcon(icon); }
  }, [currentPoint, voyage.playbackAvailable]);

  const startAdjustment = () => {
    if (!selectedRoute || selectedAdjustment) return;
    const seed = seedControlPoint(selectedRoute);
    if (!seed) return;
    onGapAdjustmentsChange([...gapAdjustments, { routeId: selectedRoute.id, controlPoints: [seed] }]);
    setSelectedControlIndex(0);
  };

  const addControlPoint = () => {
    if (!selectedRoute || !selectedAdjustment) return;
    const nextAdjustment = addPointToLongestLeg(selectedRoute, selectedAdjustment);
    onGapAdjustmentsChange(gapAdjustments.map(item => item.routeId === selectedRoute.id ? nextAdjustment : item));
    setSelectedControlIndex(nextAdjustment.controlPoints.length - 1);
  };

  const removeControlPoint = () => {
    if (!selectedRoute || !selectedAdjustment || selectedControlIndex === null) return;
    const remaining = selectedAdjustment.controlPoints.filter((_, index) => index !== selectedControlIndex);
    if (remaining.length === 0) {
      onGapAdjustmentsChange(gapAdjustments.filter(item => item.routeId !== selectedRoute.id));
      setSelectedControlIndex(null);
      return;
    }
    onGapAdjustmentsChange(gapAdjustments.map(item => item.routeId === selectedRoute.id ? { ...item, controlPoints: remaining } : item));
    setSelectedControlIndex(Math.min(selectedControlIndex, remaining.length - 1));
  };

  const resetAdjustment = () => {
    if (!selectedRoute) return;
    onGapAdjustmentsChange(gapAdjustments.filter(item => item.routeId !== selectedRoute.id));
    setSelectedControlIndex(null);
  };

  const fit = () => { const map = mapInstanceRef.current; if (map && points.length) map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lon] as [number, number])), { padding: [60, 60] }); };
  const center = () => { const map = mapInstanceRef.current; if (map && currentPoint) map.panTo([currentPoint.lat, currentPoint.lon], { animate: true }); };
  const reviewCount = voyage.mapperReview?.reviewRequiredCount || 0;

  return <div className="relative w-full h-full overflow-hidden select-none"><div ref={mapContainerRef} className="w-full h-full z-0"/>
    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2"><div className="nl-panel rounded-xl p-1 flex flex-col gap-1 shadow-md"><button onClick={()=>mapInstanceRef.current?.zoomIn()} className="p-2 text-[#66716d] hover:text-[#24302e] hover:bg-[#ebe6da] rounded-lg"><ZoomIn className="w-4 h-4"/></button><button onClick={()=>mapInstanceRef.current?.zoomOut()} className="p-2 text-[#66716d] hover:text-[#24302e] hover:bg-[#ebe6da] rounded-lg"><ZoomOut className="w-4 h-4"/></button><div className="h-px bg-[#d8d2c5]"/><button onClick={fit} className="p-2 text-[#66716d] hover:text-[#31575d] hover:bg-[#ebe6da] rounded-lg"><Compass className="w-4 h-4"/></button><button onClick={center} className="p-2 text-[#66716d] hover:text-[#31575d] hover:bg-[#ebe6da] rounded-lg"><LocateFixed className="w-4 h-4"/></button></div>{!voyage.mapperReview&&<button onClick={onToggleRouteColorMode} className="nl-panel rounded-full px-3 py-1.5 text-[10px] text-[#66716d] shadow-sm">{routeColorMode==='speed'?'Tempo-Farben':'Monochrom'}</button>}</div>

    {voyage.mapperReview&&<div className="absolute bottom-20 left-4 z-20 nl-panel rounded-xl px-3 py-2 shadow-md text-[10px] text-[#66716d]"><div className="font-semibold text-[#24302e] mb-1">Mapper Review</div><div><span className="text-[#456f75]">━━</span> observed &nbsp; <span className="text-[#b59668]">┅┅</span> reconstruction &nbsp; <span className="text-[#9a7749]">━━</span> editorial</div><div className="mt-1">{voyage.mapperReview.observedRoutes.length} observed · {voyage.mapperReview.reconstructedRoutes.length} reconstructed · {reviewCount} review required</div></div>}

    {selectedRoute&&<div className="absolute right-16 top-4 z-30 w-[280px] nl-panel rounded-2xl p-4 shadow-lg text-[11px] text-[#66716d]">
      <div className="text-[9px] uppercase tracking-[.18em] text-[#6f7c68] font-semibold">Editorial Reconstruction</div>
      <div className="mt-1 font-semibold text-[#24302e]">{selectedRoute.method || 'Reconstruction'}{selectedRoute.methodVersion ? ` · ${selectedRoute.methodVersion}` : ''}</div>
      <div className="mt-1 text-[10px]">Source Segment {selectedRoute.sourceSegmentIndex ?? '—'} · {selectedRoute.reviewState || 'review'}</div>
      {!selectedAdjustment?<button onClick={startAdjustment} className="mt-3 w-full rounded-full bg-[#31575d] text-[#fffdf8] px-3 py-2 font-semibold">Darstellung anpassen</button>:<>
        <div className="mt-3 p-2.5 rounded-xl bg-[#f4f1e9] border border-[#d8d2c5]"><div className="font-semibold text-[#9a7749]">Display-only · {selectedAdjustment.controlPoints.length} Kontrollpunkt{selectedAdjustment.controlPoints.length===1?'':'e'}</div><div className="mt-1 text-[10px] leading-relaxed">Die Endpunkte bleiben unverändert. Verschiebe die runden Griffe; die QA-Geometrie wird nicht überschrieben.</div></div>
        <div className="mt-3 flex gap-2"><button onClick={addControlPoint} className="nl-button flex-1 rounded-full px-3 py-2 font-semibold flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5"/>Punkt</button><button onClick={removeControlPoint} disabled={selectedControlIndex===null} className="nl-button flex-1 rounded-full px-3 py-2 font-semibold flex items-center justify-center gap-1 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5"/>Entfernen</button></div>
        <button onClick={resetAdjustment} className="mt-2 w-full rounded-full px-3 py-2 text-[#8b6e49] hover:bg-[#f4f1e9] font-semibold flex items-center justify-center gap-1"><RotateCcw className="w-3.5 h-3.5"/>Zurücksetzen</button>
      </>}
      <button onClick={()=>{setSelectedRouteId(null);setSelectedControlIndex(null);}} className="mt-2 w-full text-[10px] text-[#8a918d] hover:text-[#24302e]">Auswahl schließen</button>
    </div>}

    <div className="absolute top-4 left-4 z-20 w-[300px] nl-panel rounded-2xl px-4 py-3 shadow-md"><div className="flex items-start justify-between gap-3 pb-2.5 border-b border-[#d8d2c5]"><div className="min-w-0"><div className="text-[9px] uppercase tracking-[.18em] text-[#6f7c68] font-semibold">{voyage.mapperReview?'Mapper Review':'Aktuelle Position'}</div><div className="mt-1 flex items-center gap-2"><Ship className="w-4 h-4 text-[#456f75]"/><span className="text-[13px] font-semibold truncate text-[#24302e]">{voyage.metadata.vesselName}</span></div><div className="text-[9px] text-[#8a918d] mt-0.5">{voyage.mapperReview?.source.journeyId||voyage.northernLinesSource?.journeyId||`MMSI ${voyage.metadata.mmsi||'—'}`}</div></div><div className="text-right"><div className="text-[15px] font-semibold text-[#31575d]">{formatNM(voyage.totalDistanceNM)}</div><div className="text-[9px] text-[#8a918d]">AIS-Distanz</div></div></div>
      {currentPoint&&<><div className="py-2.5"><div className="text-[9px] uppercase tracking-[.12em] text-[#8a918d] mb-1">Koordinate</div><div className="text-[11px] font-medium text-[#31575d]">{formatNauticalCoordinate(currentPoint.lat,currentPoint.lon)}</div></div><div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[#d8d2c5]"><div><div className="text-[9px] text-[#8a918d]">SOG</div><div className="text-[13px] font-semibold text-[#6f7c68]">{formatKnots(currentPoint.sog)}</div></div><div><div className="text-[9px] text-[#8a918d]">COG</div><div className="text-[13px] font-semibold text-[#b59668]">{formatDegrees(currentPoint.cog)}</div></div><div><div className="text-[9px] text-[#8a918d]">Review</div><div className="text-[13px] font-semibold text-[#24302e]">{reviewCount||'—'}</div></div></div><div className="mt-2 text-[9px] text-[#8a918d] text-right">{voyage.mapperReview?'Review-Artefakt · Playback aus':currentPoint.timestamp.toLocaleTimeString('de-DE')}</div></>}
    </div>
    {cursorPos&&<div className="absolute bottom-2 right-4 z-20 bg-[#fffdf8]/90 border border-[#d8d2c5] rounded-full px-2.5 py-1 text-[9px] text-[#66716d] pointer-events-none hidden md:block">{formatNauticalCoordinate(cursorPos.lat,cursorPos.lon)}</div>}
  </div>;
};
