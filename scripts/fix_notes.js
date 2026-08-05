import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dpthhttwmtgtbrsjtfcg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwdGhodHR3bXRndGJyc2p0ZmNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTA0NjUsImV4cCI6MjA5ODA4NjQ2NX0.kUHLK0QIVdCu0jAMq3zp8bxDpvg1g-9Mj5FrGoA1tB4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  console.log('Fetching dev notes...');
  const { data: notes, error: fetchError } = await supabase.from('dev_notes').select('id, description');
  
  if (fetchError) {
    console.error('Error fetching notes:', fetchError);
    return;
  }
  
  const notesToUpdate = notes.filter(n => n.description === '[ ] ');
  console.log(`Found ${notesToUpdate.length} notes with empty checklist. Fixing...`);
  
  let successCount = 0;
  for (const note of notesToUpdate) {
    const { error } = await supabase.from('dev_notes').update({ description: '' }).eq('id', note.id);
    if (!error) successCount++;
  }
  
  console.log(`Successfully fixed ${successCount} notes!`);
}

run();
