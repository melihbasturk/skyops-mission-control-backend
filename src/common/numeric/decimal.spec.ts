import { absoluteDifference, addHours, decimalPlacesAtMost } from './decimal';

describe('decimal helpers', () => {
  it('adds flight hours without binary floating-point drift', () => {
    expect(addHours(0.1, 0.2)).toBe(0.3);
  });

  it('checks the maintenance tolerance boundaries exactly', () => {
    expect(absoluteDifference(10, 10.1).lessThanOrEqualTo(0.1)).toBe(true);
    expect(absoluteDifference(10, 10.11).greaterThan(0.1)).toBe(true);
  });

  it('recognizes numeric scale', () => {
    expect(decimalPlacesAtMost(1.23)).toBe(true);
    expect(decimalPlacesAtMost(1.234)).toBe(false);
  });
});
