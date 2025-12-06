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

      if (user) {
        // Refresh token proactively if needed, or just rely on getIdToken
        // Note: onIdTokenChanged triggers on token refresh too
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
