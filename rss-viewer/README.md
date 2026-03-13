# RSS Viewer

A static in-browser RSS and Atom feed reader for the `/tools` directory.

## Features

* Paste any RSS or Atom feed URL into the page.
* Browse articles as cards with title, published date, and excerpt.
* Fall back to a clipped article body when the feed does not provide a dedicated excerpt.
* Open each article in a floating reading window.
* Show feed item content as provided by the feed without fetching the linked article page.
* Persist the current feed URL and proxy URL in the page query string with `?feed=...&proxy=...`.
* Fetch local feeds such as `localhost`, `127.0.0.1`, RFC1918 IPv4 addresses, `::1`, and `.local` directly in the browser.

## Notes

* The tool is fully static and runs in the browser.
* Public feed requests go through the CORS header proxy URL entered in the form.
* Local feed requests are fetched directly by the browser and still depend on browser security rules such as CORS.
* The CORS header proxy URL field is required before loading a feed.
