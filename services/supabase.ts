import { createClient } from '@supabase/supabase-js';

// Safe access to environment variables to prevent crashes if import.meta.env is undefined
const env = import.meta.env || ({} as any);

// Vercel automaticamente injeta essas variáveis durante o build quando a integração com Supabase está ativa.
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Se as chaves existirem (injetadas pelo Vercel), cria o cliente.
// Caso contrário, o sistema usará o fallback para LocalStorage (modo offline/demo).
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!isSupabaseConfigured) {
  console.warn("JurisControl: Variáveis de ambiente do Supabase não detectadas. Verifique a integração no painel da Vercel.");
} else {
  console.info("JurisControl: Conectado ao Supabase via Vercel Integration.");
}