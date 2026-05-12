/**
 * Transport-specific carbon calculations
 */

export interface TransportMode {
  id: string
  name: string
  carbonPerKm: number // kg CO₂e per km
  source: 'DEFRA' | 'IEA' | 'BEIS'
}

/**
 * Transport mode carbon factors (kg CO₂e per km)
 */
export const TRANSPORT_MODES: Record<string, TransportMode> = {
  car_petrol: {
    id: 'car_petrol',
    name: 'Petrol Car',
    carbonPerKm: 0.404 / 1.609, // per mile converted to per km
    source: 'DEFRA',
  },
  car_diesel: {
    id: 'car_diesel',
    name: 'Diesel Car',
    carbonPerKm: 0.447 / 1.609,
    source: 'DEFRA',
  },
  train: {
    id: 'train',
    name: 'Train',
    carbonPerKm: 0.041 / 1.609,
    source: 'DEFRA',
  },
  bus: {
    id: 'bus',
    name: 'Bus',
    carbonPerKm: 0.105 / 1.609,
    source: 'DEFRA',
  },
  walking: {
    id: 'walking',
    name: 'Walking',
    carbonPerKm: 0,
    source: 'DEFRA',
  },
  cycling: {
    id: 'cycling',
    name: 'Cycling',
    carbonPerKm: 0,
    source: 'DEFRA',
  },
}

/**
 * Calculate carbon savings from switching transport modes
 */
export function calculateTransportSavings(
  fromMode: string,
  toMode: string,
  distanceKm: number
): number {
  const from = TRANSPORT_MODES[fromMode]
  const to = TRANSPORT_MODES[toMode]
  
  if (!from || !to) return 0
  
  const fromCarbon = from.carbonPerKm * distanceKm
  const toCarbon = to.carbonPerKm * distanceKm
  
  return fromCarbon - toCarbon
}
