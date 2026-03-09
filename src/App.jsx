import { useState, useEffect, useRef, useCallback } from "react";

// ââ Palette âââââââââââââââââââââââââââââââââââââââââââââ
const C = {
  black:  "#131200",
  green:  "#78BC61",
  purple: "#631D76",
  mauve:  "#9E4770",
  white:  "#FBFBFB",
};

const BUDGETS = [
  { label: "$50",       value: 50   },
  { label: "$100",      value: 100  },
  { label: "$150",      value: 150  },
  { label: "$200",      value: 200  },
  { label: "$300",      value: 300  },
  { label: "Unlimited", value: 9999 },
];

const CATS = {
  Lands:       { icon: "ð²", color: C.green   },
  Ramp:        { icon: "â¡", color: "#a0d080"  },
  "Card Draw": { icon: "ð", color: C.mauve    },
  Removal:     { icon: "ð", color: "#cc3355"  },
  Interaction: { icon: "ð¡ï¸", color: C.purple  },
  Synergy:     { icon: "ð®", color: "#b060d0"  },
  Finishers:   { icon: "âï¸", color: "#e06040" },
  Utility:     { icon: "ð§ª", color: "#60b0b0"  },
};

function Bubble({ style }) {
  return (
    <div style={{
      position: "absolute",
      borderRadius: "50%",
      background: "radial-gradient(circle at 30% 30%, rgba(120,188,97,0.75), rgba(40,100,20,0.2))",
      border: "1px solid rgba(120,188,97,0.55)",
      boxShadow: "0 0 8px rgba(120,188,97,0.35)",
      animation: "bubbleRise linear infinite",
      ...style,
    }} />
  );
}

