import { useState, useRef, useEffect } from 'react';
import ManaPips from './ManaPips';

export default function CommanderSearch({ commander, onSelect }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounced autocomplete search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setSuggestions(data.data || []);
        setIsOpen(true);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function selectSuggestion(cardName) {
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`
      );
      if (!res.ok) throw new Error('Card not found');
      const cardData = await res.json();

      onSelect({
        name: cardData.name,
        type_line: cardData.type_line,
        color_identity: cardData.color_identity || [],
        cmc: cardData.cmc,
        mana_cost: cardData.mana_cost,
        image_uris: cardData.image_uris
      });

      setQuery('');
      setSuggestions([]);
      setIsOpen(false);
    } catch (error) {
      console.error('Error fetching card:', error);
    }
  }

  function handleChangeCommander() {
    onSelect(null);
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  }

  if (commander) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4 items-start">
          {commander.image_uris?.normal && (
            <img
              src={commander.image_uris.normal}
              alt={commander.name}
              className="w-32 h-48 object-cover rounded-lg shadow-lg border border-zinc-700"
            />
          )}
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-2xl font-bold mb-1">{commander.name}</h3>
              <p className="text-zinc-400 text-sm">{commander.type_line}</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-zinc-500 text-sm">Mana Cost:</span>
              {commander.mana_cost && (
                <div className="flex gap-1">
                  <ManaPips manaCost={commander.mana_cost} />
                </div>
              )}
            </div>

            {commander.color_identity.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 text-sm">Colors:</span>
                <div className="flex gap-1">
                  {commander.color_identity.map((color) => (
                    <span
                      key={color}
                      className="mana-pip"
                      style={{
                        background:
                          {
                            W: 'var(--mana-white)',
                            U: 'var(--mana-blue)',
                            B: 'var(--mana-black)',
                            R: 'var(--mana-red)',
                            G: 'var(--mana-green)'
                          }[color] || 'var(--mana-colorless)',
                        color:
                          {
                            W: '#333',
                            U: '#fff',
                            B: '#ccc',
                            R: '#fff',
                            G: '#fff'
                          }[color] || '#333'
                      }}
                    >
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleChangeCommander}
              className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
            >
              Change Commander
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={inputRef}>
      <input
        type="text"
        placeholder="Begin typing a legendary creature..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query && setIsOpen(true)}
        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute right-3 top-3 animate-spin w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full"></div>
      )}

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto fade-in">
          {suggestions.map((cardName, idx) => (
            <button
              key={idx}
              onClick={() => selectSuggestion(cardName)}
              className="w-full px-4 py-3 text-left hover:bg-zinc-700 transition-colors border-b border-zinc-700 last:border-0 text-sm"
            >
              {cardName}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && query && !isLoading && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-center text-zinc-400 text-sm fade-in">
          No commanders found matching "{query}"
        </div>
      )}
    </div>
  );
}
