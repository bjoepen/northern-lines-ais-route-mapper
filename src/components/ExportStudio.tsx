import React, { useEffect, useRef, useState } from 'react';
import { VoyageData } from '../types';
import { formatNM, formatDuration } from '../utils/geoUtils';
import { Check, Copy, Download, Printer, Route, Sliders } from 'lucide-react';

interface ExportStudioProps { voyage: VoyageData; }

export const ExportStudio: React.FC<ExportStudioProps> = ({ voyage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(voyage.metadata.title);
  const [subtitle, setSubtitle] = useState(voyage.metadata.vesselName);
  const [showMetrics, setShowMetrics] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => { setTitle(voyage.metadata.title); setSubtitle(voyage.metadata.vesselName); }, [voyage.metadata.title, voyage.metadata.vesselName]);
  useEffect(() => { renderSheet(); }, [voyage, title, subtitle, showMetrics]);

  const renderSheet = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsRendering(true);

    const width = 1600, height = 1100;
    canvas.width = width; canvas.height = height;
    const paper = '#f7f4ec', ink = '#24302e', muted = '#69736f', sea = '#456f75', moss = '#6f7c68', sand = '#b59668', line = '#d8d2c5', white = '#fffdf8';
    ctx.fillStyle = paper; ctx.fillRect(0, 0, width, height);
    const points = voyage.points;
    if (!points.length) { setIsRendering(false); return; }

    // Editorial masthead
    ctx.fillStyle = moss; ctx.font = '600 18px Avenir Next, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('N O R T H E R N   L I N E S   ·   R O U T E   S H E E T', 92, 82);
    ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(92, 108); ctx.lineTo(width - 92, 108); ctx.stroke();

    ctx.fillStyle = ink; ctx.font = '600 54px Avenir Next, sans-serif'; ctx.fillText(title || 'Reiseroute', 92, 178);
    ctx.fillStyle = muted; ctx.font = '400 24px Avenir Next, sans-serif'; ctx.fillText(subtitle || 'Northern Lines Journey', 94, 220);

    const mapX = 92, mapY = 285, mapW = width - 184, mapH = 570;
    ctx.fillStyle = white; ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.strokeRect(mapX, mapY, mapW, mapH);

    const bounds = voyage.bounds;
    const latSpan = Math.max(.01, bounds.maxLat - bounds.minLat), lonSpan = Math.max(.01, bounds.maxLon - bounds.minLon);
    const padLat = latSpan * .12, padLon = lonSpan * .12;
    const minLat = bounds.minLat - padLat, maxLat = bounds.maxLat + padLat, minLon = bounds.minLon - padLon, maxLon = bounds.maxLon + padLon;
    const inner = 54;
    const project = (lat: number, lon: number) => ({ x: mapX + inner + ((lon-minLon)/(maxLon-minLon))*(mapW-inner*2), y: mapY + mapH-inner-((lat-minLat)/(maxLat-minLat))*(mapH-inner*2) });

    // Very restrained geographic field: route is the subject, not a fake chart.
    ctx.strokeStyle = '#e8e3d8'; ctx.lineWidth = 1;
    for (let i=1;i<4;i++) { const y=mapY+(mapH/4)*i; ctx.beginPath(); ctx.moveTo(mapX+inner,y); ctx.lineTo(mapX+mapW-inner,y); ctx.stroke(); }
    for (let i=1;i<6;i++) { const x=mapX+(mapW/6)*i; ctx.beginPath(); ctx.moveTo(x,mapY+inner); ctx.lineTo(x,mapY+mapH-inner); ctx.stroke(); }

    ctx.strokeStyle = sea; ctx.lineWidth = 7; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.beginPath();
    points.forEach((p,i)=>{ const q=project(p.lat,p.lon); if(i===0)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y); }); ctx.stroke();

    const start=project(points[0].lat,points[0].lon), end=project(points[points.length-1].lat,points[points.length-1].lon);
    [[start,moss],[end,sand]].forEach(([p,c])=>{ const q=p as {x:number;y:number}; ctx.fillStyle=white;ctx.beginPath();ctx.arc(q.x,q.y,13,0,Math.PI*2);ctx.fill();ctx.fillStyle=c as string;ctx.beginPath();ctx.arc(q.x,q.y,8,0,Math.PI*2);ctx.fill(); });
    ctx.fillStyle=muted;ctx.font='500 15px Avenir Next, sans-serif';ctx.fillText('START',start.x+18,start.y+5);ctx.textAlign='right';ctx.fillText('ZIEL',end.x-18,end.y+5);ctx.textAlign='left';

    if (showMetrics) {
      const y=930; ctx.strokeStyle=line;ctx.beginPath();ctx.moveTo(92,y-38);ctx.lineTo(width-92,y-38);ctx.stroke();
      const items=[['DISTANZ',formatNM(voyage.totalDistanceNM)],['REISEZEIT',formatDuration(voyage.durationSeconds)],['SCHIFF',voyage.metadata.vesselName||'—'],['MMSI',voyage.metadata.mmsi||'—']];
      items.forEach(([label,value],i)=>{const x=92+i*((width-184)/4);ctx.fillStyle=muted;ctx.font='600 14px Avenir Next, sans-serif';ctx.fillText(label,x,y);ctx.fillStyle=ink;ctx.font='500 24px Avenir Next, sans-serif';ctx.fillText(value,x,y+34);});
    }

    const startDate=voyage.startTime?.toLocaleDateString('de-DE')||'—', endDate=voyage.endTime?.toLocaleDateString('de-DE')||'—';
    ctx.fillStyle=muted;ctx.font='400 14px Avenir Next, sans-serif';ctx.fillText(`${startDate}  —  ${endDate}`,92,1032);ctx.textAlign='right';ctx.fillStyle=moss;ctx.font='600 14px Avenir Next, sans-serif';ctx.fillText('NORTHERN LINES',width-92,1032);ctx.textAlign='left';
    setIsRendering(false);
  };

  const download = () => { const c=canvasRef.current;if(!c)return;const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`${title.replace(/\s+/g,'_')}_Northern_Lines_Route.png`;a.click(); };
  const copy = async () => { const c=canvasRef.current;if(!c)return;try{c.toBlob(async b=>{if(!b)return;await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);setCopySuccess(true);setTimeout(()=>setCopySuccess(false),2500);});}catch{download();} };
  const print = () => { const c=canvasRef.current;if(!c)return;const u=c.toDataURL('image/png');const w=window.open('','','width=1000,height=800');if(!w)return;w.document.write(`<html><body style="margin:0;display:flex;justify-content:center"><img src="${u}" style="max-width:100%"></body></html>`);w.document.close();setTimeout(()=>w.print(),250); };

  return <div className="w-full h-full overflow-y-auto bg-[#f4f1e9] p-6 text-[#24302e] select-none"><div className="max-w-6xl mx-auto space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[.22em] text-[#6f7c68] font-semibold">Northern Lines · Editorial Export</div><h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 mt-1"><Route className="w-5 h-5 text-[#456f75]"/>Route Sheet</h1><p className="text-xs text-[#66716d] mt-1">Eine ruhige Reisegrafik für Northern Lines – keine simulierte Seekarte.</p></div><div className="flex gap-2"><button onClick={copy} className="nl-button rounded-full px-3 py-2 text-xs flex gap-1.5 items-center">{copySuccess?<Check className="w-4 h-4 text-[#6f7c68]"/>:<Copy className="w-4 h-4"/>}{copySuccess?'Kopiert':'Kopieren'}</button><button onClick={print} className="nl-button rounded-full px-3 py-2 text-xs flex gap-1.5 items-center"><Printer className="w-4 h-4 text-[#b59668]"/>Drucken / PDF</button><button onClick={download} className="rounded-full px-4 py-2 text-xs flex gap-1.5 items-center bg-[#31575d] text-[#fffdf8]"><Download className="w-4 h-4"/>PNG exportieren</button></div></div>
    <div className="nl-panel rounded-2xl p-5 shadow-sm"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.18em] text-[#6f7c68] font-semibold mb-4"><Sliders className="w-4 h-4"/>Beschriftung</div><div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 text-xs"><label className="text-[#66716d]">Titel<input value={title} onChange={e=>setTitle(e.target.value)} className="block mt-1 w-full rounded-lg border border-[#d8d2c5] bg-[#fffdf8] px-3 py-2 text-[#24302e] outline-none focus:border-[#456f75]"/></label><label className="text-[#66716d]">Unterzeile<input value={subtitle} onChange={e=>setSubtitle(e.target.value)} className="block mt-1 w-full rounded-lg border border-[#d8d2c5] bg-[#fffdf8] px-3 py-2 text-[#24302e] outline-none focus:border-[#456f75]"/></label><label className="flex items-end gap-2 pb-2 text-[#66716d]"><input type="checkbox" checked={showMetrics} onChange={e=>setShowMetrics(e.target.checked)} className="accent-[#456f75]"/>Reisedaten zeigen</label></div></div>
    <div className="nl-panel rounded-2xl p-4 shadow-sm"><div className="flex justify-between text-[10px] text-[#66716d] mb-3 px-1"><span>Editorial Route Sheet · 1600 × 1100 px</span><span>{isRendering?'Wird gerendert …':'Vorschau'}</span></div><div className="rounded-xl border border-[#d8d2c5] bg-[#ebe6da] p-3 flex justify-center"><canvas ref={canvasRef} className="max-w-full h-auto shadow-[0_10px_30px_rgba(36,48,46,.12)]" style={{maxHeight:'68vh'}}/></div></div>
  </div></div>;
};
