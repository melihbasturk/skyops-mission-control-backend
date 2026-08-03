import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { DroneModel } from '../domain/drone.enums';
import { normalizeSerialNumber, SERIAL_NUMBER_PATTERN } from '../domain/serial-number';

export class UpdateDroneDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? normalizeSerialNumber(value) : value)
  @IsString()
  @Matches(SERIAL_NUMBER_PATTERN)
  serialNumber?: string;

  @IsOptional()
  @IsEnum(DroneModel)
  model?: DroneModel;
}
