export type ControlType = 'START' | 'CONTROL' | 'FINISH';

export interface ControlStation {
  id: string;          // '1'..'100' ('1' = START, '2'..'99' = CONTROL, '100' = FINISH)
  type: ControlType;
  label: string;       // 'SALIDA (1)', 'Baliza 2'..'Baliza 99', 'META (100)'
  cardTitle: string;   // 'SALIDA', 'BALIZA 2'..'BALIZA 99', 'META'
  qrPayload: string;   // e.g., 'ORI:1:XXX' .. 'ORI:100:ZZZ'
  backupCode: string;  // 3-char unambiguous code derived from secret seed
}
