import { MissionStatus } from './mission.enums';
import { canTransition, intervalsOverlap } from './mission-policy';

describe('mission policy', () => {
  const d = (hour: number) => new Date(`2026-01-01T${String(hour).padStart(2, '0')}:00:00.000Z`);

  it.each([
    [MissionStatus.PLANNED, MissionStatus.PRE_FLIGHT_CHECK],
    [MissionStatus.PRE_FLIGHT_CHECK, MissionStatus.IN_PROGRESS],
    [MissionStatus.IN_PROGRESS, MissionStatus.COMPLETED],
    [MissionStatus.PLANNED, MissionStatus.ABORTED],
    [MissionStatus.PRE_FLIGHT_CHECK, MissionStatus.ABORTED],
    [MissionStatus.IN_PROGRESS, MissionStatus.ABORTED],
  ])('allows %s -> %s', (from, to) => expect(canTransition(from, to)).toBe(true));

  it('rejects every outgoing terminal transition', () => {
    for (const target of Object.values(MissionStatus)) {
      expect(canTransition(MissionStatus.COMPLETED, target)).toBe(false);
      expect(canTransition(MissionStatus.ABORTED, target)).toBe(false);
    }
  });

  it('rejects every transition not in the approved state machine', () => {
    const allowed = new Set([
      'PLANNED:PRE_FLIGHT_CHECK', 'PLANNED:ABORTED',
      'PRE_FLIGHT_CHECK:IN_PROGRESS', 'PRE_FLIGHT_CHECK:ABORTED',
      'IN_PROGRESS:COMPLETED', 'IN_PROGRESS:ABORTED',
    ]);
    for (const from of Object.values(MissionStatus)) {
      for (const to of Object.values(MissionStatus)) {
        expect(canTransition(from, to)).toBe(allowed.has(`${from}:${to}`));
      }
    }
  });

  it.each([
    ['duplicate', d(10), d(12), d(10), d(12), true],
    ['partial start', d(10), d(12), d(9), d(11), true],
    ['partial end', d(10), d(12), d(11), d(13), true],
    ['new inside', d(10), d(14), d(11), d(13), true],
    ['existing inside', d(11), d(13), d(10), d(14), true],
    ['adjacent', d(10), d(12), d(12), d(14), false],
  ])('%s overlap is %s', (_name, a, b, c, e, expected) => {
    expect(intervalsOverlap(a as Date, b as Date, c as Date, e as Date)).toBe(expected);
  });
});
