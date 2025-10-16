<<<<<<< HEAD
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, and more.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { users } = await req.json()

    if (!users || !Array.isArray(users)) {
      throw new Error('"users" must be an array.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results = []

    for (const user of users) {
      const { email, password, role, ...meta } = user;
      
      if (!email || !password || !role) {
        results.push({ email, success: false, error: 'Email, password, and role are required.' });
        continue;
      }

      // 1. Create user in auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm user
        user_metadata: {
          full_name: meta.full_name,
          username: meta.username,
        }
      })

      if (authError) {
        results.push({ email, success: false, error: authError.message });
        continue;
      }
      
      const userId = authData.user.id;

      // 2. Assign role in user_roles
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: role });

      if (roleError) {
        // Attempt to clean up the created auth user if role assignment fails
        await supabaseAdmin.auth.admin.deleteUser(userId);
        results.push({ email, success: false, error: `Failed to assign role: ${roleError.message}` });
        continue;
      }

      // 3. If teacher, create teacher record
      if (role === 'teacher') {
        const { error: teacherError } = await supabaseAdmin
          .from('teachers')
          .insert({ profile_id: userId, subject: meta.subject || null });
        
        if (teacherError) {
            // Role was assigned, but teacher record failed. Log it but don't delete user.
            results.push({ email, success: false, error: `User created, but failed to create teacher record: ${teacherError.message}` });
            continue;
        }
      }
      
      results.push({ email, success: true });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

=======
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
>>>>>>> 236c2d89051b8098b2151ab89f0f5410f35686f0
