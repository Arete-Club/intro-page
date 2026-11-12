import { describe, expect, it } from 'vitest';
import { headerState } from '../../src/scripts/header';

describe('N02/N03: fixed header state', () => {
  it('turns solid once the bright region no longer reaches below the header', () => {
    expect(headerState(true, 91, 91, 'light')).toBe('solid');
    expect(headerState(false, 40, 91)).toBe('solid');
    expect(headerState(false, -500, 72)).toBe('solid');
  });

  it('follows the scene ink while the pinned stage is under the header', () => {
    expect(headerState(true, 900, 91)).toBe('surface');
    expect(headerState(true, 900, 91, 'dark')).toBe('surface');
    expect(headerState(true, 92, 91, 'light')).toBe('scene');
  });

  it('keeps navy ink over the static hero, whatever the last scene ink was', () => {
    expect(headerState(false, 800, 91, 'light')).toBe('surface');
  });
});
