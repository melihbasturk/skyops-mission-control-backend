import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ClockService } from '../common/time/clock.service';
import { domainError } from '../common/domain/domain-error';
import { paginated, PaginationDto } from '../common/pagination/pagination.dto';
import { MaintenanceLog } from '../maintenance/entities/maintenance-log.entity';
import { Mission } from '../missions/entities/mission.entity';
import { CreateDroneDto } from './dto/create-drone.dto';
import { ListDronesDto } from './dto/list-drones.dto';
import { UpdateDroneDto } from './dto/update-drone.dto';
import { Drone } from './entities/drone.entity';
import { DroneStatus, MaintenanceCondition } from './domain/drone.enums';
import { nextMaintenanceDate, resolveMaintenanceState } from './domain/maintenance-policy';
import { toDroneView } from './domain/drone-view';
import { isRetirementBlocked } from './domain/retirement-policy';

@Injectable()
export class DronesService {
  constructor(
    @InjectRepository(Drone) private readonly drones: Repository<Drone>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(MaintenanceLog) private readonly maintenanceLogs: Repository<MaintenanceLog>,
    private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  private translateDatabaseError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driver = error.driverError as { code?: string; constraint?: string };
      if (driver.code === '23505' && driver.constraint === 'uq_drones_serial_number') {
        throw domainError.conflict('DUPLICATE_SERIAL', 'A drone with this serial number already exists.');
      }
    }
    throw error;
  }

  async create(dto: CreateDroneDto) {
    const supplied = [dto.totalFlightHours, dto.lastMaintenanceDate, dto.flightHoursAtLastMaintenance]
      .filter((value) => value !== undefined).length;
    if (supplied !== 0 && supplied !== 3) {
      throw domainError.unprocessable(
        'INVALID_MAINTENANCE_BASELINE',
        'Imported total hours, maintenance date, and maintenance baseline hours must be supplied together.',
      );
    }

    const total = dto.totalFlightHours ?? 0;
    const baseline = dto.flightHoursAtLastMaintenance ?? 0;
    const lastDate = dto.lastMaintenanceDate ?? this.clock.todayUtc();
    if (baseline > total || lastDate > this.clock.todayUtc()) {
      throw domainError.unprocessable('INVALID_MAINTENANCE_BASELINE', 'The imported maintenance baseline is inconsistent.');
    }

    const drone = this.drones.create({
      serialNumber: dto.serialNumber,
      model: dto.model,
      status: DroneStatus.AVAILABLE,
      totalFlightHours: total,
      lastMaintenanceDate: lastDate,
      flightHoursAtLastMaintenance: baseline,
      nextMaintenanceDueDate: nextMaintenanceDate(lastDate),
    });

    try {
      return toDroneView(await this.drones.save(drone), this.clock.todayUtc());
    } catch (error) {
      return this.translateDatabaseError(error);
    }
  }

  async list(query: ListDronesDto) {
    const qb = this.drones.createQueryBuilder('drone');
    if (query.model) qb.andWhere('drone.model = :model', { model: query.model });

    if (query.status || query.maintenanceCondition) {
      const candidates = await qb.orderBy('drone.registeredAt', 'DESC').addOrderBy('drone.id', 'ASC').getMany();
      const filtered = candidates.filter((drone) => {
        const view = toDroneView(drone, this.clock.todayUtc());
        return (!query.status || view.status === query.status)
          && (!query.maintenanceCondition || view.maintenanceCondition === query.maintenanceCondition);
      });
      const start = (query.page - 1) * query.pageSize;
      return paginated(filtered.slice(start, start + query.pageSize), filtered.length, query);
    }

    qb.orderBy('drone.registeredAt', 'DESC').addOrderBy('drone.id', 'ASC')
      .skip((query.page - 1) * query.pageSize).take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return paginated(rows.map((row) => toDroneView(row, this.clock.todayUtc())), total, query);
  }

  async findEntity(id: string, repository = this.drones): Promise<Drone> {
    const drone = await repository.findOne({ where: { id } });
    if (!drone) throw domainError.notFound('drone');
    return drone;
  }

  async findOne(id: string) {
    return toDroneView(await this.findEntity(id), this.clock.todayUtc());
  }

  async update(id: string, dto: UpdateDroneDto) {
    const drone = await this.findEntity(id);
    Object.assign(drone, dto);
    try {
      return toDroneView(await this.drones.save(drone), this.clock.todayUtc());
    } catch (error) {
      return this.translateDatabaseError(error);
    }
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Drone);
      const drone = await repo.createQueryBuilder('drone').setLock('pessimistic_write')
        .where('drone.id = :id', { id }).getOne();
      if (!drone) throw domainError.notFound('drone');
      const missionCount = await manager.getRepository(Mission).count({ where: { droneId: id } });
      const logCount = await manager.getRepository(MaintenanceLog).count({ where: { droneId: id } });
      if (missionCount || logCount) {
        throw domainError.conflict('HISTORICAL_RECORD_DELETE_CONFLICT', 'A drone with operational history must be retired instead of deleted.');
      }
      await repo.remove(drone);
    });
  }

  async retire(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Drone);
      const drone = await repo.createQueryBuilder('drone').setLock('pessimistic_write')
        .where('drone.id = :id', { id }).getOne();
      if (!drone) throw domainError.notFound('drone');
      if (drone.status === DroneStatus.RETIRED) return toDroneView(drone, this.clock.todayUtc());
      const missionStatuses = await manager.getRepository(Mission).find({
        where: { droneId: id }, select: { status: true },
      });
      if (isRetirementBlocked(missionStatuses.map((mission) => mission.status))) {
        throw domainError.conflict('RETIREMENT_MISSION_CONFLICT', 'Abort all non-terminal missions before retiring the drone.');
      }
      drone.status = DroneStatus.RETIRED;
      return toDroneView(await repo.save(drone), this.clock.todayUtc());
    });
  }

  async startMaintenance(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Drone);
      const drone = await repo.createQueryBuilder('drone').setLock('pessimistic_write')
        .where('drone.id = :id', { id }).getOne();
      if (!drone) throw domainError.notFound('drone');
      if (drone.status === DroneStatus.RETIRED) throw domainError.conflict('DRONE_RETIRED', 'A retired drone cannot enter maintenance.');
      if (drone.status === DroneStatus.IN_MISSION) throw domainError.conflict('DRONE_IN_ACTIVE_MISSION', 'An active drone cannot enter maintenance.');
      drone.status = DroneStatus.MAINTENANCE;
      return toDroneView(await repo.save(drone), this.clock.todayUtc());
    });
  }

  async missionHistory(id: string, query: PaginationDto) {
    await this.findEntity(id);
    const [rows, total] = await this.missions.findAndCount({
      where: { droneId: id }, order: { plannedStartAt: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize, take: query.pageSize,
    });
    return paginated(rows, total, query);
  }

  async maintenanceHistory(id: string, query: PaginationDto) {
    await this.findEntity(id);
    const [rows, total] = await this.maintenanceLogs.findAndCount({
      where: { droneId: id }, order: { performedOn: 'DESC', recordedAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize, take: query.pageSize,
    });
    return paginated(rows, total, query);
  }

  effectiveStatus(drone: Drone): DroneStatus {
    return resolveMaintenanceState({
      persistedStatus: drone.status,
      totalFlightHours: drone.totalFlightHours,
      flightHoursAtLastMaintenance: drone.flightHoursAtLastMaintenance,
      nextMaintenanceDueDate: drone.nextMaintenanceDueDate,
      todayUtc: this.clock.todayUtc(),
    }).effectiveStatus;
  }
}
