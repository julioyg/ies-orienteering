import { ControlStation } from '../../domain/entities/ControlStation.js';
import { IControlStationRepository } from '../../domain/repositories/IControlStationRepository.js';

export class GetControlsForTeacherUseCase {
  constructor(private readonly controlRepository: IControlStationRepository) {}

  async execute(): Promise<ControlStation[]> {
    return this.controlRepository.findAll();
  }
}
