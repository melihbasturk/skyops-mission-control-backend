import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { envValidationSchema } from './config/env.validation';
import { createTypeOrmOptions } from './database/typeorm.config';
import { DronesModule } from './drones/drones.module';
import { HealthModule } from './health/health.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MissionsModule } from './missions/missions.module';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createTypeOrmOptions(config.getOrThrow<string>('DATABASE_URL')),
    }),
    CommonModule,
    DronesModule,
    MissionsModule,
    MaintenanceModule,
    ReportingModule,
    HealthModule,
  ],
})
export class AppModule {}
