import { Controller, Get } from '@nestjs/common';
import { FleetQueryService } from './fleet-query.service';

@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly fleet: FleetQueryService) {}

  @Get()
  async getDashboard() { return { data: await this.fleet.dashboard() }; }
}
