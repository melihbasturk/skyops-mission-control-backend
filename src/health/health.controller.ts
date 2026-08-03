import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async health(@Res({ passthrough: true }) response: Response) {
    const timestamp = new Date().toISOString();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', timestamp, checks: { api: { status: 'up' }, database: { status: 'up' } } };
    } catch {
      response.status(503);
      return {
        status: 'degraded', timestamp, checks: { api: { status: 'up' }, database: { status: 'down' } },
      };
    }
  }
}
