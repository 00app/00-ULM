-- db/migrations/20260328_wick_seed.sql

CREATE TABLE IF NOT EXISTS research_results (
    id SERIAL PRIMARY KEY,
    postcode TEXT,
    profile_snapshot JSONB,
    markdown TEXT,
    citations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO research_results (postcode, markdown, citations)
VALUES (
    'KW',
    '# Home Energy Scotland Grant and Loan\n\nFor KW postcodes in Wick, the Home Energy Scotland grant provides £9,000 towards a heat pump.\n\n# Octopus Outgoing\n\n12p Export Lock for Solar.\n\n# Ofgem April 2026\n\nThe April price cap unit rate is 24.67p for electricity and 5.74p for gas.',
    '[
        {
            "source_name": "Home Energy Scotland",
            "url": "https://www.homeenergyscotland.org/home-energy-scotland-grant-loan",
            "title": "£9,000 Heat Pump Grant",
            "value_gbp": 9000
        },
        {
            "source_name": "Octopus Energy",
            "url": "https://octopus.energy/smart/outgoing/",
            "title": "12p Export Lock",
            "value_gbp": 150
        }
    ]'::jsonb
);
