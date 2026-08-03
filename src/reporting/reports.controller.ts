import { Controller, Get } from '@nestjs/common';
import { FleetQueryService } from './fleet-query.service';

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly fleet: FleetQueryService) {}

  @Get('fleet-health')
  async getFleetHealth() { return { data: await this.fleet.fleetHealth() }; }
}
