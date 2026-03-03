/**
 * Scenario 01: Login and Spawn
 *
 * Tests the login handshake and initial state delivery.
 * No player actions — just connect and verify the initial data burst.
 */

import type { Scenario } from '../harness/types.js';
import { DEFAULT_SPAWN_X, DEFAULT_SPAWN_Z } from '../harness/constants.js';

const scenario: Scenario = {
    id: '01-login-and-spawn',
    name: 'Login handshake and initial state',
    description: 'Verify login_accept, rebuild_normal, initial player_info, and npc_info are sent correctly after authentication.',
    username: 'test_login',
    steps: [],
    trailingTicks: 3,
    tags: ['login', 'state'],
    assertions: [
        {
            tick: 0,
            description: 'login_accept received with valid PID',
            assert: (_tickMessages, context) => {
                const loginAccept = context.allMessages.find((m: any) => m.type === 'login_accept');
                if (!loginAccept) throw new Error('No login_accept message received');
                if (typeof loginAccept.pid !== 'number' || loginAccept.pid < 1) {
                    throw new Error(`Invalid PID: ${loginAccept.pid}`);
                }
                if (loginAccept.pid !== context.pid) {
                    throw new Error(`PID mismatch: login_accept.pid=${loginAccept.pid}, context.pid=${context.pid}`);
                }
            },
        },
        {
            tick: 0,
            description: 'rebuild_normal received with valid zone coordinates',
            assert: (_tickMessages, context) => {
                const rebuild = context.allMessages.find((m: any) => m.type === 'rebuild_normal');
                if (!rebuild) throw new Error('No rebuild_normal message received');
                // zoneX = x >> 3, zoneZ = z >> 3
                const expectedZoneX = DEFAULT_SPAWN_X >> 3;
                const expectedZoneZ = DEFAULT_SPAWN_Z >> 3;
                if (rebuild.zoneX !== expectedZoneX) {
                    throw new Error(`zoneX mismatch: got ${rebuild.zoneX}, expected ${expectedZoneX}`);
                }
                if (rebuild.zoneZ !== expectedZoneZ) {
                    throw new Error(`zoneZ mismatch: got ${rebuild.zoneZ}, expected ${expectedZoneZ}`);
                }
            },
        },
        {
            tick: 0,
            description: 'player_info includes self at spawn coordinates',
            assert: (_tickMessages, context) => {
                const playerInfos = context.allMessages.filter((m: any) => m.type === 'player_info');
                if (playerInfos.length === 0) throw new Error('No player_info message received');

                // find our own entry in any player_info message
                let selfEntry: any = null;
                for (const msg of playerInfos) {
                    const self = (msg.players ?? []).find((p: any) => p.pid === context.pid);
                    if (self) {
                        selfEntry = self;
                        break;
                    }
                }

                if (!selfEntry) throw new Error(`Self (pid=${context.pid}) not found in any player_info`);
                if (selfEntry.x !== DEFAULT_SPAWN_X) {
                    throw new Error(`Spawn X mismatch: got ${selfEntry.x}, expected ${DEFAULT_SPAWN_X}`);
                }
                if (selfEntry.z !== DEFAULT_SPAWN_Z) {
                    throw new Error(`Spawn Z mismatch: got ${selfEntry.z}, expected ${DEFAULT_SPAWN_Z}`);
                }
            },
        },
        {
            tick: 0,
            description: 'npc_info received (may be empty if no nearby NPCs)',
            assert: (_tickMessages, context) => {
                const npcInfo = context.allMessages.find((m: any) => m.type === 'npc_info');
                if (!npcInfo) throw new Error('No npc_info message received');
                // just verify the structure — npcs may be empty
                if (!Array.isArray(npcInfo.npcs)) {
                    throw new Error('npc_info.npcs is not an array');
                }
            },
        },
        {
            tick: 0,
            description: 'if_set_tab messages received for sidebar tabs',
            assert: (_tickMessages, context) => {
                const tabMessages = context.allMessages.filter((m: any) => m.type === 'if_set_tab');
                if (tabMessages.length < 10) {
                    throw new Error(`Expected at least 10 if_set_tab messages, got ${tabMessages.length}`);
                }
                // verify specific tabs exist
                const tabIds = tabMessages.map((m: any) => m.tab);
                if (!tabIds.includes(3)) throw new Error('Missing inventory tab (3)');
                if (!tabIds.includes(4)) throw new Error('Missing equipment tab (4)');
            },
        },
    ],
};

export default scenario;
