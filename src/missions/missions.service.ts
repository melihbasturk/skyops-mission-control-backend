import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { domainError } from '../common/domain/domain-error';
import { addHours } from '../common/numeric/decimal';
import { paginated } from '../common/pagination/pagination.dto';
import { ClockService } from '../common/time/clock.service';
import { DroneStatus } from '../drones/domain/drone.enums';
import { resolveMaintenanceState } from '../drones/domain/maintenance-policy';
import { toDroneView } from '../drones/domain/drone-view';
import { Drone } from '../drones/entities/drone.entity';
import { AbortMissionDto } from './dto/abort-mission.dto';
import { CompleteMissionDto } from './dto/complete-mission.dto';
import { CreateMissionDto } from './dto/create-mission.dto';
import { ListMissionsDto } from './dto/list-missions.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { MissionStatus, NON_TERMINAL_MISSION_STATUSES } from './domain/mission.enums';
import { canTransition } from './domain/mission-policy';
import { Mission } from './entities/mission.entity';

@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  private translateDatabaseError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driver = error.driverError as { code?: string; constraint?: string };
      if (driver.code === '23P01' && driver.constraint === 'ex_missions_drone_schedule') {
        throw domainError.conflict('MISSION_OVERLAP', 'The drone already has a mission in the requested time range.');
      }
    }
    throw error;
  }

  private validateSchedule(start: Date, end: Date, requireFuture = true): void {
    if (end <= start) throw domainError.unprocessable('INVALID_MISSION_SCHEDULE', 'Planned end must be later than planned start.');
    if (requireFuture && start < this.clock.now()) {
      throw domainError.unprocessable('INVALID_MISSION_SCHEDULE', 'Missions cannot be scheduled in the past.');
    }
  }

  private async lockDrone(manager: EntityManager, id: string): Promise<Drone> {
    const drone = await manager.getRepository(Drone).createQueryBuilder('drone')
      .setLock('pessimistic_write').where('drone.id = :id', { id }).getOne();
    if (!drone) throw domainError.notFound('drone');
    return drone;
  }

  private effectiveStatus(drone: Drone): DroneStatus {
    return resolveMaintenanceState({
      persistedStatus: drone.status,
      totalFlightHours: drone.totalFlightHours,
      flightHoursAtLastMaintenance: drone.flightHoursAtLastMaintenance,
      nextMaintenanceDueDate: drone.nextMaintenanceDueDate,
      todayUtc: this.clock.todayUtc(),
    }).effectiveStatus;
  }

  private ensureAvailable(drone: Drone): void {
    if (this.effectiveStatus(drone) !== DroneStatus.AVAILABLE) {
      throw domainError.conflict('DRONE_UNAVAILABLE', 'Only an available drone can be assigned or started.');
    }
  }

  private async ensureNoOverlap(
    manager: EntityManager,
    droneId: string,
    start: Date,
    end: Date,
    excludeId?: string,
  ): Promise<void> {
    const qb = manager.getRepository(Mission).createQueryBuilder('mission')
      .where('mission.droneId = :droneId', { droneId })
      .andWhere('mission.status IN (:...statuses)', { statuses: NON_TERMINAL_MISSION_STATUSES })
      .andWhere('mission.plannedStartAt < :end AND mission.plannedEndAt > :start', { start, end });
    if (excludeId) qb.andWhere('mission.id <> :excludeId', { excludeId });
    if (await qb.getExists()) {
      throw domainError.conflict('MISSION_OVERLAP', 'The drone already has a mission in the requested time range.');
    }
  }

  async create(dto: CreateMissionDto) {
    const start = new Date(dto.plannedStartAt);
    const end = new Date(dto.plannedEndAt);
    this.validateSchedule(start, end);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const drone = await this.lockDrone(manager, dto.droneId);
        this.ensureAvailable(drone);
        await this.ensureNoOverlap(manager, drone.id, start, end);
        return manager.getRepository(Mission).save(manager.getRepository(Mission).create({
          ...dto, plannedStartAt: start, plannedEndAt: end, status: MissionStatus.PLANNED,
          actualStartAt: null, actualEndAt: null, terminalAt: null, flightHours: null, abortReason: null,
        }));
      });
    } catch (error) {
      return this.translateDatabaseError(error);
    }
  }

  async list(query: ListMissionsDto) {
    if (query.from && query.to && new Date(query.to) <= new Date(query.from)) {
      throw domainError.unprocessable('INVALID_MISSION_SCHEDULE', 'The date filter end must be later than its start.');
    }
    const qb = this.missions.createQueryBuilder('mission').leftJoinAndSelect('mission.drone', 'drone');
    if (query.status) qb.andWhere('mission.status = :status', { status: query.status });
    if (query.droneId) qb.andWhere('mission.droneId = :droneId', { droneId: query.droneId });
    if (query.from) qb.andWhere('mission.plannedEndAt > :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('mission.plannedStartAt < :to', { to: new Date(query.to) });
    qb.orderBy('mission.plannedStartAt', 'DESC').addOrderBy('mission.id', 'ASC')
      .skip((query.page - 1) * query.pageSize).take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return paginated(rows.map((mission) => ({
      ...mission,
      drone: mission.drone ? toDroneView(mission.drone, this.clock.todayUtc()) : undefined,
    })), total, query);
  }

  async findOne(id: string) {
    const mission = await this.missions.findOne({ where: { id }, relations: { drone: true } });
    if (!mission) throw domainError.notFound('mission');
    return { ...mission, drone: toDroneView(mission.drone, this.clock.todayUtc()) };
  }

  async update(id: string, dto: UpdateMissionDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(Mission);
        const reference = await repo.findOne({ where: { id }, select: { id: true, droneId: true } });
        if (!reference) throw domainError.notFound('mission');
        const droneIds = [...new Set([reference.droneId, dto.droneId ?? reference.droneId])].sort();
        const lockedDrones = new Map<string, Drone>();
        for (const droneIdToLock of droneIds) {
          lockedDrones.set(droneIdToLock, await this.lockDrone(manager, droneIdToLock));
        }
        const mission = await this.lockMission(manager, id);
        if (mission.droneId !== reference.droneId) {
          throw domainError.conflict('MISSION_CONCURRENTLY_CHANGED', 'The mission assignment changed; retry the update.');
        }
        if (mission.status !== MissionStatus.PLANNED) {
          throw domainError.conflict('INVALID_MISSION_TRANSITION', 'Only planned missions can be edited.');
        }
        const droneId = dto.droneId ?? mission.droneId;
        const drone = lockedDrones.get(droneId)!;
        this.ensureAvailable(drone);
        const start = dto.plannedStartAt ? new Date(dto.plannedStartAt) : mission.plannedStartAt;
        const end = dto.plannedEndAt ? new Date(dto.plannedEndAt) : mission.plannedEndAt;
        this.validateSchedule(start, end, Boolean(dto.plannedStartAt || dto.plannedEndAt || dto.droneId));
        await this.ensureNoOverlap(manager, droneId, start, end, mission.id);
        Object.assign(mission, dto, { droneId, plannedStartAt: start, plannedEndAt: end });
        return repo.save(mission);
      });
    } catch (error) {
      return this.translateDatabaseError(error);
    }
  }

  private async lockMission(manager: EntityManager, id: string): Promise<Mission> {
    const mission = await manager.getRepository(Mission).createQueryBuilder('mission')
      .setLock('pessimistic_write').where('mission.id = :id', { id }).getOne();
    if (!mission) throw domainError.notFound('mission');
    return mission;
  }

  private async lockMissionAndDrone(manager: EntityManager, id: string): Promise<{ mission: Mission; drone: Drone }> {
    const reference = await manager.getRepository(Mission).findOne({
      where: { id }, select: { id: true, droneId: true },
    });
    if (!reference) throw domainError.notFound('mission');
    const drone = await this.lockDrone(manager, reference.droneId);
    const mission = await this.lockMission(manager, id);
    if (mission.droneId !== reference.droneId) {
      throw domainError.conflict('MISSION_CONCURRENTLY_CHANGED', 'The mission assignment changed; retry the command.');
    }
    return { mission, drone };
  }

  private assertTransition(mission: Mission, target: MissionStatus): void {
    if (!canTransition(mission.status, target)) {
      throw domainError.conflict('INVALID_MISSION_TRANSITION', `Mission cannot transition from ${mission.status} to ${target}.`);
    }
  }

  async preFlight(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const mission = await this.lockMission(manager, id);
      this.assertTransition(mission, MissionStatus.PRE_FLIGHT_CHECK);
      mission.status = MissionStatus.PRE_FLIGHT_CHECK;
      return manager.getRepository(Mission).save(mission);
    });
  }

  async start(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const { mission, drone } = await this.lockMissionAndDrone(manager, id);
      this.assertTransition(mission, MissionStatus.IN_PROGRESS);
      this.ensureAvailable(drone);
      mission.status = MissionStatus.IN_PROGRESS;
      mission.actualStartAt = this.clock.now();
      drone.status = DroneStatus.IN_MISSION;
      const savedMission = await manager.getRepository(Mission).save(mission);
      const savedDrone = await manager.getRepository(Drone).save(drone);
      return { mission: savedMission, drone: toDroneView(savedDrone, this.clock.todayUtc()) };
    });
  }

  private resolvePostFlightStatus(drone: Drone): DroneStatus {
    if (drone.status === DroneStatus.RETIRED) return DroneStatus.RETIRED;
    return resolveMaintenanceState({
      persistedStatus: DroneStatus.AVAILABLE,
      totalFlightHours: drone.totalFlightHours,
      flightHoursAtLastMaintenance: drone.flightHoursAtLastMaintenance,
      nextMaintenanceDueDate: drone.nextMaintenanceDueDate,
      todayUtc: this.clock.todayUtc(),
    }).effectiveStatus;
  }

  async complete(id: string, dto: CompleteMissionDto) {
    return this.dataSource.transaction(async (manager) => {
      const { mission, drone } = await this.lockMissionAndDrone(manager, id);
      this.assertTransition(mission, MissionStatus.COMPLETED);
      if (dto.flightHours <= 0) {
        throw domainError.unprocessable('INVALID_COMPLETION_FLIGHT_HOURS', 'Completion flight hours must be greater than zero.');
      }
      const now = this.clock.now();
      drone.totalFlightHours = addHours(drone.totalFlightHours, dto.flightHours);
      drone.status = this.resolvePostFlightStatus(drone);
      mission.status = MissionStatus.COMPLETED;
      mission.actualEndAt = now;
      mission.terminalAt = now;
      mission.flightHours = dto.flightHours;
      const savedDrone = await manager.getRepository(Drone).save(drone);
      const savedMission = await manager.getRepository(Mission).save(mission);
      return { mission: savedMission, drone: toDroneView(savedDrone, this.clock.todayUtc()) };
    });
  }

  async abort(id: string, dto: AbortMissionDto) {
    return this.dataSource.transaction(async (manager) => {
      const { mission, drone } = await this.lockMissionAndDrone(manager, id);
      this.assertTransition(mission, MissionStatus.ABORTED);
      if (!dto.reason?.trim()) {
        throw domainError.unprocessable('MISSING_ABORT_REASON', 'A non-blank abort reason is required.');
      }
      const started = mission.status === MissionStatus.IN_PROGRESS;
      if (started && (dto.flightHours === undefined || dto.flightHours <= 0)) {
        throw domainError.unprocessable('INVALID_ABORT_FLIGHT_HOURS', 'Flight hours are required when aborting an in-progress mission.');
      }
      if (!started && dto.flightHours !== undefined) {
        throw domainError.unprocessable('INVALID_ABORT_FLIGHT_HOURS', 'Flight hours are not accepted before a mission starts.');
      }
      const now = this.clock.now();
      if (started) {
        drone.totalFlightHours = addHours(drone.totalFlightHours, dto.flightHours!);
        drone.status = this.resolvePostFlightStatus(drone);
        mission.actualEndAt = now;
        mission.flightHours = dto.flightHours!;
      } else if (drone.status !== DroneStatus.IN_MISSION) {
        drone.status = this.resolvePostFlightStatus(drone);
      }
      mission.status = MissionStatus.ABORTED;
      mission.abortReason = dto.reason.trim();
      mission.terminalAt = now;
      const savedDrone = await manager.getRepository(Drone).save(drone);
      const savedMission = await manager.getRepository(Mission).save(mission);
      return { mission: savedMission, drone: toDroneView(savedDrone, this.clock.todayUtc()) };
    });
  }
}
