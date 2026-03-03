# Dual Testing — Behavioral Comparison for Software Rebuilds

## The Problem

You're rebuilding software. Maybe it's a legacy system rewritten in a modern stack. Maybe it's a clean-room implementation from a reference. Maybe it's an open-source alternative to proprietary software.

Unit tests verify individual functions work correctly. Integration tests verify components talk to each other. But **behavioral comparison tests** verify the thing you built *acts the same as the thing you're replacing*.

This is the gap that kills rewrites. The new system passes all its own tests but behaves differently from the original in ways nobody thought to test for.

## The Pattern

```
                    ┌─────────────────┐
                    │  Test Scenario   │
                    │  (scripted       │
                    │   inputs)        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
               ┌────┤  Scenario Runner ├────┐
               │    └─────────────────┘    │
               │                           │
      ┌────────▼────────┐       ┌──────────▼──────────┐
      │  Original System │       │   Rewrite / New     │
      │  (reference)     │       │   System             │
      └────────┬────────┘       └──────────┬──────────┘
               │                           │
      ┌────────▼────────┐       ┌──────────▼──────────┐
      │  Recording A     │       │   Recording B        │
      │  (messages by    │       │   (messages by       │
      │   tick/time)     │       │    tick/time)        │
      └────────┬────────┘       └──────────┬──────────┘
               │                           │
               └────────────┬──────────────┘
                    ┌───────▼───────┐
                    │  Comparator    │
                    │  (exact +      │
                    │   fuzzy diff)  │
                    └───────┬───────┘
                    ┌───────▼───────┐
                    │  Diff Report   │
                    │  (pass/fail    │
                    │   per tick)    │
                    └───────────────┘
```

**Same inputs → both systems → compare outputs → flag differences.**

The trick is handling **legitimate variance**. Not everything should match exactly. Combat damage rolls are random. Timestamps differ. Animation IDs might alternate. The Comparator needs to know what must be identical and what can differ.

## Core Components

### 1. Test Client

A lightweight client that speaks the system's protocol. Connects, authenticates, sends scripted messages, and records every response grouped by time window (tick, frame, second — whatever the system's natural rhythm is).

**Key behaviors:**
- Buffers messages into time-bucketed records
- Tracks what was sent vs received per bucket
- Provides query helpers (find messages by type, extract specific data)

### 2. Scenario

A declarative description of a test case:

```
Scenario {
  id, name, description
  username          — unique per scenario (avoid state collision)
  setup[]           — admin commands to set initial conditions
  steps[]           — {tick, message} pairs sent at specific times
  assertions[]      — {tick, description, assert(messages, context)} checks
  trailingTicks     — extra time to record after last step
}
```

Scenarios are **portable** — they describe *what to do*, not *how to connect*. The runner handles the protocol details.

### 3. Scenario Runner (Solo Mode)

Executes one scenario against one server:

1. Connect and authenticate
2. Wait for initial state delivery
3. Run setup commands (teleport, set stats, spawn items — whatever puts the world in a known state)
4. Execute steps at scheduled time offsets
5. Wait for trailing period
6. Run all assertions against the recorded messages
7. Disconnect and return pass/fail with error details

### 4. Fuzzy Matcher

The hardest part of the whole system. Three categories:

| Category | Rule | Examples |
|----------|------|----------|
| **Exact match** | Must be identical between servers | Login responses, map data, UI setup |
| **Structural match** | Shape must match, values can differ | Damage amounts (random rolls), XP gains, entity positions (±1 for timing) |
| **Ignore** | Skip entirely | Audio events, cosmetic effects |

The fuzzy rules encode **domain knowledge** about what's deterministic and what's random. Walking is deterministic (both servers MUST produce identical paths). Combat damage is random (both servers must produce damage events, but amounts can differ).

### 5. Comparator + Dual Runner

**Dual Runner**: Runs the scenario on the reference server first, waits for the world to settle (entity respawns, etc.), then runs on the new server. Feeds both recordings to the Comparator.

**Comparator**: Iterates time buckets, groups messages by type, applies the matching rules, produces a diff report. Each diff is classified:

