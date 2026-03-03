# AI Engineer Toolbox

**Reusable patterns, methodologies, and tools for AI-assisted software engineering.**

By [#1 Future](https://github.com/1-Future)

---

## What This Is

A collection of battle-tested approaches for building software with AI. Not frameworks, not libraries — **thinking tools**. Patterns that emerged from real projects and proved worth extracting into reusable form.

Everything here was built during the development of [FutureBuddy](https://github.com/1-Future/FutureBuddy) and its module ecosystem, then generalized for any project.

---

## Contents

### [FutureFlow](./FutureFlow.md) — AI-Native Development Process

A 12-step methodology for building software collaboratively with AI. Starts from real frustration, not theoretical requirements. Key properties:

- **Pain-driven**: every feature traces back to a real frustration
- **Research-first**: know the landscape before planning
- **Robot-resumable**: GitHub Issues are the memory, not conversations
- **Gate-controlled**: humans approve plans before code is written

Use this when you're starting any new feature, module, or product with AI assistance.

### [Dual Testing](./dual-testing/) — Behavioral Comparison Test Harness

A pattern for rebuilding software with confidence by running identical scenarios against both the **original** and **rewrite**, then diffing their outputs. Catches behavioral regressions that unit tests miss.

Use this when you're:
- Rewriting a legacy system in a new language/framework
- Building a compatible alternative to existing software
- Porting a codebase and need to verify behavioral equivalence
- Building a "clean room" implementation from a reference

---

## Philosophy

### Why patterns, not packages

Patterns adapt. Packages constrain. Every codebase has different protocols, architectures, and constraints. What stays constant is the **approach** — connect the same inputs to both systems, record the outputs, diff them. The implementation details change; the strategy doesn't.

### Why AI-native

These patterns assume AI is doing most of the code generation and the human is doing the thinking, directing, and verifying. They're designed for the workflow where you describe what you want and the AI builds it, but you need structured processes to keep quality high and direction clear.

---

## License

Apache 2.0 — use it however you want.
