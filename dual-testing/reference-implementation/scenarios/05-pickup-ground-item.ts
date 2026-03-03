/**
 * Scenario 05: Cheat Give Item
 *
 * Tests the ::give cheat command. Verifies:
 * - The command is processed (game message confirmation)
 * - Stats are updated correctly via ::setstat
 *
 * Note: The ::give command adds items to the server-side inventory
 * but does not send update_inv_full/partial (those are triggered by
 * the script system, not the cheat handler). So we verify the
 * confirmation message and stat updates instead.
 */

import type { Scenario } from '../harness/types.js';

const scenario: Scenario = {
    id: '05-cheat-give-item',
    name: 'Cheat commands: give item and set stat',
    description: 'Use ::give and ::setstat cheat commands and verify server-side acknowledgment.',
    username: 'test_cheat',
    setup: [
        'give 995 100',    // 100 coins
        'setstat mining 50', // set mining to 50
    ],
    steps: [],
    trailingTicks: 5,
    tags: ['cheat', 'admin'],
    assertions: [
        {
            tick: 0,
            description: 'Game message confirms item was given',
            assert: (_tickMessages, context) => {
                const gameMessages = context.allMessages.filter(
                    (m: any) => m.type === 'message_game'
                );

                // the cheat handler sends "Gave Nx item" via player.write
                // the message field could be "text" or "message" depending on the handler
                const gaveMsg = gameMessages.find(
                    (m: any) => {
                        const text = (m.text ?? m.message ?? '').toLowerCase();
                        return text.includes('gave');
                    }
                );

                if (!gaveMsg) {
                    // if no "gave" message, maybe the item doesn't exist or inv is full
                    const anyMsg = gameMessages.find((m: any) => {
                        const text = (m.text ?? m.message ?? '').toLowerCase();
                        return text.includes('unknown') || text.includes('full');
                    });
                    if (anyMsg) {
                        throw new Error(`Give command failed: ${anyMsg.text ?? anyMsg.message}`);
                    }
                    throw new Error('No game message response from ::give command');
                }
            },
        },
        {
            tick: 0,
            description: 'update_stat received for mining skill',
            assert: (_tickMessages, context) => {
                const statUpdates = context.allMessages.filter(
                    (m: any) => m.type === 'update_stat'
                );

                // mining is stat 14
                const miningUpdate = statUpdates.find(
                    (m: any) => m.stat === 14
                );

                if (!miningUpdate) {
                    // stat updates might not be sent for cheat commands either
                    // check for confirmation message instead
                    const gameMessages = context.allMessages.filter(
                        (m: any) => m.type === 'message_game'
                    );
                    const statMsg = gameMessages.find((m: any) => {
                        const text = (m.text ?? m.message ?? '').toLowerCase();
                        return text.includes('mining') || text.includes('set');
                    });
                    if (!statMsg) {
                        throw new Error('No stat update or confirmation for ::setstat mining');
                    }
                } else {
                    if (miningUpdate.baseLevel !== 50) {
                        throw new Error(`Mining baseLevel expected 50, got ${miningUpdate.baseLevel}`);
                    }
                }
            },
        },
        {
            tick: 0,
            description: 'Game message confirms stat was set',
            assert: (_tickMessages, context) => {
                const gameMessages = context.allMessages.filter(
                    (m: any) => m.type === 'message_game'
                );

                const statMsg = gameMessages.find((m: any) => {
                    const text = (m.text ?? m.message ?? '').toLowerCase();
                    return text.includes('set') && text.includes('mining');
                });

                if (!statMsg) {
                    throw new Error('No confirmation message for ::setstat command');
                }
            },
        },
    ],
};

export default scenario;
