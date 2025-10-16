import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, fullName, username, subject } = await req.json()

    if (!email || !password || !fullName || !username) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Create a Supabase client with the service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Create the auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for simplicity
      user_metadata: {
        full_name: fullName,
        username: username,
        role: 'teacher'
      }
    })

    if (authError) {
      console.error('Auth user creation error:', authError)
      // Check for specific, common errors to provide better feedback
      if (authError.message.includes('already registered')) {
        return new Response(JSON.stringify({ error: 'این ایمیل قبلا ثبت‌نام کرده است' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        })
      }
      throw authError
    }

    const userId = authData.user.id

    // 2. The database trigger should handle creating the profile.
    // We wait a moment to ensure the trigger has fired.
    // A more robust solution might be to check if the profile exists.
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found after user creation. Trigger might have failed.', profileError);
       // Manually insert profile as a fallback
       const { error: manualProfileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          full_name: fullName,
          username: username,
          role: 'teacher',
        });
       if (manualProfileError) {
          console.error("Manual profile insertion failed:", manualProfileError);
          throw new Error('پروفایل کاربر پس از ایجاد، ساخته نشد.');
       }
    }

    // 3. Create the teacher record
    const { error: teacherError } = await supabaseAdmin
      .from('teachers')
      .insert({
        profile_id: userId,
        subject: subject || null,
      })

    if (teacherError) {
      console.error('Teacher record creation error:', teacherError)
      throw teacherError
    }

    return new Response(JSON.stringify({ message: 'معلم با موفقیت ایجاد شد' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})