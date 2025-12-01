# IMPLEMENTACAO_FIXES - JurisControl

## Documento de Implementacao das Correcoes Criticas

Este documento contem TODAS as correcoes necessarias para o sistema funcionar 100% com Supabase.
Cada secao contem o arquivo a ser modificado com o codigo exato a ser usado.

---

## CRITICO #1: AuthContext.tsx - Adicionar Inicializacao de Sessao

**Arquivo:** `src/context/AuthContext.tsx`

**O que fazer:** Encontre o `export const AuthProvider` (linha ~32) e SUBSTITUA-O pelo codigo abaixo:

```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();
  const lastActivityUpdate = useRef<number>(Date.now());
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>();

  // FIX #1: Inicializar autenticacao ao carregar a app
  useEffect(() => {
    const initializeAuth = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          // Recuperar sessao existente
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('Erro ao obter sessao:', sessionError);
            setIsLoading(false);
            return;
          }
          
          if (session?.user) {
            setUser(session.user);
            setIsAuthenticated(true);
            lastActivityUpdate.current = Date.now();
          } else {
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Erro ao inicializar autenticacao:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
  }, []);

  // FIX #2: Listener para mudancas de autenticacao em tempo real
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          setIsAuthenticated(true);
          localStorage.setItem('@JurisControl:user', JSON.stringify(session.user));
          lastActivityUpdate.current = Date.now();
        } else {
          setUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('@JurisControl:user');
        }
      }
    );
    
    return () => subscription?.unsubscribe();
  }, []);

  // ... resto do codigo existente ...
};
```

---

## CRITICO #2: StorageService.tsx - Adicionar Filtro office_id

**Arquivo:** `src/services/storageService.ts`

**O que fazer:** ATUALIZE TODOS OS METODOS para incluir filtro de `office_id`. Exemplos:

### ANTES (INCORRETO):
```typescript
async getClients(): Promise<Client[]> {
  const { data } = await supabase
    .from('clients')
    .select('*');
  return data || [];
}
```

### DEPOIS (CORRETO):
```typescript
async getClients(officeId: string): Promise<Client[]> {
  if (!officeId) return [];
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('office_id', officeId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Erro ao buscar clientes:', error);
    return [];
  }
  
  return data || [];
}
```

**Aplicar este mesmo padrao para TODOS os metodos:**
- `getCases(officeId)` - adicionar `.eq('office_id', officeId)`
- `getFinancials(officeId)` - adicionar `.eq('office_id', officeId)`
- `getTasks(officeId)` - adicionar `.eq('office_id', officeId)`
- `getLeads(officeId)` - adicionar `.eq('office_id', officeId)`
- `getDocuments(officeId)` - adicionar `.eq('office_id', officeId)`

---

## CRITICO #3: Validacao Supabase Mais Robusta

**Arquivo:** `src/services/supabase.ts`

**SUBSTITUA TODO O ARQUIVO por:**

```typescript
import { createClient } from '@supabase/supabase-js';

const env = import.meta.env || ({} as any);
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

// FIX: Validacao robusta de URL Supabase
const isValidSupabaseUrl = (url: string): boolean => {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    // Validar que eh um dominio Supabase oficial
    return urlObj.hostname.endsWith('.supabase.co') && !url.includes('seu-projeto');
  } catch {
    return false;
  }
};

const isValidAnonKey = (key: string): boolean => {
  if (!key) return false;
  // Chaves anonimas do Supabase comecam com 'eyJ'
  return key.startsWith('eyJ') && key.length > 100;
};

export const isSupabaseConfigured =
  isValidSupabaseUrl(supabaseUrl) &&
  isValidAnonKey(supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    'JurisControl: Modo Demo/Offline ativo. Supabase nao configurado corretamente.',
    { urlValid: isValidSupabaseUrl(supabaseUrl), keyValid: isValidAnonKey(supabaseAnonKey) }
  );
} else {
  console.info('JurisControl: Conectado ao Supabase com sucesso.');
}
```

---

## ALTO #4: Error Handling Global em todas as Queries

**Arquivo:** `src/services/storageService.ts`

**ADICIONE este helper no INICIO do arquivo (apos imports):**

