import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { DroneModel, DroneStatus, MaintenanceCondition } from '../domain/drone.enums';

export class ListDronesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DroneModel)
  model?: DroneModel;

  @IsOptional()
  @IsEnum(DroneStatus)
  status?: DroneStatus;

  @IsOptional()
  @IsEnum(MaintenanceCondition)
  maintenanceCondition?: MaintenanceCondition;
}
