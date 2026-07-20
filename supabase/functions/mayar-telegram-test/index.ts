import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming Telegram Test Request: ${req.method}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Only POST requests allowed.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (e) {
    // Ignore if empty
  }

  let botToken = body.bot_token;
  let chatId = body.chat_id;
  const customMessage = body.message || `🚀 *TEST NOTIFIKASI MAYAR.ID*\n\nSelamat! Koneksi Telegram Bot dengan panel ArLABS-System berhasil diuji pada:\n_${new Date().toLocaleString('id-ID')}_`;

  // If token or chat_id missing, try reading from database
  if (!botToken || !chatId) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: cfg } = await supabase.from('mayar_integrations_config').select('telegram_bot_token, telegram_chat_id').eq('id', 1).maybeSingle();
      if (cfg) {
        if (!botToken) botToken = cfg.telegram_bot_token;
        if (!chatId) chatId = cfg.telegram_chat_id;
      }
    }
  }

  if (!botToken || !chatId) {
    return new Response(
      JSON.stringify({ success: false, message: 'Telegram Bot Token dan Chat ID wajib diisi.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: customMessage,
        parse_mode: 'Markdown'
      })
    });

    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData.ok) {
      console.error(`[${timestamp}] Telegram API Error:`, tgData);
      return new Response(
        JSON.stringify({ success: false, message: tgData.description || 'Gagal mengirim pesan dari server Telegram API.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Pesan uji coba berhasil dikirim ke Telegram.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error(`[${timestamp}] Exception sending Telegram test:`, error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Server error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
