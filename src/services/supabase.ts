
import { createClient } from '@supabase/supabase-js';

// Acesso seguro às variáveis de ambiente
const env = import.meta.env || ({} as any);

// Credenciais fornecidas (Fallback prioritário se ENV não estiver definido)
const PROVIDED_URL = "https://uwqhqmtwnonbchcijcvs.supabase.co";
const PROVIDED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cWhxbXR3bm9uYmNoY2lqY3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1OTg2NzAsImV4cCI6MjA4MDE3NDY3MH0.wnONZlZIKHds9sDe5o_hhX2kvynRRwb6jLX5fA54W6A";

const supabaseUrl = env.VITE_SUPABASE_URL || PROVIDED_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || PROVIDED_KEY;

// Verifica se a configuração existe e é válida
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseAnonKey && 
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
