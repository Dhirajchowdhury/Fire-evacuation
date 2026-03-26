'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAdminWorkspace } from '../../../../hooks/useAdminWorkspace';

export default function QRCodePage() {
  const { workspace, workspaceId } = useAdminWorkspace();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [mapUrl, setMapUrl]   = useState('');
  const [toast, setToast]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Generate QR into canvas using qrcode package
  const generateQR = useCallback(async (url: string) => {
    if (!canvasRef.current || !url) return;
    try {
      const QRCode = (await import('qrcode')).default;
      await QRCode.toCanvas(canvasRef.current, url, {
        width: 240,
        margin: 2,
        color: { dark: '#ef4444', light: '#1e293b' },
        errorCorrectionLevel: 'H',
      });
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const origin = window.location.origin;
    const url = `${origin}/map/${workspaceId}`;
    setMapUrl(url);
    generateQR(url);
  }, [workspaceId, generateQR]);

  async function copyLink() {
    await navigator.clipboard.writeText(mapUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Link copied!');
  }

  function downloadQR() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `fireroute-evacuation-qr-${workspace?.name ?? 'map'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function shareWhatsApp() {
    const text = `🚨 Emergency Evacuation Map — ${workspace?.name ?? 'Building'}\nScan or open: ${mapUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function shareEmail() {
    const subject = `Emergency Evacuation Map — ${workspace?.name ?? 'Building'}`;
    const body = `Scan the QR code or open this link to view the evacuation floor plan:\n\n${mapUrl}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }

  // Open the map page in a new tab (preview)
  function previewMap() {
    window.open(mapUrl, '_blank');
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Evacuation QR Code</h1>
        <p className="text-slate-500 text-sm mt-1">
          Share this QR code with building occupants. When scanned, it opens the evacuation floor plan.
        </p>
      </div>

      {/* QR Card */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-5">
        {/* Canvas QR */}
        <div className="rounded-xl overflow-hidden border-2 border-slate-600 p-1"
          style={{ background: '#1e293b' }}>
          <canvas ref={canvasRef} className="block" />
          {!workspaceId && (
            <div className="w-60 h-60 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Workspace label */}
        {workspace && (
          <div className="text-center">
            <p className="text-white font-semibold text-sm">{workspace.name}</p>
            {workspace.location && <p className="text-slate-500 text-xs mt-0.5">{workspace.location}</p>}
          </div>
        )}

        {/* Map URL */}
        <div className="w-full">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Evacuation Map URL</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={mapUrl}
              className="flex-1 min-w-0 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
            />
            <button
              onClick={copyLink}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                copied ? 'bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <button onClick={downloadQR}
            className="py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5">
            ⬇ Download QR
          </button>
          <button onClick={previewMap}
            className="py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5">
            👁 Preview Map
          </button>
          <button onClick={shareWhatsApp}
            className="py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5">
            💬 WhatsApp
          </button>
          <button onClick={shareEmail}
            className="py-2.5 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5">
            ✉ Email
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <p className="text-white font-semibold mb-3 text-sm">How it works</p>
        <ol className="space-y-2.5">
          {[
            ['📋', 'Download or screenshot the QR code above'],
            ['📌', 'Print and place it at building entrances & exits'],
            ['📱', 'Occupants scan it with any phone camera'],
            ['🗺️', 'They instantly see your building\'s evacuation floor plan'],
            ['🚨', 'They tap "Start Evacuation" during an emergency'],
          ].map(([icon, text], i) => (
            <li key={i} className="flex items-start gap-3 text-slate-400 text-sm">
              <span className="shrink-0">{icon}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Floor plan status */}
      <div className={`rounded-xl p-4 border flex items-start gap-3 ${
        workspace?.floor_plan_url
          ? 'bg-green-950/30 border-green-800'
          : 'bg-yellow-950/30 border-yellow-800'
      }`}>
        <span className="text-xl shrink-0">{workspace?.floor_plan_url ? '✅' : '⚠️'}</span>
        <div>
          <p className={`text-sm font-semibold ${workspace?.floor_plan_url ? 'text-green-400' : 'text-yellow-400'}`}>
            {workspace?.floor_plan_url ? 'Floor plan uploaded' : 'No floor plan uploaded yet'}
          </p>
          <p className="text-slate-500 text-xs mt-0.5">
            {workspace?.floor_plan_url
              ? 'Occupants will see your floor plan when they scan the QR.'
              : 'Upload a floor plan in the Floor Plan section so occupants can see it.'}
          </p>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 sm:w-auto bg-slate-800 border border-slate-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
