# Zero Zero — Locked System Documentation

## Overview

This document describes the locked, production-ready system that ensures:
1. Questions + answers are locked and consistent
2. Calculations (carbon + money) are deterministic per journey
3. Zone content feed uses real data
4. Database schema is production-ready

## Files Created

### 1. Questions Lock (`lib/journeys/lockedQuestions.ts`)

**Purpose:** Single source of truth for all journey questions.

**Structure:**
- `JOURNEY_QUESTIONS`: Record mapping each `JourneyId` to an array of `LockedQuestion`
- Each question has: `id`, `question`, `type` ('options' | 'number'), and optional `options[]`

**Usage:**
```typescript
import { JOURNEY_QUESTIONS } from '@/lib/journeys/lockedQuestions'

const homeQuestions = JOURNEY_QUESTIONS.home
// Returns: energy_type, energy_provider, monthly_cost, green_tariff
```

### 2. Calculations (`lib/brains/calculations.ts`)

**Purpose:** Locked calculation functions that return annual carbon (kg) and money (£) savings.

**Rules:**
- Carbon always annual kg
- Money always annual £
- Money never negative (0 if no saving)
- All functions return `ImpactResult` with `carbonKg`, `moneyGbp`, and `source`

**Available Functions:**
- `calculateHome(a)` - Home energy calculations
- `calculateTravel(a)` - Transport calculations
- `calculateFood(a)` - Food waste and diet calculations
- `calculateShopping(a)` - Shopping habits calculations
- `calculateMoney(a)` - Financial savings calculations
- `calculateCarbon(a)` - Carbon tracking calculations
- `calculateTech(a)` - Tech device calculations
- `calculateWaste(a)` - Waste and recycling calculations
- `calculateHolidays(a)` - Travel and aviation calculations

**Usage:**
```typescript
import { calculateHome } from '@/lib/brains/calculations'

const answers = { monthly_cost: '100', green_tariff: 'NO' }
const result = calculateHome(answers)
// Returns: { carbonKg: 540, moneyGbp: 120, source: 'uk energy saving trust' }
```

### 3. Zone Content Feed (`lib/zone/buildZoneItems.ts`)

**Purpose:** Builds Zone cards from real calculations based on user answers.

**Function:** `buildZoneFromAnswers(allAnswers)`

**Returns:** Array of `ZoneCardData` with:
- `journey`: JourneyId
- `title`: Card title
- `carbon`: Annual carbon savings (kg)
- `money`: Annual money savings (£)
- `source`: Data source

**Usage:**
```typescript
import { buildZoneFromAnswers } from '@/lib/zone/buildZoneItems'

const allAnswers = {
  home: { monthly_cost: '100', green_tariff: 'NO' },
  travel: { weekly_distance: '50', fuel_type: 'PETROL' }
}

const cards = buildZoneFromAnswers(allAnswers)
// Returns array of cards with real calculated values
```

### 4. Database Schema (`db/schema/neon-locked.sql`)

**Purpose:** Production-ready Neon PostgreSQL schema.

**Tables:**
1. **users** - User profiles (id, name, postcode, created_at)
2. **journey_answers** - User answers to journey questions (user_id, journey_key, question_id, answer)
3. **journey_impacts** - Calculated impact per journey (user_id, journey_key, carbon_kg, money_gbp, source)
4. **cards** - Real content cards (journey_key, title, body, carbon_kg, money_gbp, source)

**Indexes:**
- `idx_journey_answers_user_journey` - Fast lookup of answers
- `idx_journey_impacts_user` - Fast lookup of impacts
- `idx_cards_journey` - Fast lookup of cards by journey

## Integration Points

### Current System
The existing `lib/zone.ts` and `lib/journeys.ts` remain in place for backward compatibility. The new locked system can be gradually integrated.

### Next Steps
1. Update journey pages to use `JOURNEY_QUESTIONS` from `lockedQuestions.ts`
2. Update `lib/zone.ts` to use `buildZoneFromAnswers()` for real calculations
3. Update API routes to use new calculation functions
4. Deploy Neon SQL schema to production database

## Benefits

✅ **No Drift:** Questions and calculations are locked and cannot be accidentally changed
✅ **Real Data:** Zone cards show actual calculated values, not placeholders
✅ **Traceable:** Every calculation has a source attribution
✅ **Scalable:** Database schema supports production workloads
✅ **Deterministic:** Same answers always produce same results

## Migration Path

1. **Phase 1:** Use new calculations alongside existing system (current state)
2. **Phase 2:** Update journey pages to use locked questions
3. **Phase 3:** Migrate Zone to use `buildZoneFromAnswers()`
4. **Phase 4:** Deploy Neon schema and migrate data
5. **Phase 5:** Remove old calculation logic
