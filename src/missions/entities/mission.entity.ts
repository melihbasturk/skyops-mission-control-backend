import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numericTransformer } from '../../common/numeric/numeric.transformer';
import { Drone } from '../../drones/entities/drone.entity';
import { MissionStatus, MissionType } from '../domain/mission.enums';

@Entity({ name: 'missions' })
@Index('idx_missions_drone_planned_start', ['droneId', 'plannedStartAt'])
@Index('idx_missions_status_planned_start', ['status', 'plannedStartAt'])
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'enum', enum: MissionType, enumName: 'mission_type_enum' })
  type: MissionType;

  @Column({ name: 'drone_id', type: 'uuid' })
  droneId: string;

  @ManyToOne(() => Drone, (drone) => drone.missions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ name: 'pilot_name', type: 'varchar', length: 120 })
  pilotName: string;

  @Column({ name: 'site_location', type: 'varchar', length: 255 })
  siteLocation: string;

  @Column({ name: 'planned_start_at', type: 'timestamptz' })
  plannedStartAt: Date;

  @Column({ name: 'planned_end_at', type: 'timestamptz' })
  plannedEndAt: Date;

  @Column({ name: 'actual_start_at', type: 'timestamptz', nullable: true })
  actualStartAt: Date | null;

  @Column({ name: 'actual_end_at', type: 'timestamptz', nullable: true })
  actualEndAt: Date | null;

  @Index()
  @Column({ name: 'terminal_at', type: 'timestamptz', nullable: true })
  terminalAt: Date | null;

  @Column({ type: 'enum', enum: MissionStatus, enumName: 'mission_status_enum', default: MissionStatus.PLANNED })
  status: MissionStatus;

  @Column({ name: 'flight_hours', type: 'numeric', precision: 10, scale: 2, nullable: true, transformer: numericTransformer })
  flightHours: number | null;

  @Column({ name: 'abort_reason', type: 'text', nullable: true })
  abortReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
