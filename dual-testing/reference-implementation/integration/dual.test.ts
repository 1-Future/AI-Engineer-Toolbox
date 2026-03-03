/**
 * Dual integration tests — run scenarios against both FoundCity and lostcity-ref,
 * then compare their outputs.
 *
 * Prerequisites:
 *   1. FoundCity running on port 8888:  cd ~/Desktop/FoundCity && npm run dev
 *   2. lostcity-ref running on port 8889: cd ~/Desktop/lostcity-emulator && npm run dev
 *      (with WEB_PORT=8889 in .env)
 */

import { describe, it, expect } from 'vitest';
import { DualRunner } from '../harness/DualRunner.js';
import { FOUNDCITY, LOSTCITY_REF } from '../harness/constants.js';
import scenarios from '../scenarios/index.js';

describe('FoundCity vs lostcity-ref', () => {
    const runner = new DualRunner(FOUNDCITY, LOSTCITY_REF);

    for (const scenario of scenarios) {
        it(`${scenario.name} — behavioral match`, async () => {
            const result = await runner.run(scenario);

            if (!result.comparison.matched) {
                const realDiffs = result.comparison.diffs.filter(
                    d => d.severity !== 'fuzzy_acceptable'
                );
                if (realDiffs.length > 0) {
                    console.error(`\n--- ${scenario.name} diffs ---`);
                    for (const d of realDiffs) {
                        console.error(`  [Tick ${d.tick}] ${d.description}: ${d.details}`);
                    }
                    console.error('---\n');
                }
            }

            expect(result.comparison.matched).toBe(true);
        }, 120000); // dual tests need more time
    }
});
