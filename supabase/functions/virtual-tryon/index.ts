import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AVATAR_URL = 'https://wngfxbycgyowevfmcqii.supabase.co/storage/v1/object/public/prendas/avatar/foto_avatar_maria.jpeg';
const AVATAR_INTIMO_URL = 'https://wngfxbycgyowevfmcqii.supabase.co/storage/v1/object/public/prendas/avatar/avatar_maria_generado.jpg';

const CATEGORY_MAP: Record<string, string> = {
  top: 'upper_body',
  chaqueta: 'upper_body',
  pantalon: 'lower_body',
  falda: 'lower_body',
  vestido: 'dresses',
  bano: 'upper_body',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = Deno.env.get('REPLICATE_API_TOKEN');
    if (!token) throw new Error('REPLICATE_API_TOKEN no configurado');

    const body = await req.json();

    // MODE: poll — check status of existing prediction
    if (body.predictionId) {
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${body.predictionId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const result = await pollRes.json();
      if (result.status === 'succeeded') {
        const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
        return new Response(JSON.stringify({ status: 'succeeded', tryonUrl: outputUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ status: result.status, error: result.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MODE: start — launch new prediction
    const { prendaUrl, categoria, descripcion, intimo } = body;
    if (!prendaUrl) throw new Error('prendaUrl requerida');

    const category = CATEGORY_MAP[categoria] || 'upper_body';
    const humanImg = intimo ? AVATAR_INTIMO_URL : AVATAR_URL;

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
        input: {
          human_img: humanImg,
          garm_img: prendaUrl,
          garment_des: descripcion || categoria,
          category,
          crop: true,
          steps: 30,
          seed: 42,
        },
      }),
    });

    const prediction = await startRes.json();
    if (!prediction.id) throw new Error('No prediction ID: ' + JSON.stringify(prediction));

    return new Response(JSON.stringify({ status: prediction.status, predictionId: prediction.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
