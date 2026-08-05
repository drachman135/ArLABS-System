import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Fetching applications...');
  const { data: apps, error: fetchError } = await supabase.from('applications').select('id, app_name');
  
  if (fetchError) {
    console.error('Error fetching apps:', fetchError);
    return;
  }
  
  console.log(`Found ${apps.length} applications. Inserting routine notes...`);
  
  const now = new Date().toISOString();
  const notesToInsert = [];
  
  const routineTitles = ['BUG', 'PENAMBAHAN FITUR', 'PENYEMPURNAAN'];
  
  for (const app of apps) {
    for (const title of routineTitles) {
      notesToInsert.push({
        app_id: app.id,
        title: title,
        description: '[ ] ',
        status: 'OPEN',
        priority: 'MEDIUM',
        type: 'TASK',
        labels: ['__ROUTINE__'],
        is_pinned: false,
        created_at: now,
        updated_at: now
      });
    }
  }
  
  // Insert in batches if necessary, but supabase can handle a few hundred easily.
  const { error: insertError } = await supabase.from('dev_notes').insert(notesToInsert);
  
  if (insertError) {
    console.error('Error inserting notes:', insertError);
  } else {
    console.log(`Successfully inserted ${notesToInsert.length} routine notes!`);
  }
}

run();
