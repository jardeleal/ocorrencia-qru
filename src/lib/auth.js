import { supabase } from './supabase';

export const SIGNUP_CODE = 'monitor@07';
const AUTH_DOMAIN = 'ocorrencia-qru.local';

export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export function usernameToEmail(username) {
  return normalizeUsername(username) + '@' + AUTH_DOMAIN;
}

export async function signIn(username, password) {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
}

export async function signUp(username, password) {
  if (!supabase) throw new Error('Supabase não configurado.');
  const normalizedUsername = normalizeUsername(username);
  return supabase.auth.signUp({
    email: usernameToEmail(normalizedUsername),
    password,
    options: {
      data: { username: normalizedUsername },
    },
  });
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
    username: user.user_metadata?.username ?? null,
    nome: user.user_metadata?.nome ?? user.user_metadata?.name ?? null,
  });
}
