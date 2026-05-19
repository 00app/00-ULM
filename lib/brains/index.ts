/**
 * Zero Zero Brains Layer
 * All logic, calculations, and intelligence
 * NO React. NO JSX. TypeScript utilities only.
 */

// Locked calculations (annual impact per journey)
export * from './calculations'

// Geo location services
export * from './geo/postcode'
export * from './geo/openstreetmap'
export * from './geo/localOffers'

// Zai chat logic
export * from './zai/boundaries'
export * from './zai/prompts'
export * from './zai/router'
