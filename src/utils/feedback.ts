let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {
      // Ignore autoplay restrictions if not triggered by direct gesture
    });
  }
  return sharedAudioCtx;
}

/**
 * Unlocks Web Audio API on first user gesture (important for iOS Safari).
 */
export function unlockAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function playTone(
  frequencyHz: number,
  durationMs: number,
  delayMs = 0,
  type: OscillatorType = 'square',
  gainValue = 0.22
): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startAt = ctx.currentTime + delayMs / 1000;
    const stopAt = startAt + durationMs / 1000;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequencyHz, startAt);

    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.01);
    gain.gain.setValueAtTime(gainValue, Math.max(startAt + 0.01, stopAt - 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startAt);
    osc.stop(stopAt + 0.01);
  } catch {
    // Fallback silently if audio hardware is unavailable
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore on browsers that do not support Vibration API (e.g. iOS Safari)
  }
}

/**
 * Classic SPORTident station high-pitched beep (2400Hz) + 200ms vibration.
 */
export function triggerSportIdentPunchFeedback(): void {
  playTone(2400, 180, 0, 'square', 0.25);
  vibrate(200);
}

/**
 * Error double-beep (low frequency) + warning vibration when scanning invalid/duplicate control.
 */
export function triggerErrorFeedback(): void {
  playTone(440, 130, 0, 'sawtooth', 0.25);
  playTone(330, 180, 170, 'sawtooth', 0.25);
  vibrate([120, 60, 180]);
}

/**
 * Triple victory SPORTident beep on META finish + victory vibration pattern.
 */
export function triggerFinishVictoryFeedback(): void {
  playTone(2400, 150, 0, 'square', 0.25);
  playTone(2400, 150, 230, 'square', 0.25);
  playTone(2800, 300, 460, 'square', 0.28);
  vibrate([150, 80, 150, 80, 300]);
}
