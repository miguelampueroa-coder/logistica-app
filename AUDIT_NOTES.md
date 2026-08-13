# 📋 AUDIT NOTES FOR FABLE

## Context
Auditor Fable should review:
1. Code changes (backend + móvil + web) — STANDARD audit
2. **Knowledge graph (graphify)** — check if refactoring reflects in architecture

## Graphify State (Pre-Refactoring)
- **File**: `graphify-out/graph.json` (1.0 MB)
- **Nodes**: 956
- **Edges**: 1657
- **Communities**: 51
- **Built from commit**: `714a79f9` (outdated, refactoring happened AFTER)

## Key Finding: God Node
**`getSupabaseAdmin()` had 72 edges** before refactoring:
```
Problem (2026-07-29):
- Central database access point
- Every service connected to it
- Tight coupling
- Single point of failure

Solution (2026-07-31):
- Refactored to EventBus pattern
- Decoupled notifications
- Added withRetry() for resilience
- New files:
  - event-bus.ts
  - notification-subscribers.ts
  - tracking-event-emitter.ts
  - auth-v2.ts
```

## What Fable Should Check

### Architecture Health
1. **New god nodes?** Check if refactoring created new bottlenecks
2. **Orphaned code?** Any services no longer called after EventBus migration
3. **Circular dependencies?** EventBus → subscribers chain
4. **Memory leaks?** EventEmitter without cleanup

### Code Quality
1. **Auth-v2 edge cases:** null checks on profile fetch
2. **Token refresh flow:** edge case where session expires mid-request
3. **Event subscribers:** error handling in async handlers
4. **Deep linking:** fallback when linking config fails

### Integration Points
1. **Webhook signature validation:** Stripe + Meta
2. **RLS policies:** still enforced after auth refactor
3. **Cache TTL:** 5min on user profile — sufficient?
4. **Retry logic:** exponential backoff (100/200/400ms)

## Expected Findings

**Good news (we've already verified):**
- ✅ 89/89 tests passing
- ✅ 0 TypeScript errors
- ✅ Proper null checks everywhere
- ✅ SignOut clears AsyncStorage
- ✅ Token refresh clears auth on failure

**Possible concerns (for Fable to flag):**
- ❓ EventBus listeners not unregistered (minor memory leak potential)
- ❓ Cache.get<string>() casting vs actual return type
- ❓ Retry logic doesn't validate if connection actually works (just delays)

## Graphs to Compare

```bash
# Before (graphify-out/graph.json):
# getSupabaseAdmin: 72 edges

# After (refresh needed):
# Should have fewer direct edges if EventBus worked
# New nodes: EventBus, ShipmentEvent, setupNotificationSubscribers

# To refresh:
graphify update /Users/spaun/logistica-app
```

## Deliverable
Please report:
1. Any **CRITICAL** security/correctness issues
2. Any **HIGH** performance or memory concerns
3. **MEDIUM** code-quality findings
4. Recommendations on whether graph refresh shows architecture improvement

---

**Date**: 2026-07-31
**Target**: Enviazo monorepo (backend + móvil + web)
**Context**: Post-refactoring audit (5 critical points addressed)
