import { MapStyleId, RouteColorMode, VoyageData } from '../types';

export const NLROUTE_SCHEMA_VERSION = 1 as const;
export interface EditorialControlPoint { lat:number; lon:number }
export interface GapDisplayAdjustment { routeId:string; controlPoints:EditorialControlPoint[] }
export interface EditorialJourneyCopy { eyebrow:string; title:string; description:string }
export interface EditorialJourneyPlace { id:string; name:string; description:string; anchor:EditorialControlPoint; labelOffset:{x:number;y:number}; visible:boolean }
export interface EditorialContent { gapAdjustments:GapDisplayAdjustment[]; journey:EditorialJourneyCopy; places:EditorialJourneyPlace[] }

export interface NorthernLinesRouteProject {
  schemaVersion:typeof NLROUTE_SCHEMA_VERSION;
  project:{id:string;title:string;createdAt:string;modifiedAt:string};
  source:{kind:'normalized-track'|'mapper-review'|'generic-import'};
  voyage:VoyageData;
  editorial:EditorialContent;
  presentation:{mapStyle:MapStyleId;showSeaMarks:boolean;routeColorMode:RouteColorMode};
}

export const emptyEditorialContent=():EditorialContent=>({gapAdjustments:[],journey:{eyebrow:'',title:'',description:''},places:[]});
function slug(value:string){return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'route';}
export function projectFileName(title:string){return `${slug(title)}.nlroute`;}
export function projectSourceKind(voyage:VoyageData):NorthernLinesRouteProject['source']['kind']{if(voyage.mapperReview)return'mapper-review';if(voyage.northernLinesSource)return'normalized-track';return'generic-import';}

export function createRouteProject(voyage:VoyageData,presentation:NorthernLinesRouteProject['presentation'],previous?:NorthernLinesRouteProject,gapAdjustments?:GapDisplayAdjustment[],editorial?:EditorialContent):NorthernLinesRouteProject{
  const now=new Date().toISOString(); const content=editorial??previous?.editorial??emptyEditorialContent();
  return{schemaVersion:NLROUTE_SCHEMA_VERSION,project:{id:previous?.project.id||`nlroute-${Date.now()}`,title:voyage.metadata.title||'Unbenannte Reise',createdAt:previous?.project.createdAt||now,modifiedAt:now},source:{kind:projectSourceKind(voyage)},voyage,editorial:{...content,gapAdjustments:gapAdjustments??content.gapAdjustments??[]},presentation};
}
export function serializeRouteProject(project:NorthernLinesRouteProject){return JSON.stringify(project,null,2);}
function dateOrNull(value:unknown):Date|null{if(typeof value!=='string')return null;const date=new Date(value);return Number.isNaN(date.getTime())?null:date;}
function reviveVoyageDates(voyage:VoyageData):VoyageData{const revivePoint=(point:any)=>({...point,timestamp:new Date(point.timestamp)});const points=(voyage.points||[]).map(revivePoint);const rawPoints=(voyage.rawPoints||[]).map(revivePoint);const segments=voyage.segments?.map((segment:any)=>({...segment,points:(segment.points||[]).map(revivePoint)}));const anchorages=(voyage.anchorages||[]).map((anchorage:any)=>({...anchorage,startPoint:revivePoint(anchorage.startPoint),endPoint:revivePoint(anchorage.endPoint)}));const report=voyage.journeyQuality?.report?{...voyage.journeyQuality.report,analyzedAt:dateOrNull(voyage.journeyQuality.report.analyzedAt)||undefined,issues:voyage.journeyQuality.report.issues.map((issue:any)=>({...issue,observedAt:dateOrNull(issue.observedAt)||undefined}))}:undefined;return{...voyage,points,rawPoints,segments,anchorages,startTime:dateOrNull(voyage.startTime),endTime:dateOrNull(voyage.endTime),journeyQuality:voyage.journeyQuality?{...voyage.journeyQuality,report}:undefined};}
function validAdjustment(value:unknown):value is GapDisplayAdjustment{if(!value||typeof value!=='object')return false;const candidate=value as GapDisplayAdjustment;return typeof candidate.routeId==='string'&&Array.isArray(candidate.controlPoints)&&candidate.controlPoints.every((point)=>Number.isFinite(point?.lat)&&Number.isFinite(point?.lon));}
function validPlace(value:unknown):value is EditorialJourneyPlace{if(!value||typeof value!=='object')return false;const p=value as EditorialJourneyPlace;return typeof p.id==='string'&&typeof p.name==='string'&&Number.isFinite(p.anchor?.lat)&&Number.isFinite(p.anchor?.lon);}
export function parseRouteProject(rawText:string):NorthernLinesRouteProject{const parsed=JSON.parse(rawText) as Partial<NorthernLinesRouteProject>;if(parsed.schemaVersion!==NLROUTE_SCHEMA_VERSION||!parsed.project||!parsed.voyage||!parsed.presentation)throw new Error('Keine gültige Northern Lines .nlroute-Datei oder nicht unterstützte Schema-Version.');const legacy=emptyEditorialContent();const editorial=parsed.editorial as Partial<EditorialContent>|undefined;return{...(parsed as NorthernLinesRouteProject),voyage:reviveVoyageDates(parsed.voyage),editorial:{gapAdjustments:(editorial?.gapAdjustments||[]).filter(validAdjustment),journey:{...legacy.journey,...(editorial?.journey||{})},places:(editorial?.places||[]).filter(validPlace).map((p)=>({...p,description:p.description||'',labelOffset:p.labelOffset||{x:18,y:-18},visible:p.visible!==false}))}};}
