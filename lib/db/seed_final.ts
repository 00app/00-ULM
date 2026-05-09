import { getDbPool } from '../db';

async function seedFinal() {
  const pool = getDbPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS research_results (
          id SERIAL PRIMARY KEY,
          postcode TEXT,
          profile_snapshot JSONB,
          markdown TEXT,
          citations JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Upsert or just Insert is fine since we want the latest to win if querying by created_at DESC
    await pool.query(`
      INSERT INTO research_results (postcode, markdown, citations)
      VALUES (
          'KW',
          '# Home Energy Scotland Grant and Loan\n\nFor KW postcodes in KW locality, the Home Energy Scotland rural uplift provides £9,000 towards a heat pump.\n\n# Octopus Outgoing\n\n12p Export Lock for Solar.\n\n# Ofgem April 2026\n\nThe April price cap unit rate is 24.67p for electricity and 5.74p for gas.',
          '[
              {
                  "source_name": "Home Energy Scotland",
                  "url": "https://www.homeenergyscotland.org/home-energy-scotland-grant-loan",
                  "title": "HES Rural Heat Pump Grant",
                  "value_gbp": 9000
              },
              {
                  "source_name": "Octopus Energy",
                  "url": "https://octopus.energy/smart/outgoing/",
                  "title": "Octopus 12p Export Guarantee",
                  "value_gbp": 150
              }
          ]'::jsonb
      );
    `);
    console.log('✅ Successfully seeded FINAL KW locality (KW) truth data into research_results.');
  } catch (error) {
    console.error('❌ Failed to seed KW locality data:', error);
  } finally {
    process.exit(0);
  }
}

seedFinal();
