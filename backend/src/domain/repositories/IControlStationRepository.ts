import { ControlStation } from '../entities/ControlStation.js';

export interface IControlStationRepository {
  findAll(): Promise<ControlStation[]>;
}
