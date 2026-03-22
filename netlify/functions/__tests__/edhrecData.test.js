import { describe, it, expect } from 'vitest';
import { slugifyCommanderName } from '../edhrecData.js';

describe('slugifyCommanderName', () => {
  it('converts basic name to slug', () => {
    expect(slugifyCommanderName('Zur the Enchanter')).toBe('zur-the-enchanter');
  });

  it('removes apostrophes and commas', () => {
    expect(slugifyCommanderName("Atraxa, Praetors' Voice")).toBe('atraxa-praetors-voice');
  });

  it('removes ampersands', () => {
    expect(slugifyCommanderName('Bebop & Rocksteady')).toBe('bebop-rocksteady');
  });

  it('uses only front face of double-faced cards', () => {
    expect(slugifyCommanderName("Nashi, Moon's Legacy // Nashi, Moon's Legacy")).toBe('nashi-moons-legacy');
  });

  it('collapses multiple hyphens', () => {
    expect(slugifyCommanderName('Some -- Commander')).toBe('some-commander');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugifyCommanderName("'Commander Name'")).toBe('commander-name');
  });

  it('handles all lowercase input', () => {
    expect(slugifyCommanderName('sol ring')).toBe('sol-ring');
  });

  it('removes special characters', () => {
    expect(slugifyCommanderName('Commander (Test) [v2]')).toBe('commander-test-v2');
  });

  it('handles single word', () => {
    expect(slugifyCommanderName('Omnath')).toBe('omnath');
  });

  it('handles extra whitespace', () => {
    expect(slugifyCommanderName('  Commander   Name  ')).toBe('commander-name');
  });
});
