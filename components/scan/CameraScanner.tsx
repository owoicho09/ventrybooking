'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraOff, Flashlight, FlashlightOff, Loader2 } from 'lucide-react';

/**
 * In-app QR scanner for the door.
 *
 * Ticket QR codes encode a short URL (`${APP_URL}/scan/TKT-XXXX-XXXX`), not
 * the dense signed token the first in-app scanner choked on, so decoding is
 * cheap even on low-end phones:
 *   - Android Chrome: the native BarcodeDetector (hardware-assisted, fast).
 *   - Safari / anything without it: jsQR on a frame downscaled to ≤640px.
 * Decoding runs at most ~8 times a second and stops while `paused` is true
 * (e.g. while a result is on screen) or when the tab is hidden.
 */

const TICKET_ID = /TKT-[A-Z0-9]{4}-[A-Z0-9]{4}/i;
const DECODE_INTERVAL_MS = 120;
const JSQR_MAX_WIDTH = 640;
/** Ignore the same ticket for this long, so one QR held in view isn't scanned twice. */
const SAME_CODE_COOLDOWN_MS = 4000;

/** Pull a ticket ID out of whatever the QR held: a scan URL or a bare ID. */
export function ticketIdFromQr(raw: string): string | null {
  const m = raw.match(TICKET_ID);
  return m ? m[0].toUpperCase() : null;
}

type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type JsQR = typeof import('jsqr').default;

interface Props {
  /** Called with a ticket ID (TKT-XXXX-XXXX) or, for a non-Ventry QR, null + the raw text. */
  onDetect: (ticketId: string | null, raw: string) => void;
  /** Stop decoding (camera stays on) while a result is being shown. */
  paused?: boolean;
}

type CamState = 'starting' | 'live' | 'denied' | 'unavailable' | 'insecure';

export function CameraScanner({ onDetect, paused = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const jsqrRef = useRef<JsQR | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const pausedRef = useRef(paused);
  const onDetectRef = useRef(onDetect);
  const [state, setState] = useState<CamState>('starting');
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { onDetectRef.current = onDetect; }, [onDetect]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!window.isSecureContext) { setState('insecure'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setState('unavailable'); return; }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stop(); return; }
      video.srcObject = stream;
      await video.play().catch(() => {});

      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
      setTorchAvailable(!!caps.torch);
      setTorchOn(false);

      // Native detector where the browser has one; jsQR otherwise.
      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): BarcodeDetectorLike; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      if (BD && (await BD.getSupportedFormats?.().then(f => f.includes('qr_code')).catch(() => false))) {
        detectorRef.current = new BD({ formats: ['qr_code'] });
      } else if (!jsqrRef.current) {
        jsqrRef.current = (await import('jsqr')).default;
      }
      setState('live');
    } catch (err) {
      const name = (err as DOMException)?.name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }, [stop]);

  // Start on mount; release the camera on unmount and while the tab is hidden.
  useEffect(() => {
    // Kicked off as a callback (not synchronously in the effect body): the
    // effect subscribes to the camera, and start() reports back via state.
    let alive = true;
    Promise.resolve().then(() => { if (alive) start(); });
    const onVis = () => {
      if (document.hidden) stop();
      else if (!streamRef.current) start();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [start, stop]);

  // Decode loop.
  useEffect(() => {
    if (state !== 'live') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!pausedRef.current && video && video.readyState >= 2 && video.videoWidth > 0) {
        let raw: string | null = null;
        try {
          if (detectorRef.current) {
            const found = await detectorRef.current.detect(video);
            raw = found[0]?.rawValue ?? null;
          } else if (jsqrRef.current) {
            const scale = Math.min(1, JSQR_MAX_WIDTH / video.videoWidth);
            const w = Math.round(video.videoWidth * scale);
            const h = Math.round(video.videoHeight * scale);
            const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              raw = jsqrRef.current(img.data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
            }
          }
        } catch { /* a bad frame; try the next one */ }

        if (raw && !cancelled) {
          const now = Date.now();
          const id = ticketIdFromQr(raw);
          const key = id ?? raw;
          if (key !== lastRef.current.code || now - lastRef.current.at > SAME_CODE_COOLDOWN_MS) {
            lastRef.current = { code: key, at: now };
            onDetectRef.current(id, raw);
          }
        }
      }
      if (!cancelled) timer = setTimeout(tick, DECODE_INTERVAL_MS);
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(t => !t);
    } catch { setTorchAvailable(false); }
  };

  const message =
    state === 'denied' ? 'Camera access was blocked. Allow camera access for this site in your browser settings, then tap Try again.'
    : state === 'insecure' ? 'The camera only works over a secure (https) connection.'
    : state === 'unavailable' ? 'No camera could be opened on this device. Use your phone camera or type the ticket ID instead.'
    : null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '3 / 4', maxHeight: '62svh' }}>
      <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />

      {state === 'live' && (
        <>
          {/* Aiming frame */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative" style={{ width: '62%', aspectRatio: '1 / 1' }}>
              {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
                <span
                  key={c}
                  className="absolute h-8 w-8"
                  style={{
                    borderColor: paused ? 'rgba(255,255,255,.35)' : '#10B981',
                    borderStyle: 'solid',
                    borderWidth: 0,
                    ...(c[0] === 't' ? { top: 0, borderTopWidth: 3 } : { bottom: 0, borderBottomWidth: 3 }),
                    ...(c[1] === 'l' ? { left: 0, borderLeftWidth: 3 } : { right: 0, borderRightWidth: 3 }),
                    borderRadius: c === 'tl' ? '8px 0 0 0' : c === 'tr' ? '0 8px 0 0' : c === 'bl' ? '0 0 0 8px' : '0 0 8px 0',
                  }}
                />
              ))}
            </div>
          </div>
          <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">
            Point at the ticket&apos;s QR code
          </p>
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white"
              aria-label={torchOn ? 'Turn torch off' : 'Turn torch on'}
            >
              {torchOn ? <FlashlightOff size={18} /> : <Flashlight size={18} />}
            </button>
          )}
        </>
      )}

      {state === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm">Opening camera…</p>
        </div>
      )}

      {message && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
          <CameraOff size={34} className="opacity-70" />
          <p className="max-w-xs text-sm leading-relaxed text-white/85">{message}</p>
          {state !== 'insecure' && (
            <button type="button" onClick={start} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
