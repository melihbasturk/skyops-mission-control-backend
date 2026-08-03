import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CreateMaintenanceLogDto } from './dto/create-maintenance-log.dto';
import { ListMaintenanceLogsDto } from './dto/list-maintenance-logs.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('api/v1/maintenance-logs')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Post()
  async create(@Body() dto: CreateMaintenanceLogDto) { return { data: await this.service.create(dto) }; }

  @Get()
  list(@Query() query: ListMaintenanceLogsDto) { return this.service.list(query); }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) { return { data: await this.service.findOne(id) }; }
}
