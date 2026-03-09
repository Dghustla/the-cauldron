/**
 * The Cauldron v2 - MTG Commander Deck Building Engine
 * Pure JavaScript module for building balanced 100-card Commander decks
 */

/**
 * Main deck building function
 * @param {Object} commanderData - { name, color_identity, cmc, type_line, image, mana_cost }
 * @param {Array} edhrecCards - [{ name, synergy, salt, num_decks, label }]
 * @param {Array} scryfallCards - [{ name, cmc, typeLine, roles, price, ... }]
 * @param {Object} options - { budget, powerLevel }
 * @returns {Object} Complete deck object
 */
export function buildDeck(commanderData, edhrecCards, scryfallCards, options = {}) {
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

  // 4. Sort by synergy (highest first) - stable sort
  const sorted = stableSort(colorFiltered, (a, b) => b.synergy - a.synergy);

  // 5. Fill mandatory role slots
  const selectedCards = [];
  const nonlandCards = sorted.filter((card) => card.cardType !== 'land');

  // Ramp: 10-12 cards
  const ramp = selectCardsWithRole(nonlandCards, 'ramp', 10, 12, selectedCards);
  selectedCards.push(...ramp);

  // Card Draw: 8-10 cards
  const draw = selectCardsWithRole(nonlandCards, 'draw', 8, 10, selectedCards);
  selectedCards.push(...draw);

  // Removal: 6-8 cards
  const removal = selectCardsWithRole(
    nonlandCards,
    'removal',
    6,
    8,
    selectedCards
  );
  selectedCards.push(...removal);

  // Board Wipes: 2-3 cards
  const wipes = selectCardsWithRole(nonlandCards, 'wipe', 2, 3, selectedCards);
  selectedCards.push(...wipes);

  // Counterspells: 2-4 if blue, 0 otherwise
  const hasBlue = commanderData.color_identity.includes('U');
  if (hasBlue) {
    const counters = selectCardsWithRole(
      nonlandCards,
      'counter',
      2,
      4,
      selectedCards
    );
    selectedCards.push(...counters);
  }

  // 6. Fill remaining nonland slots with highest-synergy cards (target 62-64)
  const targetNonlands = 63;
  const remaining = selectTopCards(
    nonlandCards,
    targetNonlands - selectedCards.length,
    selectedCards
  );
  selectedCards.push(...remaining);

  // Calculate actual nonland count
  const nonlandCount = selectedCards.length;

  // 7. Build mana base (36-38 lands)
  const landCount = 99 - nonlandCount;
  const colorDistribution = calculateColorDistribution(selectedCards);
  const lands = buildManaBase(
    commanderData.color_identity,
    colorDistribution,
    budget,
    landCount
  );

  // 8. Validate: 99 cards + 1 commander = 100
  const totalCards = selectedCards.length + lands.length;
  if (totalCards !== 99) {
    console.warn(`Deck has ${totalCards} cards, expected 99`);
  }

  // 9. Calculate stats
  const stats = calculateStats(
    selectedCards,
    lands,
    commanderData,
    budget
  );

  // 10. Detect strategy
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
 */
function getPriceThreshold(budget) {
  if (budget === 0 || budget === Infinity) return Infinity;
  if (budget <= 50) return 3;
  if (budget <= 100) return 8;
  if (budget <= 150) return 12;
  if (budget <= 200) return 20;
  if (budget <= 300) return 40;
  return 100; // For 300+ budgets
}

/**
 * Check if card color identity is compatible with commander
 */
function isColorIdentityCompatible(cardColors, commanderColors) {
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
function selectCardsWithRole(cards, role, minCount, maxCount, alreadySelected) {
  const cardNames = new Set(alreadySelected.map((c) => c.name));
  const candidates = cards.filter(
    (card) =>
      card.roles && card.roles.includes(role) && !cardNames.has(card.name)
  );

  // Sort by synergy (stable)
  const sorted = stableSort(candidates, (a, b) => b.synergy - a.synergy);

  // Take up to maxCount, but prefer at least minCount
  const count = Math.min(maxCount, sorted.length);
  return sorted.slice(0, Math.max(minCount, Math.min(count, sorted.length)));
}

/**
 * Select top cards by synergy
 */
function selectTopCards(cards, count, alreadySelected) {
  const cardNames = new Set(alreadySelected.map((c) => c.name));
  const candidates = cards.filter((card) => !cardNames.has(card.name));

  // Sort by synergy (stable)
  const sorted = stableSort(candidates, (a, b) => b.synergy - a.synergy);

  return sorted.slice(0, count);
}

/**
 * Calculate color distribution from nonland cards
 */
function calculateColorDistribution(cards) {
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
 * Build mana base
 */
function buildManaBase(colorIdentity, colorDistribution, budget, landCount) {
  const lands = [];
  const landNames = new Set();

  // Add staple lands
  if (!landNames.has('Command Tower')) {
    lands.push({
      name: 'Command Tower',
      typeLine: 'Land',
      price: 0.5,
      image: '',
      cardType: 'land',
      colors: [],
      manaCost: '',
      cmc: 0
    });
    landNames.add('Command Tower');
  }

  // Add dual lands based on color identity
  const dualLands = getRecommendedDualLands(colorIdentity, budget);
  for (const landName of dualLands) {
    if (!landNames.has(landName) && lands.length < landCount - 10) {
      lands.push({
        name: landName,
        typeLine: 'Land',
        price: estimateLandPrice(landName, budget),
        image: '',
        cardType: 'land',
        colors: [],
        manaCost: '',
        cmc: 0
      });
      landNames.add(landName);
    }
  }

  // Add basic lands proportional to color distribution
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

  for (const [color, basicName] of Object.entries(basicLands)) {
    if (colorIdentity.includes(color)) {
      const proportion =
        totalDistribution > 0
          ? colorDistribution[color] / totalDistribution
          : 0.2;
      const count = Math.round(proportion * basicsNeeded);

      for (let i = 0; i < count && lands.length < landCount; i++) {
        lands.push({
          name: basicName,
          typeLine: 'Basic Land',
          price: 0.01,
          image: '',
          cardType: 'land',
          colors: [color],
          manaCost: '',
          cmc: 0
        });
      }
    }
  }

  // Fill remaining slots with basics
  while (lands.length < landCount) {
    const fallback = colorIdentity[0] || 'G';
    const basicName = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' }[fallback];
    lands.push({
      name: basicName,
      typeLine: 'Basic Land',
      price: 0.01,
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
 * Get recommended dual lands based on color identity
 */
function getRecommendedDualLands(colorIdentity, budget) {
  const duals = [];

  // Map of color pairs to dual lands
  const dualMap = {
    'WU': ['Hallowed Fountain', 'Azorius Chancery', 'Glacial Fortress'],
    'WB': ['Godless Shrine', 'Orzhov Basilica', 'Isolated Chapel'],
    'WR': ['Sacred Foundry', 'Boros Garrison', 'Clifftop Retreat'],
    'WG': ['Temple Garden', 'Selesnya Sanctuary', 'Sunpetal Grove'],
    'UB': ['Watery Grave', 'Dimir Aqueduct', 'Drowned Catacomb'],
    'UR': ['Steam Vents', 'Izzet Boilerworks', 'Spirebluff Canal'],
    'UG': ['Breeding Pool', 'Simic Growth Chamber', 'Hinterland Harbor'],
    'BR': ['Blood Crypt', 'Rakdos Carnarium', 'Dragonskull Summit'],
    'BG': ['Overgrown Tomb', 'Golgari Rot Farm', 'Woodland Cemetery'],
    'RG': ['Stomping Ground', 'Gruul Turf', 'Rugged Highlands']
  };

  // Get all color pairs
  for (let i = 0; i < colorIdentity.length; i++) {
    for (let j = i + 1; j < colorIdentity.length; j++) {
      const pair = colorIdentity[i] + colorIdentity[j];
      const pairReverse = colorIdentity[j] + colorIdentity[i];
      const key = dualMap[pair] ? pair : pairReverse;

      if (dualMap[key]) {
        duals.push(...dualMap[key]);
      }
    }
  }

  return duals;
}

/**
 * Estimate land price based on budget
 */
function estimateLandPrice(landName, budget) {
  // High budget = fancy lands, low budget = basics
  if (budget < 50) return 0.5;
  if (budget < 100) return 2;
  if (budget < 200) return 5;
  return 10;
}

/**
 * Calculate deck statistics
 */
function calculateStats(cards, lands, commanderData, budget) {
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
function detectStrategy(commanderData, cards) {
  const commanderName = commanderData.name.toLowerCase();
  const cardNames = new Set(cards.map((c) => c.name.toLowerCase()));

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
  if (
    commanderName.includes('token') ||
    commanderName.includes('saproling') ||
    cards.some((c) => c.oracleText && c.oracleText.includes('create'))
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
  const ramp = cards.filter((c) =>
    c.roles && c.roles.includes('ramp')
  ).length;
  if (ramp >= 10 && creatures >= 15) {
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

/**
 * Get card type from type line
 */
export function getCardType(typeLine) {
  const type = (typeLine || '').toLowerCase();

  if (/creature/.test(type)) return 'creature';
  if (/instant/.test(type)) return 'instant';
  if (/sorcery/.test(type)) return 'sorcery';
  if (/enchantment/.test(type)) return 'enchantment';
  if (/artifact/.test(type)) return 'artifact';
  if (/planeswalker/.test(type)) return 'planeswalker';
  if (/land/.test(type)) return 'land';

  return 'other';
}
