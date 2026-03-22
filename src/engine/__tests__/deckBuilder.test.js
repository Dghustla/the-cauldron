import { describe, it, expect } from 'vitest';
import {
  buildDeck,
  getPriceThreshold,
  calculateCardScore,
  getRoleTargets,
  isColorIdentityCompatible,
  selectCardsWithRole,
  calculateColorDistribution,
  buildManaBase,
  calculateStats,
  detectStrategy,
} from '../deckBuilder.js';

// ─── Test Helpers ─────────────────────────────────────────────────────

function makeCard(overrides = {}) {
  return {
    name: overrides.name || 'Test Card',
    manaCost: overrides.manaCost || '{2}{U}',
    cmc: overrides.cmc ?? 3,
    typeLine: overrides.typeLine || 'Creature — Human Wizard',
    oracleText: overrides.oracleText || '',
    colors: overrides.colors || ['U'],
    price: overrides.price ?? 1.0,
    image: '',
    imageSmall: '',
    imageNormal: '',
    rarity: 'common',
    set: 'TST',
    roles: overrides.roles || [],
    cardType: overrides.cardType || 'creature',
    synergy: overrides.synergy ?? 0.5,
    salt: overrides.salt ?? 0,
    num_decks: overrides.num_decks ?? 1000,
    label: overrides.label || 'test',
  };
}

function makeCommander(overrides = {}) {
  return {
    name: overrides.name || 'Test Commander',
    color_identity: overrides.color_identity || ['U', 'B'],
    cmc: overrides.cmc ?? 4,
    type_line: overrides.type_line || 'Legendary Creature — Zombie Wizard',
    image: '',
    mana_cost: overrides.mana_cost || '{2}{U}{B}',
    price: overrides.price ?? 5,
  };
}

// ─── getPriceThreshold ────────────────────────────────────────────────

describe('getPriceThreshold', () => {
  it('returns Infinity for null/undefined budget (unlimited)', () => {
    expect(getPriceThreshold(null)).toBe(Infinity);
    expect(getPriceThreshold(undefined)).toBe(Infinity);
  });

  it('returns Infinity for 0 or Infinity budget', () => {
    expect(getPriceThreshold(0)).toBe(Infinity);
    expect(getPriceThreshold(Infinity)).toBe(Infinity);
  });

  it('returns correct thresholds for each budget tier', () => {
    expect(getPriceThreshold(25)).toBe(3);
    expect(getPriceThreshold(50)).toBe(3);
    expect(getPriceThreshold(75)).toBe(8);
    expect(getPriceThreshold(100)).toBe(8);
    expect(getPriceThreshold(150)).toBe(15);
    expect(getPriceThreshold(200)).toBe(25);
    expect(getPriceThreshold(300)).toBe(50);
  });

  it('returns Infinity for budgets above 300', () => {
    expect(getPriceThreshold(500)).toBe(Infinity);
    expect(getPriceThreshold(1000)).toBe(Infinity);
  });
});

// ─── isColorIdentityCompatible ────────────────────────────────────────

describe('isColorIdentityCompatible', () => {
  it('colorless cards are always compatible', () => {
    expect(isColorIdentityCompatible([], ['U', 'B'])).toBe(true);
    expect(isColorIdentityCompatible(null, ['U', 'B'])).toBe(true);
    expect(isColorIdentityCompatible(undefined, ['R'])).toBe(true);
  });

  it('single color within identity is compatible', () => {
    expect(isColorIdentityCompatible(['U'], ['U', 'B'])).toBe(true);
    expect(isColorIdentityCompatible(['B'], ['U', 'B'])).toBe(true);
  });

  it('single color outside identity is incompatible', () => {
    expect(isColorIdentityCompatible(['R'], ['U', 'B'])).toBe(false);
    expect(isColorIdentityCompatible(['G'], ['U', 'B'])).toBe(false);
  });

  it('multi-color within identity is compatible', () => {
    expect(isColorIdentityCompatible(['U', 'B'], ['U', 'B', 'R'])).toBe(true);
  });

  it('multi-color partially outside identity is incompatible', () => {
    expect(isColorIdentityCompatible(['U', 'R'], ['U', 'B'])).toBe(false);
  });

  it('5-color commander accepts everything', () => {
    expect(isColorIdentityCompatible(['W', 'U', 'B', 'R', 'G'], ['W', 'U', 'B', 'R', 'G'])).toBe(true);
  });
});

