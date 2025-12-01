
import { createClient } from '@supabase/supabase-js';

// Acesso seguro às variáveis de ambiente
const env = import.meta.env || ({} as any);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// Verifica se a configuração existe e é válida
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
  !supabaseUrl.includes('seu-projeto') &&
  !supabaseUrl.includes('placeholder');

// Cria o cliente Supabase apenas se as credenciais existirem
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!isSupabaseConfigured) {
  console.warn("JurisControl: Supabase não configurado. O aplicativo rodará em Modo Demo/Offline usando LocalStorage.");
} else {
  console.info("JurisControl: Conectado ao Supabase.");
}