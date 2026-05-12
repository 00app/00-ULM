# User context (ZeroResearch)

Before each research task, load the latest user context so recommendations match their situation.

## Template (populate from profile + journey answers)

- **postcode:** (e.g. SW1A 1AA)
- **home_type:** FLAT | HOUSE
- **household:** ALONE | COUPLE | FAMILY
- **transport_baseline:** CAR | PUBLIC | MIX | WALK | BIKE
- **heating:** GAS | ELECTRIC | WOOD | MIXED | SOLAR | UNKNOWN
- **tenure:** OWNER | RENTER (if known — renters may not be eligible for BUS heat pump grant)

## Rules

- Do not suggest Boiler Upgrade Scheme (heat pump) to users in rented FLATs unless the grant explicitly covers tenants.
- Round savings to the nearest pound; use 2026 grid intensity (0.129 kg/kWh) unless Pulse returns a live value.
