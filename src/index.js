// The page's entry: a poster (store art, `?poster=<name>`) or the game.
const poster = new URLSearchParams(location.search).get('poster');
if (poster) import('./poster.js').then((m) => m.renderPoster(poster));
else import('./main.js');
