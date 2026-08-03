import { Injectable } from '@nestjs/common';

@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }

  todayUtc(): string {
    return this.now().toISOString().slice(0, 10);
  }
}
