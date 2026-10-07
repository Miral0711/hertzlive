import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USERS, User } from '../data';

// Mirrors packages/frontend/src/auth: demo accounts checked locally, shared password.
export const DEMO_PASSWORD = 'password';
const KEY = 'archos-auth-session';

export const DEMO_ACCOUNTS = [
  { personaId: 'u1', email: 'harshal.patel@hertzstudio.demo', label: 'Harshal Patel · Partner' },
  { personaId: 'u5', email: 'priya.shah@hertzstudio.demo', label: 'Priya Shah · Designer' },
  { personaId: 'u10', email: 'rohan.gandhi@hertzstudio.demo', label: 'Rohan Gandhi · Site manager' },
  { personaId: 'u12', email: 'bhavna.rao@hertzstudio.demo', label: 'Bhavna Rao · HR' },
  { personaId: 'c1', email: 'anjali.jagwani@hertzstudio.demo', label: 'Anjali Jagwani · Client' },
  { personaId: 'x1', email: 'om.civilworks@hertzstudio.demo', label: 'Om Civil Works · Contractor' },
];

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((id) => setUser(USERS.find((u) => u.id === id) || null))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const login = async (email: string, password: string) => {
    const account = DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
    const persona = account && USERS.find((u) => u.id === account.personaId);
    if (!persona || password !== DEMO_PASSWORD) throw new Error('Unable to sign in.');
    await AsyncStorage.setItem(KEY, persona.id).catch(() => {});
    setUser(persona);
  };
  const logout = async () => {
    await AsyncStorage.removeItem(KEY).catch(() => {});
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}
