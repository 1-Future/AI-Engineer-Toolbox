/**
 * Solo integration tests — run all scenarios against FoundCity only.
 *
 * Prerequisites: FoundCity must be running on port 8888.
 *   cd ~/Desktop/FoundCity && npm run dev
 */

import { describe, it, expect } from 'vitest';
import { ScenarioRunner } from '../harness/ScenarioRunner.js';
import { FOUNDCITY } from '../harness/constants.js';
import scenarios from '../scenarios/index.js';

describe('FoundCity Solo Tests', () => {
    const runner = new ScenarioRunner(FOUNDCITY);

    for (const scenario of scenarios) {
        it(scenario.name, async () => {
            const result = await runner.run(scenario);
            if (!result.passed) {
                console.error(`\n--- ${scenario.name} failures ---`);
                for (const err of result.errors) {
                    console.error(`  ${err}`);
                }
                console.error('---\n');
            }
            expect(result.passed).toBe(true);
        }, 60000);
    }
});
