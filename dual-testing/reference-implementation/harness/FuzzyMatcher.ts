/**
 * Fuzzy matching rules for comparing server outputs.
 *
 * Handles combat randomness and other non-deterministic differences.
 *
 * Three categories:
 * - EXACT_MATCH_TYPES: must be byte-for-byte identical
 * - STRUCTURAL_MATCH_TYPES: structure must match, numeric values can differ
 * - IGNORE_TYPES: skip entirely in comparison
 */

export type MatchResult = 'exact' | 'fuzzy_ok' | 'structural_diff' | 'mismatch';

/** These message types must be exactly identical between servers. */
const EXACT_MATCH_TYPES = new Set([
    'login_accept',
    'rebuild_normal',
    'if_set_tab',
    'if_close',
    'if_open_main',
    'if_open_side',
    'if_open_main_side',
    'if_open_chat',
    'if_set_text',
    'if_set_hide',
    'message_game',
]);

/** These message types are compared structurally with fuzzy numeric tolerance. */
const STRUCTURAL_MATCH_TYPES = new Set([
    'npc_info',
    'player_info',
    'update_stat',
    'update_inv_full',
    'update_inv_partial',
]);

/** These message types are skipped entirely — audio/cosmetic. */
const IGNORE_TYPES = new Set([
    'synth_sound',
    'midi_song',
    'midi_jingle',
]);

export function shouldIgnore(type: string): boolean {
    return IGNORE_TYPES.has(type);
}

export function isExactMatchType(type: string): boolean {
    return EXACT_MATCH_TYPES.has(type);
}

/**
 * Compare two messages of the same type.
 * Returns the match classification.
 */
export function compareMessages(a: any, b: any): MatchResult {
    if (!a || !b) return 'mismatch';
    if (a.type !== b.type) return 'mismatch';

    const type = a.type;

    if (IGNORE_TYPES.has(type)) return 'exact';
    if (EXACT_MATCH_TYPES.has(type)) {
        return deepEqual(a, b) ? 'exact' : 'mismatch';
    }

    if (type === 'player_info') return comparePlayerInfo(a, b);
    if (type === 'npc_info') return compareNpcInfo(a, b);
    if (type === 'update_stat') return compareUpdateStat(a, b);

    // default: structural comparison
    return deepEqual(a, b) ? 'exact' : 'mismatch';
}

function comparePlayerInfo(a: any, b: any): MatchResult {
    const playersA: any[] = a.players ?? [];
    const playersB: any[] = b.players ?? [];

    if (playersA.length !== playersB.length) return 'structural_diff';

    let hasFuzzy = false;
    for (let i = 0; i < playersA.length; i++) {
        const pa = playersA[i];
        const pb = playersB[i];

        // PID, position must match exactly (movement is deterministic)
        if (pa.pid !== pb.pid) return 'structural_diff';
        if (pa.x !== pb.x || pa.z !== pb.z) return 'mismatch';
        if (pa.moveSpeed !== pb.moveSpeed) return 'mismatch';

        // masks — compare structurally
        if (pa.masks || pb.masks) {
            const maskResult = comparePlayerMasks(pa.masks ?? {}, pb.masks ?? {});
            if (maskResult === 'mismatch') return 'mismatch';
            if (maskResult === 'structural_diff') return 'structural_diff';
            if (maskResult === 'fuzzy_ok') hasFuzzy = true;
        }
    }

    return hasFuzzy ? 'fuzzy_ok' : 'exact';
}

