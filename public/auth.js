// Optional sign-in with Google or Microsoft. Client-side only: we read name + email from the ID token
// and keep them in memory. No session, no cookie, nothing stored (GDD §9). Buttons appear only when
// the server has a client ID for that provider (GET /config).
import { decodeB64url } from './spec.js';

const load = (src) => new Promise((ok, err) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok; s.onerror = err;
  document.head.append(s);
});

const $ = (id) => document.getElementById(id);

export async function initAuth(onChange) {
  let cfg = {};
  try { cfg = await (await fetch('config')).json(); } catch { /* static hosting: no sign-in */ }
  if (!cfg.googleClientId && !cfg.msClientId) return;
  $('signin').hidden = false;
  $('signout').onclick = () => onChange(null);

  if (cfg.googleClientId) {
    load('https://accounts.google.com/gsi/client').then(() => {
      google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: ({ credential }) => {
          const claims = JSON.parse(decodeB64url(credential.split('.')[1]));
          onChange({ name: claims.name || claims.given_name || 'You', email: claims.email });
        },
      });
      google.accounts.id.renderButton($('google-btn'), { theme: 'outline', size: 'medium', text: 'signin_with' });
    }).catch(() => {});
  }

  if (cfg.msClientId) {
    $('ms-btn').hidden = false;
    let pca;
    $('ms-btn').onclick = async () => {
      try {
        if (!pca) {
          await load('https://alcdn.msauth.net/browser/3.7.1/js/msal-browser.min.js');
          pca = new msal.PublicClientApplication({ auth: { clientId: cfg.msClientId, authority: 'https://login.microsoftonline.com/common', redirectUri: location.origin + location.pathname } });
          await pca.initialize();
        }
        const r = await pca.loginPopup({ scopes: ['openid', 'profile', 'email'] });
        onChange({ name: r.account.name || 'You', email: r.account.username });
      } catch { /* popup closed or blocked: stay signed out */ }
    };
  }
}
