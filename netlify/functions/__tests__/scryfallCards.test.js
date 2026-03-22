import { describe, it, expect } from 'vitest';
import { extractRoles } from '../scryfallCards.js';

describe('extractRoles', () => {
  describe('ramp detection', () => {
    it('detects mana addition', () => {
      expect(extractRoles('Add {G}.')).toContain('ramp');
      expect(extractRoles('{T}: Add one mana of any color.')).toContain('ramp');
    });

    it('detects land search', () => {
      expect(extractRoles('Search your library for a basic land card')).toContain('ramp');
    });

    it('detects treasure creation', () => {
      expect(extractRoles('Create a Treasure token.')).toContain('ramp');
      expect(extractRoles('creates two treasure tokens')).toContain('ramp');
    });
  });

  describe('draw detection', () => {
    it('detects draw a card', () => {
      expect(extractRoles('draw a card')).toContain('draw');
    });

    it('detects draw N cards', () => {
      expect(extractRoles('draw 3 cards')).toContain('draw');
    });

    it('does not false-positive on unrelated text', () => {
      expect(extractRoles('Destroy target creature.')).not.toContain('draw');
    });
  });

  describe('removal detection', () => {
    it('detects destroy target', () => {
      expect(extractRoles('Destroy target creature.')).toContain('removal');
    });

    it('detects exile target', () => {
      expect(extractRoles('Exile target artifact.')).toContain('removal');
    });

    it('detects damage to target', () => {
      expect(extractRoles('deals 3 damage to target creature')).toContain('removal');
    });

    it('detects -X/-X effects', () => {
      expect(extractRoles('Target creature gets -3/-3 until end of turn.')).toContain('removal');
    });
  });

  describe('wipe detection', () => {
    it('detects destroy all', () => {
      expect(extractRoles('Destroy all creatures.')).toContain('wipe');
    });

    it('detects exile all', () => {
      expect(extractRoles('Exile all artifacts and enchantments.')).toContain('wipe');
    });
  });

  describe('counter detection', () => {
    it('detects counter target', () => {
      expect(extractRoles('Counter target spell.')).toContain('counter');
    });

    it('does not false-positive on counters (as in +1/+1 counters)', () => {
      expect(extractRoles('Put a +1/+1 counter on target creature.')).not.toContain('counter');
    });
  });

  describe('tutor detection', () => {
    it('detects library search for non-land cards', () => {
      expect(extractRoles('Search your library for a card')).toContain('tutor');
    });

    it('does NOT classify land search as tutor', () => {
      const roles = extractRoles('Search your library for a basic land card');
      expect(roles).toContain('ramp');
      expect(roles).not.toContain('tutor');
    });
  });

  describe('protection detection', () => {
    it('detects hexproof', () => {
      expect(extractRoles('Hexproof')).toContain('protection');
    });

    it('detects indestructible', () => {
      expect(extractRoles('Indestructible')).toContain('protection');
    });

    it('detects ward', () => {
      expect(extractRoles('Ward {2}')).toContain('protection');
    });

    it('detects shroud', () => {
      expect(extractRoles('Shroud')).toContain('protection');
    });

    it('detects protection from', () => {
      expect(extractRoles('Protection from black')).toContain('protection');
    });
  });

  describe('multi-role cards', () => {
    it('can assign multiple roles', () => {
      const roles = extractRoles('Draw a card. Destroy target creature.');
      expect(roles).toContain('draw');
      expect(roles).toContain('removal');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(extractRoles('')).toEqual([]);
    });

    it('handles complex multi-line oracle text', () => {
      const text = 'When this enters, search your library for a card and put it into your hand. Draw a card.';
      const roles = extractRoles(text);
      expect(roles).toContain('tutor');
      expect(roles).toContain('draw');
    });
  });
});