```typescript
// Error Handler auxiliar
const handleSupabaseError = (error: any, context: string): void => {
  if (error) {
    console.error(`Erro ao ${context}:`, error);
    console.error('Detalhes:', {
      message: error.message,
      code: error.code,
      status: error.status,
    });
  }
};
```

**Em TODOS os metodos, ADICIONE error handling:**

```typescript
async saveClient(client: Client): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('clients')
      .upsert([client], { onConflict: 'id' });
    
    if (error) {
      handleSupabaseError(error, 'salvar cliente');
      return false;
    }
    return true;
  } catch (e) {
    handleSupabaseError(e, 'salvar cliente (catch)');
    return false;
  }
}
```

---

## ALTO #5: Criar arquivo queryCache.ts para React Query

**Arquivo:** `src/services/queryCache.ts` (NOVO ARQUIVO)

**CRIAR com o conteudo:**

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados ficam "fresh" por 5 minutos
      staleTime: 5 * 60 * 1000,
      // Cache mantem dados por 10 minutos apos uso
      gcTime: 10 * 60 * 1000,
      // Retry automatico 2 vezes em caso de erro
      retry: 2,
      // Retry timeout cresce exponencialmente
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});
```

---

## ALTO #6: Atualizar App.tsx para incluir QueryClientProvider

**Arquivo:** `src/App.tsx`

**ADICIONE no INICIO do arquivo:**

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryCache';
```

**SUBSTITUA a estrutura de providers por:**

```typescript
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* ... rotas existentes ... */}
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

---

## REMOVER: Arquivo firebase.ts

**Arquivo:** `src/services/firebase.ts`

**ACAO:** DELETAR completamente este arquivo (ja descontinuado)

---

## ALTO #7: Implementar Real-time Subscriptions

**Arquivo:** `src/services/storageService.ts`

**ADICIONE este metodo na classe StorageService:**

```typescript
// Subscricoes em tempo real
private subscriptions: Map<string, () => void> = new Map();

async subscribeToClients(
  officeId: string,
  callback: (clients: Client[]) => void
): Promise<() => void> {
  if (!isSupabaseConfigured || !supabase) return () => {};
  
  const subscription = supabase
    .channel(`clients:${officeId}`)
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'clients',
        filter: `office_id=eq.${officeId}`,
      },
      async () => {
        // Recarregar dados quando houver mudancas
        const clients = await this.getClients(officeId);
        callback(clients);
      }
    )
    .subscribe();
  
  const unsubscribe = () => {
    supabase.removeChannel(subscription);
  };
  
  this.subscriptions.set(`clients:${officeId}`, unsubscribe);
  return unsubscribe;
}

// Cleanup ao desmontar componente
unsubscribeAll(): void {
  this.subscriptions.forEach(unsub => unsub());
  this.subscriptions.clear();
}
```

---

## INSTALACAO DE DEPENDENCIAS

**Execute no terminal:**

```bash
npm install @tanstack/react-query
```

---

## CHECKLIST DE IMPLEMENTACAO

- [ ] Atualizar `src/context/AuthContext.tsx` com inicializacao de sessao
- [ ] Atualizar `src/services/storageService.ts` com filtros office_id em TODOS os metodos
- [ ] Atualizar `src/services/supabase.ts` com validacao robusta
- [ ] Adicionar error handling em todos os metodos do StorageService
- [ ] Criar `src/services/queryCache.ts`
- [ ] Atualizar `src/App.tsx` com QueryClientProvider
- [ ] Deletar `src/services/firebase.ts`
- [ ] Implementar real-time subscriptions
- [ ] Instalar `@tanstack/react-query`
- [ ] Testar autenticacao no Supabase
- [ ] Testar RLS policies
- [ ] Deploy no Vercel

---

## PROXIMO PASSO

Apos implementar as mudancas acima:

1. Fazer commit: `git commit -m "fix: Implementar correcoes criticas de seguranca e performance"`
2. Push para GitHub: `git push`
3. Testar em https://seu-app.vercel.app
4. Verificar logs do Supabase para errors de RLS

**Qualquer duvida, consulte a secao de PROBLEMA vs SOLUCAO no relatorio completo.**
