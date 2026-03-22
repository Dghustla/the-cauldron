import { describe, it, expect } from 'vitest';
import { getCardType } from '../cardTypes.js';

describe('getCardType', () => {
  it('returns creature for creature type lines', () => {
    expect(getCardType('Creature — Human Wizard')).toBe('creature');
    expect(getCardType('Legendary Creature — Elf Warrior')).toBe('creature');
  });

  it('returns creature for artifact creatures (creature takes priority)', () => {
    expect(getCardType('Artifact Creature — Golem')).toBe('creature');
  });

  it('returns creature for enchantment creatures', () => {
    expect(getCardType('Enchantment Creature — God')).toBe('creature');
  });

  it('returns instant', () => {
    expect(getCardType('Instant')).toBe('instant');
  });

  it('returns sorcery', () => {
    expect(getCardType('Sorcery')).toBe('sorcery');
  });

  it('returns enchantment', () => {
    expect(getCardType('Enchantment — Aura')).toBe('enchantment');
  });

  it('returns artifact', () => {
    expect(getCardType('Artifact — Equipment')).toBe('artifact');
    expect(getCardType('Legendary Artifact')).toBe('artifact');
  });

  it('returns planeswalker', () => {
    expect(getCardType('Legendary Planeswalker — Jace')).toBe('planeswalker');
  });

  it('returns land', () => {
    expect(getCardType('Land')).toBe('land');
    expect(getCardType('Basic Land — Forest')).toBe('land');
  });

  it('returns other for unrecognized types', () => {
    expect(getCardType('Tribal Instant')).toBe('instant');
    expect(getCardType('Conspiracy')).toBe('other');
    expect(getCardType('')).toBe('other');
  });

  it('handles null/undefined input', () => {
    expect(getCardType(null)).toBe('other');
    expect(getCardType(undefined)).toBe('other');
  });

  it('is case insensitive', () => {
    expect(getCardType('CREATURE')).toBe('creature');
    expect(getCardType('Instant')).toBe('instant');
    expect(getCardType('LAND')).toBe('land');
  });
});