// ─── getRoleTargets ───────────────────────────────────────────────────

describe('getRoleTargets', () => {
  it('competitive has more tutors and counters', () => {
    const targets = getRoleTargets('competitive', ['U', 'B']);
    expect(targets.tutor[1]).toBeGreaterThanOrEqual(4);
    expect(targets.counter[1]).toBeGreaterThanOrEqual(4);
  });

  it('casual disables tutors', () => {
    const targets = getRoleTargets('casual', ['U', 'B']);
    expect(targets.tutor).toEqual([0, 0]);
  });

  it('non-blue decks get no counterspells', () => {
    const targets = getRoleTargets('focused', ['R', 'G']);
    expect(targets.counter).toEqual([0, 0]);
  });

  it('blue decks get counterspells', () => {
    const targets = getRoleTargets('focused', ['U', 'R']);
    expect(targets.counter[1]).toBeGreaterThan(0);
  });

  it('all power levels include ramp, draw, removal, wipe', () => {
    for (const pl of ['competitive', 'optimized', 'focused', 'casual']) {
      const targets = getRoleTargets(pl, ['W', 'U']);
      expect(targets.ramp[1]).toBeGreaterThan(0);
      expect(targets.draw[1]).toBeGreaterThan(0);
      expect(targets.removal[1]).toBeGreaterThan(0);
      expect(targets.wipe[1]).toBeGreaterThan(0);
    }
  });

  it('defaults to focused-like targets for unknown power level', () => {
    const targets = getRoleTargets('unknown', ['U']);
    expect(targets.ramp).toEqual([10, 12]);
  });
});

// ─── calculateCardScore ──────────────────────────────────────────────

describe('calculateCardScore', () => {
  it('uses synergy as base score', () => {
    const card = makeCard({ synergy: 0.8, cmc: 5 });
    const score = calculateCardScore(card, 'focused');
    expect(score).toBeGreaterThanOrEqual(80); // 0.8 * 100
  });

  it('competitive rewards low CMC cards', () => {
    const lowCmc = makeCard({ synergy: 0.5, cmc: 1 });
    const highCmc = makeCard({ synergy: 0.5, cmc: 7 });
    const lowScore = calculateCardScore(lowCmc, 'competitive');
    const highScore = calculateCardScore(highCmc, 'competitive');
    expect(lowScore).toBeGreaterThan(highScore);
  });

  it('competitive rewards tutors', () => {
    const tutor = makeCard({ synergy: 0.5, roles: ['tutor'], cmc: 3 });
    const noTutor = makeCard({ synergy: 0.5, roles: [], cmc: 3 });
    expect(calculateCardScore(tutor, 'competitive')).toBeGreaterThan(
      calculateCardScore(noTutor, 'competitive')
    );
  });

  it('casual penalizes tutors', () => {
    const tutor = makeCard({ synergy: 0.5, roles: ['tutor'], cmc: 3 });
    const noTutor = makeCard({ synergy: 0.5, roles: [], cmc: 3 });
    expect(calculateCardScore(tutor, 'casual')).toBeLessThan(
      calculateCardScore(noTutor, 'casual')
    );
  });

  it('casual penalizes stax/lock effects', () => {
    const stax = makeCard({ synergy: 0.5, oracleText: "Creatures can't attack. Stax effect." });
    const normal = makeCard({ synergy: 0.5, oracleText: 'Draw a card.' });
    expect(calculateCardScore(stax, 'casual')).toBeLessThan(
      calculateCardScore(normal, 'casual')
    );
  });

  it('competitive rewards fast mana by name', () => {
    const solRing = makeCard({ name: 'Sol Ring', synergy: 0.5, cmc: 1 });
    const randomCard = makeCard({ name: 'Random Card', synergy: 0.5, cmc: 1 });
    expect(calculateCardScore(solRing, 'competitive')).toBeGreaterThan(
      calculateCardScore(randomCard, 'competitive')
    );
  });

  it('competitive penalizes high CMC cards', () => {
    const card8 = makeCard({ synergy: 0.5, cmc: 8 });
    const card3 = makeCard({ synergy: 0.5, cmc: 3 });
    const score8 = calculateCardScore(card8, 'competitive');
    const score3 = calculateCardScore(card3, 'competitive');
    expect(score8).toBeLessThan(score3);
  });

  it('boosts popular cards (high num_decks)', () => {
    const popular = makeCard({ synergy: 0.5, num_decks: 60000, cmc: 4 });
    const niche = makeCard({ synergy: 0.5, num_decks: 100, cmc: 4 });
    expect(calculateCardScore(popular, 'focused')).toBeGreaterThan(
      calculateCardScore(niche, 'focused')
    );
  });

  it('handles missing oracleText and roles gracefully', () => {
    const card = makeCard({ synergy: 0.3, oracleText: undefined, roles: undefined });
    // Should not throw
    expect(() => calculateCardScore(card, 'competitive')).not.toThrow();
  });
});

