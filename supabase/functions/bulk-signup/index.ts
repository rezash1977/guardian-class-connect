// supabase/functions/bulk-signup/index.ts

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Helper function to create Supabase client
function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("[Bulk Signup] CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    throw new Error("پیکربندی سرور ناقص است. لطفاً با مدیر سیستم تماس بگیرید.");
  }
  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    { auth: { persistSession: false } }
  );
}

Deno.serve(async (req) => {
  // --- Handle CORS Preflight ---
  if (req.method === 'OPTIONS') {
    console.log("[Bulk Signup] Handling OPTIONS request");
    return new Response('ok', { headers: corsHeaders });
  }

  let supabaseAdmin: SupabaseClient;
  try {
     console.log("[Bulk Signup] Initializing Supabase admin client...");
     supabaseAdmin = getSupabaseAdminClient();
     console.log("[Bulk Signup] Supabase admin client initialized successfully.");
  } catch (initError: unknown) {
      console.error("[Bulk Signup] Error initializing Supabase client:", initError);
      const errorMsg = initError instanceof Error ? initError.message : String(initError);
      return new Response(JSON.stringify({ success: false, error: errorMsg, errors: [errorMsg] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
  }

  try {
    // --- Parse Request Body ---
    console.log("[Bulk Signup] Parsing request body...");
    const body = await req.json();
    console.log("[Bulk Signup] Received request body:", JSON.stringify(body, null, 2));
    
    const { users, userType } = body;

    // --- Input Validation ---
    if (!users || !Array.isArray(users)) {
      console.error("[Bulk Signup] Validation Error: 'users' array missing.", body);
      throw new Error('فیلد "users" (آرایه) الزامی است.');
    }

    if (!userType || typeof userType !== 'string') {
      console.error("[Bulk Signup] Validation Error: 'userType' missing or invalid.", body);
      throw new Error('فیلد "userType" (رشته) الزامی است.');
    }

    const validUserTypes = ['admin', 'teacher', 'parent'];
    if (!validUserTypes.includes(userType)) {
       console.error("[Bulk Signup] Validation Error: Invalid 'userType'. Received:", userType);
      throw new Error(`مقدار "userType" نامعتبر است (${userType}). باید یکی از ${validUserTypes.join(', ')} باشد.`);
    }
    
    console.log(`[Bulk Signup] ✅ Input validation passed. User type: "${userType}", Users count: ${users.length}`);

    const errors: string[] = [];
    const results: { email: string; id: string; temp_student_name?: string }[] = [];
    let successCount = 0;

    // --- Process Each User ---
    for (const [index, user] of users.entries()) {
      const rowIndex = index + 1;
      let userId = '';
      const { email, password, full_name, username, temp_student_name } = user;
      const logPrefix = `[Bulk Signup] User ${rowIndex}/${users.length} (${email || 'No Email'}):`;
      console.log(`${logPrefix} Starting processing...`);

      try {
        // -- Basic Field Validation for Current User --
        if (!email || !password || !full_name || !username) {
          let missingFields = [];
          if (!email) missingFields.push("ایمیل");
          if (!password) missingFields.push("رمز عبور");
          if (!full_name) missingFields.push("نام کامل");
          if (!username) missingFields.push("نام کاربری");
          const errorMessage = `ردیف ${rowIndex}: فیلدهای الزامی (${missingFields.join(', ')}) یافت نشد یا خالی هستند.`;
          console.error(`${logPrefix} Validation Error:`, errorMessage);
          throw new Error(errorMessage);
        }
        console.log(`${logPrefix} ✅ Field validation passed.`);

        // --- Step 1: Create Auth User ---
        console.log(`${logPrefix} Creating auth user...`);
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: full_name, username: username },
        });

        if (authError) {
          console.error(`${logPrefix} ❌ Auth Error:`, authError);
          if (authError.message.includes('already registered') || authError.message.includes('unique constraint')) {
             throw new Error(`ردیف ${rowIndex} (${email}): ایمیل قبلا ثبت شده است.`);
          }
          throw new Error(`ردیف ${rowIndex} (${email}): خطا در ساخت کاربر Auth - ${authError.message}`);
        }

        userId = authData.user.id;
        console.log(`${logPrefix} ✅ Auth user created. ID: ${userId}`);

        // --- Step 2: Insert Profile ---
        console.log(`${logPrefix} Inserting profile...`);
        const { error: profileInsertError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                full_name: full_name,
                username: username,
                email: email
            });

        if (profileInsertError) {
            console.error(`${logPrefix} ❌ Profile Insert Error:`, profileInsertError);
            if (profileInsertError.code === '23505') {
              if (profileInsertError.message.includes('profiles_username_key')) {
                 throw new Error(`ردیف ${rowIndex} (${email}): نام کاربری '${username}' تکراری است.`);
              }
              if (profileInsertError.message.includes('profiles_email_key')) {
                 throw new Error(`ردیف ${rowIndex} (${email}): ایمیل '${email}' در پروفایل‌ها تکراری است.`);
              }
              throw new Error(`ردیف ${rowIndex} (${email}): کلید تکراری در پروفایل.`);
            }
            throw new Error(`ردیف ${rowIndex} (${email}): خطا در ساخت پروفایل - ${profileInsertError.message}`);
        }
        console.log(`${logPrefix} ✅ Profile inserted successfully.`);

        // --- Step 3: Insert User Role ---
        console.log(`${logPrefix} Assigning role "${userType}"...`);
        
        if (!userId || !userType) {
            throw new Error(`ردیف ${rowIndex} (${email}): خطای داخلی - شناسه کاربر یا نوع نقش نامعتبر است.`);
        }

        const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
            user_id: userId,
            role: userType,
        });

        if (roleError) {
             console.error(`${logPrefix} ❌ Role Assignment Error:`, roleError);
             if (roleError.code === '23502') {
                 throw new Error(`ردیف ${rowIndex} (${email}): نقش نامعتبر یا null است.`);
             }
             throw new Error(`ردیف ${rowIndex} (${email}): خطا در تخصیص نقش - ${roleError.message}`);
        }
        console.log(`${logPrefix} ✅ Role '${userType}' assigned successfully.`);

        // --- Step 4: Insert Teacher Record (if applicable) ---
        if (userType === 'teacher') {
          console.log(`${logPrefix} Creating teacher record...`);
          const { error: teacherError } = await supabaseAdmin.from('teachers').insert({
            profile_id: userId,
          });
          if (teacherError) {
             console.error(`${logPrefix} ❌ Teacher Record Creation Error:`, teacherError);
             throw new Error(`ردیف ${rowIndex} (${email}): خطا در ساخت رکورد معلم - ${teacherError.message}`);
          }
           console.log(`${logPrefix} ✅ Teacher record created.`);
        }

        // --- Success for this user ---
        results.push({ email, id: userId, temp_student_name });
        successCount++;
        console.log(`${logPrefix} ✅ Successfully processed.`);

      } catch (userError: unknown) {
        // --- Error handling & Rollback ---
        console.error(`${logPrefix} ❌ Error during processing:`, userError);
        const errorMsg = userError instanceof Error ? userError.message : String(userError);
        errors.push(errorMsg);

        if (userId) {
          console.warn(`${logPrefix} ⚠️ Attempting rollback for Auth User ID: ${userId}`);
          try {
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (deleteError) {
              console.error(`${logPrefix} ❌ CRITICAL: Failed to roll back auth user ${userId}:`, deleteError.message);
              errors.push(`ردیف ${rowIndex} (${email}): خطا در بازگردانی - ${deleteError.message}`);
            } else {
              console.log(`${logPrefix} ✅ Rolled back auth user ${userId}.`);
            }
          } catch (rollbackException: unknown) {
            const rollbackMsg = rollbackException instanceof Error ? rollbackException.message : String(rollbackException);
            console.error(`${logPrefix} ❌ CRITICAL: Exception during rollback:`, rollbackMsg);
            errors.push(`ردیف ${rowIndex} (${email}): استثنا در بازگردانی - ${rollbackMsg}`);
          }
        }
      }
    }

    // --- Final Response ---
    console.log("[Bulk Signup] ✅ Finished. Success:", successCount, "Errors:", errors.length);
    const overallSuccess = errors.length === 0 && users.length > 0;
    
    return new Response(JSON.stringify({
      success: overallSuccess,
      successCount,
      errors,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    // --- General Function Error ---
    console.error("[Bulk Signup] ❌ General Edge Function Error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      error: `خطای کلی: ${errorMsg}`,
      errors: [errorMsg]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error instanceof SyntaxError ? 400 : 500,
    });
  }
});