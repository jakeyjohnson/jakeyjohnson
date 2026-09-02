/* Single shared Supabase client, built from supabase-config.js. Load
   order matters: the supabase-js CDN script, then supabase-config.js,
   then this file, then anything that uses window.QuizDB (quiz-
   realtime.js, each page's own inline script). */
(function(window){
  'use strict';

  var cfg = window.QUIZ_SUPABASE_CONFIG;
  var lib = window.supabase; // the supabase-js UMD build's global

  if (!lib || !cfg || !cfg.url || cfg.url.indexOf('YOUR-PROJECT-REF') !== -1){
    console.warn('Live Quiz: Supabase isn\'t configured yet (quiz/assets/js/supabase-config.js still has placeholder values) — nothing will load until it is. See quiz/README.md.');
    window.QuizDB = null;
    return;
  }

  window.QuizDB = lib.createClient(cfg.url, cfg.anonKey);

})(window);
