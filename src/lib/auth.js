import { supabase } from './supabase';

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return;
  return supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function createProfile(user) {
  if (!supabase || !user) return;
  return supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    nome: user.user_metadata?.nome ?? user.user_metadata?.name ?? null,
  });
}
