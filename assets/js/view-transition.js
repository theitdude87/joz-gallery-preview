/* Section pages slide in the direction the visitor moved: the previous page
   saved "forward" or "backward", and this tags the page's view transition with it.
   Loaded as a plain blocking script in <head> so it runs before the first render. */
addEventListener('pagereveal', function (e) {
  var d;
  try { d = sessionStorage.getItem('joz_vt'); sessionStorage.removeItem('joz_vt'); } catch (x) { /* ignore */ }
  if (e.viewTransition && d) e.viewTransition.types.add(d);
});
