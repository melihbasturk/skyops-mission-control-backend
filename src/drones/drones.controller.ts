import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { PaginationDto } from '../common/pagination/pagination.dto';
import { CreateDroneDto } from './dto/create-drone.dto';
import { ListDronesDto } from './dto/list-drones.dto';
import { UpdateDroneDto } from './dto/update-drone.dto';
import { DronesService } from './drones.service';

@Controller('api/v1/drones')
export class DronesController {
  constructor(private readonly service: DronesService) {}

  @Post()
  async create(@Body() dto: CreateDroneDto) { return { data: await this.service.create(dto) }; }

  @Get()
  list(@Query() query: ListDronesDto) { return this.service.list(query); }

  @Get(':id/missions')
  missionHistory(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationDto) {
    return this.service.missionHistory(id, query);
  }

  @Get(':id/maintenance-logs')
  maintenanceHistory(@Param('id', ParseUUIDPipe) id: string, @Query() query: PaginationDto) {
    return this.service.maintenanceHistory(id, query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) { return { data: await this.service.findOne(id) }; }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDroneDto) {
    return { data: await this.service.update(id, dto) };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string) { await this.service.remove(id); }

  @Post(':id/retire')
  @HttpCode(200)
  async retire(@Param('id', ParseUUIDPipe) id: string) { return { data: await this.service.retire(id) }; }

  @Post(':id/maintenance/start')
  @HttpCode(200)
  async startMaintenance(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.startMaintenance(id) };
  }
}
