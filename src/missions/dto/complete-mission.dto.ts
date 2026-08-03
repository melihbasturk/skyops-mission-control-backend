import { Type } from 'class-transformer';
import { IsNumber, Max } from 'class-validator';

export class CompleteMissionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Max(99_999_999.99)
  flightHours: number;
}
