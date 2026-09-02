/* Fill these in after creating a NEW Supabase project for the quiz
   app — see quiz/supabase/schema.sql and quiz/README.md. This is a
   separate project from the one used by the Party Padel site at the
   repo root (assets/js/supabase-config.js) — quiz data is kept fully
   isolated from padel data.

   Both values live in Supabase Dashboard > Project Settings > API.
   The anon key is meant to be public (it ships in every browser that
   loads this app) — real access control is the row-level security
   policies in schema.sql, not secrecy of this key. Do NOT put the
   "service_role" key here; that one bypasses RLS entirely and must
   never reach a browser. */
window.QUIZ_SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  anonKey: 'YOUR-ANON-KEY'
};
