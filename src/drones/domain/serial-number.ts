export const SERIAL_NUMBER_PATTERN = /^SKY-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function normalizeSerialNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidSerialNumber(value: string): boolean {
  return SERIAL_NUMBER_PATTERN.test(normalizeSerialNumber(value));
}
