# RSS Viewer

A static in-browser RSS and Atom feed reader for the `/tools` directory.

## Features

* Paste any RSS or Atom feed URL into the page.
* Or paste raw RSS or Atom XML directly into the page (XML mode skips the proxy).
* Browse articles as cards with title, published date, and excerpt.
* Fall back to a clipped article body when the feed does not provide a dedicated excerpt.
* Open each article in a floating reading window.
* Show feed item content as provided by the feed without fetching the linked article page.
* Persist the current feed URL in the page query string with `?feed=...`.
* Use `?xml=1` to indicate XML mode; the XML itself is stored in localStorage.
* Keep the CORS header proxy URL out of the page URL.
* Optionally remember the CORS header proxy URL in localStorage on the current device.
* Fetch local feeds such as `localhost`, `127.0.0.1`, RFC1918 IPv4 addresses, `::1`, and `.local` directly in the browser.

## Notes

* The tool is fully static and runs in the browser.
* Public feed requests go through the CORS header proxy URL entered in the form.
* Local feed requests are fetched directly by the browser and still depend on browser security rules such as CORS.
* The CORS header proxy URL field is required for non-local feeds.
* In XML mode the proxy is not used. The pasted XML is kept in localStorage under `tools:rss-viewer:last-xml-feed` so it survives refreshes on the same device, but is not shareable across devices.
