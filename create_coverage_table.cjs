// Script to create the coverage_areas table in Supabase
// Run: node create_coverage_table.cjs

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gbjsmqaecxzdmcvqcpbs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdianNtcWFlY3h6ZG1jdnFjcGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NzAzMTksImV4cCI6MjA5MTU0NjMxOX0.l1Rox5dIK1EmkOAjsAfW9lpa9QiGI7URn-pIJ1siQWA'
);

async function main() {
  console.log('Testing if coverage_areas table exists...');
  
  // Try to query the table
  const { data, error } = await supabase
    .from('coverage_areas')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Table does not exist yet. Error:', error.message);
    console.log('\n=== YOU NEED TO CREATE THE TABLE IN SUPABASE DASHBOARD ===');
    console.log('Go to: https://supabase.com/dashboard → your project → SQL Editor');
    console.log('Run this SQL:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS coverage_areas (
  id TEXT PRIMARY KEY,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  allowed_ceps JSONB DEFAULT '[]',
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE coverage_areas ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Anyone can read coverage" ON coverage_areas 
  FOR SELECT USING (true);

-- Allow all authenticated users to insert/update/delete (gestors will manage)
CREATE POLICY "Authenticated users can manage coverage" ON coverage_areas 
  FOR ALL USING (true);
    `);
  } else {
    console.log('Table already exists! Data:', data);
    
    // Seed with defaults if empty
    if (!data || data.length === 0) {
      console.log('Table is empty, seeding with defaults...');
      const { error: insertError } = await supabase
        .from('coverage_areas')
        .insert([
          { id: '1', neighborhood: 'Sé', city: 'São Paulo', allowed_ceps: [], center_lat: -23.5505, center_lng: -46.6333 },
          { id: '2', neighborhood: 'Bela Vista', city: 'São Paulo', allowed_ceps: [], center_lat: -23.5615, center_lng: -46.6553 },
          { id: '3', neighborhood: 'República', city: 'São Paulo', allowed_ceps: [], center_lat: -23.5447, center_lng: -46.6388 },
        ]);
      if (insertError) {
        console.error('Seed error:', insertError.message);
      } else {
        console.log('Seeded successfully!');
      }
    }
  }
}

main();