function comparePlayerMasks(a: any, b: any): MatchResult {
    let hasFuzzy = false;

    // appearance must match exactly
    if (!deepEqual(a.appearance, b.appearance)) return 'mismatch';

    // anim: allow punch(422)/kick(423) alternation
    if (a.anim || b.anim) {
        if (!a.anim || !b.anim) return 'structural_diff';
        const animPairOk =
            a.anim.id === b.anim.id ||
            (isPunchKick(a.anim.id) && isPunchKick(b.anim.id));
        if (!animPairOk) return 'mismatch';
        if (a.anim.id !== b.anim.id) hasFuzzy = true;
    }

    // face entity must match
    if (a.faceEntity !== b.faceEntity) {
        if (a.faceEntity !== undefined && b.faceEntity !== undefined) return 'mismatch';
        return 'structural_diff';
    }

    // chat text must match
    if (!deepEqual(a.chat, b.chat)) return 'mismatch';
    if (!deepEqual(a.say, b.say)) return 'mismatch';

    // face coord must match
    if (!deepEqual(a.faceCoord, b.faceCoord)) return 'mismatch';

    // damage: both must exist or both must not, amounts can differ
    if (a.damage || b.damage) {
        if (!a.damage || !b.damage) return 'structural_diff';
        if (a.damage.type !== b.damage.type) return 'mismatch';
        if (a.damage.maxHp !== b.damage.maxHp) return 'mismatch';
        // amount and currentHp can differ (combat rolls)
        hasFuzzy = true;
    }

    return hasFuzzy ? 'fuzzy_ok' : 'exact';
}

function compareNpcInfo(a: any, b: any): MatchResult {
    const npcsA: any[] = a.npcs ?? [];
    const npcsB: any[] = b.npcs ?? [];

    if (npcsA.length !== npcsB.length) return 'structural_diff';

    // sort by npcType + position for stable comparison
    const sortKey = (n: any) => `${n.npcType}:${n.x}:${n.z}`;
    const sortedA = [...npcsA].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
    const sortedB = [...npcsB].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));

    let hasFuzzy = false;
    for (let i = 0; i < sortedA.length; i++) {
        const na = sortedA[i];
        const nb = sortedB[i];

        // NPC type must match
        if (na.npcType !== nb.npcType) return 'mismatch';

        // position must match (NPC wander is seeded, but we allow ±1 for timing)
        const dx = Math.abs(na.x - nb.x);
        const dz = Math.abs(na.z - nb.z);
        if (dx > 1 || dz > 1) return 'mismatch';
        if (dx > 0 || dz > 0) hasFuzzy = true;

        // masks
        if (na.masks || nb.masks) {
            const maskResult = compareNpcMasks(na.masks ?? {}, nb.masks ?? {});
            if (maskResult === 'mismatch') return 'mismatch';
            if (maskResult === 'structural_diff') return 'structural_diff';
            if (maskResult === 'fuzzy_ok') hasFuzzy = true;
        }
    }

    return hasFuzzy ? 'fuzzy_ok' : 'exact';
}

function compareNpcMasks(a: any, b: any): MatchResult {
    let hasFuzzy = false;

    // damage: both must exist, amounts can differ, maxHp must match
    if (a.damage || b.damage) {
        if (!a.damage || !b.damage) return 'structural_diff';
        if (a.damage.maxHp !== b.damage.maxHp) return 'mismatch';
        if (a.damage.type !== b.damage.type) return 'mismatch';
        // amount and currentHp can differ
        hasFuzzy = true;
    }

    // anim can differ (combat stance variations)
    if (a.anim || b.anim) {
        if (!a.anim && b.anim) return 'structural_diff';
        if (a.anim && !b.anim) return 'structural_diff';
        // allow different anim IDs (combat variations)
        hasFuzzy = true;
    }

    // changeType must match
    if (a.changeType !== b.changeType) return 'mismatch';

    return hasFuzzy ? 'fuzzy_ok' : 'exact';
}

function compareUpdateStat(a: any, b: any): MatchResult {
    if (a.stat !== b.stat) return 'mismatch';
    // base level within ±1
    if (Math.abs(a.baseLevel - b.baseLevel) > 1) return 'mismatch';
    // level within ±1
    if (Math.abs(a.level - b.level) > 1) return 'mismatch';
    // exp can differ more (combat XP depends on damage rolls)
    if (a.stat === b.stat && a.baseLevel === b.baseLevel && a.level === b.level && a.exp === b.exp) {
        return 'exact';
    }
    return 'fuzzy_ok';
}

function isPunchKick(animId: number): boolean {
    return animId === 422 || animId === 423;
}

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === undefined && b === undefined) return true;
    if (a === null && b === null) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return a === b;

    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        return a.every((v, i) => deepEqual(v, b[i]));
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(k => deepEqual(a[k], b[k]));
}
