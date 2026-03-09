/**
 * Netlify Function: Fetch EDHREC synergy data for a commander
 * GET /api/edhrecData?commander=Atraxa, Praetors' Voice
 */

export default async (request, context) => {
  try {
    const url = new URL(request.url);
    const commander = url.searchParams.get('commander');

    if (!commander) {
      return new Response(
        JSON.stringify({ error: 'commander parameter required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Slugify the commander name
    const slug = slugifyCommanderName(commander);

    // 2. Fetch EDHREC data
    const edhrecUrl = `https://json.edhrec.com/pages/commanders/${slug}.json`;
    const response = await fetch(edhrecUrl);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          cards: [],
          commanderName: commander,
          themes: [],
          error: `EDHREC returned ${response.status}`
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    // 3. Parse cardlists from container.json_dict.cardlists
    const cards = [];
    const themes = [];

    if (data.container && data.container.json_dict) {
      // Extract themes/archetypes if available
      if (data.container.json_dict.themes) {
        themes.push(...data.container.json_dict.themes.slice(0, 5));
      }

      // cardlists is an array of objects: [{ header, tag, cardviews: [...] }, ...]
      const cardlists = data.container.json_dict.cardlists;
      if (Array.isArray(cardlists)) {
        for (const section of cardlists) {
          const cardviews = section.cardviews || section.cards || [];
          if (Array.isArray(cardviews)) {
            for (const card of cardviews) {
              cards.push({
                name: card.name,
                synergy: card.synergy || 0,
                salt: card.salt || 0,
                num_decks: card.num_decks || 0,
                label: section.header || section.tag || 'unknown'
              });
            }
          }
        }
      }
    }

    // Remove duplicates, keep highest synergy
    const cardMap = new Map();
    for (const card of cards) {
      const existing = cardMap.get(card.name);
      if (!existing || card.synergy > existing.synergy) {
        cardMap.set(card.name, card);
      }
    }

    const uniqueCards = Array.from(cardMap.values());

    return new Response(
      JSON.stringify({
        cards: uniqueCards,
        commanderName: commander,
        themes: themes
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400'
        }
      }
    );
  } catch (error) {
    console.error('edhrecData error:', error);
    return new Response(
      JSON.stringify({
        cards: [],
        commanderName: '',
        themes: [],
        error: error.message
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * Slugify commander name for EDHREC URL
 * Examples:
 * "Atraxa, Praetors' Voice" -> "atraxa-praetors-voice"
 * "Zur the Enchanter" -> "zur-the-enchanter"
 * "Bebop & Rocksteady" -> "bebop-rocksteady"
 * "Nashi, Moon's Legacy // Nashi, Moon's Legacy" -> "nashi-moons-legacy"
 */
function slugifyCommanderName(name) {
  // For double-faced cards, use only the front face
  const frontFace = name.split('//')[0].trim();
  return frontFace
    .toLowerCase()
    .replace(/[',]/g, '')    // Remove apostrophes and commas
    .replace(/&/g, '')       // Remove ampersands explicitly
    .replace(/\s+/g, '-')   // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove other special characters
    .replace(/-+/g, '-')    // Collapse multiple hyphens into one
    .replace(/^-|-$/g, ''); // Trim leading/trailing hyphens
}
