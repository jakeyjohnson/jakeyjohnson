/* Single shared Supabase client, built from supabase-config.js. Load
   order matters: the supabase-js CDN script, then supabase-config.js,
   then this file, then anything that uses window.PartyPadelDB
   (events.js, admin.html's own inline script). */
(function(window){
  'use strict';

  var cfg = window.PARTY_PADEL_SUPABASE_CONFIG;
  var lib = window.supabase; // the supabase-js UMD build's global

  if (!lib || !cfg || !cfg.url || cfg.url.indexOf('YOUR-PROJECT-REF') !== -1){
    console.warn('Party Padel: Supabase isn\'t configured yet (assets/js/supabase-config.js still has placeholder values) — events won\'t load until it is. See README.md.');
    window.PartyPadelDB = null;
    return;
  }

  window.PartyPadelDB = lib.createClient(cfg.url, cfg.anonKey);

})(window);
