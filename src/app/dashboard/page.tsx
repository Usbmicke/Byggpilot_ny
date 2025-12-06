'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useGenkit } from '@/hooks/useGenkit';
import { auth } from '@/lib/firebase/client';

// --- Laddningskomponent ---
const FullPageLoader = ({ text }: { text: string }) => (
  <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
    <div className="flex items-center space-x-3">
      <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span className="text-lg">{text}</span>
    </div>
  </div>
);

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const { result: profile, isLoading: isProfileLoading } = useGenkit(
    'userProfileFlow'
  );

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/');
    }
  }, [user, isAuthLoading, router]);

  const handleSignOut = async () => {
    await auth.signOut();
  };

  if (isAuthLoading || isProfileLoading || !user) {
    return <FullPageLoader text="Laddar dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card shadow-md">
        <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold text-foreground">
            {profile?.companyName ? `Välkommen, ${profile.companyName}` : 'Dashboard'}
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
          >
            Logga ut
          </button>
        </nav>
      </header>

      <main className="container mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold mb-8">Översikt</h1>
        <div className="bg-card p-8 rounded-xl shadow-lg">
          <p className="text-muted-foreground">
            Här kommer din anpassade dashboard att visas. Vi har nu framgångsrikt kopplat ihop allting med den nya Guldstandarden!
          </p>
          <div className="mt-6 p-4 bg-background rounded-lg">
            <h3 className="font-semibold text-lg text-green-400">Checklista för Temabyte:</h3>
            <ul className="list-disc list-inside mt-2 text-foreground">
              <li><span className="text-green-500">✓</span> Definierat ny färgpalett i <code>tailwind.config.ts</code></li>
              <li><span className="text-green-500">✓</span> Applicerat globala stilar i <code>globals.css</code></li>
              <li><span className="text-green-500">✓</span> Uppdaterat <code>/</code> (Landningssida) med nytt tema</li>
              <li><span className="text-green-500">✓</span> Uppdaterat <code>/onboarding</code> med nytt tema</li>
              <li><span className="text-green-500">✓</span> Uppdaterat <code>/dashboard</code> med nytt tema</li>
              <li><span className="text-yellow-400">-</span> **Återstår:** Byt ut <code>public/logo.png</code> mot en version med transparent bakgrund.</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
