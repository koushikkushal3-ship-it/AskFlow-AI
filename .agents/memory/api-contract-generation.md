---
name: API contract generation
description: OpenAPI integer schemas can generate unsupported zod.int calls in this workspace's Zod version.
---

Prefer numeric schemas for count-like API fields when using the current Orval/Zod toolchain; integer schemas generated `zod.int()` and broke the shared library typecheck.

**Why:** The generated validator targets a newer Zod API than the workspace dependency currently exposes.

**How to apply:** After changing `lib/api-spec/openapi.yaml`, run codegen and the library typecheck before relying on generated hooks.