import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { MissionType } from '../domain/mission.enums';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateMissionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEnum(MissionType)
  type: MissionType;

  @IsUUID()
  droneId: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  pilotName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  siteLocation: string;

  @IsDateString()
  plannedStartAt: string;

  @IsDateString()
  plannedEndAt: string;
}
