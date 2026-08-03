import Decimal from 'decimal.js';
import { DroneStatus, MaintenanceCondition } from './drone.enums';

export const MAINTENANCE_HOUR_INTERVAL = new Decimal(50);
export const MAINTENANCE_DAY_INTERVAL = 90;
export const MAINTENANCE_ALERT_DAYS = 7;
export const MAINTENANCE_HOUR_TOLERANCE = new Decimal(0.1);

export interface MaintenanceStateInput {
  persistedStatus: DroneStatus;
  totalFlightHours: number;
  flightHoursAtLastMaintenance: number;
  nextMaintenanceDueDate: string;
  todayUtc: string;
}

export interface MaintenanceState {
  effectiveStatus: DroneStatus;
  condition: MaintenanceCondition;
  dueByHours: boolean;
  dueByDate: boolean;
  overdueByHours: boolean;
  overdueByDate: boolean;
  hoursSinceMaintenance: number;
  reasons: Array<'HOURS' | 'DATE'>;
}

function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nextMaintenanceDate(performedOn: string): string {
  return addUtcDays(performedOn, MAINTENANCE_DAY_INTERVAL);
}

export function resolveMaintenanceState(input: MaintenanceStateInput): MaintenanceState {
  const hours = new Decimal(input.totalFlightHours).minus(input.flightHoursAtLastMaintenance);
  const dueByHours = hours.greaterThanOrEqualTo(MAINTENANCE_HOUR_INTERVAL);
  const dueByDate = input.todayUtc >= input.nextMaintenanceDueDate;
  const overdueByDate = input.todayUtc > input.nextMaintenanceDueDate;
  const alertEnd = addUtcDays(input.todayUtc, MAINTENANCE_ALERT_DAYS);
  const upcoming = input.nextMaintenanceDueDate >= input.todayUtc && input.nextMaintenanceDueDate <= alertEnd;
  const reasons: Array<'HOURS' | 'DATE'> = [];
  if (dueByHours) reasons.push('HOURS');
  if (dueByDate) reasons.push('DATE');

  let condition = MaintenanceCondition.NONE;
  if (dueByHours || overdueByDate) condition = MaintenanceCondition.OVERDUE;
  else if (dueByDate) condition = MaintenanceCondition.DUE;
  else if (upcoming) condition = MaintenanceCondition.UPCOMING;

  let effectiveStatus = input.persistedStatus;
  if (input.persistedStatus !== DroneStatus.RETIRED && input.persistedStatus !== DroneStatus.IN_MISSION) {
    effectiveStatus = input.persistedStatus === DroneStatus.MAINTENANCE || dueByHours || dueByDate
      ? DroneStatus.MAINTENANCE
      : DroneStatus.AVAILABLE;
  }

  return {
    effectiveStatus,
    condition,
    dueByHours,
    dueByDate,
    overdueByHours: dueByHours,
    overdueByDate,
    hoursSinceMaintenance: hours.toDecimalPlaces(2).toNumber(),
    reasons,
  };
}