// ─── selectCardsWithRole ──────────────────────────────────────────────

describe('selectCardsWithRole', () => {
  const rampCards = [
    makeCard({ name: 'Ramp A', roles: ['ramp'] }),
    makeCard({ name: 'Ramp B', roles: ['ramp'] }),
    makeCard({ name: 'Ramp C', roles: ['ramp'] }),
    makeCard({ name: 'Ramp D', roles: ['ramp'] }),
    makeCard({ name: 'No Role', roles: [] }),
  ];

  it('selects cards with the specified role', () => {
    const result = selectCardsWithRole(rampCards, 'ramp', 2, 3, []);
    expect(result.length).toBe(3);
    expect(result.every((c) => c.roles.includes('ramp'))).toBe(true);
  });

  it('respects minCount when fewer candidates exist', () => {
    const result = selectCardsWithRole(rampCards, 'ramp', 2, 10, []);
    expect(result.length).toBe(4); // only 4 ramp cards exist
  });

  it('skips already selected cards', () => {
    const alreadySelected = [makeCard({ name: 'Ramp A' })];
    const result = selectCardsWithRole(rampCards, 'ramp', 1, 3, alreadySelected);
    expect(result.find((c) => c.name === 'Ramp A')).toBeUndefined();
  });

  it('returns empty when no cards have the role', () => {
    const noRoleCards = [makeCard({ name: 'X', roles: [] })];
    const result = selectCardsWithRole(noRoleCards, 'ramp', 2, 3, []);
    expect(result.length).toBe(0);
  });

  it('handles empty input arrays', () => {
    const result = selectCardsWithRole([], 'ramp', 2, 3, []);
    expect(result.length).toBe(0);
  });
});

// ─── calculateColorDistribution ──────────────────────────────────────

describe('calculateColorDistribution', () => {
  it('counts color pips from mana costs', () => {
    const cards = [
      makeCard({ colors: ['U'], manaCost: '{U}{U}' }),
      makeCard({ colors: ['B'], manaCost: '{1}{B}' }),
    ];
    const dist = calculateColorDistribution(cards);
    expect(dist.U).toBe(2);
    expect(dist.B).toBe(1);
    expect(dist.W).toBe(0);
  });

  it('handles colorless cards', () => {
    const cards = [makeCard({ colors: [], manaCost: '{3}' })];
    const dist = calculateColorDistribution(cards);
    expect(dist.W).toBe(0);
    expect(dist.U).toBe(0);
  });

  it('handles empty array', () => {
    const dist = calculateColorDistribution([]);
    expect(dist).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0 });
  });

  it('handles multi-color cards', () => {
    const cards = [makeCard({ colors: ['W', 'U'], manaCost: '{W}{U}{U}' })];
    const dist = calculateColorDistribution(cards);
    expect(dist.W).toBe(1);
    expect(dist.U).toBe(2);
  });
});

// ─── buildManaBase ────────────────────────────────────────────────────

