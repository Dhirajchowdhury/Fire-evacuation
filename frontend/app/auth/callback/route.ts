import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Exchange OAuth code for session
  const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeErr) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/?error=no_user`);
  }

  // Check existing profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, workspace_id')
    .eq('id', user.id)
    .maybeSingle();

  // New Google user — create admin profile
  if (!profile) {
    await supabase.from('profiles').insert({
      id: user.id,
      role: 'admin',
      full_name: user.user_metadata?.full_name
        ?? user.user_metadata?.name
        ?? user.email?.split('@')[0]
        ?? 'Admin',
    });
    return NextResponse.redirect(`${origin}/dashboard/admin/setup`);
  }

  // Existing profile — enforce admin role
  if (profile.role !== 'admin') {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=access_denied`);
  }

  // Admin with no workspace → setup
  if (!profile.workspace_id) {
    return NextResponse.redirect(`${origin}/dashboard/admin/setup`);
  }

  return NextResponse.redirect(`${origin}/dashboard/admin`);
}
