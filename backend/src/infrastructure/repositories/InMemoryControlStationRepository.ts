import crypto from 'node:crypto';
import { ControlStation, ControlType } from '../../domain/entities/ControlStation.js';
import { IControlStationRepository } from '../../domain/repositories/IControlStationRepository.js';

export const TOTAL_CARDS = 100;
export const START_CARD_NUMBER = 1;
export const FINISH_CARD_NUMBER = 100;

export const CONTROL_HASH_SALT = 'IES-SIERRA-ALMIJARA-ORI-2026-V2';
export const CONTROL_HASH_ROUNDS = 256;

const UNAMBIGUOUS_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 chars (no 0/O/1/I)
const DEFAULT_FALLBACK_SEED = 'dev-fallback-seed-configure-controls-secret-seed-in-env';

/**
 * Computes the salted multi-round SHA-256 hash of a normalized control payload or backup code.
 * Matches the browser implementation in src/data/controls.ts byte-for-byte.
 */
export function hashControlSecret(rawInput: string): string {
  const cleaned = rawInput.trim().toUpperCase();
  let digest = crypto
    .createHash('sha256')
    .update(`${CONTROL_HASH_SALT}:${cleaned}`, 'utf8')
    .digest('hex');

  for (let r = 1; r < CONTROL_HASH_ROUNDS; r++) {
    digest = crypto
      .createHash('sha256')
      .update(`${CONTROL_HASH_SALT}:${r}:${digest}`, 'utf8')
      .digest('hex');
  }

  return digest;
}

/**
 * Deterministically derives the 100 official control stations (1 = SALIDA, 2..99 = BALIZA, 100 = META)
 * from a secret seed using HMAC-SHA256, ensuring zero secret codes are hardcoded in the repository.
 */
export function generateControlStations(secretSeed?: string): ControlStation[] {
  const effectiveSeed = (
    secretSeed ??
    process.env.CONTROLS_SECRET_SEED ??
    DEFAULT_FALLBACK_SEED
  ).trim();

  const stations: ControlStation[] = [];
  const usedBackupCodes = new Set<string>();

  for (let cardNum = 1; cardNum <= TOTAL_CARDS; cardNum++) {
    const id = String(cardNum);
    let type: ControlType = 'CONTROL';
    let label = `Baliza ${cardNum}`;
    let cardTitle = `BALIZA ${cardNum}`;

    if (cardNum === START_CARD_NUMBER) {
      type = 'START';
      label = 'SALIDA (1)';
      cardTitle = 'SALIDA';
    } else if (cardNum === FINISH_CARD_NUMBER) {
      type = 'FINISH';
      label = 'META (100)';
      cardTitle = 'META';
    }

    let backupCode = '';
    let attempt = 0;

    while (!backupCode) {
      const hmac = crypto
        .createHmac('sha256', effectiveSeed)
        .update(`IES-ALM-CARD-V2:${cardNum}:${attempt}`, 'utf8')
        .digest();

      const candidate =
        UNAMBIGUOUS_ALPHABET[hmac[0] & 31] +
        UNAMBIGUOUS_ALPHABET[hmac[1] & 31] +
        UNAMBIGUOUS_ALPHABET[hmac[2] & 31];

      if (!usedBackupCodes.has(candidate)) {
        usedBackupCodes.add(candidate);
        backupCode = candidate;
      } else {
        attempt++;
      }
    }

    const qrPayload = `ORI:${id}:${backupCode}`;

    stations.push({
      id,
      type,
      label,
      cardTitle,
      qrPayload,
      backupCode,
    });
  }

  return stations;
}

export class InMemoryControlStationRepository implements IControlStationRepository {
  private readonly stations: ControlStation[];

  constructor(secretSeed?: string) {
    this.stations = generateControlStations(secretSeed);
  }

  async findAll(): Promise<ControlStation[]> {
    return this.stations.map((ctrl) => ({ ...ctrl }));
  }
}
