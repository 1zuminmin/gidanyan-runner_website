import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const pages = ['index.html', '404.html', 'game/index.html', 'game/stage-select.html',
    ...[1, 2, 3, 4].map(i => `game/stage${i}.html`), 'photo/index.html'];

test('all local page links, scripts, styles and images resolve after the folder move', () => {
    for (const name of pages) {
        const page = new URL(name, root);
        const html = readFileSync(page, 'utf8');
        for (const [, reference] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
            const target = new URL(reference, page);
            if (target.protocol !== 'file:') continue;
            target.search = ''; target.hash = '';
            assert.ok(existsSync(target), `${name}: missing ${reference}`);
        }
    }
});
