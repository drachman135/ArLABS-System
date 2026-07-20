import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Incoming Mayar Webhook: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are allowed.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(`[${timestamp}] Configuration error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.`);
    return new Response(
      JSON.stringify({ success: false, message: 'Server configuration error.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    console.error(`[${timestamp}] Failed to parse JSON body:`, e);
    return new Response(
      JSON.stringify({ success: false, code: 'INVALID_JSON', message: 'Invalid JSON payload.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[${timestamp}] Mayar Webhook Payload:`, JSON.stringify(body));

  const eventType = body.event || body.event_type || body.type || 'unknown.event';
  const eventId = body.id || body.event_id || `evt_${Date.now()}`;

  // 1. Log Raw Webhook Event into Database
  let logId: string | null = null;
  try {
    const { data: logEntry, error: logErr } = await supabase
      .from('mayar_webhook_events')
      .insert({
        event_id: String(eventId),
        event_type: String(eventType),
        payload: body,
        status: 'received'
      })
      .select('id')
      .single();

    if (logErr) {
      console.warn(`[${timestamp}] Failed to log raw webhook event:`, logErr.message);
    } else if (logEntry) {
      logId = logEntry.id;
    }
  } catch (err) {
    console.warn(`[${timestamp}] Exception logging raw webhook event:`, err);
  }

  try {
    // 2. Fetch Mayar Integrations Configuration
    const { data: config } = await supabase
      .from('mayar_integrations_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    // 3. Extract transaction info from payload
    // Mayar payloads generally contain `data` or fields directly
    const txData = body.data || body.transaction || body;
    const transactionId = String(txData.id || txData.transaction_id || txData.order_id || `TX_${Date.now()}`);
    const referenceId = txData.reference_id || txData.ref_id || txData.invoice_id || null;
    const customerName = txData.customer_name || txData.name || (txData.customer ? txData.customer.name : 'Unknown Customer');
    const customerEmail = txData.customer_email || txData.email || (txData.customer ? txData.customer.email : 'noemail@mayar.id');
    const customerPhone = txData.customer_phone || txData.phone || (txData.customer ? txData.customer.phone : null);
    const amount = Number(txData.amount || txData.total || 0);
    const currency = txData.currency || 'IDR';
    
    let paymentStatus = 'PENDING';
    if (
      eventType.includes('success') || 
      eventType.includes('paid') || 
      txData.status === 'PAID' || 
      txData.status === 'SUCCESS' ||
      txData.payment_status === 'SUCCESS'
    ) {
      paymentStatus = 'SUCCESS';
    } else if (eventType.includes('fail') || txData.status === 'FAILED') {
      paymentStatus = 'FAILED';
    }

    const paymentMethod = txData.payment_method || txData.channel || 'MAYAR_GATEWAY';
    const paidAt = paymentStatus === 'SUCCESS' ? new Date().toISOString() : null;

    // 4. Save/Upsert Transaction to Database
    const { error: txErr } = await supabase
      .from('mayar_transactions')
      .upsert({
        transaction_id: transactionId,
        reference_id: referenceId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        amount: amount,
        currency: currency,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        paid_at: paidAt
      }, { onConflict: 'transaction_id' });

    if (txErr) {
      console.error(`[${timestamp}] Error upserting transaction:`, txErr.message);
    }

    // 5. If Payment is SUCCESS, trigger system notifications & Telegram alert!
    if (paymentStatus === 'SUCCESS') {
      const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
      const notifTitle = `💰 Pembayaran Sukses Mayar`;
      const notifBody = `Pembayaran dari ${customerName} (${customerEmail}) sebesar ${formattedAmount} telah berhasil diverifikasi.`;

      // Insert into public.notifications for live floating toast
      await supabase.from('notifications').insert({
        title: notifTitle,
        body: notifBody,
        type: 'activation',
        created_at: new Date().toISOString()
      }).catch(e => console.warn('Failed insert toast notification:', e));

      // Insert into public.logs
      await supabase.from('logs').insert({
        action: 'MAYAR_PAYMENT_SUCCESS',
        description: `Pembayaran masuk dari ${customerName} - ${formattedAmount} (TxID: ${transactionId})`,
        severity: 'info',
        created_at: new Date().toISOString()
      }).catch(e => console.warn('Failed insert activity log:', e));

      // Send Telegram Notification if configured
      if (config && config.telegram_enabled && config.telegram_bot_token && config.telegram_chat_id) {
        try {
          const telegramMsg = `🎉 *PEMBAYARAN SUKSES (MAYAR.ID)* 🎉\n\n` +
            `👤 *Pelanggan:* ${customerName}\n` +
            `📧 *Email:* ${customerEmail}\n` +
            `💵 *Nominal:* ${formattedAmount}\n` +
            `💳 *Metode:* ${paymentMethod}\n` +
            `🆔 *TxID:* \`${transactionId}\`\n\n` +
            `_Waktu: ${new Date().toLocaleString('id-ID')}_`;

          const tgRes = await fetch(`https://api.telegram.org/bot${config.telegram_bot_token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: config.telegram_chat_id,
              text: telegramMsg,
              parse_mode: 'Markdown'
            })
          });

          if (!tgRes.ok) {
            const tgErrText = await tgRes.text();
            console.warn(`[${timestamp}] Telegram API responded with error: ${tgRes.status} ${tgErrText}`);
          } else {
            console.log(`[${timestamp}] Telegram notification sent successfully to ${config.telegram_chat_id}`);
          }
        } catch (tgErr) {
          console.error(`[${timestamp}] Error sending Telegram alert:`, tgErr);
        }
      }
    }

    // Mark webhook log as processed
    if (logId) {
      await supabase
        .from('mayar_webhook_events')
        .update({ status: 'processed' })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Mayar Webhook processed and logged successfully.',
        transaction_id: transactionId,
        status: paymentStatus
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error(`[${timestamp}] Fatal error processing Mayar webhook:`, error);
    if (logId) {
      await supabase
        .from('mayar_webhook_events')
        .update({ status: 'failed', error_message: error.message || String(error) })
        .eq('id', logId)
        .catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: false,
        code: 'WEBHOOK_PROCESSING_ERROR',
        message: error.message || 'Error occurred while processing webhook.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
