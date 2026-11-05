import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const invalidLogin = () => new Response(JSON.stringify({ error: 'Invalid user ID or password.' }), {
  status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  try {
    const { userId, password } = await request.json()
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
      || typeof password !== 'string' || password.length < 1 || password.length > 256) return invalidLogin()

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(userId)
    const email = userResult.user?.email
    if (userError || !email) return invalidLogin()

    const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
    if (profileError || !profile || !['administrator', 'asha_worker'].includes(profile.role)) return invalidLogin()
    if (profile.role === 'asha_worker') {
      const { data: worker } = await admin.from('asha_workers').select('id').eq('profile_id', userId).eq('active', true).maybeSingle()
      if (!worker) return invalidLogin()
    }

    // Password verification is delegated to Supabase Auth, which returns the
    // same access/refresh tokens as the email sign-in flow. No email is exposed.
    const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await publicClient.auth.signInWithPassword({ email, password })
    if (authError || !authData.session) return invalidLogin()
    return new Response(JSON.stringify({ access_token: authData.session.access_token, refresh_token: authData.session.refresh_token }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return invalidLogin()
  }
})
