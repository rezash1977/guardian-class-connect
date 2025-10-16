import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, full_name, username, subject } = await req.json();

    if (!email || !password || !full_name || !username) {
      return new Response(JSON.stringify({ error: 'فیلدهای ایمیل، رمز عبور، نام کامل و نام کاربری الزامی هستند' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Create the auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return new Response(JSON.stringify({ error: 'این ایمیل قبلا ثبت‌نام کرده است' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        })
      }
      throw authError
    }

    const userId = authData.user.id

    // 2. Manually insert the profile with the correct role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        full_name: full_name,
        username: username,
        role: 'teacher',
      });

    if (profileError) {
      // If profile insertion fails, we should probably delete the auth user
      // to avoid orphaned users. This is a more robust approach.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`خطا در ایجاد پروفایل: ${profileError.message}`);
    }

    // 3. Create the teacher record
    const { error: teacherError } = await supabaseAdmin
      .from('teachers')
      .insert({
        profile_id: userId,
        subject: subject || null,
      })

    if (teacherError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`خطا در ایجاد رکورد معلم: ${teacherError.message}`);
    }

    return new Response(JSON.stringify({ message: 'معلم با موفقیت ایجاد شد' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})