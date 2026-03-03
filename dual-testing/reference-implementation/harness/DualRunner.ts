/**
 * Runs the same scenario against both servers (reference first, then FoundCity)
 * and compares their outputs.
 */

import { ScenarioRunner } from './ScenarioRunner.js';
import { Comparator } from './Comparator.js';
import type { Scenario, ServerTarget, DualResult } from './types.js';

/** Delay between running reference and FoundCity (ms). Lets NPC respawns settle. */
const INTER_SERVER_DELAY_MS = 5000;

export class DualRunner {
    private foundcityTarget: ServerTarget;
    private referenceTarget: ServerTarget;
    private foundcityRunner: ScenarioRunner;
    private referenceRunner: ScenarioRunner;
    private comparator: Comparator;

    constructor(foundcity: ServerTarget, reference: ServerTarget) {
        this.foundcityTarget = foundcity;
        this.referenceTarget = reference;
        this.foundcityRunner = new ScenarioRunner(foundcity);
        this.referenceRunner = new ScenarioRunner(reference);
        this.comparator = new Comparator();
    }

    async run(scenario: Scenario): Promise<DualResult> {
        // 1. Run on reference server first
        const referenceResult = await this.referenceRunner.run(scenario);

        // 2. Wait for NPC respawns / state to settle
        await new Promise(resolve => setTimeout(resolve, INTER_SERVER_DELAY_MS));

        // 3. Run on FoundCity
        const foundcityResult = await this.foundcityRunner.run(scenario);

        // 4. Compare recordings
        const comparison = this.comparator.compare(
            foundcityResult.recording,
            referenceResult.recording,
        );

        return {
            passed: comparison.matched && foundcityResult.passed,
            scenario,
            comparison,
            foundcityResult,
            referenceResult,
        };
    }
}
