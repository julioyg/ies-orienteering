import React, { useEffect, useState } from 'react';
import {
  INITIAL_RACE_STATE,
  Punch,
  PunchMethod,
  RaceState,
  STORAGE_KEY,
} from './types/race';
import { resolveControlInput } from './data/controls';
import {
  triggerErrorFeedback,
  triggerFinishVictoryFeedback,
  triggerSportIdentPunchFeedback,
  unlockAudioContext,
} from './utils/feedback';
import {
  buildShareableResultText,
  formatDateEs,
  formatMmSs,
  formatTimeHhMmSs,
  generateVerificationHash,
} from './utils/formatters';
import { QrScannerBox } from './components/QrScannerBox';
import { TeacherPortalView } from './components/TeacherPortalView';

interface FlashOverlayState {
  title: string;
  subtitle?: string;
  variant: 'success' | 'victory';
}

interface ToastBannerState {
  message: string;
  type: 'error' | 'info' | 'success';
}

function loadPersistedState(): RaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_RACE_STATE;
    const parsed = JSON.parse(raw) as Partial<RaceState>;
    if (
      parsed &&
      typeof parsed.stage === 'string' &&
      ['REGISTRATION', 'READY_TO_START', 'IN_RACE', 'FINISHED'].includes(parsed.stage)
    ) {
      return {
        stage: parsed.stage,
        runnerName: parsed.runnerName ?? '',
        group: parsed.group ?? '',
        mapNumber: parsed.mapNumber ?? '',
        startTime: typeof parsed.startTime === 'number' ? parsed.startTime : null,
        startMethod: parsed.startMethod,
        finishTime: typeof parsed.finishTime === 'number' ? parsed.finishTime : null,
        finishMethod: parsed.finishMethod,
        punches: Array.isArray(parsed.punches) ? parsed.punches : [],
      };
    }
  } catch {
    // Fallback to initial state if localStorage is corrupted
  }
  return INITIAL_RACE_STATE;
}

const SUGGESTED_GROUPS = ['1º ESO', '2º ESO', '3º ESO', '4º ESO', '1º BACH', '2º BACH'];
const SUGGESTED_MAPS = ['Mapa 1', 'Mapa 2', 'Mapa 3', 'Recorrido A', 'Recorrido B', 'Recorrido C'];

