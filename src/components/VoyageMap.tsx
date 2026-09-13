import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapStyleId, RouteColorMode, VoyageData } from '../types';
import { formatNauticalCoordinate, formatKnots, formatDegrees, formatNM, getSpeedColor } from '../utils/geoUtils';
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

export const VoyageMap: React.FC<VoyageMapProps> = ({ voyage, activePointIndex, onPointSelect, mapStyle, showSeaMarks, routeColorMode, onToggleRouteColorMode }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const seaMarksLayerRef = useRef<L.TileLayer | null>(null);
  const routeLayersRef = useRef<L.LayerGroup | null>(null);
  const playbackLayersRef = useRef<L.LayerGroup | null>(null);
  const vesselMarkerRef = useRef<L.Marker | null>(null);
  const progressLinesRef = useRef<L.Polyline[]>([]);
  const [cursorPos, setCursorPos] = useState<{lat:number;lon:number}|null>(null);

  const points = voyage.points;
  const segments = useMemo(() => voyage.segments?.length ? voyage.segments : [{id:'legacy-segment',points}], [voyage.segments, points]);
  const pointIndex = useMemo(() => new Map(points.map((point,index)=>[point.id,index])), [points]);
  const currentPoint = points[activePointIndex] || points[0];

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, { center:[points[0]?.lat||54.428,points[0]?.lon||10.169], zoom:9, zoomControl:false, attributionControl:true });
    map.createPane('playback');
    const pane = map.getPane('playback');
    if (pane) { pane.style.zIndex='680'; pane.style.pointerEvents='none'; }
    L.control.scale({imperial:false,metric:true,position:'bottomleft'}).addTo(map);
    map.on('mousemove',(e:L.LeafletMouseEvent)=>setCursorPos({lat:e.latlng.lat,lon:e.latlng.lng}));
    mapInstanceRef.current=map;
    routeLayersRef.current=L.layerGroup().addTo(map);
    playbackLayersRef.current=L.layerGroup().addTo(map);
    if(points.length>1) map.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon] as [number,number])),{padding:[50,50]});
    return()=>{map.remove();mapInstanceRef.current=null;vesselMarkerRef.current=null;progressLinesRef.current=[];};
  },[]);

  useEffect(()=>{
    const map=mapInstanceRef.current;if(!map)return;
    if(baseTileLayerRef.current)map.removeLayer(baseTileLayerRef.current);
    baseTileLayerRef.current=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const enabled=mapStyle==='nautical'&&showSeaMarks;
    if(enabled){
      if(!seaMarksLayerRef.current)seaMarksLayerRef.current=L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',{maxZoom:18,opacity:.95,attribution:'Map data &copy; OpenSeaMap contributors'});
      seaMarksLayerRef.current.addTo(map);
    } else if(seaMarksLayerRef.current&&map.hasLayer(seaMarksLayerRef.current)) map.removeLayer(seaMarksLayerRef.current);
  },[mapStyle,showSeaMarks]);

  useEffect(()=>{
    const group=routeLayersRef.current;if(!group)return;group.clearLayers();if(points.length<2)return;

    if(voyage.mapperReview){
      voyage.mapperReview.observedRoutes.forEach(route=>{
        L.polyline(route.points.map(p=>[p.lat,p.lon] as [number,number]),{color:'#456f75',weight:4,opacity:.9,lineCap:'round',lineJoin:'round',interactive:false}).addTo(group);
      });
      voyage.mapperReview.reconstructedRoutes.forEach(route=>{
        const reviewRequired=route.reviewState==='review_required';
        const line=L.polyline(route.points.map(p=>[p.lat,p.lon] as [number,number]),{color:reviewRequired?'#b59668':'#6f7c68',weight:5,opacity:.95,dashArray:reviewRequired?'9 7':undefined,lineCap:'round',lineJoin:'round'});
        const detail=[
          '<strong>Reconstructed Route</strong>',
          route.method?`Methode: ${route.method}${route.methodVersion?` · ${route.methodVersion}`:''}`:null,
          route.classification?`Klasse: ${route.classification}`:null,
          route.reviewState?`Review: ${route.reviewState}`:null,
          route.visualAcceptance?`Visual: ${route.visualAcceptance}`:null,
          route.sourceSegmentIndex!==undefined?`Source Segment: ${route.sourceSegmentIndex}`:null,
          route.policyReason?`<br>${route.policyReason}`:null,
        ].filter(Boolean).join('<br>');
        line.bindPopup(detail);
        line.addTo(group);
      });
    } else {
      segments.forEach(section=>{
        const routePoints=section.points;if(routePoints.length<2)return;
        if(routeColorMode==='speed'){
          for(let i=0;i<routePoints.length-1;i++){
            const p1=routePoints[i],p2=routePoints[i+1];
            const line=L.polyline([[p1.lat,p1.lon],[p2.lat,p2.lon]],{color:getSpeedColor(p1.sog),weight:4,opacity:.9,lineCap:'round',lineJoin:'round'});
            const idx=pointIndex.get(p1.id)??0;line.on('click',()=>onPointSelect(idx));group.addLayer(line);
          }
        } else L.polyline(routePoints.map(p=>[p.lat,p.lon] as [number,number]),{color:'#456f75',weight:4,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(group);
      });
    }

    const start=points[0],end=points[points.length-1];
    const mk=(bg:string,emoji:string,size=32)=>L.divIcon({className:'',html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid #fffdf8;box-shadow:0 2px 8px rgba(36,48,46,.35);display:flex;align-items:center;justify-content:center;font-size:13px">${emoji}</div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});
    const sm=L.marker([start.lat,start.lon],{icon:mk('#6f7c68','⚓')});sm.bindPopup(`<strong>Törn-Start</strong><br>${start.timestamp.toLocaleString('de-DE')}`);group.addLayer(sm);
    const em=L.marker([end.lat,end.lon],{icon:mk('#b59668','●')});em.bindPopup(`<strong>Törn-Ziel</strong><br>${end.timestamp.toLocaleString('de-DE')}`);group.addLayer(em);
  },[points,segments,pointIndex,routeColorMode,voyage,onPointSelect]);

  useEffect(()=>{
    const group=playbackLayersRef.current;if(!group)return;
    progressLinesRef.current.forEach(line=>group.removeLayer(line));progressLinesRef.current=[];
    if(voyage.playbackAvailable===false||!currentPoint){if(vesselMarkerRef.current){group.removeLayer(vesselMarkerRef.current);vesselMarkerRef.current=null;}return;}
    const heading=Number.isFinite(currentPoint.cog)?currentPoint.cog!:Number.isFinite(currentPoint.heading)?currentPoint.heading!:0;
    const html=`<div style="width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 4px rgba(36,48,46,.45))"><div style="position:absolute;width:30px;height:30px;border-radius:50%;background:rgba(69,111,117,.18);border:2px solid #fffdf8"></div><svg width="34" height="34" viewBox="0 0 34 34" style="position:absolute;transform:rotate(${heading}deg)"><path d="M17 2 L26 29 L17 24 L8 29 Z" fill="#456f75" stroke="#fffdf8" stroke-width="2.4"/></svg></div>`;
    const icon=L.divIcon({className:'',html,iconSize:[48,48],iconAnchor:[24,24]});
    if(!vesselMarkerRef.current){vesselMarkerRef.current=L.marker([currentPoint.lat,currentPoint.lon],{icon,pane:'playback',interactive:false,zIndexOffset:2000});group.addLayer(vesselMarkerRef.current);}else{vesselMarkerRef.current.setLatLng([currentPoint.lat,currentPoint.lon]);vesselMarkerRef.current.setIcon(icon);}
  },[currentPoint,voyage.playbackAvailable]);

  const fit=()=>{const m=mapInstanceRef.current;if(m&&points.length)m.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon] as [number,number])),{padding:[60,60]});};
  const center=()=>{const m=mapInstanceRef.current;if(m&&currentPoint)m.panTo([currentPoint.lat,currentPoint.lon],{animate:true});};
  const reviewCount=voyage.mapperReview?.reviewRequiredCount||0;

  return <div className="relative w-full h-full overflow-hidden select-none"><div ref={mapContainerRef} className="w-full h-full z-0"/>
    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2"><div className="nl-panel rounded-xl p-1 flex flex-col gap-1 shadow-md"><button onClick={()=>mapInstanceRef.current?.zoomIn()} className="p-2 text-[#66716d] hover:text-[#24302e] hover:bg-[#ebe6da] rounded-lg"><ZoomIn className="w-4 h-4"/></button><button onClick={()=>mapInstanceRef.current?.zoomOut()} className="p-2 text-[#66716d] hover:text-[#24302e] hover:bg-[#ebe6da] rounded-lg"><ZoomOut className="w-4 h-4"/></button><div className="h-px bg-[#d8d2c5]"/><button onClick={fit} className="p-2 text-[#66716d] hover:text-[#31575d] hover:bg-[#ebe6da] rounded-lg"><Compass className="w-4 h-4"/></button><button onClick={center} className="p-2 text-[#66716d] hover:text-[#31575d] hover:bg-[#ebe6da] rounded-lg"><LocateFixed className="w-4 h-4"/></button></div>{!voyage.mapperReview&&<button onClick={onToggleRouteColorMode} className="nl-panel rounded-full px-3 py-1.5 text-[10px] text-[#66716d] shadow-sm">{routeColorMode==='speed'?'Tempo-Farben':'Monochrom'}</button>}</div>
    {voyage.mapperReview&&<div className="absolute bottom-20 left-4 z-20 nl-panel rounded-xl px-3 py-2 shadow-md text-[10px] text-[#66716d]"><div className="font-semibold text-[#24302e] mb-1">Mapper Review</div><div><span className="text-[#456f75]">━━</span> observed &nbsp; <span className="text-[#b59668]">┅┅</span> reconstruction</div><div className="mt-1">{voyage.mapperReview.observedRoutes.length} observed · {voyage.mapperReview.reconstructedRoutes.length} reconstructed · {reviewCount} review required</div></div>}
    <div className="absolute top-4 left-4 z-20 w-[300px] nl-panel rounded-2xl px-4 py-3 shadow-md"><div className="flex items-start justify-between gap-3 pb-2.5 border-b border-[#d8d2c5]"><div className="min-w-0"><div className="text-[9px] uppercase tracking-[.18em] text-[#6f7c68] font-semibold">{voyage.mapperReview?'Mapper Review':'Aktuelle Position'}</div><div className="mt-1 flex items-center gap-2"><Ship className="w-4 h-4 text-[#456f75]"/><span className="text-[13px] font-semibold truncate text-[#24302e]">{voyage.metadata.vesselName}</span></div><div className="text-[9px] text-[#8a918d] mt-0.5">{voyage.mapperReview?.source.journeyId||voyage.northernLinesSource?.journeyId||`MMSI ${voyage.metadata.mmsi||'—'}`}</div></div><div className="text-right"><div className="text-[15px] font-semibold text-[#31575d]">{formatNM(voyage.totalDistanceNM)}</div><div className="text-[9px] text-[#8a918d]">AIS-Distanz</div></div></div>
      {currentPoint&&<><div className="py-2.5"><div className="text-[9px] uppercase tracking-[.12em] text-[#8a918d] mb-1">Koordinate</div><div className="text-[11px] font-medium text-[#31575d]">{formatNauticalCoordinate(currentPoint.lat,currentPoint.lon)}</div></div><div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[#d8d2c5]"><div><div className="text-[9px] text-[#8a918d]">SOG</div><div className="text-[13px] font-semibold text-[#6f7c68]">{formatKnots(currentPoint.sog)}</div></div><div><div className="text-[9px] text-[#8a918d]">COG</div><div className="text-[13px] font-semibold text-[#b59668]">{formatDegrees(currentPoint.cog)}</div></div><div><div className="text-[9px] text-[#8a918d]">Review</div><div className="text-[13px] font-semibold text-[#24302e]">{reviewCount||'—'}</div></div></div><div className="mt-2 text-[9px] text-[#8a918d] text-right">{voyage.mapperReview?'Review-Artefakt · Playback aus':currentPoint.timestamp.toLocaleTimeString('de-DE')}</div></>}
    </div>
    {cursorPos&&<div className="absolute bottom-2 right-4 z-20 bg-[#fffdf8]/90 border border-[#d8d2c5] rounded-full px-2.5 py-1 text-[9px] text-[#66716d] pointer-events-none hidden md:block">{formatNauticalCoordinate(cursorPos.lat,cursorPos.lon)}</div>}
  </div>;
};
