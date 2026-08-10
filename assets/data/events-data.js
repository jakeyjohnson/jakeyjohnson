/* Party Padel event data — add a new city by adding an object to this
   array. Loaded as a plain <script> (not fetch) so pages work whether
   opened directly as a file or served from a real web host.

   Individual entry (adapted Americano format) — players sign up solo,
   not as pre-formed pairs. Partners rotate every round on the night.
   Two self-rated divisions: Beginners and Advanced (see skillMin/skillMax
   — self-rated 1.0-5.0 scale, boundary is a placeholder, adjust freely).

   PAYMENTS — ticketTailorCheckoutUrl
   The site has no form of its own any more — every "Enter" button goes
   straight to Ticket Tailor's hosted checkout, one click, no page in
   between. That means Ticket Tailor has to be the one collecting
   division and skill level, not us (Ticket Tailor Dashboard > Events >
   your event > Box Office — no code required):
     1. Create TWO ticket types, "Beginners Entry" and "Advanced Entry",
        each priced to match pricePlayer below EXACTLY (the division's
        own skillMin/skillMax stays informational, display-only copy —
        it's the ticket type itself that records which division someone
        bought into). pricePlayer here is just display copy — the amount
        actually charged is whatever those ticket types are priced at in
        Ticket Tailor. If you change one, change the other, or you'll
        show a price on-site that doesn't match what people are charged.
     2. Add a custom question at checkout: "Skill level (1.0–5.0,
        self-rated)" — free text or a number field, required. This is
        how skill level reaches us now instead of via our own form.
        Ticket Tailor already asks for a buyer name + email as part of
        any order, so there's no need to duplicate those as questions.
     3. In the event's checkout settings, set the post-checkout redirect
        URL to: https://YOURDOMAIN/enter-team.html?confirmed=1 — that
        page is a generic "you're in, check your email" landing screen
        now (Ticket Tailor's own confirmation email carries the actual
        order details), not a form.
     4. Copy that event's checkout/Box Office URL into
        ticketTailorCheckoutUrl below — one URL per event; Ticket
        Tailor's own page is where the buyer picks Beginners or
        Advanced as a ticket type.
   Leave ticketTailorCheckoutUrl empty until it's set up — every "Enter"
   button on the site falls back to a "Get Notified" mailto instead of
   sending people to a blank link. See README.md.

   pricePlayer is £32 per player, per event. */
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
    "pricePlayer": 32,
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
    "pricePlayer": 32,
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
    "pricePlayer": 32,
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
  }
];
