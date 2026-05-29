/**
 * HCD Tools — Navbar Loader
 * Fetches navbar.html and injects it at the top of <body>.
 * Also marks the active nav link based on the current page.
 *
 * Usage (add to each tool's <head>, adjusting the path depth):
 *   <link rel="stylesheet" href="../shared/navbar.css" />
 *   <script src="../shared/navbar-loader.js" data-root="../"></script>
 *
 * For the homepage (html_tools/index.html) use:
 *   <link rel="stylesheet" href="shared/navbar.css" />
 *   <script src="shared/navbar-loader.js" data-root="./"></script>
 */
(function () {
  const script   = document.currentScript;
  const root     = (script && script.dataset.root) ? script.dataset.root : '../';
  const navUrl   = root + 'shared/navbar.html';

  // Determine which page we're on from the URL path
  function getActivePage() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('project charter') || path.includes('project%20charter')) return 'charter';
    if (path.includes('synthesiser') || path.includes('synthesizer'))           return 'synthesiser';
    if (path.includes('timeline'))                                               return 'timeline';
    if (path.includes('hcd'))                                                    return 'hcd';
    return 'home';
  }

  function injectNavbar(html) {
    // Rewrite relative hrefs inside the fetched snippet so they resolve
    // correctly from any subdirectory depth.
    const adjusted = html.replace(/href="\.\.\/index\.html"/g,
                                  'href="' + root + 'index.html"')
                         .replace(/href="\.\.\/Project Charter\/index\.html"/g,
                                  'href="' + root + 'project-charter/index.html"')
                         .replace(/href="\.\.\/Research Synthesiser\/index\.html"/g,
                                  'href="' + root + 'research-synthesiser/index.html"');

    const wrapper = document.createElement('div');
    wrapper.innerHTML = adjusted;
    const nav = wrapper.firstElementChild;

    // Mark active link
    const activePage = getActivePage();
    nav.querySelectorAll('[data-page]').forEach(function (a) {
      if (a.dataset.page === activePage) {
        a.classList.add('active');
      }
    });

    // Prevent navigation on "coming soon" links
    nav.querySelectorAll('.coming-soon').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); });
      a.style.cursor = 'default';
    });

    // Insert before first child of body
    document.body.insertBefore(nav, document.body.firstChild);
  }

  // Use fetch if available, otherwise XHR
  if (typeof fetch !== 'undefined') {
    fetch(navUrl)
      .then(function (r) { return r.text(); })
      .then(injectNavbar)
      .catch(function (err) { console.warn('HCD Navbar: could not load', navUrl, err); });
  } else {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', navUrl, true);
    xhr.onload = function () {
      if (xhr.status === 200) injectNavbar(xhr.responseText);
    };
    xhr.send();
  }
})();
