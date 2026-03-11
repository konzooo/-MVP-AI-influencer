# AI Influencer — Development Rules

## Bug & Issue Explanations

When explaining bugs or issues:

1. **What was wrong** — Brief, plain English explanation of the root cause
2. **Why it happened** — Easy-to-understand reason (include example if the logic is complex)
3. **Why it's fixed** — Explain the fix and why it resolves the issue

Keep explanations concise and accessible — I want to understand what broke and why we think it's fixed.

## Feature Development Summaries

When building a feature, provide:

1. **What we built** — Quick description of the feature
2. **How** — Implementation approach (which files changed, key changes)
3. **Testing** — How to test it (manual steps, test cases, or automated approach)

## Code Style & Approach

- **Avoid over-engineering** — Only make changes that are directly requested or clearly necessary
- **No premature abstractions** — Three similar lines of code is fine; don't abstract for "what if"
- **Trust internal code** — Don't add error handling for scenarios that can't happen
- **Validate at boundaries** — Only validate user input and external APIs, not internal calls
- **Vibe coding** — I have broad control, but always ask before destructive actions (force push, delete branches, hard reset)

## Guardrails

Always ask before:
- Force pushing or destructive git operations
- Deleting files or branches
- Modifying CI/CD pipelines
- Making breaking changes to shared code
- Pushing to remote without confirmation
