import React, { useRef, useState, useEffect } from 'react';
import { VoyageData } from '../types';
import { formatNauticalCoordinate, formatNM, formatKnots, formatDuration } from '../utils/geoUtils';
import { 
  Download, 
  Printer, 
  Sparkles, 
  Compass, 
  Ship, 
  Check, 
  Sliders, 
  Image as ImageIcon,
  Copy
} from 'lucide-react';

interface ExportStudioProps {
  voyage: VoyageData;
}

export const ExportStudio: React.FC<ExportStudioProps> = ({ voyage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Poster Configuration States
  const [posterTitle, setPosterTitle] = useState(voyage.metadata.title);
  const [subtitle, setSubtitle] = useState(`${voyage.metadata.vesselName} • Skipper: ${voyage.metadata.skipper || 'M. Jansen'}`);
  const [theme, setTheme] = useState<'navy' | 'light' | 'dark' | 'vintage'>('navy');
  const [showCompass, setShowCompass] = useState(true);
  const [showBorderScale, setShowBorderScale] = useState(true);
  const [showMetricsCard, setShowMetricsCard] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Re-render canvas whenever voyage or options change
  useEffect(() => {
    renderPoster();
  }, [voyage, posterTitle, subtitle, theme, showCompass, showBorderScale, showMetricsCard]);

  const renderPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsRendering(true);

    const width = 1600;
    const height = 1100;
    canvas.width = width;
    canvas.height = height;

    const points = voyage.points;
    if (points.length === 0) return;

    // Theme Color Palettes
    const palettes = {
      navy: {
        bg: '#0a192f',
        water: '#0c2240',
        grid: '#1e3a5f',
        route: '#38bdf8',
        text: '#f8fafc',
        subtext: '#94a3b8',
        border: '#38bdf8',
        cardBg: 'rgba(10, 25, 47, 0.85)',
      },
      light: {
        bg: '#f8fafc',
        water: '#e2e8f0',
        grid: '#cbd5e1',
        route: '#0284c7',
        text: '#0f172a',
        subtext: '#64748b',
        border: '#0284c7',
        cardBg: 'rgba(255, 255, 255, 0.9)',
      },
      dark: {
        bg: '#090d16',
        water: '#0f172a',
        grid: '#1e293b',
        route: '#06b6d4',
        text: '#f8fafc',
        subtext: '#94a3b8',
        border: '#06b6d4',
        cardBg: 'rgba(15, 23, 42, 0.9)',
      },
      vintage: {
        bg: '#fbf7ee',
        water: '#eedfc3',
        grid: '#d5c4a1',
        route: '#9e2a2b',
        text: '#2b2d42',
        subtext: '#6b705c',
        border: '#9e2a2b',
        cardBg: 'rgba(251, 247, 238, 0.92)',
      },
    };

    const curTheme = palettes[theme];

    // 1. Draw Background
    ctx.fillStyle = curTheme.bg;
    ctx.fillRect(0, 0, width, height);

    // Map Margins
    const margin = 80;
    const mapW = width - margin * 2;
    const mapH = height - margin * 2;

    // Map area background
    ctx.fillStyle = curTheme.water;
    ctx.fillRect(margin, margin, mapW, mapH);

    // Bounds calculation with padding
    const bounds = voyage.bounds;
    const latSpan = Math.max(0.1, bounds.maxLat - bounds.minLat);
    const lonSpan = Math.max(0.1, bounds.maxLon - bounds.minLon);
    const padLat = latSpan * 0.15;
    const padLon = lonSpan * 0.15;

    const minLat = bounds.minLat - padLat;
    const maxLat = bounds.maxLat + padLat;
    const minLon = bounds.minLon - padLon;
    const maxLon = bounds.maxLon + padLon;

    // Projection function: Lat/Lon to Canvas X/Y (Mercator approximation)
    const project = (lat: number, lon: number) => {
      const x = margin + ((lon - minLon) / (maxLon - minLon)) * mapW;
      const y = margin + mapH - ((lat - minLat) / (maxLat - minLat)) * mapH;
      return { x, y };
    };

    // 2. Graticule / Coordinate Grid Lines
    ctx.strokeStyle = curTheme.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const latStep = latSpan / 4;
    for (let l = minLat + latStep; l < maxLat; l += latStep) {
      const p1 = project(l, minLon);
      const p2 = project(l, maxLon);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Label
      ctx.fillStyle = curTheme.subtext;
      ctx.font = '11px monospace';
      ctx.fillText(`${l.toFixed(2)}°N`, margin + 8, p1.y - 4);
    }

    const lonStep = lonSpan / 5;
    for (let o = minLon + lonStep; o < maxLon; o += lonStep) {
      const p1 = project(minLat, o);
      const p2 = project(maxLat, o);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.fillStyle = curTheme.subtext;
      ctx.font = '11px monospace';
      ctx.fillText(`${o.toFixed(2)}°E`, p1.x + 4, margin + mapH - 8);
    }

    ctx.setLineDash([]); // reset

    // 3. Draw Track Route
    if (points.length > 1) {
      // Outer glow for dark themes
      if (theme !== 'light' && theme !== 'vintage') {
        ctx.strokeStyle = curTheme.route;
        ctx.lineWidth = 12;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        points.forEach((p, idx) => {
          const pt = project(p.lat, p.lon);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Main Route line
      ctx.strokeStyle = curTheme.route;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        const pt = project(p.lat, p.lon);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // Start Marker
      const startPt = project(points[0].lat, points[0].lon);
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(startPt.x, startPt.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // End Marker
      const endPt = project(points[points.length - 1].lat, points[points.length - 1].lon);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(endPt.x, endPt.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Anchorage stop markers
      voyage.anchorages.forEach((anc) => {
        const aPt = project(anc.lat, anc.lon);
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(aPt.x, aPt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      });
    }

    // 4. Nautical Coordinate Border (Alternating Black & White Bar)
    if (showBorderScale) {
      const bw = 12;
      ctx.strokeStyle = curTheme.border;
      ctx.lineWidth = 2;
      ctx.strokeRect(margin - bw, margin - bw, mapW + bw * 2, mapH + bw * 2);

      // Corner rosettes
      ctx.fillStyle = curTheme.border;
      ctx.fillRect(margin - bw - 4, margin - bw - 4, 8, 8);
      ctx.fillRect(margin + mapW + bw - 4, margin - bw - 4, 8, 8);
      ctx.fillRect(margin - bw - 4, margin + mapH + bw - 4, 8, 8);
      ctx.fillRect(margin + mapW + bw - 4, margin + mapH + bw - 4, 8, 8);
    }

    // 5. Handcrafted Nautical Compass Rose (Windrose)
    if (showCompass) {
      const cx = margin + mapW - 140;
      const cy = margin + 140;
      const radius = 65;

      ctx.save();
      ctx.translate(cx, cy);

      // Outer rings
      ctx.strokeStyle = curTheme.text;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
      ctx.stroke();

      // Cardinal points (N, S, E, W)
      const points8 = [
        { deg: 0, text: 'N' },
        { deg: 90, text: 'E' },
        { deg: 180, text: 'S' },
        { deg: 270, text: 'W' },
      ];

      points8.forEach(({ deg, text }) => {
        ctx.save();
        ctx.rotate((deg * Math.PI) / 180);

        // Arrow point
        ctx.fillStyle = text === 'N' ? curTheme.border : curTheme.text;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(8, -15);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.fillStyle = curTheme.water;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(-8, -15);
        ctx.lineTo(0, 0);
        ctx.fill();

        // Label
        ctx.fillStyle = curTheme.text;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 0, -radius - 8);

        ctx.restore();
      });

      ctx.restore();
      ctx.globalAlpha = 1.0;
    }

    // 6. Title Block & Voyage Statistics Badge
    if (showMetricsCard) {
      const cardX = margin + 30;
      const cardY = margin + 30;
      const cardW = 480;
      const cardH = 220;

      // Card Background
      ctx.fillStyle = curTheme.cardBg;
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = curTheme.border;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      // Title
      ctx.fillStyle = curTheme.text;
      ctx.font = 'bold 24px "SF Pro Display", -apple-system, sans-serif';
      ctx.fillText(posterTitle || 'AIS Reisekarte', cardX + 24, cardY + 45);

      // Subtitle
      ctx.fillStyle = curTheme.subtext;
      ctx.font = '14px sans-serif';
      ctx.fillText(subtitle, cardX + 24, cardY + 72);

      // Divider line
      ctx.strokeStyle = curTheme.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 24, cardY + 90);
      ctx.lineTo(cardX + cardW - 24, cardY + 90);
      ctx.stroke();

      // Stats 4-Column Grid
      const statColW = (cardW - 48) / 3;

      // Distance
      ctx.fillStyle = curTheme.subtext;
      ctx.font = '11px sans-serif';
      ctx.fillText('GESAMTDISTANZ', cardX + 24, cardY + 116);
      ctx.fillStyle = curTheme.border;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(formatNM(voyage.totalDistanceNM), cardX + 24, cardY + 142);

      // Avg Speed
      ctx.fillStyle = curTheme.subtext;
      ctx.font = '11px sans-serif';
      ctx.fillText('Ø GESCHWINDIGKEIT', cardX + 24 + statColW, cardY + 116);
      ctx.fillStyle = curTheme.text;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(formatKnots(voyage.avgSpeedKnots), cardX + 24 + statColW, cardY + 142);

      // Duration
      ctx.fillStyle = curTheme.subtext;
      ctx.font = '11px sans-serif';
      ctx.fillText('REISEZEIT', cardX + 24 + statColW * 2, cardY + 116);
      ctx.fillStyle = curTheme.text;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(formatDuration(voyage.durationSeconds), cardX + 24 + statColW * 2, cardY + 142);

      // Footer note inside card
      ctx.fillStyle = curTheme.subtext;
      ctx.font = '11px monospace';
      ctx.fillText(
        `Start: ${points[0]?.timestamp.toLocaleDateString('de-DE')} • Ziel: ${points[points.length - 1]?.timestamp.toLocaleDateString('de-DE')}`,
        cardX + 24,
        cardY + 185
      );
    }

    // 7. Bottom App Signature
    ctx.fillStyle = curTheme.subtext;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Erstellt mit AIS Reisekarte für macOS', width - margin - 8, height - margin + 30);

    setIsRendering(false);
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${posterTitle.replace(/\s+/g, '_')}_Reisekarte.png`;
    a.click();
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      });
    } catch {
      // Fallback
      handleDownloadPng();
    }
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const windowContent = `
      <!DOCTYPE html>
      <html>
        <head><title>${posterTitle}</title></head>
        <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#fff;">
          <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" />
        </body>
      </html>
    `;
    const printWin = window.open('', '', 'width=900,height=700');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(windowContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        printWin.print();
        printWin.close();
      }, 300);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-950 p-6 text-slate-100 select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span>Nautische Reisekarte exportieren & drucken</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Erstelle aus den AIS-Tracker-Koordinaten eine hochauflösende, rahmenfertige Reisekarte oder Urkunde.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyImage}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              {copySuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copySuccess ? 'Kopiert!' : 'Kopieren'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Drucken / PDF</span>
            </button>
            <button
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-md transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>PNG Herunterladen (High-Res)</span>
            </button>
          </div>
        </div>

        {/* Customization Toolbar & Layout Options */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Sliders className="w-4 h-4" />
            <span>Karten-Design & Beschriftung anpassen</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Title */}
            <div>
              <label className="block text-slate-400 mb-1">Kartentitel</label>
              <input
                type="text"
                value={posterTitle}
                onChange={(e) => setPosterTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="block text-slate-400 mb-1">Untertitel & Schiffsname</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Theme Selector */}
            <div>
              <label className="block text-slate-400 mb-1">Farbschema</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="navy">Klassisch Marineblau (Navy)</option>
                <option value="dark">Nacht-Navigation (Tiefschwarz)</option>
                <option value="light">Seekarte Hell (Klassisch)</option>
                <option value="vintage">Vintage Pergament (Antik)</option>
              </select>
            </div>

            {/* Toggles */}
            <div>
              <label className="block text-slate-400 mb-1">Kartenelemente</label>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCompass}
                    onChange={(e) => setShowCompass(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-slate-300">Kompassrose</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMetricsCard}
                    onChange={(e) => setShowMetricsCard(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-slate-300">Infokasten</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Live Canvas Preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-3 px-2">
            <span>Druckvorschau (1600 × 1100 px Render-Canvas)</span>
            <span>{isRendering ? 'Wird gerendert...' : 'Bereit zum Drucken'}</span>
          </div>

          <div className="w-full overflow-hidden rounded-lg border border-slate-700/80 shadow-2xl bg-slate-950 flex items-center justify-center p-2">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded shadow-lg"
              style={{ maxHeight: '68vh' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
