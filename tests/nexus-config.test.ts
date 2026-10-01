import { describe, expect, it } from 'vitest';
import {
  isNexusConfigured,
  toNexusConfig,
} from '../apps/desktop/src/native/tauriBridge';

describe('nexus settings config helpers', () => {
  it('trims fields', () => {
    const c = toNexusConfig(' https://n.example.com/ ', '  key-1 ', ' app-1 ');
    expect(c).toEqual({ baseUrl: 'https://n.example.com/', apiKey: 'key-1', appId: 'app-1' });
  });

  it('requires key + app id (url optional, backend defaults it)', () => {
    expect(isNexusConfigured(toNexusConfig('', 'k', 'a'))).toBe(true);
    expect(isNexusConfigured(toNexusConfig('', '', 'a'))).toBe(false);
    expect(isNexusConfigured(toNexusConfig('', 'k', ''))).toBe(false);
    expect(isNexusConfigured(toNexusConfig('', '  ', 'a'))).toBe(false);
  });
});
