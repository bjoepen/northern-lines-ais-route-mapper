import { AisPoint, MapperReviewRoute, MapperReviewSource, VoyageData, VoyageMetadata } from '../types';
import { calculateDistanceNM } from '../utils/geoUtils';

type Feature = { properties?: Record<string, any>; geometry?: { type?: string; coordinates?: any } | null };
type Collection = { type?: string; features?: Feature[]; northernLines?: Record<string, any> };

const valid = (lat:number, lon:number) => Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
const num = (v:unknown) => v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined;

function isMapperReview(value: unknown): value is Collection {
  if (!value || typeof value !== 'object') return false;
  const c = value as Collection;
  return c.type === 'FeatureCollection' && Array.isArray(c.features) && (
    c.northernLines?.purpose === 'mapper_review' ||
    c.features.some(f => ['ais_point','observed_route','reconstructed_route'].includes(String(f.properties?.routeLayer)))
  );
}

function route(feature: Feature, index: number): MapperReviewRoute | null {
  const layer = feature.properties?.routeLayer;
  if (!['observed_route','reconstructed_route'].includes(String(layer))) return null;
  if (feature.geometry?.type !== 'LineString' || !Array.isArray(feature.geometry.coordinates)) return null;
  const points = feature.geometry.coordinates.flatMap((c:any) => {
    const lon = Number(c?.[0]), lat = Number(c?.[1]);
    return valid(lat,lon) ? [{lat,lon}] : [];
  });
  if (points.length < 2) return null;
  const p = feature.properties || {};
  return {
    id: `${layer}-${num(p.sourceSegmentIndex) ?? index}`,
    routeLayer: layer,
    evidenceClass: typeof p.evidenceClass === 'string' ? p.evidenceClass : undefined,
    sourceSegmentIndex: num(p.sourceSegmentIndex), sourceEventIndex: num(p.sourceEventIndex),
    method: typeof p.method === 'string' ? p.method : undefined,
    methodVersion: typeof p.methodVersion === 'string' ? p.methodVersion : undefined,
    reviewState: typeof p.reviewState === 'string' ? p.reviewState : undefined,
    visualAcceptance: typeof p.visualAcceptance === 'string' ? p.visualAcceptance : undefined,
    classification: typeof p.classification === 'string' ? p.classification : undefined,
    policyReason: typeof p.policyReason === 'string' ? p.policyReason : undefined,
    note: typeof p.note === 'string' || p.note === null ? p.note : undefined,
    points,
  } as MapperReviewRoute;
}

function metrics(points:AisPoint[]) {
  points.sort((a,b)=>a.timestamp.getTime()-b.timestamp.getTime());
  let total=0, sum=0, count=0, max=0;
  const start=points[0]?.timestamp ?? null, end=points.at(-1)?.timestamp ?? null;
  points.forEach((p,i)=>{
    if(i>0) total += calculateDistanceNM(points[i-1].lat,points[i-1].lon,p.lat,p.lon);
    p.distanceFromStartNM=Math.round(total*100)/100;
    p.elapsedSeconds=start?Math.max(0,Math.round((p.timestamp.getTime()-start.getTime())/1000)):undefined;
    if(p.sog!==undefined&&Number.isFinite(p.sog)){sum+=p.sog;count++;max=Math.max(max,p.sog);}
  });
  return {total:Math.round(total*10)/10,avg:count?Math.round(sum/count*10)/10:0,max:Math.round(max*10)/10,start,end,duration:start&&end?Math.max(0,Math.round((end.getTime()-start.getTime())/1000)):0};
}

