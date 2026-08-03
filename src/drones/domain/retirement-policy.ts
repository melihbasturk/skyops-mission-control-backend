import { MissionStatus, NON_TERMINAL_MISSION_STATUSES } from '../../missions/domain/mission.enums';

export function isRetirementBlocked(statuses: MissionStatus[]): boolean {
  return statuses.some((status) => NON_TERMINAL_MISSION_STATUSES.includes(status));
}
