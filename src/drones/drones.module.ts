import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceLog } from '../maintenance/entities/maintenance-log.entity';
import { Mission } from '../missions/entities/mission.entity';
import { Drone } from './entities/drone.entity';
import { DronesController } from './drones.controller';
import { DronesService } from './drones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Drone, Mission, MaintenanceLog])],
  controllers: [DronesController],
  providers: [DronesService],
})
export class DronesModule {}
