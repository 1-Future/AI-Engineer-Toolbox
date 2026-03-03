/**
 * Wraps TestClient records with query helpers for inspection and comparison.
 */

import type { TickRecord, ScenarioRecording, Scenario, ServerTarget } from './types.js';

export class StateRecorder {
    private records: Map<number, TickRecord>;
    private scenario: Scenario;
    private serverTarget: ServerTarget;
    private pid: number;
    private startTime: number;

    constructor(
        records: Map<number, TickRecord>,
        scenario: Scenario,
        serverTarget: ServerTarget,
        pid: number,
        startTime: number,
    ) {
        this.records = records;
        this.scenario = scenario;
        this.serverTarget = serverTarget;
        this.pid = pid;
        this.startTime = startTime;
    }

    /** Flattened, tick-ordered list of all received messages. */
    allMessages(): any[] {
        const result: any[] = [];
        const ticks = [...this.records.keys()].sort((a, b) => a - b);
        for (const tick of ticks) {
            result.push(...this.records.get(tick)!.received);
        }
        return result;
    }

    /** Messages received at a specific tick. */
    messagesAtTick(tick: number): any[] {
        return this.records.get(tick)?.received ?? [];
    }

    /** Filter all received messages by type. */
    messagesByType(type: string): any[] {
        return this.allMessages().filter(m => m.type === type);
    }

    /** Map of tick → received messages. */
    messagesByTick(): Map<number, any[]> {
        const map = new Map<number, any[]>();
        for (const [tick, record] of this.records) {
            if (record.received.length > 0) {
                map.set(tick, record.received);
            }
        }
        return map;
    }

    /** Extract player positions from player_info messages, keyed by tick. */
    playerMovements(): Map<number, { x: number; z: number }> {
        const movements = new Map<number, { x: number; z: number }>();
        for (const [tick, record] of this.records) {
            for (const msg of record.received) {
                if (msg.type === 'player_info') {
                    const self = (msg.players ?? []).find((p: any) => p.pid === this.pid);
                    if (self) {
                        movements.set(tick, { x: self.x, z: self.z });
                    }
                }
            }
        }
        return movements;
    }

    /** Extract NPC damage events from npc_info masks. */
    npcDamageEvents(): Array<{ tick: number; nid: number; amount: number; currentHp: number; maxHp: number }> {
        const events: Array<{ tick: number; nid: number; amount: number; currentHp: number; maxHp: number }> = [];
        for (const [tick, record] of this.records) {
            for (const msg of record.received) {
                if (msg.type === 'npc_info') {
                    for (const npc of (msg.npcs ?? [])) {
                        if (npc.masks?.damage) {
                            events.push({
                                tick,
                                nid: npc.nid,
                                amount: npc.masks.damage.amount,
                                currentHp: npc.masks.damage.currentHp,
                                maxHp: npc.masks.damage.maxHp,
                            });
                        }
                    }
                }
            }
        }
        return events;
    }

    /** Serialize to ScenarioRecording for comparison. */
    toRecording(): ScenarioRecording {
        const ticks = [...this.records.keys()].sort((a, b) => a - b);
        return {
            scenario: this.scenario,
            serverLabel: this.serverTarget.label,
            startTime: this.startTime,
            endTime: Date.now(),
            pid: this.pid,
            ticks: ticks.map(t => this.records.get(t)!),
        };
    }
}
