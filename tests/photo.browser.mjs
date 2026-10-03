// Browser integration tests: npm install --no-save --package-lock=false playwright
// Uses synthetic canvas video only; never opens a physical camera.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

test('ぎだにゃんフォト: browser integration', async t => {
    const server = createServer(async (req, res) => {
        const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const filename = path.resolve(root, `.${name === '/' ? '/index.html' : name}`);
        try {
            if (!filename.startsWith(root) || !types[path.extname(filename)]) throw new Error('not allowed');
            const body = await readFile(filename);
            res.writeHead(200, { 'Content-Type': types[path.extname(filename)] });
            res.end(body);
        } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(() => new Promise(resolve => server.close(resolve)));
    const browser = await chromium.launch({ channel: process.env.PHOTO_TEST_BROWSER || 'chrome', headless: true });
    t.after(() => browser.close());

    async function open(mode = 'allow', viewport = { width: 390, height: 844 }) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(({ mode }) => {
            window.photoTest = { mode, streams: [], requests: [] };
            function makeStream() {
                const source = document.createElement('canvas');
                source.width = 640;
                source.height = 480;
                const ctx = source.getContext('2d');
                const paint = () => {
                    ctx.fillStyle = '#e03c31'; ctx.fillRect(0, 0, 320, 480);
                    ctx.fillStyle = '#2468d6'; ctx.fillRect(320, 0, 320, 480);
                };
                paint();
                const stream = source.captureStream(15);
                const timer = setInterval(paint, 65);
                const track = stream.getVideoTracks()[0];
                const stop = track.stop.bind(track);
                track.stop = () => { clearInterval(timer); stop(); };
                window.photoTest.streams.push(stream);
                return stream;
            }
            Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async constraints => {
                window.photoTest.requests.push(constraints);
                if (window.photoTest.mode === 'deny') throw new DOMException('Denied', 'NotAllowedError');
                if (window.photoTest.mode === 'missing') throw new DOMException('Missing', 'NotFoundError');
                if (window.photoTest.mode === 'busy') throw new DOMException('Busy', 'NotReadableError');
                if (window.photoTest.mode === 'delay') return new Promise(resolve => { window.photoTest.resolve = () => resolve(makeStream()); });
                return makeStream();
            } });
        }, { mode });
        return { page, errors };
    }

    const waitLive = page => page.waitForFunction(() => !document.querySelector('#captureButton').disabled);
    const stopped = page => page.evaluate(() => window.photoTest.streams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));

    await t.test('home → 9 frame/pose combinations → PNG → retake → home; preview equals export', async () => {
        const { page, errors } = await open();
        try {
            await page.goto(base);
            await page.getByRole('link', { name: /ぎだにゃんフォト/ }).click();
            await waitLive(page);
            assert.equal(await page.evaluate(() => window.photoTest.requests[0].audio), false);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await page.evaluate(() => document.querySelector('#captureButton').getBoundingClientRect().bottom <= innerHeight), true, 'mobile shutter fits in the viewport');
            for (const frame of ['insta', 'x', 'original']) {
                for (const pose of ['pose1', 'pose2', 'none']) {
                    await page.selectOption('#frameSelect', frame);
                    await page.selectOption('#poseSelect', pose);
                    await page.click('#captureButton');
                    await page.waitForFunction(() => !document.querySelector('#resultActions').hidden);
                    assert.equal(await stopped(page), true);
                    const result = await page.evaluate(async () => {
                        const canvas = document.querySelector('#photoCanvas');
                        const blob = await (await fetch(document.querySelector('#savePhoto').href)).blob();
                        const image = await createImageBitmap(blob);
                        const result = document.createElement('canvas');
                        result.width = image.width; result.height = image.height;
                        const ctx = result.getContext('2d');
                        ctx.drawImage(image, 0, 0);
                        const actual = ctx.getImageData(0, 0, result.width, result.height).data;
                        const expected = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                        return { width: image.width, height: image.height, type: blob.type,
                            equal: actual.every((v, i) => v === expected[i]),
                            left: Array.from(ctx.getImageData(200, 500, 1, 1).data),
                            right: Array.from(ctx.getImageData(880, 500, 1, 1).data) };
                    });
                    assert.equal(result.width, 1080);
                    assert.equal(result.height, 1440);
                    assert.equal(result.type, 'image/png');
                    assert.equal(result.equal, true);
                    assert.ok(result.left[2] > result.left[0], 'selfie: blue is mirrored to the left');
                    assert.ok(result.right[0] > result.right[2], 'selfie: red is mirrored to the right');
                    if (frame === 'original' && pose === 'pose2') {
                        const [download] = await Promise.all([page.waitForEvent('download'), page.click('#savePhoto')]);
                        assert.match(download.suggestedFilename(), /^gidanyan-photo-.*\.png$/);
                        assert.equal(await download.failure(), null);
                        if (process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'photo-mobile.png'), fullPage: true });
                    }
                    await page.click('#retakeButton');
                    await waitLive(page);
                    assert.equal(await page.inputValue('#frameSelect'), frame);
                    assert.equal(await page.inputValue('#poseSelect'), pose);
                }
            }
            await page.setViewportSize({ width: 1280, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            if (process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'photo-desktop.png'), fullPage: true });
            await page.click('#switchCamera');
            await waitLive(page);
            assert.equal(await page.evaluate(() => window.photoTest.requests.at(-1).video.facingMode.ideal), 'environment');
            const rearPixel = await page.evaluate(() => Array.from(document.querySelector('#photoCanvas').getContext('2d').getImageData(200, 500, 1, 1).data));
            assert.ok(rearPixel[0] > rearPixel[2], 'rear camera is not mirrored');
            assert.equal(await page.evaluate(() => window.photoTest.streams.slice(0, -1).every(s => s.getTracks()[0].readyState === 'ended')), true);
            // Check cleanup before navigation destroys the old document.
            await page.evaluate(() => document.querySelector('#homeLink').addEventListener('click', event => event.preventDefault()));
            await page.click('#homeLink');
            assert.equal(await stopped(page), true);
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });

    for (const [mode, message] of [['deny', '許可されていません'], ['missing', '見つかりません'], ['busy', '他のアプリ']]) {
        await t.test(`${mode}: helpful error and recovery`, async () => {
            const { page, errors } = await open(mode);
            try {
                await page.goto(`${base}/photo.html`);
                await page.waitForFunction(() => !document.querySelector('#retryCamera').hidden);
                assert.match(await page.textContent('#photoStatus'), new RegExp(message));
                assert.equal(await page.isDisabled('#captureButton'), true);
                await page.evaluate(() => { window.photoTest.mode = 'allow'; });
                await page.click('#retryCamera');
                await waitLive(page);
                assert.deepEqual(errors, []);
            } finally { await page.close(); }
        });
    }

    await t.test('late permission after pagehide is released; back/forward restore can restart', async () => {
        const { page, errors } = await open('delay');
        try {
            await page.goto(`${base}/photo.html`);
            await page.waitForFunction(() => window.photoTest.resolve);
            await page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); window.photoTest.resolve(); });
            await page.waitForFunction(() => window.photoTest.streams[0]?.getTracks()[0].readyState === 'ended');
            await page.evaluate(() => { window.photoTest.mode = 'allow'; dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
            await page.click('#retryCamera');
            await waitLive(page);
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });

    await t.test('backgrounding and disconnected camera release tracks and offer restart', async () => {
        const { page, errors } = await open();
        try {
            await page.goto(`${base}/photo.html`);
            await waitLive(page);
            await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
            assert.equal(await stopped(page), true);
            assert.equal(await page.isVisible('#retryCamera'), true);
            await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); });
            await page.click('#retryCamera');
            await waitLive(page);
            await page.evaluate(() => window.photoTest.streams.at(-1).getTracks()[0].dispatchEvent(new Event('ended')));
            assert.match(await page.textContent('#photoStatus'), /接続が切れました/);
            assert.equal(await stopped(page), true);
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });

    await t.test('asset failure recovers without opening the camera early', async () => {
        const { page, errors } = await open();
        try {
            await page.route('**/frame-x.svg', route => route.abort());
            await page.goto(`${base}/photo.html`);
            await page.waitForFunction(() => !document.querySelector('#retryCamera').hidden);
            assert.match(await page.textContent('#photoStatus'), /フレーム画像/);
            assert.equal(await page.evaluate(() => window.photoTest.requests.length), 0);
            await page.unroute('**/frame-x.svg');
            await page.click('#retryCamera');
            await waitLive(page);
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });

    await t.test('permission timeout releases a late stream', async () => {
        const { page, errors } = await open('delay');
        try {
            await page.addInitScript(() => {
                const original = window.setTimeout;
                window.setTimeout = (fn, delay, ...args) => original(fn, delay === 30000 ? 500 : delay, ...args);
            });
            await page.goto(`${base}/photo.html`);
            await page.waitForFunction(() => window.photoTest.resolve);
            await page.waitForFunction(() => !document.querySelector('#retryCamera').hidden);
            assert.match(await page.textContent('#photoStatus'), /準備が完了しません/);
            await page.evaluate(() => window.photoTest.resolve());
            await page.waitForFunction(() => window.photoTest.streams[0]?.getTracks()[0].readyState === 'ended');
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });

    await t.test('file share cancellation preserves the captured image', async () => {
        const { page, errors } = await open();
        try {
            await page.addInitScript(() => {
                navigator.canShare = () => true;
                navigator.share = async ({ files }) => { window.photoTest.sharedType = files[0].type; throw new DOMException('Cancelled', 'AbortError'); };
            });
            await page.goto(`${base}/photo.html`);
            await waitLive(page);
            await page.click('#captureButton');
            await page.waitForFunction(() => !document.querySelector('#resultActions').hidden);
            const url = await page.getAttribute('#savePhoto', 'href');
            await page.click('#sharePhoto');
            assert.equal(await page.evaluate(() => window.photoTest.sharedType), 'image/png');
            assert.equal(await page.getAttribute('#savePhoto', 'href'), url);
            assert.equal(await page.isVisible('#resultActions'), true);
            assert.equal(await page.isDisabled('#sharePhoto'), false);
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });
});
