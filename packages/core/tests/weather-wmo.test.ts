import { describe, expect, it } from 'vitest';
import { conditionFromWmo } from '../src/weather/wmo';

describe('conditionFromWmo', () => {
  it.each([
    [0, 'clear'],
    [1, 'clear'],
    [2, 'partly-cloudy'],
    [3, 'cloudy'],
    [45, 'fog'],
    [48, 'fog'],
    [51, 'rain'],
    [61, 'rain'],
    [67, 'rain'],
    [80, 'rain'],
    [82, 'rain'],
    [71, 'snow'],
    [77, 'snow'],
    [85, 'snow'],
    [86, 'snow'],
    [95, 'thunderstorm'],
    [99, 'thunderstorm'],
  ])('maps code %i to %s', (code, condition) => {
    expect(conditionFromWmo(code)).toBe(condition);
  });

  it('treats unknown codes as cloudy', () => {
    expect(conditionFromWmo(999)).toBe('cloudy');
    expect(conditionFromWmo(-1)).toBe('cloudy');
  });
});