export default function TheCauldron() {
  const [query, setQuery]             = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg]       = useState(false);
  const [commander, setCommander]     = useState(null);
  const [budget, setBudget]           = useState(100);
  const [brewing, setBrewing]         = useState(false);
  const [deck, setDeck]               = useState(null);
  const [error, setError]             = useState(null);
  const [copied, setCopied]           = useState(null);
  const [brewStep, setBrewStep]       = useState("");

  const [bubbles] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      size: 5 + Math.random() * 18,
      left: 8 + Math.random() * 84,
      delay: Math.random() * 7,
      dur: 3 + Math.random() * 5,
    }))
  );

  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  // Close suggestions on outside click
  useEffect(() => {
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSugg(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // ââ Autocomplete ââââââââââââââââââââââââââââââââââââââ
  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setSuggestions([]); setShowSugg(false); return; }
    try {
      const res  = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list = (data.data || []).slice(0, 7);
      setSuggestions(list);
      setShowSugg(list.length > 0);
    } catch {
      setSuggestions([]);
      setShowSugg(false);
    }
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setDeck(null);
    setError(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 200);
  };

  // ââ Pick Commander ââââââââââââââââââââââââââââââââââââ
  const pickCommander = async (name) => {
    setQuery(name);
    setSuggestions([]);
    setShowSugg(false);
    setDeck(null);
    setError(null);
    try {
      const res  = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`);
      const card = await res.json();
      if (card.object === "card") {
        const art = card.image_uris?.art_crop
          || card.card_faces?.[0]?.image_uris?.art_crop
          || card.image_uris?.normal;
        setCommander({ ...card, art });
      }
    } catch { setError("Could not fetch commander. Check your connection."); }
  };

  // ââ Brew ââââââââââââââââââââââââââââââââââââââââââââââ
  const brew = async () => {
    if (!commander || brewing) return;
    setBrewing(true);
    setDeck(null);
    setError(null);

    try {
      // Step 1 â Fetch EDHrec synergy data via Netlify function
      setBrewStep("ð¡ Consulting EDHrec synergy data...");
      let synergyCards = [];
      try {
        const edhRes  = await fetch(`/api/edhrecScrape?commander=${encodeURIComponent(commander.name)}`);
        const edhData = await edhRes.json();
        synergyCards  = edhData.cards || [];
      } catch {
        // Non-fatal â Claude will build from training knowledge if scrape fails
        synergyCards = [];
      }

      // Step 2 â Fetch Scryfall bulk prices via Netlify function
      setBrewStep("ð° Fetching current card prices...");
      let priceMap = {};
      try {
        const priceRes  = await fetch(`/api/scryfallPrices`);
        const priceData = await priceRes.json();
        priceMap = priceData.prices || {};
      } catch {
        priceMap = {};
      }

      // Step 3 â Ask Claude to assemble the deck
      setBrewStep("ð® Claude is assembling your 99...");
      const cmap   = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
      const ident  = (commander.color_identity || []).map(c => cmap[c] || c).join(", ") || "Colorless";
      const bStr   = budget >= 9999 ? "no budget limit" : `$${budget} total`;

      const synergyContext = synergyCards.length > 0
        ? `\nTop synergy cards from EDHrec for this commander (use these as priority picks):\n${synergyCards.slice(0, 40).map(c => `- ${c.name} (${c.synergy}% synergy)`).join("\n")}`
        : "";

      const priceContext = Object.keys(priceMap).length > 0
        ? `\nCurrent card prices are available. Stay within the $${budget} budget by checking prices.`
        : "";

      const prompt = `You are an expert Magic: The Gathering Commander deck builder with deep knowledge of EDHrec synergy data.

Build a complete 99-card Commander deck for: ${commander.name}
Color Identity: ${ident}
Budget: ${bStr}
${commander.oracle_text ? `Commander text: ${commander.oracle_text}` : ""}
${synergyContext}
${priceContext}

Return ONLY raw JSON â no markdown, no code fences, no explanation. Format exactly:
{
  "commander": "${commander.name}",
  "strategy": "2-sentence description of the deck's game plan and win conditions",
  "categories": {
    "Lands":       [{"name":"...", "reason":"..."}],
    "Ramp":        [{"name":"...", "reason":"..."}],
    "Card Draw":   [{"name":"...", "reason":"..."}],
    "Removal":     [{"name":"...", "reason":"..."}],
    "Interaction": [{"name":"...", "reason":"..."}],
    "Synergy":     [{"name":"...", "reason":"..."}],
    "Finishers":   [{"name":"...", "reason":"..."}],
    "Utility":     [{"name":"...", "reason":"..."}]
  }
}

Exact card counts: Lands=36, Ramp=10-12, Card Draw=8-10, Removal=8-10, Interaction=5-6, Synergy=12-16, Finishers=4-6, Utility=4-6.
Total across ALL categories MUST equal exactly 99.
${budget < 9999 ? `Keep total cost under $${budget}. Avoid cards over $15 unless essential.` : "No budget limit â use optimal cards."}
Only Commander-legal cards. Return raw JSON only.`;

      const aiRes  = await fetch("/api/brewDeck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const aiData = await aiRes.json();
      const parsed = JSON.parse(aiData.result.replace(/```json|```/g, "").trim());
      setDeck(parsed);

    } catch (e) {
      setError("Sometimes the cauldron needs another stir... give it another go.");
    }

    setBrewing(false);
    setBrewStep("");
  };

  // ââ Export ââââââââââââââââââââââââââââââââââââââââââââ
  const exportDeck = (dest) => {
    if (!deck) return;
    const lines = Object.values(deck.categories).flat().map(c => `1 ${c.name}`).join("\n");
    navigator.clipboard.writeText(lines).catch(() => {});
    if (dest === "tcg") {
      const enc = Object.values(deck.categories).flat()
        .map(c => encodeURIComponent(`1 ${c.name}`)).join("%0A");
      window.open(`https://www.tcgplayer.com/massentry?c=${enc}`, "_blank");
    } else if (dest === "ck") {
      window.open("https://www.cardkingdom.com/builder", "_blank");
    } else if (dest === "mox") {
      window.open("https://www.moxfield.com/decks/create", "_blank");
    }
    setCopied(dest);
    setTimeout(() => setCopied(null), 2500);
  };

  const totalCards = deck ? Object.values(deck.categories).reduce((s, a) => s + a.length, 0) : 0;
  const pipBg = { W: "#E8E4C0", U: "#0A55AA", B: "#280F38", R: "#BB1800", G: "#005528" };

  // ââ Render ââââââââââââââââââââââââââââââââââââââââââââ
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Pirata+One&family=Cinzel:wght@400;600;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400;1,500&display=swap');

        @keyframes bubbleRise {
          0%   { transform: translateY(0) translateX(0) scale(1);         opacity: 0.9; }
          40%  { transform: translateY(-55px) translateX(6px) scale(1.25); opacity: 0.5; }
          100% { transform: translateY(-120px) translateX(-4px) scale(0.3);opacity: 0;   }
        }
        @keyframes cauldronPulse {
          0%,100% { filter: drop-shadow(0 0 18px rgba(120,188,97,0.4)) drop-shadow(0 0 40px rgba(99,29,118,0.3)); }
          50%      { filter: drop-shadow(0 0 30px rgba(120,188,97,0.65)) drop-shadow(0 0 60px rgba(99,29,118,0.5)); }
        }
        @keyframes greenBlink { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes reveal { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }

        .app {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 90% 55% at 50% 100%, rgba(99,29,118,0.35) 0%, transparent 70%),
            radial-gradient(ellipse 70% 45% at 50% 105%, rgba(120,188,97,0.12) 0%, transparent 65%),
            ${C.black};
          color: ${C.white};
          font-family: 'Cormorant Garamond', Georgia, serif;
          overflow-x: hidden;
        }

        .scene {
          display: flex; flex-direction: column; align-items: center;
          padding-top: 48px; padding-bottom: 8px; position: relative;
        }
        .cauldron-wrap {
          position: relative; width: 240px; height: 200px;
          animation: float 3.5s ease-in-out infinite;
        }
        .cauldron-wrap svg { animation: cauldronPulse 4s ease-in-out infinite; }
        .bubble-zone {
          position: absolute; bottom: 70px; left: 50%;
          transform: translateX(-50%); width: 170px; height: 100px;
          pointer-events: none;
        }
        .hero-text { text-align: center; margin-top: 4px; }
        h1 {
          font-family: 'Pirata One', cursive;
          font-size: clamp(54px, 11vw, 100px); line-height: 0.88;
          background: linear-gradient(165deg, ${C.white} 10%, ${C.green} 50%, ${C.purple} 95%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 18px rgba(120,188,97,0.35));
          letter-spacing: 0.02em;
        }
        .tagline {
          font-family: 'Cinzel', serif; font-size: 11px;
          letter-spacing: 0.4em; color: rgba(158,71,112,0.8);
          text-transform: uppercase; margin-top: 8px;
        }
        .runes {
          margin-top: 10px; font-size: 18px; letter-spacing: 0.3em;
          color: rgba(120,188,97,0.25);
          animation: greenBlink 3s ease-in-out infinite;
        }

        .panel { max-width: 880px; margin: 0 auto; padding: 0 20px 80px; }

        .grimoire {
          background:
            linear-gradient(150deg, rgba(99,29,118,0.1) 0%, rgba(19,18,0,0.97) 100%),
            repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(120,188,97,0.025) 30px, rgba(120,188,97,0.025) 31px);
          border: 1px solid rgba(120,188,97,0.18);
          border-top: 3px solid ${C.green};
          border-radius: 2px 2px 8px 8px;
          padding: 36px 32px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(99,29,118,0.15);
          margin-bottom: 20px;
        }

        .step-lbl {
          font-family: 'Cinzel', serif; font-size: 11px;
          letter-spacing: 0.35em; color: ${C.mauve};
          text-transform: uppercase; margin-bottom: 14px;
          display: flex; align-items: center; gap: 10px;
        }
        .step-lbl::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, rgba(158,71,112,0.35), transparent);
        }

        .search-outer { position: relative; }
        .search-icon {
          position: absolute; left: 16px; top: 50%;
          transform: translateY(-50%); font-size: 20px;
          pointer-events: none; animation: greenBlink 2.5s ease-in-out infinite; z-index: 2;
        }
        .search-input {
          width: 100%;
          background: rgba(0,0,0,0.6);
          border: 1px solid rgba(120,188,97,0.22);
          border-bottom: 2px solid rgba(120,188,97,0.4);
          border-radius: 3px 3px 0 0;
          padding: 16px 18px 16px 50px;
          color: ${C.white}; font-family: 'Cormorant Garamond', serif;
          font-size: 21px; font-style: italic; outline: none;
          transition: border-color 0.25s, box-shadow 0.25s;
          caret-color: ${C.green}; position: relative; z-index: 1;
        }
        .search-input::placeholder { color: rgba(120,188,97,0.28); }
        .search-input:focus {
          border-color: rgba(120,188,97,0.55);
          box-shadow: 0 0 0 3px rgba(120,188,97,0.07), 0 4px 24px rgba(120,188,97,0.1);
        }
        .suggestions {
          position: absolute; top: 100%; left: 0; right: 0;
          background: linear-gradient(160deg, #1c0a28, #0e0c00);
          border: 1px solid rgba(120,188,97,0.28); border-top: none;
          border-radius: 0 0 5px 5px; z-index: 300; overflow: hidden;
          box-shadow: 0 16px 40px rgba(0,0,0,0.85);
        }
        .sugg {
          padding: 13px 18px 13px 50px; font-size: 18px; font-style: italic;
          color: rgba(251,251,251,0.75); cursor: pointer;
          border-bottom: 1px solid rgba(120,188,97,0.06);
          transition: background 0.12s, color 0.12s, padding-left 0.12s;
          position: relative;
        }
        .sugg::before {
          content: 'ð¿'; position: absolute; left: 16px;
          top: 50%; transform: translateY(-50%); font-size: 13px;
          opacity: 0; transition: opacity 0.12s;
        }
        .sugg:last-child { border-bottom: none; }
        .sugg:hover { background: rgba(120,188,97,0.1); color: ${C.green}; padding-left: 54px; }
        .sugg:hover::before { opacity: 1; }

        .cmd-card {
          display: flex; gap: 22px; align-items: flex-start;
          margin-top: 24px; padding: 18px 20px;
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(99,29,118,0.35);
          border-left: 4px solid ${C.purple};
          border-radius: 4px; animation: reveal 0.3s ease;
        }
        .art-frame {
          flex-shrink: 0; width: 132px; height: 96px;
          border: 2px solid rgba(120,188,97,0.3);
          border-radius: 4px; overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.65), 0 0 24px rgba(120,188,97,0.12);
        }
        .art-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cmd-name {
          font-family: 'Pirata One', cursive; font-size: 28px; color: ${C.green};
          text-shadow: 0 0 18px rgba(120,188,97,0.4); margin-bottom: 8px; line-height: 1;
        }
        .pips { display: flex; gap: 6px; margin-bottom: 8px; }
        .pip {
          width: 21px; height: 21px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.9);
        }
        .oracle {
          font-size: 13px; font-style: italic;
          color: rgba(251,251,251,0.38); line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }

        .budget-section { margin-top: 28px; padding-top: 24px; border-top: 1px solid rgba(120,188,97,0.08); }
        .budget-btns { display: flex; gap: 9px; flex-wrap: wrap; }
        .b-btn {
          padding: 9px 22px; background: rgba(0,0,0,0.45);
          border: 1px solid rgba(99,29,118,0.3); border-radius: 30px;
          color: rgba(158,71,112,0.75); font-family: 'Cormorant Garamond', serif;
          font-size: 16px; cursor: pointer; transition: all 0.2s;
        }
        .b-btn:hover { border-color: ${C.mauve}; color: ${C.white}; }
        .b-btn.on {
          background: rgba(158,71,112,0.18); border-color: ${C.mauve};
          color: ${C.white}; box-shadow: 0 0 14px rgba(158,71,112,0.22);
        }

        .brew-btn {
          margin-top: 30px; width: 100%; padding: 20px;
          background: linear-gradient(135deg, ${C.purple} 0%, #51136a 45%, ${C.purple} 100%);
          background-size: 300% 100%;
          border: 2px solid ${C.green}; border-radius: 4px;
          color: ${C.green}; font-family: 'Pirata One', cursive;
          font-size: 23px; letter-spacing: 0.1em;
          cursor: pointer; transition: all 0.3s;
          position: relative; overflow: hidden;
          text-shadow: 0 0 14px rgba(120,188,97,0.55);
        }
        .brew-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(120,188,97,0.13), transparent);
          background-size: 200%; animation: shimmer 2.8s linear infinite;
        }
        .brew-btn:hover:not(:disabled) {
          box-shadow: 0 0 50px rgba(120,188,97,0.28), 0 0 90px rgba(99,29,118,0.35);
          transform: translateY(-2px);
        }
        .brew-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .brew-status {
          text-align: center; padding: 28px;
          font-family: 'Cinzel', serif; font-size: 15px;
          color: ${C.green}; letter-spacing: 0.12em;
          animation: greenBlink 1.4s ease-in-out infinite;
        }

        .err {
          margin-top: 14px; padding: 14px 20px;
          background: rgba(160,15,15,0.18);
          border: 1px solid rgba(200,50,50,0.28);
          border-radius: 4px; color: #ff8888; font-size: 16px;
        }

        .deck { animation: reveal 0.45s ease; }
        .strategy-box {
          background: linear-gradient(135deg, rgba(99,29,118,0.18), rgba(0,0,0,0.55));
          border: 1px solid rgba(99,29,118,0.38); border-left: 4px solid ${C.purple};
          border-radius: 4px; padding: 20px 26px; margin-bottom: 14px;
          font-size: 19px; font-style: italic;
          color: rgba(251,251,251,0.78); line-height: 1.72;
        }
        .stats-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .stat {
          padding: 5px 14px; background: rgba(0,0,0,0.5);
          border: 1px solid rgba(120,188,97,0.18); border-radius: 20px;
          font-size: 13px; color: rgba(120,188,97,0.65); font-family: 'Cinzel', serif;
        }
        .stat b { color: ${C.green}; }

        .cat-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(252px, 1fr));
          gap: 12px; margin-bottom: 20px;
        }
        .cat-card {
          background: linear-gradient(155deg, rgba(10,8,0,0.98), rgba(22,10,32,0.92));
          border: 1px solid rgba(120,188,97,0.1); border-radius: 4px; overflow: hidden;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .cat-card:hover { border-color: rgba(120,188,97,0.28); box-shadow: 0 4px 20px rgba(0,0,0,0.55); }
        .cat-head {
          padding: 10px 14px; display: flex; align-items: center; gap: 8px;
          border-bottom: 1px solid rgba(120,188,97,0.07);
        }
        .cat-title { font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; flex: 1; }
        .cat-count { font-size: 11px; color: rgba(251,251,251,0.28); }
        .card-row {
          padding: 6px 14px; font-size: 14px; color: rgba(251,251,251,0.68);
          border-bottom: 1px solid rgba(120,188,97,0.045);
          transition: background 0.1s, color 0.1s; line-height: 1.3;
        }
        .card-row:last-child { border-bottom: none; }
        .card-row:hover { background: rgba(120,188,97,0.06); color: ${C.white}; }
        .card-why { font-size: 11px; font-style: italic; color: rgba(158,71,112,0.5); margin-top: 1px; }

        .export-bar {
          background: linear-gradient(135deg, rgba(22,10,32,0.96), rgba(10,8,0,0.98));
          border: 1px solid rgba(99,29,118,0.32); border-top: 3px solid ${C.purple};
          border-radius: 2px 2px 8px 8px; padding: 20px 24px;
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .export-lbl { font-family: 'Pirata One', cursive; font-size: 15px; letter-spacing: 0.12em; color: ${C.purple}; margin-right: 6px; }
        .ex-btn {
          padding: 10px 22px; border-radius: 3px; font-family: 'Cinzel', serif;
          font-size: 12px; letter-spacing: 0.06em; cursor: pointer;
          transition: all 0.2s; border: 1px solid; position: relative; overflow: hidden;
        }
        .ex-btn.tcg  { background: rgba(0,45,115,0.3);  border-color: rgba(50,110,245,0.4); color: #88aaff; }
        .ex-btn.ck   { background: rgba(100,10,10,0.3); border-color: rgba(210,55,55,0.4);  color: #ff9999; }
        .ex-btn.mox  { background: rgba(8,65,8,0.3);    border-color: rgba(55,155,55,0.4);  color: ${C.green}; }
        .ex-btn.tcg:hover { background: rgba(0,45,115,0.55); border-color: #88aaff; }
        .ex-btn.ck:hover  { background: rgba(100,10,10,0.55); border-color: #ff9999; }
        .ex-btn.mox:hover { background: rgba(8,65,8,0.55); border-color: ${C.green}; }
        .ok-badge {
          position: absolute; inset: 0; background: rgba(120,188,97,0.14);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: ${C.green};
        }
        .clip-note { margin-left: auto; font-size: 12px; font-style: italic; color: rgba(158,71,112,0.45); }
      `}</style>

      <div className="app">
        {/* ââ Cauldron Scene ââ */}
        <div className="scene">
          <div className="cauldron-wrap">
            <div className="bubble-zone">
              {bubbles.map(b => (
                <Bubble key={b.id} style={{
                  width: b.size, height: b.size,
                  left: `${b.left}%`, bottom: 0,
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.dur}s`,
                }} />
              ))}
            </div>
            <svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg"
              style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}>
              <defs>
                <radialGradient id="brew" cx="45%" cy="35%" r="65%">
                  <stop offset="0%"   stopColor="#78BC61" stopOpacity="0.6"/>
                  <stop offset="45%"  stopColor="#1d5010" stopOpacity="0.85"/>
                  <stop offset="100%" stopColor="#071508" stopOpacity="1"/>
                </radialGradient>
                <radialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#78BC61" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#78BC61" stopOpacity="0"/>
                </radialGradient>
                <filter id="blur"><feGaussianBlur stdDeviation="3"/></filter>
              </defs>
              <ellipse cx="120" cy="188" rx="85" ry="14" fill="url(#glow)" filter="url(#blur)"/>
              <line x1="72"  y1="174" x2="55"  y2="194" stroke="#3a2e08" strokeWidth="8" strokeLinecap="round"/>
              <line x1="120" y1="178" x2="120" y2="196" stroke="#3a2e08" strokeWidth="8" strokeLinecap="round"/>
              <line x1="168" y1="174" x2="185" y2="194" stroke="#3a2e08" strokeWidth="8" strokeLinecap="round"/>
              <path d="M46 116 Q40 176 120 180 Q200 176 194 116 Z" fill="#1e1a04" stroke={C.purple} strokeWidth="2.5"/>
              <text x="70"  y="158" fontSize="13" fill="rgba(120,188,97,0.22)" fontFamily="serif" letterSpacing="4">á±á¢á¾</text>
              <text x="122" y="164" fontSize="11" fill="rgba(158,71,112,0.22)" fontFamily="serif" letterSpacing="3">áá¨á·</text>
              <ellipse cx="120" cy="116" rx="78" ry="25" fill="#2a2308" stroke={C.purple} strokeWidth="2"/>
              <ellipse cx="120" cy="116" rx="70" ry="20" fill="#08180a"/>
              <ellipse cx="120" cy="116" rx="70" ry="20" fill="url(#brew)"/>
              <ellipse cx="100" cy="114" rx="22" ry="6"  fill="rgba(120,188,97,0.1)"/>
              <circle  cx="88"  cy="111" r="4"            fill="rgba(120,188,97,0.2)"/>
              <circle  cx="150" cy="115" r="3"            fill="rgba(120,188,97,0.18)"/>
              <path d="M50 124 Q30 108 40 90 Q52 72 68 83" stroke={C.purple} strokeWidth="6" fill="none" strokeLinecap="round"/>
              <circle cx="50" cy="124" r="5" fill={C.purple} stroke="rgba(120,188,97,0.3)" strokeWidth="1.5"/>
              <path d="M190 124 Q210 108 200 90 Q188 72 172 83" stroke={C.purple} strokeWidth="6" fill="none" strokeLinecap="round"/>
              <circle cx="190" cy="124" r="5" fill={C.purple} stroke="rgba(120,188,97,0.3)" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className="hero-text">
            <h1>The Cauldron</h1>
            <p className="tagline">Commander Deck Auto-Brewer</p>
            <div className="runes">á¦ á¨ á á á¾ á á¹ á á±</div>
          </div>
        </div>

        {/* ââ Panel ââ */}
        <div className="panel">
          <div className="grimoire">
            <div className="step-lbl">I â Speak the Commander's Name</div>
            <div className="search-outer" ref={wrapRef}>
              <span className="search-icon">ð®</span>
              <input
                className="search-input"
                type="text"
                autoComplete="off"
                placeholder="Begin typing a legendary creature..."
                value={query}
                onChange={handleChange}
                onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                onKeyDown={(e) => e.key === "Escape" && setShowSugg(false)}
              />
              {showSugg && suggestions.length > 0 && (
                <div className="suggestions">
                  {suggestions.map((s, i) => (
                    <div key={i} className="sugg"
                      onMouseDown={(e) => { e.preventDefault(); pickCommander(s); }}>
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {commander && (
              <div className="cmd-card">
                {commander.art && (
                  <div className="art-frame">
                    <img src={commander.art} alt={commander.name} />
                  </div>
                )}
                <div>
                  <div className="cmd-name">{commander.name}</div>
                  <div className="pips">
                    {(commander.color_identity || []).map(c => (
                      <div key={c} className="pip" style={{ background: pipBg[c] || "#555" }}>{c}</div>
                    ))}
                    {!(commander.color_identity || []).length && (
                      <div className="pip" style={{ background: "#888" }}>C</div>
                    )}
                  </div>
                  {commander.oracle_text && <div className="oracle">{commander.oracle_text}</div>}
                </div>
              </div>
            )}

            <div className="budget-section">
              <div className="step-lbl">II â Name Your Price</div>
              <div className="budget-btns">
                {BUDGETS.map(b => (
                  <button key={b.value} className={`b-btn ${budget === b.value ? "on" : ""}`}
                    onClick={() => setBudget(b.value)}>{b.label}</button>
                ))}
              </div>
            </div>

            <button className="brew-btn" disabled={!commander || brewing} onClick={brew}>
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
                <svg width="28" height="24" viewBox="0 0 240 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0,opacity:brewing?0.7:1}}>
                  <line x1="72" y1="174" x2="55" y2="194" stroke="#78BC61" strokeWidth="12" strokeLinecap="round"/>
                  <line x1="120" y1="178" x2="120" y2="196" stroke="#78BC61" strokeWidth="12" strokeLinecap="round"/>
                  <line x1="168" y1="174" x2="185" y2="194" stroke="#78BC61" strokeWidth="12" strokeLinecap="round"/>
                  <path d="M46 116 Q40 176 120 180 Q200 176 194 116 Z" fill="#1e1a04" stroke="#78BC61" strokeWidth="8"/>
                  <ellipse cx="120" cy="116" rx="78" ry="25" fill="#2a2308" stroke="#78BC61" strokeWidth="8"/>
                  <ellipse cx="120" cy="116" rx="68" ry="19" fill="#78BC61" opacity="0.4"/>
                  <path d="M50 124 Q30 108 40 90 Q52 72 68 83" stroke="#78BC61" strokeWidth="9" fill="none" strokeLinecap="round"/>
                  <path d="M190 124 Q210 108 200 90 Q188 72 172 83" stroke="#78BC61" strokeWidth="9" fill="none" strokeLinecap="round"/>
                </svg>
                {brewing ? "The Cauldron Churns..." : "Brew This Deck"}
              </span>
            </button>
          </div>

          {error && <div className="err">â ï¸ {error}</div>}
          {brewing && <div className="brew-status">{brewStep || "ð¿ Consulting the grimoire..."}</div>}

          {deck && !brewing && (
            <div className="deck">
              {deck.strategy && <div className="strategy-box">ð {deck.strategy}</div>}
              <div className="stats-row">
                <div className="stat">Commander: <b>{deck.commander}</b></div>
                <div className="stat">Cards: <b>{totalCards}</b></div>
                <div className="stat">Budget: <b>{budget >= 9999 ? "Unlimited" : `$${budget}`}</b></div>
              </div>
              <div className="cat-grid">
                {Object.entries(deck.categories).map(([cat, cards]) => (
                  <div key={cat} className="cat-card"
                    style={{ borderTop: `3px solid ${CATS[cat]?.color || C.green}` }}>
                    <div className="cat-head">
                      <span>{CATS[cat]?.icon || "ð"}</span>
                      <span className="cat-title" style={{ color: CATS[cat]?.color || C.green }}>{cat}</span>
                      <span className="cat-count">{cards.length}</span>
                    </div>
                    {cards.map((c, i) => (
                      <div key={i} className="card-row">
                        <div>1x {c.name}</div>
                        {c.reason && <div className="card-why">{c.reason}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="export-bar">
                <span className="export-lbl">âï¸ Send to Cart</span>
                <button className="ex-btn tcg" onClick={() => exportDeck("tcg")}>
                  {copied === "tcg" && <span className="ok-badge">â Copied!</span>}
                  TCGPlayer â
                </button>
                <button className="ex-btn ck" onClick={() => exportDeck("ck")}>
                  {copied === "ck" && <span className="ok-badge">â Copied!</span>}
                  Card Kingdom â
                </button>
                <button className="ex-btn mox" onClick={() => exportDeck("mox")}>
                  {copied === "mox" && <span className="ok-badge">â Copied!</span>}
                  Moxfield â
                </button>
                <span className="clip-note">List auto-copies to clipboard â¦</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
