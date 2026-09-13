import React from 'react';
import { VoyageData } from '../types';
import { EditorialPaperSize, exportEditorialPng, exportEditorialSvg } from '../export/editorialOutput';

type Props={voyage:VoyageData};
const sizes:EditorialPaperSize[]=['A5','A4','A3','A2'];
const safeName=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'northern-lines-journey';

export const EditorialOutputControls:React.FC<Props>=({voyage})=>{
 const[size,setSize]=React.useState<EditorialPaperSize>('A4');
 const[busy,setBusy]=React.useState(false);
 const run=async(kind:'svg'|'png')=>{try{setBusy(true);const name=safeName(voyage.metadata.title||'journey');if(kind==='svg')exportEditorialSvg(size,name);else await exportEditorialPng(size,name)}catch(error){window.alert(error instanceof Error?error.message:'Export fehlgeschlagen.')}finally{setBusy(false)}};
 return <div className="nl-panel rounded-2xl p-4 shadow-sm"><div className="text-[10px] uppercase tracking-[.18em] text-[#6f7c68] font-semibold">005B-E · Editorial Output</div><div className="mt-1 text-sm font-semibold text-[#24302e]">Ausgabe</div><div className="mt-4 grid grid-cols-4 gap-1">{sizes.map(item=><button key={item} onClick={()=>setSize(item)} className={`rounded-lg border px-2 py-2 text-[11px] font-semibold ${size===item?'border-[#31575d] bg-[#31575d] text-[#fffdf8]':'border-[#d8d2c5] bg-[#fffdf8] text-[#66716d]'}`}>{item}</button>)}</div><div className="mt-3 text-[10px] leading-relaxed text-[#7a827d]">Orientierung folgt der freigegebenen Auto-Komposition.</div><div className="mt-4 grid grid-cols-2 gap-2"><button disabled={busy} onClick={()=>run('svg')} className="nl-button rounded-lg px-3 py-2 text-[11px] font-semibold">SVG</button><button disabled={busy} onClick={()=>run('png')} className="rounded-lg bg-[#31575d] px-3 py-2 text-[11px] font-semibold text-[#fffdf8]">PNG 300 dpi</button></div></div>;
};
