# ByggPilot 2.0 🚀

ByggPilot är nästa generations affärssystem för byggbranschen, drivet av AI (Genkit + Gemini).

## 🌟 Funktioner

- **AI Co-Pilot**: En intelligent assistent (`gemini-2.5-flash`) som hjälper dig att skapa projekt, räkna på offerter och svara på frågor.
- **Offer-motor**: Automatiska kalkyleringar med riskbedömning och dokumentgenerering.
- **KMA-automatisering**: Vision AI (`analyzeReceipt`) för kvitton och automatisk riskanalys (AMP) vid projektstart.
- **Dashboard**: Modern översikt med widgets och snabbkommandon (Cmd+K).

## 🛠️ Teknisk Stack

- **Framework**: Next.js 16 (App Router)
- **AI**: Google Genkit + Gemini 2.5 Flash / 3.0 Pro
- **Backend/DB**: Firebase (Firestore, Auth, Functions)
- **Språk**: TypeScript (Strict Mode)
- **Test**: Playwright

## 🚀 Kom igång

1. **Installera beroenden**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Starta utvecklingsmiljön (Next.js + Genkit + Firebase Emulator)**
   ```bash
   npm run dev:all
   ```

3. **Kör tester**
   ```bash
   npm run test:e2e
   ```

## 📁 Projektstruktur

- `/src/lib/genkit`: AI-flöden och verktyg.
- `/src/lib/dal`: Data Access Layer (Server-only).
- `/src/app/(protected)`: Inloggad del av appen.
- `/docs`: Projektplanering och arkitektur (t.ex. `viktigt.md`).

---
*Byggt med ❤️ och ☕ för ByggPilot.*
