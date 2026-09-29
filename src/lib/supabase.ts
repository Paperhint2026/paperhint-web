import { createClient } from "@supabase/supabase-js"

/**
 * Supabase JS client — used ONLY for OAuth handshake (Google/Microsoft)
 * and the confirmation-link token extraction on /confirm. Ordinary session
 * auth lives in the server's HttpOnly cookies (api-client.ts). The PKCE
 * flow needs localStorage for its code_verifier, so persistSession is on;
 * the callback pages delete the sb-* localStorage keys right after trading
 * the tokens for our cookies (never auth.signOut() — even scope "local"
 * revokes the session server-side), so nothing lingers past the handshake.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — OAuth signup and email confirmation won't work locally."
  )
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
  auth: {
    // PKCE needs localStorage for its code_verifier; the callback pages
    // signOut() right after grabbing tokens, so this doesn't linger.
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: false, // we exchange the ?code= ourselves in the callback pages
    flowType: "pkce",
  },
})
