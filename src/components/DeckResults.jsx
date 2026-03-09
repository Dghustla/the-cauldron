import { useState } from 'react';
import ExportPanel from './ExportPanel';
import ManaPips from './ManaPips';

export default function DeckResults({ deck, commander, onBrewAgain }) {
  const [expandedCategory, setExpandedCategory] = useState(null);

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
              className="w-24 h-auto object-cover rounded-lg shadow-lg border border-zinc-700"
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
                  .map((card, idx) => (
                    <div key={idx} className="card-row px-6 py-3 flex items-center justify-between gap-4">
                      <div className="flex-1 flex items-center gap-3">
                        <span className="w-6 text-center font-semibold text-zinc-500">{card.qty || 1}×</span>
                        <div className="flex-1">
                          <div className="font-medium">{card.name}</div>
                          <div className="text-xs text-zinc-500">{card.typeLine}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {card.manaCost && <ManaPips manaCost={card.manaCost} />}
                        {card.price > 0 && (
                          <div className="w-16 text-right text-sm text-zinc-400">
                            ${card.price?.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Export Panel */}
      <ExportPanel deck={deck} commander={commander} />
    </div>
  );
}
