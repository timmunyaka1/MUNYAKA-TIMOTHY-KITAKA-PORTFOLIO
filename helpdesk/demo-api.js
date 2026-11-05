/*
 * Interactive demo of the Matungulu ICT Support Desk.
 * The real system is a Flask + SQLite web app. This file imitates its server inside the browser,
 * answering the same /api/... and /login requests, so the demo works as a static page (GitHub Pages).
 * Tickets live in this browser only (localStorage) and never leave the visitor's device.
 */
(function () {
  'use strict';
  var KEY = 'ictdemo.v1.tickets', SESSION = 'ictdemo.v1.admin';
  var DEMO_USER = 'demo', DEMO_PASS = 'demo';
  var CATEGORIES = ['Internet/Connectivity', 'Charging/Power', 'Devices', 'Accounts & Platforms', 'Other'];
  var ROLES = ['Teacher', 'School Head', 'ICT Coordinator'];
  var STATUSES = ['Pending', 'In Progress', 'Resolved'];

  function hex8() {
    var a = new Uint8Array(4);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').toUpperCase();
  }
  function ago(hours) { return new Date(Date.now() - hours * 3600 * 1000).toISOString(); }

  function seed() {
    var s = [
      ['MATUNGULU GIRLS (Secondary)', 'Teacher', 'Internet/Connectivity', '', 'Wi-Fi in the computer lab keeps dropping during lessons.', 'In Progress', 52, 20],
      ['KYAUME (Primary)', 'School Head', 'Devices', 'Devices: Projector, Teacher laptop', 'Projector does not power on and the teacher laptop will not connect to it.', 'Pending', 30, 30],
      ['KINYUI BOYS (Secondary)', 'ICT Coordinator', 'Accounts & Platforms', 'Portals: NEMIS (National Education Management Information System)', 'Cannot log in to NEMIS after a password reset.', 'Resolved', 120, 96],
      ['TALA GIRLS (Primary)', 'Teacher', 'Charging/Power', '', 'Charging cabinet has no power since Monday; learner devices are flat.', 'In Progress', 40, 12],
      ['KATWANYAA (Secondary)', 'School Head', 'Internet/Connectivity, Devices', 'Devices: Wi-Fi router / access point', 'Router restarts every few minutes and internet is unusable.', 'Resolved', 200, 150],
      ['MBUNI (Primary)', 'Teacher', 'Devices', 'Devices: Learner digital device (tablet)', 'Three learner tablets will not charge.', 'Pending', 8, 8],
      ['SENGANI GIRLS (Secondary)', 'ICT Coordinator', 'Accounts & Platforms, Internet/Connectivity', 'Portals: KNEC portal (examinations and candidate registration)', 'KNEC portal times out when uploading candidate data.', 'In Progress', 26, 3],
      ['ST JOSEPH KIKUYUNI (Secondary)', 'Teacher', 'Other', '', 'Printer in the staffroom jams on every page.', 'Resolved', 300, 280],
      ['KALANDINI (Special Unit)', 'School Head', 'Devices', 'Devices: Teacher laptop', 'Laptop shows a black screen after boot.', 'Pending', 5, 5],
      ['NGULUNI AIC (Primary)', 'Teacher', 'Internet/Connectivity', '', 'No internet since the weekend.', 'Resolved', 170, 100],
      ['KATINE TECHNICAL TRAINING INSTITUTE (TTI)', 'ICT Coordinator', 'Accounts & Platforms', 'Portals: Ministry of Education email account', 'Email account locked after repeated sign-in attempts.', 'Resolved', 90, 70],
      ['UAMANI SEC (Secondary)', 'School Head', 'Charging/Power, Devices', 'Devices: Charging cabinet / trolley', 'Charging trolley trips the power every time it is plugged in.', 'In Progress', 18, 6]
    ];
    return s.map(function (r, i) {
      return {
        id: i + 1, tracking_id: 'TKT-' + ['A1B2C3D4', '9F8E7D6C', '3C4D5E6F', 'B7A6958E', '1234ABCD', 'DEADBEEF', '5A6B7C8D', 'C0FFEE11', '0BADF00D', '2468ACE0', '13579BDF', 'F00D1E55'][i],
        school_name: r[0], requestor_designation: r[1], issue_category: r[2], detail: r[3], description: r[4],
        status: r[5], created_at: ago(r[6]), updated_at: ago(r[7])
      };
    });
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage blocked: fall through to in-memory seed */ }
    var t = seed();
    save(t);
    return t;
  }
  var memory = null;
  function save(t) {
    memory = t;
    try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { /* private mode: keep in memory */ }
  }
  function tickets() { return memory || (memory = load()); }
  function isAdmin() { try { return sessionStorage.getItem(SESSION) === '1'; } catch (e) { return !!window.__ictAdmin; } }
  function setAdmin(v) { try { v ? sessionStorage.setItem(SESSION, '1') : sessionStorage.removeItem(SESSION); } catch (e) { window.__ictAdmin = v; } }

  function json(obj, status) {
    return Promise.resolve(new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } }));
  }
  function err(msg, status) { return json({ error: msg }, status); }

  function publicView(t) {
    return { id: t.id, tracking_id: t.tracking_id, school_name: t.school_name, issue_category: t.issue_category, detail: t.detail, status: t.status, updated_at: t.updated_at };
  }

  function bodyOf(opts) {
    var b = opts && opts.body;
    if (!b) return {};
    if (typeof b === 'string') {
      try { return JSON.parse(b); } catch (e) { var o = {}; new URLSearchParams(b).forEach(function (v, k) { o[k] = v; }); return o; }
    }
    if (typeof b.forEach === 'function') { var q = {}; b.forEach(function (v, k) { q[k] = v; }); return q; }
    return {};
  }

  function analytics() {
    var rows = tickets(), total = rows.length;
    var resolved = rows.filter(function (r) { return r.status === 'Resolved'; }).length;
    var rate = total ? Math.round((resolved / total) * 10000) / 100 : 0;
    var cats = {}, schools = {};
    rows.forEach(function (r) {
      r.issue_category.split(', ').forEach(function (c) { cats[c] = (cats[c] || 0) + 1; });
      schools[r.school_name] = (schools[r.school_name] || 0) + 1;
    });
    var risk = 'No tickets yet';
    if (rows.length) {
      var top = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
      risk = 'Category: ' + top + ' (' + cats[top] + ' tickets)';
    }
    return { total_tickets: total, resolved_tickets: resolved, resolution_rate: rate, risk_indicator: risk };
  }

  function handle(url, opts) {
    opts = opts || {};
    var u = new URL(url, location.href), path = u.pathname, method = (opts.method || 'GET').toUpperCase();
    var m;

    if (path.slice(-6) === '/login' && method === 'POST') {
      var f = bodyOf(opts);
      if ((f.username || '').trim() === DEMO_USER && (f.password || '') === DEMO_PASS) { setAdmin(true); return json({ message: 'IT Dashboard access granted' }); }
      return err('Invalid IT Department credentials', 401);
    }

    if (/\/api\/track$/.test(path)) {
      var id = (u.searchParams.get('id') || '').trim().toUpperCase();
      if (!/^TKT-[0-9A-F]{8}$/.test(id)) return err('That does not look like a tracking ID. It starts with TKT- followed by 8 characters.', 400);
      var t = tickets().filter(function (x) { return x.tracking_id === id; })[0];
      if (!t) return err('No ticket found with that tracking ID. Check it and try again.', 404);
      return json({ tracking_id: t.tracking_id, school_name: t.school_name, issue_category: t.issue_category, detail: t.detail, status: t.status, created_at: t.created_at, updated_at: t.updated_at });
    }

    if (/\/api\/analytics$/.test(path)) return isAdmin() ? json(analytics()) : err('IT Department access required', 403);

    if ((m = path.match(/\/api\/tickets\/(\d+)\/status$/)) && method === 'POST') {
      if (!isAdmin()) return err('IT Department access required', 403);
      var st = bodyOf(opts).status || 'Pending';
      if (STATUSES.indexOf(st) < 0) return err('Invalid status', 400);
      var all = tickets(), row = all.filter(function (x) { return String(x.id) === m[1]; })[0];
      if (!row) return err('Ticket not found', 404);
      row.status = st; row.updated_at = new Date().toISOString(); save(all);
      return json(publicView(row));
    }

    if (/\/api\/tickets$/.test(path)) {
      if (method === 'GET') {
        if (!isAdmin()) return err('IT Department access required', 403);
        return json(tickets().slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).map(publicView));
      }
      var p = bodyOf(opts);
      var limits = { school_name: 140, requestor_designation: 40, description: 2000 };
      for (var k in limits) {
        var v = p[k];
        if (typeof v !== 'string' || !v.trim()) return err(k + ' is required', 400);
        if (v.trim().length > limits[k]) return err(k + ' is too long (max ' + limits[k] + ' characters)', 400);
      }
      if (!/\((Primary|Secondary|Special Unit|TTI)\)$/.test(p.school_name.trim())) return err('Please choose your school from the list', 400);
      var cats = p.issue_categories;
      if (!Array.isArray(cats) || !cats.length) return err('Choose at least one issue', 400);
      for (var i = 0; i < cats.length; i++) if (CATEGORIES.indexOf(String(cats[i]).trim()) < 0) return err('Invalid issue category', 400);
      var detail = typeof p.detail === 'string' ? p.detail.trim() : '';
      if (detail.length > 400) return err('detail is invalid or too long', 400);
      var needs = cats.indexOf('Devices') > -1 || cats.indexOf('Accounts & Platforms') > -1;
      if (needs && !detail) return err('Please say which device or portal is affected', 400);
      if (!needs) detail = '';
      if (ROLES.indexOf(p.requestor_designation.trim()) < 0) return err('Invalid requestor designation', 400);
      if (p.consent !== true && p.consent !== 'true') return err('consent is required to submit a ticket', 400);

      var list = tickets(), nextId = list.reduce(function (mx, x) { return Math.max(mx, x.id); }, 0) + 1, tid;
      do { tid = 'TKT-' + hex8(); } while (list.some(function (x) { return x.tracking_id === tid; }));
      var now = new Date().toISOString();
      var ordered = CATEGORIES.filter(function (c) { return cats.indexOf(c) > -1; }).join(', ');
      list.push({ id: nextId, tracking_id: tid, school_name: p.school_name.trim(), requestor_designation: p.requestor_designation.trim(), issue_category: ordered, detail: detail, description: p.description.trim(), status: 'Pending', created_at: now, updated_at: now });
      save(list);
      return json({ ticket_id: nextId, tracking_id: tid, status: 'Pending' }, 201);
    }
    return null;
  }

  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var s = typeof url === 'string' ? url : (url && url.url) || '';
    var path; try { path = new URL(s, location.href).pathname; } catch (e) { return realFetch(url, opts); }
    if (/\/api\//.test(path) || /\/login$/.test(path)) { var r = handle(s, opts); if (r) return r; }
    return realFetch(url, opts);
  };

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.getAttribute && /\/logout$/.test(f.getAttribute('action') || '')) { e.preventDefault(); setAdmin(false); location.href = 'admin.html'; }
  }, true);

  window.ICTDemo = {
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} setAdmin(false); memory = null; location.reload(); }
  };
})();
