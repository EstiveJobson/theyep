import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyPendingSchool, type PendingSchoolResult } from "@/lib/pending-school";
import {
  PENDING_NOTICE_COOKIE,
  PENDING_RETRY_COOKIE,
  pendingRetryActive,
  pendingRetryCookie,
} from "@/lib/pending-school-plan";
import { supabasePublicEnv } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey, configured } = supabasePublicEnv();
  if (!configured) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const retryUntil = request.cookies.get(PENDING_RETRY_COOKIE)?.value;
    if (!pendingRetryActive(retryUntil)) {
      let result: PendingSchoolResult = "retry";
      try {
        result = await applyPendingSchool(supabase, data.user);
      } catch (error) {
        console.error("pending school", error);
        result = "retry";
      }

      if (result === "retry") {
        const cookie = pendingRetryCookie();
        response.cookies.set(PENDING_RETRY_COOKIE, cookie.value, {
          maxAge: cookie.maxAge,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: process.env.NODE_ENV === "production",
        });
      } else if (retryUntil) {
        response.cookies.set(PENDING_RETRY_COOKIE, "", {
          maxAge: 0,
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
      }

      if (result === "inactive") {
        response.cookies.set(PENDING_NOTICE_COOKIE, "1", {
          maxAge: 600,
          sameSite: "lax",
          path: "/",
        });
      }
    }
  }
  return response;
}
