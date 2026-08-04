import { In } from 'typeorm';
import AppDataSource from '../database/data-source';
import { DroneModel, DroneStatus } from '../drones/domain/drone.enums';
import { nextMaintenanceDate } from '../drones/domain/maintenance-policy';
import { Drone } from '../drones/entities/drone.entity';
import { MaintenanceLog } from '../maintenance/entities/maintenance-log.entity';
import { MaintenanceType } from '../maintenance/maintenance.enums';
import { MissionStatus, MissionType } from '../missions/domain/mission.enums';
import { Mission } from '../missions/entities/mission.entity';

const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const droneIds = Array.from({ length: 24 }, (_, index) => id(index + 1));
const missionIds = Array.from({ length: 60 }, (_, index) => id(1001 + index));
const logIds = Array.from({ length: 36 }, (_, index) => id(2001 + index));

const day = (offset: number): Date => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + offset);
  value.setUTCMinutes(0, 0, 0);
  return value;
};
const dateOnly = (offset: number): string => day(offset).toISOString().slice(0, 10);

function buildMissions(): Mission[] {
  const rows: Partial<Mission>[] = [];
  const types = Object.values(MissionType);
  const base = (index: number, status: MissionStatus, droneIndex: number, startOffset: number): Partial<Mission> => ({
    id: missionIds[index],
    name: `Mission ${String(index + 1).padStart(2, '0')}`,
    type: types[index % types.length],
    droneId: droneIds[droneIndex],
    pilotName: `Pilot ${(index % 8) + 1}`,
    siteLocation: `European Site ${(index % 12) + 1}`,
    plannedStartAt: day(startOffset),
    plannedEndAt: new Date(day(startOffset).getTime() + 2 * 3_600_000),
    status,
    actualStartAt: null,
    actualEndAt: null,
    terminalAt: null,
    flightHours: null,
    abortReason: null,
  });

  for (let i = 0; i < 18; i++) rows.push(base(i, MissionStatus.PLANNED, i % 10, 1 + i));
  for (let i = 18; i < 26; i++) rows.push(base(i, MissionStatus.PRE_FLIGHT_CHECK, i % 10, 4 + i));
  for (let i = 26; i < 28; i++) {
    const row = base(i, MissionStatus.IN_PROGRESS, 10 + (i - 26), 0);
    row.plannedStartAt = new Date(Date.now() - 3_600_000);
    row.plannedEndAt = new Date(Date.now() + 3_600_000);
    row.actualStartAt = new Date(Date.now() - 30 * 60_000);
    rows.push(row);
  }
  for (let i = 28; i < 52; i++) {
    const row = base(i, MissionStatus.COMPLETED, i % 20, -(i - 27));
    row.actualStartAt = row.plannedStartAt;
    row.actualEndAt = new Date(row.plannedStartAt!.getTime() + 90 * 60_000);
    row.terminalAt = row.actualEndAt;
    row.flightHours = 1 + (i % 4) * 0.25;
    rows.push(row);
  }
  for (let i = 52; i < 60; i++) {
    const row = base(i, MissionStatus.ABORTED, i % 20, -(i - 51));
    row.abortReason = i % 2 === 0 ? 'Weather conditions exceeded safe limits.' : 'Equipment check required.';
    row.terminalAt = new Date(row.plannedStartAt!.getTime() + 30 * 60_000);
    if (i >= 56) {
      row.actualStartAt = row.plannedStartAt;
      row.actualEndAt = row.terminalAt;
      row.flightHours = 0.5 + (i % 2) * 0.25;
    }
    rows.push(row);
  }
  return rows as Mission[];
}

function buildDrones(missions: Mission[]): Drone[] {
  const appliedHours = new Map<string, number>();
  for (const mission of missions) {
    if (mission.flightHours) appliedHours.set(mission.droneId, (appliedHours.get(mission.droneId) ?? 0) + mission.flightHours);
  }
  const models = Object.values(DroneModel);
  return droneIds.map((droneId, index) => {
    const missionHours = appliedHours.get(droneId) ?? 0;
    const total = 100 + index * 7 + missionHours;
    let status = DroneStatus.AVAILABLE;
    let lastMaintenanceDate = dateOnly(-30);
    let baseline = total - Math.min(20, 5 + missionHours);

    if (index < 3) lastMaintenanceDate = dateOnly(-84 - index);
    if (index >= 10 && index < 12) status = DroneStatus.IN_MISSION;
    if (index >= 12 && index < 20) {
      status = DroneStatus.MAINTENANCE;
      if (index < 14) baseline = total - 5;
      else if (index < 16) baseline = total - 50;
      else if (index < 18) {
        baseline = total - 10;
        lastMaintenanceDate = dateOnly(-100);
      } else {
        baseline = total - 55;
        lastMaintenanceDate = dateOnly(-100);
      }
    }
    if (index >= 20) status = DroneStatus.RETIRED;

    return {
      id: droneId,
      serialNumber: `SKY-${String(index + 1).padStart(4, '0')}-DEMO`,
      model: models[index % models.length],
      status,
      totalFlightHours: Number(total.toFixed(2)),
      lastMaintenanceDate,
      flightHoursAtLastMaintenance: Number(baseline.toFixed(2)),
      nextMaintenanceDueDate: nextMaintenanceDate(lastMaintenanceDate),
      registeredAt: day(-365 - index),
      updatedAt: new Date(),
    } as Drone;
  });
}

function buildMaintenanceLogs(drones: Drone[]): MaintenanceLog[] {
  const types = Object.values(MaintenanceType);
  return logIds.map((logId, index) => {
    const drone = drones[index % 18];
    const latest = index >= 18;
    return {
      id: logId,
      droneId: drone.id,
      type: types[index % types.length],
      technicianName: `Technician ${(index % 6) + 1}`,
      notes: latest ? 'Completed scheduled maintenance and operational checks.' : 'Historical maintenance record.',
      performedOn: latest ? drone.lastMaintenanceDate : dateOnly(-180 - (index % 15)),
      flightHoursAtMaintenance: latest
        ? drone.flightHoursAtLastMaintenance
        : Math.max(0, Number((drone.flightHoursAtLastMaintenance - 40).toFixed(2))),
      recordedAt: latest ? day(-20) : day(-170),
    } as MaintenanceLog;
  });
}

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const missions = buildMissions();
    const drones = buildDrones(missions);
    const logs = buildMaintenanceLogs(drones);
    await AppDataSource.transaction(async (manager) => {
      await manager.getRepository(MaintenanceLog).delete({ id: In(logIds) });
      await manager.getRepository(Mission).delete({ id: In(missionIds) });
      await manager.getRepository(Drone).delete({ id: In(droneIds) });
      await manager.getRepository(Drone).insert(drones);
      await manager.getRepository(Mission).insert(missions);
      await manager.getRepository(MaintenanceLog).insert(logs);
    });
    console.log(`Seed complete: ${drones.length} drones, ${missions.length} missions, ${logs.length} maintenance logs.`);
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
