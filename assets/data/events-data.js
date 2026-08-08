/* Party Padel event data — add a new city by adding an object to this
   array. Loaded as a plain <script> (not fetch) so pages work whether
   opened directly as a file or served from a real web host.

   PAYMENTS — ticketTailorCheckoutUrl
   Each event needs its own Ticket Tailor checkout URL (Ticket Tailor
   Dashboard > Events > your event > Box Office — no code required):
     1. Create a "Team Entry" ticket type priced to match priceTeam below
        EXACTLY. priceTeam here is just display copy — the amount actually
        charged is whatever that ticket type is priced at in Ticket
        Tailor. If you change one, change the other, or you'll show a
        price on-site that doesn't match what people are charged.
     2. Don't duplicate team/player name questions as Ticket Tailor
        "custom questions" — our own form already collects those. Ticket
        Tailor still needs a buyer name + email for the order itself.
     3. In the event's checkout settings, set the post-checkout redirect
        URL to: https://YOURDOMAIN/enter-team.html?confirmed=1
     4. Copy that event's checkout/Box Office URL into
        ticketTailorCheckoutUrl below.
   Leave ticketTailorCheckoutUrl empty until it's set up — the
   registration form shows a friendly "payments not yet open" message
   instead of sending people to a broken link. See README.md. */
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
    "teamsEntered": 32,
    "teamsCapacity": 50,
    "priceTeam": 60,
    "priceSpectator": 15,
    "ticketTailorCheckoutUrl": "",
    "divisions": [
      {
        "name": "Men's",
        "spacesLeft": 6
      },
      {
        "name": "Women's",
        "spacesLeft": 4
      },
      {
        "name": "Mixed",
        "spacesLeft": 8
      }
    ],
    "schedule": [
      {
        "time": "18:00",
        "label": "Check-in & warm-up"
      },
      {
        "time": "19:00",
        "label": "Group fixtures begin"
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
    "teamsEntered": 46,
    "teamsCapacity": 50,
    "priceTeam": 60,
    "priceSpectator": 15,
    "ticketTailorCheckoutUrl": "",
    "divisions": [
      {
        "name": "Men's",
        "spacesLeft": 1
      },
      {
        "name": "Women's",
        "spacesLeft": 0
      },
      {
        "name": "Mixed",
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
        "label": "Group fixtures begin"
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
    "teamsEntered": 0,
    "teamsCapacity": 50,
    "priceTeam": 60,
    "priceSpectator": 15,
    "ticketTailorCheckoutUrl": "",
    "divisions": [
      {
        "name": "Men's",
        "spacesLeft": 25
      },
      {
        "name": "Women's",
        "spacesLeft": 25
      },
      {
        "name": "Mixed",
        "spacesLeft": 25
      }
    ],
    "schedule": [
      {
        "time": "17:00",
        "label": "Check-in & warm-up"
      },
      {
        "time": "18:00",
        "label": "Group fixtures begin"
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
    "teamsEntered": 5,
    "teamsCapacity": 50,
    "priceTeam": 60,
    "priceSpectator": 15,
    "ticketTailorCheckoutUrl": "",
    "divisions": [
      {
        "name": "Men's",
        "spacesLeft": 20
      },
      {
        "name": "Women's",
        "spacesLeft": 20
      },
      {
        "name": "Mixed",
        "spacesLeft": 20
      }
    ],
    "schedule": [
      {
        "time": "19:00",
        "label": "Check-in & warm-up"
      },
      {
        "time": "20:00",
        "label": "Group fixtures begin"
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
