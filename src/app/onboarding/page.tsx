
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp, db } from '@/lib/firebase/client';
import { doc, getDoc, setDoc } from 'firebase/firestore';
// import { runOnboardingAction } from '@/app/actions'; // Deprecated/Unused for now

// --- Ikoner (oförändrade) ---
const BuildingOfficeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 mr-2 text-muted-foreground"><path fillRule="evenodd" d="M4.5 2.25a.75.75 0 0 0-.75.75v12.75a.75.75 0 0 0 .75.75h.75v-2.25a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V18h.75a.75.75 0 0 0 .75-.75V3a.75.75 0 0 0-.75-.75h-6ZM9.75 18a.75.75 0 0 0 .75.75h.008a.75.75 0 0 0 .742-.75v-2.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 0 .75.75h.75a.75.75 0 0 0 .75-.75V9.313a2.25 2.25 0 0 0-1.23-2.043l-4.5-2.25a2.25 2.25 0 0 0-2.04 0l-4.5 2.25A2.25 2.25 0 0 0 6 9.313V18a.75.75 0 0 0 .75.75h3Z" clipRule="evenodd" /></svg>);
const ArrowUpTrayIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>);

const FullPageLoader = ({ text }: { text: string }) => (
  <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
    <span className="text-lg">{text}</span>
  </div>
);

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // State för att hantera laddning och fel från Server Actions
  const [isProfileLoading, setProfileLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.push('/');
      return;
    }

    async function fetchProfile() {
      setProfileLoading(true);
      try {
        const userRef = doc(db, 'users', user!.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.onboardingCompleted) {
            router.push('/dashboard');
          }
        }
      } catch (e) {
        console.error("Kunde inte hämta profil:", e);
        setError('Kunde inte ladda din profil.');
      } finally {
        setProfileLoading(false);
      }
    }

    fetchProfile();
  }, [user, isAuthLoading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
  };

  const uploadLogo = async (file: File, userId: string): Promise<string> => {
    const storage = getStorage(firebaseApp);
    const filePath = `logos/${userId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !companyName) return;

    setSubmitting(true);
    setError(null);

    try {
      let logoUrl: string | undefined = undefined;
      if (logoFile) {
        logoUrl = await uploadLogo(logoFile, user.uid);
      }

      // 1. Update User to set onboardingCompleted = true
      // We assume the user doc already exists from Login page.
      const userRef = doc(db, 'users', user.uid);

      // Get current user data to find companyId
      // In a real optimized app, we might store companyId in context or fetch it earlier.
      // But we can just use the userRef to update.
      // Wait, we need to update the Company document too!
      // We need to know the companyId.

      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("Användare hittades inte.");

      const userData = userSnap.data();
      const companyId = userData.companyId;

      if (!companyId) throw new Error("Ingen företags-ID kopplat till användaren.");

      // 2. Update Company Document
      const companyRef = doc(db, 'companies', companyId);
      await setDoc(companyRef, {
        name: companyName,
        logoUrl: logoUrl || null,
        updatedAt: new Date()
      }, { merge: true });

      // 3. Mark Onboarding as Completed on User Document
      await setDoc(userRef, {
        onboardingCompleted: true,
        updatedAt: new Date()
      }, { merge: true });

      // Navigate to dashboard
      router.push('/dashboard');

    } catch (err: any) {
      console.error("Onboarding misslyckades:", err);
      setError(err.message || 'Kunde inte slutföra registreringen.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthLoading || isProfileLoading) {
    return <FullPageLoader text="Laddar användardata..." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-8 border border-border relative z-10 backdrop-blur-sm">
        <h1 className="text-3xl font-bold text-center mb-2 text-foreground tracking-tight">Välkommen till Byggpilot</h1>
        <p className="text-muted-foreground text-center mb-8">Ett sista steg. Berätta om ditt företag.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {user?.email && (
            <div className="text-center text-sm text-green-400 bg-green-900/20 border border-green-900/50 p-2 rounded-md flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Inloggad som {user.email}
            </div>
          )}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-muted-foreground mb-2">Företagsnamn</label>
            <div className="flex items-center bg-[#383A40] rounded-lg border border-border focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
              <div className="pl-3 text-muted-foreground">
                <BuildingOfficeIcon />
              </div>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ditt Företag AB"
                className="w-full bg-transparent p-3 text-foreground placeholder-muted-foreground focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="logoUpload" className="block text-sm font-medium text-muted-foreground mb-2">Företagslogotyp (valfritt)</label>
            <div className="mt-2 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed border-border rounded-lg hover:bg-white/5 transition-colors cursor-pointer group">
              <div className="space-y-1 text-center w-full">
                <div className="mx-auto text-muted-foreground group-hover:text-primary transition-colors w-12 h-12 flex items-center justify-center">
                  <ArrowUpTrayIcon />
                </div>
                <div className="flex text-sm text-muted-foreground justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary-hover focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                    <span>Ladda upp en fil</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                  </label>
                  <p className="pl-1">eller dra och släpp</p>
                </div>
                <p className="text-xs text-muted-foreground/60">{logoFile ? logoFile.name : 'PNG, JPG upp till 5MB'}</p>
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded border border-red-900/50">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting || !companyName}
            className="w-full bg-primary hover:bg-primary-hover disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Skapar arbetsyta...
              </span>
            ) : 'Slutför & Skapa Mappar'}
          </button>
        </form>
      </div>
    </div>
  );
}
