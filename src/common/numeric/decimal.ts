import Decimal from 'decimal.js';

export const toDecimal = (value: Decimal.Value): Decimal => new Decimal(value);

export function decimalPlacesAtMost(value: number, places = 2): boolean {
  return new Decimal(value).decimalPlaces() <= places;
}

export function addHours(current: number, increment: number): number {
  return new Decimal(current).plus(increment).toDecimalPlaces(2).toNumber();
}

export function absoluteDifference(left: number, right: number): Decimal {
  return new Decimal(left).minus(right).abs();
}
