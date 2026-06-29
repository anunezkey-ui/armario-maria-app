import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageBase64, imageType, prendas } = await req.json();
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

    const categorias = [...new Set(prendas.map((p: any) => p.categoria))].join(', ');
    const colores = [...new Set(prendas.map((p: any) => p.color))].join(', ');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageType, data: imageBase64 },
            },
            {
              type: 'text',
              text: `Analiza este outfit de referencia. Para cada prenda visible identifica:
- categoria (solo una de: chaqueta, top, pantalon, falda, vestido, zapatos, bolso, accesorio)
- color principal (en español, ej: negro, blanco, beige, azul, verde, rojo, camel, gris, marrón, rosa, multicolor)
- patron (solo: liso o estampado)

El armario disponible tiene categorías: ${categorias} y colores: ${colores}.

Responde SOLO con JSON válido, sin texto adicional, con este formato exacto:
{"prendas": [{"categoria": "top", "color": "blanco", "patron": "liso"}, ...]}`,
            },
          ],
        }],
      }),
    });

    const result = await response.json();
    const text = result.content[0].text;
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
