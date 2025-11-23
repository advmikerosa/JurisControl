import { createClient } from '@supabase/supabase-js';

// Garante acesso seguro às variáveis de ambiente
const env = (import.meta && import.meta.env) ? import.meta.env : ({} as any);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Se as chaves não existirem, o cliente será null, forçando o fallback para LocalStorage
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!isSupabaseConfigured) {
  console.warn("JurisControl: Supabase não configurado. Rodando em modo Offline (LocalStorage).");
}
