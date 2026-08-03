import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { MaintenanceType } from '../maintenance.enums';

export class CreateMaintenanceLogDto {
  @IsUUID()
  droneId: string;

  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  technicianName: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  performedOn: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  flightHoursAtMaintenance: number;
}
