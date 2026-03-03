/**
 * Scenario 02: Walk to Coordinate
 *
 * Tests deterministic pathfinding. Walking is 1 tile/tick with ZERO randomness.
 * Both servers must produce identical positions.
 */

import type { Scenario } from '../harness/types.js';
import { DEFAULT_SPAWN_X, DEFAULT_SPAWN_Z } from '../harness/constants.js';

const TARGET_X = DEFAULT_SPAWN_X + 5; // walk 5 tiles east
const TARGET_Z = DEFAULT_SPAWN_Z;

const scenario: Scenario = {
    id: '02-walk-to-coordinate',
    name: 'Deterministic walk to coordinate',
    description: 'Send move_click 5 tiles east and verify the player moves 1 tile/tick for 5 ticks.',
    username: 'test_walk',
    // Teleport to known starting position (save file may have moved us)
    setup: [
        `tele 0,${DEFAULT_SPAWN_X >> 6},${DEFAULT_SPAWN_Z >> 6},${DEFAULT_SPAWN_X & 63},${DEFAULT_SPAWN_Z & 63}`,
    ],
    steps: [
        {
            description: 'Click to walk 5 tiles east',
            tick: 0,
            message: { type: 'move_click', x: TARGET_X, z: TARGET_Z },
        },
    ],
    trailingTicks: 8,
    tags: ['movement', 'deterministic'],
    assertions: [
        // After sending move_click at tick 0, the server processes it next tick.
        // The player_info in subsequent ticks should show progression.
        // Ticks in the assertion are relative to the start of step execution,
        // but since we wait 2 ticks for login + 2 for setup, we check allMessages.
        {
            tick: 0,
            description: 'Player is at spawn after setup teleport',
            assert: (_tickMessages, context) => {
                const playerInfos = context.allMessages.filter((m: any) => m.type === 'player_info');
                // find the LAST known position before the walk step — should be at spawn after teleport
                let lastSelf: any = null;
                for (const msg of playerInfos) {
                    const self = (msg.players ?? []).find((p: any) => p.pid === context.pid);
                    if (self && self.x === DEFAULT_SPAWN_X && self.z === DEFAULT_SPAWN_Z) {
                        lastSelf = self;
                    }
                }
                if (!lastSelf) {
                    // show all observed positions for debugging
                    const positions = playerInfos
                        .map((m: any) => (m.players ?? []).find((p: any) => p.pid === context.pid))
                        .filter(Boolean)
                        .map((p: any) => `(${p.x},${p.z})`);
                    throw new Error(`Player never at spawn (${DEFAULT_SPAWN_X},${DEFAULT_SPAWN_Z}). Observed positions: ${positions.join(', ')}`);
                }
            },
        },
        {
            tick: 0,
            description: 'Player reaches target coordinate within recording',
            assert: (_tickMessages, context) => {
                const playerInfos = context.allMessages.filter((m: any) => m.type === 'player_info');

                // find the last position
                let lastPos: { x: number; z: number } | null = null;
                let reachedTarget = false;
                for (const msg of playerInfos) {
                    const self = (msg.players ?? []).find((p: any) => p.pid === context.pid);
                    if (self) {
                        lastPos = { x: self.x, z: self.z };
                        if (self.x === TARGET_X && self.z === TARGET_Z) {
                            reachedTarget = true;
                        }
                    }
                }

                if (!reachedTarget) {
                    throw new Error(`Player never reached target (${TARGET_X}, ${TARGET_Z}). Last position: ${lastPos ? `(${lastPos.x}, ${lastPos.z})` : 'unknown'}`);
                }
            },
        },
        {
            tick: 0,
            description: 'Player movement is incremental (1 tile/tick) after reaching spawn',
            assert: (_tickMessages, context) => {
                const playerInfos = context.allMessages.filter((m: any) => m.type === 'player_info');

                // collect all positions with moveSpeed info
                const entries: { x: number; z: number; moveSpeed?: number }[] = [];
                for (const msg of playerInfos) {
                    const self = (msg.players ?? []).find((p: any) => p.pid === context.pid);
                    if (self) {
                        entries.push({ x: self.x, z: self.z, moveSpeed: self.moveSpeed });
                    }
                }

                // find the first entry at spawn (after teleport)
                const spawnIdx = entries.findIndex(e => e.x === DEFAULT_SPAWN_X && e.z === DEFAULT_SPAWN_Z);
                if (spawnIdx === -1) {
                    throw new Error('Player never reached spawn position after teleport');
                }

                // only check incremental movement AFTER reaching spawn
                const walkEntries = entries.slice(spawnIdx);
                for (let i = 1; i < walkEntries.length; i++) {
                    const dx = Math.abs(walkEntries[i].x - walkEntries[i - 1].x);
                    const dz = Math.abs(walkEntries[i].z - walkEntries[i - 1].z);
                    // allow teleports (moveSpeed 4 = INSTANT)
                    if (walkEntries[i].moveSpeed === 4) continue;
                    // walk speed is max 1 tile per tick per axis
                    if (dx > 1 || dz > 1) {
                        throw new Error(`Jump detected at step ${i}: (${walkEntries[i - 1].x},${walkEntries[i - 1].z}) → (${walkEntries[i].x},${walkEntries[i].z})`);
                    }
                }
            },
        },
    ],
};

function findSelfInPlayerInfos(playerInfos: any[], pid: number): any {
    for (const msg of playerInfos) {
        const self = (msg.players ?? []).find((p: any) => p.pid === pid);
        if (self) return self;
    }
    return null;
}

export default scenario;
