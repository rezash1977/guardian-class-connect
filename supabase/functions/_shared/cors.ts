// supabase/functions/bulk-signup/index.ts

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
// --- MODIFICATION: Import corsHeaders directly ---
import { corsHeaders } from '../_shared/cors.ts'
// --- END MODIFICATION ---

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
    console.log("[Bulk Signup] Received request body:", JSON.stringify(body, null, 2)); // Log the raw body
    // --- MODIFICATION: Destructure userType specifically ---
    const { users, userType } = body; // Directly get userType
    // --- END MODIFICATION ---

    // --- Input Validation ---
    // --- MODIFICATION: Check userType directly ---
    if (!users || !Array.isArray(users) || !userType) { // Check userType presence
      console.error("[Bulk Signup] Validation Error: 'users' array or 'userType' string missing.", body);
      throw new Error('فیلدهای "users" (آرایه) و "userType" (رشته) الزامی هستند.');
    }
    // --- END MODIFICATION ---
    const validUserTypes = ['admin', 'teacher', 'parent']; // Keep admin for potential future use
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
      const rowIndex = index + 1; // For clearer error messages in bulk import
      let userId = ''; // Define userId here for potential rollback scope
      // --- MODIFICATION: Destructure full_name and username specifically for clarity ---
      const { email, password, full_name, username, temp_student_name } = user; // Get names directly
      // --- END MODIFICATION ---
      const logPrefix = `[Bulk Signup] User ${rowIndex}/${users.length} (${email || 'No Email'}):`;
      console.log(`${logPrefix} Starting processing...`);


      try {
        // -- Basic Field Validation for Current User --
        // --- MODIFICATION: Use destructured names for validation ---
        if (!email || !password || !full_name || !username) { // Validate destructured names
          let missingFields = [];
          if (!email) missingFields.push("ایمیل");
          if (!password) missingFields.push("رمز عبور");
          if (!full_name) missingFields.push("نام کامل"); // Use full_name
          if (!username) missingFields.push("نام کاربری"); // Use username
          const errorMessage = `ردیف ${rowIndex}: فیلدهای الزامی (${missingFields.join(', ')}) یافت نشد یا خالی هستند.`;
          console.error(`${logPrefix} Validation Error:`, errorMessage, "Data:", user);
          throw new Error(errorMessage);
        }
        // --- END MODIFICATION ---
        console.log(`${logPrefix} Field validation passed.`);

        // --- Step 1: Create Auth User ---
        // --- MODIFICATION: Pass full_name and username to user_metadata ---
        console.log(`${logPrefix} Attempting to create auth user with metadata:`, { full_name, username });
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // Auto-confirm email for simplicity in admin panel
          user_metadata: { full_name: full_name, username: username }, // Pass names here
        });
        // --- END MODIFICATION ---

        if (authError) {
          console.error(`${logPrefix} Auth Error:`, authError);
          // --- More specific error checking ---
          if (authError.message.includes('already registered') || authError.message.includes('unique constraint') || authError.message.includes('duplicate key value violates unique constraint')) {
             // Check profiles table as well for username uniqueness before throwing generic auth error
             const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id').eq('username', username).maybeSingle();
             if(existingProfile) {
                 throw new Error(`(ردیف ${rowIndex}: ${username}): نام کاربری از قبل در جدول پروفایل‌ها وجود دارد.`);
             }
             // If not profile, likely email exists in auth.users
             throw new Error(`(ردیف ${rowIndex}: ${email}): ایمیل قبلا در سیستم احراز هویت ثبت شده است.`);
          }
          if (authError.message.includes('Database error')) {
             console.error(`${logPrefix} Potential Database error during Auth user creation:`, authError.message);
             // Check profiles table for username uniqueness which might cause DB error during trigger
              const { data: existingProfile } = await supabaseAdmin.from('profiles').select('id').eq('username', username).maybeSingle();
             if(existingProfile) {
                 throw new Error(`(ردیف ${rowIndex}: ${username}): نام کاربری از قبل در جدول پروفایل‌ها وجود دارد (باعث خطای پایگاه داده).`);
             }
             throw new Error(`(ردیف ${rowIndex}: ${email}) - خطای پایگاه داده هنگام ایجاد کاربر Auth: ${authError.message}`);
          }
          throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت کاربر Auth: ${authError.message}`);
        }

        userId = authData.user.id;
        console.log(`${logPrefix} Auth user created successfully with ID: ${userId}`);

        // --- Step 2: Explicitly Insert Profile ---
        // --- MODIFICATION: Use destructured names for profile insert ---
        console.log(`${logPrefix} Attempting to insert profile for user ${userId} with:`, { full_name, username, email });
        const { error: profileInsertError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                full_name: full_name, // Use full_name
                username: username, // Use username
                email: email // Include email in profile
            });
        // --- END MODIFICATION ---

        if (profileInsertError) {
            console.error(`${logPrefix} Profile Insert Error for ${userId}:`, profileInsertError);
             // More specific error handling based on constraint names (adjust if your constraint names differ)
            if (profileInsertError.code === '23505') { // Unique violation
                 if (profileInsertError.message.includes('profiles_pkey')) {
                     throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: شناسه کاربر (${userId}) از قبل در جدول پروفایل‌ها وجود دارد. (خطای کلید اصلی تکراری)`);
                 } else if (profileInsertError.message.includes('profiles_username_key')) {
                     throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: نام کاربری '${username}' از قبل وجود دارد.`);
                 } else if (profileInsertError.message.includes('profiles_email_key')) {
                     throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: ایمیل '${email}' از قبل در جدول پروفایل‌ها وجود دارد.`);
                 } else {
                      throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: نقض محدودیت یکتا (${profileInsertError.details || profileInsertError.message})`);
                 }
            }
            throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت پروفایل: ${profileInsertError.message}`);
        }
        console.log(`${logPrefix} Profile inserted successfully for ${userId}`);


        // --- Step 3: Insert User Role ---
        console.log(`${logPrefix} Preparing to insert role. User ID: ${userId}, Role Type: ${userType}`);
        if (!userId || !userType) {
            throw new Error(`(ردیف ${rowIndex}: ${email}) - خطای داخلی: شناسه کاربر یا نوع نقش قبل از درج نقش نامعتبر است.`);
        }
        const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
            user_id: userId,
            role: userType,
        });

        if (roleError) {
             console.error(`${logPrefix} Role Assignment Error for ${userId}:`, roleError);
             if (roleError.code === '23502' && roleError.message.includes('"role" violates not-null constraint')) {
                 throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در تخصیص نقش: مقدار نقش (role) نامعتبر یا null ارسال شده است.`);
             }
             // Add check for unique constraint violation (user might already have the role)
             if (roleError.code === '23505' && roleError.message.includes('user_roles_user_id_role_key')) {
                 console.warn(`${logPrefix} User ${userId} already has role '${userType}'. Skipping role assignment.`);
                 // Decide if this is an error or just a warning. For now, treat as warning and continue.
             } else {
                throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در تخصیص نقش '${userType}': ${roleError.message}`);
             }
        } else {
           console.log(`${logPrefix} Role '${userType}' assigned successfully to ${userId}`);
        }

        // --- Step 4: Insert Teacher Record (if applicable) ---
        if (userType === 'teacher') {
          console.log(`${logPrefix} Attempting to create teacher record for user ${userId}...`);
          const { error: teacherError } = await supabaseAdmin.from('teachers').insert({
            profile_id: userId,
          });
          if (teacherError) {
             console.error(`${logPrefix} Teacher Record Creation Error for ${userId}:`, teacherError);
             // Check for unique constraint violation (teacher record might already exist)
             if (teacherError.code === '23505' && teacherError.message.includes('teachers_profile_id_key')) {
                 console.warn(`${logPrefix} Teacher record for profile ${userId} already exists. Skipping teacher record creation.`);
                 // Decide if this is an error. Treating as warning.
             } else {
                 throw new Error(`(ردیف ${rowIndex}: ${email}) - خطا در ساخت رکورد معلم: ${teacherError.message}`);
             }
          } else {
             console.log(`${logPrefix} Teacher record created successfully for ${userId}`);
          }
        }

        // --- Success for this user ---
        // Pass temp_student_name along if it exists, otherwise undefined
        results.push({ email, id: userId, ...(temp_student_name && { temp_student_name }) });
        successCount++;
        console.log(`${logPrefix} Successfully processed.`);

      } catch (userError) {
        // --- Error handling & Rollback for the current user ---
        console.error(`${logPrefix} Error during processing:`, userError);
        // --- MODIFICATION: Add row index to error message if not present ---
        const errorMessage = userError.message.startsWith(`(ردیف ${rowIndex}`)
                             ? userError.message
                             : `(ردیف ${rowIndex}: ${email || username || 'Unknown'}) - ${userError.message}`;
        errors.push(errorMessage);
        // --- END MODIFICATION ---

        if (userId) { // Only attempt rollback if auth user was actually created
          console.warn(`${logPrefix} Attempting rollback for failed process (Auth User ID: ${userId})`);
          try {
            // Use admin client to delete the auth user
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
    // Determine overall success based on whether *any* errors occurred
    const overallSuccess = errors.length === 0 && users.length > 0;
    return new Response(JSON.stringify({
      success: overallSuccess,
      successCount,
      errors, // Send back detailed errors
      results // Send back successful results with IDs
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      // Status 200 even if there are partial errors, check 'success' and 'errors' in client
      status: 200,
    });

  } catch (error) {
    // --- General Function Error (e.g., JSON parsing, initial validation) ---
    console.error("[Bulk Signup] General Edge Function Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: `خطای کلی در فانکشن: ${error.message}`, // More generic error
      errors: [error.message] // Ensure errors array is present
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error instanceof SyntaxError ? 400 : 500, // 400 for bad request (JSON parse), 500 for others
    });
  }
})
