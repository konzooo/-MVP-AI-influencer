# AI Influencer — Development Rules

These rules always apply when working in this repository.

## Bug & Issue Explanations

When explaining bugs or issues, provide:

1. **What was wrong** — Brief, plain English explanation of the root cause
2. **Why it happened** — Easy-to-understand reason (include an example if the logic is complex)
3. **Why it's fixed** — Explain the fix and why it resolves the issue

Keep explanations concise and accessible.

## Feature Development Summaries

When building a feature, provide:

1. **What we built** — Quick description of the feature
2. **How** — Implementation approach, including key files changed
3. **Testing** — How to test it, including manual steps, test cases, or automated coverage

## Code Style & Approach

- Avoid over-engineering. Only make changes that are directly requested or clearly necessary.
- No premature abstractions. Three similar lines of code is fine; do not abstract for hypothetical future use.
- Trust internal code. Do not add defensive error handling for scenarios that cannot happen.
- Validate at boundaries. Validate user input and external API input, not trusted internal calls.
- Ask before destructive actions such as force pushing, deleting branches, or hard resets.

## Guardrails

Always ask before:

- Force pushing or other destructive git operations
- Deleting files or branches
- Modifying CI/CD pipelines
- Making breaking changes to shared code
- Pushing to remote
