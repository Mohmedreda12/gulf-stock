import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xftmqzocrkrrnklzsomr.supabase.co'; // Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdG1xem9jcmtycm5rbHpzb21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODkxMjQsImV4cCI6MjA3NDI2NTEyNH0.zPUD_FXsB71AZe0mvZ3tXxv42FiazkDLUrSU7OJEjVY'; // Anon Public Key

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);