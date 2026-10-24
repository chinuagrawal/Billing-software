import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Command, Workspace } from '../types';
import { applyCommand, uid } from './billing';
import { demoWorkspace, emptyWorkspace } from './seed';
import { auth, db } from './firebase';

const KEY = 'agrawal-workspace-demo-v1';
function readLocal(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : demoWorkspace();
  } catch {
    return demoWorkspace();
  }
}
type Context = {
  data: Workspace;
  user: User | null;
  mode: 'demo' | 'cloud';
  loading: boolean;
  error: string;
  execute: (c: Command) => Promise<void>;
  useDemo: () => void;
  logout: () => Promise<void>;
  resetDemo: () => void;
};
const Store = createContext<Context | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const pendingRequests = useRef(new Map<string, string>());
  const [data, setData] = useState<Workspace>(readLocal),
    ref = useRef(data);
  const [user, setUser] = useState<User | null>(null),
    [mode, setMode] = useState<'demo' | 'cloud'>('demo'),
    [loading, setLoading] = useState(Boolean(auth)),
    [error, setError] = useState('');
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(auth, (u) => {
            setUser(u);
            setMode(u ? 'cloud' : 'demo');
            setLoading(Boolean(u));
            if (!u) {
              setError('');
              const d = readLocal();
              ref.current = d;
              setData(d);
            }
          })
        : undefined,
    [],
  );
  useEffect(() => {
    if (!user || mode !== 'cloud' || !db) return;
    const database = db,
      owner = user.uid,
      base = emptyWorkspace();
    ref.current = base;
    setData(base);
    setError('');
    setLoading(true);
    const ready = new Set<string>();
    const names = [
      'settings',
      'customers',
      'products',
      'purchases',
      'invoices',
      'payments',
      'audit',
      'counters',
    ] as const;
    const unsub = names.map((name) =>
      onSnapshot(
        collection(database, 'workspaces', owner, name),
        (snap) => {
          const next = { ...ref.current };
          if (name === 'settings')
            next.business =
              (snap.docs.find((d) => d.id === 'business')?.data() as Workspace['business']) ||
              base.business;
          else if (name === 'counters')
            next.counters = Object.fromEntries(snap.docs.map((d) => [d.id, d.data().value]));
          else {
            const rows = snap.docs.map((d) => d.data());
            Object.assign(next, { [name]: rows });
          }
          next.invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          next.payments.sort((a, b) => b.date.localeCompare(a.date));
          next.audit.sort((a, b) => b.at.localeCompare(a.at));
          ref.current = next;
          setData(next);
          ready.add(name);
          if (ready.size === names.length) setLoading(false);
        },
        (e) => {
          setError(e.message);
          setLoading(false);
        },
      ),
    );
    return () => unsub.forEach((f) => f());
  }, [user, mode]);
  useEffect(() => {
    if (mode !== 'demo') return;
    const handler = (e: StorageEvent) => {
      if (e.key === KEY) {
        const d = readLocal();
        ref.current = d;
        setData(d);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [mode]);
  async function execute(command: Command) {
    if (mode === 'demo') {
      const run = async () => {
        const next = applyCommand(readLocal(), command);
        localStorage.setItem(KEY, JSON.stringify(next));
        ref.current = next;
        setData(next);
      };
      if (navigator.locks) await navigator.locks.request('agrawal-demo-write', run);
      else await run();
      return;
    }
    if (!db || !user) throw new Error('Sign in to save changes.');
    if (loading || error)
      throw new Error(
        'Your cloud workspace is not ready. Resolve the connection error before saving.',
      );
    const fingerprint = JSON.stringify(command);
    const requestId = pendingRequests.current.get(fingerprint) || uid();
    pendingRequests.current.set(fingerprint, requestId);
    const token = await user.getIdToken();
    let response: Response;
    try {
      response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, command }),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error(
        'The change could not be confirmed. Retry with the same details; duplicate requests are protected.',
      );
    }
    const result = await response.json().catch(() => ({
      error: 'The cloud write service is unavailable. Check the server deployment.',
    }));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to save this change.');
    pendingRequests.current.delete(fingerprint);
  }
  const useDemo = () => {
    if (auth && user) void signOut(auth);
    setMode('demo');
    setError('');
    const d = readLocal();
    ref.current = d;
    setData(d);
  };
  const resetDemo = () => {
    const d = demoWorkspace();
    localStorage.setItem(KEY, JSON.stringify(d));
    ref.current = d;
    setData(d);
  };
  // A fresh cloud account is intentionally empty; demo invoices are never uploaded.
  return (
    <Store.Provider
      value={{
        data,
        user,
        mode,
        loading,
        error,
        execute,
        useDemo,
        logout: async () => {
          if (auth) await signOut(auth);
        },
        resetDemo,
      }}
    >
      {children}
    </Store.Provider>
  );
}
export function useStore() {
  const value = useContext(Store);
  if (!value) throw new Error('Store missing');
  return value;
}
