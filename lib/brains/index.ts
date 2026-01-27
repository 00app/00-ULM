/**
 * Zero Zero Brains Layer
 * All logic, calculations, and intelligence
 * NO React. NO JSX. TypeScript utilities only.
 */

// Carbon calculations (DEPRECATED - use ./calculations.ts instead)
// export * from './carbon/calculations' // DEPRECATED
// export * from './carbon/transport' // DEPRECATED

// Locked calculations (annual impact per journey)
export * from './calculations'

// Geo location services
export * from './geo/postcode'
export * from './geo/openstreetmap'
export * from './geo/localOffers'

// Content management
export * from './content/images'
export * from './content/sources'
export * from './content/copy'

// Zai chat logic
export * from './zai/boundaries'
export * from './zai/prompts'
export * from './zai/router'
