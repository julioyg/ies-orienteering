#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const val = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(BACKEND_DIR, '.env'));
loadEnvFile(path.join(BACKEND_DIR, '.env.deploy'));

const TOTAL_CARDS = 100;
const START_CARD_NUMBER = 1;
const FINISH_CARD_NUMBER = 100;
const CONTROL_HASH_SALT = 'IES-SIERRA-ALMIJARA-ORI-2026-V2';
const CONTROL_HASH_ROUNDS = 256;
const UNAMBIGUOUS_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const secretSeed = (
  process.env.CONTROLS_SECRET_SEED ||
  'dev-fallback-seed-configure-controls-secret-seed-in-env'
).trim();

function hashControlSecret(rawInput) {
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

const secretStations = [];
const hashedStations = [];
const usedBackupCodes = new Set();

for (let cardNum = 1; cardNum <= TOTAL_CARDS; cardNum++) {
  const id = String(cardNum);
  let type = 'CONTROL';
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
      .createHmac('sha256', secretSeed)
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
  const qrHash = hashControlSecret(qrPayload);
  const backupHash = hashControlSecret(backupCode);

  secretStations.push({
    id,
    type,
    label,
    cardTitle,
    qrPayload,
    backupCode,
  });

  hashedStations.push({
    id,
    type,
    label,
    cardTitle,
    qrHash,
    backupHash,
  });
}

// 1. Write local gitignored secret cards file in backend/data/secret_controls_100.json
const dataDir = path.join(BACKEND_DIR, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const secretJsonPath = path.join(dataDir, 'secret_controls_100.json');
fs.writeFileSync(secretJsonPath, JSON.stringify(secretStations, null, 2) + '\n', 'utf8');

// 2. Write public hashed controls file in src/data/controls.ts (safe for public GitHub repo)
const controlsTsLines = [
  `export type ControlType = 'START' | 'CONTROL' | 'FINISH';`,
  ``,
  `/**`,
  ` * Full control station definition returned ONLY by the authenticated Teacher Portal API`,
  ` * for rendering and printing the physical A4 cards.`,
  ` */`,
  `export interface ControlDefinition {`,
  `  id: string;          // '1'..'100' ('1' = START, '2'..'99' = CONTROL, '100' = FINISH)`,
  `  type: ControlType;`,
  `  label: string;       // 'SALIDA (1)', 'Baliza 2'..'Baliza 99', 'META (100)'`,
  `  cardTitle: string;   // 'SALIDA', 'BALIZA 2'..'BALIZA 99', 'META'`,
  `  qrPayload: string;   // Provided by authenticated teacher backend`,
  `  backupCode: string;  // Provided by authenticated teacher backend`,
  `}`,
  ``,
  `/**`,
  ` * Public control metadata stored in the static offline PWA bundle.`,
  ` * Contains ONLY salted multi-round SHA-256 hashes (zero plaintext secret codes).`,
  ` */`,
  `export interface HashedControlDefinition {`,
  `  id: string;          // '1'..'100'`,
  `  type: ControlType;`,
  `  label: string;`,
  `  cardTitle: string;`,
  `  qrHash: string;      // Salted SHA-256 hash of normalized QR payload`,
  `  backupHash: string;  // Salted SHA-256 hash of normalized 3-char backup code`,
  `}`,
  ``,
  `export const CONTROL_HASH_SALT = '${CONTROL_HASH_SALT}';`,
  `export const CONTROL_HASH_ROUNDS = ${CONTROL_HASH_ROUNDS};`,
  ``,
  `// Pure TypeScript synchronous SHA-256 (FIPS 180-4) for 100% offline browser execution`,
  `const SHA256_K = new Uint32Array([`,
  `  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,`,
  `  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,`,
  `  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,`,
  `  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,`,
  `  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,`,
  `  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,`,
  `  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,`,
  `  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,`,
  `]);`,
  ``,
  `function rotr(x: number, n: number): number {`,
  `  return (x >>> n) | (x << (32 - n));`,
  `}`,
  ``,
  `export function sha256Hex(ascii: string): string {`,
  `  const bytes = new TextEncoder().encode(ascii);`,
  `  const bitLen = bytes.length * 8;`,
  `  const totalWords = (((bytes.length + 8) >>> 6) + 1) << 4;`,
  `  const words = new Uint32Array(totalWords);`,
  ``,
  `  for (let i = 0; i < bytes.length; i++) {`,
  `    words[i >>> 2] |= bytes[i] << (24 - (i & 3) * 8);`,
  `  }`,
  `  words[bytes.length >>> 2] |= 0x80 << (24 - (bytes.length & 3) * 8);`,
  `  words[totalWords - 1] = bitLen >>> 0;`,
  `  words[totalWords - 2] = Math.floor(bitLen / 0x100000000) >>> 0;`,
  ``,
  `  let h0 = 0x6a09e667;`,
  `  let h1 = 0xbb67ae85;`,
  `  let h2 = 0x3c6ef372;`,
  `  let h3 = 0xa54ff53a;`,
  `  let h4 = 0x510e527f;`,
  `  let h5 = 0x9b05688c;`,
  `  let h6 = 0x1f83d9ab;`,
  `  let h7 = 0x5be0cd19;`,
  ``,
  `  const w = new Uint32Array(64);`,
  ``,
  `  for (let offset = 0; offset < totalWords; offset += 16) {`,
  `    for (let i = 0; i < 16; i++) {`,
  `      w[i] = words[offset + i];`,
  `    }`,
  `    for (let i = 16; i < 64; i++) {`,
  `      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);`,
  `      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);`,
  `      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;`,
  `    }`,
  ``,
  `    let a = h0;`,
  `    let b = h1;`,
  `    let c = h2;`,
  `    let d = h3;`,
  `    let e = h4;`,
  `    let f = h5;`,
  `    let g = h6;`,
  `    let h = h7;`,
  ``,
  `    for (let i = 0; i < 64; i++) {`,
  `      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);`,
  `      const ch = (e & f) ^ (~e & g);`,
  `      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;`,
  `      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);`,
  `      const maj = (a & b) ^ (a & c) ^ (b & c);`,
  `      const temp2 = (S0 + maj) >>> 0;`,
  ``,
  `      h = g;`,
  `      g = f;`,
  `      f = e;`,
  `      e = (d + temp1) >>> 0;`,
  `      d = c;`,
  `      c = b;`,
  `      b = a;`,
  `      a = (temp1 + temp2) >>> 0;`,
  `    }`,
  ``,
  `    h0 = (h0 + a) >>> 0;`,
  `    h1 = (h1 + b) >>> 0;`,
  `    h2 = (h2 + c) >>> 0;`,
  `    h3 = (h3 + d) >>> 0;`,
  `    h4 = (h4 + e) >>> 0;`,
  `    h5 = (h5 + f) >>> 0;`,
  `    h6 = (h6 + g) >>> 0;`,
  `    h7 = (h7 + h) >>> 0;`,
  `  }`,
  ``,
  `  return [h0, h1, h2, h3, h4, h5, h6, h7]`,
  `    .map((v) => v.toString(16).padStart(8, '0'))`,
  `    .join('');`,
  `}`,
  ``,
  `export function hashControlSecret(rawInput: string): string {`,
  `  const cleaned = rawInput.trim().toUpperCase();`,
  `  let digest = sha256Hex(\`\${CONTROL_HASH_SALT}:\${cleaned}\`);`,
  `  for (let r = 1; r < CONTROL_HASH_ROUNDS; r++) {`,
  `    digest = sha256Hex(\`\${CONTROL_HASH_SALT}:\${r}:\${digest}\`);`,
  `  }`,
  `  return digest;`,
  `}`,
  ``,
  `export const OFFICIAL_CONTROLS: HashedControlDefinition[] = [`,
  ...hashedStations.map(
    (s) =>
      `  { id: '${s.id}', type: '${s.type}', label: '${s.label}', cardTitle: '${s.cardTitle}', qrHash: '${s.qrHash}', backupHash: '${s.backupHash}' },`
  ),
  `];`,
  ``,
  `const BY_QR_HASH = new Map<string, HashedControlDefinition>(`,
  `  OFFICIAL_CONTROLS.map((ctrl) => [ctrl.qrHash, ctrl])`,
  `);`,
  ``,
  `const BY_BACKUP_HASH = new Map<string, HashedControlDefinition>(`,
  `  OFFICIAL_CONTROLS.map((ctrl) => [ctrl.backupHash, ctrl])`,
  `);`,
  ``,
  `/**`,
  ` * Resolves either a full QR payload (e.g. "ORI:1:XXX") or a 3-character manual backup code`,
  ` * into its official HashedControlDefinition by comparing salted SHA-256 hashes.`,
  ` */`,
  `export function resolveControlInput(rawInput: string, mode: 'QR' | 'MANUAL'): HashedControlDefinition | null {`,
  `  const cleaned = rawInput.trim().toUpperCase();`,
  `  if (!cleaned) return null;`,
  ``,
  `  const inputHash = hashControlSecret(cleaned);`,
  ``,
  `  if (mode === 'QR') {`,
  `    return BY_QR_HASH.get(inputHash) ?? BY_BACKUP_HASH.get(inputHash) ?? null;`,
  `  }`,
  ``,
  `  return BY_BACKUP_HASH.get(inputHash) ?? BY_QR_HASH.get(inputHash) ?? null;`,
  `}`,
  ``,
];

const controlsTsPath = path.join(ROOT_DIR, 'src/data/controls.ts');
fs.writeFileSync(controlsTsPath, controlsTsLines.join('\n'), 'utf8');

console.log(`✅ Generadas ${secretStations.length} tarjetas (1 = SALIDA, 2..99 = BALIZAS, 100 = META).`);
console.log(`🔒 Copia local secreta (ignorada por Git): ${secretJsonPath}`);
console.log(`🛡️ Hashes públicos actualizados en:        ${controlsTsPath}`);
