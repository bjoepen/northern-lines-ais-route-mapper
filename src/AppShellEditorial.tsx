/** @license SPDX-License-Identifier: Apache-2.0 */
import React,{useEffect,useRef,useState}from'react';
import{ActiveTab,AnchorageStop,MapStyleId,RouteColorMode,VoyageData,VoyageMetadata}from'./types';
import{MacTitleBar}from'./components/MacTitleBar';
import{VoyageMap}from'./components/VoyageMapEditorial';
import{PlaybackController}from'./components/PlaybackController';
import{LogbookView}from'./components/LogbookView';
import{AisDataView}from'./components/AisDataView';
import{EditorialExportView}from'./components/EditorialExportView';
import{createRouteProject,EditorialContent,emptyEditorialContent,GapDisplayAdjustment,NorthernLinesRouteProject,parseRouteProject,projectFileName,serializeRouteProject}from'./project/nlroute';
import{hasNativeProjectIO,openNativeProject,saveNativeProject}from'./project/nativeProjectIO';
import{FileCode,FolderOpen,Map as MapIcon}from'lucide-react';

const EMPTY_VOYAGE:VoyageData={metadata:{title:'Keine Reise geladen',vesselName:''},rawPoints:[],points:[],segments:[],gaps:[],playbackAvailable:false,geometryOnly:false,trackContract:{version:'0.2.0',rawPointCount:0,canonicalPointCount:0,sourceFormats:[],timestampProvenance:[],observedMmsi:[],mixedMmsi:false},totalDistanceNM:0,avgSpeedKnots:0,maxSpeedKnots:0,durationSeconds:0,startTime:null,endTime:null,anchorages:[],bounds:{minLat:0,maxLat:0,minLon:0,maxLon:0}};

