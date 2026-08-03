export enum DroneModel {
  PHANTOM_4 = 'PHANTOM_4',
  MATRICE_300 = 'MATRICE_300',
  MAVIC_3_ENTERPRISE = 'MAVIC_3_ENTERPRISE',
}

export enum DroneStatus {
  AVAILABLE = 'AVAILABLE',
  IN_MISSION = 'IN_MISSION',
  MAINTENANCE = 'MAINTENANCE',
  RETIRED = 'RETIRED',
}

export enum MaintenanceCondition {
  NONE = 'NONE',
  UPCOMING = 'UPCOMING',
  DUE = 'DUE',
  OVERDUE = 'OVERDUE',
}
