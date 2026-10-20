import { ControlStation } from '../../domain/entities/ControlStation.js';
import { IControlStationRepository } from '../../domain/repositories/IControlStationRepository.js';

export const OFFICIAL_CONTROL_STATIONS: ControlStation[] = [
  { id: 'START', type: 'START', label: 'SALIDA', cardTitle: 'SALIDA', qrPayload: 'ORI:START:S7X', backupCode: 'S7X' },
  { id: '31', type: 'CONTROL', label: 'Baliza 31', cardTitle: 'BALIZA 31', qrPayload: 'ORI:31:K3P', backupCode: 'K3P' },
  { id: '32', type: 'CONTROL', label: 'Baliza 32', cardTitle: 'BALIZA 32', qrPayload: 'ORI:32:R8W', backupCode: 'R8W' },
  { id: '33', type: 'CONTROL', label: 'Baliza 33', cardTitle: 'BALIZA 33', qrPayload: 'ORI:33:T4N', backupCode: 'T4N' },
  { id: '34', type: 'CONTROL', label: 'Baliza 34', cardTitle: 'BALIZA 34', qrPayload: 'ORI:34:B6M', backupCode: 'B6M' },
  { id: '35', type: 'CONTROL', label: 'Baliza 35', cardTitle: 'BALIZA 35', qrPayload: 'ORI:35:H2V', backupCode: 'H2V' },
  { id: '36', type: 'CONTROL', label: 'Baliza 36', cardTitle: 'BALIZA 36', qrPayload: 'ORI:36:J9C', backupCode: 'J9C' },
  { id: '37', type: 'CONTROL', label: 'Baliza 37', cardTitle: 'BALIZA 37', qrPayload: 'ORI:37:L5D', backupCode: 'L5D' },
  { id: '38', type: 'CONTROL', label: 'Baliza 38', cardTitle: 'BALIZA 38', qrPayload: 'ORI:38:P7F', backupCode: 'P7F' },
  { id: '39', type: 'CONTROL', label: 'Baliza 39', cardTitle: 'BALIZA 39', qrPayload: 'ORI:39:Q3G', backupCode: 'Q3G' },
  { id: '40', type: 'CONTROL', label: 'Baliza 40', cardTitle: 'BALIZA 40', qrPayload: 'ORI:40:W8K', backupCode: 'W8K' },
  { id: '41', type: 'CONTROL', label: 'Baliza 41', cardTitle: 'BALIZA 41', qrPayload: 'ORI:41:X4L', backupCode: 'X4L' },
  { id: '42', type: 'CONTROL', label: 'Baliza 42', cardTitle: 'BALIZA 42', qrPayload: 'ORI:42:Y6N', backupCode: 'Y6N' },
  { id: '43', type: 'CONTROL', label: 'Baliza 43', cardTitle: 'BALIZA 43', qrPayload: 'ORI:43:Z2P', backupCode: 'Z2P' },
  { id: '44', type: 'CONTROL', label: 'Baliza 44', cardTitle: 'BALIZA 44', qrPayload: 'ORI:44:C9R', backupCode: 'C9R' },
  { id: '45', type: 'CONTROL', label: 'Baliza 45', cardTitle: 'BALIZA 45', qrPayload: 'ORI:45:D5T', backupCode: 'D5T' },
  { id: '46', type: 'CONTROL', label: 'Baliza 46', cardTitle: 'BALIZA 46', qrPayload: 'ORI:46:F7V', backupCode: 'F7V' },
  { id: '47', type: 'CONTROL', label: 'Baliza 47', cardTitle: 'BALIZA 47', qrPayload: 'ORI:47:G3W', backupCode: 'G3W' },
  { id: '48', type: 'CONTROL', label: 'Baliza 48', cardTitle: 'BALIZA 48', qrPayload: 'ORI:48:M8X', backupCode: 'M8X' },
  { id: '49', type: 'CONTROL', label: 'Baliza 49', cardTitle: 'BALIZA 49', qrPayload: 'ORI:49:N4Y', backupCode: 'N4Y' },
  { id: '50', type: 'CONTROL', label: 'Baliza 50', cardTitle: 'BALIZA 50', qrPayload: 'ORI:50:V6Z', backupCode: 'V6Z' },
  { id: 'FINISH', type: 'FINISH', label: 'META', cardTitle: 'META', qrPayload: 'ORI:FINISH:M9Z', backupCode: 'M9Z' },
];

export class InMemoryControlStationRepository implements IControlStationRepository {
  async findAll(): Promise<ControlStation[]> {
    return OFFICIAL_CONTROL_STATIONS.map((ctrl) => ({ ...ctrl }));
  }
}
