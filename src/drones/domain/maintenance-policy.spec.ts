import { DroneStatus, MaintenanceCondition } from './drone.enums';
import { nextMaintenanceDate, resolveMaintenanceState } from './maintenance-policy';

describe('maintenance policy', () => {
  const state = (hours: number, todayUtc: string) => resolveMaintenanceState({
    persistedStatus: DroneStatus.AVAILABLE,
    totalFlightHours: 100 + hours,
    flightHoursAtLastMaintenance: 100,
    nextMaintenanceDueDate: '2026-04-01',
    todayUtc,
  });

  it('calculates exactly ninety calendar days', () => {
    expect(nextMaintenanceDate('2026-01-01')).toBe('2026-04-01');
  });

  it.each([
    [49.99, '2026-03-31', DroneStatus.AVAILABLE, MaintenanceCondition.UPCOMING],
    [50, '2026-03-31', DroneStatus.MAINTENANCE, MaintenanceCondition.OVERDUE],
    [50.01, '2026-03-31', DroneStatus.MAINTENANCE, MaintenanceCondition.OVERDUE],
    [0, '2026-04-01', DroneStatus.MAINTENANCE, MaintenanceCondition.DUE],
    [0, '2026-04-02', DroneStatus.MAINTENANCE, MaintenanceCondition.OVERDUE],
  ])('resolves hours=%s date=%s', (hours, date, status, condition) => {
    const result = state(hours as number, date as string);
    expect(result.effectiveStatus).toBe(status);
    expect(result.condition).toBe(condition);
  });

  it('keeps retired status as the highest precedence', () => {
    const result = resolveMaintenanceState({
      persistedStatus: DroneStatus.RETIRED,
      totalFlightHours: 100,
      flightHoursAtLastMaintenance: 0,
      nextMaintenanceDueDate: '2020-01-01',
      todayUtc: '2026-01-01',
    });
    expect(result.effectiveStatus).toBe(DroneStatus.RETIRED);
  });

  it('reports both due reasons when both thresholds are reached', () => {
    const result = state(50, '2026-04-02');
    expect(result.reasons).toEqual(['HOURS', 'DATE']);
    expect(result.overdueByHours).toBe(true);
    expect(result.overdueByDate).toBe(true);
  });

  it('uses an inclusive seven-day upcoming window', () => {
    expect(state(0, '2026-03-25').condition).toBe(MaintenanceCondition.UPCOMING);
    expect(state(0, '2026-03-24').condition).toBe(MaintenanceCondition.NONE);
  });

  it('keeps in-mission status ahead of a due maintenance condition', () => {
    const result = resolveMaintenanceState({
      persistedStatus: DroneStatus.IN_MISSION,
      totalFlightHours: 50,
      flightHoursAtLastMaintenance: 0,
      nextMaintenanceDueDate: '2020-01-01',
      todayUtc: '2026-01-01',
    });
    expect(result.effectiveStatus).toBe(DroneStatus.IN_MISSION);
    expect(result.condition).toBe(MaintenanceCondition.OVERDUE);
  });
});
