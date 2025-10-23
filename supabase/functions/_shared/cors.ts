import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";
import { corsHeaders, getAllowOriginHeader } from "../_shared/cors.ts";

interface UserSignup {
  email: string;
  password?: string;
  user_metadata?: { 
    full_name?: string;
    username?: string;
    [key: string]: any 
  };
  role: 'teacher' | 'parent';
  temp_student_name?: string; 
}

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin');
  const allowOriginHeader = getAllowOriginHeader(requestOrigin);

  // This is crucial for handling the browser's preflight request.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, ...allowOriginHeader } });
  }

  // Combine all headers for the final response
  const responseHeaders = {
    ...corsHeaders,
    ...allowOriginHeader,
    'Content-Type': 'application/json'
  };

  try {
    const { users } = (await req.json()) as { users: UserSignup[] };

    if (!users || !Array.isArray(users)) {
      throw new Error("Field 'users' is required and must be an array.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results = [];
    const errors = [];

    for (const user of users) {
      if (!user.email || !user.password || !user.user_metadata?.username) {
        errors.push(`ایمیل، رمز عبور و نام کاربری برای یک ردیف الزامی است.`);
        continue;
      }
      
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', user.user_metadata.username)
        .single();

      if (existingProfile) {
          errors.push(`کاربری با نام کاربری '${user.user_metadata.username}' از قبل وجود دارد.`);
          continue;
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        user_metadata: user.user_metadata,
        email_confirm: true,
      });

      if (authError) {
        errors.push(`خطا در ایجاد کاربر ${user.email}: ${authError.message}`);
        continue;
      }
      
      const newUserId = authData.user.id;

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUserId, role: user.role });
        
      if (roleError) {
        errors.push(`خطا در تخصیص نقش برای ${user.email}: ${roleError.message}`);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        continue;
      }

      if (user.role === 'teacher') {
        const { error: teacherError } = await supabaseAdmin
          .from('teachers')
          .insert({ profile_id: newUserId });
        
        if (teacherError) {
            errors.push(`خطا در ساخت پروفایل معلم برای ${user.email}: ${teacherError.message}`);
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            continue;
        }
      }

      results.push({ email: user.email, id: newUserId, temp_student_name: user.temp_student_name });
    }

    return new Response(JSON.stringify({ success: true, results, errors }), {
      headers: responseHeaders,
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: responseHeaders,
      status: 500,
    });
  }
});

