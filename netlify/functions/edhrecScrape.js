// netlify/functions/edhrecScrape.js
// Scrapes EDHrec for synergy card data for a given commander.
// Returns top synergy cards with their synergy % scores.

export default async (req, context) => {
  const url        = new URL(req.url);
  const commander  = url.searchParams.get("commander");

  if (!commander) {
    return new Response(JSON.stringify({ cards: [] }), { status: 200 });
  }

  try {
    // EDHrec URL slug: lowercase, spaces -> hyphens, remove special chars
    const slug = commander
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    const edhrecUrl = `https://json.edhrec.com/pages/commanders/${slug}.json`;

    const res  = await fetch(edhrecUrl, {
      headers: { "User-Agent": "TheCauldron/1.0 (MTG Deck Builder)" },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ cards: [], error: "EDHrec fetch failed" }), { status: 200 });
    }

    const data = await res.json();

    // Parse EDHrec JSON structure for cardlist sections
    const cards = [];
    const cardlists = data?.container?.json_dict?.cardlists || [];

    for (const section of cardlists) {
      const cardviews = section?.cardviews || [];
      for (const card of cardviews) {
        if (card?.name && typeof card.synergy === "number") {
          cards.push({
            name:    card.name,
            synergy: Math.round(card.synergy * 100),
          });
        }
      }
    }

    // Sort by synergy descending
    cards.sort((a, b) => b.synergy - a.synergy);

    return new Response(JSON.stringify({ cards: cards.slice(0, 60) }), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    // Non-fatal â app falls back to Claude training data
    return new Response(JSON.stringify({ cards: [], error: err.message }), { status: 200 });
  }
};

export const config = { path: "/api/edhrecScrape" };
