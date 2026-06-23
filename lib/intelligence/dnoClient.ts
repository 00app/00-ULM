/**
 * Postcode prefix → Distribution Network Operator (DNO) region.
 * Static map — no API key; covers England, Wales, and Scotland outcodes.
 */

export type DnoRegion =
  | 'UKPN'
  | 'SSEN'
  | 'NGED'
  | 'ENWL'
  | 'NPG'
  | 'SPEN'
  | 'SP_D'
  | 'UNKNOWN'

export type DnoSnapshot = {
  found: boolean
  dnoRegion: DnoRegion
  label: string
}

/** Outcode prefix (2–4 chars) → DNO. Longer prefixes checked first. */
const OUTCODE_DNO: Array<{ prefix: string; region: DnoRegion; label: string }> = [
  { prefix: 'SW1', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'SW3', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'SW7', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'W8', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'W1', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'EC', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'WC', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'E', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'N', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'NW', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'SE', region: 'UKPN', label: 'UK Power Networks (London)' },
  { prefix: 'SW', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'BN', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'RH', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'GU', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'KT', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'CR', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'SM', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'BR', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'DA', region: 'UKPN', label: 'UK Power Networks (South East)' },
  { prefix: 'IG', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'RM', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'CM', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'SS', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'CO', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'IP', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'NR', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'CB', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'AL', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'SG', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'EN', region: 'UKPN', label: 'UK Power Networks (East)' },
  { prefix: 'SO', region: 'SSEN', label: 'Scottish and Southern (Southern)' },
  { prefix: 'PO', region: 'SSEN', label: 'Scottish and Southern (Southern)' },
  { prefix: 'BH', region: 'SSEN', label: 'Scottish and Southern (Southern)' },
  { prefix: 'SP', region: 'SSEN', label: 'Scottish and Southern (Southern)' },
  { prefix: 'RG', region: 'SSEN', label: 'Scottish and Southern (Southern)' },
  { prefix: 'BS', region: 'NGED', label: 'National Grid (Western Power)' },
  { prefix: 'BA', region: 'NGED', label: 'National Grid (Western Power)' },
  { prefix: 'EX', region: 'NGED', label: 'National Grid (Western Power)' },
  { prefix: 'PL', region: 'NGED', label: 'National Grid (Western Power)' },
  { prefix: 'TR', region: 'NGED', label: 'National Grid (Western Power)' },
  { prefix: 'TA', region: 'NGED', label: 'National Grid (Western Power)' },
  { prefix: 'GL', region: 'NGED', label: 'National Grid (Western Power)' },
  { prefix: 'SN', region: 'NGED', label: 'National Grid (Western Power)' },
  { prefix: 'B', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'CV', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'DY', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'WS', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'WV', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'ST', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'DE', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'LE', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'NG', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'NN', region: 'NGED', label: 'National Grid (Midlands)' },
  { prefix: 'M', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'L', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'OL', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'SK', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'WA', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'WN', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'FY', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'PR', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'BB', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'BL', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'LA', region: 'ENWL', label: 'Electricity North West' },
  { prefix: 'NE', region: 'NPG', label: 'Northern Powergrid (North East)' },
  { prefix: 'SR', region: 'NPG', label: 'Northern Powergrid (North East)' },
  { prefix: 'DH', region: 'NPG', label: 'Northern Powergrid (North East)' },
  { prefix: 'TS', region: 'NPG', label: 'Northern Powergrid (North East)' },
  { prefix: 'DL', region: 'NPG', label: 'Northern Powergrid (North East)' },
  { prefix: 'YO', region: 'NPG', label: 'Northern Powergrid (Yorkshire)' },
  { prefix: 'HU', region: 'NPG', label: 'Northern Powergrid (Yorkshire)' },
  { prefix: 'DN', region: 'NPG', label: 'Northern Powergrid (Yorkshire)' },
  { prefix: 'S', region: 'NPG', label: 'Northern Powergrid (Yorkshire)' },
  { prefix: 'LS', region: 'NPG', label: 'Northern Powergrid (Yorkshire)' },
  { prefix: 'HD', region: 'NPG', label: 'Northern Powergrid (Yorkshire)' },
  { prefix: 'HX', region: 'NPG', label: 'Northern Powergrid (Yorkshire)' },
  { prefix: 'WF', region: 'NPG', label: 'Northern Powergrid (Yorkshire)' },
  { prefix: 'G', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'PA', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'FK', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'EH', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'KY', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'DD', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'AB', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'IV', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'KW', region: 'SPEN', label: 'SP Energy Networks (Scotland)' },
  { prefix: 'CF', region: 'SP_D', label: 'SP Manweb (North Wales / Merseyside)' },
  { prefix: 'LL', region: 'SP_D', label: 'SP Manweb (North Wales / Merseyside)' },
  { prefix: 'CH', region: 'SP_D', label: 'SP Manweb (North Wales / Merseyside)' },
  { prefix: 'LD', region: 'SP_D', label: 'SP Manweb (North Wales / Merseyside)' },
  { prefix: 'SA', region: 'SP_D', label: 'SP Manweb (South Wales)' },
  { prefix: 'NP', region: 'SP_D', label: 'SP Manweb (South Wales)' },
  { prefix: 'SY', region: 'SP_D', label: 'SP Manweb (Mid Wales)' },
]

function outcodeFromPostcode(compact: string): string {
  const inwardLen = 3
  if (compact.length <= inwardLen) return compact
  return compact.slice(0, compact.length - inwardLen)
}

export function resolveDnoFromPostcode(postcode: string): DnoSnapshot {
  const compact = postcode.replace(/\s+/g, '').trim().toUpperCase()
  if (compact.length < 4) {
    return { found: false, dnoRegion: 'UNKNOWN', label: 'Unknown DNO' }
  }
  const outcode = outcodeFromPostcode(compact)
  const sorted = [...OUTCODE_DNO].sort((a, b) => b.prefix.length - a.prefix.length)
  for (const row of sorted) {
    if (outcode.startsWith(row.prefix) || compact.startsWith(row.prefix)) {
      return { found: true, dnoRegion: row.region, label: row.label }
    }
  }
  return { found: false, dnoRegion: 'UNKNOWN', label: 'Unknown DNO' }
}

export async function fetchDnoByPostcode(postcode: string): Promise<DnoSnapshot> {
  return resolveDnoFromPostcode(postcode)
}
