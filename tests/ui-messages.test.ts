import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getFriendlyErrorMessage } from '../apps/desktop/src/ui/errorMessages';

const DESKTOP = path.join(process.cwd(), 'apps', 'desktop');

describe('user-facing error messages (never raw technical text)', () => {
  it('maps updater fallback-platforms error to a friendly message', () => {
    const raw = 'None of the fallback platforms ["windows-x86_64-nsis", "windows-x86_64"] were found in the response `platforms` object';
    const msg = getFriendlyErrorMessage(new Error(raw), 'fallback');
    expect(msg).toBe('Update information is unavailable right now. Please try again later.');
    expect(msg).not.toContain('fallback');
    expect(msg).not.toContain('platforms');
  });

  it('maps invalid release JSON error to a friendly message', () => {
    const msg = getFriendlyErrorMessage(
      new Error('Could not fetch a valid release JSON from the remote'),
      'fallback',
    );
    expect(msg).toBe('Update information is unavailable right now. Please try again later.');
  });

  it('maps bot-check failure to a wait-and-retry message', () => {
    const msg = getFriendlyErrorMessage(
      new Error("ERROR: [youtube] x: Sign in to confirm you're not a bot"),
      'fallback',
    );
    expect(msg).toContain('temporarily blocking');
    expect(msg).not.toContain('429');
  });

  it('never leaks unknown raw errors (generic friendly fallback)', () => {
    const weird = 'UnhandledPromiseRejection: kaboom xyz123';
    const msg = getFriendlyErrorMessage(new Error(weird), 'Custom fallback here.');
    expect(msg).not.toContain('kaboom');
    expect(msg).not.toContain('UnhandledPromiseRejection');
  });

  it('prefers caller fallback only when it is a real message', () => {
    expect(getFriendlyErrorMessage(new Error('???'), '')).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

describe('translation tables (EN/BN key parity)', () => {
  function sectionKeys(src: string, startMarker: string, endMarker: string): string[] {
    const start = src.indexOf(startMarker);
    const end = src.indexOf(endMarker, start + startMarker.length);
    const body = src.slice(start, end < 0 ? undefined : end);
    const keys = new Set<string>();
    for (const m of body.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)) {
      if (m[1] === 'en' || m[1] === 'bn') continue; // section header itself
      keys.add(m[1]);
    }
    return [...keys].sort();
  }

  it('interface, en and bn expose exactly the same keys', () => {
    const src = fs.readFileSync(
      path.join(DESKTOP, 'src', 'ui', 'hooks', 'useTranslations.tsx'),
      'utf8',
    );
    const iface = sectionKeys(src, 'type Translations = {', '};');
    const en = sectionKeys(src, 'en: {', 'bn: {');
    const bn = sectionKeys(src, 'bn: {', 'interface TranslationContextValue');
    expect(en).toEqual(iface);
    expect(bn).toEqual(iface);
    expect(iface.length).toBeGreaterThan(150);
  });
});
