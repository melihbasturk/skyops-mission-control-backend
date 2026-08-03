import { isValidSerialNumber, normalizeSerialNumber } from './serial-number';

describe('serial number policy', () => {
  it('normalizes valid serials to uppercase', () => {
    expect(normalizeSerialNumber(' sky-a12b-90xz ')).toBe('SKY-A12B-90XZ');
    expect(isValidSerialNumber(' sky-a12b-90xz ')).toBe(true);
  });

  it.each(['SKY-123-4567', 'ABC-1234-5678', 'SKY-12_4-5678', 'SKY-1234-56789'])(
    'rejects %s',
    (value) => expect(isValidSerialNumber(value)).toBe(false),
  );
});
