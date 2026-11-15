// Lets the app install and open offline: see https://github.com/petravanta/general/blob/main/STANDARDS.md#installing-on-a-phone
// Each recipe file is cached the first time the app loads it online (the shared worker keeps same-origin files).
self.APP_SHELL = ['./', 'mix.js', 'manifest.webmanifest', 'icon-192.png', 'icon.svg',
  'data/ingredients.json', 'data/glasses.json', 'data/recipes.json'];
importScripts('https://petravanta.github.io/general/shared/app-sw.js');
