import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { unlockAudioContext } from '../utils/feedback';

interface QrScannerBoxProps {
  onScan: (decodedText: string) => void;
  scannerTitle?: string;
  autoStart?: boolean;
}

export const QrScannerBox: React.FC<QrScannerBoxProps> = ({
  onScan,
  scannerTitle = 'Escanear Código QR de Baliza',
  autoStart = true,
}) => {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(autoStart);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const lastScannedRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });
  const containerIdRef = useRef<string>(`qr-reader-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let isMounted = true;

    const stopScanner = async () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {
          // Ignore stop errors on unmount
        }
        scannerRef.current = null;
      }
    };

    if (!isCameraActive) {
      stopScanner();
      return;
    }

    const startScanner = async () => {
      setIsStarting(true);
      setCameraError(null);

      try {
        await stopScanner();
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(containerIdRef.current, false);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 230, height: 230 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            const now = Date.now();
            const cleaned = decodedText.trim().toUpperCase();
            // Prevent same QR firing repeatedly within 1.8 seconds
            if (
              cleaned === lastScannedRef.current.text &&
              now - lastScannedRef.current.time < 1800
            ) {
              return;
            }
            lastScannedRef.current = { text: cleaned, time: now };
            onScanRef.current(cleaned);
          },
          () => {
            // Frame scan error (no QR in frame) - ignore
          }
        );

        if (isMounted) {
          setIsStarting(false);
        }
      } catch (err) {
        if (!isMounted) return;
        setIsStarting(false);
        setIsCameraActive(false);
        const msg =
          err instanceof Error ? err.message : 'No se pudo acceder a la cámara trasera.';
        setCameraError(
          `No se pudo abrir la cámara (${msg}). Revisa los permisos del navegador o utiliza el código manual de 3 letras más abajo.`
        );
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isCameraActive]);

  const toggleCamera = () => {
    unlockAudioContext();
    setCameraError(null);
    setIsCameraActive((prev) => !prev);
  };

  return (
    <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
          <h2 className="text-base font-extrabold uppercase tracking-wide text-white">
            {scannerTitle}
          </h2>
        </div>

        <button
          type="button"
          onClick={toggleCamera}
          className={`px-3.5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider border-2 transition active:scale-95 ${
            isCameraActive
              ? 'bg-slate-800 border-slate-600 text-amber-300 hover:bg-slate-700'
              : 'bg-orange-600 border-orange-400 text-white hover:bg-orange-500'
          }`}
        >
          {isCameraActive ? '⏸ Pausar Cámara' : '📷 Activar Cámara'}
        </button>
      </div>

      {isCameraActive ? (
        <div className="relative w-full max-w-sm mx-auto aspect-square bg-black rounded-xl overflow-hidden border-2 border-orange-500/80 shadow-inner">
          <div id={containerIdRef.current} className="w-full h-full object-cover" />

          {/* Clean High-Contrast Viewfinder Overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-56 h-56 relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg" />
            </div>
          </div>

          {isStarting && (
            <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center p-4 text-center">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-200">
                Iniciando cámara trasera...
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-950 border-2 border-dashed border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-300 font-semibold text-sm mb-3">
            Cámara en pausa para ahorrar batería mientras corres.
          </p>
          <button
            type="button"
            onClick={toggleCamera}
            className="w-full py-4 px-5 bg-orange-600 hover:bg-orange-500 active:scale-98 text-white font-black text-lg rounded-xl border-2 border-orange-400 shadow-lg"
          >
            📷 ABRIR CÁMARA PARA ESCANEAR
          </button>
        </div>
      )}

      {cameraError && (
        <div className="mt-3 p-3.5 rounded-xl bg-amber-950/90 border-2 border-amber-500 text-amber-100 text-sm font-semibold">
          ⚠️ {cameraError}
        </div>
      )}
    </div>
  );
};
