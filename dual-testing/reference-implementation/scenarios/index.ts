/**
 * Re-exports all test scenarios.
 */

import type { Scenario } from '../harness/types.js';
import loginAndSpawn from './01-login-and-spawn.js';
import walkToCoordinate from './02-walk-to-coordinate.js';
import attackRat from './03-attack-rat.js';
import publicChat from './04-public-chat.js';
import pickupGroundItem from './05-pickup-ground-item.js';

const scenarios: Scenario[] = [
    loginAndSpawn,
    walkToCoordinate,
    attackRat,
    publicChat,
    pickupGroundItem,
];

export default scenarios;
