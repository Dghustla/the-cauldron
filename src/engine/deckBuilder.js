/**
 * The Cauldron v2 - MTG Commander Deck Building Engine
 * Pure JavaScript module for building balanced 100-card Commander decks
 */

import { getCardType } from '../utils/cardTypes.js';

/**
 * Main deck building function
 * @param {Object} commanderData - { name, color_identity, cmc, type_line, image, mana_cost }
 * @param {Array} edhrecCards - [{ name, synergy, salt, num_decks, label }]
 * @param {Array} scryfallCards - [{ name, cmc, typeLine, roles, price, ... }]
 * @param {Object} options - { budget, powerLevel }
 * @returns {Object} Complete deck object
 */
export function buildDeck(commanderData, edhrecCards, scryfallCards, options = {}) {
  if (!commanderData || !commanderData.name || !Array.isArray(commanderData.color_identity)) {
    throw new Error('commanderData must include name and color_identity array');
  }
  if (!Array.isArray(edhrecCards)) {
    throw new Error('edhrecCards must be an array');
  }
  if (!Array.isArray(scryfallCards)) {
    throw new Error('scryfallCards must be an array');
  }

  const { budget = 100, powerLevel = 'focused' } = options;

  // 1. Merge EDHREC synergy with Scryfall data
  const cardMap = new Map();
  for (const card of scryfallCards) {
    cardMap.set(card.name, card);
  }

  const mergedCards = edhrecCards.map((edhrecCard) => {
    const scryfallCard = cardMap.get(edhrecCard.name);
    if (!scryfallCard) return null;

    return {
      ...scryfallCard,
      synergy: edhrecCard.synergy || 0,
      salt: edhrecCard.salt || 0,
      num_decks: edhrecCard.num_decks || 0,
      label: edhrecCard.label
    };
  }).filter(Boolean);

  // 2. Filter by budget
  const maxCardPrice = getPriceThreshold(budget);
  const budgetFiltered = mergedCards.filter(
    (card) => card.price <= maxCardPrice || card.price === 0
  );

  // 3. Filter by color identity
  const colorFiltered = budgetFiltered.filter((card) =>
    isColorIdentityCompatible(card.colors, commanderData.color_identity)
  );

  // 4. Score and sort cards based on synergy AND power level
  const scored = colorFiltered.map((card) => ({
    ...card,
    score: calculateCardScore(card, powerLevel)
  }));
  const sorted = stableSort(scored, (a, b) => b.score - a.score);

  // 5. Get role targets based on power level
  const roleTargets = getRoleTargets(powerLevel, commanderData.color_identity);

  // 6. Fill mandatory role slots
  const selectedCards = [];
  const nonlandCards = sorted.filter((card) => card.cardType !== 'land');

  // Ramp
  const ramp = selectCardsWithRole(nonlandCards, 'ramp', roleTargets.ramp[0], roleTargets.ramp[1], selectedCards);
  selectedCards.push(...ramp);

  // Card Draw
  const draw = selectCardsWithRole(nonlandCards, 'draw', roleTargets.draw[0], roleTargets.draw[1], selectedCards);
  selectedCards.push(...draw);

  // Removal
  const removal = selectCardsWithRole(nonlandCards, 'removal', roleTargets.removal[0], roleTargets.removal[1], selectedCards);
  selectedCards.push(...removal);

  // Board Wipes
  const wipes = selectCardsWithRole(nonlandCards, 'wipe', roleTargets.wipe[0], roleTargets.wipe[1], selectedCards);
  selectedCards.push(...wipes);

  // Counterspells (if blue)
  const hasBlue = commanderData.color_identity.includes('U');
  if (hasBlue) {
    const counters = selectCardsWithRole(nonlandCards, 'counter', roleTargets.counter[0], roleTargets.counter[1], selectedCards);
    selectedCards.push(...counters);
  }

  // Tutors (power level dependent)
  if (roleTargets.tutor[1] > 0) {
    const tutors = selectCardsWithRole(nonlandCards, 'tutor', roleTargets.tutor[0], roleTargets.tutor[1], selectedCards);
    selectedCards.push(...tutors);
  }

  // 7. Fill remaining nonland slots with highest-scored cards (target 62-64)
  const targetNonlands = 63;
  const remaining = selectTopCards(
    nonlandCards,
    targetNonlands - selectedCards.length,
    selectedCards
  );
  selectedCards.push(...remaining);

  // Calculate actual nonland count
  const nonlandCount = selectedCards.length;

  // 8. Build mana base (36-38 lands)
  const landCount = 99 - nonlandCount;
  const colorDistribution = calculateColorDistribution(selectedCards);
  const lands = buildManaBase(
    commanderData.color_identity,
    colorDistribution,
    budget,
    landCount,
    powerLevel
  );

  // 9. Validate: 99 cards + 1 commander = 100
  const totalCards = selectedCards.length + lands.length;
  if (totalCards !== 99) {
    console.warn(`Deck has ${totalCards} cards, expected 99`);
  }

  // 10. Calculate stats
  const stats = calculateStats(
    selectedCards,
    lands,
    commanderData,
    budget
  );

  // 11. Detect strategy
  const strategy = detectStrategy(commanderData, selectedCards);

  return {
    commander: {
      name: commanderData.name,
      image: commanderData.image || '',
      manaCost: commanderData.mana_cost || '',
      typeLine: commanderData.type_line || '',
      cmc: commanderData.cmc || 0
    },
    cards: selectedCards.map((card) => ({
      ...card,
      category: 'Deck'
    })),
    lands: lands.map((card) => ({
      ...card,
      category: 'Lands'
    })),
    stats: stats,
    strategy: strategy
  };
}

