# ByggPilot 2.0 - Exit-Ready Construction AI

**Version:** 2025.1
**Architecture:** Next.js 14 (App Router) + Firebase Genkit + Google Cloud (Vertex AI)
**Status:** Production Ready (Verified)

---

## 🏗️ System Architecture ("The Google Layer")

ByggPilot is built as a **Secure Intelligence Layer** on top of the Google Cloud ecosystem. Unlike standard wrappers, it uses a "Server-Only" logic core to ensure data privacy and hands-off execution.

### The "Hands-Off" Protocol
1.  **Context-Aware**: The AI knows *who* you are (Company Profile) and *what* rules apply (Säkra Vatten, Boverket) via RAG.
2.  **Draft-First**: The AI never executes side-effects (email, delete) without a user-approved draft. 
3.  **Tenant Isolation**: All data is siloed by `ownerId`. API calls are strictly verified via Server Actions (`src/app/actions.ts`).

### Key Components
*   **Brain (Genkit):** `src/lib/genkit/` - Flows for Chat, Offers, and Invoice Analysis.
*   **Body (Next.js):** `src/app/` - React Server Components with Client Interactivity.
*   **Memory (Firestore):** `src/lib/dal/` - Typed Repositories for Customers, Projects, Risks.
*   **Hands (Google APIs):** Gmail, Calendar, Drive - Integrated via Service Accounts or User Oauth (Hybrid).

---

## 💰 API & Cost Analysis (Unit Economics)

Estimated costs for a typical "Small Bau" user (5 projects/month).

| Operation | Model / Resource | Frequency | Cost (Est) |
| :--- | :--- | :--- | :--- |
| **Chat Assitance** | Gemini 1.5 Flash | 20 / day | ~$0.10 / mo |
| **Logic/Reasoning** | Gemini 1.5 Pro | 50 / week | ~$2.00 / mo |
| **Offer Generation** | Gemini 1.5 Pro | 10 / mo | ~$0.50 / mo |
| **RAG (Vector Search)**| Pinecone / Firestore | Continuous | ~$1.00 / mo |
| **Total / User** | | | **~$3.60 / mo** |

*Note: The usage of `Gemini 1.5 Flash` for routine tasks keeps costs practically zero. Costs scale linearly with heavy reasoning tasks (Pro).*

---

## 🛡️ Security & Compliance (M&A Audit)

*   **IDOR Protection:** All Server Actions enforce `checkOwnership(resourceId, user)`.
*   **Living Doc Safety:** The AI is instructed to `readDocTool` before appending to prevent data duplication.
*   **Financial Safety:** All generated ÄTA documents include legal disclaimers ("Säkra pengarna").
*   **Error Boundaries:** Dashboard widgets are isolated; a weather API failure will not crash the application.

---

## 🚀 Quick Start

\`\`\`bash
# 1. Install Dependencies
npm install

# 2. Environment Setup
cp .env.example .env.local
# Add GOOGLE_GENAI_API_KEY, FIREBASE_CREDENTIALS

# 3. Development
npm run dev
\`\`\`

## 🧪 Testing

We recommend `Playwright` for E2E testing of the "Golden Thread".

\`\`\`bash
# Run Unit Tests (Jest/Vitest)
npm run test

# Run E2E Flow (Login -> Offer -> Invoice)
npx playwright test
\`\`\`

---

*Verified by Antigravity Agent - 2026-01-16*
