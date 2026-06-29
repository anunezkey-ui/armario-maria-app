import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { imageBase64, imageType } = await req.json();
    const token = Deno.env.get('REPLICATE_API_TOKEN');

    const dataUrl = `data:${imageType};base64,${imageBase64}`;

    // Start prediction with BRIA background removal
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'a029dff38972b5fda4ec5d75d7d1cd25aeff621d4320d9aab01a6c32b18c2960',
        input: { image: dataUrl },
      }),
    });

    const prediction = await startRes.json();
    if (!prediction.id) throw new Error('No prediction ID: ' + JSON.stringify(prediction));

    // Poll until done (max 60s)
    let result = prediction;
    for (let i = 0; i < 30; i++) {
      if (result.status === 'succeeded') break;
      if (result.status === 'failed') throw new Error('Replicate failed: ' + result.error);
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Token ${token}` },
      });
      result = await pollRes.json();
    }

    if (result.status !== 'succeeded') throw new Error('Timeout waiting for result');

    return new Response(JSON.stringify({ outputUrl: result.output }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
