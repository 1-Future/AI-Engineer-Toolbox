/**
 * Scenario 04: Public Chat
 *
 * Tests chat message broadcast.
 * Sends a message_public and verifies it appears in player_info chat mask.
 */

import type { Scenario } from '../harness/types.js';

const CHAT_INPUT = 'Hello World';
// sanitizeChat applies toSentenceCase: lowercases all, then capitalizes after sentence boundaries
// "Hello World" → "Hello world"
const CHAT_EXPECTED = 'Hello world';

const scenario: Scenario = {
    id: '04-public-chat',
    name: 'Public chat broadcast',
    description: 'Send a public chat message and verify it appears in player_info chat mask.',
    username: 'test_chat',
    steps: [
        {
            description: 'Send public chat message',
            tick: 0,
            message: { type: 'message_public', text: CHAT_INPUT },
        },
    ],
    trailingTicks: 5,
    tags: ['chat', 'deterministic'],
    assertions: [
        {
            tick: 0,
            description: 'player_info includes chat mask with the message text',
            assert: (_tickMessages, context) => {
                const playerInfos = context.allMessages.filter((m: any) => m.type === 'player_info');

                let foundChat = false;
                for (const msg of playerInfos) {
                    for (const player of (msg.players ?? [])) {
                        if (player.pid === context.pid && player.masks?.chat) {
                            if (player.masks.chat.text === CHAT_EXPECTED) {
                                foundChat = true;
                                break;
                            }
                        }
                    }
                    if (foundChat) break;
                }

                if (!foundChat) {
                    throw new Error(`Chat message "${CHAT_EXPECTED}" not found in any player_info chat mask for self (pid=${context.pid})`);
                }
            },
        },
    ],
};

export default scenario;
