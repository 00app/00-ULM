# Zero Zero

A mobile-first web app that helps people understand and reduce their everyday impact on money, energy, carbon, and home life.

## Getting Started

### Prerequisites

- Node.js 18+
- Neon Postgres database (connection string provided)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
   - The database connection string is hardcoded in `lib/db.ts` for now
   - For production, use environment variables: `DATABASE_URL`

3. Initialize the database schema:
```bash
npm run init-db
```

4. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### API Endpoints

- `GET /api/health` - Database connectivity check
- `POST /api/user` - Create/update user profile
- `POST /api/answers` - Save journey answer
- `POST /api/journey` - Update journey state
- `GET /api/cards` - Get card definitions
- `POST /api/likes` - Toggle like on a card
- `GET /api/likes` - Get user's liked cards
- `GET /api/space` - Get Space items (always returns exactly 6 items)

## Design System

The design system is implemented in `app/globals.css` and `tailwind.config.ts`.

### Colors
- ICE (#FDFDFF): surfaces
- BLUE (#000AFF): decisions & emphasis
- DEEP (#141268): information

### Typography
- Roboto Black (900): H1, H2, labels, answers
- Roboto Regular (400): body copy

### Components
All component classes are prefixed with `zero-` and follow the locked design system specifications.
