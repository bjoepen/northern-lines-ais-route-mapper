/** @license SPDX-License-Identifier: Apache-2.0 */
import React, { useEffect, useRef, useState } from 'react';
import { ActiveTab, AnchorageStop, MapStyleId, RouteColorMode, VoyageData, VoyageMetadata } from './types';
import { MacTitleBar } from './components/MacTitleBar';
import { VoyageMap } from './components/VoyageMapEditorial';
import { PlaybackController } from './components/PlaybackController';
import { LogbookView } from './components/LogbookView';
import { AisDataView } from './components/AisDataView';
import { EditorialExportView } from './components/EditorialExportView';
import { createRouteProject, GapDisplayAdjustment, NorthernLinesRouteProject, parseRouteProject, projectFileName, serializeRouteProject } from './project/nlroute';
import { FileCode, FolderOpen, Map as MapIcon } from 'lucide-react';

const EMPTY_VOYAGE: VoyageData = {
  metadata:{title:'Keine Reise geladen',vesselName:''}, rawPoints:[], points:[], segments:[], gaps:[], playbackAvailable:false, geometryOnly:false,
  trackContract:{version:'0.2.0',rawPointCount:0,canonicalPointCount:0,sourceFormats:[],timestampProvenance:[],observedMmsi:[],mixedMmsi:false},
  totalDistanceNM:0,avgSpeedKnots:0,maxSpeedKnots:0,durationSeconds:0,startTime:null,endTime:null,anchorages:[],bounds:{minLat:0,maxLat:0,minLon:0,maxLon:0},
};

