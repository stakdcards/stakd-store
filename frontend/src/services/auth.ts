import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type { User, Session };

export type Profile = {
  id: string;
  role: 'user' | 'admin';
  name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export async function signIn(email: string, password: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error ?? null };
}

export async function signInWithMagicLink(email: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/account` },
  });
  return { error: error ?? null };
}

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/account` },
  });
  return { error: error ?? null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function isAdmin(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return false;
  return data.role === 'admin';
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

export async function updateProfile(updates: { name?: string; phone?: string }): Promise<{ error: Error | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return { error: new Error('Not authenticated') };
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', session.user.id);
  return { error: error ?? null };
}

export async function ensureProfile(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  // Insert a default profile row if one doesn't exist yet (for new OAuth/magic-link users)
  await supabase.from('profiles').upsert(
    { id: session.user.id, role: 'user' },
    { onConflict: 'id', ignoreDuplicates: true }
  );
}
