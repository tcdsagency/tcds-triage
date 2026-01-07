# TCDS-Triage

AI-Native Insurance Operations Platform

## Version 21 - Customer Profile with Client Levels

### What's New in v21:
- **Complete Customer Profile Page** (`/customer/[id]`)
  - All policy types: Auto, Home, Commercial, Umbrella, Life, etc.
  - Full policy details: Vehicles, Drivers, Property, Coverages, Lienholders
  - **Client Level System**: A ⭐ / AA 🏆 / AAA 👑 badges
  - **OG Badge** 💎 for customers since before 2021
  - AI-powered overview with coverage gaps & cross-sell opportunities
  - Notes tab with AgencyZoom integration
  - Activity timeline
- **View Profile Button** on customers list page

### Client Level System:
| Level | Icon | Criteria |
|-------|------|----------|
| A | ⭐ | 1 policy AND <$5K premium |
| AA | 🏆 | 2 policies OR $5K+ premium |
| AAA | 👑 | 3+ policies OR $10K+ premium |
| OG | 💎 | Customer since before 2021 |

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

**Required:**
- `DATABASE_URL` - Your Supabase connection string (replace YOUR-PASSWORD)
- `NEXT_PUBLIC_SUPABASE_URL` - Already set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Already set (rotate this!)
- `SUPABASE_SERVICE_ROLE_KEY` - Already set (rotate this!)

### 3. Push Database Schema
```bash
npm run db:push
```

This creates all tables in your Supabase database.

### 4. Create First User
Go to Supabase Dashboard → Authentication → Users → Add User

### 5. Create Tenant and Link User
Run this SQL in Supabase SQL Editor:

```sql
-- Create your agency tenant
INSERT INTO tenants (name, slug, email, phone) 
VALUES ('Your Agency Name', 'your-agency', 'you@example.com', '555-123-4567')
RETURNING id;

-- Link your user to the tenant (use the returned tenant id and your auth user id)
INSERT INTO users (tenant_id, auth_id, email, first_name, last_name, role)
VALUES (
  'your-tenant-id-here',
  'your-auth-user-id-here',
  'you@example.com',
  'Your',
  'Name',
  'owner'
);
```

### 6. Run Development Server
```bash
npm run dev
```

Visit http://localhost:3000

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── dashboard/     # Main dashboard
│   │   ├── triage/        # Triage queue
│   │   ├── calls/         # Call management
│   │   ├── customers/     # Customer management
│   │   ├── quotes/        # Quote intake
│   │   ├── messages/      # SMS/Email
│   │   ├── properties/    # Property intelligence
│   │   ├── reports/       # Analytics
│   │   ├── training/      # Agent training
│   │   └── settings/      # Agency settings
│   ├── login/             # Auth pages
│   └── auth/              # Auth callbacks
├── components/
│   ├── layout/            # Sidebar, Header
│   ├── ui/                # Reusable UI components
│   └── features/          # Feature-specific components
├── db/
│   ├── schema.ts          # Drizzle schema (60+ tables)
│   └── index.ts           # Database client
├── lib/
│   ├── supabase/          # Supabase clients
│   └── utils/             # Utility functions
├── types/                 # TypeScript types
└── middleware.ts          # Auth middleware
```

## Database Commands

```bash
npm run db:generate  # Generate migrations from schema changes
npm run db:push      # Push schema to database (dev)
npm run db:studio    # Open Drizzle Studio
```

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL)
- **ORM:** Drizzle
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS
- **Icons:** Lucide React

## What's Included

✅ Multi-tenant database schema (60+ tables)
✅ Authentication with Supabase
✅ Protected dashboard layout
✅ Sidebar navigation
✅ Dashboard with stats & triage preview
✅ Triage queue with AI priority scoring
✅ Route stubs for all major features
✅ TypeScript types for all entities

## Next Steps

Build out features in this order:

1. **Customer Unified View** - Pull from AgencyZoom + HawkSoft
2. **Call Integration** - Twilio/3CX + Deepgram transcription
3. **Quote Intake Forms** - Personal auto, homeowners
4. **Property Intelligence** - Your Nearmap integration
5. **Training System** - Progressive skill tree

## Environment Variables

See `.env.local` for all required variables. Key integrations:

- **AgencyZoom** - CRM (read + write)
- **HawkSoft** - AMS (read only)
- **Twilio** - Voice & SMS
- **Deepgram** - Transcription
- **OpenAI** - AI summaries
- **Nearmap** - Property imagery

---

Built for TCDS Insurance by Claude 🤖
