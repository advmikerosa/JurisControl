import { createClient } from '@supabase/supabase-js';

// Acesso seguro às variáveis de ambiente injetadas pelo Vite/Vercel
const env = import.meta.env || ({} as any);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Verifica se a configuração existe e é válida (não é vazia ou placeholder)
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  !supabaseUrl.includes('seu-projeto');

// Cria o cliente Supabase apenas se as credenciais existirem
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!isSupabaseConfigured) {
  console.info("JurisControl: Modo Demo/Offline ativo. Supabase não configurado.");
} else {
  console.info("JurisControl: Conectado ao Supabase.");
}
