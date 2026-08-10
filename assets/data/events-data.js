// Flair Entertainment — public events data.
// Empty by design: no fabricated events. Add real, confirmed public
// events here as they're booked; events.html reads this array and
// renders an honest "no events currently listed" state when it's empty.
//
// Shape:
// {
//   title: 'Event name',
//   date: '2026-12-31',          // ISO date, used for sorting + display
//   venue: 'Venue name, St Helier',
//   summary: 'One-line description of what\'s on.',
//   ticketUrl: ''                // leave '' until a real ticket link exists
// }
window.FLAIR_EVENTS = [];
