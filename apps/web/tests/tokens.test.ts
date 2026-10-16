import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../src/styles/tokens.css'), 'utf8');
const mediaAt = css.indexOf('@media (prefers-color-scheme: dark)');
const lightCss = css.slice(0, mediaAt);
const darkCss = css.slice(mediaAt);

function parse(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}
const light = parse(lightCss);
const dark = { ...light, ...parse(darkCss) };

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('design tokens', () => {
  it('defines exactly five font sizes', () => {
    const sizes = Object.keys(light).filter((k) => k.startsWith('--font-size-'));
    expect(sizes.sort()).toEqual(
      [
        '--font-size-lg',
        '--font-size-md',
        '--font-size-sm',
        '--font-size-xl',
        '--font-size-xs',
      ].sort(),
    );
  });

  it('defines every token family from the UI contract', () => {
    const names = [
      ...[
        'bg',
        'surface',
        'border',
        'border-strong',
        'text',
        'text-muted',
        'accent',
        'accent-soft',
      ],
      ...['on-accent', 'activity', 'activity-bg', 'food', 'food-bg', 'meal-label', 'header-bg'],
      ...['meal-row', 'meal-icon'],
      ...['header-text'],
      ...['header-muted', 'greyed-hatch', 'danger', 'focus'],
    ].map((n) => `--color-${n}`);
    for (let i = 1; i <= 8; i++) names.push(`--space-${i}`);
    for (const r of ['xs', 'sm', 'md', 'pill']) names.push(`--radius-${r}`);
    for (const s of ['1', '2', 'drag']) names.push(`--shadow-${s}`);
    for (const s of ['chip', 'row-min', 'header', 'block-label', 'day-column', 'panel', 'icon']) {
      names.push(`--size-${s}`);
    }
    names.push('--size-icon-button', '--size-touch', '--font-family');
    for (const n of names) expect(light[n], n).toBeDefined();
  });

  const pairs: [string, string][] = [
    ['text', 'bg'],
    ['text-muted', 'bg'],
    ['text', 'surface'],
    ['on-accent', 'accent'],
    ['activity', 'activity-bg'],
    ['food', 'food-bg'],
    ['text', 'meal-row'],
    ['text-muted', 'meal-row'],
    ['text', 'meal-label'],
    ['text-muted', 'meal-label'],
    ['meal-icon', 'meal-label'],
    ['header-text', 'header-bg'],
    ['header-muted', 'header-bg'],
  ];
  for (const [theme, values] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const [fg, bg] of pairs) {
      it(`${theme}: ${fg} on ${bg} meets 4.5:1`, () => {
        expect(contrast(values[`--color-${fg}`]!, values[`--color-${bg}`]!)).toBeGreaterThanOrEqual(
          4.5,
        );
      });
    }
  }

  // Weather glyphs are non-text graphics: WCAG 1.4.11 asks for 3:1 against what they sit on.
  const weather = ['clear', 'partly-cloudy', 'cloudy', 'fog', 'rain', 'snow', 'thunderstorm'];
  for (const [theme, values] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const w of weather) {
      for (const bg of ['bg', 'surface', 'accent-soft']) {
        it(`${theme}: weather-${w} on ${bg} meets 3:1`, () => {
          const fg = values[`--color-weather-${w}`];
          expect(fg, `--color-weather-${w}`).toBeDefined();
          expect(contrast(fg!, values[`--color-${bg}`]!)).toBeGreaterThanOrEqual(3);
        });
      }
    }
  }
});
