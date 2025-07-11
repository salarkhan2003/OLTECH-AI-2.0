import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jstkovtzmqywscakaycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdGtvdnR6bXF5d3NjYWtheWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNDU0NTQsImV4cCI6MjA2NzYyMTQ1NH0.kONJTgzuE7XwblQ9LHWBIMNRS5psQ2YzasNjLHfiu-s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 