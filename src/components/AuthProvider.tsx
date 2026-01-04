'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  getToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser: User | null) => {
      setUser(currentUser);
      setIsLoading(false);

      if (currentUser) {
        // Sync Session with Server
        try {
          const idToken = await currentUser.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
        } catch (e) {
          console.error("Failed to sync session", e);
        }
      } else {
        // Optional: Call logout endpoint to clear cookie
        // For now, simpler to just let it expire or rely on new login overriding it
      }
    });

    return () => unsubscribe();
  }, []);

  const getToken = async () => {
    if (!user) return null;
    return await user.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}
