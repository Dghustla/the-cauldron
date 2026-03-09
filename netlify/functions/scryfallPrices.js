// netlify/functions/scryfallPrices.js
// Fetches Scryfall bulk price data and returns a name->price map.
// Uses the "Oracle Cards" bulk file for deduplicated card prices.

export default async (req, context) => {
  try {
    // Step 1: Get the bulk data manifest to find the latest download URL
    const manifestRes = await fetch("https://api.scryfall.com/bulk-data", {
      headers: { "User-Agent": "TheCauldron/1.0" },
    });
    const manifest = await manifestRes.json();

    const oracleEntry = (manifest.data || []).find(d => d.type === "oracle_cards");
    if (!oracleEntry?.download_uri) {
      return new Response(JSON.stringify({ prices: {} }), { status: 200 });
    }

    // Step 2: Fetch the bulk oracle cards JSON
    const bulkRes  = await fetch(oracleEntry.download_uri, {
      headers: { "User-Agent": "TheCauldron/1.0" },
    });
    const cards    = await bulkRes.json();

    // Step 3: Build name -> USD price map
    const prices = {};
    for (const card of cards) {
      if (card.name && card.prices?.usd) {
        // Keep the lowest price if a card appears multiple times
        const price = parseFloat(card.prices.usd);
        if (!prices[card.name] || price < prices[card.name]) {
          prices[card.name] = price;
        }
      }
    }

    return new Response(JSON.stringify({ prices }), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ prices: {}, error: err.message }), { status: 200 });
  }
};

export const config = { path: "/api/scryfallPrices" };
