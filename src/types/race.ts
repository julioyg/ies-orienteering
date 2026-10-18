export type RaceStage = 'REGISTRATION' | 'READY_TO_START' | 'IN_RACE' | 'FINISHED';

export type PunchMethod = 'QR' | 'MANUAL';

export interface Punch {
  controlCode: string; // e.g., "31"
  timestamp: number;   // Date.now()
  splitMs: number;     // time since previous punch (or startTime for first control)
  cumulativeMs: number;// time since startTime
  method: PunchMethod; // 📷 if scanned via camera, ⌨️ if typed via backup code
}

export interface RaceState {
  stage: RaceStage;
  runnerName: string;
  group: string;
  mapNumber: string;
  startTime: number | null;
  startMethod?: PunchMethod;
  finishTime: number | null;
  finishMethod?: PunchMethod;
  punches: Punch[];
}

export const STORAGE_KEY = 'ies_orienteering_state_v1';

export const INITIAL_RACE_STATE: RaceState = {
  stage: 'REGISTRATION',
  runnerName: '',
  group: '',
  mapNumber: '',
  startTime: null,
  finishTime: null,
  punches: [],
};
