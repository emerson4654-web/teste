
(function () {
  if (window.EBPresence) return;

  var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var watch = !!window.EB_PRESENCE_WATCH;

  var aid = '';
  try {
    aid = localStorage.getItem('eb_aid') || '';
    if (!aid) {
      aid = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('eb_aid', aid);
    }
  } catch (e) {}

  var ws = null, pingTimer = null, reconnectTimer = null, backoff = 1000, closed = false;
  var listeners = [];

  window.EBPresence = {
    counts: null,
    onCount: function (fn) {
      listeners.push(fn);
      if (this.counts) { try { fn(this.counts); } catch (e) {} }
    }
  };

  function emit(c) {
    window.EBPresence.counts = c;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](c); } catch (e) {}
    }
  }

  function connect() {
    if (closed) return;
    var url = proto + '//' + location.host + '/ws/presence?aid=' + encodeURIComponent(aid) + (watch ? '&watch=1' : '');
    try { ws = new WebSocket(url); } catch (e) { scheduleReconnect(); return; }

    ws.onopen = function () {
      backoff = 1000;
      clearInterval(pingTimer);
      pingTimer = setInterval(function () {
        if (ws && ws.readyState === 1) { try { ws.send('p'); } catch (e) {} }
      }, 25000);
    };
    ws.onmessage = function (ev) {
      try {
        var d = JSON.parse(ev.data);
        if (d && d.type === 'counts') emit(d);
      } catch (e) {}
    };
    ws.onclose = function () { clearInterval(pingTimer); scheduleReconnect(); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }

  function scheduleReconnect() {
    if (closed) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, backoff);
    backoff = Math.min(Math.round(backoff * 1.7), 20000);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && (!ws || ws.readyState > 1)) { backoff = 1000; connect(); }
  });
  window.addEventListener('online', function () {
    if (!ws || ws.readyState > 1) { backoff = 1000; connect(); }
  });

  connect();
})();
