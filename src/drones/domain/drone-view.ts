import { Drone } from '../entities/drone.entity';
import { resolveMaintenanceState } from './maintenance-policy';

export function toDroneView(drone: Drone, todayUtc: string) {
  const maintenance = resolveMaintenanceState({
    persistedStatus: drone.status,
    totalFlightHours: drone.totalFlightHours,
    flightHoursAtLastMaintenance: drone.flightHoursAtLastMaintenance,
    nextMaintenanceDueDate: drone.nextMaintenanceDueDate,
    todayUtc,
  });

  return {
    id: drone.id,
    serialNumber: drone.serialNumber,
    model: drone.model,
    status: maintenance.effectiveStatus,
    totalFlightHours: drone.totalFlightHours,
    lastMaintenanceDate: drone.lastMaintenanceDate,
    flightHoursAtLastMaintenance: drone.flightHoursAtLastMaintenance,
    nextMaintenanceDueDate: drone.nextMaintenanceDueDate,
    registeredAt: drone.registeredAt,
    updatedAt: drone.updatedAt,
    maintenanceCondition: maintenance.condition,
    maintenanceDueReasons: maintenance.reasons,
    hoursSinceMaintenance: maintenance.hoursSinceMaintenance,
  };
}
