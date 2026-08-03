import { IsDateString, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { MaintenanceType } from '../maintenance.enums';

export class ListMaintenanceLogsDto extends PaginationDto {
  @IsOptional() @IsUUID()
  droneId?: string;

  @IsOptional() @IsEnum(MaintenanceType)
  type?: MaintenanceType;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  from?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  to?: string;
}
