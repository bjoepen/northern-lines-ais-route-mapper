import React, { useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  SkipBack, 
  SkipForward, 
  Gauge, 
  Compass, 
  Clock 
} from 'lucide-react';
import { AisPoint } from '../types';
import { formatKnots, formatDegrees, formatNM, formatDuration } from '../utils/geoUtils';

interface PlaybackControllerProps {
  points: AisPoint[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export const PlaybackController: React.FC<PlaybackControllerProps> = ({
  points,
  currentIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
}) => {
  const currentPoint = points[currentIndex] || points[0];
  const totalPoints = points.length;

  // Keyboard shortcut listener: Space for Play/Pause, ArrowLeft/ArrowRight for Scrub
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in textarea/input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onIndexChange(Math.min(totalPoints - 1, currentIndex + (e.shiftKey ? 10 : 1)));
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onIndexChange(Math.max(0, currentIndex - (e.shiftKey ? 10 : 1)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isPlaying, onIndexChange, onTogglePlay, totalPoints]);

  if (totalPoints <= 1) return null;

  const startTimestamp = points[0]?.timestamp?.getTime() || 0;
  const currentTimestamp = currentPoint?.timestamp?.getTime() || 0;
  const endTimestamp = points[totalPoints - 1]?.timestamp?.getTime() || 0;
  const totalDurationSec = Math.round((endTimestamp - startTimestamp) / 1000);
  const currentElapsedSec = Math.round((currentTimestamp - startTimestamp) / 1000);

  const speedOptions = [1, 5, 20, 60, 200];

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-3xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-xl p-3 shadow-2xl select-none">
      {/* Top row: Scrubber progress bar */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[11px] font-mono text-slate-400 shrink-0 w-14">
          {formatDuration(currentElapsedSec)}
        </span>

        <div className="relative flex-1 flex items-center group">
          <input
            type="range"
            min={0}
            max={totalPoints - 1}
            value={currentIndex}
            onChange={(e) => onIndexChange(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:h-2 transition-all"
          />
        </div>

        <span className="text-[11px] font-mono text-slate-400 shrink-0 w-14 text-right">
          {formatDuration(totalDurationSec)}
        </span>
      </div>

      {/* Bottom row: Playback buttons, speed multipliers, and live telemetry badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
        {/* Left: Media Control Buttons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onIndexChange(0)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Zum Anfang springen"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center shadow-md transition-transform active:scale-95"
            title={isPlaying ? 'Pause (Leertaste)' : 'Abspielen (Leertaste)'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => onIndexChange(Math.min(totalPoints - 1, currentIndex + 1))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Schritt vorwärts (Rechts-Taste)"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Speed Multipliers */}
          <div className="flex items-center ml-2 bg-slate-800/80 rounded-md p-0.5 border border-slate-700/60">
            {speedOptions.map((spd) => (
              <button
                key={spd}
                onClick={() => onSpeedChange(spd)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Live Telemetry Mini-Badges */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center gap-1 text-slate-300">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono font-semibold">{formatKnots(currentPoint.sog)}</span>
          </div>

          <div className="flex items-center gap-1 text-slate-300">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono font-semibold">{formatDegrees(currentPoint.cog)}</span>
          </div>

          <div className="flex items-center gap-1 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-[11px] text-slate-300">
              {currentPoint.timestamp.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}{' '}
              {currentPoint.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {currentPoint.navStatus && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-cyan-300 border border-slate-700">
              {currentPoint.navStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
