/* Supabase Realtime subscription helpers — same shape as the Party
   Padel site's assets/js/fixtures.js:85-99 (channel + postgres_changes
   + .subscribe()). No reconnect/status handling here either, by the
   same design as that file: if the realtime feed can't be reached,
   pages just don't update live and a manual reload shows the latest
   (every page already loads its state once on open regardless of the
   subscription). */
(function(window){
  'use strict';

  function subscribeSession(sessionId, onChange){
    if (!window.QuizDB || !window.QuizDB.channel) return null;
    return window.QuizDB
      .channel('quiz-session-' + sessionId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'quiz_sessions', filter: 'id=eq.' + sessionId
      }, onChange)
      .subscribe();
  }

  function subscribePlayers(sessionId, onChange){
    if (!window.QuizDB || !window.QuizDB.channel) return null;
    return window.QuizDB
      .channel('quiz-players-' + sessionId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'quiz_players', filter: 'session_id=eq.' + sessionId
      }, onChange)
      .subscribe();
  }

  function unsubscribe(channel){
    if (channel && window.QuizDB) window.QuizDB.removeChannel(channel);
  }

  window.QuizRealtime = {
    subscribeSession: subscribeSession,
    subscribePlayers: subscribePlayers,
    unsubscribe: unsubscribe
  };

})(window);
