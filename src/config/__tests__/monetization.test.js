import { describe, it, expect } from 'vitest';
import { tcgCardUrl, tcgMassEntryUrl } from '../monetization.js';

describe('tcgCardUrl', () => {
  it('generates correct search URL', () => {
    const url = tcgCardUrl('Sol Ring');
    expect(url).toContain('tcgplayer.com/search/magic/product');
    expect(url).toContain('q=Sol%20Ring');
  });

  it('encodes special characters in card names', () => {
    const url = tcgCardUrl("Atraxa, Praetors' Voice");
    expect(url).toContain(encodeURIComponent("Atraxa, Praetors' Voice"));
  });

  it('includes view=grid parameter', () => {
    const url = tcgCardUrl('Lightning Bolt');
    expect(url).toContain('view=grid');
  });
});

describe('tcgMassEntryUrl', () => {
  it('generates correct mass entry URL', () => {
    const lines = ['1 Sol Ring', '1 Lightning Bolt'];
    const url = tcgMassEntryUrl(lines);
    expect(url).toContain('tcgplayer.com/massentry');
    expect(url).toContain('productline=magic');
  });

  it('joins lines with || delimiter', () => {
    const lines = ['1 Sol Ring', '1 Lightning Bolt'];
    const url = tcgMassEntryUrl(lines);
    const encoded = encodeURIComponent('1 Sol Ring||1 Lightning Bolt');
    expect(url).toContain(`c=${encoded}`);
  });

  it('handles single card', () => {
    const url = tcgMassEntryUrl(['1 Sol Ring']);
    expect(url).toContain(encodeURIComponent('1 Sol Ring'));
  });

  it('handles empty array', () => {
    const url = tcgMassEntryUrl([]);
    expect(url).toContain('tcgplayer.com/massentry');
  });
});