export default function AppShell(){
  const [voyage,setVoyage]=useState<VoyageData|null>(null);
  const [project,setProject]=useState<NorthernLinesRouteProject|null>(null);
  const [gapAdjustments,setGapAdjustments]=useState<GapDisplayAdjustment[]>([]);
  const [dirty,setDirty]=useState(false);
  const [activeTab,setActiveTab]=useState<ActiveTab>('map');
  const [activePointIndex,setActivePointIndex]=useState(0);
  const [mapStyle,setMapStyle]=useState<MapStyleId>('nautical');
  const [showSeaMarks,setShowSeaMarks]=useState(true);
  const [routeColorMode,setRouteColorMode]=useState<RouteColorMode>('speed');
  const [isPlaying,setIsPlaying]=useState(false);
  const [playbackSpeed,setPlaybackSpeed]=useState(5);
  const playbackTimerRef=useRef<number|null>(null);
  const projectInputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if(isPlaying&&voyage&&voyage.playbackAvailable!==false){
      const intervalMs=Math.max(50,Math.floor(1000/Math.min(30,playbackSpeed)));
      const step=Math.max(1,Math.floor(playbackSpeed/20));
      playbackTimerRef.current=window.setInterval(()=>setActivePointIndex(prev=>{
        if(prev>=voyage.points.length-1){setIsPlaying(false);return voyage.points.length-1;}
        return Math.min(voyage.points.length-1,prev+step);
      }),intervalMs);
    }else if(playbackTimerRef.current){clearInterval(playbackTimerRef.current);playbackTimerRef.current=null;}
    return()=>{if(playbackTimerRef.current)clearInterval(playbackTimerRef.current);};
  },[isPlaying,playbackSpeed,voyage]);

  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(!dirty)return;event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);

  const handleImportNewData=(next:VoyageData)=>{setVoyage(next);setProject(null);setGapAdjustments([]);setDirty(true);setActivePointIndex(0);setIsPlaying(false);setActiveTab('map');};
  const handleUpdateMetadata=(updated:Partial<VoyageMetadata>)=>{setVoyage(prev=>prev?{...prev,metadata:{...prev.metadata,...updated}}:prev);setDirty(true);};
  const handleSelectAnchorage=(anchorage:AnchorageStop)=>{if(!voyage)return;const idx=voyage.points.findIndex(point=>point.id===anchorage.startPoint.id);if(idx!==-1){setActivePointIndex(idx);setActiveTab('map');}};
  const handleNewTrip=()=>{if(dirty&&!window.confirm('Die aktuelle Route enthält ungespeicherte Änderungen. Trotzdem eine neue Reise beginnen?'))return;setVoyage(null);setProject(null);setGapAdjustments([]);setDirty(false);setActivePointIndex(0);setIsPlaying(false);setActiveTab('data');};
  const handleOpenProject=()=>projectInputRef.current?.click();

  const handleProjectFile=(file:File)=>{
    if(dirty&&!window.confirm('Die aktuelle Route enthält ungespeicherte Änderungen. Trotzdem ein anderes Projekt öffnen?'))return;
    const reader=new FileReader();reader.onload=()=>{try{const parsed=parseRouteProject(String(reader.result||''));setProject(parsed);setVoyage(parsed.voyage);setGapAdjustments(parsed.editorial.gapAdjustments);setMapStyle(parsed.presentation.mapStyle);setShowSeaMarks(parsed.presentation.showSeaMarks);setRouteColorMode(parsed.presentation.routeColorMode);setActivePointIndex(0);setIsPlaying(false);setActiveTab('map');setDirty(false);}catch(error){window.alert(error instanceof Error?error.message:'Projekt konnte nicht geöffnet werden.');}finally{if(projectInputRef.current)projectInputRef.current.value='';}};reader.readAsText(file);
  };

  const handleSaveProject=()=>{if(!voyage)return;const next=createRouteProject(voyage,{mapStyle,showSeaMarks,routeColorMode},project||undefined,gapAdjustments);const blob=new Blob([serializeRouteProject(next)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=projectFileName(next.project.title);anchor.click();URL.revokeObjectURL(url);setProject(next);setDirty(false);};
  const updateAdjustments=(next:GapDisplayAdjustment[])=>{setGapAdjustments(next);setDirty(true);};
  const changeMapStyle=(style:MapStyleId)=>{setMapStyle(style);if(voyage)setDirty(true);};
  const toggleSeaMarks=()=>{setShowSeaMarks(value=>!value);if(voyage)setDirty(true);};
  const toggleRouteColorMode=()=>{setRouteColorMode(value=>value==='speed'?'monochrome':'speed');if(voyage)setDirty(true);};
  const segmentCount=voyage?.segments?.length||(voyage?.points.length?1:0);const gapCount=voyage?.gaps?.length||0;

  return <div className="nl-app w-screen h-screen flex flex-col overflow-hidden select-none">
    <input ref={projectInputRef} type="file" accept=".nlroute,application/json" className="hidden" onChange={event=>{const file=event.target.files?.[0];if(file)handleProjectFile(file);}}/>
    <MacTitleBar title={voyage?.metadata.title||''} vesselName={voyage?.metadata.vesselName||''} activeTab={activeTab} onTabChange={setActiveTab} mapStyle={mapStyle} onMapStyleChange={changeMapStyle} showSeaMarks={showSeaMarks} onToggleSeaMarks={toggleSeaMarks} onNewTrip={handleNewTrip} onOpenProject={handleOpenProject} onSaveProject={handleSaveProject} canSave={Boolean(voyage)} dirty={dirty}/>
    <main className={`flex-1 relative overflow-hidden ${activeTab==='map'?'':'nl-workspace'}`}>
      {!voyage&&activeTab!=='data'&&<div className="w-full h-full flex items-center justify-center bg-[#f7f4ec] px-6"><div className="max-w-xl text-center"><div className="w-14 h-14 mx-auto rounded-full bg-[#ebe6da] border border-[#d8d2c5] flex items-center justify-center text-[#31575d]"><MapIcon className="w-6 h-6"/></div><div className="mt-5 text-[10px] uppercase tracking-[.22em] text-[#6f7c68] font-semibold">Northern Lines · Route Mapper</div><h1 className="mt-2 text-2xl font-semibold text-[#24302e]">Noch keine Reise geladen.</h1><p className="mt-2 text-sm text-[#66716d] leading-relaxed">Importiere einen Track oder öffne ein gespeichertes Northern-Lines-Routenprojekt.</p><div className="mt-6 flex items-center justify-center gap-3"><button onClick={()=>setActiveTab('data')} className="px-4 py-2 rounded-full bg-[#31575d] text-[#fffdf8] text-xs font-semibold flex items-center gap-2"><FileCode className="w-4 h-4"/>Track importieren</button><button onClick={handleOpenProject} className="nl-button px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2"><FolderOpen className="w-4 h-4"/>.nlroute öffnen</button></div></div></div>}
      {activeTab==='map'&&voyage&&<div className="w-full h-full relative"><VoyageMap voyage={voyage} activePointIndex={activePointIndex} onPointSelect={setActivePointIndex} mapStyle={mapStyle} showSeaMarks={showSeaMarks} routeColorMode={routeColorMode} onToggleRouteColorMode={toggleRouteColorMode} gapAdjustments={gapAdjustments} onGapAdjustmentsChange={updateAdjustments}/>{voyage.playbackAvailable!==false&&<PlaybackController points={voyage.points} currentIndex={activePointIndex} onIndexChange={setActivePointIndex} isPlaying={isPlaying} onTogglePlay={()=>setIsPlaying(!isPlaying)} playbackSpeed={playbackSpeed} onSpeedChange={setPlaybackSpeed}/>}</div>}
      {activeTab==='logbook'&&voyage&&<LogbookView voyage={voyage} onUpdateMetadata={handleUpdateMetadata} onSelectAnchorage={handleSelectAnchorage}/>} 
      {activeTab==='data'&&<AisDataView voyage={voyage||EMPTY_VOYAGE} onImportNewData={handleImportNewData}/>} 
      {activeTab==='export'&&voyage&&<EditorialExportView voyage={voyage} gapAdjustments={gapAdjustments}/>} 
    </main>
    <footer className="nl-chrome h-7 border-t px-4 flex items-center justify-between text-[10px] text-[#66716d] shrink-0 tracking-[0.01em]"><div className="flex items-center gap-3">{voyage?<><span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#6f7c68]"/>Track geladen</span><span className="text-[#c2bbad]">·</span><span>{voyage.points.length} Wegpunkte</span><span className="text-[#c2bbad]">·</span><span>{segmentCount} Segmente</span>{gapCount>0&&<><span className="text-[#c2bbad]">·</span><span>{gapCount} Gaps</span></>}{gapAdjustments.length>0&&<><span className="text-[#c2bbad]">·</span><span>{gapAdjustments.length} editorial angepasst</span></>}<span className="text-[#c2bbad]">·</span><span>{voyage.totalDistanceNM} sm</span>{dirty&&<><span className="text-[#c2bbad]">·</span><span className="text-[#9a7749]">ungespeichert</span></>}</>:<span>Bereit für Track-Import oder .nlroute-Projekt</span>}</div><div className="flex items-center gap-3"><span className="uppercase tracking-[0.16em] text-[#6f7c68]">Northern Lines</span>{voyage&&<><span className="text-[#c2bbad]">·</span><span>{project?'.nlroute Projekt':voyage.mapperReview?'Mapper Review':voyage.geometryOnly?'Geometry-only':voyage.northernLinesSource?'Normalized Track':voyage.metadata.mmsi?`MMSI ${voyage.metadata.mmsi}`:'GPS Track'}</span></>}</div></footer>
  </div>;
}
