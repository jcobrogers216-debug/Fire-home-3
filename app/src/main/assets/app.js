/* FireHome launcher UI. Plain JavaScript, no libraries, so it stays light on a 1.5 GB Fire Stick. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ config + helpers */
  var CFG = { name: '', units: 'fahrenheit', hour12: true, city: null, lat: null, lon: null };
  var user = window.FH_CONFIG || {};
  for (var key in user) { if (user.hasOwnProperty(key)) CFG[key] = user[key]; }

  var hasNative = typeof window.Android !== 'undefined';
  var REM = function () { return window.innerWidth / 96; };

  function $(id) { return document.getElementById(id); }
  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function toArray(list) { return Array.prototype.slice.call(list); }
  function indexOf(arr, v) { return arr.indexOf(v); }

  /* ------------------------------------------------------------------ saved settings */
  var PKEY = 'fh.prefs.v1';
  var prefs = { favs: null, hidden: [], bg: 'neon', anim: true, showHidden: false };
  function loadPrefs() {
    try {
      var s = localStorage.getItem(PKEY);
      if (s) { var o = JSON.parse(s); for (var k in o) { if (o.hasOwnProperty(k)) prefs[k] = o[k]; } }
    } catch (e) { /* storage can be unavailable; just run with defaults */ }
  }
  function savePrefs() {
    try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ apps */
  var DEMO = [
    ['com.amazon.firetv.youtube', 'YouTube', '#e02a2a'], ['com.netflix.ninja', 'Netflix', '#c40f1c'],
    ['com.amazon.avod', 'Prime Video', '#1a98ff'], ['tv.twitch.android.viewer', 'Twitch', '#8a4bff'],
    ['org.xbmc.kodi', 'Kodi', '#1a9fd6'], ['com.disney.disneyplus', 'Disney+', '#1b3e9e'],
    ['com.hulu.plus', 'Hulu', '#19b873'], ['com.spotify.tv.android', 'Spotify', '#1ed760'],
    ['com.plexapp.android', 'Plex', '#e5a00d'], ['com.amazon.venezia', 'Appstore', '#ff9900'],
    ['com.esaba.downloader', 'Downloader', '#2b8cff'], ['com.amazon.avl.ftv', 'Live TV', '#2a2a8a'],
    ['com.espn.tv', 'ESPN', '#d00000'], ['com.paramount', 'Paramount+', '#0064ff'],
    ['com.max.tv', 'Max', '#5b2bd6'], ['com.peacock', 'Peacock', '#222'],
    ['com.files', 'Files', '#3a7bd5'], ['com.ufc', 'UFC', '#c8102e'],
    ['com.silk', 'Silk Browser', '#4a4a8a'], ['com.settings', 'Settings', '#555a78'],
    ['com.photos', 'Photos', '#d9468f'], ['com.music', 'Music', '#f03e6e'],
    ['com.weather', 'Weather', '#3aa0ff'], ['com.games', 'Games', '#1fa56a']
  ];
  var PREFERRED = [
    'com.amazon.firetv.youtube', 'com.netflix.ninja', 'com.amazon.firebat', 'com.amazon.avod',
    'com.amazon.avod.thirdpartyclient', 'tv.twitch.android.viewer', 'org.xbmc.kodi', 'com.disney.disneyplus',
    'com.hulu.plus', 'com.spotify.tv.android', 'com.plexapp.android', 'com.google.android.youtube.tv'
  ];

  var apps = [], byPkg = {};

  function demoSvg(pkg, label, wide) {
    var color = '#4a56c8', i;
    for (i = 0; i < DEMO.length; i++) { if (DEMO[i][0] === pkg) color = DEMO[i][2]; }
    var w = wide ? 320 : 128, h = wide ? 180 : 128;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<rect width="' + w + '" height="' + h + '" rx="' + (wide ? 0 : 28) + '" fill="' + color + '"/>' +
      '<text x="' + (w / 2) + '" y="' + (h / 2 + (wide ? 14 : 16)) + '" font-family="Arial" font-weight="700" font-size="' + (wide ? 44 : 46) + '" fill="#fff" text-anchor="middle">' +
      (wide ? label.replace('&', '&amp;') : label.charAt(0)) + '</text></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  function iconUrl(a) { return hasNative ? '/icon/' + a.p : demoSvg(a.p, a.n, false); }
  function bannerUrl(a) {
    if (hasNative) return '/banner/' + a.p;
    return (a.n.length % 3 === 0) ? '/banner/none' : demoSvg(a.p, a.n, true);
  }

  function loadApps() {
    var list = [];
    if (hasNative) {
      try { list = JSON.parse(window.Android.getApps()); } catch (e) { list = []; }
    } else {
      list = DEMO.map(function (d) { return { p: d[0], n: d[1] }; });
    }
    if (!list.length) return false;
    list.sort(function (a, b) {
      var x = a.n.toLowerCase(), y = b.n.toLowerCase();
      return x < y ? -1 : (x > y ? 1 : 0);
    });
    apps = list; byPkg = {};
    list.forEach(function (a) { byPkg[a.p] = a; });

    if (!prefs.favs) {
      var favs = [];
      PREFERRED.forEach(function (p) { if (byPkg[p] && favs.length < 8 && indexOf(favs, p) < 0) favs.push(p); });
      for (var i = 0; i < apps.length && favs.length < 4; i++) {
        if (indexOf(favs, apps[i].p) < 0) favs.push(apps[i].p);
      }
      prefs.favs = favs;
      savePrefs();
    }
    return true;
  }

  /* ------------------------------------------------------------------ rendering */
  var focusKey = null;   // remembers what was focused across re-renders

  function tileKey(kind, pkg) { return kind + ':' + pkg; }

  function render() {
    var track = $('favTrack'), grid = $('grid');
    track.innerHTML = ''; grid.innerHTML = '';

    prefs.favs.forEach(function (p) {
      var a = byPkg[p]; if (!a) return;
      var t = make('div', 'tile fav focusable');
      t.tabIndex = 0; t.setAttribute('data-pkg', p); t.setAttribute('data-kind', 'fav');
      var card = make('div', 'card');
      var img = new Image();
      img.alt = ''; img.draggable = false;
      img.onerror = function () {
        img.onerror = null; img.className = 'noban'; img.src = iconUrl(a);
      };
      img.src = bannerUrl(a);
      card.appendChild(img);
      t.appendChild(card);
      t.appendChild(make('div', 'lbl', a.n));
      track.appendChild(t);
    });

    apps.forEach(function (a) {
      var hid = indexOf(prefs.hidden, a.p) >= 0;
      if (hid && !prefs.showHidden) return;
      var t = make('div', 'tile app focusable' + (hid ? ' hid' : ''));
      t.tabIndex = 0; t.setAttribute('data-pkg', a.p); t.setAttribute('data-kind', 'app');
      var ico = make('div', 'ico');
      var img = new Image();
      img.alt = ''; img.draggable = false; img.src = iconUrl(a);
      ico.appendChild(img);
      t.appendChild(ico);
      t.appendChild(make('div', 'lbl', a.n));
      grid.appendChild(t);
    });

    var hb = document.querySelector('[data-act="hidden"]');
    if (hb) {
      if (prefs.showHidden) hb.classList.add('on'); else hb.classList.remove('on');
      $('hiddenTip').textContent = prefs.showHidden ? 'Hide hidden apps' : 'Hidden apps';
    }

    // put focus back where it was
    if (focusKey) {
      var again = document.querySelector('[data-kind="' + focusKey.split(':')[0] + '"][data-pkg="' + focusKey.split(':')[1] + '"]');
      if (again) { focusEl(again, true); }
    }
  }

  /* ------------------------------------------------------------------ clock + greeting */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function tick() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    var part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
    $('greet').textContent = 'Good ' + part + (CFG.name ? ', ' + CFG.name : '');
    var hh = CFG.hour12 ? (h % 12 || 12) : (h < 10 ? '0' + h : '' + h);
    $('time').textContent = hh + ':' + (m < 10 ? '0' + m : m);
    $('ampm').textContent = CFG.hour12 ? (h < 12 ? 'AM' : 'PM') : '';
    $('date').textContent = DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  /* ------------------------------------------------------------------ weather (open-meteo, no key needed) */
  function svgSun() { return '<svg viewBox="0 0 64 64"><g stroke="#ffe27a" stroke-width="4" stroke-linecap="round"><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6"/></g><circle cx="32" cy="32" r="12" fill="#ffd23f"/></svg>'; }
  function svgMoon() { return '<svg viewBox="0 0 64 64"><path d="M42 8a24 24 0 1 0 14 40A20 20 0 0 1 42 8z" fill="#ffe9a8"/></svg>'; }
  function svgCloud(extra, dark) {
    return '<svg viewBox="0 0 64 64">' + (extra || '') + '<path d="M18 46a12 12 0 0 1-1-24 16 16 0 0 1 30 4 10 10 0 0 1 0 20z" fill="' + (dark ? '#9aa3c0' : '#e8eefc') + '"/></svg>';
  }
  function wxInfo(code, day) {
    if (code === 0) return { t: day ? 'Sunny' : 'Clear', i: day ? svgSun() : svgMoon() };
    if (code === 1 || code === 2) return { t: 'Partly cloudy', i: svgCloud(day ? '<circle cx="24" cy="20" r="10" fill="#ffd23f"/>' : '<path d="M26 8a14 14 0 1 0 10 22A12 12 0 0 1 26 8z" fill="#ffe9a8"/>') };
    if (code === 3) return { t: 'Cloudy', i: svgCloud('', true) };
    if (code === 45 || code === 48) return { t: 'Foggy', i: svgCloud('<path d="M12 54h40M18 60h28" stroke="#cfd6ea" stroke-width="3" stroke-linecap="round"/>', true) };
    if (code >= 51 && code <= 57) return { t: 'Drizzle', i: svgCloud('<path d="M24 52l-2 6M34 52l-2 6M44 52l-2 6" stroke="#6ec6ff" stroke-width="3" stroke-linecap="round"/>', true) };
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { t: 'Rain', i: svgCloud('<path d="M22 50l-3 9M32 50l-3 9M42 50l-3 9" stroke="#4fb3ff" stroke-width="3.5" stroke-linecap="round"/>', true) };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { t: 'Snow', i: svgCloud('<g fill="#fff"><circle cx="22" cy="54" r="2.5"/><circle cx="32" cy="58" r="2.5"/><circle cx="42" cy="54" r="2.5"/></g>', true) };
    if (code >= 95) return { t: 'Thunderstorm', i: svgCloud('<path d="M34 44l-8 10h7l-3 8 10-12h-7z" fill="#ffd23f"/>', true) };
    return { t: 'Weather', i: svgCloud('', false) };
  }

  function showWeather(lat, lon, city) {
    var unit = CFG.units === 'celsius' ? 'celsius' : 'fahrenheit';
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,weather_code,is_day&temperature_unit=' + unit;
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var c = j.current; if (!c) return;
      var info = wxInfo(c.weather_code, c.is_day === 1);
      $('wicon').innerHTML = info.i;
      $('wtemp').textContent = Math.round(c.temperature_2m) + '°';
      $('wcond').textContent = info.t + (city ? ' · ' + city : '');
      $('weather').className = 'on';
    }).catch(function () { /* offline: just leave weather hidden */ });
  }

  function loadWeather() {
    if (CFG.lat != null && CFG.lon != null) { showWeather(CFG.lat, CFG.lon, CFG.city); return; }
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('fh.loc') || 'null'); } catch (e) { cached = null; }
    if (cached && Date.now() - cached.t < 86400000) { showWeather(cached.lat, cached.lon, CFG.city || cached.city); return; }
    fetch('https://ipwho.is/').then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.success === false || j.latitude == null) throw new Error('no location');
      try { localStorage.setItem('fh.loc', JSON.stringify({ lat: j.latitude, lon: j.longitude, city: j.city, t: Date.now() })); } catch (e) { /* ignore */ }
      showWeather(j.latitude, j.longitude, CFG.city || j.city);
    }).catch(function () { /* no location, no weather */ });
  }

  /* ------------------------------------------------------------------ wallpaper */
  function applyBackground() {
    var id = prefs.bg || 'neon';
    if (id.indexOf('photo:') === 0) {
      var name = id.substring(6);
      document.body.className = document.body.className.replace(/\bphoto\b/, '') + ' photo';
      $('photo').style.backgroundImage = 'url("/bg/' + encodeURIComponent(name) + '")';
      Wall.stop();
    } else {
      document.body.className = document.body.className.replace(/\bphoto\b/, '');
      Wall.show(Wall.has(id) ? id : 'neon', $('wall'), prefs.anim !== false);
    }
  }

  /* ------------------------------------------------------------------ focus + navigation */
  var pageY = 0, trackX = 0, menuOpen = false, overlayOpen = false, previewing = false, lastFocus = null;

  function resetScroll() {
    var s = $('stage'); s.scrollTop = 0; s.scrollLeft = 0;
    var rows = document.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) { rows[i].scrollLeft = 0; rows[i].scrollTop = 0; }
    document.body.scrollTop = 0; document.documentElement.scrollTop = 0;
  }

  function topIn(e, ancestorId) {
    var t = 0, n = e;
    while (n && n.id !== ancestorId) { t += n.offsetTop; n = n.offsetParent; }
    return t;
  }

  function ensureVisible(e, instant) {
    var page = $('page');
    if (!page.contains(e)) return;
    var H = window.innerHeight, rem = REM();
    var kind = e.classList.contains('round') ? 'top' : (e.classList.contains('fav') ? 'favs' : 'apps');

    if (kind === 'favs') {
      var track = $('favTrack'), vw = track.parentNode.clientWidth, pad = 5 * rem;
      var left = e.offsetLeft, w = e.offsetWidth, nx = trackX;
      if (left + nx + w > vw - pad) nx = vw - pad - left - w;
      if (left + nx < pad) nx = pad - left;
      if (nx > pad) nx = pad;
      trackX = nx;
      track.style.transform = 'translate3d(' + trackX + 'px,0,0)';
    }

    var y = 0;
    if (kind === 'apps') y = -(topIn(e, 'page') - H * 0.40);
    y = Math.min(0, y);
    var minY = Math.min(0, -(page.offsetHeight - H));
    y = Math.max(minY, y);
    pageY = y;
    if (instant) { page.style.transition = 'none'; }
    page.style.transform = 'translate3d(0,' + pageY + 'px,0)';
    if (instant) { void page.offsetHeight; page.style.transition = ''; }
  }

  function focusEl(e, instant) {
    if (!e) return;
    try { e.focus({ preventScroll: true }); } catch (err) { e.focus(); }
    resetScroll();
    if (e.getAttribute('data-kind')) focusKey = tileKey(e.getAttribute('data-kind'), e.getAttribute('data-pkg'));
    else if (e.classList.contains('round')) focusKey = null;
    ensureVisible(e, instant);
  }

  function scopeItems() {
    var root = menuOpen ? $('menu') : (overlayOpen ? $('overlay') : $('page'));
    return toArray(root.querySelectorAll('.focusable'));
  }

  function move(dir) {
    var items = scopeItems(), cur = document.activeElement;
    if (!cur || indexOf(items, cur) < 0) { focusEl(items[0]); return; }
    var r = cur.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var best = null, bs = 1e12;
    items.forEach(function (it) {
      if (it === cur) return;
      var b = it.getBoundingClientRect();
      var dx = (b.left + b.width / 2) - cx, dy = (b.top + b.height / 2) - cy, prim, sec;
      if (dir === 'left') { if (dx > -2) return; prim = -dx; sec = Math.abs(dy); }
      else if (dir === 'right') { if (dx < 2) return; prim = dx; sec = Math.abs(dy); }
      else if (dir === 'up') { if (dy > -2) return; prim = -dy; sec = Math.abs(dx); }
      else { if (dy < 2) return; prim = dy; sec = Math.abs(dx); }
      var score = prim + sec * 2.4;
      if (score < bs) { bs = score; best = it; }
    });
    if (best) focusEl(best);
  }

  /* ------------------------------------------------------------------ actions */
  var toastTimer = 0;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function launch(pkg) {
    var a = byPkg[pkg];
    if (hasNative) window.Android.launch(pkg);
    else toast('Would open ' + (a ? a.n : pkg));
  }

  function goHome() {
    closeMenu(true); closeOverlay(true);
    var first = document.querySelector('.fav') || document.querySelector('.round');
    focusEl(first);
  }

  function activate(e) {
    if (!e) return;
    var act = e.getAttribute('data-act');
    if (act === 'home') { goHome(); return; }
    if (act === 'hidden') { prefs.showHidden = !prefs.showHidden; savePrefs(); render(); toast(prefs.showHidden ? 'Showing hidden apps' : 'Hidden apps are tucked away'); return; }
    if (act === 'bg') { openOverlay(); return; }
    if (act === 'settings') {
      if (hasNative) window.Android.openSettings(); else toast('Would open Fire TV settings');
      return;
    }
    if (e.getAttribute('data-pkg') && e.getAttribute('data-kind')) launch(e.getAttribute('data-pkg'));
  }

  /* ---- options menu for an app ---- */
  function favIndex(pkg) { return indexOf(prefs.favs, pkg); }

  function openMenu(tile) {
    if (!tile || !tile.getAttribute('data-pkg')) return;
    var pkg = tile.getAttribute('data-pkg'), kind = tile.getAttribute('data-kind'), a = byPkg[pkg];
    if (!a) return;
    var items = [], fi = favIndex(pkg), hid = indexOf(prefs.hidden, pkg) >= 0;

    if (fi < 0) items.push(['Add to Favorites', function () { prefs.favs.push(pkg); savePrefs(); focusKey = tileKey(kind, pkg); render(); toast('Added to Favorites'); }]);
    else items.push(['Remove from Favorites', function () { prefs.favs.splice(fi, 1); savePrefs(); focusKey = null; render(); focusEl(document.querySelector('.fav') || document.querySelector('.round'), true); toast('Removed from Favorites'); }]);
    if (kind === 'fav') {
      if (fi > 0) items.push(['Move left', function () { var t = prefs.favs[fi - 1]; prefs.favs[fi - 1] = pkg; prefs.favs[fi] = t; savePrefs(); focusKey = tileKey('fav', pkg); render(); }]);
      if (fi >= 0 && fi < prefs.favs.length - 1) items.push(['Move right', function () { var t = prefs.favs[fi + 1]; prefs.favs[fi + 1] = pkg; prefs.favs[fi] = t; savePrefs(); focusKey = tileKey('fav', pkg); render(); }]);
    }
    if (hid) items.push(['Unhide app', function () { prefs.hidden.splice(indexOf(prefs.hidden, pkg), 1); savePrefs(); render(); toast('App is visible again'); }]);
    else items.push(['Hide app', function () { prefs.hidden.push(pkg); savePrefs(); focusKey = null; render(); focusEl(document.querySelector('.app') || document.querySelector('.round'), true); toast('Hidden. Use the eye button to bring it back'); }]);
    if (hasNative) {
      items.push(['App info', function () { window.Android.appInfo(pkg); }]);
      items.push(['Uninstall', function () { window.Android.uninstall(pkg); }]);
    }

    lastFocus = tile;
    $('menuTitle').textContent = a.n;
    var box = $('menuItems'); box.innerHTML = '';
    items.forEach(function (it) {
      var b = make('button', 'mi focusable', it[0]);
      b.tabIndex = 0;
      b.onclick = function () { closeMenu(false); it[1](); };
      box.appendChild(b);
    });
    menuOpen = true; $('menu').hidden = false;
    focusEl(box.firstChild, true);
  }

  function closeMenu(skipRestore) {
    if (!menuOpen) return;
    menuOpen = false; $('menu').hidden = true;
    if (!skipRestore && lastFocus && document.body.contains(lastFocus)) focusEl(lastFocus, true);
  }

  /* ---- background picker ---- */
  function photoList() {
    if (!hasNative) return [];
    try { return JSON.parse(window.Android.listPhotos()); } catch (e) { return []; }
  }

  function buildThumbs() {
    var box = $('thumbs'); box.innerHTML = '';
    function add(id, name, fill) {
      var t = make('div', 'thumb focusable' + (prefs.bg === id ? ' sel' : ''));
      t.tabIndex = 0; t.setAttribute('data-bg', id);
      var pic = make('div', 'pic'); fill(pic);
      t.appendChild(pic); t.appendChild(make('div', 'nm', name)); t.appendChild(make('div', 'ck', '✓'));
      t.onclick = function () { chooseBg(id); };
      box.appendChild(t);
    }
    Wall.list().forEach(function (w) {
      add(w.id, w.name, function (pic) {
        var c = document.createElement('canvas'); c.width = 320; c.height = 180;
        Wall.thumb(w.id, c); pic.appendChild(c);
      });
    });
    photoList().forEach(function (f) {
      add('photo:' + f, f.replace(/\.[^.]+$/, ''), function (pic) {
        pic.style.backgroundImage = 'url("/bg/' + encodeURIComponent(f) + '")';
      });
    });
    var dir = hasNative && window.Android.photoDir ? window.Android.photoDir() : '/sdcard/Android/data/com.firehome.launcher/files/backgrounds';
    $('photoHelp').textContent = 'Use your own photos: copy .jpg or .png files to ' + dir + ' (from your PC: adb push photo.jpg ' + dir + '/ ) and reopen this screen.';
  }

  function chooseBg(id) {
    prefs.bg = id; savePrefs(); applyBackground();
    toArray(document.querySelectorAll('.thumb')).forEach(function (t) {
      if (t.getAttribute('data-bg') === id) t.classList.add('sel'); else t.classList.remove('sel');
    });
  }

  function updateAnimBtn() { $('animBtn').textContent = 'Animation: ' + (prefs.anim === false ? 'Off' : 'On'); }

  function openOverlay() {
    lastFocus = document.activeElement;
    buildThumbs(); updateAnimBtn();
    overlayOpen = true; $('overlay').hidden = false;
    var cur = document.querySelector('.thumb.sel') || document.querySelector('.thumb');
    focusEl(cur, true);
  }

  function closeOverlay(skipRestore) {
    if (!overlayOpen) return;
    overlayOpen = false; $('overlay').hidden = true;
    if (!skipRestore && lastFocus && document.body.contains(lastFocus)) focusEl(lastFocus, true);
  }

  $('animBtn').onclick = function () { prefs.anim = (prefs.anim === false); savePrefs(); updateAnimBtn(); applyBackground(); };
  $('previewBtn').onclick = function () { previewing = true; document.body.classList.add('preview'); };
  $('closeBtn').onclick = function () { closeOverlay(false); };

  /* ------------------------------------------------------------------ keys */
  var holdTimer = 0, holdFired = false, enterDown = false;

  function handleEnterDown(e) {
    if (enterDown) return;
    enterDown = true; holdFired = false;
    var target = document.activeElement;
    var canMenu = !menuOpen && !overlayOpen && target && target.getAttribute && target.getAttribute('data-kind');
    if (canMenu) {
      holdTimer = setTimeout(function () { holdFired = true; openMenu(target); }, 650);
    }
  }
  function handleEnterUp() {
    if (!enterDown) return;
    enterDown = false; clearTimeout(holdTimer);
    if (holdFired) { holdFired = false; return; }
    var t = document.activeElement;
    if (t && t.classList && t.classList.contains('focusable')) {
      if (t.click) t.click(); // click handlers cover menu items, pills and thumbs; tiles handled below
    }
  }

  function dirFor(ev) {
    switch (ev.key) {
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
    }
    switch (ev.keyCode) {
      case 37: case 21: return 'left';
      case 39: case 22: return 'right';
      case 38: case 19: return 'up';
      case 40: case 20: return 'down';
    }
    return null;
  }

  document.addEventListener('keydown', function (ev) {
    if (previewing) { previewing = false; document.body.classList.remove('preview'); ev.preventDefault(); return; }
    var d = dirFor(ev);
    if (d) { ev.preventDefault(); move(d); return; }
    if (ev.key === 'Enter' || ev.keyCode === 13 || ev.keyCode === 23) { ev.preventDefault(); handleEnterDown(ev); return; }
    if (ev.key === 'Escape' || ev.key === 'Backspace' || ev.keyCode === 4) { ev.preventDefault(); FH.back(); return; }
    if (ev.key === 'ContextMenu' || ev.key === 'm' || ev.keyCode === 82) { ev.preventDefault(); FH.menu(); return; }
  }, true);

  document.addEventListener('keyup', function (ev) {
    if (ev.key === 'Enter' || ev.keyCode === 13 || ev.keyCode === 23) { ev.preventDefault(); handleEnterUp(); }
  }, true);

  // mouse / touch: tap a tile to open it
  document.addEventListener('click', function (ev) {
    var n = ev.target;
    while (n && n !== document.body) {
      if (n.classList && n.classList.contains('tile')) { activate(n); return; }
      if (n.classList && n.classList.contains('round')) { activate(n); return; }
      n = n.parentNode;
    }
  });

  /* ------------------------------------------------------------------ entry points used by the Android side */
  var FH = window.FH = {
    back: function () {
      if (previewing) { previewing = false; document.body.classList.remove('preview'); return; }
      if (menuOpen) { closeMenu(false); return; }
      if (overlayOpen) { closeOverlay(false); return; }
      var first = document.querySelector('.fav') || document.querySelector('.round');
      if (document.activeElement !== first) focusEl(first);
    },
    menu: function () {
      if (menuOpen || overlayOpen || previewing) return;
      var t = document.activeElement;
      if (t && t.getAttribute && t.getAttribute('data-kind')) openMenu(t);
    },
    home: function () { goHome(); },
    refresh: function () {
      if (menuOpen || overlayOpen) return;
      var had = focusKey;
      if (loadApps()) { focusKey = had; render(); }
      tick();
    }
  };

  /* ------------------------------------------------------------------ start */
  loadPrefs();
  loadApps();
  render();
  applyBackground();
  tick();
  setInterval(tick, 15000);
  loadWeather();
  setInterval(loadWeather, 30 * 60 * 1000);
  window.addEventListener('resize', function () { var f = document.activeElement; if (f) ensureVisible(f, true); });
  focusEl(document.querySelector('.fav') || document.querySelector('.round'), true);
  setTimeout(function () { $('hint').className = 'gone'; }, 9000);
})();