describe('buildManaBase', () => {
  it('returns exactly the requested land count', () => {
    const dist = { W: 0, U: 10, B: 10, R: 0, G: 0 };
    const lands = buildManaBase(['U', 'B'], dist, 100, 36, 'focused');
    expect(lands.length).toBe(36);
  });

  it('always includes Command Tower', () => {
    const dist = { W: 5, U: 5, B: 5, R: 5, G: 5 };
    const lands = buildManaBase(['W', 'U', 'B', 'R', 'G'], dist, 100, 37, 'focused');
    expect(lands.some((l) => l.name === 'Command Tower')).toBe(true);
  });

  it('includes fetch lands for high budget', () => {
    const dist = { W: 0, U: 10, B: 10, R: 0, G: 0 };
    const lands = buildManaBase(['U', 'B'], dist, 250, 37, 'optimized');
    expect(lands.some((l) => l.name === 'Polluted Delta')).toBe(true);
  });

  it('excludes fetch lands for low budget casual', () => {
    const dist = { W: 0, U: 10, B: 10, R: 0, G: 0 };
    const lands = buildManaBase(['U', 'B'], dist, 50, 37, 'casual');
    expect(lands.some((l) => l.name === 'Polluted Delta')).toBe(false);
  });

  it('includes bounce lands for budget/casual', () => {
    const dist = { W: 0, U: 10, B: 10, R: 0, G: 0 };
    const lands = buildManaBase(['U', 'B'], dist, 50, 37, 'casual');
    expect(lands.some((l) => l.name === 'Dimir Aqueduct')).toBe(true);
  });

  it('includes shock lands for mid budget', () => {
    const dist = { W: 0, U: 10, B: 10, R: 0, G: 0 };
    const lands = buildManaBase(['U', 'B'], dist, 100, 37, 'focused');
    expect(lands.some((l) => l.name === 'Watery Grave')).toBe(true);
  });

  it('does not include duplicate lands', () => {
    const dist = { W: 5, U: 5, B: 5, R: 5, G: 5 };
    const lands = buildManaBase(['W', 'U', 'B', 'R', 'G'], dist, 300, 38, 'competitive');
    const nonBasicNames = lands.filter((l) => l.typeLine !== 'Basic Land').map((l) => l.name);
    const uniqueNames = new Set(nonBasicNames);
    expect(nonBasicNames.length).toBe(uniqueNames.size);
  });

  it('includes basics proportional to color distribution', () => {
    const dist = { W: 0, U: 20, B: 5, R: 0, G: 0 };
    const lands = buildManaBase(['U', 'B'], dist, 50, 37, 'casual');
    const islands = lands.filter((l) => l.name === 'Island').length;
    const swamps = lands.filter((l) => l.name === 'Swamp').length;
    expect(islands).toBeGreaterThan(swamps);
  });

  it('handles mono-color identity', () => {
    const dist = { W: 0, U: 0, B: 0, R: 20, G: 0 };
    const lands = buildManaBase(['R'], dist, 50, 37, 'focused');
    expect(lands.length).toBe(37);
    // Should have Command Tower + mostly Mountains
    const mountains = lands.filter((l) => l.name === 'Mountain').length;
    expect(mountains).toBeGreaterThan(30);
  });

  it('includes rainbow lands for 3+ colors', () => {
    const dist = { W: 5, U: 5, B: 5, R: 0, G: 0 };
    const lands = buildManaBase(['W', 'U', 'B'], dist, 150, 37, 'focused');
    expect(lands.some((l) => l.name === 'Mana Confluence')).toBe(true);
    expect(lands.some((l) => l.name === 'City of Brass')).toBe(true);
  });

  it('includes Ancient Tomb for competitive', () => {
    const dist = { W: 0, U: 10, B: 10, R: 0, G: 0 };
    const lands = buildManaBase(['U', 'B'], dist, 200, 37, 'competitive');
    expect(lands.some((l) => l.name === 'Ancient Tomb')).toBe(true);
  });
});

// ─── calculateStats ──────────────────────────────────────────────────

