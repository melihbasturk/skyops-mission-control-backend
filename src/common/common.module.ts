import { Global, Module } from '@nestjs/common';
import { ClockService } from './time/clock.service';

@Global()
@Module({
  providers: [ClockService],
  exports: [ClockService],
})
export class CommonModule {}
