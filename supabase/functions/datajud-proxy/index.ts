import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { JWT } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const TRIBUNAL_ENDPOINTS = {
  '1': 'https://www1.tjac.jus.br/ctosp',
  '2': 'https://ctosp.tjal.jus.br:8443/api/consulta',
  // ... adicionar mais tribunais conforme necessário
};

const MAX_REQUESTS_PER_DAY = 100;

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extrair o token do header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.substring(7);
    
    // Aqui você faria a verificação do token JWT
    // Por enquanto, vamos simular uma verificação bem-sucedida
    
    const body = await req.json();
    const { cnj, endpoint } = body;

    if (!cnj || !endpoint) {
      return new Response(
        JSON.stringify({ error: 'CNJ and endpoint are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Fazer a requisição para o endpoint do DataJud
    const tribunalUrl = TRIBUNAL_ENDPOINTS[endpoint];
    if (!tribunalUrl) {
      return new Response(
        JSON.stringify({ error: 'Invalid tribunal endpoint' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const response = await fetch(`${tribunalUrl}?numeroProcesso=${cnj}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'DataJudProxy/1.0',
      },
    });

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
