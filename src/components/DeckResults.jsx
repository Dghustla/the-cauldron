import { useState } from 'react';
import ExportPanel from './ExportPanel';
import ManaPips from './ManaPips';
import { tcgCardUrl } from '../config/monetization';
import AdBanner from './AdBanner';

// Build a Scryfall image URL from card name (fallback for lands without images)
function scryfallImageUrl(cardName, size = 'small') {
  const encoded = encodeURIComponent(cardName);
  return `https://api.scryfall.com/cards/named?exact=${encoded}&format=image&version=${size}`;
}

export default function DeckResults({ deck, commander, onBrewAgain }) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [enlargedCard, setEnlargedCard] = useState(null);

  // Combine deck.cards and deck.lands into allCards for display
  const allCards = [...(deck.cards || []), ...(deck.lands || [])];

  // Group cards by type
  const creatures = deck.cards.filter(c => c.cardType === 'creature');
  const instants = deck.cards.filter(c => c.cardType === 'instant');
  const sorceries = deck.cards.filter(c => c.cardType === 'sorcery');
  const enchantments = deck.cards.filter(c => c.cardType === 'enchantment');
  const artifacts = deck.cards.filter(c => c.cardType === 'artifact');
  const planeswalkers = deck.cards.filter(c => c.cardType === 'planeswalker');
  const other = deck.cards.filter(c => !['creature','instant','sorcery','enchantment','artifact','planeswalker'].includes(c.cardType));

  // Consolidate lands by name (basics appear multiple times)
  const landMap = new Map();
  for (const land of (deck.lands || [])) {
    if (landMap.has(land.name)) {
      landMap.get(land.name).qty += 1;
    } else {
      landMap.set(land.name, { ...land, qty: 1 });
    }
  }
  const consolidatedLands = Array.from(landMap.values());

  const categories = [
    ['Creatures', creatures],
    ['Instants', instants],
    ['Sorceries', sorceries],
    ['Enchantments', enchantments],
    ['Artifacts', artifacts],
    ['Planeswalkers', planeswalkers],
    ['Other', other],
    ['Lands', consolidatedLands],
  ].filter(([_, cards]) => cards.length > 0);

  // Mana curve from stats (it's an object { 0: count, 1: count, ... })
  const manaCurve = [];
  for (let i = 0; i <= 7; i++) {
    manaCurve.push(deck.stats?.manaCurve?.[i] || 0);
  }
  const maxCurveCount = Math.max(...manaCurve, 1);

  // Role distribution (engine uses lowercase role names)
  const roles = deck.stats?.roleDistribution || {};
  const roleLabels = {
    ramp: 'Ramp',
    draw: 'Draw',
    removal: 'Removal',
    wipe: 'Wipes',
    counter: 'Counters',
    protection: 'Protection'
  };
  const roleEntries = Object.entries(roleLabels).map(([key, label]) => [label, roles[key] || 0]);
  const maxRoleCount = Math.max(...roleEntries.map(([_, v]) => v), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="flex gap-4 items-start">
          {commander.image_uris?.normal && (
            <img
              src={commander.image_uris.normal}
              alt={commander.name}
              onClick={() => setEnlargedCard({ name: commander.name, src: commander.image_uris.normal })}
              className="w-24 h-auto object-cover rounded-lg shadow-lg border border-zinc-700 cursor-pointer hover:border-green-500 transition-colors"
            />
          )}
          <div>
            <h2 className="text-3xl font-bold mb-1">{commander.name}</h2>
            <p className="text-zinc-400 text-sm">{commander.type_line}</p>
            {commander.mana_cost && (
              <div className="mt-2">
                <ManaPips manaCost={commander.mana_cost} />
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onBrewAgain}
          className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          Brew Again
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="text-xs text-zinc-500 mb-2">Avg. Mana Value</div>
          <div className="text-2xl font-bold text-green-400">
            {deck.stats?.avgManaCost?.toFixed(2) || 'N/A'}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-zinc-500 mb-2">Est. Cost</div>
          <div className="text-2xl font-bold text-green-400">
            ${deck.stats?.estimatedCost?.toFixed(0) || '0'}
          </div>
          <div className="text-[10px] text-zinc-600 mt-1 leading-tight">
            Based on lowest printing. Actual cost may vary by edition & condition.
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-zinc-500 mb-2">Strategy</div>
          <div className="text-sm font-bold leading-tight">{deck.strategy || 'N/A'}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs text-zinc-500 mb-2">Card Count</div>
          <div className="text-2xl font-bold text-green-400">
            {deck.stats?.cardCount || 100}
          </div>
        </div>
      </div>

      {/* Ad Slot — between stats and mana curve */}
      <AdBanner format="banner" />

      {/* Mana Curve */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-lg mb-6">Mana Curve</h3>
        <div className="flex items-end justify-between gap-2" style={{ height: '180px' }}>
          {manaCurve.map((count, idx) => {
            const label = idx === 7 ? '7+' : idx.toString();
            const barHeight = maxCurveCount > 0 ? (count / maxCurveCount) * 100 : 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div className="text-xs font-semibold text-zinc-300">{count}</div>
                <div
                  className="w-full bg-green-500/70 rounded-t-md transition-all hover:bg-green-500"
                  style={{ height: `${Math.max(barHeight, 4)}%`, minHeight: count > 0 ? '8px' : '2px' }}
                ></div>
                <div className="text-xs text-zinc-500 mt-1">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role Distribution */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-lg mb-6">Role Distribution</h3>
        <div className="space-y-4">
          {roleEntries.map(([role, count]) => (
            <div key={role} className="flex items-center gap-4">
              <div className="w-24 text-sm font-medium text-zinc-400">{role}</div>
              <div className="flex-1 bg-zinc-800 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-600 to-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${(count / maxRoleCount) * 100}%` }}
                ></div>
              </div>
              <div className="w-8 text-right text-sm font-semibold">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ad Slot — between role distribution and card list */}
      <AdBanner format="inline" />

      {/* Card List */}
      <div className="space-y-3">
        {categories.map(([categoryName, cards]) => (
          <div key={categoryName} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedCategory(expandedCategory === categoryName ? null : categoryName)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
            >
              <h4 className="font-semibold text-left">
                {categoryName} ({categoryName === 'Lands'
                  ? (deck.lands || []).length
                  : cards.length})
              </h4>
              <span className="text-zinc-400 text-lg">{expandedCategory === categoryName ? '−' : '+'}</span>
            </button>

            {expandedCategory === categoryName && (
              <div className="divide-y divide-zinc-800">
                {cards
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((card, idx) => {
                    const thumbSrc = card.imageSmall || scryfallImageUrl(card.name, 'small');
                    const normalSrc = card.imageNormal || scryfallImageUrl(card.name, 'normal');
                    return (
                      <div key={idx} className="card-row px-6 py-3 flex items-center justify-between gap-4">
                        <div className="flex-1 flex items-center gap-3">
                          <span className="w-6 text-center font-semibold text-zinc-500">{card.qty || 1}×</span>
                          <img
                            src={thumbSrc}
                            alt={card.name}
                            loading="lazy"
                            onClick={() => setEnlargedCard({ name: card.name, src: normalSrc })}
                            className="w-10 h-14 object-cover rounded cursor-pointer border border-zinc-700 hover:border-green-500 transition-colors flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{card.name}</div>
                            <div className="text-xs text-zinc-500 truncate">{card.typeLine}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {card.manaCost && <ManaPips manaCost={card.manaCost} />}
                          {card.price > 0 && (
                            <div className="w-16 text-right text-sm text-zinc-400">
                              ${card.price?.toFixed(2)}
                            </div>
                          )}
                          <a
                            href={tcgCardUrl(card.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] px-2 py-1 bg-blue-900/40 hover:bg-blue-800/60 text-blue-300 rounded transition-colors whitespace-nowrap flex-shrink-0"
                            title={`Buy ${card.name} on TCGPlayer`}
                          >
                            Buy
                          </a>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Export Panel */}
      <ExportPanel deck={deck} commander={commander} />

      {/* Enlarged Card Modal */}
      {enlargedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setEnlargedCard(null)}
        >
          <div className="relative max-w-sm mx-4 animate-[fadeIn_0.15s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <img
              src={enlargedCard.src}
              alt={enlargedCard.name}
              className="w-full h-auto rounded-xl shadow-2xl border border-zinc-600"
            />
            <div className="text-center mt-3 text-sm text-zinc-400">{enlargedCard.name}</div>
            <button
              onClick={() => setEnlargedCard(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-300 border border-zinc-600 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
