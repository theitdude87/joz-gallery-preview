# Joz Gallery for Home: storefront preview

Static preview of the new storefront, built from the Laravel store
(github.com/Alsaadi-Hussein/joz-gallery, branch `claude/port-preview-design`) with demo data.
Arabic (RTL) by default, with English under `/en`.

Live: https://theitdude87.github.io/joz-gallery-preview/

The store's server parts are replaced in the browser by `static-preview.js`: the cart,
delivery fees and coupon are worked out from the demo catalog, search runs on it, and the
order is sent on WhatsApp. Filters and sorting need the server and are hidden here.
