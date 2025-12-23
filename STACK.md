# Technology Stack (STACK.md)

## Core Frameworks
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS (v4 or latest compatible)
- **Build Tool**: Turbopack

## AI & Backend
- **AI Framework**: Firebase Genkit (`@genkit-ai/*`)
- **Models**: Gemini 3.0 Pro / Flash
- **Database**: Firestore (via `firebase-admin` in DAL only) / Supabase (if migrating)
- **Auth**: Firebase Auth (Zero Trust)
  - Client: Firebase Client SDK
  - Server: `firebase-admin` (DAL only)

## Architecture Components
- **DAL (`src/lib/dal`)**: Centralized Data Access Layer.
- **Genkit Gateway**: `src/app/api/[[...genkit]]/route.ts`.
- **State Management**: SWR (via `useGenkit` hook).

## Infrastructure & DevOps
- **Containerization**: Docker (Next.js + Genkit + Firebase Emulator).
- **Monitoring**: 
  - Sentry (Frontend errors & Tracing).
  - Google Cloud Error Reporting (Backend JSON logs).

## Banned Libraries (THE KILL LIST)
- `next-auth`
- `@auth/*`
- `axios`
- `googleapis` (manual use)
- `pages/api/*`
