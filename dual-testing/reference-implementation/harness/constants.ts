import type { ServerTarget } from './types.js';

export const TICK_MS = 600;
export const DEFAULT_SPAWN_X = 3200;
export const DEFAULT_SPAWN_Z = 3200;
export const RAT_NPC_TYPE = 47;
export const RAT_HP = 2;
export const RAT_RESPAWN_TICKS = 4;

export const FOUNDCITY: ServerTarget = { label: 'FoundCity', host: 'localhost', port: 8888 };
export const LOSTCITY_REF: ServerTarget = { label: 'lostcity-ref', host: 'localhost', port: 8889 };
