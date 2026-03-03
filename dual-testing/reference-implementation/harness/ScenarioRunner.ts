/**
 * Executes a Scenario against a single ServerTarget.
 *
 * 1. Connect + login
 * 2. Wait for initial state (2 ticks)
 * 3. Run setup commands
 * 4. Execute steps at scheduled tick offsets
 * 5. Wait trailing ticks
 * 6. Run assertions
 * 7. Disconnect
 */

import { TestClient } from './TestClient.js';
import { StateRecorder } from './StateRecorder.js';
import type { Scenario, ScenarioResult, ServerTarget, AssertionContext } from './types.js';

export class ScenarioRunner {
    private target: ServerTarget;

    constructor(target: ServerTarget) {
        this.target = target;
    }

    async run(scenario: Scenario): Promise<ScenarioResult> {
        const startTime = Date.now();
        const client = new TestClient(this.target, scenario.username);
        const errors: string[] = [];

        try {
            // 1. Connect and login
            const pid = await client.connect();

            // 2. Wait 2 ticks for initial state delivery (rebuild_normal, player_info, etc.)
            await client.waitTicks(2);

            // 3. Run setup commands (cheat commands)
            if (scenario.setup && scenario.setup.length > 0) {
                for (const cmd of scenario.setup) {
                    client.send({ type: 'client_cheat', command: cmd });
                }
                // wait 2 ticks for setup to take effect
                await client.waitTicks(2);
            }

            // 4. Execute steps at their scheduled tick offsets
            if (scenario.steps.length > 0) {
                let lastTick = 0;
                for (const step of scenario.steps) {
                    // wait until the right tick offset
                    const ticksToWait = step.tick - lastTick;
                    if (ticksToWait > 0) {
                        await client.waitTicks(ticksToWait);
                    }
                    client.send(step.message);
                    lastTick = step.tick;
                }
            }

            // 5. Wait trailing ticks after last step
            const trailingTicks = scenario.trailingTicks ?? 5;
            await client.waitTicks(trailingTicks);

            // 6. Build StateRecorder and run assertions
            const recorder = new StateRecorder(
                client.getRecords(),
                scenario,
                this.target,
                pid,
                startTime,
            );

            const context: AssertionContext = {
                allMessages: recorder.allMessages(),
                messagesByTick: recorder.messagesByTick(),
                pid,
                currentTick: client.getCurrentTick(),
            };

            for (const assertion of scenario.assertions) {
                try {
                    const tickMessages = recorder.messagesAtTick(assertion.tick);
                    assertion.assert(tickMessages, context);
                } catch (err) {
                    errors.push(`[Tick ${assertion.tick}] ${assertion.description}: ${(err as Error).message}`);
                }
            }

            // 7. Disconnect
            client.disconnect();

            return {
                passed: errors.length === 0,
                scenario,
                recording: recorder.toRecording(),
                errors,
                duration: Date.now() - startTime,
            };
        } catch (err) {
            client.disconnect();
            errors.push(`Fatal: ${(err as Error).message}`);
            return {
                passed: false,
                scenario,
                recording: {
                    scenario,
                    serverLabel: this.target.label,
                    startTime,
                    endTime: Date.now(),
                    pid: -1,
                    ticks: [],
                },
                errors,
                duration: Date.now() - startTime,
            };
        }
    }
}
