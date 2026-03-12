import { useState } from 'react';
import CommanderSearch from './components/CommanderSearch';
import BuildConfig from './components/BuildConfig';
import DeckResults from './components/DeckResults';
import AdBanner from './components/AdBanner';
import { buildDeck } from './engine/deckBuilder';

export default function App() {
  const [commander, setCommander] = useState(null);
  const [budget, setBudget] = useState(100);
  const [powerLevel, setPowerLevel] = useState('focused');
  const [brewing, setBrewing] = useState(false);
  const [brewStep, setBrewStep] = useState('');
  const [deck, setDeck] = useState(null);
  const [error, setError] = useState('');

  async function brew() {
    try {
      setError('');
      setBrewing(true);
      setBrewStep('Building your deck...');

      // Step 1: Fetch EDHREC data
      const edhrecRes = await fetch(`/api/edhrecData?commander=${encodeURIComponent(commander.name)}`);
      if (!edhrecRes.ok) throw new Error('Could not find data for this commander. Try a different one.');
      const edhrecData = await edhrecRes.json();

      if (!edhrecData.cards || edhrecData.cards.length === 0) {
        throw new Error(`Could not find EDHREC data for "${commander.name}". The name may not match EDHREC's records — try the exact English card name.`);
      }

      setBrewStep('Gathering card details...');

      // Step 2: Fetch Scryfall cards
      const scryfallRes = await fetch('/api/scryfallCards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNames: edhrecData.cards.map(c => c.name) })
      });
      if (!scryfallRes.ok) throw new Error('Could not load card details. Please try again.');
      const scryfallData = await scryfallRes.json();

      setBrewStep('Optimizing your brew...');

      // Step 3: Build the deck
      const builtDeck = buildDeck(commander, edhrecData.cards, scryfallData.cards, {
        budget,
        powerLevel
      });

      setDeck(builtDeck);
      setBrewStep('');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setBrewStep('');
    } finally {
      setBrewing(false);
    }
  }

  const handleBrewAgain = () => {
    setDeck(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold">
                The <span className="text-green-500">Cauldron</span>
              </div>
            </div>
            <p className="text-zinc-400 text-sm">Commander Auto-Brewer</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!deck ? (
          <div className="space-y-8">
            {/* Commander Search */}
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
              <h2 className="text-xl font-semibold mb-6">Choose Your Commander</h2>
              <CommanderSearch
                commander={commander}
                onSelect={setCommander}
              />

              {/* Brew Button — directly under commander selection for easy access */}
              {commander && (
                <div className="mt-6 fade-in">
                  <button
                    onClick={brew}
                    disabled={brewing}
                    className="brew-btn w-full py-5 sm:py-4 px-6 rounded-lg font-semibold text-white text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {brewing ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                        {brewStep}
                      </div>
                    ) : (
                      'Brew Your Deck'
                    )}
                  </button>
                </div>
              )}
            </section>

            {/* Error Display */}
            {error && (
              <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4 text-red-400">
                {error}
              </div>
            )}

            {/* Build Config — below the brew button so it's optional tuning */}
            {commander && (
              <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 fade-in">
                <h2 className="text-xl font-semibold mb-6">Configure Your Deck</h2>
                <BuildConfig
                  budget={budget}
                  setBudget={setBudget}
                  powerLevel={powerLevel}
                  setPowerLevel={setPowerLevel}
                />
              </section>
            )}

            {/* Ad Slot — search page */}
            <AdBanner format="banner" />
          </div>
        ) : (
          <DeckResults
            deck={deck}
            commander={commander}
            onBrewAgain={handleBrewAgain}
          />
        )}
      </main>
    </div>
  );
}import { useState } from 'react';
import CommanderSearch from './components/CommanderSearch';
import BuildConfig from './components/BuildConfig';
import DeckResults from './components/DeckResults';
import { buildDeck } from './engine/deckBuilder';

export default function App() {
  const [commander, setCommander] = useState(null);
  const [budget, setBudget] = useState(100);
  const [powerLevel, setPowerLevel] = useState('focused');
  const [brewing, setBrewing] = useState(false);
  const [brewStep, setBrewStep] = useState('');
  const [deck, setDeck] = useState(null);
  const [error, setError] = useState('');

  async function brew() {
    try {
      setError('');
      setBrewing(true);
      setBrewStep('Building your deck...');

      // Step 1: Fetch EDHREC data
      const edhrecRes = await fetch(`/api/edhrecData?commander=${encodeURIComponent(commander.name)}`);
      if (!edhrecRes.ok) throw new Error('Could not find data for this commander. Try a different one.');
      const edhrecData = await edhrecRes.json();

      if (!edhrecData.cards || edhrecData.cards.length === 0) {
        throw new Error(`Could not find EDHREC data for "${commander.name}". The name may not match EDHREC's records â try the exact English card name.`);
      }

      setBrewStep('Gathering card details...');

      // Step 2: Fetch Scryfall cards
      const scryfallRes = await fetch('/api/scryfallCards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNames: edhrecData.cards.map(c => c.name) })
      });
      if (!scryfallRes.ok) throw new Error('Could not load card details. Please try again.');
      const scryfallData = await scryfallRes.json();

      setBrewStep('Optimizing your brew...');

      // Step 3: Build the deck
      const builtDeck = buildDeck(commander, edhrecData.cards, scryfallData.cards, {
        budget,
        powerLevel
      });

      setDeck(builtDeck);
      setBrewStep('');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setBrewStep('');
    } finally {
      setBrewing(false);
    }
  }

  const handleBrewAgain = () => {
    setDeck(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold">
                The <span className="text-green-500">Cauldron</span>
              </div>
            </div>
            <p className="text-zinc-400 text-sm">Commander Auto-Brewer</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!deck ? (
          <div className="space-y-8">
            {/* Commander Search */}
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
              <h2 className="text-xl font-semibold mb-6">Choose Your Commander</h2>
              <CommanderSearch
                commander={commander}
                onSelect={setCommander}
              />
            </section>

            {/* Build Config */}
            {commander && (
              <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 fade-in">
                <h2 className="text-xl font-semibold mb-6">Configure Your Deck</h2>
                <BuildConfig
                  budget={budget}
                  setBudget={setBudget}
                  powerLevel={powerLevel}
                  setPowerLevel={setPowerLevel}
                />
              </section>
            )}

            {/* Brew Button */}
            {commander && (
              <div className="fade-in">
                <button
                  onClick={brew}
                  disabled={brewing}
                  className="brew-btn w-full py-4 px-6 rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {brewing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                      {brewStep}
                    </div>
                  ) : (
                    'Brew Your Deck'
                  )}
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4 text-red-400">
                {error}
              </div>
            )}
          </div>
        ) : (
          <DeckResults
            deck={deck}
            commander={commander}
            onBrewAgain={handleBrewAgain}
          />
        )}
      </main>
    </div>
  );
}
