import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { MissionStatus } from '../domain/mission.enums';

export class ListMissionsDto extends PaginationDto {
  @IsOptional() @IsEnum(MissionStatus)
  status?: MissionStatus;

  @IsOptional() @IsUUID()
  droneId?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}
