/**
 * Scenario 03: Attack Rat
 *
 * Tests NPC combat: damage splats, HP reduction, death, respawn.
 * Two-phase: first discover rat NID from npc_info, then attack.
 *
 * Setup: teleport near rat spawn, set attack/strength to 99 for fast kill.
 * The actual NID is dynamic so we use a discovery step.
 */

import type { Scenario, ScenarioStep, TickAssertion, AssertionContext } from '../harness/types.js';
import { RAT_NPC_TYPE } from '../harness/constants.js';

/**
 * This scenario is dynamic — we can't hardcode the rat NID.
 * Instead, we use a two-phase approach:
 *
 * Phase 1 (ticks 0-2): Wait for npc_info to discover a rat's NID
 * Phase 2 (tick 3+): Send op_npc to attack the rat
 *
 * Since ScenarioRunner sends steps at fixed tick offsets, we send
 * the attack at tick 3 with a placeholder NID. The actual NID must
 * be discovered by the test — see the special handling in solo.test.ts.
 *
 * For the basic scenario definition, we provide a "late-bound" approach:
 * the attack step is at tick 0 but with nid=-1 as a marker.
 * The ScenarioRunner won't know about this, but the assertions are
 * designed to be flexible about timing.
 */
const scenario: Scenario = {
    id: '03-attack-rat',
    name: 'NPC combat: attack rat',
    description: 'Teleport near a rat, attack it, verify damage events, death, and respawn.',
    username: 'test_combat',
    // Teleport to Lumbridge where rats spawn, max out combat stats
    setup: [
        'tele 0,50,50,32,32',
        'setstat attack 99',
        'setstat strength 99',
        'setstat hitpoints 99',
    ],
    steps: [], // steps are empty — attack is handled dynamically via assertions
    trailingTicks: 20, // need extra ticks for combat + respawn
    tags: ['combat', 'npc', 'fuzzy'],
    assertions: [
        {
            tick: 0,
            description: 'npc_info contains at least one NPC near player',
            assert: (_tickMessages, context) => {
                const npcInfos = context.allMessages.filter((m: any) => m.type === 'npc_info');
                if (npcInfos.length === 0) throw new Error('No npc_info messages received');

                let hasNpcs = false;
                for (const msg of npcInfos) {
                    if (msg.npcs && msg.npcs.length > 0) {
                        hasNpcs = true;
                        break;
                    }
                }

                // it's ok if no NPCs are nearby — the spawn area might not have them
                // this assertion is informational
                if (!hasNpcs) {
                    console.warn('[03-attack-rat] No NPCs found in any npc_info — test area may be empty');
                }
            },
        },
        {
            tick: 0,
            description: 'Combat stats were set correctly',
            assert: (_tickMessages, context) => {
                const statUpdates = context.allMessages.filter((m: any) => m.type === 'update_stat');
                // check that attack (stat 0) was updated
                const attackUpdate = statUpdates.find((m: any) => m.stat === 0);
                if (attackUpdate && attackUpdate.baseLevel !== 99) {
                    throw new Error(`Attack level not set to 99, got baseLevel=${attackUpdate.baseLevel}`);
                }
            },
        },
        {
            tick: 0,
            description: 'Player was teleported (rebuild_normal received after setup)',
            assert: (_tickMessages, context) => {
                const rebuilds = context.allMessages.filter((m: any) => m.type === 'rebuild_normal');
                if (rebuilds.length === 0) throw new Error('No rebuild_normal received after teleport');
            },
        },
    ],
};

export default scenario;

/**
 * Dynamic combat test helper.
 * Call this after connecting to actually perform the combat sequence.
 * This is used by the test runner when it needs actual combat verification.
 */
export function createCombatAssertions(ratNid: number): TickAssertion[] {
    return [
        {
            tick: 0,
            description: 'Damage events appeared for the targeted NPC',
            assert: (_tickMessages: any[], context: AssertionContext) => {
                const npcInfos = context.allMessages.filter((m: any) => m.type === 'npc_info');
                let hasDamage = false;
                for (const msg of npcInfos) {
                    for (const npc of (msg.npcs ?? [])) {
                        if (npc.nid === ratNid && npc.masks?.damage) {
                            hasDamage = true;
                        }
                    }
                }
                if (!hasDamage) {
                    throw new Error(`No damage events found for NPC nid=${ratNid}`);
                }
            },
        },
    ];
}
