/* Shared fixtures/live-scores helpers — used by admin.html (to enter
   scores) and results.html (to display them). Mirrors the pattern in
   events.js: a thin mapper over the Supabase "fixtures" table plus a
   couple of pure functions any consumer can reuse. */
(function(window){
  'use strict';

  function rowToFixture(row){
    return {
      id: row.id,
      eventId: row.event_id,
      leagueName: row.league_name,
      teamA: row.team_a,
      teamB: row.team_b,
      scoreA: row.score_a,
      scoreB: row.score_b,
      status: row.status,
      sortOrder: row.sort_order
    };
  }

  function loadFixtures(eventId){
    if (!window.PartyPadelDB) return Promise.resolve([]);
    return window.PartyPadelDB
      .from('fixtures')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .then(function(res){
        if (res.error){
          console.error('Party Padel: failed to load fixtures —', res.error.message);
          return [];
        }
        return res.data.map(rowToFixture);
      });
  }

  /* Every match ever scored across every event, newest event first —
     what results.html needs to build one live-standings block per
     event without a separate round trip per event. */
  function loadAllFixtures(){
    if (!window.PartyPadelDB) return Promise.resolve([]);
    return window.PartyPadelDB
      .from('fixtures')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(function(res){
        if (res.error){
          console.error('Party Padel: failed to load fixtures —', res.error.message);
          return [];
        }
        return res.data.map(rowToFixture);
      });
  }

  /* Subscribes to live changes on the fixtures table for one event.
     Best-effort: if realtime isn't reachable (network policy, or the
     project hasn't got the table added to its publication yet) this
     just never fires and the page still shows whatever it loaded on
     open — it degrades to "refresh to see updates", not a crash. */
  function subscribeFixtures(eventId, onChange){
    if (!window.PartyPadelDB || !window.PartyPadelDB.channel) return null;
    var channel = window.PartyPadelDB
      .channel('fixtures-' + eventId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'fixtures', filter: 'event_id=eq.' + eventId
      }, onChange)
      .subscribe();
    return channel;
  }

  /* Same as subscribeFixtures but across every event — what results.html
     needs, since several events' fixtures can be live at once and it
     shows all of them on one page. */
  function subscribeAllFixtures(onChange){
    if (!window.PartyPadelDB || !window.PartyPadelDB.channel) return null;
    var channel = window.PartyPadelDB
      .channel('fixtures-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixtures' }, onChange)
      .subscribe();
    return channel;
  }

  /* Win = 3pts, draw = 1pt, loss = 0 — standard round-robin scoring.
     Only matches with both scores entered count; a fixture that's
     merely scheduled shouldn't show as a 0-0 draw. Sorted by points,
     then game difference, then games scored, then name — so the table
     never looks arbitrarily ordered while everything's still tied
     early in an event. */
  function computeStandings(fixtures, leagueName){
    var teams = {};
    function team(name){
      if (!teams[name]) teams[name] = { name: name, played: 0, won: 0, drawn: 0, lost: 0, scoredFor: 0, scoredAgainst: 0, points: 0 };
      return teams[name];
    }

    fixtures
      .filter(function(f){ return f.leagueName === leagueName && f.scoreA != null && f.scoreB != null; })
      .forEach(function(f){
        var a = team(f.teamA), b = team(f.teamB);
        a.played++; b.played++;
        a.scoredFor += f.scoreA; a.scoredAgainst += f.scoreB;
        b.scoredFor += f.scoreB; b.scoredAgainst += f.scoreA;
        if (f.scoreA > f.scoreB){ a.won++; a.points += 3; b.lost++; }
        else if (f.scoreB > f.scoreA){ b.won++; b.points += 3; a.lost++; }
        else { a.drawn++; b.drawn++; a.points += 1; b.points += 1; }
      });

    return Object.keys(teams).map(function(name){ return teams[name]; }).sort(function(x, y){
      if (y.points !== x.points) return y.points - x.points;
      var xDiff = x.scoredFor - x.scoredAgainst, yDiff = y.scoredFor - y.scoredAgainst;
      if (yDiff !== xDiff) return yDiff - xDiff;
      if (y.scoredFor !== x.scoredFor) return y.scoredFor - x.scoredFor;
      return x.name.localeCompare(y.name);
    });
  }

  /* Distinct league names in fixture order of first appearance, so a
     league tab list stays stable instead of re-sorting itself as
     scores come in. */
  function leagueNamesIn(fixtures){
    var seen = [], names = [];
    fixtures.forEach(function(f){
      if (seen.indexOf(f.leagueName) === -1){ seen.push(f.leagueName); names.push(f.leagueName); }
    });
    return names;
  }

  window.PartyPadelFixtures = {
    loadFixtures: loadFixtures,
    loadAllFixtures: loadAllFixtures,
    subscribeFixtures: subscribeFixtures,
    subscribeAllFixtures: subscribeAllFixtures,
    computeStandings: computeStandings,
    leagueNamesIn: leagueNamesIn
  };

})(window);
