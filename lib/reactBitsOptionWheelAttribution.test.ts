import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const noticePath = fileURLToPath(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url));
const tickPath = fileURLToPath(new URL('../public/assets/sounds/click-soft.mp3', import.meta.url));
const licenseDelimiter = 'MIT + Commons Clause License Condition v1.0';
const upstreamLicense = `${licenseDelimiter}

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

function normalizeLicenseText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\n$/, '');
}

describe('React Bits Option Wheel attribution', () => {
  it('includes the required upstream license notice', () => {
    expect(existsSync(noticePath)).toBe(true);

    const notice = readFileSync(noticePath, 'utf8');
    expect(notice).toContain('React Bits Option Wheel');
    expect(notice).toContain('Copyright (c) 2026 David Haz');
    expect(notice).toContain('Commons Clause License Condition v1.0');
    expect(notice).toContain('https://github.com/DavidHDev/react-bits');
    expect(notice).toContain('https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md');

    const licenseStart = notice.indexOf(licenseDelimiter);
    expect(licenseStart).toBeGreaterThanOrEqual(0);
    expect(Buffer.byteLength(upstreamLicense)).toBe(1303);
    expect(normalizeLicenseText(notice.slice(licenseStart))).toBe(normalizeLicenseText(upstreamLicense));
  });

  it('includes the local React Bits selection tick asset', () => {
    expect(existsSync(tickPath)).toBe(true);

    const tick = readFileSync(tickPath);
    expect(statSync(tickPath).size).toBe(669);
    expect(tick.length).toBe(669);
    expect(tick.subarray(0, 3).toString('ascii')).toBe('ID3');
    expect(createHash('sha256').update(tick).digest('hex')).toBe(
      'f48d32b27fc23a4702db92d1bc2a0b6e0150bc4e6c0688a170a7cd0bb9192541',
    );
  });
});
