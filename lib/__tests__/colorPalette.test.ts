import { withAlpha } from '../colorPalette';

describe('withAlpha', () => {
  test('converts a hex color to an rgba string with the given alpha', () => {
    expect(withAlpha('#2563eb', 0.5)).toBe('rgba(37, 99, 235, 0.5)');
  });

  test('handles pure black and white', () => {
    expect(withAlpha('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('#ffffff', 0.3)).toBe('rgba(255, 255, 255, 0.3)');
  });
});
