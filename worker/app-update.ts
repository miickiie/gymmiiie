export function appUpdateResponse(autoStart = false): Response {
  const nonce = crypto.randomUUID();
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Update Gymmiie</title>
  <style nonce="${nonce}">
    body { margin: 0; padding: 32px 20px; background: #100e0b; color: #f5f1e8; font: 18px/1.5 system-ui, sans-serif; }
    main { max-width: 440px; margin: 10vh auto; }
    h1 { line-height: 1.2; }
    p { color: #c7bfb1; }
    button { width: 100%; padding: 16px; border: 0; border-radius: 16px; background: #e77e43; color: #100e0b; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .6; }
  </style>
</head>
<body>
  <main>
    <h1>Update Gymmiie</h1>
    <p>Load the latest app to fix outdated screens. Your saved profile, workouts, and sign-in stay on this device.</p>
    <p>Save any open workout and close other Gymmiie tabs or app windows before continuing.</p>
    <button id="update" type="button">Update Gymmiie</button>
    <p id="status" role="status" aria-live="polite"></p>
  </main>
  <script nonce="${nonce}">
    const button = document.getElementById('update');
    const status = document.getElementById('status');
    const update = async () => {
      button.disabled = true;
      status.textContent = 'Loading the latest Gymmiie…';
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration('/');
          if (registration && registration.scope === new URL('/', location.origin).href) {
            await registration.unregister();
          }
        }
        location.replace('/?app-update=' + Date.now());
      } catch {
        status.textContent = 'The update could not finish. Check your connection and try again.';
        button.disabled = false;
      }
    };
    button.addEventListener('click', update);
    ${autoStart ? 'void update();' : ''}
  </script>
</body>
</html>`,
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    },
  );
}
