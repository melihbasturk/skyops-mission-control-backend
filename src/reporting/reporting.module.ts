import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drone } from '../drones/entities/drone.entity';
import { Mission } from '../missions/entities/mission.entity';
import { DashboardController } from './dashboard.controller';
import { FleetQueryService } from './fleet-query.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Drone, Mission])],
  controllers: [DashboardController, ReportsController],
  providers: [FleetQueryService],
})
export class ReportingModule {}
