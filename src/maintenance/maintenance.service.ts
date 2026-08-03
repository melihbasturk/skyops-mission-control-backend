import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { domainError } from '../common/domain/domain-error';
import { absoluteDifference } from '../common/numeric/decimal';
import { paginated } from '../common/pagination/pagination.dto';
import { ClockService } from '../common/time/clock.service';
import { DroneStatus } from '../drones/domain/drone.enums';
import { MAINTENANCE_HOUR_TOLERANCE, nextMaintenanceDate } from '../drones/domain/maintenance-policy';
import { toDroneView } from '../drones/domain/drone-view';
import { Drone } from '../drones/entities/drone.entity';
import { CreateMaintenanceLogDto } from './dto/create-maintenance-log.dto';
import { ListMaintenanceLogsDto } from './dto/list-maintenance-logs.dto';
import { MaintenanceLog } from './entities/maintenance-log.entity';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceLog) private readonly logs: Repository<MaintenanceLog>,
    private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  async create(dto: CreateMaintenanceLogDto) {
    return this.dataSource.transaction(async (manager) => {
      const droneRepo = manager.getRepository(Drone);
      const drone = await droneRepo.createQueryBuilder('drone').setLock('pessimistic_write')
        .where('drone.id = :id', { id: dto.droneId }).getOne();
      if (!drone) throw domainError.notFound('drone');
      if (drone.status === DroneStatus.IN_MISSION) {
        throw domainError.conflict('DRONE_IN_ACTIVE_MISSION', 'Maintenance cannot be completed during an active mission.');
      }
      if (dto.performedOn < drone.lastMaintenanceDate || dto.performedOn > this.clock.todayUtc()) {
        throw domainError.unprocessable('INVALID_MAINTENANCE_DATE', 'Maintenance date must be between the current baseline date and today.');
      }
      if (absoluteDifference(dto.flightHoursAtMaintenance, drone.totalFlightHours).greaterThan(MAINTENANCE_HOUR_TOLERANCE)) {
        throw domainError.unprocessable('MAINTENANCE_HOUR_MISMATCH', 'Maintenance hours differ from the authoritative drone total by more than 0.10 hours.');
      }

      const log = manager.getRepository(MaintenanceLog).create({
        ...dto,
        notes: dto.notes?.trim() || null,
      });
      const savedLog = await manager.getRepository(MaintenanceLog).save(log);
      drone.lastMaintenanceDate = dto.performedOn;
      drone.flightHoursAtLastMaintenance = drone.totalFlightHours;
      drone.nextMaintenanceDueDate = nextMaintenanceDate(dto.performedOn);
      if (drone.status !== DroneStatus.RETIRED) drone.status = DroneStatus.AVAILABLE;
      const savedDrone = await droneRepo.save(drone);
      return { maintenanceLog: savedLog, drone: toDroneView(savedDrone, this.clock.todayUtc()) };
    });
  }

  async list(query: ListMaintenanceLogsDto) {
    if (query.from && query.to && query.to < query.from) {
      throw domainError.unprocessable('INVALID_MAINTENANCE_DATE', 'The end date must not precede the start date.');
    }
    const qb = this.logs.createQueryBuilder('log').leftJoinAndSelect('log.drone', 'drone');
    if (query.droneId) qb.andWhere('log.droneId = :droneId', { droneId: query.droneId });
    if (query.type) qb.andWhere('log.type = :type', { type: query.type });
    if (query.from) qb.andWhere('log.performedOn >= :from', { from: query.from });
    if (query.to) qb.andWhere('log.performedOn <= :to', { to: query.to });
    qb.orderBy('log.performedOn', 'DESC').addOrderBy('log.recordedAt', 'DESC')
      .skip((query.page - 1) * query.pageSize).take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return paginated(rows.map((log) => ({
      ...log,
      drone: log.drone ? toDroneView(log.drone, this.clock.todayUtc()) : undefined,
    })), total, query);
  }

  async findOne(id: string) {
    const log = await this.logs.findOne({ where: { id }, relations: { drone: true } });
    if (!log) throw domainError.notFound('maintenance_log');
    return { ...log, drone: toDroneView(log.drone, this.clock.todayUtc()) };
  }
}
