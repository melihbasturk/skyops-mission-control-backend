import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MissionType } from '../domain/mission.enums';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class UpdateMissionDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150)
  name?: string;

  @IsOptional() @IsEnum(MissionType)
  type?: MissionType;

  @IsOptional() @IsUUID()
  droneId?: string;

  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120)
  pilotName?: string;

  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255)
  siteLocation?: string;

  @IsOptional() @IsDateString()
  plannedStartAt?: string;

  @IsOptional() @IsDateString()
  plannedEndAt?: string;
}
