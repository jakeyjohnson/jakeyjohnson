The Great British Cheese Festival — WordPress theme
===================================================

INSTALLING
----------
1. In WordPress: Appearance -> Themes -> Add New -> Upload Theme
2. Choose gbcf-theme.zip, click Install Now, then Activate.

SETTING UP THE PAGES
--------------------
The design lives in page templates that attach themselves to pages by
slug, so all you do is create the pages with the right slugs.

1. Pages -> Add New, and create these five. The title can be anything;
   it is the slug (the bit in the URL) that matters:

       tickets     vendors     about     contact     privacy

   Leave the content empty — the template supplies everything.

2. Create one more page called Home, leave it empty, then go to
   Settings -> Reading and set "Your homepage displays" to
   "A static page", with Homepage = Home.

3. Settings -> Permalinks -> choose "Post name" and Save. (The menu
   links point at /tickets/, /about/ and so on, so this must be set.)

That's it. Every page renders with the full design.

BEFORE YOU LAUNCH
-----------------
Three things in this theme are placeholders:

* Ticket prices. £15 / £18 / £25 / £45 are invented. Real prices go in
  page-tickets.php and front-page.php (search for the £ sign).
* Checkout links. Every buy button is href="#" with a data-buy attribute
  naming the ticket. Replace each href with that ticket's checkout URL
  from Ticket Tailor / Eventbrite / Fixr. No card details ever touch
  this site — the visitor goes straight to the hosted checkout.
* The newsletter form. It validates in the browser and shows a success
  message, but stores nothing. Either paste your Mailchimp/Brevo form URL
  into the form's action attribute in front-page.php, or delete the
  <form> and drop your newsletter plugin's shortcode in its place.

Also still to add: the venue, once confirmed (search for "Announced
soon"), and assets/img/logo.png — until that file exists the header
falls back to the type-only lockup, with no broken image either way.

EDITING
-------
* Colours, type, spacing:  assets/css/tokens.css — every value the design
  uses lives there and nowhere else, so the whole site can be re-coloured
  from that one file.
* Copy:      the .php template for that page (front-page.php etc).
* Structure: header.php is the top of every page, footer.php the bottom.

A page you add in WordPress that has no template of its own still gets
the site chrome — it renders through page.php with the editor content
inside.