describe('calculateStats', () => {
  it('calculates average mana cost correctly', () => {
    const cards = [
      makeCard({ cmc: 2 }),
      makeCard({ cmc: 4 }),
      makeCard({ cmc: 6 }),
    ];
    const stats = calculateStats(cards, [], makeCommander(), 100);
    expect(stats.avgManaCost).toBe(4);
  });

  it('handles empty card list', () => {
    const stats = calculateStats([], [], makeCommander(), 100);
    expect(stats.avgManaCost).toBe(0);
  });

  it('clamps mana curve at 7+', () => {
    const cards = [
      makeCard({ cmc: 10 }),
      makeCard({ cmc: 8 }),
      makeCard({ cmc: 7 }),
    ];
    const stats = calculateStats(cards, [], makeCommander(), 100);
    expect(stats.manaCurve[7]).toBe(3); // all 3 clamped to 7
    expect(stats.manaCurve[6]).toBe(0);
  });

  it('counts color distribution', () => {
    const cards = [
      makeCard({ colors: ['U'] }),
      makeCard({ colors: ['U'] }),
      makeCard({ colors: ['B'] }),
    ];
    const stats = calculateStats(cards, [], makeCommander(), 100);
    expect(stats.colorDistribution.U).toBe(2);
    expect(stats.colorDistribution.B).toBe(1);
  });

  it('counts role distribution', () => {
    const cards = [
      makeCard({ roles: ['ramp'] }),
      makeCard({ roles: ['ramp', 'draw'] }),
      makeCard({ roles: ['removal'] }),
    ];
    const stats = calculateStats(cards, [], makeCommander(), 100);
    expect(stats.roleDistribution.ramp).toBe(2);
    expect(stats.roleDistribution.draw).toBe(1);
    expect(stats.roleDistribution.removal).toBe(1);
  });

  it('counts card type distribution', () => {
    const cards = [
      makeCard({ cardType: 'creature' }),
      makeCard({ cardType: 'creature' }),
      makeCard({ cardType: 'instant' }),
    ];
    const stats = calculateStats(cards, [], makeCommander(), 100);
    expect(stats.cardTypeDistribution.creature).toBe(2);
    expect(stats.cardTypeDistribution.instant).toBe(1);
  });

  it('calculates estimated cost including commander and lands', () => {
    const cards = [makeCard({ price: 5 }), makeCard({ price: 10 })];
    const lands = [makeCard({ price: 2 })];
    const commander = makeCommander({ price: 20 });
    const stats = calculateStats(cards, lands, commander, 100);
    expect(stats.estimatedCost).toBe(37); // 20 + 5 + 10 + 2
  });

  it('card count includes commander (+1)', () => {
    const cards = [makeCard(), makeCard()];
    const lands = [makeCard()];
    const stats = calculateStats(cards, lands, makeCommander(), 100);
    expect(stats.cardCount).toBe(4); // 2 cards + 1 land + 1 commander
  });
});

// ─── detectStrategy ──────────────────────────────────────────────────

describe('detectStrategy', () => {
  it('detects Voltron with equipment', () => {
    const cards = [
      makeCard({ typeLine: 'Artifact — Equipment' }),
      makeCard({ typeLine: 'Artifact — Equipment' }),
      makeCard({ typeLine: 'Artifact — Equipment' }),
    ];
    const result = detectStrategy(makeCommander(), cards);
    expect(result).toContain('Voltron');
  });

  it('detects Voltron with auras', () => {
    const cards = Array.from({ length: 5 }, (_, i) =>
      makeCard({ name: `Aura ${i}`, typeLine: 'Enchantment — Aura' })
    );
    const result = detectStrategy(makeCommander(), cards);
    expect(result).toContain('Voltron');
  });

  it('detects Token strategy when commander name contains "token"', () => {
    const commander = makeCommander({ name: 'Token Master' });
    const result = detectStrategy(commander, []);
    expect(result).toContain('Token');
  });

  it('detects Token strategy with many token-creating cards', () => {
    const cards = Array.from({ length: 12 }, (_, i) =>
      makeCard({ name: `Token Maker ${i}`, oracleText: 'Create a 1/1 white Soldier creature token.' })
    );
    const result = detectStrategy(makeCommander(), cards);
    expect(result).toContain('Token');
  });

  it('does NOT falsely detect tokens from incidental create text', () => {
    // Only 2 cards with token creation — not enough
    const cards = [
      makeCard({ oracleText: 'Create a Treasure token.' }),
      makeCard({ oracleText: 'Create a 1/1 creature token.' }),
      makeCard({ oracleText: 'Draw a card.' }),
    ];
    const result = detectStrategy(makeCommander(), cards);
    expect(result).not.toContain('Token');
  });

  it('detects Aggro with many creatures', () => {
    const cards = Array.from({ length: 26 }, (_, i) =>
      makeCard({ name: `Creature ${i}`, cardType: 'creature', oracleText: '' })
    );
    const result = detectStrategy(makeCommander(), cards);
    expect(result).toContain('Aggro');
  });

  it('returns Goodstuff as fallback', () => {
    const cards = [makeCard({ oracleText: 'Do nothing special.' })];
    const result = detectStrategy(makeCommander(), cards);
    expect(result).toContain('Goodstuff');
  });
});

