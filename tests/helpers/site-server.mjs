import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

export async function startSiteServer() {
    // Match GitHub Pages project hosting, including its legacy-page 404 fallback.
    const mount = '/gidanyan-runner_website';
    const server = createServer(async (req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (pathname === mount) { res.writeHead(302, { Location: `${mount}/` }); res.end(); return; }
        if (!pathname.startsWith(`${mount}/`)) { res.writeHead(404); res.end(); return; }
        const name = pathname.slice(mount.length);
        const filename = path.resolve(root, `.${name.endsWith('/') ? `${name}index.html` : name}`);
        try {
            if (!filename.startsWith(root) || !types[path.extname(filename)]) throw new Error('not allowed');
            const body = await readFile(filename);
            res.writeHead(200, { 'Content-Type': types[path.extname(filename)] });
            res.end(body);
        } catch {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(await readFile(path.join(root, '404.html')));
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return {
        base: `http://127.0.0.1:${server.address().port}${mount}`,
        close: () => new Promise(resolve => server.close(resolve))
    };
}
