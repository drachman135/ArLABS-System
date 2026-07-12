import crypto from 'crypto';

function base64url(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function signJWT(payload: any, privateKeyPem: string): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const headerStr = base64url(Buffer.from(JSON.stringify(header)));
  const payloadStr = base64url(Buffer.from(JSON.stringify(payload)));
  const data = `${headerStr}.${payloadStr}`;
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(data);
  const formattedKey = privateKeyPem.replace(/\\n/g, '\n');
  const signature = sign.sign(formattedKey);
  const signatureStr = base64url(signature);
  return `${data}.${signatureStr}`;
}

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const assertion = signJWT(payload, privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Google access token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return (data as any).access_token;
}

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
    const { title, body, targetTokenOrTopic } = payload;

    if (!title || !body || !targetTokenOrTopic) {
      return res.status(400).json({ success: false, error: 'Missing title, body, or targetTokenOrTopic' });
    }

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.VITE_FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.VITE_FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      return res.status(500).json({
        success: false,
        error: 'FCM credentials are not configured in server environment variables.'
      });
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

    const message: any = {
      notification: {
        title,
        body
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        status: 'done'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
          channel_id: 'high_importance_channel'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    if (targetTokenOrTopic.startsWith('/topics/')) {
      message.topic = targetTokenOrTopic.substring('/topics/'.length);
    } else {
      message.token = targetTokenOrTopic;
    }

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Firebase Cloud Messaging HTTP v1 request failed: ${errorText}`
      });
    }

    const result = await response.json();
    return res.status(200).json({ success: true, result });

  } catch (err: any) {
    console.error('Notification error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}
