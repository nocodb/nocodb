import { convertDurationToSeconds, convertMS2Duration } from './durationUtils';

describe('convertMS2Duration', () => {
  it.each<[number, number, string, number]>([
    [3570, 0, '01:00', 3600],
    [3599, 0, '01:00', 3600],
    [86399, 0, '24:00', 86400],
    [59.96, 2, '00:01:00.0', 60],
    [0.996, 3, '00:00:01.00', 1],
    [0.9996, 4, '00:00:01.000', 1],
    [0.149, 2, '00:00:00.1', 0.1],
    [0.0149, 3, '00:00:00.01', 0.01],
    [3599.96, 2, '01:00:00.0', 3600],
    [86399.96, 2, '24:00:00.0', 86400],
    [59.996, 3, '00:01:00.00', 60],
    [3599.996, 3, '01:00:00.00', 3600],
    [86399.996, 3, '24:00:00.00', 86400],
    [59.9996, 4, '00:01:00.000', 60],
    [3599.9996, 4, '01:00:00.000', 3600],
    [86399.9996, 4, '24:00:00.000', 86400],
  ])(
    'formats %s seconds with format %s and round-trips the rounded value',
    (value, durationType, expected, roundedSeconds) => {
      const formatted = convertMS2Duration(value, durationType);
      expect(formatted).toBe(expected);
      expect(convertDurationToSeconds(formatted, durationType)).toEqual({
        _sec: roundedSeconds,
        _isValid: true,
      });
    }
  );

  it.each<[number, number, string]>([
    [3569.999, 0, '00:59'],
    [3570, 0, '01:00'],
    [0.949, 2, '00:00:00.9'],
    [0.95, 2, '00:00:01.0'],
    [0.9949, 3, '00:00:00.99'],
    [0.995, 3, '00:00:01.00'],
    [0.99949, 4, '00:00:00.999'],
    [0.9995, 4, '00:00:01.000'],
  ])(
    'rounds %s seconds once for format %s',
    (value, durationType, expected) => {
      expect(convertMS2Duration(value, durationType)).toBe(expected);
    }
  );

  it.each<[number, string]>([
    [0, '00:00'],
    [1, '00:00:00'],
    [2, '00:00:00.0'],
    [3, '00:00:00.00'],
    [4, '00:00:00.000'],
  ])('keeps zero padding for format %s', (durationType, expected) => {
    expect(convertMS2Duration(0, durationType)).toBe(expected);
  });

  it.each<[number, string]>([
    [1, '25:02:03'],
    [5, '1d 1h'],
    [6, '1d 01:02'],
    [7, '1d 01:02:03'],
    [8, '1d 1h 2m'],
    [9, '1d 1h 2m 3s'],
  ])('preserves truncation for format %s', (durationType, expected) => {
    expect(convertMS2Duration(90123.9999, durationType)).toBe(expected);
  });

  it('accepts numeric strings in seconds', () => {
    expect(convertMS2Duration('59.96', 2)).toBe('00:01:00.0');
    expect(convertMS2Duration('3570', 0)).toBe('01:00');
  });

  it.each(['', null, undefined])('preserves an empty value: %s', (value) => {
    expect(convertMS2Duration(value, 2)).toBe(value);
  });

  it('preserves values for an unknown format', () => {
    expect(convertMS2Duration(59.96, 10)).toBe(59.96);
  });
});
