import * as fs from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { APP_SVELTE, buildAppAndSsr } from './build.ts';

const rootUrl = new URL('../', import.meta.url);
const APP_JS = fileURLToPath(new URL('app.js', rootUrl));
const SSR_JS_URL = new URL('ssr.js', rootUrl).href;

const HTTP_PORT = 8000;
const WS_PORT = 8080;

buildAppAndSsr();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/app.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(fs.readFileSync(APP_JS, 'utf-8'));
    return;
  }

  // import with a fresh query string to bypass the module cache
  const renderApp: () => string = (await import(`${SSR_JS_URL}?t=${Date.now()}`)).default;
  res.end(
    `<html>
    <body>
      <div id="app">${renderApp()}</div>
      <script type="module">
        import App from './app.js';
        const container = document.querySelector('#app');

        let app = App();
        app.create(container);

        const ws = new WebSocket('ws://localhost:${WS_PORT}');
        ws.addEventListener('message', () => {
          import('./app.js?t=' + Date.now()).then(newModule => {
            const App = newModule.default;
            const restored_state = app.capture_state();
            app.destroy(container);
            app = App({ restored_state });
            app.create(container, false);
          })
        });
      </script>
    </body>
  </html>`,
  );
});
server.listen(HTTP_PORT, () => console.log(`http://localhost:${HTTP_PORT}`));

// hot module reloading: notify browsers whenever app.svelte changes
const sockets = new Set<WebSocket>();
const wss = new WebSocketServer({ port: WS_PORT });
wss.on('connection', (ws) => {
  sockets.add(ws);
  ws.on('error', console.error);
  ws.on('close', () => sockets.delete(ws));
});

fs.watchFile(APP_SVELTE, { interval: 0 }, () => {
  buildAppAndSsr();
  for (const ws of sockets) ws.send('something has changed');
});
