/**
 * Supabase Client Configuration
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qpckqwzkwyivlrhtegwj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwY2txd3prd3lpdmxyaHRlZ3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzM2ODMsImV4cCI6MjA4MTc0OTY4M30.fkMrurQ0Rk-37lKnJchqTu4hC399ML6VjrwusrB3CGI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