export default function AppShellEditorial(){
 const[voyage,setVoyage]=useState<VoyageData|null>(null),[project,setProject]=useState<NorthernLinesRouteProject|null>(null),[projectPath,setProjectPath]=useState<string|null>(null),[gapAdjustments,setGapAdjustments]=useState<GapDisplayAdjustment[]>([]),[editorial,setEditorial]=useState<EditorialContent>(emptyEditorialContent()),[dirty,setDirty]=useState(false),[activeTab,setActiveTab]=useState<ActiveTab>('map'),[activePointIndex,setActivePointIndex]=useState(0),[mapStyle,setMapStyle]=useState<MapStyleId>('nautical'),[showSeaMarks,setShowSeaMarks]=useState(true),[routeColorMode,setRouteColorMode]=useState<RouteColorMode>('speed'),[isPlaying,setIsPlaying]=useState(false),[playbackSpeed,setPlaybackSpeed]=useState(5);
 const timer=useRef<number|null>(null),input=useRef<HTMLInputElement>(null);

 const applyProject=(p:NorthernLinesRouteProject,path:string|null)=>{setProject(p);setProjectPath(path);setVoyage(p.voyage);setGapAdjustments(p.editorial.gapAdjustments);setEditorial(p.editorial);setMapStyle(p.presentation.mapStyle);setShowSeaMarks(p.presentation.showSeaMarks);setRouteColorMode(p.presentation.routeColorMode);setActivePointIndex(0);setIsPlaying(false);setActiveTab('map');setDirty(false)};
 const importData=(v:VoyageData)=>{setVoyage(v);setProject(null);setProjectPath(null);setGapAdjustments([]);setEditorial(emptyEditorialContent());setDirty(true);setActivePointIndex(0);setIsPlaying(false);setActiveTab('map')};
 const updateMetadata=(u:Partial<VoyageMetadata>)=>{setVoyage(p=>p?{...p,metadata:{...p.metadata,...u}}:p);setDirty(true)};
 const selectAnchorage=(a:AnchorageStop)=>{if(!voyage)return;const i=voyage.points.findIndex(p=>p.id===a.startPoint.id);if(i!==-1){setActivePointIndex(i);setActiveTab('map')}};
 const newTrip=()=>{if(dirty&&!window.confirm('Die aktuelle Route enthält ungespeicherte Änderungen. Trotzdem eine neue Reise beginnen?'))return;setVoyage(null);setProject(null);setProjectPath(null);setGapAdjustments([]);setEditorial(emptyEditorialContent());setDirty(false);setActivePointIndex(0);setIsPlaying(false);setActiveTab('data')};

 const projectFile=(file:File)=>{if(dirty&&!window.confirm('Die aktuelle Route enthält ungespeicherte Änderungen. Trotzdem ein anderes Projekt öffnen?'))return;const r=new FileReader();r.onload=()=>{try{const p=parseRouteProject(String(r.result||''));applyProject(p,null)}catch(e){window.alert(e instanceof Error?e.message:'Projekt konnte nicht geöffnet werden.')}finally{if(input.current)input.current.value=''}};r.readAsText(file)};

 const openProject=async()=>{
  if(dirty&&!window.confirm('Die aktuelle Route enthält ungespeicherte Änderungen. Trotzdem ein anderes Projekt öffnen?'))return;
  if(!hasNativeProjectIO()){input.current?.click();return}
  try{const opened=await openNativeProject();if(!opened)return;applyProject(parseRouteProject(opened.contents),opened.path)}catch(e){window.alert(e instanceof Error?e.message:'Projekt konnte nicht geöffnet werden.')}
 };

 const saveProject=async(saveAs=false)=>{
  if(!voyage)return;
  const next=createRouteProject(voyage,{mapStyle,showSeaMarks,routeColorMode},project||undefined,gapAdjustments,editorial);
  const serialized=serializeRouteProject(next);
  if(hasNativeProjectIO()){
   try{const path=await saveNativeProject(serialized,projectFileName(next.project.title),projectPath,saveAs);if(!path)return;setProject(next);setProjectPath(path);setDirty(false)}catch(e){window.alert(e instanceof Error?e.message:'Projekt konnte nicht gespeichert werden.')}
   return;
  }
  const blob=new Blob([serialized],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=projectFileName(next.project.title);a.click();URL.revokeObjectURL(url);setProject(next);setDirty(false);
 };

 const edit=(next:EditorialContent)=>{setEditorial(next);setDirty(true)};
 const updateAdjustments=(next:GapDisplayAdjustment[])=>{setGapAdjustments(next);setEditorial(e=>({...e,gapAdjustments:next}));setDirty(true)};

 useEffect(()=>{if(isPlaying&&voyage&&voyage.playbackAvailable!==false){timer.current=window.setInterval(()=>setActivePointIndex(i=>i>=voyage.points.length-1?(setIsPlaying(false),voyage.points.length-1):Math.min(voyage.points.length-1,i+Math.max(1,Math.floor(playbackSpeed/20)))),Math.max(50,Math.floor(1000/Math.min(30,playbackSpeed))))}else if(timer.current){clearInterval(timer.current);timer.current=null}return()=>{if(timer.current)clearInterval(timer.current)}},[isPlaying,playbackSpeed,voyage]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 useEffect(()=>{const shortcuts=(e:KeyboardEvent)=>{if(!e.metaKey||e.altKey||e.ctrlKey)return;const key=e.key.toLowerCase();if(key==='o'){e.preventDefault();void openProject()}else if(key==='s'){e.preventDefault();void saveProject(e.shiftKey)}};window.addEventListener('keydown',shortcuts);return()=>window.removeEventListener('keydown',shortcuts)});

 return <div className="nl-app w-screen h-screen flex flex-col overflow-hidden select-none"><input ref={input} type="file" accept=".nlroute,application/json" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)projectFile(f)}}/><MacTitleBar title={voyage?.metadata.title||''} vesselName={voyage?.metadata.vesselName||''} activeTab={activeTab} onTabChange={setActiveTab} mapStyle={mapStyle} onMapStyleChange={s=>{setMapStyle(s);if(voyage)setDirty(true)}} showSeaMarks={showSeaMarks} onToggleSeaMarks={()=>{setShowSeaMarks(v=>!v);if(voyage)setDirty(true)}} onNewTrip={newTrip} onOpenProject={()=>void openProject()} onSaveProject={()=>void saveProject(false)} canSave={Boolean(voyage)} dirty={dirty}/><main className={`flex-1 relative overflow-hidden ${activeTab==='map'?'':'nl-workspace'}`}>{!voyage&&activeTab!=='data'&&<div className="w-full h-full flex items-center justify-center bg-[#f7f4ec] px-6"><div className="text-center"><MapIcon className="mx-auto"/><h1 className="mt-3 text-2xl">Noch keine Reise geladen.</h1><div className="mt-5 flex gap-3"><button onClick={()=>setActiveTab('data')}><FileCode/>Track importieren</button><button onClick={()=>void openProject()}><FolderOpen/>.nlroute öffnen</button></div></div></div>}{activeTab==='map'&&voyage&&<div className="w-full h-full relative"><VoyageMap voyage={voyage} activePointIndex={activePointIndex} onPointSelect={setActivePointIndex} mapStyle={mapStyle} showSeaMarks={showSeaMarks} routeColorMode={routeColorMode} onToggleRouteColorMode={()=>setRouteColorMode(v=>v==='speed'?'monochrome':'speed')} gapAdjustments={gapAdjustments} onGapAdjustmentsChange={updateAdjustments}/>{voyage.playbackAvailable!==false&&<PlaybackController points={voyage.points} currentIndex={activePointIndex} onIndexChange={setActivePointIndex} isPlaying={isPlaying} onTogglePlay={()=>setIsPlaying(!isPlaying)} playbackSpeed={playbackSpeed} onSpeedChange={setPlaybackSpeed}/>}</div>}{activeTab==='logbook'&&voyage&&<LogbookView voyage={voyage} onUpdateMetadata={updateMetadata} onSelectAnchorage={selectAnchorage}/>} {activeTab==='data'&&<AisDataView voyage={voyage||EMPTY_VOYAGE} onImportNewData={importData}/>} {activeTab==='export'&&voyage&&<EditorialExportView voyage={voyage} gapAdjustments={gapAdjustments} editorial={editorial} onEditorialChange={edit}/>}</main><footer className="nl-chrome h-7 border-t px-4 flex items-center justify-between text-[10px] text-[#66716d]"><span>{voyage?`${voyage.points.length} Wegpunkte · ${voyage.totalDistanceNM} sm${dirty?' · ungespeichert':''}`:'Bereit'}</span><span>NORTHERN LINES</span></footer></div>;
}
