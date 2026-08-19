/* Americano-format fixtures & live scores — used by admin.html (to
   generate the schedule and enter scores) and results.html (to show
   the individual leaderboard). Party Padel plays Americano: players
   rotate partners every round, and standings are an individual points
   tally (each player's score is their pair's score, added up across
   every round they played), not a team win/loss table. */
(function(window){
  'use strict';

  function rowToPlayer(row){
    return { id: row.id, eventId: row.event_id, leagueName: row.league_name, name: row.name, sortOrder: row.sort_order };
  }

  function rowToFixture(row){
    return {
      id: row.id,
      eventId: row.event_id,
      leagueName: row.league_name,
      round: row.round_number,
      court: row.court_number,
      playerA1: row.player_a1,
      playerA2: row.player_a2,
      playerB1: row.player_b1,
      playerB2: row.player_b2,
      scoreA: row.score_a,
      scoreB: row.score_b,
      status: row.status
    };
  }

  function loadPlayers(eventId, leagueName){
    if (!window.PartyPadelDB) return Promise.resolve([]);
    return window.PartyPadelDB
      .from('players').select('*')
      .eq('event_id', eventId).eq('league_name', leagueName)
      .order('sort_order', { ascending: true })
      .then(function(res){
        if (res.error){ console.error('Party Padel: failed to load players —', res.error.message); return []; }
        return res.data.map(rowToPlayer);
      });
  }

  function loadFixtures(eventId, leagueName){
    if (!window.PartyPadelDB) return Promise.resolve([]);
    var query = window.PartyPadelDB.from('fixtures').select('*').eq('event_id', eventId);
    if (leagueName) query = query.eq('league_name', leagueName);
    return query
      .order('round_number', { ascending: true })
      .then(function(res){
        if (res.error){ console.error('Party Padel: failed to load fixtures —', res.error.message); return []; }
        return res.data.map(rowToFixture);
      });
  }

  /* Every player across every event — results.html needs this to turn
     the player ids on each fixture into names, without a round trip
     per event/league. */
  function loadAllPlayers(){
    if (!window.PartyPadelDB) return Promise.resolve([]);
    return window.PartyPadelDB.from('players').select('*').order('sort_order', { ascending: true })
      .then(function(res){
        if (res.error){ console.error('Party Padel: failed to load players —', res.error.message); return []; }
        return res.data.map(rowToPlayer);
      });
  }

  /* Every match across every event, for results.html's "which events
     currently have fixtures at all" pass — one round trip instead of
     one per event. */
  function loadAllFixtures(){
    if (!window.PartyPadelDB) return Promise.resolve([]);
    return window.PartyPadelDB.from('fixtures').select('*').order('round_number', { ascending: true })
      .then(function(res){
        if (res.error){ console.error('Party Padel: failed to load fixtures —', res.error.message); return []; }
        return res.data.map(rowToFixture);
      });
  }

  function subscribeFixtures(eventId, onChange){
    if (!window.PartyPadelDB || !window.PartyPadelDB.channel) return null;
    return window.PartyPadelDB
      .channel('fixtures-' + eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixtures', filter: 'event_id=eq.' + eventId }, onChange)
      .subscribe();
  }

  function subscribeAllFixtures(onChange){
    if (!window.PartyPadelDB || !window.PartyPadelDB.channel) return null;
    return window.PartyPadelDB
      .channel('fixtures-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixtures' }, onChange)
      .subscribe();
  }

  function shuffle(arr){
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function pairKey(id1, id2){ return id1 < id2 ? id1 + '|' + id2 : id2 + '|' + id1; }

  /* Of the 3 ways to split 4 players into two pairs, picks whichever
     repeats past partnerships/match-ups the least — greedy per court,
     not a globally optimal schedule (that's the "social golfer
     problem," NP-hard), but keeps a 50-player Americano feeling mixed
     up without needing a solver. */
  function bestPairing(four, partnerCounts, opponentCounts){
    var options = [
      [[four[0], four[1]], [four[2], four[3]]],
      [[four[0], four[2]], [four[1], four[3]]],
      [[four[0], four[3]], [four[1], four[2]]]
    ];
    var best = options[0], bestScore = Infinity;
    options.forEach(function(opt){
      var a = opt[0], b = opt[1];
      var score =
        (partnerCounts[pairKey(a[0].id, a[1].id)] || 0) * 2 +
        (partnerCounts[pairKey(b[0].id, b[1].id)] || 0) * 2 +
        (opponentCounts[pairKey(a[0].id, b[0].id)] || 0) +
        (opponentCounts[pairKey(a[0].id, b[1].id)] || 0) +
        (opponentCounts[pairKey(a[1].id, b[0].id)] || 0) +
        (opponentCounts[pairKey(a[1].id, b[1].id)] || 0);
      if (score < bestScore){ bestScore = score; best = opt; }
    });
    return best;
  }

  /* The scheduler. Takes a target games-per-player rather than a raw
     round count — "how many games does everyone get" is what an
     organiser actually plans around, not an abstract round number that
     means something different depending on how many courts there are.
     Works out how many rounds that needs from the court count, then
     every round gives priority for a court spot to whoever's played
     the fewest games so far — so across however many rounds that
     turns out to be, no player's game count is ever more than 1 ahead
     of any other's, regardless of how unevenly the player count
     divides into courts×4. Ties are broken by a fresh shuffle each
     round, which also keeps who-sits-out from being predictable.
     Returns plain objects ready to insert into "fixtures" (round_number,
     court_number, player_a1/a2/b1/b2) — no ids, no event/league, since
     the caller attaches those. */
  function generateSchedule(players, courts, gamesPerPlayer){
    var playersPerRound = Math.min(players.length, courts * 4);
    playersPerRound -= playersPerRound % 4;
    var courtsUsed = playersPerRound / 4;
    if (courtsUsed < 1) return [];

    var rounds = Math.max(1, Math.ceil((gamesPerPlayer * players.length) / playersPerRound));

    var gamesPlayed = {};
    players.forEach(function(p){ gamesPlayed[p.id] = 0; });
    var partnerCounts = {}, opponentCounts = {};
    var fixtures = [];

    for (var r = 1; r <= rounds; r++){
      var playing = shuffle(players).sort(function(a, b){ return gamesPlayed[a.id] - gamesPlayed[b.id]; }).slice(0, playersPerRound);
      for (var c = 0; c < courtsUsed; c++){
        var four = playing.slice(c * 4, c * 4 + 4);
        var pairing = bestPairing(four, partnerCounts, opponentCounts);
        var a = pairing[0], b = pairing[1];
        fixtures.push({
          round_number: r, court_number: c + 1,
          player_a1: a[0].id, player_a2: a[1].id,
          player_b1: b[0].id, player_b2: b[1].id
        });
        partnerCounts[pairKey(a[0].id, a[1].id)] = (partnerCounts[pairKey(a[0].id, a[1].id)] || 0) + 1;
        partnerCounts[pairKey(b[0].id, b[1].id)] = (partnerCounts[pairKey(b[0].id, b[1].id)] || 0) + 1;
        [[a[0], b[0]], [a[0], b[1]], [a[1], b[0]], [a[1], b[1]]].forEach(function(pair){
          var k = pairKey(pair[0].id, pair[1].id);
          opponentCounts[k] = (opponentCounts[k] || 0) + 1;
        });
        [a[0], a[1], b[0], b[1]].forEach(function(p){ gamesPlayed[p.id]++; });
      }
    }
    return fixtures;
  }

  /* Individual leaderboard: each player's score is their pair's score
     in every round they played, added up — the actual Americano
     scoring rule ("they will just tally the points they score"), not
     a win/loss table. Only fixtures with both scores entered count. */
  function computeIndividualStandings(players, fixtures){
    var stats = {};
    players.forEach(function(p){ stats[p.id] = { id: p.id, name: p.name, played: 0, points: 0 }; });
    fixtures.forEach(function(f){
      if (f.scoreA == null || f.scoreB == null) return;
      [f.playerA1, f.playerA2].forEach(function(id){ if (stats[id]){ stats[id].played++; stats[id].points += f.scoreA; } });
      [f.playerB1, f.playerB2].forEach(function(id){ if (stats[id]){ stats[id].played++; stats[id].points += f.scoreB; } });
    });
    return Object.keys(stats).map(function(id){ return stats[id]; }).sort(function(x, y){
      if (y.points !== x.points) return y.points - x.points;
      return x.name.localeCompare(y.name);
    });
  }

  function leagueNamesIn(rows){
    var seen = [], names = [];
    rows.forEach(function(r){
      if (seen.indexOf(r.leagueName) === -1){ seen.push(r.leagueName); names.push(r.leagueName); }
    });
    return names;
  }

  var api = {
    loadPlayers: loadPlayers,
    loadAllPlayers: loadAllPlayers,
    loadFixtures: loadFixtures,
    loadAllFixtures: loadAllFixtures,
    subscribeFixtures: subscribeFixtures,
    subscribeAllFixtures: subscribeAllFixtures,
    generateSchedule: generateSchedule,
    computeIndividualStandings: computeIndividualStandings,
    leagueNamesIn: leagueNamesIn
  };

  window.PartyPadelFixtures = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : global);
