/**
 * Shared type definitions for the behavioral comparison test harness.
 */

export interface ScenarioStep {
    description: string;
    /** Tick offset from scenario start when this step should execute. */
    tick: number;
    /** Client→server JSON message. */
    message: any;
}

export interface TickAssertion {
    tick: number;
    description: string;
    /** Throws on failure. */
    assert: (messages: any[], context: AssertionContext) => void;
}

export interface AssertionContext {
    allMessages: any[];
    messagesByTick: Map<number, any[]>;
    pid: number;
    currentTick: number;
}

export interface Scenario {
    id: string;
    name: string;
    description: string;
    /** Unique per scenario to avoid save file collision. */
    username: string;
    steps: ScenarioStep[];
    assertions: TickAssertion[];
    /** Ticks to record after last step (default 5). */
    trailingTicks?: number;
    /** Cheat commands to run before steps. */
    setup?: string[];
    tags?: string[];
}

export interface TickRecord {
    tick: number;
    timestamp: number;
    sent: any[];
    received: any[];
}

export interface ScenarioRecording {
    scenario: Scenario;
    serverLabel: string;
    startTime: number;
    endTime: number;
    pid: number;
    ticks: TickRecord[];
}

export interface ComparisonResult {
    scenario: Scenario;
    matched: boolean;
    foundcityRecording: ScenarioRecording;
    referenceRecording: ScenarioRecording;
    diffs: TickDiff[];
}

export interface TickDiff {
    tick: number;
    description: string;
    severity: 'exact_mismatch' | 'fuzzy_acceptable' | 'structural_difference' | 'missing_message' | 'extra_message';
    foundcityMessages: any[];
    referenceMessages: any[];
    details: string;
}

export interface ServerTarget {
    label: string;
    host: string;
    port: number;
}

export interface ScenarioResult {
    passed: boolean;
    scenario: Scenario;
    recording: ScenarioRecording;
    errors: string[];
    duration: number;
}

export interface DualResult {
    passed: boolean;
    scenario: Scenario;
    comparison: ComparisonResult;
    foundcityResult: ScenarioResult;
    referenceResult: ScenarioResult;
}
