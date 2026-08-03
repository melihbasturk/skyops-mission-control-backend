import { MissionStatus } from './mission.enums';

const allowedTransitions: Record<MissionStatus, MissionStatus[]> = {
  [MissionStatus.PLANNED]: [MissionStatus.PRE_FLIGHT_CHECK, MissionStatus.ABORTED],
  [MissionStatus.PRE_FLIGHT_CHECK]: [MissionStatus.IN_PROGRESS, MissionStatus.ABORTED],
  [MissionStatus.IN_PROGRESS]: [MissionStatus.COMPLETED, MissionStatus.ABORTED],
  [MissionStatus.COMPLETED]: [],
  [MissionStatus.ABORTED]: [],
};

export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}
