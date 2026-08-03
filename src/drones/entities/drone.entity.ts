import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { numericTransformer } from '../../common/numeric/numeric.transformer';
import { MaintenanceLog } from '../../maintenance/entities/maintenance-log.entity';
import { Mission } from '../../missions/entities/mission.entity';
import { DroneModel, DroneStatus } from '../domain/drone.enums';

@Entity({ name: 'drones' })
export class Drone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'serial_number', type: 'varchar', length: 13, unique: true })
  serialNumber: string;

  @Column({ type: 'enum', enum: DroneModel, enumName: 'drone_model_enum' })
  model: DroneModel;

  @Index()
  @Column({ type: 'enum', enum: DroneStatus, enumName: 'drone_status_enum', default: DroneStatus.AVAILABLE })
  status: DroneStatus;

  @Column({ name: 'total_flight_hours', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: numericTransformer })
  totalFlightHours: number;

  @Column({ name: 'last_maintenance_date', type: 'date' })
  lastMaintenanceDate: string;

  @Column({ name: 'flight_hours_at_last_maintenance', type: 'numeric', precision: 10, scale: 2, default: 0, transformer: numericTransformer })
  flightHoursAtLastMaintenance: number;

  @Index()
  @Column({ name: 'next_maintenance_due_date', type: 'date' })
  nextMaintenanceDueDate: string;

  @Column({ name: 'registered_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  registeredAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Mission, (mission) => mission.drone)
  missions: Mission[];

  @OneToMany(() => MaintenanceLog, (log) => log.drone)
  maintenanceLogs: MaintenanceLog[];
}
