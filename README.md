# Joz Gallery for Home: design preview

Static preview of the storefront design for **Joz Gallery for Home (جوز كاليري)**.
Arabic (RTL) by default, with an English switch on every page.

Live: https://theitdude87.github.io/joz-gallery-preview/

Pages:
- `index.html`: welcome page with a background video, "Enter the store" and the contact links
- `shop.html`: store home (sections, offers, best sellers, new in, Instagram/WhatsApp)
- `section-*.html`: one page per section. Swipe sideways on a phone to move to the next or previous section.

The background video is a placeholder made from the brand photos, and the product and room photos are demo images from Unsplash. They will be replaced with the store's own video and photos.
This repository holds the generated preview only. It is built with `php tools/build-preview.php --site=...` from the main project.
