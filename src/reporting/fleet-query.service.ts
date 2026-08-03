import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Decimal from 'decimal.js';
import { Between, In, Repository } from 'typeorm';
import { ClockService } from '../common/time/clock.service';
import { DroneStatus, MaintenanceCondition } from '../drones/domain/drone.enums';
import { toDroneView } from '../drones/domain/drone-view';
import { Drone } from '../drones/entities/drone.entity';
import { MissionStatus, NON_TERMINAL_MISSION_STATUSES, TERMINAL_MISSION_STATUSES } from '../missions/domain/mission.enums';
import { Mission } from '../missions/entities/mission.entity';

@Injectable()
export class FleetQueryService {
  constructor(
    @InjectRepository(Drone) private readonly drones: Repository<Drone>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    private readonly clock: ClockService,
  ) {}

  private async fleetSnapshot() {
    return (await this.drones.find()).map((drone) => toDroneView(drone, this.clock.todayUtc()));
  }

  private statusCounts(fleet: Awaited<ReturnType<FleetQueryService['fleetSnapshot']>>) {
    return Object.values(DroneStatus).reduce<Record<DroneStatus, number>>((counts, status) => {
      counts[status] = fleet.filter((drone) => drone.status === status).length;
      return counts;
    }, {} as Record<DroneStatus, number>);
  }

  async dashboard() {
    const now = this.clock.now();
    const sevenDaysAhead = new Date(now.getTime() + 7 * 86_400_000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const fleet = await this.fleetSnapshot();
    const operational = fleet.filter((drone) => drone.status !== DroneStatus.RETIRED);
    const [upcomingMissions, recentMissions] = await Promise.all([
      this.missions.find({
        where: { status: In(NON_TERMINAL_MISSION_STATUSES), plannedStartAt: Between(now, sevenDaysAhead) },
        relations: { drone: true }, order: { plannedStartAt: 'ASC', id: 'ASC' }, take: 10,
      }),
      this.missions.find({
        where: { status: In(TERMINAL_MISSION_STATUSES), terminalAt: Between(sevenDaysAgo, now) },
        relations: { drone: true }, order: { terminalAt: 'DESC', id: 'ASC' }, take: 10,
      }),
    ]);
    return {
      fleetByStatus: this.statusCounts(fleet),
      maintenanceAlerts: {
        upcoming: operational.filter((drone) => [MaintenanceCondition.UPCOMING, MaintenanceCondition.DUE].includes(drone.maintenanceCondition)),
        overdue: operational.filter((drone) => drone.maintenanceCondition === MaintenanceCondition.OVERDUE),
      },
      missions: {
        upcoming: upcomingMissions.map((mission) => ({
          ...mission, drone: toDroneView(mission.drone, this.clock.todayUtc()),
        })),
        recent: recentMissions.map((mission) => ({
          ...mission, drone: toDroneView(mission.drone, this.clock.todayUtc()),
        })),
      },
    };
  }

  async fleetHealth() {
    const now = this.clock.now();
    const next24Hours = new Date(now.getTime() + 86_400_000);
    const fleet = await this.fleetSnapshot();
    const operational = fleet.filter((drone) => drone.status !== DroneStatus.RETIRED);
    const missionsNext24Hours = await this.missions.count({
      where: {
        status: In([MissionStatus.PLANNED, MissionStatus.PRE_FLIGHT_CHECK]),
        plannedStartAt: Between(now, next24Hours),
      },
    });
    const totalHours = operational.reduce((total, drone) => total.plus(drone.totalFlightHours), new Decimal(0));
    return {
      totalDroneCount: fleet.length,
      countByStatus: this.statusCounts(fleet),
      overdueMaintenance: operational.filter((drone) => drone.maintenanceCondition === MaintenanceCondition.OVERDUE),
      missionsNext24Hours,
      averageFlightHours: operational.length === 0 ? 0 : totalHours.dividedBy(operational.length).toDecimalPlaces(2).toNumber(),
    };
  }
}
