// supabase/functions/bulk-signup/index.ts

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { users, userType } = await req.json()

    if (!users || !Array.isArray(users) || !userType) {
      throw new Error('"users" array and "userType" are required.')
    }

    // This client uses the environment variables you've set in the Supabase dashboard.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const errors: string[] = []
    let successCount = 0

    for (const [index, user] of users.entries()) {
      const { email, password, full_name, username } = user
      const rowIndex = index + 1;

      if (!email || !password || !full_name || !username) {
        errors.push(`ردیف ${rowIndex}: ایمیل، رمز عبور، نام کامل و نام کاربری اجباری هستند.`)
        continue
      }
      
      try {
        // 1. Create the user in auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // Auto-confirm the email
          user_metadata: { full_name: full_name },
        })

        if (authError) {
          throw new Error(`(ردیف ${rowIndex}: ${email}): ${authError.message}`)
        }
        
        const userId = authData.user.id

        // 2. Insert into public.profiles
        const { error: profileError } = await supabaseAdmin.from('profiles').insert({
          id: userId,
          full_name: full_name,
          username: username,
          email: email,
        })

        if (profileError) {
          // If profile insert fails, delete the created auth user to keep data consistent
          await supabaseAdmin.auth.admin.deleteUser(userId);
          throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: ${profileError.message}`)
        }

        // 3. Insert into public.user_roles
        const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
            user_id: userId,
            role: userType,
        });

        if (roleError) {
            await supabaseAdmin.auth.admin.deleteUser(userId);
            throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در تخصیص نقش: ${roleError.message}`);
        }
        
        // 4. If user is a teacher, insert into teachers table
        if (userType === 'teacher') {
          const { error: teacherError } = await supabaseAdmin.from('teachers').insert({
            profile_id: userId,
          });
          if (teacherError) {
            await supabaseAdmin.auth.admin.deleteUser(userId);
            throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت رکورد معلم: ${teacherError.message}`);
          }
        }
        
        successCount++;

      } catch (error) {
        errors.push(error.message)
      }
    }

    return new Response(JSON.stringify({ successCount, errors }), {
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

