
# Configuração de Notificações por E-mail (Real)

O sistema frontend agora está preparado para enviar e-mails reais. Para que funcione, você precisa configurar uma **Supabase Edge Function**.

## 1. Obter Chave do Resend
1. Crie uma conta em [Resend.com](https://resend.com).
2. Gere uma **API Key**.
3. Verifique um domínio (ou use o de teste `onboarding@resend.dev` para enviar apenas para seu próprio e-mail).

## 2. Configurar o Supabase
1. Instale a CLI do Supabase se ainda não tiver: `npm install -g supabase`
2. Faça login: `supabase login`
3. Inicialize o projeto (se necessário): `supabase init`

## 3. Criar a Função
Crie um arquivo `supabase/functions/send-email/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html } = await req.json()

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'JurisControl <nao-responda@seu-dominio.com>', // Ou onboarding@resend.dev
        to: [to],
        subject: subject,
        html: html,
      }),
    })

    const data = await res.json()

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
```

## 4. Deploy e Variáveis
1. Defina a variável no Supabase:
   ```bash
   supabase secrets set RESEND_API_KEY=sua_chave_aqui
   ```
2. Faça o deploy:
   ```bash
   supabase functions deploy send-email --no-verify-jwt
   ```
   *(Nota: `--no-verify-jwt` permite chamar a função sem token de usuário se necessário, mas o código do frontend envia o token atual).*

Agora o sistema irá disparar e-mails reais!
