-- Zero Zero — Starter Card Content (All 9 Journeys)
-- Factual, neutral content. No marketing language. No promises.

-- Clear existing seed data (optional, for clean resets)
-- TRUNCATE cards CASCADE;

-- HOME / ENERGY
INSERT INTO cards (id, journey_key, type, title, description, impact_band, effort_band)
VALUES
('home-smart-meter', 'home', 'balance', 'switch to a smart meter.', 'Smart meters show how much energy your home uses in real time. Seeing usage patterns can help reduce wasted electricity and gas.', 'high', 'low'),

-- TRAVEL
('travel-drive-less', 'travel', 'greenest', 'reduce short car journeys.', 'Short car trips are often the most carbon-intensive per mile. Walking, cycling, or public transport can significantly cut emissions.', 'high', 'low'),

-- FOOD
('food-eat-less-beef', 'food', 'greenest', 'eat less beef.', 'Beef production has one of the highest carbon footprints of any food. Reducing beef consumption can significantly lower diet-related emissions.', 'high', 'medium'),

-- SHOPPING
('shopping-buy-second-hand', 'shopping', 'balance', 'choose second-hand first.', 'Buying second-hand extends the life of products and reduces waste. This can save money and reduce the environmental impact of manufacturing.', 'medium', 'low'),

-- MONEY
('money-review-bills', 'money', 'cheapest', 'review your regular bills.', 'Regular bills can often be reduced by switching providers or reviewing usage. Small savings across multiple bills can add up significantly.', 'medium', 'low'),

-- CARBON
('carbon-understand-footprint', 'carbon', 'tip', 'understand your carbon footprint.', 'Knowing where your emissions come from helps you make informed choices. Small changes in high-impact areas can make a real difference.', 'low', 'low'),

-- TECH
('tech-extend-device-life', 'tech', 'greenest', 'extend your device life.', 'Electronic devices have a high environmental cost to manufacture. Keeping devices longer and repairing instead of replacing reduces impact.', 'medium', 'medium'),

-- WASTE
('waste-reduce-food-waste', 'waste', 'balance', 'reduce food waste.', 'Food waste contributes significantly to carbon emissions. Planning meals and using leftovers can save money and reduce waste.', 'high', 'low'),

-- HOLIDAYS
('holidays-choose-closer-destinations', 'holidays', 'greenest', 'choose closer destinations.', 'Travel emissions increase dramatically with distance. Exploring local and regional destinations can be both affordable and lower impact.', 'high', 'medium')

ON CONFLICT (id) DO UPDATE SET
  journey_key = EXCLUDED.journey_key,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  impact_band = EXCLUDED.impact_band,
  effort_band = EXCLUDED.effort_band,
  updated_at = NOW();

-- Test users (for multi-user testing)
INSERT INTO users (id, email, name, created_at)
VALUES
('user_demo_1', 'test1@zerozero.app', 'Test User 1', NOW()),
('user_demo_2', 'test2@zerozero.app', 'Test User 2', NOW())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name;
