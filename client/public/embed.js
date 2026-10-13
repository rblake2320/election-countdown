// Embeddable countdown (served at /embed.html). Plain script: the site CSP is script-src 'self'.
//
// Dates and the Eastern-time rules are copied from client/src/lib/elections.ts (this page cannot
// import it). tests/e2e/embed.mjs asserts the dates below equal the ones in elections.ts.
(function () {
  "use strict";

  var ELECTIONS = [
    { id: "midterm-2026", title: "2026 Midterm Elections", start: "2026-11-03T00:00:00", end: "2026-11-04T01:00:00" },
    { id: "presidential-2028", title: "2028 Presidential Election", start: "2028-11-07T00:00:00", end: "2028-11-08T01:00:00" }
  ];

  // Same as parseAsEastern in elections.ts: "YYYY-MM-DDTHH:mm:ss" is US Eastern wall-clock time.
  function parseAsEastern(dateStr) {
    try {
      var asUtc = new Date(dateStr + "Z");
      var formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" });
      var parts = formatter.formatToParts(asUtc);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type !== "timeZoneName") continue;
        var m = /GMT([+-]\d+)/.exec(parts[i].value);
        if (m) return new Date(asUtc.getTime() - parseInt(m[1], 10) * 3600 * 1000);
      }
    } catch (e) {
      // fall through
    }
    return new Date(dateStr);
  }

  function phase(election, now) {
    if (now < parseAsEastern(election.start)) return "upcoming";
    if (now < parseAsEastern(election.end)) return "today";
    return "past";
  }

  // The requested election, or the first one not yet past; a past request falls through to
  // the next election. If everything is past, the last election is shown (never an empty widget).
  function pick(requestedId, now) {
    var i;
    if (requestedId) {
      for (i = 0; i < ELECTIONS.length; i++) {
        if (ELECTIONS[i].id === requestedId && phase(ELECTIONS[i], now) !== "past") return ELECTIONS[i];
      }
    }
    for (i = 0; i < ELECTIONS.length; i++) {
      if (phase(ELECTIONS[i], now) !== "past") return ELECTIONS[i];
    }
    return ELECTIONS[ELECTIONS.length - 1];
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get("theme") === "dark") document.documentElement.setAttribute("data-theme", "dark");
  var requested = params.get("election");

  var el = {
    widget: document.getElementById("widget"),
    title: document.getElementById("title"),
    days: document.getElementById("days"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds")
  };

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function render() {
    var now = new Date();
    var election = pick(requested, now);
    el.title.textContent = election.title;
    if (phase(election, now) === "today") {
      el.widget.classList.add("is-today");
      return;
    }
    el.widget.classList.remove("is-today");
    var ms = Math.max(0, parseAsEastern(election.start).getTime() - now.getTime());
    var total = Math.floor(ms / 1000);
    el.days.textContent = String(Math.floor(total / 86400));
    el.hours.textContent = pad(Math.floor((total % 86400) / 3600));
    el.minutes.textContent = pad(Math.floor((total % 3600) / 60));
    el.seconds.textContent = pad(total % 60);
  }

  render();
  setInterval(render, 250);
})();
