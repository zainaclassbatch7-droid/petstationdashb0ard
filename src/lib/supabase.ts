import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string || 'https://oaboikhoxbwbwqnobfnt.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYm9pa2hveGJ3Yndxbm9iZm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjI0MTYsImV4cCI6MjA5NTc5ODQxNn0.0hkNJIMr1npedRsKlX5stK0mgVqlYZKgtoyW1xzKHnA';

export const supabase = createClient(url, key);
