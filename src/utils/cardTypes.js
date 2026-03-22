/**
 * Determine card type from type line
 * @param {string} typeLine - e.g. "Legendary Creature — Human Wizard"
 * @returns {string} One of: creature, instant, sorcery, enchantment, artifact, planeswalker, land, other
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
