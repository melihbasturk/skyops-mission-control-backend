import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MaintenanceLog } from '../maintenance/entities/maintenance-log.entity';
import { Mission } from '../missions/entities/mission.entity';
import { Drone } from '../drones/entities/drone.entity';

export function createTypeOrmOptions(databaseUrl: string): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [Drone, Mission, MaintenanceLog],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: { max: 10 },
  };
}
