export default function ManaPips({ manaCost }) {
  if (!manaCost) return null;

  // Parse mana cost string like "{2}{W}{U}{B}" into array of symbols
  const symbols = [];
  let i = 0;
  while (i < manaCost.length) {
    if (manaCost[i] === '{') {
      const closeIdx = manaCost.indexOf('}', i);
      if (closeIdx !== -1) {
        symbols.push(manaCost.substring(i + 1, closeIdx));
        i = closeIdx + 1;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return (
    <div className="flex gap-1 items-center">
      {symbols.map((symbol, idx) => {
        // Map symbol to mana type
        const isColor = ['W', 'U', 'B', 'R', 'G'].includes(symbol);
        const isGeneric = /^d+$/.test(symbol);
        const isVariable = symbol === 'X';

        let className = 'mana-pip mana-' + symbol;

        if (!isColor && !isGeneric && !isVariable) {
          // Handle other special symbols
          className = 'mana-pip mana-C'; // Default to colorless
        }

        return (
          <span key={idx} className={className}>
            {isGeneric ? symbol : isVariable ? 'X' : symbol}
          </span>
        );
      })}
    </div>
  );
}
