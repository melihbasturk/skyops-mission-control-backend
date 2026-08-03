import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1722630000000 implements MigrationInterface {
  name = 'InitialSchema1722630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await queryRunner.query("CREATE TYPE drone_model_enum AS ENUM ('PHANTOM_4', 'MATRICE_300', 'MAVIC_3_ENTERPRISE')");
    await queryRunner.query("CREATE TYPE drone_status_enum AS ENUM ('AVAILABLE', 'IN_MISSION', 'MAINTENANCE', 'RETIRED')");
    await queryRunner.query("CREATE TYPE mission_type_enum AS ENUM ('WIND_TURBINE_INSPECTION', 'SOLAR_PANEL_SURVEY', 'POWER_LINE_PATROL')");
    await queryRunner.query("CREATE TYPE mission_status_enum AS ENUM ('PLANNED', 'PRE_FLIGHT_CHECK', 'IN_PROGRESS', 'COMPLETED', 'ABORTED')");
    await queryRunner.query("CREATE TYPE maintenance_type_enum AS ENUM ('ROUTINE_CHECK', 'BATTERY_REPLACEMENT', 'MOTOR_REPAIR', 'FIRMWARE_UPDATE', 'FULL_OVERHAUL')");

    await queryRunner.query(`
      CREATE TABLE drones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        serial_number varchar(13) NOT NULL,
        model drone_model_enum NOT NULL,
        status drone_status_enum NOT NULL DEFAULT 'AVAILABLE',
        total_flight_hours numeric(10,2) NOT NULL DEFAULT 0.00,
        last_maintenance_date date NOT NULL,
        flight_hours_at_last_maintenance numeric(10,2) NOT NULL DEFAULT 0.00,
        next_maintenance_due_date date NOT NULL,
        registered_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_drones_serial_number UNIQUE (serial_number),
        CONSTRAINT ck_drones_serial_number CHECK (serial_number ~ '^SKY-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
        CONSTRAINT ck_drones_total_hours CHECK (total_flight_hours >= 0),
        CONSTRAINT ck_drones_baseline_hours CHECK (
          flight_hours_at_last_maintenance >= 0
          AND flight_hours_at_last_maintenance <= total_flight_hours
        ),
        CONSTRAINT ck_drones_next_maintenance_date CHECK (
          next_maintenance_due_date = last_maintenance_date + 90
        )
      )
    `);
    await queryRunner.query('CREATE INDEX idx_drones_status ON drones(status)');
    await queryRunner.query('CREATE INDEX idx_drones_next_maintenance_due_date ON drones(next_maintenance_due_date)');

    await queryRunner.query(`
      CREATE TABLE missions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(150) NOT NULL,
        type mission_type_enum NOT NULL,
        drone_id uuid NOT NULL,
        pilot_name varchar(120) NOT NULL,
        site_location varchar(255) NOT NULL,
        planned_start_at timestamptz NOT NULL,
        planned_end_at timestamptz NOT NULL,
        actual_start_at timestamptz,
        actual_end_at timestamptz,
        terminal_at timestamptz,
        status mission_status_enum NOT NULL DEFAULT 'PLANNED',
        flight_hours numeric(10,2),
        abort_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_missions_drone FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE RESTRICT,
        CONSTRAINT ck_missions_name CHECK (btrim(name) <> ''),
        CONSTRAINT ck_missions_pilot CHECK (btrim(pilot_name) <> ''),
        CONSTRAINT ck_missions_site CHECK (btrim(site_location) <> ''),
        CONSTRAINT ck_missions_planned_interval CHECK (planned_end_at > planned_start_at),
        CONSTRAINT ck_missions_flight_hours CHECK (flight_hours IS NULL OR flight_hours > 0),
        CONSTRAINT ck_missions_status_fields CHECK (
          (status IN ('PLANNED', 'PRE_FLIGHT_CHECK') AND actual_start_at IS NULL AND actual_end_at IS NULL AND terminal_at IS NULL AND flight_hours IS NULL AND abort_reason IS NULL)
          OR (status = 'IN_PROGRESS' AND actual_start_at IS NOT NULL AND actual_end_at IS NULL AND terminal_at IS NULL AND flight_hours IS NULL AND abort_reason IS NULL)
          OR (status = 'COMPLETED' AND actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL AND terminal_at IS NOT NULL AND flight_hours > 0 AND abort_reason IS NULL)
          OR (status = 'ABORTED' AND terminal_at IS NOT NULL AND btrim(abort_reason) <> '' AND (
            (actual_start_at IS NULL AND actual_end_at IS NULL AND flight_hours IS NULL)
            OR (actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL AND flight_hours > 0)
          ))
        )
      )
    `);
    await queryRunner.query('CREATE INDEX idx_missions_drone_planned_start ON missions(drone_id, planned_start_at)');
    await queryRunner.query('CREATE INDEX idx_missions_status_planned_start ON missions(status, planned_start_at)');
    await queryRunner.query('CREATE INDEX idx_missions_terminal_at ON missions(terminal_at)');
    await queryRunner.query(`
      ALTER TABLE missions ADD CONSTRAINT ex_missions_drone_schedule
      EXCLUDE USING gist (
        drone_id WITH =,
        tstzrange(planned_start_at, planned_end_at, '[)') WITH &&
      ) WHERE (status IN ('PLANNED', 'PRE_FLIGHT_CHECK', 'IN_PROGRESS'))
    `);

    await queryRunner.query(`
      CREATE TABLE maintenance_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        drone_id uuid NOT NULL,
        type maintenance_type_enum NOT NULL,
        technician_name varchar(120) NOT NULL,
        notes text,
        performed_on date NOT NULL,
        flight_hours_at_maintenance numeric(10,2) NOT NULL,
        recorded_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_maintenance_logs_drone FOREIGN KEY (drone_id) REFERENCES drones(id) ON DELETE RESTRICT,
        CONSTRAINT ck_maintenance_logs_technician CHECK (btrim(technician_name) <> ''),
        CONSTRAINT ck_maintenance_logs_hours CHECK (flight_hours_at_maintenance >= 0)
      )
    `);
    await queryRunner.query('CREATE INDEX idx_maintenance_logs_drone_performed ON maintenance_logs(drone_id, performed_on DESC, recorded_at DESC)');
    await queryRunner.query('CREATE INDEX idx_maintenance_logs_performed_on ON maintenance_logs(performed_on)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS maintenance_logs');
    await queryRunner.query('DROP TABLE IF EXISTS missions');
    await queryRunner.query('DROP TABLE IF EXISTS drones');
    await queryRunner.query('DROP TYPE IF EXISTS maintenance_type_enum');
    await queryRunner.query('DROP TYPE IF EXISTS mission_status_enum');
    await queryRunner.query('DROP TYPE IF EXISTS mission_type_enum');
    await queryRunner.query('DROP TYPE IF EXISTS drone_status_enum');
    await queryRunner.query('DROP TYPE IF EXISTS drone_model_enum');
  }
}
