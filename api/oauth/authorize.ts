import { getClient, createAuthorizationCode } from '../_lib/oauthStore';
import { getSupabaseAnonClient } from '../_lib/supabaseAdmin';

interface OAuthParams {
  client_id: string;
  redirect_uri: string;
  state: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') return handleGet(req);
  if (req.method === 'POST') return handlePost(req);
  return new Response('Method Not Allowed', { status: 405 });
}

async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = extractParams(url.searchParams);

  const validation = await validateParams(params);
  if (validation.ok === false) {
    return htmlResponse(renderErrorPage(validation.error), 400);
  }

  return htmlResponse(renderLoginForm(params, null));
}

async function handlePost(req: Request): Promise<Response> {
  const form = await req.formData();
  const params: OAuthParams = {
    client_id: String(form.get('client_id') || ''),
    redirect_uri: String(form.get('redirect_uri') || ''),
    state: form.get('state') ? String(form.get('state')) : null,
    code_challenge: form.get('code_challenge') ? String(form.get('code_challenge')) : null,
    code_challenge_method: form.get('code_challenge_method') ? String(form.get('code_challenge_method')) : null,
  };

  const validation = await validateParams(params);
  if (validation.ok === false) {
    return htmlResponse(renderErrorPage(validation.error), 400);
  }

  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');

  if (!email || !password) {
    return htmlResponse(renderLoginForm(params, 'Email dan password wajib diisi.'));
  }

  const supabase = getSupabaseAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    return htmlResponse(renderLoginForm(params, 'Email atau password salah.'));
  }

  const code = await createAuthorizationCode({
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    code_challenge: params.code_challenge,
    code_challenge_method: params.code_challenge_method,
    supabase_user_id: data.user.id,
    supabase_refresh_token: data.session.refresh_token,
  });

  const redirectUrl = new URL(params.redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (params.state) redirectUrl.searchParams.set('state', params.state);

  return Response.redirect(redirectUrl.toString(), 302);
}

function extractParams(sp: URLSearchParams): OAuthParams {
  return {
    client_id: sp.get('client_id') || '',
    redirect_uri: sp.get('redirect_uri') || '',
    state: sp.get('state'),
    code_challenge: sp.get('code_challenge'),
    code_challenge_method: sp.get('code_challenge_method'),
  };
}

async function validateParams(params: OAuthParams): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!params.client_id || !params.redirect_uri) {
    return { ok: false, error: 'Permintaan otorisasi tidak lengkap (client_id / redirect_uri hilang).' };
  }
  const client = await getClient(params.client_id);
  if (!client) {
    return { ok: false, error: 'Aplikasi (client) tidak dikenali. Coba hubungkan ulang connector-nya.' };
  }
  if (!client.redirect_uris.includes(params.redirect_uri)) {
    return { ok: false, error: 'redirect_uri tidak terdaftar untuk aplikasi ini.' };
  }
  return { ok: true };
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function renderLoginForm(params: OAuthParams, errorMsg: string | null): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Masuk ke KasUsaha</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 16px;
  }
  .card {
    background: #fff;
    color: #1e293b;
    border-radius: 20px;
    padding: 32px;
    width: 100%;
    max-width: 380px;
    box-shadow: 0 20px 40px rgba(0,0,0,.3);
  }
  h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
  p.sub { font-size: 13px; color: #64748b; margin: 0 0 24px; line-height: 1.5; }
  label { display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; }
  input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 14px;
    margin-bottom: 16px;
  }
  input:focus { outline: 2px solid #10b981; background: #fff; }
  button {
    width: 100%;
    padding: 12px;
    border-radius: 12px;
    border: none;
    background: #059669;
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
  }
  button:hover { background: #047857; }
  .error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    font-size: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .brand .dot { width: 10px; height: 10px; border-radius: 999px; background: #10b981; }
  .brand span { font-weight: 900; letter-spacing: .05em; font-size: 13px; color: #0f172a; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand"><span class="dot"></span><span>KASUSAHA</span></div>
    <h1>Masuk untuk menghubungkan chat</h1>
    <p class="sub">Aplikasi chat kamu meminta akses ke data pembukuan KasUsaha. Masuk dengan akun KasUsaha yang sama seperti yang kamu pakai di web untuk mengizinkan akses.</p>
    ${errorMsg ? `<div class="error">${escapeHtml(errorMsg)}</div>` : ''}
    <form method="POST">
      <input type="hidden" name="client_id" value="${escapeHtml(params.client_id)}" />
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri)}" />
      <input type="hidden" name="state" value="${escapeHtml(params.state || '')}" />
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.code_challenge || '')}" />
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.code_challenge_method || '')}" />
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autofocus autocomplete="username" />
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password" />
      <button type="submit">Masuk &amp; Izinkan Akses</button>
    </form>
  </div>
</body>
</html>`;
}

function renderErrorPage(message: string): string {
  return `<!doctype html>
<html lang="id">
<head><meta charset="utf-8" /><title>Kesalahan</title></head>
<body style="font-family: sans-serif; padding: 40px; text-align: center; color: #334155;">
  <h2>Permintaan tidak valid</h2>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
