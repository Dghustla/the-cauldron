# Test Coverage Analysis — The Cauldron v2

## Current State

**Test coverage: 0%** — No testing framework is installed, no test files exist, and no CI runs tests before deployment.

---

## Priority 1: Core Deck Building Engine (`src/engine/deckBuilder.js`)

This is the heart of the application (813 lines) and the highest-value target for testing. Every function here is pure logic with no external dependencies, making them easy to unit test.

### `getPriceThreshold(budget)` — Low effort, high value
- Verify each budget tier maps to the correct max card price
- Edge cases: `null`, `undefined`, `0`, `Infinity`, negative numbers

### `calculateCardScore(card, powerLevel)` — High effort, critical value
- 5 power level branches (`competitive`, `optimized`, `focused`, `casual`, default) each with distinct scoring rules
- Verify competitive rewards low-CMC cards, tutors, fast mana and penalizes high-CMC
- Verify casual penalizes tutors/stax, rewards splashy cards
- Test interaction between synergy base score and power level modifiers
- Edge cases: missing `oracleText`, empty `roles`, zero synergy, extreme CMC values

### `isColorIdentityCompatible(cardColors, commanderColors)` — Low effort, high value
- Colorless cards should always be compatible
- Multi-color cards must have all colors within commander identity
- Edge cases: `null`/empty arrays, single-color vs 5-color commander

### `getRoleTargets(powerLevel, colorIdentity)` — Low effort, medium value
- Verify each power level returns correct min/max for all roles
- Verify blue identity enables counterspells, non-blue disables them
- Verify casual disables tutors (`[0, 0]`)

### `selectCardsWithRole(cards, role, min, max, alreadySelected)` — Medium effort, high value
- Should only pick cards with the specified role
- Should skip already-selected cards (no duplicates)
- Should respect min/max bounds
- Edge cases: fewer candidates than `minCount`, empty input arrays

### `buildManaBase(...)` — High effort, critical value
- Verify correct land cycles are included at each budget/power level tier
- Verify basic land proportions match color distribution
- Verify total land count equals requested `landCount`
- Verify no duplicate lands are added
- Edge cases: mono-color, 5-color, zero budget, unlimited budget

### `calculateStats(cards, lands, commanderData, budget)` — Medium effort, high value
- Verify average CMC calculation
- Verify mana curve bucketing (CMC 7+ should clump into bucket 7)
- Verify role/color/type distributions are counted correctly
- Verify `cardCount` includes commander (+1)
- Edge case: empty card list

### `detectStrategy(commanderData, cards)` — Medium effort, medium value
- Verify each strategy branch triggers on the right conditions (e.g., 3+ equipment → Voltron)
- Verify priority ordering (Voltron checked before Tokens, etc.)
- Verify fallback to "Goodstuff" when no strategy matches
- Edge case: cards with no `oracleText` or `typeLine`

### `buildDeck(...)` — Integration test, high effort, critical value
- Full end-to-end: given commander + card pools + options → verify output structure
- Verify deck always totals 99 cards (+ commander = 100)
- Verify no duplicate card names in nonland section
- Verify budget filtering actually excludes expensive cards
- Verify color identity filtering excludes off-color cards

---

## Priority 2: Serverless Functions (`netlify/functions/`)

### `edhrecData.js`

#### `slugifyCommanderName(name)` — Low effort, high value
- Currently **not exported** — needs to be exported for testing or tested indirectly
- Test cases from the docstring: `"Atraxa, Praetors' Voice"` → `"atraxa-praetors-voice"`
- Double-faced cards: `"Nashi, Moon's Legacy // Nashi, Moon's Legacy"` → `"nashi-moons-legacy"`
- Ampersands: `"Bebop & Rocksteady"` → `"bebop-rocksteady"`
- Edge cases: extra whitespace, consecutive special characters

#### Request handler — Medium effort, medium value
- Test with missing `commander` param → 400 response
- Test duplicate card deduplication (keeps highest synergy)
- Mock `fetch` for EDHREC API: success, 404, network error

### `scryfallCards.js`

#### `extractRoles(oracleText)` — Medium effort, high value
- Currently **not exported** — needs refactoring for testability
- Verify each role detection regex:
  - Ramp: `"Add {G}"`, `"Search your library for a basic land"`, `"Create a Treasure token"`
  - Draw: `"Draw a card"`, `"Draw 3 cards"`
  - Removal: `"Destroy target creature"`, `"Exile target"`
  - Wipe: `"Destroy all creatures"`
  - Counter: `"Counter target spell"`
  - Tutor: `"Search your library for a card"` (but NOT land search)
  - Protection: `"Hexproof"`, `"Indestructible"`
