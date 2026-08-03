import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { AbortMissionDto } from './dto/abort-mission.dto';
import { CompleteMissionDto } from './dto/complete-mission.dto';
import { CreateMissionDto } from './dto/create-mission.dto';
import { ListMissionsDto } from './dto/list-missions.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { MissionsService } from './missions.service';

@Controller('api/v1/missions')
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Post()
  async create(@Body() dto: CreateMissionDto) { return { data: await this.service.create(dto) }; }

  @Get()
  list(@Query() query: ListMissionsDto) { return this.service.list(query); }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) { return { data: await this.service.findOne(id) }; }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMissionDto) {
    return { data: await this.service.update(id, dto) };
  }

  @Post(':id/pre-flight')
  @HttpCode(200)
  async preFlight(@Param('id', ParseUUIDPipe) id: string) { return { data: await this.service.preFlight(id) }; }

  @Post(':id/start')
  @HttpCode(200)
  async start(@Param('id', ParseUUIDPipe) id: string) { return { data: await this.service.start(id) }; }

  @Post(':id/complete')
  @HttpCode(200)
  async complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteMissionDto) {
    return { data: await this.service.complete(id, dto) };
  }

  @Post(':id/abort')
  @HttpCode(200)
  async abort(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AbortMissionDto) {
    return { data: await this.service.abort(id, dto) };
  }
}
