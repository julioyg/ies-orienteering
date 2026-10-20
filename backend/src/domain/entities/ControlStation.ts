export type ControlType = 'START' | 'CONTROL' | 'FINISH';

export interface ControlStation {
  id: string;          // 'START', '31'..'50', 'FINISH'
  type: ControlType;
  label: string;       // 'SALIDA', 'Baliza 31', 'META'
  cardTitle: string;   // 'SALIDA', 'BALIZA 31', 'META'
  qrPayload: string;   // e.g., 'ORI:31:K3P'
  backupCode: string;  // e.g., 'K3P'
}
