async function run() {
  const SUPABASE_URL = 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

  const response = await fetch(`${SUPABASE_URL}/rest/v1/announcements?select=*&limit=1`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  console.log("Status:", response.status);
  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
    console.log("No data returned or table empty.");
  }
}

run();
