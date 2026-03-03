/**
 * WebSocket test client that speaks the FoundCity JSON protocol.
 *
 * Connects, authenticates, groups incoming messages into 600ms tick buckets,
 * and records everything for later assertion/comparison.
 */

import WebSocket from 'ws';
import { TICK_MS } from './constants.js';
import type { TickRecord, ServerTarget } from './types.js';

export class TestClient {
    private ws: WebSocket | null = null;
    private target: ServerTarget;
    private username: string;

    // tick tracking
    private tickTimer: ReturnType<typeof setInterval> | null = null;
    private currentTick = 0;
    private tracking = false;
    private pid = -1;

    // message buffers
    private preLoginBuffer: any[] = [];
    private currentTickReceived: any[] = [];
    private currentTickSent: any[] = [];
    private records: Map<number, TickRecord> = new Map();

    // login state
    private loginResolve: ((pid: number) => void) | null = null;
    private loginReject: ((err: Error) => void) | null = null;
    private connected = false;

    constructor(target: ServerTarget, username: string) {
        this.target = target;
        this.username = username;
    }

    /**
     * Connect to the server, send auth_login, wait for login_accept.
     * Returns the assigned PID.
     */
    async connect(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this.loginResolve = resolve;
            this.loginReject = reject;

            const url = `ws://${this.target.host}:${this.target.port}`;
            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                this.connected = true;
                // send auth immediately
                this.ws!.send(JSON.stringify({
                    type: 'auth_login',
                    username: this.username,
                    password: 'test',
                }));
            });

            this.ws.on('message', (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString());
                    this.onMessage(msg);
                } catch {
                    // ignore malformed messages
                }
            });

            this.ws.on('error', (err: Error) => {
                if (this.loginReject) {
                    this.loginReject(err);
                    this.loginReject = null;
                    this.loginResolve = null;
                }
            });

            this.ws.on('close', () => {
                this.connected = false;
                this.stopTickTracking();
                if (this.loginReject) {
                    this.loginReject(new Error('Connection closed before login'));
                    this.loginReject = null;
                    this.loginResolve = null;
                }
            });

            // timeout after 10 seconds
            setTimeout(() => {
                if (this.loginReject) {
                    this.loginReject(new Error('Login timeout'));
                    this.loginReject = null;
                    this.loginResolve = null;
                    this.ws?.close();
                }
            }, 10000);
        });
    }

    private onMessage(msg: any): void {
        // handle login response
        if (msg.type === 'login_accept') {
            this.pid = msg.pid;
            this.startTickTracking();
            // flush pre-login buffer into tick 0
            for (const buffered of this.preLoginBuffer) {
                this.currentTickReceived.push(buffered);
            }
            this.preLoginBuffer = [];
            // also record the login_accept itself
            this.currentTickReceived.push(msg);
            if (this.loginResolve) {
                this.loginResolve(this.pid);
                this.loginResolve = null;
                this.loginReject = null;
            }
            return;
        }

        if (msg.type === 'login_reject') {
            if (this.loginReject) {
                this.loginReject(new Error(`Login rejected: ${msg.reason}`));
                this.loginReject = null;
                this.loginResolve = null;
            }
            return;
        }

        // if not tracking yet, buffer
        if (!this.tracking) {
            this.preLoginBuffer.push(msg);
            return;
        }

        this.currentTickReceived.push(msg);
    }

    private startTickTracking(): void {
        this.tracking = true;
        this.currentTick = 0;
        this.currentTickReceived = [];
        this.currentTickSent = [];

        this.tickTimer = setInterval(() => {
            this.advanceTick();
        }, TICK_MS);
    }

    private stopTickTracking(): void {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
        // flush remaining messages into the current tick
        if (this.tracking) {
            this.flushCurrentTick();
        }
        this.tracking = false;
    }

    private advanceTick(): void {
        this.flushCurrentTick();
        this.currentTick++;
        this.currentTickReceived = [];
        this.currentTickSent = [];
    }

    private flushCurrentTick(): void {
        const record: TickRecord = {
            tick: this.currentTick,
            timestamp: Date.now(),
            sent: [...this.currentTickSent],
            received: [...this.currentTickReceived],
        };
        this.records.set(this.currentTick, record);
    }

    /**
     * Send a JSON message to the server and record it in the current tick.
     */
    send(msg: any): void {
        if (!this.ws || !this.connected) {
            throw new Error('Not connected');
        }
        this.ws.send(JSON.stringify(msg));
        if (this.tracking) {
            this.currentTickSent.push(msg);
        }
    }

    /**
     * Wait for n game ticks (n * 600ms + 100ms buffer).
     */
    async waitTicks(n: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, n * TICK_MS + 100);
        });
    }

    /**
     * Wait for a specific condition to appear in received messages.
     * Polls every 100ms up to maxWaitMs.
     */
    async waitForMessage(
        predicate: (msg: any) => boolean,
        maxWaitMs: number = 10000
    ): Promise<any> {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
            // check all recorded messages
            for (const [, record] of this.records) {
                for (const msg of record.received) {
                    if (predicate(msg)) return msg;
                }
            }
            // also check current unrecorded buffer
            for (const msg of this.currentTickReceived) {
                if (predicate(msg)) return msg;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('waitForMessage timeout');
    }

    /**
     * Scan all received npc_info messages for a nearby NPC of the given type.
     * Returns the NPC's nid.
     */
    async findNearbyNpc(npcType: number, maxDistance: number = 15): Promise<number> {
        return this.waitForMessage((msg) => {
            if (msg.type !== 'npc_info') return false;
            for (const npc of (msg.npcs ?? [])) {
                if (npc.npcType === npcType) return true;
            }
            return false;
        }).then((msg) => {
            for (const npc of (msg.npcs ?? [])) {
                if (npc.npcType === npcType) return npc.nid;
            }
            throw new Error(`No NPC of type ${npcType} found`);
        });
    }

    /**
     * Get all tick records.
     */
    getRecords(): Map<number, TickRecord> {
        return new Map(this.records);
    }

    /**
     * Get current tick number.
     */
    getCurrentTick(): number {
        return this.currentTick;
    }

    /**
     * Get the assigned PID.
     */
    getPid(): number {
        return this.pid;
    }

    /**
     * Get all received messages as a flat array, ordered by tick.
     */
    getAllReceived(): any[] {
        const result: any[] = [];
        const ticks = [...this.records.keys()].sort((a, b) => a - b);
        for (const tick of ticks) {
            const record = this.records.get(tick)!;
            result.push(...record.received);
        }
        // also include current unrecorded buffer
        result.push(...this.currentTickReceived);
        return result;
    }

    /**
     * Disconnect from the server.
     */
    disconnect(): void {
        this.stopTickTracking();
        if (this.ws) {
            try {
                // send logout message
                if (this.connected) {
                    this.ws.send(JSON.stringify({ type: 'logout' }));
                }
                this.ws.close();
            } catch {
                // ignore
            }
            this.ws = null;
        }
        this.connected = false;
    }
}