- Edge cases: empty string, text matching multiple roles, case sensitivity

#### `getCardType(typeLine)` — Low effort, medium value
- Duplicated in both `scryfallCards.js` and `deckBuilder.js` — should be deduplicated
- Test with multi-type cards: `"Artifact Creature"` should return `"creature"` (creature takes priority)

#### Batching logic — Medium effort, medium value
- Verify 150 cards are split into 2 batches of 75
- Verify 75 cards produce exactly 1 batch
- Mock Scryfall API responses

---

## Priority 3: Monetization Helpers (`src/config/monetization.js`)

### `tcgCardUrl(cardName)` — Low effort, low-medium value
- Verify URL encoding of card names with special characters
- Verify affiliate params are appended when `TCGPLAYER_PARTNER_ID` is set
- Verify clean URL when no partner ID is configured

### `tcgMassEntryUrl(lines)` — Low effort, low-medium value
- Verify `||` delimiter is used between card lines
- Verify URL encoding

---

## Priority 4: React Components

Lower priority since they're primarily presentational, but some contain testable logic:

### `App.jsx` — Integration/E2E
- Test the `brew()` flow with mocked API responses
- Verify error state displays when API fails
- Verify UI transitions: search → brewing → results → brew again

### `CommanderSearch.jsx` — Medium effort
- Debounced Scryfall autocomplete search
- Selection triggers `onSelect` callback with card data

### `DeckResults.jsx` — Medium effort
- Card grouping logic
- Land consolidation (grouping multiple basics)
- Mana curve chart data

### `ExportPanel.jsx` — Low effort
- Clipboard export formatting
- TCGPlayer URL generation

---

## Recommended Testing Setup

**Framework**: [Vitest](https://vitest.dev/) — native Vite integration, Jest-compatible API, fast
**Component testing**: `@testing-library/react` + `jsdom`
**API mocking**: `msw` (Mock Service Worker) or Vitest's `vi.fn()`

### Suggested `package.json` additions:
```json
{
  "devDependencies": {
    "vitest": "^3.x",
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x",
    "jsdom": "^26.x"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Recommended Test File Structure

```
src/
├── engine/
│   ├── deckBuilder.js
│   └── __tests__/
│       ├── deckBuilder.test.js        ← Priority 1
│       ├── getPriceThreshold.test.js
│       ├── calculateCardScore.test.js
│       └── buildManaBase.test.js
├── config/
│   └── __tests__/
│       └── monetization.test.js       ← Priority 3
└── components/
    └── __tests__/
        ├── DeckResults.test.jsx       ← Priority 4
        └── ExportPanel.test.jsx

netlify/functions/
├── __tests__/
│   ├── edhrecData.test.js             ← Priority 2
│   └── scryfallCards.test.js
```

---

## Quick Wins (Start Here)

These require **zero refactoring** and can be tested immediately:

1. **`getPriceThreshold`** — simple input/output mapping, ~10 test cases
2. **`isColorIdentityCompatible`** — boolean function, ~8 test cases
3. **`getRoleTargets`** — snapshot/assertion per power level, ~5 test cases
4. **`getCardType`** — string→string mapping, ~8 test cases
5. **`calculateColorDistribution`** — deterministic aggregation

## Refactoring Required for Testability

1. **Export internal functions** from `deckBuilder.js` (currently only `buildDeck` and `getCardType` are exported)
2. **Export `slugifyCommanderName`** from `edhrecData.js`
3. **Export `extractRoles`** from `scryfallCards.js`
4. **Deduplicate `getCardType`** — exists in both `deckBuilder.js:800` and `scryfallCards.js:172`

## Code Quality Issues Found During Analysis

1. **Duplicated function**: `getCardType` is defined identically in two files
2. **Non-deterministic strategy detection**: `detectStrategy` checks "does any card have 'create' in oracle text" for Token strategy — this matches far too broadly (most decks have cards that create tokens)
3. **Missing input validation**: `buildDeck` doesn't validate that required fields exist on `commanderData`
4. **Error masking**: Both Netlify functions return `status: 200` on errors, making failures silent to the client
