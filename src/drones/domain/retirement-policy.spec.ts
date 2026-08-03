import { MissionStatus } from '../../missions/domain/mission.enums';
import { isRetirementBlocked } from './retirement-policy';

describe('retirement policy', () => {
  it.each([MissionStatus.PLANNED, MissionStatus.PRE_FLIGHT_CHECK, MissionStatus.IN_PROGRESS])(
    'blocks %s missions',
    (status) => expect(isRetirementBlocked([status])).toBe(true),
  );

  it('allows terminal history and an empty history', () => {
    expect(isRetirementBlocked([])).toBe(false);
    expect(isRetirementBlocked([MissionStatus.COMPLETED, MissionStatus.ABORTED])).toBe(false);
  });
});
