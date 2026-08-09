/* Party Padel event data — add a new city by adding an object to this
   array. Loaded as a plain <script> (not fetch) so pages work whether
   opened directly as a file or served from a real web host.

   Individual entry (adapted Americano format) — players sign up solo,
   not as pre-formed pairs. Partners rotate every round on the night.
   Two self-rated divisions: Beginners and Advanced (see skillMin/skillMax
   — self-rated 1.0-5.0 scale, boundary is a placeholder, adjust freely).

   PAYMENTS — ticketTailorCheckoutUrl
   Each event needs its own Ticket Tailor checkout URL (Ticket Tailor
   Dashboard > Events > your event > Box Office — no code required):
     1. Create a "Player Entry" ticket type priced to match pricePlayer
        below EXACTLY. pricePlayer here is just display copy — the amount
        actually charged is whatever that ticket type is priced at in
        Ticket Tailor. If you change one, change the other, or you'll
        show a price on-site that doesn't match what people are charged.
     2. Don't duplicate name/skill-level questions as Ticket Tailor
        "custom questions" — our own form already collects those. Ticket
        Tailor still needs a buyer name + email for the order itself.
     3. In the event's checkout settings, set the post-checkout redirect
        URL to: https://YOURDOMAIN/enter-team.html?confirmed=1
     4. Copy that event's checkout/Box Office URL into
        ticketTailorCheckoutUrl below.
   Leave ticketTailorCheckoutUrl empty until it's set up — the
   registration form shows a friendly "payments not yet open" message
   instead of sending people to a broken link. See README.md.

   pricePlayer is still 60, carried over unchanged from when this was a
   per-team price — now that entry is per person rather than per pair,
   decide whether that number should actually change before launch. */
window.PARTY_PADEL_EVENTS = [
  {
    "slug": "london-2026-09-14",
    "city": "London",
    "date": "2026-09-14",
    "dateLabel": "14 September 2026",
    "time": "18:00",
    "venue": "Shoreditch Padel Club",
    "address": "Shoreditch, London",
    "status": "entries-open",
    "playersEntered": 68,
    "playersCapacity": 100,
    "pricePlayer": 60,
    "priceSpectator": 15,
    "ticketTailorCheckoutUrl": "",
    "divisions": [
      {
        "name": "Beginners",
        "skillMin": 1.0,
        "skillMax": 2.5,
        "spacesLeft": 18
      },
      {
        "name": "Advanced",
        "skillMin": 3.0,
        "skillMax": 5.0,
        "spacesLeft": 14
      }
    ],
    "schedule": [
      {
        "time": "18:00",
        "label": "Check-in & warm-up"
      },
      {
        "time": "19:00",
        "label": "Rotating rounds begin"
      },
      {
        "time": "21:30",
        "label": "Finals — feature court"
      },
      {
        "time": "22:30",
        "label": "Presentation & afterparty"
      }
    ]
  },
  {
    "slug": "manchester-2026-09-27",
    "city": "Manchester",
    "date": "2026-09-27",
    "dateLabel": "27 September 2026",
    "time": "18:30",
    "venue": "Padel House",
    "address": "Manchester City Centre",
    "status": "limited",
    "playersEntered": 92,
    "playersCapacity": 100,
    "pricePlayer": 60,
    "priceSpectator": 15,
    "ticketTailorCheckoutUrl": "",
    "divisions": [
      {
        "name": "Beginners",
        "skillMin": 1.0,
        "skillMax": 2.5,
        "spacesLeft": 5
      },
      {
        "name": "Advanced",
        "skillMin": 3.0,
        "skillMax": 5.0,
        "spacesLeft": 3
      }
    ],
    "schedule": [
      {
        "time": "18:30",
        "label": "Check-in & warm-up"
      },
      {
        "time": "19:30",
        "label": "Rotating rounds begin"
      },
      {
        "time": "22:00",
        "label": "Finals — feature court"
      },
      {
        "time": "23:00",
        "label": "Presentation & afterparty"
      }
    ]
  },
  {
    "slug": "bristol-2026-10-11",
    "city": "Bristol",
    "date": "2026-10-11",
    "dateLabel": "11 October 2026",
    "time": "17:00",
    "venue": "Harbourside Courts",
    "address": "Harbourside, Bristol",
    "status": "coming-soon",
    "playersEntered": 0,
    "playersCapacity": 100,
    "pricePlayer": 60,
    "priceSpectator": 15,
    "ticketTailorCheckoutUrl": "",
    "divisions": [
      {
        "name": "Beginners",
        "skillMin": 1.0,
        "skillMax": 2.5,
        "spacesLeft": 50
      },
      {
        "name": "Advanced",
        "skillMin": 3.0,
        "skillMax": 5.0,
        "spacesLeft": 50
      }
    ],
    "schedule": [
      {
        "time": "17:00",
        "label": "Check-in & warm-up"
      },
      {
        "time": "18:00",
        "label": "Rotating rounds begin"
      },
      {
        "time": "20:30",
        "label": "Finals — feature court"
      },
      {
        "time": "21:30",
        "label": "Presentation & afterparty"
      }
    ]
  },
  {
    "slug": "demo-event",
    "city": "Demo City (TEST — remove before launch)",
    "date": "2026-12-31",
    "dateLabel": "31 December 2026",
    "time": "19:00",
    "venue": "Test Venue",
    "address": "For checking the sign-up flow only",
    "status": "entries-open",
    "playersEntered": 10,
    "playersCapacity": 100,
    "pricePlayer": 60,
    "priceSpectator": 15,
    "ticketTailorCheckoutUrl": "",
    "divisions": [
      {
        "name": "Beginners",
        "skillMin": 1.0,
        "skillMax": 2.5,
        "spacesLeft": 45
      },
      {
        "name": "Advanced",
        "skillMin": 3.0,
        "skillMax": 5.0,
        "spacesLeft": 45
      }
    ],
    "schedule": [
      {
        "time": "19:00",
        "label": "Check-in & warm-up"
      },
      {
        "time": "20:00",
        "label": "Rotating rounds begin"
      },
      {
        "time": "22:00",
        "label": "Finals — feature court"
      },
      {
        "time": "23:00",
        "label": "Presentation & afterparty"
      }
    ]
  }
];
