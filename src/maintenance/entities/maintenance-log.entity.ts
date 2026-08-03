import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../../common/numeric/numeric.transformer';
import { Drone } from '../../drones/entities/drone.entity';
import { MaintenanceType } from '../maintenance.enums';

@Entity({ name: 'maintenance_logs' })
@Index('idx_maintenance_logs_drone_performed', ['droneId', 'performedOn', 'recordedAt'])
export class MaintenanceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'drone_id', type: 'uuid' })
  droneId: string;

  @ManyToOne(() => Drone, (drone) => drone.maintenanceLogs, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'drone_id' })
  drone: Drone;

  @Column({ type: 'enum', enum: MaintenanceType, enumName: 'maintenance_type_enum' })
  type: MaintenanceType;

  @Column({ name: 'technician_name', type: 'varchar', length: 120 })
  technicianName: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Index()
  @Column({ name: 'performed_on', type: 'date' })
  performedOn: string;

  @Column({ name: 'flight_hours_at_maintenance', type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  flightHoursAtMaintenance: number;

  @CreateDateColumn({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;
}
