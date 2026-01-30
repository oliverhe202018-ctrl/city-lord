# Data Synchronization Protocol

## 1. Core Principle
**Single Source of Truth**: All asset changes (Coins, Stamina, Experience, Area) MUST be committed to the database first. Frontend state is merely a reflection of the database state.

## 2. Atomic Operations
To prevent race conditions and data inconsistency, all numerical updates must be performed using database atomic operations or stored procedures (RPCs).

**Forbidden:**
```typescript
// ❌ Race condition prone
const user = await getUser(id);
await updateUser(id, { coin: user.coin + 10 });
```

**Required:**
```typescript
// ✅ Atomic update via RPC
await supabase.rpc('increment_coin', { amount: 10 });
```

## 3. Implementation Status
The following atomic RPC functions have been implemented in `supabase/rpc.sql` and exposed via `app/actions/user.ts`:

| Function Name | Description | Parameters | Returns |
|From SQL|Action Name|Params|Return Type|
|---|---|---|---|
| `add_user_experience` | Adds EXP, handles level up logic | `amount: int` | `{ level, current_exp, max_exp, leveled_up }` |
| `consume_user_stamina` | Deducts stamina if sufficient | `amount: int` | `boolean` (success) |
| `restore_user_stamina` | Adds stamina up to max | `amount: int` | `int` (new stamina) |
| `add_user_area` | Adds to total area | `amount: numeric` | `numeric` (new area) |

## 4. Frontend Integration Guide
When implementing game features (e.g., Claim Mission, Capture Hex):

1. **Call Server Action**: Use the atomic actions from `app/actions/user.ts`.
2. **Handle Response**: 
   - If success: Update local Zustand store with the returned *new values* (not calculated locally).
   - If error: Show error toast, revert any optimistic UI changes.

```typescript
// Example: Claiming a mission
import { addExperience } from '@/app/actions/user';
import { useGameStore } from '@/store/useGameStore';

async function handleClaim() {
  try {
    // 1. Call Server Action
    const result = await addExperience(50);
    
    // 2. Update Local Store with REAL data from DB
    useGameStore.setState(state => ({
      currentExp: result.current_exp,
      level: result.level,
      maxExp: result.max_exp
    }));
    
  } catch (err) {
    console.error("Claim failed", err);
  }
}
```
