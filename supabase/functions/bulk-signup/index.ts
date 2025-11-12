// supabase/functions/bulk-signup/index.ts

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { z } from 'npm:zod@3.22.4'

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

// Input validation schemas
const userSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email format" }).max(255, { message: "Email too long" }),
  username: z.string().trim().min(3, { message: "Username must be at least 3 characters" }).max(50, { message: "Username too long" }).regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores" }),
  full_name: z.string().trim().min(1, { message: "Full name is required" }).max(100, { message: "Full name too long" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(128, { message: "Password too long" }),
  temp_student_name: z.string().optional(),
});

const requestSchema = z.object({
  users: z.array(userSchema).min(1, { message: "At least one user required" }).max(50, { message: "Maximum 50 users per request" }),
  userType: z.enum(['admin', 'teacher', 'parent'], { message: "Invalid user type" }),
});

// Rate limiting helper
async function checkRateLimit(supabaseAdmin: SupabaseClient, userId: string): Promise<{ allowed: boolean; message?: string }> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  // Check attempts in the last 5 minutes
  const { data: recentAttempts, error } = await supabaseAdmin
    .from('bulk_signup_attempts')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', fiveMinutesAgo);

  if (error) {
    console.error('[Rate Limit] Error checking attempts:', error);
    // Allow the request if we can't check (fail open, but log)
    return { allowed: true };
  }

  const attemptCount = recentAttempts?.length || 0;
  const maxAttempts = 3; // Max 3 bulk signup requests per 5 minutes

  if (attemptCount >= maxAttempts) {
    return { 
      allowed: false, 
      message: `درخواست‌های بیش از حد. لطفاً ${5} دقیقه صبر کنید و دوباره تلاش کنید.` 
    };
  }

  return { allowed: true };
}

// Log rate limit attempt
async function logAttempt(supabaseAdmin: SupabaseClient, userId: string, userCount: number) {
  await supabaseAdmin
    .from('bulk_signup_attempts')
    .insert({
      user_id: userId,
      user_count: userCount,
    });
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
        status: 500, // Internal Server Error due to config issue
      });
  }


  try {
    // --- Authentication Check ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("[Bulk Signup] Missing Authorization header");
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized - Missing authentication token' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error("[Bulk Signup] Invalid token:", authError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized - Invalid token' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // --- Admin Role Check ---
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      console.error("[Bulk Signup] User is not admin:", user.id);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Forbidden - Admin access required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    console.log(`[Bulk Signup] Authenticated as admin: ${user.id}`);

    // --- Rate Limiting Check ---
    const rateLimitResult = await checkRateLimit(supabaseAdmin, user.id);
    if (!rateLimitResult.allowed) {
      console.warn(`[Bulk Signup] Rate limit exceeded for user ${user.id}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: rateLimitResult.message 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429, // Too Many Requests
      });
    }

    // --- Parse Request Body ---
    console.log("[Bulk Signup] Parsing request body...");
    const body = await req.json();
    
    // --- Zod Schema Validation ---
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      console.error("[Bulk Signup] Validation Error:", errors);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Input validation failed',
        errors 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { users, userType } = validationResult.data;
    console.log(`[Bulk Signup] Input validation passed. User type: ${userType}, Users count: ${users.length}`);

    // --- Log Rate Limit Attempt ---
    await logAttempt(supabaseAdmin, user.id, users.length);


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
        // Field validation is now handled by Zod schema
        console.log(`${logPrefix} Processing validated user data.`);

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

      } catch (userError: unknown) {
        // --- Error handling & Rollback for the current user ---
        console.error(`${logPrefix} Error during processing:`, userError);
        const errorMsg = userError instanceof Error ? userError.message : String(userError);
        errors.push(errorMsg); // Add specific error

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
          } catch (rollbackException: unknown) {
            const rollbackMsg = rollbackException instanceof Error ? rollbackException.message : String(rollbackException);
            console.error(`${logPrefix} CRITICAL: Exception during rollback for auth user ${userId}: ${rollbackMsg}`);
            errors.push(`(ردیف ${rowIndex}: ${email}) - استثنا در حین بازگردانی عملیات: ${rollbackMsg}`);
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

  } catch (error: unknown) {
    // --- General Function Error (e.g., JSON parsing, initial validation) ---
    console.error("[Bulk Signup] General Edge Function Error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      error: `خطای کلی در فانکشن: ${errorMsg}`,
      errors: [errorMsg]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error instanceof SyntaxError ? 400 : 500, // 400 for bad request, 500 for others
    });
  }
});

