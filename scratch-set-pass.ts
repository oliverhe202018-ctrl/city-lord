import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eyxlkuvxbihueplaqcbq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5eGxrdXZ4YmlodWVwbGFxY2JxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY3Njg1OSwiZXhwIjoyMDg1MjUyODU5fQ.PZVHv9PrtFdHVT91M4ooVQo8-_HecxpuM_Q07dzTuTg';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = '251513541@qq.com';
  const newPassword = 'aaa021300';
  
  console.log(`Searching for user with email ${email}...`);
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  
  const user = users.find(u => u.email === email);
  if (!user) {
    console.error(`User ${email} not found!`);
    return;
  }
  
  console.log(`Found user: ID=${user.id}. Setting password to: ${newPassword}...`);
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword
  });
  
  if (error) {
    throw error;
  }
  
  console.log('Password updated successfully!');
}

main().catch(err => console.error('Error:', err));