export const App: React.FC = () => {
  const isPrintRoute =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('print') === 'true' ||
      new URLSearchParams(window.location.search).get('teacher') === 'true' ||
      document.getElementById('root')?.getAttribute('data-print-mode') === 'true' ||
      window.location.pathname.endsWith('printable-controls.html'));

  const [raceState, setRaceState] = useState<RaceState>(() => loadPersistedState());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [manualCode, setManualCode] = useState<string>('');
  const [isManualOpen, setIsManualOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastBannerState | null>(null);
  const [flashOverlay, setFlashOverlay] = useState<FlashOverlayState | null>(null);
  const [emptyFinishModal, setEmptyFinishModal] = useState<{ method: PunchMethod } | null>(null);
  const [resetConfirmStep, setResetConfirmStep] = useState<0 | 1 | 2>(0);

  // Sync raceState to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raceState));
    } catch {
      // Ignore storage quota errors
    }
  }, [raceState]);

  // Live timer ticker during IN_RACE
  useEffect(() => {
    if (raceState.stage !== 'IN_RACE' || !raceState.startTime) return;

    let animFrameId: number;
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    const updateFrame = () => {
      setNowMs(Date.now());
    };
    animFrameId = requestAnimationFrame(updateFrame);

    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(animFrameId);
    };
  }, [raceState.stage, raceState.startTime]);

  if (isPrintRoute) {
    return <TeacherPortalView />;
  }

  const showToast = (message: string, type: ToastBannerState['type'] = 'error') => {
    setToast({ message, type });
    window.clearTimeout((window as unknown as { __toastTimer?: number }).__toastTimer);
    (window as unknown as { __toastTimer?: number }).__toastTimer = window.setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const triggerFlash = (
    title: string,
    subtitle?: string,
    variant: FlashOverlayState['variant'] = 'success'
  ) => {
    setFlashOverlay({ title, subtitle, variant });
    window.setTimeout(() => {
      setFlashOverlay(null);
    }, 1150);
  };

  const completeFinish = (method: PunchMethod) => {
    const finishTimestamp = Date.now();
    triggerFinishVictoryFeedback();
    triggerFlash('🏁 ¡META REGISTRADA!', 'Tiempo oficial bloqueado', 'victory');
    setEmptyFinishModal(null);
    setManualCode('');
    setRaceState((prev) => ({
      ...prev,
      stage: 'FINISHED',
      finishTime: finishTimestamp,
      finishMethod: method,
    }));
  };

  const handleControlSubmission = (rawInput: string, method: PunchMethod) => {
    unlockAudioContext();
    const control = resolveControlInput(rawInput, method);

    if (!control) {
      triggerErrorFeedback();
      showToast(
        `Código «${rawInput.trim().toUpperCase()}» no válido. Verifica el QR o el código de 3 letras de la baliza.`,
        'error'
      );
      return;
    }

    // STAGE 2: READY_TO_START
    if (raceState.stage === 'READY_TO_START') {
      if (control.type !== 'START') {
        triggerErrorFeedback();
        showToast('¡Primero debes picar la SALIDA!', 'error');
        return;
      }

      const startTimestamp = Date.now();
      triggerSportIdentPunchFeedback();
      triggerFlash('▶ ¡SALIDA PICADA!', 'Cronómetro en marcha · ¡Buena carrera!', 'success');
      setManualCode('');
      setToast(null);
      setNowMs(startTimestamp);
      setRaceState((prev) => ({
        ...prev,
        stage: 'IN_RACE',
        startTime: startTimestamp,
        startMethod: method,
        finishTime: null,
        punches: [],
      }));
      return;
    }

    // STAGE 3: IN_RACE
    if (raceState.stage === 'IN_RACE') {
      if (control.type === 'START') {
        triggerErrorFeedback();
        showToast('La SALIDA ya fue registrada. Escanea una baliza (31–50) o META.', 'error');
        return;
      }

      if (control.type === 'FINISH') {
        if (raceState.punches.length === 0) {
          triggerErrorFeedback();
          setEmptyFinishModal({ method });
          return;
        }
        completeFinish(method);
        return;
      }

      // Standard control (31 - 50)
      const alreadyPunched = raceState.punches.some((p) => p.controlCode === control.id);
      if (alreadyPunched) {
        triggerErrorFeedback();
        showToast(`Baliza ${control.id} ya registrada anteriormente`, 'error');
        return;
      }

      const punchTime = Date.now();
      const startTime = raceState.startTime ?? punchTime;
      const previousTime =
        raceState.punches.length > 0
          ? raceState.punches[raceState.punches.length - 1].timestamp
          : startTime;

      const newPunch: Punch = {
        controlCode: control.id,
        timestamp: punchTime,
        splitMs: Math.max(0, punchTime - previousTime),
        cumulativeMs: Math.max(0, punchTime - startTime),
        method,
      };

      triggerSportIdentPunchFeedback();
      triggerFlash(
        `¡BALIZA ${control.id} PICADA!`,
        `Parcial: ${formatMmSs(newPunch.splitMs)} · Acum: ${formatMmSs(newPunch.cumulativeMs)}`,
        'success'
      );
      setManualCode('');
      setToast(null);
      setRaceState((prev) => ({
        ...prev,
        punches: [...prev.punches, newPunch],
      }));
    }
  };

  const handleRegistrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudioContext();
    const runnerName = raceState.runnerName.trim();
    const group = raceState.group.trim();
    const mapNumber = raceState.mapNumber.trim();

    if (!runnerName || !group || !mapNumber) {
      triggerErrorFeedback();
      showToast('Por favor, rellena todos los campos antes de continuar.', 'error');
      return;
    }

    setToast(null);
    setRaceState({
      ...INITIAL_RACE_STATE,
      stage: 'READY_TO_START',
      runnerName,
      group,
      mapNumber,
    });
  };

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) {
      triggerErrorFeedback();
      showToast('Introduce el código manual de 3 letras escrito en la baliza.', 'error');
      return;
    }
    handleControlSubmission(manualCode, 'MANUAL');
  };

  const handleShareResults = async () => {
    const summaryText = buildShareableResultText(raceState);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Resultado Orientación - ${raceState.runnerName}`,
          text: summaryText,
        });
        showToast('Resultados listos para compartir.', 'success');
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // Fallback to clipboard if share fails
      }
    }

    try {
      await navigator.clipboard.writeText(summaryText);
      showToast('✅ Resultados copiados al portapapeles. Pégalos en WhatsApp o Classroom.', 'success');
    } catch {
      showToast('No se pudo copiar automáticamente. Haz captura de pantalla del ticket.', 'error');
    }
  };

  const handleConfirmResetRace = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setResetConfirmStep(0);
    setManualCode('');
    setToast(null);
    setRaceState(INITIAL_RACE_STATE);
  };

  const elapsedRaceMs =
    raceState.stage === 'IN_RACE' && raceState.startTime
      ? Math.max(0, nowMs - raceState.startTime)
      : raceState.stage === 'FINISHED' && raceState.startTime && raceState.finishTime
      ? Math.max(0, raceState.finishTime - raceState.startTime)
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between pb-8">
      {/* Green / Victory Visual Flash Overlay on Valid Punch */}
      {flashOverlay && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center pointer-events-none transition-opacity ${
            flashOverlay.variant === 'victory'
              ? 'bg-emerald-500/95 text-slate-950'
              : 'bg-green-500/95 text-slate-950'
          }`}
        >
          <div className="w-24 h-24 rounded-full bg-slate-950 text-green-400 flex items-center justify-center text-5xl font-black mb-4 shadow-2xl">
            ✓
          </div>
          <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tight drop-shadow">
            {flashOverlay.title}
          </h2>
          {flashOverlay.subtitle && (
            <p className="mt-2 text-xl font-extrabold font-mono bg-slate-950 text-white px-4 py-1.5 rounded-xl">
              {flashOverlay.subtitle}
            </p>
          )}
        </div>
      )}

      {/* Accidental Empty Finish Confirmation Modal */}
      {emptyFinishModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-amber-500 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-2xl font-black text-amber-400 uppercase">
              ⚠️ ¡Aún no has picado ninguna baliza!
            </h3>
            <p className="mt-2 text-base font-semibold text-slate-200">
              Has escaneado la <strong>META</strong> con <strong>0 balizas registradas</strong>.
              ¿Seguro que deseas finalizar la carrera ahora?
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEmptyFinishModal(null)}
                className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 font-black text-white"
              >
                Seguir Corriendo
              </button>
              <button
                type="button"
                onClick={() => completeFinish(emptyFinishModal.method)}
                className="py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 border-2 border-red-400 font-black text-white"
              >
                Sí, Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Double Confirmation Reset Modal */}
      {resetConfirmStep > 0 && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-red-500 rounded-2xl max-w-md w-full p-5 shadow-2xl">
            {resetConfirmStep === 1 ? (
              <>
                <h3 className="text-xl font-black text-red-400 uppercase">
                  ⚠️ ¿Borrar Ticket Actual? (Paso 1 de 2)
                </h3>
                <p className="mt-2 text-base font-semibold text-slate-100">
                  ¿Seguro que quieres borrar tu ticket actual? Asegúrate de haber enviado el
                  pantallazo o texto al profesor antes.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResetConfirmStep(0)}
                    className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 font-black text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetConfirmStep(2)}
                    className="py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 border-2 border-amber-300 font-black text-slate-950"
                  >
                    Continuar →
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-black text-red-400 uppercase">
                  🛑 Confirmación Definitiva (Paso 2 de 2)
                </h3>
                <p className="mt-2 text-base font-semibold text-slate-100">
                  Esta acción eliminará todos los tiempos y balizas de{' '}
                  <strong className="text-amber-300">{raceState.runnerName}</strong> de forma
                  permanente.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResetConfirmStep(0)}
                    className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 font-black text-white"
                  >
                    No, Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmResetRace}
                    className="py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 border-2 border-red-300 font-black text-white"
                  >
                    Sí, Borrar Todo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Top Institutional Bar */}
      <header className="bg-slate-900 border-b-4 border-orange-500 px-4 py-3 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Classic Diagonal IOF Icon */}
            <div
              className="w-10 h-10 rounded-lg border-2 border-white shrink-0 shadow"
              style={{
                background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 50%, #FF5500 50%, #FF5500 100%)',
              }}
              aria-hidden="true"
            />
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-400">
                IES SIERRA ALMIJARA
              </p>
              <h1 className="text-lg font-black tracking-tight leading-tight text-white">
                Tarjeta SPORTident Virtual
              </h1>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-600 text-xs font-extrabold uppercase tracking-wider text-slate-200">
            {raceState.stage === 'REGISTRATION' && '1/4 Registro'}
            {raceState.stage === 'READY_TO_START' && '2/4 Salida'}
            {raceState.stage === 'IN_RACE' && '3/4 En Carrera'}
            {raceState.stage === 'FINISHED' && '4/4 Meta'}
          </span>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-lg w-full mx-auto px-4 pt-4 flex-1 space-y-4">
        {/* Global High-Contrast Toast Banner */}
        {toast && (
          <div
            role="alert"
            className={`p-4 rounded-2xl border-3 font-extrabold text-base shadow-xl flex items-start justify-between gap-3 ${
              toast.type === 'error'
                ? 'bg-red-950 border-2 border-red-400 text-red-100'
                : toast.type === 'success'
                ? 'bg-emerald-950 border-2 border-emerald-400 text-emerald-100'
                : 'bg-amber-950 border-2 border-amber-400 text-amber-100'
            }`}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-sm px-2 py-0.5 rounded bg-black/30 font-black"
              aria-label="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        )}

        {/* =========================================================
            STAGE 1: REGISTRATION
           ========================================================= */}
        {raceState.stage === 'REGISTRATION' && (
          <section className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-5 shadow-xl">
            <div className="mb-4">
              <span className="inline-block px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400 text-orange-300 text-xs font-black uppercase tracking-wider">
                Paso 1 · Identificación
              </span>
              <h2 className="mt-2 text-2xl font-black text-white">
                Configura tu Tarjeta Virtual
              </h2>
              <p className="text-sm text-slate-300 font-medium mt-1">
                Tus tiempos se guardan automáticamente en el móvil aunque se apague la pantalla o no
                haya cobertura.
              </p>
            </div>

            <form onSubmit={handleRegistrationSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="runnerName"
                  className="block text-sm font-black uppercase tracking-wider text-slate-200 mb-1.5"
                >
                  👤 Nombre / Pareja *
                </label>
                <input
                  id="runnerName"
                  type="text"
                  required
                  placeholder="Ej: Carlos y Ana"
                  value={raceState.runnerName}
                  onChange={(e) =>
                    setRaceState((prev) => ({ ...prev, runnerName: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-slate-600 focus:border-orange-500 focus:outline-none text-lg font-extrabold text-white placeholder:text-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor="group"
                  className="block text-sm font-black uppercase tracking-wider text-slate-200 mb-1.5"
                >
                  🏫 Curso / Grupo *
                </label>
                <input
                  id="group"
                  type="text"
                  required
                  placeholder="Ej: 3º ESO B"
                  value={raceState.group}
                  onChange={(e) =>
                    setRaceState((prev) => ({ ...prev, group: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-slate-600 focus:border-orange-500 focus:outline-none text-lg font-extrabold text-white placeholder:text-slate-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SUGGESTED_GROUPS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setRaceState((prev) => ({
                          ...prev,
                          group: prev.group.startsWith(preset) ? prev.group : `${preset} `,
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="mapNumber"
                  className="block text-sm font-black uppercase tracking-wider text-slate-200 mb-1.5"
                >
                  🗺️ Número de Mapa / Recorrido *
                </label>
                <input
                  id="mapNumber"
                  type="text"
                  required
                  placeholder="Ej: Mapa 1 o Recorrido A"
                  value={raceState.mapNumber}
                  onChange={(e) =>
                    setRaceState((prev) => ({ ...prev, mapNumber: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-slate-600 focus:border-orange-500 focus:outline-none text-lg font-extrabold text-white placeholder:text-slate-500"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SUGGESTED_MAPS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setRaceState((prev) => ({
                          ...prev,
                          mapNumber: preset,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg border text-xs font-extrabold transition ${
                        raceState.mapNumber === preset
                          ? 'bg-orange-600 border-orange-300 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-4 px-6 rounded-2xl bg-orange-600 hover:bg-orange-500 active:scale-98 border-2 border-orange-300 text-white font-black text-xl uppercase tracking-wide shadow-xl transition"
              >
                Preparar Tarjeta Virtual →
              </button>
            </form>
          </section>
        )}

        {/* =========================================================
            STAGE 2: READY_TO_START
           ========================================================= */}
        {raceState.stage === 'READY_TO_START' && (
          <div className="space-y-4">
            {/* Runner Info Header */}
            <section className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 shadow-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Corredor / Pareja</p>
                  <p className="text-xl font-black text-white">
                    {raceState.runnerName}{' '}
                    <span className="text-amber-300 font-bold text-base">
                      ({raceState.group})
                    </span>
                  </p>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-orange-600 border-2 border-orange-300 text-white font-black text-base">
                  🗺️ {raceState.mapNumber}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold">
                  ¿Algún dato incorrecto?
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setRaceState((prev) => ({
                      ...prev,
                      stage: 'REGISTRATION',
                    }))
                  }
                  className="text-xs font-extrabold text-orange-400 hover:text-orange-300 underline"
                >
                  ✏️ Editar datos
                </button>
              </div>
            </section>

            {/* Prominent Waiting for Start Banner */}
            <section className="bg-amber-400 text-slate-950 border-4 border-amber-200 rounded-2xl p-4 text-center shadow-xl">
              <p className="text-xs font-black uppercase tracking-widest">
                TARJETA LISTA · CRONÓMETRO EN CERO
              </p>
              <h2 className="mt-1 text-2xl font-black uppercase leading-tight">
                Esperando escaneo de baliza de SALIDA
              </h2>
              <p className="mt-1 text-sm font-extrabold">
                Apunta a la baliza <span className="underline">SALIDA</span> para iniciar tu tiempo
                oficial.
              </p>
            </section>

            {/* QR Camera Scanner */}
            <QrScannerBox
              scannerTitle="Escanear QR de SALIDA"
              onScan={(decoded) => handleControlSubmission(decoded, 'QR')}
              autoStart={true}
            />

            {/* Manual Backup Code Input */}
            <section className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4">
              <p className="text-sm font-black uppercase tracking-wide text-amber-300 mb-2">
                ⌨️ Plan B: ¿No funciona la cámara? Código manual de SALIDA
              </p>
              <form onSubmit={handleManualFormSubmit} className="flex gap-2">
                <input
                  type="text"
                  maxLength={16}
                  placeholder="Código 3 letras"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-slate-600 focus:border-orange-500 focus:outline-none font-mono text-2xl font-black uppercase tracking-widest text-center text-white"
                />
                <button
                  type="submit"
                  className="px-5 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 border-2 border-orange-300 font-black text-base uppercase text-white shadow-lg"
                >
                  Picar Salida
                </button>
              </form>
            </section>
          </div>
        )}

        {/* =========================================================
            STAGE 3: IN_RACE
           ========================================================= */}
        {raceState.stage === 'IN_RACE' && (
          <div className="space-y-4">
            {/* High-Contrast Live Race Header */}
            <section className="bg-slate-900 border-3 border-orange-500 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="truncate">
                  <p className="text-sm font-black text-white truncate">
                    👤 {raceState.runnerName}{' '}
                    <span className="text-slate-300 font-bold">({raceState.group})</span>
                  </p>
                </div>
                <span className="shrink-0 px-3 py-1 rounded-lg bg-orange-600 border border-orange-300 text-white font-black text-xs uppercase">
                  🗺️ {raceState.mapNumber}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 items-center text-center">
                <div className="col-span-2 bg-slate-950 border-2 border-slate-700 rounded-xl py-2.5 px-3">
                  <span className="block text-[11px] font-black uppercase tracking-widest text-orange-400">
                    ⏱ TIEMPO EN CARRERA
                  </span>
                  <span className="block font-mono text-4xl sm:text-5xl font-black tracking-wider text-white">
                    {formatMmSs(elapsedRaceMs)}
                  </span>
                </div>

                <div className="bg-slate-950 border-2 border-slate-700 rounded-xl py-2.5 px-2">
                  <span className="block text-[11px] font-black uppercase tracking-widest text-emerald-400">
                    BALIZAS
                  </span>
                  <span className="block font-mono text-4xl sm:text-5xl font-black text-emerald-300">
                    {raceState.punches.length}
                  </span>
                </div>
              </div>

              {/* Live Chronological Breadcrumb */}
              <div className="mt-3 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  📍 Secuencia Picada (Orden Cronológico):
                </p>
                <div className="flex items-center flex-wrap gap-1.5 text-sm font-black">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-900/80 border border-emerald-400 text-emerald-200">
                    SALIDA
                  </span>
                  {raceState.punches.map((punch) => (
                    <React.Fragment key={punch.controlCode}>
                      <span className="text-slate-400 font-bold">➔</span>
                      <span className="px-2.5 py-1 rounded-lg bg-orange-600/90 border border-orange-300 text-white font-mono">
                        {punch.controlCode} {punch.method === 'QR' ? '📷' : '⌨️'}
                      </span>
                    </React.Fragment>
                  ))}
                  <span className="text-slate-500 font-bold">➔ ...</span>
                </div>
              </div>
            </section>

            {/* QR Camera Scanner */}
            <QrScannerBox
              scannerTitle="Escanear Baliza (31–50) o META"
              onScan={(decoded) => handleControlSubmission(decoded, 'QR')}
              autoStart={true}
            />

            {/* Collapsible / Accessible Plan B Manual Input */}
            <section className="bg-slate-900 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-lg">
              <button
                type="button"
                onClick={() => setIsManualOpen((prev) => !prev)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left bg-slate-800/80 hover:bg-slate-800 transition"
              >
                <span className="text-sm font-black text-amber-300">
                  ⌨️ Plan B: ¿No funciona la cámara? Introducir código manual
                </span>
                <span className="text-lg font-black text-white">
                  {isManualOpen ? '▲' : '▼'}
                </span>
              </button>

              {isManualOpen && (
                <div className="p-4 border-t border-slate-700">
                  <p className="text-xs font-semibold text-slate-300 mb-2.5">
                    Escribe las <strong>3 letras</strong> impresas debajo del QR de la baliza (o de
                    META):
                  </p>
                  <form onSubmit={handleManualFormSubmit} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={16}
                      placeholder="Ej: K3P"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-3.5 rounded-xl bg-slate-950 border-2 border-slate-600 focus:border-orange-500 focus:outline-none font-mono text-2xl font-black uppercase tracking-widest text-center text-white"
                    />
                    <button
                      type="submit"
                      className="px-5 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 border-2 border-orange-300 font-black text-base uppercase text-white shadow-lg"
                    >
                      Picar Código
                    </button>
                  </form>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =========================================================
            STAGE 4: FINISHED (OFFICIAL SPORTIDENT TICKET)
           ========================================================= */}
        {raceState.stage === 'FINISHED' && (() => {
          const startTime = raceState.startTime ?? Date.now();
          const finishTime = raceState.finishTime ?? Date.now();
          const totalMs = Math.max(0, finishTime - startTime);
          const lastPunchTimestamp =
            raceState.punches.length > 0
              ? raceState.punches[raceState.punches.length - 1].timestamp
              : startTime;
          const finishSplitMs = Math.max(0, finishTime - lastPunchTimestamp);
          const verificationHash = generateVerificationHash(raceState);
          const finishMethodIcon = raceState.finishMethod === 'MANUAL' ? '⌨️' : '📷';

          return (
            <div className="space-y-4">
              {/* High-Contrast Official Ticket */}
              <article className="bg-white text-slate-950 border-4 border-orange-500 rounded-3xl overflow-hidden shadow-2xl">
                {/* 1. Ticket Header */}
                <div className="bg-slate-950 text-white p-4 border-b-4 border-orange-500">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-orange-400">
                      TICKET OFICIAL SPORTIDENT
                    </span>
                    <span className="font-mono text-xs font-black bg-slate-800 border border-slate-600 px-2.5 py-0.5 rounded text-emerald-300">
                      🔒 {verificationHash}
                    </span>
                  </div>

                  <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                    IES SIERRA ALMIJARA - ORIENTACIÓN
                  </h2>

                  {/* Runner & Large Map Badge */}
                  <div className="mt-3 flex items-center justify-between gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-700">
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-400">
                        Alumno/s ({raceState.group})
                      </p>
                      <p className="text-xl font-black text-white leading-tight">
                        {raceState.runnerName}
                      </p>
                    </div>
                    <div className="shrink-0 bg-orange-600 border-2 border-amber-300 text-white px-3.5 py-2 rounded-xl text-center shadow">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-amber-200">
                        MAPA / RECORRIDO
                      </span>
                      <span className="block text-lg font-black leading-none mt-0.5">
                        {raceState.mapNumber}
                      </span>
                    </div>
                  </div>

                  {/* Timestamps & Huge Monospace TOTAL TIME */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                    <div>
                      <span className="block text-slate-400 font-bold uppercase">Fecha</span>
                      <span className="font-mono font-black text-sm text-white">
                        {formatDateEs(startTime)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-bold uppercase">Salida</span>
                      <span className="font-mono font-black text-sm text-emerald-300">
                        {formatTimeHhMmSs(startTime)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400 font-bold uppercase">Meta</span>
                      <span className="font-mono font-black text-sm text-amber-300">
                        {formatTimeHhMmSs(finishTime)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 bg-emerald-500 text-slate-950 rounded-2xl p-3 text-center border-2 border-emerald-200 shadow-inner">
                    <span className="block text-xs font-black uppercase tracking-widest">
                      ⏱ TIEMPO TOTAL OFICIAL ({raceState.punches.length} BALIZAS)
                    </span>
                    <span className="block font-mono text-5xl font-black tracking-wider leading-none mt-1">
                      {formatMmSs(totalMs)}
                    </span>
                  </div>
                </div>

                {/* 2. Quick Sequence Strip (Teacher Fast-Check) */}
                <div className="p-4 bg-amber-50 border-b-2 border-slate-300">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                    📍 Orden de Balizas Visitadas (Comprobación Rápida):
                  </p>
                  <div className="flex items-center flex-wrap gap-1.5 text-sm font-black">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                      [SALIDA]
                    </span>
                    {raceState.punches.map((p) => (
                      <React.Fragment key={p.controlCode}>
                        <span className="text-orange-600 font-black">➔</span>
                        <span className="px-2.5 py-1 rounded-lg bg-orange-600 text-white font-mono">
                          [{p.controlCode} {p.method === 'QR' ? '📷' : '⌨️'}]
                        </span>
                      </React.Fragment>
                    ))}
                    <span className="text-orange-600 font-black">➔</span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white">
                      [META {finishMethodIcon}]
                    </span>
                  </div>
                </div>

                {/* 3. SPORTident Split Table */}
                <div className="p-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                    📊 Tabla de Parciales SPORTident
                  </h3>
                  <div className="overflow-x-auto rounded-xl border-2 border-slate-900">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase">
                          <th className="py-2 px-2.5 font-black">#</th>
                          <th className="py-2 px-2.5 font-black">Baliza</th>
                          <th className="py-2 px-2 text-center font-black">Método</th>
                          <th className="py-2 px-2.5 text-right font-black">Parcial</th>
                          <th className="py-2 px-2.5 text-right font-black">Acumulado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 font-bold">
                        {raceState.punches.map((punch, idx) => (
                          <tr
                            key={punch.controlCode}
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-100'}
                          >
                            <td className="py-2 px-2.5 font-mono text-slate-600">{idx + 1}</td>
                            <td className="py-2 px-2.5 font-black text-slate-950">
                              Baliza {punch.controlCode}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {punch.method === 'QR' ? '📷' : '⌨️'}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono text-slate-800">
                              {formatMmSs(punch.splitMs)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono font-black text-slate-950">
                              {formatMmSs(punch.cumulativeMs)}
                            </td>
                          </tr>
                        ))}

                        {/* Final leg to META */}
                        <tr className="bg-emerald-100 border-t-2 border-slate-900 font-black">
                          <td className="py-2.5 px-2.5 font-mono">🏁</td>
                          <td className="py-2.5 px-2.5 text-emerald-950">META</td>
                          <td className="py-2.5 px-2 text-center">{finishMethodIcon}</td>
                          <td className="py-2.5 px-2.5 text-right font-mono text-emerald-900">
                            {formatMmSs(finishSplitMs)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono text-emerald-950">
                            {formatMmSs(totalMs)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Verification Footer */}
                  <div className="mt-3 flex items-center justify-between text-xs font-extrabold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl border border-slate-300">
                    <span>Cód. Verificación Antifraude:</span>
                    <span className="font-mono text-sm font-black text-slate-950">
                      {verificationHash}
                    </span>
                  </div>
                </div>
              </article>

              {/* 4. Action Buttons */}
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleShareResults}
                  className="w-full py-4 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 border-2 border-emerald-200 text-slate-950 font-black text-lg uppercase tracking-wide shadow-xl flex items-center justify-center gap-2"
                >
                  📤 Compartir / Copiar Resultados
                </button>

                <button
                  type="button"
                  onClick={() => setResetConfirmStep(1)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-red-950 border-2 border-red-500/80 text-red-300 font-extrabold text-sm uppercase tracking-wider"
                >
                  🗑️ Nueva Carrera (Borrar datos)
                </button>
              </div>
            </div>
          );
        })()}
      </main>

      {/* Subtle Footer */}
      <footer className="max-w-lg w-full mx-auto px-4 pt-6 text-center text-xs text-slate-500 font-semibold space-y-2">
        <p>Educación Física · IES Sierra Almijara (Nerja) · 100% Offline PWA</p>
        <p>
          <a
            href="?teacher=true"
            className="inline-block text-[11px] text-slate-600 hover:text-orange-400 transition underline"
          >
            🔒 Acceso Profesorado (Gestión QR)
          </a>
        </p>
      </footer>
    </div>
  );
};
