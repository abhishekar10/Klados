import { bucketIntensity } from '../streakIntensity';

describe('bucketIntensity', () => {
  test('zero or negative fraction is none', () => {
    expect(bucketIntensity(0)).toBe('none');
    expect(bucketIntensity(-0.1)).toBe('none');
  });

  test('below 25% is low', () => {
    expect(bucketIntensity(0.1)).toBe('low');
    expect(bucketIntensity(0.24)).toBe('low');
  });

  test('25% up to but not including 75% is medium', () => {
    expect(bucketIntensity(0.25)).toBe('medium');
    expect(bucketIntensity(0.5)).toBe('medium');
    expect(bucketIntensity(0.74)).toBe('medium');
  });

  test('75% and above is high', () => {
    expect(bucketIntensity(0.75)).toBe('high');
    expect(bucketIntensity(1)).toBe('high');
  });
});
