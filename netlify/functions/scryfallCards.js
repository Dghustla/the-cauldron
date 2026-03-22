/**
 * Netlify Function: Fetch card data from Scryfall for a list of card names
 * POST /api/scryfallCards
 * Body: { cards: ["Sol Ring", "Lightning Bolt", ...] }
 */

import { getCardType } from '../../src/utils/cardTypes.js';

const SCRYFALL_COLLECTION_URL = 'https://api.scryfall.com/cards/collection';
const BATCH_SIZE = 75;
const REQUEST_DELAY = 100; // ms between requests

export default async (request, context) => {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST required' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const cardNames = body.cardNames || body.cards || [];

    if (!Array.isArray(cardNames) || cardNames.length === 0) {
      return new Response(
        JSON.stringify({ error: 'cardNames array required', cards: [] }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Batch into groups of 75
    const batches = [];
    for (let i = 0; i < cardNames.length; i += BATCH_SIZE) {
      batches.push(cardNames.slice(i, i + BATCH_SIZE));
    }

    // 3. Fetch all batches with rate limiting
    const allCards = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // Add delay between requests (except first)
      if (i > 0) {
        await sleep(REQUEST_DELAY);
      }

      const response = await fetch(SCRYFALL_COLLECTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifiers: batch.map((name) => ({ name }))
        })
      });

      if (!response.ok) {
        console.error(`Scryfall batch ${i} failed:`, response.status);
        continue;
      }

      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        allCards.push(...data.data);
      }
    }

    // 4. Extract and enrich card data
    const enrichedCards = allCards.map((card) => {
      const roles = extractRoles(card.oracle_text || '');
      const cardType = getCardType(card.type_line || '');

      return {
        name: card.name,
        manaCost: card.mana_cost || '',
        cmc: card.cmc || 0,
        typeLine: card.type_line || '',
        oracleText: card.oracle_text || '',
        colors: card.color_identity || [],
        price: parseFloat(card.prices?.usd || 0) || 0,
        image: card.image_uris?.art_crop || '',
        imageSmall: card.image_uris?.small || '',
        imageNormal: card.image_uris?.normal || '',
        rarity: card.rarity || 'unknown',
        set: card.set?.toUpperCase() || '',
        roles: roles,
        cardType: cardType,
        legalities: card.legalities || {}
      };
    });

    return new Response(JSON.stringify({ cards: enrichedCards }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    console.error('scryfallCards error:', error);
    return new Response(
      JSON.stringify({ cards: [], error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Extract functional roles from oracle text
 */
export function extractRoles(oracleText) {
  const roles = [];

  // Normalize text for matching
  const text = oracleText.toLowerCase();

  // Ramp: add mana or search for lands
  if (
    /add \{/.test(text) ||
    /add one mana/.test(text) ||
    /search your library for a.*land/i.test(text) ||
    /treasure token/i.test(text) ||
    /create.*treasure/i.test(text)
  ) {
    roles.push('ramp');
  }

  // Draw: draw cards
  if (/draw \d+ cards|draw a card|draw cards/.test(text)) {
    roles.push('draw');
  }

  // Removal: destroy/exile single target
  if (
    /destroy target|exile target|target.*creature.*dies|deals.*damage.*to target/
      .test(text) ||
    /\-\d+\/\-\d+/.test(text)
  ) {
    roles.push('removal');
  }

  // Board wipe: destroy/exile all
  if (
    /destroy all|exile all|all creatures? get|wrath|plague/i.test(text)
  ) {
    roles.push('wipe');
  }

  // Counterspells: counter target
  if (/counter target/.test(text)) {
    roles.push('counter');
  }

  // Tutor: search library (but exclude ramp which already matched lands)
  if (
    /search your library for/.test(text) &&
    !/search your library for a.*land/i.test(text)
  ) {
    roles.push('tutor');
  }

  // Protection: hexproof, indestructible, ward, shroud
  if (
    /hexproof|indestructible|ward|shroud|protection from/.test(text)
  ) {
    roles.push('protection');
  }

  return roles;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
