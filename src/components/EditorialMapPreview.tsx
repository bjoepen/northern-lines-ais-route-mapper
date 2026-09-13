import React, { useEffect, useMemo, useState } from 'react';
import { VoyageData } from '../types';
import { GapDisplayAdjustment } from '../project/nlroute';
import { buildEditorialJourneyLines } from '../cartography/journeyGeometry';
import { buildGeographicScene } from '../cartography/naturalEarth';
import { GeographicScene } from '../cartography/types';
import { composeJourney } from '../cartography/composition';

interface Props { voyage: VoyageData; gapAdjustments: GapDisplayAdjustment[] }

export const EditorialMapPreview: React.FC<Props> = ({ voyage, gapAdjustments }) => {
  const [scene,setScene]=useState<GeographicScene|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [reloadKey,setReloadKey]=useState(0);
  const journeyLines=useMemo(()=>buildEditorialJourneyLines(voyage,gapAdjustments),[voyage,gapAdjustments]);
  const composition=useMemo(()=>composeJourney(voyage.bounds),[voyage.bounds]);

  useEffect(()=>{
    let cancelled=false; setScene(null); setError(null);
    const field=composition.journeyField;
    buildGeographicScene(voyage.bounds,journeyLines,field.width,field.height)
      .then((next)=>{if(!cancelled)setScene(next);})
      .catch((reason)=>{if(!cancelled)setError(reason instanceof Error?reason.message:String(reason));});
    return()=>{cancelled=true;};
  },[voyage.bounds,journeyLines,composition,reloadKey]);

  return <section className="nl-panel rounded-2xl p-4 shadow-sm">
    <div className="flex items-center justify-between gap-4 mb-3 px-1"><div><div className="text-[10px] uppercase tracking-[.18em] text-[#6f7c68] font-semibold">005B-C · Journey Composition</div><div className="mt-1 text-sm font-semibold text-[#24302e]">Editorial Map · Composition Preview</div></div><div className="flex items-center gap-3 text-[10px] text-[#66716d]">{scene&&<span>Auto · {composition.orientation} · Natural Earth {scene.resolution}</span>}<button onClick={()=>setReloadKey((v)=>v+1)} className="nl-button rounded-full px-2.5 py-1.5">Neu laden</button></div></div>
    <div className="rounded-xl border border-[#d8d2c5] bg-[#ebe6da] p-3 flex justify-center min-h-[420px]">
      {error&&<div className="m-auto max-w-lg text-center text-xs leading-relaxed text-[#66716d]"><div className="font-semibold text-[#9a7749] mb-2">Geografiedaten nicht verfügbar</div><div>{error}</div></div>}
      {!error&&!scene&&<div className="m-auto text-xs text-[#66716d]">Komposition wird aufgebaut …</div>}
      {scene&&<svg viewBox={`0 0 ${composition.width} ${composition.height}`} role="img" aria-label="Northern Lines editorial journey map" className="h-[68vh] max-h-[820px] w-auto max-w-full bg-[#f7f4ec] shadow-[0_10px_30px_rgba(36,48,46,.12)]">
        <rect width={composition.width} height={composition.height} fill="#f7f4ec"/>
        <g transform={`translate(${composition.journeyField.x} ${composition.journeyField.y})`}>
          <g fill="#e9e4d8" stroke="#c8c1b3" strokeWidth="1.15" strokeLinejoin="round">{scene.landPaths.map((path,index)=><path key={`land-${index}`} d={path} fillRule="evenodd"/>)}</g>
          <g fill="none" stroke="#31575d" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round">{scene.journeyPaths.map((path,index)=><path key={`journey-${index}`} d={path}/>)}</g>
        </g>
      </svg>}
    </div>
    <div className="mt-3 px-1 text-[10px] leading-relaxed text-[#66716d]">Auto-Komposition mit reserviertem Editorial Header, Journey Field und Footer. Noch ohne Ortsnamen und finale Typografie.</div>
  </section>;
};
