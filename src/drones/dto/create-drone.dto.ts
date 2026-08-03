import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { DroneModel } from '../domain/drone.enums';
import { normalizeSerialNumber, SERIAL_NUMBER_PATTERN } from '../domain/serial-number';

export class CreateDroneDto {
  @Transform(({ value }) => typeof value === 'string' ? normalizeSerialNumber(value) : value)
  @IsString()
  @Matches(SERIAL_NUMBER_PATTERN)
  serialNumber: string;

  @IsEnum(DroneModel)
  model: DroneModel;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  totalFlightHours?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  lastMaintenanceDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  flightHoursAtLastMaintenance?: number;
}
