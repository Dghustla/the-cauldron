// ─── Monetization Configuration ─────────────────────────────────────────
// Fill in your IDs after signing up for each program.
//
// TCGPlayer Affiliate:
//   1. Sign up at https://www.tcgplayer.com → Affiliate Program (via Impact)
//   2. Get your partner/affiliate ID from your Impact dashboard
//   3. Paste it below as TCGPLAYER_PARTNER_ID
//
// Google AdSense:
//   1. Sign up at https://www.google.com/adsense
//   2. Get your publisher ID (format: ca-pub-XXXXXXXXXX)
//   3. Paste it below as ADSENSE_PUBLISHER_ID
//   4. Create ad units and paste the slot IDs below
// ─────────────────────────────────────────────────────────────────

// TCGPlayer affiliate tracking
export const TCGPLAYER_PARTNER_ID = ''; // e.g. 'TheCauldron'
export const TCGPLAYER_UTM_SOURCE = 'the-cauldron';
export const TCGPLAYER_UTM_MEDIUM = 'deck-builder';

// Google AdSense
export const ADSENSE_PUBLISHER_ID = ''; // e.g. 'ca-pub-1234567890123456'
export const ADSENSE_SLOT_BANNER = ''; // Ad unit slot ID for banner ads
export const ADSENSE_SLOT_INLINE = ''; // Ad unit slot ID for inline ads

// Build a TCGPlayer affiliate URL for a single card
export function tcgCardUrl(cardName) {
  const base = `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(cardName)}&view=grid`;
  return appendAffiliateParams(base);
}

// Build a TCGPlayer mass entry URL for a full deck list
export function tcgMassEntryUrl(lines) {
  const encoded = encodeURIComponent(lines.join('||'));
  const base = `https://www.tcgplayer.com/massentry?productline=magic&c=${encoded}`;
  return appendAffiliateParams(base);
}

// Append affiliate tracking params if a partner ID is configured
function appendAffiliateParams(url) {
  if (!TCGPLAYER_PARTNER_ID) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}partner=${TCGPLAYER_PARTNER_ID}&utm_source=${TCGPLAYER_UTM_SOURCE}&utm_medium=${TCGPLAYER_UTM_MEDIUM}&utm_campaign=affiliate`;
}