/**
 * Get price threshold based on budget
 * Budget null = Unlimited, no price cap
 */
export function getPriceThreshold(budget) {
  // Unlimited budget (null or undefined) = no price cap
  if (budget === null || budget === undefined) return Infinity;
  if (budget === 0 || budget === Infinity) return Infinity;
  if (budget <= 50) return 3;
  if (budget <= 100) return 8;
  if (budget <= 150) return 15;
  if (budget <= 200) return 25;
  if (budget <= 300) return 50;
  return Infinity;
}

/**
 * Calculate a card's score based on synergy and power level
 * Higher score = more likely to be included
 */
export function calculateCardScore(card, powerLevel) {
  let score = (card.synergy || 0) * 100; // Base: EDHREC synergy

  const text = (card.oracleText || '').toLowerCase();
  const roles = card.roles || [];

  switch (powerLevel) {
    case 'competitive':
      // Competitive: prioritize efficiency, tutors, fast mana, combos
      if (roles.includes('tutor')) score += 30;
      if (card.cmc <= 2) score += 15;
      if (card.cmc <= 1) score += 10;
      // Fast mana is king
      if (/add \{/.test(text) && card.cmc <= 2) score += 25;
      if (/mana crypt|sol ring|mana vault|chrome mox|mox diamond|lotus petal/i.test(card.name)) score += 50;
      // Free counterspells
      if (roles.includes('counter') && card.cmc <= 1) score += 30;
      if (/force of will|force of negation|pact of negation|fierce guardianship/i.test(card.name)) score += 40;
      // Efficient interaction
      if (roles.includes('removal') && card.cmc <= 2) score += 15;
      // Infinite combo pieces get a boost
      if (/infinite|untap|whenever.*enters.*create|whenever.*dies.*create/i.test(text)) score += 10;
      // Penalize high CMC cards
      if (card.cmc >= 6) score -= 20;
      if (card.cmc >= 8) score -= 30;
      break;

    case 'optimized':
      // Optimized: balanced but still strong
      if (roles.includes('tutor')) score += 20;
      if (card.cmc <= 3) score += 10;
      if (/add \{/.test(text) && card.cmc <= 3) score += 15;
      if (roles.includes('counter') && card.cmc <= 2) score += 15;
      if (roles.includes('removal') && card.cmc <= 3) score += 10;
      if (card.cmc >= 7) score -= 15;
      break;

    case 'focused':
      // Focused: synergy-first, moderate efficiency
      // Synergy already weighted heavily, just slight efficiency bonus
      if (card.cmc <= 3) score += 5;
      if (roles.includes('tutor')) score += 5;
      if (card.cmc >= 8) score -= 10;
      break;

    case 'casual':
      // Casual: variety, fun, big splashy plays, avoid tutors/fast mana
      if (roles.includes('tutor')) score -= 20; // De-prioritize tutors
      // Reward higher CMC splashy cards
      if (card.cmc >= 5 && card.cmc <= 7) score += 10;
      // Penalize oppressive cards
      if (/stax|lock|can't cast|can't activate/i.test(text)) score -= 30;
      if (/extra turn/i.test(text)) score -= 20;
      // Reward fun mechanics
      if (/each player|each opponent draws|group/i.test(text)) score += 5;
      break;

    default:
      // Default to focused behavior
      if (card.cmc <= 3) score += 5;
      break;
  }

  // Universal: cards played in more decks get a small boost
  if (card.num_decks > 10000) score += 5;
  if (card.num_decks > 50000) score += 5;

  return score;
}

/**
 * Get role slot targets based on power level
 * Returns [min, max] for each role
 */
export function getRoleTargets(powerLevel, colorIdentity) {
  const hasBlue = colorIdentity.includes('U');

  switch (powerLevel) {
    case 'competitive':
      return {
        ramp: [12, 15],    // More fast mana
        draw: [10, 12],    // Maximum card advantage
        removal: [5, 7],   // Efficient interaction
        wipe: [1, 2],      // Fewer wipes (win before you need them)
        counter: hasBlue ? [4, 6] : [0, 0],  // Heavy counter suite
        tutor: [4, 6]      // Maximum tutors
      };

    case 'optimized':
      return {
        ramp: [10, 13],
        draw: [8, 11],
        removal: [6, 8],
        wipe: [2, 3],
        counter: hasBlue ? [3, 5] : [0, 0],
        tutor: [2, 4]
      };

    case 'focused':
      return {
        ramp: [10, 12],
        draw: [8, 10],
        removal: [6, 8],
        wipe: [2, 3],
        counter: hasBlue ? [2, 4] : [0, 0],
        tutor: [1, 2]
      };

    case 'casual':
      return {
        ramp: [8, 10],     // Less ramp, more fun cards
        draw: [7, 9],
        removal: [4, 6],   // Less removal
        wipe: [1, 2],
        counter: hasBlue ? [1, 2] : [0, 0],  // Minimal counters
        tutor: [0, 0]      // No tutors in casual
      };

    default:
      return {
        ramp: [10, 12],
        draw: [8, 10],
        removal: [6, 8],
        wipe: [2, 3],
        counter: hasBlue ? [2, 4] : [0, 0],
        tutor: [1, 2]
      };
  }
}

/**
 * Check if card color identity is compatible with commander
 */
export function isColorIdentityCompatible(cardColors, commanderColors) {
  if (!cardColors || cardColors.length === 0) return true; // Colorless is compatible
  return cardColors.every((color) => commanderColors.includes(color));
}

/**
 * Stable sort (preserves order for equal elements)
 */
function stableSort(array, compareFn) {
  return array
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const cmp = compareFn(a.item, b.item);
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map(({ item }) => item);
}

/**
 * Select cards with a specific role
 */
export function selectCardsWithRole(cards, role, minCount, maxCount, alreadySelected) {
  const cardNames = new Set(alreadySelected.map((c) => c.name));
  const candidates = cards.filter(
    (card) =>
      card.roles && card.roles.includes(role) && !cardNames.has(card.name)
  );

  // Already sorted by score from caller
  const count = Math.min(maxCount, candidates.length);
  return candidates.slice(0, Math.max(minCount, Math.min(count, candidates.length)));
}

/**
 * Select top cards by score
 */
function selectTopCards(cards, count, alreadySelected) {
  const cardNames = new Set(alreadySelected.map((c) => c.name));
  const candidates = cards.filter((card) => !cardNames.has(card.name));

  // Already sorted by score from caller
  return candidates.slice(0, count);
}

/**
 * Calculate color distribution from nonland cards
 */
export function calculateColorDistribution(cards) {
  const distribution = { W: 0, U: 0, B: 0, R: 0, G: 0 };

  for (const card of cards) {
    if (!card.colors || card.colors.length === 0) continue;

    // Count pips in mana cost
    const cost = card.manaCost || '';
    for (const color of ['W', 'U', 'B', 'R', 'G']) {
      const regex = new RegExp(`\\{${color}\\}`, 'g');
      const matches = cost.match(regex) || [];
      distribution[color] += matches.length;
    }
  }

  return distribution;
}

/**
 * Build mana base with lands appropriate to budget and power level
 */
export function buildManaBase(colorIdentity, colorDistribution, budget, landCount, powerLevel) {
  const lands = [];
  const landNames = new Set();

  const effectiveBudget = budget === null || budget === undefined ? Infinity : budget;

  // --- Utility lands (all budgets) ---
  const utilityLands = ['Command Tower'];
  if (colorIdentity.length >= 2) {
    utilityLands.push('Exotic Orchard');
  }
  if (colorIdentity.length >= 3) {
    utilityLands.push('Path of Ancestry');
  }

  for (const name of utilityLands) {
    addLand(lands, landNames, name, 'Land', landCount);
  }

  // --- Fetch lands (high budget / competitive) ---
  if (effectiveBudget >= 200 || powerLevel === 'competitive' || powerLevel === 'optimized') {
    const fetchLands = getFetchLands(colorIdentity);
    for (const name of fetchLands) {
      addLand(lands, landNames, name, 'Land', landCount);
    }
  }

  // --- Shock lands (mid+ budget) ---
  if (effectiveBudget >= 100) {
    const shockLands = getShockLands(colorIdentity);
    for (const name of shockLands) {
      addLand(lands, landNames, name, 'Land', landCount);
    }
  }

  // --- Original dual lands (unlimited/competitive only) ---
  if (effectiveBudget >= 300 || (effectiveBudget === Infinity && (powerLevel === 'competitive' || powerLevel === 'optimized'))) {
    const ogDuals = getOriginalDuals(colorIdentity);
    for (const name of ogDuals) {
      addLand(lands, landNames, name, 'Land', landCount);
    }
  }

  // --- Check lands (mid+ budget) ---
  if (effectiveBudget >= 50) {
    const checkLands = getCheckLands(colorIdentity);
    for (const name of checkLands) {
      addLand(lands, landNames, name, 'Land', landCount);
    }
  }

  // --- Pain lands (budget-friendly fixing) ---
  if (effectiveBudget >= 50) {
    const painLands = getPainLands(colorIdentity);
    for (const name of painLands) {
      addLand(lands, landNames, name, 'Land', landCount);
    }
  }

  // --- Filter/Fast lands (competitive) ---
  if (effectiveBudget >= 100 || powerLevel === 'competitive') {
    const fastLands = getFastLands(colorIdentity);
    for (const name of fastLands) {
      addLand(lands, landNames, name, 'Land', landCount);
    }
  }

  // --- Bounce lands (budget / casual) ---
  if (effectiveBudget <= 100 || powerLevel === 'casual') {
    const bounceLands = getBounceLands(colorIdentity);
    for (const name of bounceLands) {
      addLand(lands, landNames, name, 'Land', landCount);
    }
  }

  // --- Rainbow/utility for 3+ colors ---
  if (colorIdentity.length >= 3 && effectiveBudget >= 100) {
    const rainbowLands = ['Mana Confluence', 'City of Brass'];
    for (const name of rainbowLands) {
      addLand(lands, landNames, name, 'Land', landCount);
    }
  }
  if (colorIdentity.length >= 4 && effectiveBudget >= 50) {
    addLand(lands, landNames, 'The World Tree', 'Land', landCount);
  }
  if (colorIdentity.length === 5) {
    addLand(lands, landNames, 'Plaza of Heroes', 'Land', landCount);
  }

  // --- Ancient Tomb for competitive ---
  if (powerLevel === 'competitive' || powerLevel === 'optimized') {
    addLand(lands, landNames, 'Ancient Tomb', 'Land', landCount);
  }

  // --- Basic lands proportional to color distribution ---
  const basicLands = {
    W: 'Plains',
    U: 'Island',
    B: 'Swamp',
    R: 'Mountain',
    G: 'Forest'
  };

  const totalDistribution = Object.values(colorDistribution).reduce(
    (a, b) => a + b,
    0
  );
  const basicsNeeded = landCount - lands.length;

  if (basicsNeeded > 0) {
    for (const [color, basicName] of Object.entries(basicLands)) {
      if (colorIdentity.includes(color)) {
        const proportion =
          totalDistribution > 0
            ? colorDistribution[color] / totalDistribution
            : 1 / colorIdentity.length;
        const count = Math.round(proportion * basicsNeeded);

        for (let i = 0; i < count && lands.length < landCount; i++) {
          lands.push({
            name: basicName,
            typeLine: 'Basic Land',
            price: 0.25,
            image: '',
            cardType: 'land',
            colors: [color],
            manaCost: '',
            cmc: 0
          });
        }
      }
    }
  }

  // Fill remaining slots with basics
  while (lands.length < landCount) {
    const fallback = colorIdentity[0] || 'G';
    const basicName = basicLands[fallback] || 'Forest';
    lands.push({
      name: basicName,
      typeLine: 'Basic Land',
      price: 0.25,
      image: '',
      cardType: 'land',
      colors: [fallback],
      manaCost: '',
      cmc: 0
    });
  }

  return lands.slice(0, landCount);
}

/**
 * Helper: add a named land if there's room
 */
function addLand(lands, landNames, name, typeLine, maxLands) {
  if (landNames.has(name) || lands.length >= maxLands - 5) return; // Reserve 5 slots for basics
  lands.push({
    name: name,
    typeLine: typeLine,
    price: 0, // Real price comes from Scryfall if available
    image: '',
    cardType: 'land',
    colors: [],
    manaCost: '',
    cmc: 0
  });
  landNames.add(name);
}

// âââ Land Cycle Lookups ââââââââââââââââââââââââââââââââââââââââââââ

function getFetchLands(colorIdentity) {
  const fetchMap = {
    'WU': 'Flooded Strand', 'WB': 'Marsh Flats', 'WR': 'Arid Mesa',
    'WG': 'Windswept Heath', 'UB': 'Polluted Delta', 'UR': 'Scalding Tarn',
    'UG': 'Misty Rainforest', 'BR': 'Bloodstained Mire', 'BG': 'Verdant Catacombs',
    'RG': 'Wooded Foothills'
  };
  return getLandsForColorPairs(colorIdentity, fetchMap);
}

function getShockLands(colorIdentity) {
  const shockMap = {
    'WU': 'Hallowed Fountain', 'WB': 'Godless Shrine', 'WR': 'Sacred Foundry',
    'WG': 'Temple Garden', 'UB': 'Watery Grave', 'UR': 'Steam Vents',
    'UG': 'Breeding Pool', 'BR': 'Blood Crypt', 'BG': 'Overgrown Tomb',
    'RG': 'Stomping Ground'
  };
  return getLandsForColorPairs(colorIdentity, shockMap);
}

function getOriginalDuals(colorIdentity) {
  const dualMap = {
    'WU': 'Tundra', 'WB': 'Scrubland', 'WR': 'Plateau',
    'WG': 'Savannah', 'UB': 'Underground Sea', 'UR': 'Volcanic Island',
    'UG': 'Tropical Island', 'BR': 'Badlands', 'BG': 'Bayou',
    'RG': 'Taiga'
  };
  return getLandsForColorPairs(colorIdentity, dualMap);
}

function getCheckLands(colorIdentity) {
  const checkMap = {
    'WU': 'Glacial Fortress', 'WB': 'Isolated Chapel', 'WR': 'Clifftop Retreat',
    'WG': 'Sunpetal Grove', 'UB': 'Drowned Catacomb', 'UR': 'Sulfur Falls',
    'UG': 'Hinterland Harbor', 'BR': 'Dragonskull Summit', 'BG': 'Woodland Cemetery',
    'RG': 'Rootbound Crag'
  };
  return getLandsForColorPairs(colorIdentity, checkMap);
}

function getPainLands(colorIdentity) {
  const painMap = {
    'WU': 'Adarkar Wastes', 'WB': 'Caves of Koilos', 'WR': 'Battlefield Forge',
    'WG': 'Brushland', 'UB': 'Underground River', 'UR': 'Shivan Reef',
    'UG': 'Yavimaya Coast', 'BR': 'Sulfurous Springs', 'BG': 'Llanowar Wastes',
    'RG': 'Karplusan Forest'
  };
  return getLandsForColorPairs(colorIdentity, painMap);
}

function getFastLands(colorIdentity) {
  const fastMap = {
    'WU': 'Seachrome Coast', 'WB': 'Concealed Courtyard', 'WR': 'Inspiring Vantage',
    'WG': 'Razorverge Thicket', 'UB': 'Darkslick Shores', 'UR': 'Spirebluff Canal',
    'UG': 'Botanical Sanctum', 'BR': 'Blackcleave Cliffs', 'BG': 'Blooming Marsh',
    'RG': 'Copperline Gorge'
  };
  return getLandsForColorPairs(colorIdentity, fastMap);
}

function getBounceLands(colorIdentity) {
  const bounceMap = {
    'WU': 'Azorius Chancery', 'WB': 'Orzhov Basilica', 'WR': 'Boros Garrison',
    'WG': 'Selesnya Sanctuary', 'UB': 'Dimir Aqueduct', 'UR': 'Izzet Boilerworks',
    'UG': 'Simic Growth Chamber', 'BR': 'Rakdos Carnarium', 'BG': 'Golgari Rot Farm',
    'RG': 'Gruul Turf'
  };
  return getLandsForColorPairs(colorIdentity, bounceMap);
}

/**
 * Generic helper: get lands from a map for all color pairs in the identity
 */
function getLandsForColorPairs(colorIdentity, landMap) {
  const results = [];
  const colorOrder = ['W', 'U', 'B', 'R', 'G'];
  const orderedIdentity = colorIdentity.slice().sort(
    (a, b) => colorOrder.indexOf(a) - colorOrder.indexOf(b)
  );

  for (let i = 0; i < orderedIdentity.length; i++) {
    for (let j = i + 1; j < orderedIdentity.length; j++) {
      const pair = orderedIdentity[i] + orderedIdentity[j];
      if (landMap[pair]) {
        results.push(landMap[pair]);
      }
    }
  }
  return results;
}

/**
 * Calculate deck statistics
 */
export function calculateStats(cards, lands, commanderData, budget) {
  // Average mana cost (excluding lands)
  const totalCmc = cards.reduce((sum, card) => sum + (card.cmc || 0), 0);
  const avgManaCost = cards.length > 0 ? totalCmc / cards.length : 0;

  // Mana curve
  const manaCurve = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  for (const card of cards) {
    const cmc = Math.min(card.cmc || 0, 7);
    manaCurve[cmc]++;
  }

  // Color distribution
  const colorDistribution = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of cards) {
    if (card.colors && card.colors.length > 0) {
      for (const color of card.colors) {
        colorDistribution[color]++;
      }
    }
  }

  // Role distribution
  const roleDistribution = {
    ramp: 0,
    draw: 0,
    removal: 0,
    wipe: 0,
    counter: 0,
    tutor: 0,
    protection: 0
  };
  for (const card of cards) {
    if (card.roles) {
      for (const role of card.roles) {
        if (roleDistribution.hasOwnProperty(role)) {
          roleDistribution[role]++;
        }
      }
    }
  }

  // Card type distribution
  const cardTypeDistribution = {
    creature: 0,
    instant: 0,
    sorcery: 0,
    enchantment: 0,
    artifact: 0,
    planeswalker: 0
  };
  for (const card of cards) {
    if (cardTypeDistribution.hasOwnProperty(card.cardType)) {
      cardTypeDistribution[card.cardType]++;
    }
  }

  // Estimated cost
  const estimatedCost =
    (commanderData.price || 0) +
    cards.reduce((sum, card) => sum + (card.price || 0), 0) +
    lands.reduce((sum, land) => sum + (land.price || 0), 0);

  return {
    avgManaCost: Math.round(avgManaCost * 100) / 100,
    manaCurve,
    colorDistribution,
    roleDistribution,
    cardTypeDistribution,
    estimatedCost: Math.round(estimatedCost * 100) / 100,
    cardCount: cards.length + lands.length + 1 // +1 for commander
  };
}

/**
 * Detect deck strategy from commander and cards
 */
export function detectStrategy(commanderData, cards) {
  const commanderName = commanderData.name.toLowerCase();

  // Check for voltron (pump + equipment + auras)
  const equipment = cards.filter((c) =>
    c.typeLine && c.typeLine.includes('Equipment')
  ).length;
  const auras = cards.filter((c) =>
    c.typeLine && c.typeLine.includes('Aura')
  ).length;
  if (equipment >= 3 || auras >= 5) {
    return 'Voltron - pump spells and evasion';
  }

  // Check for tokens (create token, token doublers)
  const tokenCards = cards.filter((c) =>
    c.oracleText && /create[^.]*\btoken/i.test(c.oracleText)
  ).length;
  if (
    commanderName.includes('token') ||
    commanderName.includes('saproling') ||
    tokenCards >= 10
  ) {
    return 'Token Generation - mass board creation';
  }

  // Check for aristocrats (sacrifice outlets, death triggers)
  if (cards.some((c) => c.oracleText && /sacrifice|dies|death|trigger/i.test(c.oracleText))) {
    return 'Aristocrats - sacrifice synergies';
  }

  // Check for combo (tutors + card draw)
  const tutors = cards.filter((c) =>
    c.roles && c.roles.includes('tutor')
  ).length;
  const draws = cards.filter((c) =>
    c.roles && c.roles.includes('draw')
  ).length;
  if (tutors >= 5 && draws >= 8) {
    return 'Combo Control - tutors and card advantage';
  }

  // Check for control (removal + board wipes + counterspells)
  const removal = cards.filter((c) =>
    c.roles && c.roles.includes('removal')
  ).length;
  const wipes = cards.filter((c) =>
    c.roles && c.roles.includes('wipe')
  ).length;
  const counters = cards.filter((c) =>
    c.roles && c.roles.includes('counter')
  ).length;
  if (removal >= 6 && wipes >= 2 && counters >= 2) {
    return 'Control - removal and board wipes';
  }

  // Check for aggro (creatures + combat tricks)
  const creatures = cards.filter((c) =>
    c.cardType === 'creature'
  ).length;
  if (creatures >= 25) {
    return 'Aggro - creature-focused beatdown';
  }

  // Check for stompy (ramp + big creatures)
  const rampCount = cards.filter((c) =>
    c.roles && c.roles.includes('ramp')
  ).length;
  if (rampCount >= 10 && creatures >= 15) {
    return 'Ramp - accelerate to threats';
  }

  // Check for stax (restricting opponents)
  if (
    cards.some((c) =>
      c.oracleText && /stax|lock|static|ability can't/i.test(c.oracleText)
    )
  ) {
    return 'Stax - symmetrical restrictions';
  }

  return 'Goodstuff - strong synergies and card advantage';
}

// Re-export getCardType from shared module for backwards compatibility
export { getCardType } from '../utils/cardTypes.js';
