import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { DomainExceptionFilter } from '../../src/common/http/domain-exception.filter';
import { validationExceptionFactory } from '../../src/common/http/validation-exception.factory';
import AppDataSource from '../../src/database/data-source';

describe('mission lifecycle (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
    await AppDataSource.destroy();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true, whitelist: true, forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE maintenance_logs, missions, drones CASCADE');
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const createDrone = async (serial = 'SKY-TEST-0001') => {
    const response = await request(app.getHttpServer()).post('/api/v1/drones')
      .send({ serialNumber: serial, model: 'MATRICE_300' }).expect(201);
    return response.body.data;
  };

  const missionPayload = (droneId: string, startOffsetHours = 2) => ({
    name: 'Wind farm inspection',
    type: 'WIND_TURBINE_INSPECTION',
    droneId,
    pilotName: 'Alex Morgan',
    siteLocation: 'North Sea Wind Farm',
    plannedStartAt: new Date(Date.now() + startOffsetHours * 3_600_000).toISOString(),
    plannedEndAt: new Date(Date.now() + (startOffsetHours + 1) * 3_600_000).toISOString(),
  });

  it('completes a full lifecycle and adds hours once', async () => {
    const drone = await createDrone();
    const created = await request(app.getHttpServer()).post('/api/v1/missions')
      .send(missionPayload(drone.id)).expect(201);
    const missionId = created.body.data.id;

    await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/pre-flight`).expect(200);
    const started = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).expect(200);
    expect(started.body.data.drone.status).toBe('IN_MISSION');

    const completed = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/complete`)
      .send({ flightHours: 2.5 }).expect(200);
    expect(completed.body.data.mission.status).toBe('COMPLETED');
    expect(completed.body.data.drone.totalFlightHours).toBe(2.5);
    expect(completed.body.data.drone.status).toBe('AVAILABLE');

    await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/complete`)
      .send({ flightHours: 2.5 }).expect(409);
    const reloaded = await request(app.getHttpServer()).get(`/api/v1/drones/${drone.id}`).expect(200);
    expect(reloaded.body.data.totalFlightHours).toBe(2.5);
  });

  it('allows adjacency but rejects overlapping schedules', async () => {
    const drone = await createDrone('SKY-TEST-0002');
    const first = missionPayload(drone.id, 3);
    await request(app.getHttpServer()).post('/api/v1/missions').send(first).expect(201);

    await request(app.getHttpServer()).post('/api/v1/missions').send({
      ...missionPayload(drone.id, 3.5), name: 'Overlap',
    }).expect(409);

    await request(app.getHttpServer()).post('/api/v1/missions').send({
      ...missionPayload(drone.id, 4), name: 'Adjacent',
    }).expect(201);
  });

  it('allows only one of two concurrent overlapping schedules', async () => {
    const drone = await createDrone('SKY-TEST-0006');
    const payload = missionPayload(drone.id, 6);
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/api/v1/missions').send({ ...payload, name: 'Concurrent A' }),
      request(app.getHttpServer()).post('/api/v1/missions').send({ ...payload, name: 'Concurrent B' }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
  });

  it('applies concurrent completion only once', async () => {
    const drone = await createDrone('SKY-TEST-0007');
    const created = await request(app.getHttpServer()).post('/api/v1/missions')
      .send(missionPayload(drone.id)).expect(201);
    const id = created.body.data.id;
    await request(app.getHttpServer()).post(`/api/v1/missions/${id}/pre-flight`).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/missions/${id}/start`).expect(200);
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post(`/api/v1/missions/${id}/complete`).send({ flightHours: 1.25 }),
      request(app.getHttpServer()).post(`/api/v1/missions/${id}/complete`).send({ flightHours: 1.25 }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const reloaded = await request(app.getHttpServer()).get(`/api/v1/drones/${drone.id}`).expect(200);
    expect(reloaded.body.data.totalFlightHours).toBe(1.25);
  });

  it('records hours when an in-progress mission is aborted', async () => {
    const drone = await createDrone('SKY-TEST-0003');
    const created = await request(app.getHttpServer()).post('/api/v1/missions')
      .send(missionPayload(drone.id)).expect(201);
    const id = created.body.data.id;
    await request(app.getHttpServer()).post(`/api/v1/missions/${id}/pre-flight`).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/missions/${id}/start`).expect(200);
    const aborted = await request(app.getHttpServer()).post(`/api/v1/missions/${id}/abort`)
      .send({ reason: 'Unsafe wind speed', flightHours: 0.75 }).expect(200);
    expect(aborted.body.data.mission.status).toBe('ABORTED');
    expect(aborted.body.data.drone.totalFlightHours).toBe(0.75);
  });

  it('enforces maintenance tolerance and resets the baseline', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await request(app.getHttpServer()).post('/api/v1/drones').send({
      serialNumber: 'SKY-TEST-0004', model: 'PHANTOM_4', totalFlightHours: 50,
      lastMaintenanceDate: today, flightHoursAtLastMaintenance: 0,
    }).expect(201);
    const drone = response.body.data;
    expect(drone.status).toBe('MAINTENANCE');

    await request(app.getHttpServer()).post('/api/v1/maintenance-logs').send({
      droneId: drone.id, type: 'ROUTINE_CHECK', technicianName: 'Jamie Lee',
      performedOn: today, flightHoursAtMaintenance: 50.11,
    }).expect(422);

    const completed = await request(app.getHttpServer()).post('/api/v1/maintenance-logs').send({
      droneId: drone.id, type: 'ROUTINE_CHECK', technicianName: 'Jamie Lee',
      performedOn: today, flightHoursAtMaintenance: 50.1,
    }).expect(201);
    expect(completed.body.data.drone.status).toBe('AVAILABLE');
    expect(completed.body.data.drone.flightHoursAtLastMaintenance).toBe(50);
  });

  it('blocks retirement and historical deletion until scheduled work is aborted', async () => {
    const drone = await createDrone('SKY-TEST-0005');
    const mission = await request(app.getHttpServer()).post('/api/v1/missions')
      .send(missionPayload(drone.id)).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/drones/${drone.id}/retire`).expect(409);
    await request(app.getHttpServer()).post(`/api/v1/missions/${mission.body.data.id}/abort`)
      .send({ reason: 'Mission cancelled before departure' }).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/drones/${drone.id}/retire`).expect(200);
    await request(app.getHttpServer()).delete(`/api/v1/drones/${drone.id}`).expect(409);
  });
});
