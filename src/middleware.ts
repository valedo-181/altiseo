import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl } from "@/lib/supabase/url";

/** Rafraîchit la session Supabase à chaque requête (sans effet en mode démo). */
export async function middleware(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl()!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = { matcher: ["/app/:path*", "/onboarding/:path*", "/auth/:path*"] };
