import React, { useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Gauge, Compass, Clock } from 'lucide-react';
import { AisPoint } from '../types';
import { formatKnots, formatDegrees, formatDuration } from '../utils/geoUtils';

interface PlaybackControllerProps { points: AisPoint[]; currentIndex: number; onIndexChange: (index: number) => void; isPlaying: boolean; onTogglePlay: () => void; playbackSpeed: number; onSpeedChange: (speed: number) => void; }

export const PlaybackController: React.FC<PlaybackControllerProps> = ({ points, currentIndex, onIndexChange, isPlaying, onTogglePlay, playbackSpeed, onSpeedChange }) => {
  const currentPoint = points[currentIndex] || points[0];
  const totalPoints = points.length;
  useEffect(() => { const handleKeyDown = (e: KeyboardEvent) => { if (['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return; if (e.code === 'Space') { e.preventDefault(); onTogglePlay(); } else if (e.code === 'ArrowRight') { e.preventDefault(); onIndexChange(Math.min(totalPoints - 1, currentIndex + (e.shiftKey ? 10 : 1))); } else if (e.code === 'ArrowLeft') { e.preventDefault(); onIndexChange(Math.max(0, currentIndex - (e.shiftKey ? 10 : 1))); } }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, [currentIndex, onIndexChange, onTogglePlay, totalPoints]);
  if (totalPoints <= 1) return null;
  const start = points[0]?.timestamp?.getTime() || 0, now = currentPoint?.timestamp?.getTime() || 0, end = points[totalPoints-1]?.timestamp?.getTime() || 0;
  const speeds = [1,5,20,60,200];
  return <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-3xl nl-panel backdrop-blur-md rounded-2xl px-4 py-3 select-none">
    <div className="flex items-center gap-3 mb-2.5"><span className="text-[10px] tabular-nums text-[#66716d] w-12">{formatDuration(Math.round((now-start)/1000))}</span><input type="range" min={0} max={totalPoints-1} value={currentIndex} onChange={(e)=>onIndexChange(parseInt(e.target.value,10))} className="flex-1 h-1.5 accent-[#456f75] cursor-pointer"/><span className="text-[10px] tabular-nums text-[#66716d] w-12 text-right">{formatDuration(Math.round((end-start)/1000))}</span></div>
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#ded8cb]">
      <div className="flex items-center gap-1.5"><button onClick={()=>onIndexChange(0)} className="w-8 h-8 rounded-full hover:bg-[#ebe6da] text-[#66716d] flex items-center justify-center"><SkipBack className="w-4 h-4"/></button><button onClick={onTogglePlay} className="w-9 h-9 rounded-full bg-[#31575d] hover:bg-[#456f75] text-[#fffdf8] flex items-center justify-center shadow-sm">{isPlaying?<Pause className="w-4 h-4 fill-current"/>:<Play className="w-4 h-4 fill-current ml-0.5"/>}</button><button onClick={()=>onIndexChange(Math.min(totalPoints-1,currentIndex+1))} className="w-8 h-8 rounded-full hover:bg-[#ebe6da] text-[#66716d] flex items-center justify-center"><SkipForward className="w-4 h-4"/></button><div className="flex items-center ml-2 bg-[#f4f1e9] rounded-full p-0.5 border border-[#ded8cb]">{speeds.map((spd)=><button key={spd} onClick={()=>onSpeedChange(spd)} className={`px-2 py-1 text-[9px] rounded-full transition-colors ${playbackSpeed===spd?'bg-[#6f7c68] text-white':'text-[#66716d] hover:text-[#24302e]'}`}>{spd}×</button>)}</div></div>
      <div className="flex items-center gap-4 text-[10px] text-[#66716d]"><span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-[#6f7c68]"/><strong className="text-[#24302e] font-medium">{formatKnots(currentPoint.sog)}</strong></span><span className="flex items-center gap-1"><Compass className="w-3.5 h-3.5 text-[#b59668]"/><strong className="text-[#24302e] font-medium">{formatDegrees(currentPoint.cog)}</strong></span><span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-[#456f75]"/><span>{currentPoint.timestamp.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})} {currentPoint.timestamp.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</span></span>{currentPoint.navStatus&&<span className="hidden sm:inline-block px-2 py-1 rounded-full bg-[#f4f1e9] border border-[#ded8cb] text-[#456f75]">{currentPoint.navStatus}</span>}</div>
    </div>
  </div>;
};