- `exact_mismatch` — should be identical, isn't (BUG)
- `structural_difference` — wrong shape (BUG)
- `missing_message` — reference sent it, new system didn't (BUG)
- `extra_message` — new system sent it, reference didn't (INVESTIGATE)
- `fuzzy_acceptable` — differs within expected variance (OK)

A test passes when there are zero non-fuzzy diffs.

## How to Adapt This Pattern

### Step 1: Identify the Protocol

Both systems must speak the same (or translatable) protocol. This works best when:
- Both use the same wire format (JSON, protobuf, binary)
- Both use the same coordinate/ID systems
- Both have the same tick/update rate

If the protocols differ, you need a **translation layer** in the test client that normalizes both outputs into a common format before comparison.

### Step 2: Map Your Determinism

List everything in your system and classify it:

| Deterministic (must match) | Non-deterministic (fuzzy) | Cosmetic (ignore) |
|---|---|---|
| Pathfinding results | Damage rolls | Sound effects |
| State machine transitions | Random drops | Particle effects |
| Protocol handshakes | AI wander paths | Client-side animations |
| Inventory operations | Spawn timing (±1 tick) | Log messages |

This becomes your FuzzyMatcher configuration.

### Step 3: Design Your Scenarios

Start with the basics and build up:

1. **Connection/auth** — Does login work? Is initial state correct?
2. **Deterministic operations** — Movement, state changes, calculations
3. **Interactive operations** — Entity interaction, combat, trading
4. **Chat/broadcast** — Message propagation
5. **Admin/debug** — Cheat commands, debug tools

Each scenario should test ONE behavior clearly. Use setup commands to isolate the behavior from world state.

### Step 4: Handle Dynamic IDs

Entity IDs, session IDs, and other runtime-assigned values are unpredictable. Your test client needs **discovery helpers**:

```
// Don't hardcode: attack NPC #47
// Instead: find the nearest NPC of type "rat", then attack it
const ratId = await client.findNearbyEntity(type: 'rat');
client.send({ type: 'attack', target: ratId });
```

### Step 5: Handle Persistent State

Players save their state between sessions. Previous test runs leave artifacts. Every scenario should either:
- Use a **unique username** so there's no save file collision
- Include **setup commands** that reset state to known values (teleport to spawn, reset stats, clear inventory)

## When to Use Solo vs Dual Mode

**Solo mode** (assertions only):
- You don't have the reference server running
- You're testing your own system's correctness against RS225/spec expectations
- Faster — one connection, no comparison overhead
- Good for CI/CD pipelines

**Dual mode** (comparison):
- You have both servers available
- You want to discover *unknown* behavioral differences
- Catches things you didn't think to write assertions for
- The reference server IS the spec — you don't need to know every expected value

**Best practice**: Write solo tests first with explicit assertions. Then run dual mode to discover what you missed. Turn those discoveries into new solo assertions.

## Reference Implementation

The [`reference-implementation/`](./reference-implementation/) directory contains a complete working example built for [FoundCity](https://github.com/1-Future/FoundCity) (RS225 game server rewrite). It demonstrates:

- WebSocket-based JSON protocol test client with 600ms tick bucketing
- 5 scenarios: login, movement, combat, chat, admin commands
- Fuzzy matching for combat randomness (damage rolls, animation alternation)
- Solo and dual vitest integration tests

The reference uses vitest, TypeScript, and the `ws` library, but the pattern works with any test framework, language, or protocol.

## Key Lessons Learned

1. **`sanitizeChat` will get you** — text processing functions transform inputs in ways you don't expect. Always verify what the server actually sends, not what you sent it.

2. **Save files are test pollution** — player state persists. Unique usernames + setup teleports are non-negotiable.

3. **The first player_info isn't always at spawn** — servers deliver state progressively. Don't assume the first message has the data you need. Scan ALL messages.

4. **Cheat commands don't always trigger protocol messages** — a `::give` command might add items server-side without sending an inventory update to the client. Test what actually goes over the wire, not what you think should.

5. **Teleports look like bugs in movement tests** — instantaneous position changes violate "1 tile per tick" rules. Check `moveSpeed` before flagging jumps.

6. **Run tests against the live server early** — don't write all 5 scenarios then test. Write one, run it, fix it, then write the next. Each scenario teaches you something about the protocol.
