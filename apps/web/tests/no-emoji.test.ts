import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('no emoji in the UI (SC-005)', () => {
  it('has no pictographic characters in any component', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/\p{Extended_Pictographic}/u.test(line)) {
            offenders.push(`${relative(SRC, file)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
