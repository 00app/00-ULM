# Zero Zero Setup Guide

## Prerequisites

### 1. Install Node.js and npm

**Option A: Using Homebrew (Recommended for macOS)**
```bash
brew install node
```

**Option B: Download from nodejs.org**
1. Visit https://nodejs.org/
2. Download the LTS version for macOS
3. Run the installer
4. Restart your terminal

**Option C: Using nvm (Node Version Manager)**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal, then:
nvm install --lts
nvm use --lts
```

### 2. Verify Installation
```bash
node --version  # Should show v18.x or higher
npm --version  # Should show 9.x or higher
```

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database

Create a `.env.local` file in the project root:
```bash
DATABASE_URL=postgresql://neondb_owner:npg_RO51JATEGYZz@ep-super-mountain-abpl2434-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### 3. Initialize Database Schema
```bash
npm run init-db
```

This will create all tables including:
- users
- journeys
- journey_answers
- cards
- likes
- analytics_events

### 4. Start Development Server
```bash
npm run dev
```

The app will be available at: http://localhost:3000

## Troubleshooting

### If npm install fails:
- Make sure Node.js is properly installed
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

### If database connection fails:
- Verify the DATABASE_URL in `.env.local`
- Check that the Neon database is accessible
- Run `npm run init-db` again to ensure tables exist

### If build fails:
- Check TypeScript errors: `npm run lint`
- Ensure all dependencies are installed: `npm install`

## Project Structure

- `/app` - Next.js App Router pages and API routes
- `/lib` - Shared utilities (database, analytics, journeys)
- `/components` - React components
- `/scripts` - Database initialization scripts

## Next Steps

1. Visit http://localhost:3000
2. Complete the intro sequence
3. Create your profile
4. Start your first journey
