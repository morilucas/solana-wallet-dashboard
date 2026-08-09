import { describe, expect, it } from 'vitest';
import { fetchActivity, fetchPortfolio } from '../server/solana.js';

describe('server module startup', () => {
  it('loads the Solana program IDs without throwing', () => {
    expect(fetchPortfolio).toBeTypeOf('function');
    expect(fetchActivity).toBeTypeOf('function');
  });
});
