import { useState } from 'react';

export default function ExportPanel({ deck, commander }) {
  const [copied, setCopied] = useState(false);

  const formatDeckList = () => {
    const lines = [];

    // Commander
    lines.push(`1 ${commander.name}`);
    lines.push('');

    // Nonland cards
    for (const card of deck.cards) {
      lines.push(`${card.qty || 1} ${card.name}`);
    }

    lines.push('');

    // Lands (consolidate duplicates)
    const landMap = new Map();
    for (const land of (deck.lands || [])) {
      landMap.set(land.name, (landMap.get(land.name) || 0) + 1);
    }
    for (const [name, qty] of landMap) {
      lines.push(`${qty} ${name}`);
    }

    return lines.join('\n');
  };

  const handleCopyToClipboard = () => {
    const deckList = formatDeckList();
    navigator.clipboard.writeText(deckList).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenTCGPlayer = () => {
    // Build mass entry URL for TCGPlayer
    const lines = [];
    for (const card of deck.cards) {
      lines.push(`${card.qty || 1} ${card.name}`);
    }
    const landMap = new Map();
    for (const land of (deck.lands || [])) {
      landMap.set(land.name, (landMap.get(land.name) || 0) + 1);
    }
    for (const [name, qty] of landMap) {
      lines.push(`${qty} ${name}`);
    }
    const encoded = encodeURIComponent(lines.join('||'));
    window.open(`https://www.tcgplayer.com/massentry?productline=magic&c=${encoded}`, '_blank');
  };

  const handleOpenMoxfield = () => {
    // Copy to clipboard in Moxfield-compatible format, then open Moxfield
    const deckList = formatDeckList();
    navigator.clipboard.writeText(deckList).then(() => {
      window.open('https://www.moxfield.com/decks/new', '_blank');
    });
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <h3 className="font-semibold text-lg mb-4">Export Your Deck</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={handleCopyToClipboard}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>

        <button
          onClick={handleOpenTCGPlayer}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          TCGPlayer
        </button>

        <button
          onClick={handleOpenMoxfield}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Moxfield
        </button>
      </div>
      <p className="text-xs text-zinc-500 mt-3">
        For Moxfield: deck list is copied to clipboard. Paste it into the import field on Moxfield.
      </p>
    </div>
  );
}
