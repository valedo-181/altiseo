/* Altiseo : statistiques de visites sans cookies. Rien n'est gardé dans le navigateur. */
(function () {
  var s = document.currentScript;
  if (!s || !window.fetch) return;
  var k = s.getAttribute("data-site"), h = location.hostname;
  if (!k || navigator.webdriver || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(h) || location.protocol === "file:") return;
  var e = new URL(s.src).origin + "/api/collect", last = "";
  function send() {
    if (location.href === last) return;
    last = location.href;
    var b = JSON.stringify({ k: k, u: location.href, r: document.referrer, w: window.innerWidth });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(e, new Blob([b], { type: "text/plain" }))) return;
    } catch (x) {}
    fetch(e, { method: "POST", body: b, keepalive: true, credentials: "omit", headers: { "content-type": "text/plain" } }).catch(function () {});
  }
  var p = history.pushState;
  if (p) {
    history.pushState = function () { p.apply(this, arguments); setTimeout(send, 0); };
    addEventListener("popstate", send);
  }
  if (document.visibilityState === "prerender") document.addEventListener("visibilitychange", function v() { if (document.visibilityState !== "prerender") { document.removeEventListener("visibilitychange", v); send(); } });
  else send();
})();