// ─── buildDeck (integration) ─────────────────────────────────────────

describe('buildDeck', () => {
  // Generate enough test cards for a full deck
  function generateTestCards(count) {
    const roles = ['ramp', 'draw', 'removal', 'wipe', 'counter'];
    return Array.from({ length: count }, (_, i) => {
      const role = roles[i % roles.length];
      return makeCard({
        name: `Card ${i}`,
        synergy: 0.5 + (i % 10) * 0.05,
        roles: [role],
        cmc: (i % 6) + 1,
        price: 1 + (i % 5),
        colors: ['U'],
        cardType: i % 3 === 0 ? 'creature' : i % 3 === 1 ? 'instant' : 'sorcery',
      });
    });
  }

  function generateEdhrecCards(count) {
    return Array.from({ length: count }, (_, i) => ({
      name: `Card ${i}`,
      synergy: 0.5 + (i % 10) * 0.05,
      salt: 0,
      num_decks: 1000 + i * 100,
      label: 'test',
    }));
  }

  it('throws on invalid commanderData', () => {
    expect(() => buildDeck(null, [], [])).toThrow('commanderData');
    expect(() => buildDeck({}, [], [])).toThrow('commanderData');
    expect(() => buildDeck({ name: 'X' }, [], [])).toThrow('commanderData');
  });

  it('throws on non-array edhrecCards', () => {
    const commander = makeCommander();
    expect(() => buildDeck(commander, 'not array', [])).toThrow('edhrecCards');
  });

  it('throws on non-array scryfallCards', () => {
    const commander = makeCommander();
    expect(() => buildDeck(commander, [], null)).toThrow('scryfallCards');
  });

  it('builds a 99-card deck (+ commander = 100)', () => {
    const commander = makeCommander({ color_identity: ['U', 'B'] });
    const scryfallCards = generateTestCards(200);
    const edhrecCards = generateEdhrecCards(200);

    const deck = buildDeck(commander, edhrecCards, scryfallCards, {
      budget: 100,
      powerLevel: 'focused',
    });

    const totalCards = deck.cards.length + deck.lands.length;
    expect(totalCards).toBe(99);
  });

  it('returns correct structure', () => {
    const commander = makeCommander({ color_identity: ['U', 'B'] });
    const scryfallCards = generateTestCards(200);
    const edhrecCards = generateEdhrecCards(200);

    const deck = buildDeck(commander, edhrecCards, scryfallCards);

    expect(deck).toHaveProperty('commander');
    expect(deck).toHaveProperty('cards');
    expect(deck).toHaveProperty('lands');
    expect(deck).toHaveProperty('stats');
    expect(deck).toHaveProperty('strategy');
    expect(deck.commander.name).toBe(commander.name);
  });

  it('does not include duplicate card names in nonland section', () => {
    const commander = makeCommander({ color_identity: ['U', 'B'] });
    const scryfallCards = generateTestCards(200);
    const edhrecCards = generateEdhrecCards(200);

    const deck = buildDeck(commander, edhrecCards, scryfallCards);

    const names = deck.cards.map((c) => c.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('respects budget filtering', () => {
    const commander = makeCommander({ color_identity: ['U', 'B'] });
    const expensiveCards = Array.from({ length: 200 }, (_, i) =>
      makeCard({
        name: `Card ${i}`,
        price: i < 100 ? 2 : 50, // half cheap, half expensive
        roles: ['ramp'],
        colors: ['U'],
      })
    );
    const edhrecCards = generateEdhrecCards(200);

    const deck = buildDeck(commander, edhrecCards, expensiveCards, {
      budget: 50, // max card price = $3
    });

    // No card should exceed the budget threshold
    const maxPrice = getPriceThreshold(50);
    for (const card of deck.cards) {
      expect(card.price <= maxPrice || card.price === 0).toBe(true);
    }
  });

  it('handles empty card pools gracefully', () => {
    const commander = makeCommander({ color_identity: ['U', 'B'] });
    const deck = buildDeck(commander, [], []);
    // Should still produce a deck (all lands)
    expect(deck.lands.length).toBe(99);
    expect(deck.cards.length).toBe(0);
  });
});
