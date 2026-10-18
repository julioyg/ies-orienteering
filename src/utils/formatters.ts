import { RaceState } from '../types/race';

/**
 * Formats milliseconds into MM:SS (or HH:MM:SS if >= 60 mins, though MM:SS is standard for school races).
 * Uses total minutes so 75 minutes shows as 75:00 (classic orienteering split style).
 */
export function formatMmSs(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats a Unix epoch timestamp into local HH:MM:SS (es-ES).
 */
export function formatTimeHhMmSs(timestamp: number | null): string {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Formats a Unix epoch timestamp into a readable Spanish date (DD/MM/YYYY).
 */
export function formatDateEs(timestamp: number | null): string {
  if (!timestamp) return '--/--/----';
  const date = new Date(timestamp);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Deterministic 6-character uppercase hex/alphanumeric verification checksum
 * computed from runnerName + mapNumber + totalTime + sequence.
 */
export function generateVerificationHash(state: RaceState): string {
  const totalTimeFormatted =
    state.startTime && state.finishTime
      ? formatMmSs(state.finishTime - state.startTime)
      : '00:00';

  const sequenceStr = state.punches
    .map((p) => `${p.controlCode}:${p.method}:${formatMmSs(p.splitMs)}`)
    .join('|');

  const rawPayload = [
    state.runnerName.trim().toUpperCase(),
    state.group.trim().toUpperCase(),
    state.mapNumber.trim().toUpperCase(),
    totalTimeFormatted,
    sequenceStr,
    'IES-SIERRA-ALMIJARA-V1',
  ].join('::');

  // FNV-1a 32-bit + DJB2 hybrid for 6 deterministic hex characters
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < rawPayload.length; i++) {
    const ch = rawPayload.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 = (Math.imul(h2, 33) ^ ch) >>> 0;
  }

  const combined = ((h1 >>> 0) ^ (h2 >>> 0)) >>> 0;
  const hex = combined.toString(16).toUpperCase().padStart(6, '0').slice(0, 6);
  return `#${hex}`;
}

/**
 * Generates the official plain-text summary for WhatsApp / Telegram / Google Classroom.
 */
export function buildShareableResultText(state: RaceState): string {
  const startTime = state.startTime ?? Date.now();
  const finishTime = state.finishTime ?? Date.now();
  const totalMs = Math.max(0, finishTime - startTime);
  const totalFormatted = formatMmSs(totalMs);
  const hash = generateVerificationHash(state);

  const finishMethodIcon = state.finishMethod === 'MANUAL' ? '⌨️' : '📷';
  const sequenceTokens = [
    'SALIDA',
    ...state.punches.map((p) => `${p.controlCode}${p.method === 'QR' ? '📷' : '⌨️'}`),
    'META',
  ].join(' -> ');

  const lastPunchTime =
    state.punches.length > 0
      ? state.punches[state.punches.length - 1].timestamp
      : startTime;
  const finishSplitMs = Math.max(0, finishTime - lastPunchTime);

  const splitLines = state.punches.map((p, idx) => {
    const icon = p.method === 'QR' ? '📷' : '⌨️';
    return `${idx + 1}. Baliza ${p.controlCode} (${icon}) | Parcial: ${formatMmSs(p.splitMs)} | Acum: ${formatMmSs(p.cumulativeMs)}`;
  });

  splitLines.push(
    `🏁 META (${finishMethodIcon})      | Parcial: ${formatMmSs(finishSplitMs)} | Acum: ${totalFormatted}`
  );

  return [
    '🧭 RESULTADO ORIENTACIÓN - IES SIERRA ALMIJARA',
    `👤 Alumno/s: ${state.runnerName.trim()} (${state.group.trim()})`,
    `🗺️ Mapa: ${state.mapNumber.trim()}`,
    `⏱️ Tiempo Total: ${totalFormatted}`,
    `📍 Orden: ${sequenceTokens}`,
    '--------------------------------',
    ...splitLines,
    `🔒 Cod. Verificación: ${hash}`,
  ].join('\n');
}
