import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

export default async function handler(req: any, res: any) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // Parse webhook event details from Supabase Webhook payload
    // Table is 'licenses', event is 'UPDATE'
    const { event, table, record, old_record } = payload;

    if (table === 'licenses' && event === 'UPDATE') {
      const isNewlyActivated = record.associated_device && !old_record.associated_device;

      if (isNewlyActivated) {
        const licenseKey = record.license_key || record.id;
        const deviceId = record.associated_device;
        
        // Retrieve OneSignal credentials
        const onesignalAppId = process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID;
        const onesignalApiKey = process.env.ONESIGNAL_API_KEY;

        if (onesignalAppId && onesignalApiKey) {
          const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Basic ${onesignalApiKey}`
            },
            body: JSON.stringify({
              app_id: onesignalAppId,
              included_segments: ['Subscribed Users'],
              headings: { en: 'Lisensi Diaktifkan! 🔑', id: 'Lisensi Diaktifkan! 🔑' },
              contents: { 
                en: `Lisensi ${licenseKey} berhasil diaktifkan pada perangkat: ${deviceId}`,
                id: `Lisensi ${licenseKey} berhasil diaktifkan pada perangkat: ${deviceId}`
              }
            })
          });

          const result = await response.json();
          return res.status(200).json({
            success: true,
            message: 'OneSignal activation notification dispatched successfully.',
            result
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook received but no notification conditions met.'
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Failed to process webhook: ${err.message}`
    });
  }
}