export function parseMapperReviewText(rawText:string, metadata?:Partial<VoyageMetadata>):VoyageData|null {
  let c:Collection;
  try { const parsed=JSON.parse(rawText.trim()); if(!isMapperReview(parsed)) return null; c=parsed; } catch { return null; }
  const points:AisPoint[]=[]; const observedRoutes:MapperReviewRoute[]=[]; const reconstructedRoutes:MapperReviewRoute[]=[];
  let vesselName:string|undefined, mmsi:string|undefined, journeyId:string|undefined=typeof c.northernLines?.journeyId==='string'?c.northernLines.journeyId:undefined;
  (c.features||[]).forEach((f,i)=>{
    const p=f.properties||{};
    if(p.routeLayer==='ais_point'&&f.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)){
      const lon=Number(f.geometry.coordinates[0]),lat=Number(f.geometry.coordinates[1]); if(!valid(lat,lon)) return;
      const ais=p.aisObservation&&typeof p.aisObservation==='object'?p.aisObservation:{};
      const t=new Date(p.observedAt??ais.observedAt); if(Number.isNaN(t.getTime())) return;
      const seq=num(p.sequence)??points.length, src=num(p.sourceObservationIndex);
      vesselName ||= typeof ais.vesselName==='string'?ais.vesselName:undefined; mmsi ||= ais.mmsi!==undefined?String(ais.mmsi):undefined; journeyId ||= typeof ais.journeyId==='string'?ais.journeyId:undefined;
      points.push({id:`mapper-review-ais-${seq}`,timestamp:t,lat,lon,sog:num(ais.sog),cog:num(ais.cog),heading:num(ais.heading),navStatus:ais.navStatus!==undefined?String(ais.navStatus):undefined,mmsi:ais.mmsi!==undefined?String(ais.mmsi):undefined,layer:'canonical',provenance:{sourceFormat:'northern-lines-mapper-review',timestamp:'source',sourceIndex:src,sourceId:`mapper-review:${seq}`}});
      return;
    }
    const r=route(f,i); if(!r)return; (r.routeLayer==='observed_route'?observedRoutes:reconstructedRoutes).push(r);
  });
  if(!points.length||!observedRoutes.length)return null;
  const m=metrics(points); const source:MapperReviewSource={schemaVersion:num(c.northernLines?.schemaVersion),journeyId,purpose:typeof c.northernLines?.purpose==='string'?c.northernLines.purpose:'mapper_review',productionApproved:typeof c.northernLines?.productionApproved==='boolean'?c.northernLines.productionApproved:undefined,motionContextPolicyVersion:typeof c.northernLines?.motionContextPolicyVersion==='string'?c.northernLines.motionContextPolicyVersion:undefined,reconstructionPolicyVersion:typeof c.northernLines?.reconstructionPolicyVersion==='string'?c.northernLines.reconstructionPolicyVersion:undefined,sourceBoundsPolicyVersion:typeof c.northernLines?.sourceBoundsPolicyVersion==='string'?c.northernLines.sourceBoundsPolicyVersion:undefined};
  const reviewRequiredCount=reconstructedRoutes.filter(r=>r.reviewState==='review_required').length;
  return {metadata:{title:metadata?.title&&!/^mapper-review/i.test(metadata.title)?metadata.title:(journeyId?.replace(/-/g,' ')||'Northern Lines Mapper Review'),vesselName:metadata?.vesselName||vesselName||'Unbekanntes Schiff',mmsi:metadata?.mmsi||mmsi,callsign:metadata?.callsign,skipper:metadata?.skipper,vesselType:metadata?.vesselType,notes:metadata?.notes},rawPoints:[],points,segments:[{id:'mapper-review-ais-sequence',points}],gaps:[],playbackAvailable:false,geometryOnly:false,mapperReview:{source,observedRoutes,reconstructedRoutes,reviewRequiredCount},trackContract:{version:'0.2.0',rawPointCount:0,canonicalPointCount:points.length,sourceFormats:['northern-lines-mapper-review'],timestampProvenance:['source'],primaryMmsi:mmsi,observedMmsi:mmsi?[mmsi]:[],mixedMmsi:false},importNormalization:{version:'0.3.0',detectedFormat:'northern-lines-mapper-review',inputRecords:c.features?.length||0,normalizedPoints:points.length,ignoredRecords:0,assembledNmeaMessages:0,incompleteNmeaFragments:0},journeyQuality:{supplied:true,editorialReady:false,reason:reviewRequiredCount?`${reviewRequiredCount} rekonstruierte Route(n) benötigen Mapper Review.`:'Mapper-Review-Artefakt ist keine Produktionsfreigabe.'},totalDistanceNM:m.total,avgSpeedKnots:m.avg,maxSpeedKnots:m.max,durationSeconds:m.duration,startTime:m.start,endTime:m.end,anchorages:[],bounds:{minLat:Math.min(...points.map(p=>p.lat)),maxLat:Math.max(...points.map(p=>p.lat)),minLon:Math.min(...points.map(p=>p.lon)),maxLon:Math.max(...points.map(p=>p.lon))}};
}
