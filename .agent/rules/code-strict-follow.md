---
trigger: always_on
---

🤖 BYGGPILOT AI MASTER INSTRUCTIONS (v2025.12 - Genkit Gold Standard)
VIKTIGT: Du är en Senior Architect. Du gissar inte. Du blandar inte ihop bibliotek. Du följer strikt "Server-Only"-arkitekturen.

0. META-REGLER (LÄS INNAN DU KODAR)
Ingen "Legacy" kod: Du får ALDRIG använda pages/api, useEffect för data-fetch, eller manuella fetch()-anrop. Vi använder Server Actions. Du skriver ALDRIG över hela kodfiler. du skriver enbart över / ändrar de kodblock som är relevant, inget annat! Här är du extremt försiktig.

Ingen Biblioteks-förvirring:

Du använder Genkit Framework (genkit, @genkit-ai/*).

Du får ALDRIG försöka importera råa SDK-metoder som getGenerativeModel eller GoogleGenerativeAI från Genkit-paket. De existerar inte där.

Kontrollera Kontext: Kör alltid ls -R innan du skapar filer. Skapa inga dubbletter.

1. ARKITEKTUR: "THE GREAT DIVIDE" (NON-NEGOTIABLE)
Vi har en hård gräns mellan Klient och Server. Att bryta denna gräns kraschar bygget (Module not found: fs).

🔴 Server-Zone (Back-end)
Plats: src/lib/genkit/, src/genkit/

Regel: Alla filer MÅSTE börja med import 'server-only';.

Innehåll:

genkit.ts (Instansiering)

flows.ts (Flödesdefinitioner)

dal.ts (Databaslogik/Firestore)

Säkerhet: Här bor din firebase-admin och dina API-nycklar.

🟢 Client-Zone (Front-end)
Plats: src/app/, src/components/

Regel: Får ALDRIG importera från Server-Zone direkt.

Innehåll: React-komponenter ('use client').

🌉 The Bridge (Server Actions)
Plats: src/app/actions.ts (eller actions mapp)

Regel: Filen MÅSTE börja med 'use server';.

Syfte: Enda tillåtna importören av Server-Zone kod som exponeras till Klienten.

2. KORREKT GENKIT IMPLEMENTATION
A. Instansiering (src/lib/genkit.ts)
Vi använder den moderna genkit-funktionen, inte den gamla configureGenkit.

TypeScript

import 'server-only';
import { genkit } from 'genkit';
import { googleAI, gemini3Flash } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

enableFirebaseTelemetry(); // Måste köras först

export const ai = genkit({
  plugins: [googleAI()],
  model: gemini3Flash, // Sätt default-modell här
});
B. Flöden & Auth (src/genkit/flows/myFlow.ts)
Vi importerar auth-hjälpare från rätt sub-path.

TypeScript

import 'server-only';
import { ai } from '@/lib/genkit';
import { z } from 'genkit';
// VIKTIGT: Auth importeras från /auth sub-path, inte roten!
import { firebaseAuth } from '@genkit-ai/firebase/auth';

export const myFlow = ai.defineFlow({
  name: 'myFlow',
  inputSchema: z.object({ text: z.string() }),
  // Auth Policy validerar token
  authPolicy: firebaseAuth((user) => {
    if (!user.email_verified) throw new Error("Verifierad e-post krävs");
  }),
}, async (input) => {
  // Använd ai.generate, ALDRIG getGenerativeModel
  const { text } = await ai.generate({ prompt: input.text });
  return text;
});
C. Bryggan (src/app/actions.ts)
Här kopplar vi ihop allt. Vi måste manuellt hantera Context eftersom Server Actions inte gör det automatiskt.

TypeScript

'use server';

import { myFlow } from '@/genkit/flows/myFlow';
import { cookies } from 'next/headers';
// Anta att du har en helper för att verifiera session-cookies
import { verifySession } from '@/lib/auth'; 

export async function runMyAction(input: string) {
  // 1. Hämta Auth Context manuellt
  const session = await verifySession(cookies().get('session')?.value);
  const context = { auth: session };

  // 2. Kör flödet med kontext
  try {
    const result = await myFlow({ text: input }, { context });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
3. CHECKLISTA FÖR AGENTEN (GÖR ALLTID DETTA)
Import-Check: Importerar jag firebaseAuth från @genkit-ai/firebase? -> FEL. Byt till @genkit-ai/firebase/auth.

Modell-Check: Försöker jag använda getGenerativeModel? -> FEL. Använd ai.generate().

Fil-Check: Har jag lagt backend-logik i en fil utan import 'server-only'? -> FEL. Lägg till det direkt.

Action-Check: Anropar jag ett Flow direkt från en page.tsx? -> FEL. Skapa en Server Action emellan.

4. UTVECKLINGSLÄGE
För att slippa auth-problem under dev:

 .env.local finns i roten med FUNGERANDE nycklar i med bland annan NEXT_PUBLIC_DISABLE_AUTH=true.

I din authPolicy, lägg till:

TypeScript

if (process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true') return;
## 3. TEKNISK STACK
- Node.js v20+
- Next.js 16 (App Router)
- Firebase Genkit (@genkit-ai/google-genai) gemini 3 flash och 3 pro.
