# Reference Implementation — FoundCity RS225 Test Harness

This is a complete working dual-testing harness built for [FoundCity](https://github.com/1-Future/FoundCity), a clean TypeScript rewrite of the RS225 (RuneScape 2005) game server. It compares FoundCity's behavior against [lostcity-emulator](https://github.com/1-Future/lostcity-emulator), the original reference implementation.

## Why This Is a Good Reference

- **JSON/WebSocket protocol** — easy to read and debug (no binary parsing)
- **600ms tick cycle** — natural time bucketing for message grouping
- **Mix of deterministic and random** — pathfinding is exact, combat is fuzzy
- **Cheat commands** — setup scenarios without external tooling
- **Persistent state** — demonstrates the save-file pollution problem and solution

## File Structure

```
reference-implementation/
  harness/
    types.ts              Shared interfaces (Scenario, TickRecord, etc.)
    constants.ts          Game constants and server targets
    TestClient.ts         WebSocket client with auth + tick bucketing
    StateRecorder.ts      Query helpers over recorded messages
    ScenarioRunner.ts     Executes scenario against one server
    FuzzyMatcher.ts       Exact/structural/ignore matching rules
    Comparator.ts         Tick-by-tick diff engine
    DualRunner.ts         Runs scenario on both servers + compares
  scenarios/
    01-login-and-spawn.ts Login handshake verification
    02-walk-to-coordinate.ts Deterministic pathfinding
    03-attack-rat.ts      NPC combat with fuzzy damage matching
    04-public-chat.ts     Chat broadcast via player_info masks
    05-pickup-ground-item.ts Cheat command verification
    index.ts              Re-exports all scenarios
  integration/
    solo.test.ts          vitest: scenarios vs FoundCity only
    dual.test.ts          vitest: scenarios vs both servers
```

## Protocol Details (FoundCity-Specific)

**Connect:** `ws://localhost:PORT`
**Auth:** Send `{ type: 'auth_login', username, password }` → receive `{ type: 'login_accept', pid, staffModLevel }`
**Tick rate:** 600ms — server sends `player_info`, `npc_info`, zone updates, then buffered messages each tick
**Coordinates:** Absolute world tiles (0-16383), X = east/west, Z = north/south

## Running

```bash
# Prerequisites
cd ~/Desktop/FoundCity && npm install
cd ~/Desktop/lostcity-emulator && npm install
echo "WEB_PORT=8889" > ~/Desktop/lostcity-emulator/.env

# Solo tests (FoundCity only)
cd ~/Desktop/FoundCity && npm run dev          # terminal 1
cd ~/Desktop/FoundCity && npm run test:solo    # terminal 2

# Dual tests (both servers)
cd ~/Desktop/lostcity-emulator && npm run dev  # terminal 2
cd ~/Desktop/FoundCity && npm run test:dual    # terminal 3
```

## Adapting to Your Project

1. Replace `TestClient.ts` with your protocol's connect/auth/send/receive logic
2. Replace `constants.ts` with your server targets and game constants
3. Keep the `types.ts` interfaces — they're protocol-agnostic
4. Rewrite `FuzzyMatcher.ts` with your domain's determinism rules
5. Write new scenarios in `scenarios/` following the same Scenario interface
6. The `ScenarioRunner`, `Comparator`, and `DualRunner` work as-is for most cases
