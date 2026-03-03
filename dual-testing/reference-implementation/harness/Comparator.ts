/**
 * Compares two ScenarioRecordings tick-by-tick.
 * Produces a list of TickDiffs classified by severity.
 */

import type { ScenarioRecording, TickDiff, ComparisonResult, Scenario } from './types.js';
import { shouldIgnore, compareMessages } from './FuzzyMatcher.js';

export class Comparator {
    /**
     * Compare foundcity vs reference recording.
     */
    compare(foundcity: ScenarioRecording, reference: ScenarioRecording): ComparisonResult {
        const diffs: TickDiff[] = [];

        // determine tick range to compare
        const allTicks = new Set<number>();
        for (const tr of foundcity.ticks) allTicks.add(tr.tick);
        for (const tr of reference.ticks) allTicks.add(tr.tick);
        const sortedTicks = [...allTicks].sort((a, b) => a - b);

        const fcMap = new Map(foundcity.ticks.map(t => [t.tick, t]));
        const refMap = new Map(reference.ticks.map(t => [t.tick, t]));

        for (const tick of sortedTicks) {
            const fcTick = fcMap.get(tick);
            const refTick = refMap.get(tick);

            const fcReceived = filterIgnored(fcTick?.received ?? []);
            const refReceived = filterIgnored(refTick?.received ?? []);

            // group by message type
            const fcByType = groupByType(fcReceived);
            const refByType = groupByType(refReceived);

            const allTypes = new Set([...fcByType.keys(), ...refByType.keys()]);

            for (const type of allTypes) {
                const fcMsgs = fcByType.get(type) ?? [];
                const refMsgs = refByType.get(type) ?? [];

                // missing/extra message types
                if (fcMsgs.length === 0 && refMsgs.length > 0) {
                    diffs.push({
                        tick,
                        description: `Missing ${type} in FoundCity`,
                        severity: 'missing_message',
                        foundcityMessages: [],
                        referenceMessages: refMsgs,
                        details: `Reference has ${refMsgs.length} ${type} message(s), FoundCity has none`,
                    });
                    continue;
                }

                if (fcMsgs.length > 0 && refMsgs.length === 0) {
                    diffs.push({
                        tick,
                        description: `Extra ${type} in FoundCity`,
                        severity: 'extra_message',
                        foundcityMessages: fcMsgs,
                        referenceMessages: [],
                        details: `FoundCity has ${fcMsgs.length} ${type} message(s), reference has none`,
                    });
                    continue;
                }

                // compare paired messages
                const maxLen = Math.max(fcMsgs.length, refMsgs.length);
                for (let i = 0; i < maxLen; i++) {
                    const fcMsg = fcMsgs[i];
                    const refMsg = refMsgs[i];

                    if (!fcMsg) {
                        diffs.push({
                            tick,
                            description: `Missing ${type}[${i}] in FoundCity`,
                            severity: 'missing_message',
                            foundcityMessages: [],
                            referenceMessages: [refMsg],
                            details: `Reference has extra ${type} at index ${i}`,
                        });
                        continue;
                    }

                    if (!refMsg) {
                        diffs.push({
                            tick,
                            description: `Extra ${type}[${i}] in FoundCity`,
                            severity: 'extra_message',
                            foundcityMessages: [fcMsg],
                            referenceMessages: [],
                            details: `FoundCity has extra ${type} at index ${i}`,
                        });
                        continue;
                    }

                    const result = compareMessages(fcMsg, refMsg);
                    if (result === 'exact') continue; // perfect match
                    if (result === 'fuzzy_ok') {
                        diffs.push({
                            tick,
                            description: `Fuzzy match on ${type}`,
                            severity: 'fuzzy_acceptable',
                            foundcityMessages: [fcMsg],
                            referenceMessages: [refMsg],
                            details: `Messages differ in non-deterministic values (combat rolls, etc.)`,
                        });
                        continue;
                    }

                    diffs.push({
                        tick,
                        description: `${result === 'structural_diff' ? 'Structural' : 'Exact'} mismatch on ${type}`,
                        severity: result === 'structural_diff' ? 'structural_difference' : 'exact_mismatch',
                        foundcityMessages: [fcMsg],
                        referenceMessages: [refMsg],
                        details: `${type} messages differ:\n  FC: ${JSON.stringify(fcMsg)}\n  Ref: ${JSON.stringify(refMsg)}`,
                    });
                }
            }
        }

        const hasRealDiffs = diffs.some(d => d.severity !== 'fuzzy_acceptable');

        return {
            scenario: foundcity.scenario,
            matched: !hasRealDiffs,
            foundcityRecording: foundcity,
            referenceRecording: reference,
            diffs,
        };
    }
}

function filterIgnored(messages: any[]): any[] {
    return messages.filter(m => !shouldIgnore(m.type));
}

function groupByType(messages: any[]): Map<string, any[]> {
    const map = new Map<string, any[]>();
    for (const msg of messages) {
        const type = msg.type ?? 'unknown';
        if (!map.has(type)) map.set(type, []);
        map.get(type)!.push(msg);
    }
    return map;
}
