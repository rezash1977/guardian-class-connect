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
  // console.log("[Bulk Signup] Creating Supabase client with URL:", supabaseUrl); // Don't log URL/Key directly
  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    { auth: { persistSession: false } } // Essential for Edge Functions
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
  } catch (initError) {
      console.error("[Bulk Signup] Error initializing Supabase client:", initError);
      return new Response(JSON.stringify({ success: false, error: initError.message, errors: [initError.message] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Internal Server Error due to config issue
      });
  }


  try {
    // --- Parse Request Body ---
    console.log("[Bulk Signup] Parsing request body...");
    const body = await req.json();
    console.log("[Bulk Signup] Received request body:", JSON.stringify(body, null, 2));
    const { users, userType } = body;

    // --- Input Validation ---
    if (!users || !Array.isArray(users) || !userType) {
      console.error("[Bulk Signup] Validation Error: 'users' array or 'userType' missing.", body);
      throw new Error('فیلدهای "users" (آرایه) و "userType" (رشته) الزامی هستند.');
    }
    const validUserTypes = ['admin', 'teacher', 'parent'];
    if (!validUserTypes.includes(userType)) {
       console.error("[Bulk Signup] Validation Error: Invalid 'userType'. Received:", userType);
      throw new Error(`مقدار "userType" نامعتبر است (${userType}). باید یکی از ${validUserTypes.join(', ')} باشد.`);
    }
    console.log(`[Bulk Signup] Input validation passed. User type: ${userType}, Users count: ${users.length}`);


    const errors: string[] = [];
    const results: { email: string; id: string; temp_student_name?: string }[] = [];
    let successCount = 0;

    // --- Process Each User ---
    for (const [index, user] of users.entries()) {
      const rowIndex = index + 1;
      let userId = ''; // Define userId here for potential rollback
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
          console.error(`${logPrefix} Validation Error:`, errorMessage, "Data:", user);
          throw new Error(errorMessage);
        }
        console.log(`${logPrefix} Field validation passed.`);

        // --- Step 1: Create Auth User ---
        console.log(`${logPrefix} Attempting to create auth user...`);
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: full_name, username: username },
        });

        if (authError) {
          console.error(`${logPrefix} Auth Error:`, authError);
          if (authError.message.includes('already registered') || authError.message.includes('unique constraint')) {
             throw new Error(`(ردیف ${rowIndex}: ${email}): ایمیل قبلا در سیستم احراز هویت ثبت شده است.`);
          }
          if (authError.message.includes('Database error')) {
             console.error(`${logPrefix} Potential Database error during Auth user creation:`, authError.message);
             throw new Error(`(ردیف ${rowIndex}: ${email}) - خطای پایگاه داده هنگام ایجاد کاربر Auth: ${authError.message}`);
          }
          throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت کاربر Auth: ${authError.message}`);
        }

        userId = authData.user.id;
        console.log(`${logPrefix} Auth user created successfully with ID: ${userId}`);

        // --- Step 2: Explicitly Insert Profile ---
        console.log(`${logPrefix} Attempting to insert profile for user ${userId}...`);
        const { error: profileInsertError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                full_name: full_name,
                username: username,
                email: email
            });

        if (profileInsertError) {
            console.error(`${logPrefix} Profile Insert Error for ${userId}:`, profileInsertError);
            if (profileInsertError.code === '23505' && profileInsertError.message.includes('profiles_pkey')) {
                 throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: شناسه کاربر (${userId}) از قبل در جدول پروفایل‌ها وجود دارد. (خطای کلید اصلی تکراری)`);
            }
             if (profileInsertError.code === '23505' && profileInsertError.message.includes('profiles_username_key')) {
                 throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: نام کاربری '${username}' از قبل وجود دارد.`);
             }
              if (profileInsertError.code === '23505' && profileInsertError.message.includes('profiles_email_key')) {
                 throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: ایمیل '${email}' از قبل در جدول پروفایل‌ها وجود دارد.`);
             }
            throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: ${profileInsertError.message}`);
        }
        console.log(`${logPrefix} Profile inserted successfully for ${userId}`);


        // --- Step 3: Insert User Role ---
        console.log(`${logPrefix} Preparing to insert role. User ID: ${userId}, Role Type: ${userType}`); // <<<--- Added Log
        if (!userId || !userType) { // <<<--- Added Check
            throw new Error(`(ردیف ${rowIndex}: ${email}) - خطای داخلی: شناسه کاربر یا نوع نقش قبل از درج نقش نامعتبر است.`);
        }
        const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
            user_id: userId,
            role: userType, // Make sure userType has a valid value here
        });

        if (roleError) {
             console.error(`${logPrefix} Role Assignment Error for ${userId}:`, roleError);
             // Provide more specific error if it's the not-null constraint
             if (roleError.code === '23502' && roleError.message.includes('"role" violates not-null constraint')) {
                 throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در تخصیص نقش: مقدار نقش (role) نامعتبر یا null ارسال شده است.`);
             }
             throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در تخصیص نقش '${userType}': ${roleError.message}`);
        }
        console.log(`${logPrefix} Role '${userType}' assigned successfully to ${userId}`);

        // --- Step 4: Insert Teacher Record (if applicable) ---
        if (userType === 'teacher') {
          console.log(`${logPrefix} Attempting to create teacher record for user ${userId}...`);
          const { error: teacherError } = await supabaseAdmin.from('teachers').insert({
            profile_id: userId,
          });
          if (teacherError) {
             console.error(`${logPrefix} Teacher Record Creation Error for ${userId}:`, teacherError);
             throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت رکورد معلم: ${teacherError.message}`);
          }
           console.log(`${logPrefix} Teacher record created successfully for ${userId}`);
        }

        // --- Success for this user ---
        results.push({ email, id: userId, temp_student_name });
        successCount++;
        console.log(`${logPrefix} Successfully processed.`);

      } catch (userError) {
        // --- Error handling & Rollback for the current user ---
        console.error(`${logPrefix} Error during processing:`, userError);
        errors.push(userError.message); // Add specific error

        if (userId) { // Only attempt rollback if auth user was actually created
          console.warn(`${logPrefix} Attempting rollback for failed process (Auth User ID: ${userId})`);
          try {
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (deleteError) {
              console.error(`${logPrefix} CRITICAL: Failed to roll back auth user ${userId}: ${deleteError.message}`);
              errors.push(`(ردیف ${rowIndex}: ${email}) - خطا در بازگردانی عملیات (حذف کاربر Auth): ${deleteError.message}`);
            } else {
              console.log(`${logPrefix} Rolled back auth user ${userId} successfully.`);
            }
          } catch (rollbackException) {
            console.error(`${logPrefix} CRITICAL: Exception during rollback for auth user ${userId}: ${rollbackException.message}`);
            errors.push(`(ردیف ${rowIndex}: ${email}) - استثنا در حین بازگردانی عملیات: ${rollbackException.message}`);
          }
        } else {
          console.log(`${logPrefix} No rollback needed as Auth User was not created or creation failed.`);
        }
      }
    } // --- End of user loop ---

    // --- Final Response ---
    console.log("[Bulk Signup] Finished processing all users. Success Count:", successCount, "Errors Count:", errors.length);
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

  } catch (error) {
    // --- General Function Error (e.g., JSON parsing, initial validation) ---
    console.error("[Bulk Signup] General Edge Function Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: `خطای کلی در فانکشن: ${error.message}`,
      errors: [error.message]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error instanceof SyntaxError ? 400 : 500, // 400 for bad request, 500 for others
    });
  }
});

