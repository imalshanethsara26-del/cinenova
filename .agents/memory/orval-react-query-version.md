---
name: Orval React Query version
description: Keep generated API client types aligned with the workspace React Query and DOM library versions.
---

Pin Orval's React Query output to the major version used by the consuming applications, and include `DOM.Iterable` in the generated client's TypeScript libraries when its fetch wrapper uses `Headers.entries()`.

**Why:** The API-spec package may not declare the frontend query dependency, so Orval can silently default to v4 even when applications use v5. The generated fetch helper also relies on iterable DOM header types.

**How to apply:** When updating API generation or workspace dependencies, verify the generated hook major version and run the root typecheck after codegen.
