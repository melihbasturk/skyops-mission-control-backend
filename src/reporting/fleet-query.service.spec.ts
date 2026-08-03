import { Repository } from 'typeorm';
import { ClockService } from '../common/time/clock.service';
import { DroneModel, DroneStatus } from '../drones/domain/drone.enums';
import { Drone } from '../drones/entities/drone.entity';
import { Mission } from '../missions/entities/mission.entity';
import { FleetQueryService } from './fleet-query.service';

describe('fleet health query', () => {
  const clock = { now: () => new Date('2026-01-01T12:00:00Z'), todayUtc: () => '2026-01-01' } as ClockService;
  const base = (id: string, status: DroneStatus, hours: number): Drone => ({
    id, serialNumber: `SKY-${id.padStart(4, '0')}-TEST`, model: DroneModel.MATRICE_300,
    status, totalFlightHours: hours, lastMaintenanceDate: '2025-12-01',
    flightHoursAtLastMaintenance: hours, nextMaintenanceDueDate: '2026-03-01',
    registeredAt: new Date(), updatedAt: new Date(), missions: [], maintenanceLogs: [],
  });

  it('includes retired counts but excludes retired hours from the average', async () => {
    const droneRepo = { find: jest.fn().mockResolvedValue([
      base('1', DroneStatus.AVAILABLE, 10), base('2', DroneStatus.RETIRED, 100),
    ]) } as unknown as Repository<Drone>;
    const missionRepo = { count: jest.fn().mockResolvedValue(0) } as unknown as Repository<Mission>;
    const result = await new FleetQueryService(droneRepo, missionRepo, clock).fleetHealth();
    expect(result.totalDroneCount).toBe(2);
    expect(result.countByStatus.RETIRED).toBe(1);
    expect(result.averageFlightHours).toBe(10);
  });

  it('returns zero for an empty operational fleet', async () => {
    const droneRepo = { find: jest.fn().mockResolvedValue([base('2', DroneStatus.RETIRED, 100)]) } as unknown as Repository<Drone>;
    const missionRepo = { count: jest.fn().mockResolvedValue(0) } as unknown as Repository<Mission>;
    const result = await new FleetQueryService(droneRepo, missionRepo, clock).fleetHealth();
    expect(result.averageFlightHours).toBe(0);
  });
});
