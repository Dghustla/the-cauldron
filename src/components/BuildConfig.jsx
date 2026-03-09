export default function BuildConfig({ budget, setBudget, powerLevel, setPowerLevel }) {
  const budgetOptions = [50, 100, 150, 200, 300, null]; // null = Unlimited
  const powerLevels = [
    { id: 'casual', name: 'Casual', description: 'Kitchen table games, no infinite combos' },
    { id: 'focused', name: 'Focused', description: 'Tuned strategy with synergy, fair power level' },
    { id: 'optimized', name: 'Optimized', description: 'Efficient mana, tutors, strong synergies' },
    { id: 'competitive', name: 'Competitive', description: 'Win-focused, fast combos, maximum efficiency' }
  ];

  return (
    <div className="space-y-8">
      {/* Budget Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Budget (per card)</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {budgetOptions.map((option) => (
            <button
              key={option === null ? 'unlimited' : option}
              onClick={() => setBudget(option)}
              className={`py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                budget === option
                  ? 'bg-green-600/20 border-green-500 border-2 text-green-400'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
            >
              {option === null ? 'Unlimited' : `$${option}`}
            </button>
          ))}
        </div>
      </div>

      {/* Power Level Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Power Level</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {powerLevels.map((level) => (
            <button
              key={level.id}
              onClick={() => setPowerLevel(level.id)}
              className={`p-4 rounded-lg text-left transition-all border-2 ${
                powerLevel === level.id
                  ? 'border-green-500 bg-green-500/5 shadow-lg shadow-green-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
              }`}
            >
              <div className="font-semibold mb-1">{level.name}</div>
              <div className="text-sm text-zinc-400">{level.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
