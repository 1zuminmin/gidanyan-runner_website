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
                    if (mode === 'detail') {
                        ctx.fillStyle = '#dfd5c7'; ctx.fillRect(0, 0, 640, 480);
                        ctx.fillStyle = '#607c88';
                        for (let x = 0; x < 640; x += 24) ctx.fillRect(x, 0, 12, 480);
                    }
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
    const selectChoice = async (page, name, value) => {
        const button = page.locator(`#${name}Button`);
        for (let step = 0; step < 4 && await button.getAttribute('value') !== value; step++) await button.click();
        assert.equal(await button.getAttribute('value'), value);
        if (value === 'none') assert.equal(await page.textContent(`#${name}Count`), 'OFF');
    };
    const assertFits = async page => {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const layout = await page.evaluate(() => {
            const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
            const controls = [...document.querySelectorAll('.photo-header a, .photo-header button, .photo-controls button, .photo-controls a')].filter(visible);
            const liveButtons = [...document.querySelectorAll('#liveControls button')].filter(visible).map(element => element.getBoundingClientRect());
            const preview = document.querySelector('.photo-preview');
            const bounds = preview.getBoundingClientRect();
            const border = getComputedStyle(preview);
            const contentWidth = bounds.width - parseFloat(border.borderLeftWidth) - parseFloat(border.borderRightWidth);
            const contentHeight = bounds.height - parseFloat(border.borderTopWidth) - parseFloat(border.borderBottomWidth);
            return {
                photoRatio: contentWidth / contentHeight,
                previewFits: bounds.top >= 0 && bounds.left >= 0 && bounds.bottom <= innerHeight + 1 && bounds.right <= innerWidth + 1,
                overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
                tooSmall: controls.filter(element => { const r = element.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(element => element.id),
                oneRow: liveButtons.length === 0 || Math.max(...liveButtons.map(r => r.top)) - Math.min(...liveButtons.map(r => r.top)) <= 4,
                clipped: controls.filter(element => {
                    const r = element.getBoundingClientRect();
                    return r.top < 0 || r.left < 0 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1;
                }).map(element => element.id || element.className)
            };
        });
        assert.equal(layout.overflow, false, 'the main screen needs no scrolling');
        assert.deepEqual(layout.clipped, [], 'all controls remain visible');
        assert.deepEqual(layout.tooSmall, [], 'touch targets stay at least 44px');
        assert.equal(layout.oneRow, true, 'live controls stay on one row');
        assert.ok(Math.abs(layout.photoRatio - 3 / 4) < 0.001, 'black preview border fits the 3:4 photograph without letterboxing');
        assert.equal(layout.previewFits, true, 'the full photograph remains visible');
    };

    await t.test('frames overlay a fixed camera crop, including borderless and translucent artwork', async () => {
        const { page, errors } = await open();
        try {
            await page.goto(base);
            const results = await page.evaluate(async () => {
                const { loadPhotoAssets, renderPhoto, PHOTO_WIDTH: width, PHOTO_HEIGHT: height } = await import('/photo-renderer.mjs');
                const assets = await loadPhotoAssets();
                const source = document.createElement('canvas');
                source.width = source.videoWidth = 640;
                source.height = source.videoHeight = 480;
                const sourceCtx = source.getContext('2d');
                const pattern = sourceCtx.createImageData(640, 480);
                for (let y = 0; y < 480; y++) for (let x = 0; x < 640; x++) {
                    const i = (y * 640 + x) * 4;
                    pattern.data.set([Math.round(x * 255 / 639), Math.round(y * 255 / 479), (Math.floor(x / 24) + Math.floor(y / 24)) % 2 * 255, 255], i);
                }
                sourceCtx.putImageData(pattern, 0, 0);
                const output = document.createElement('canvas');
                output.width = width; output.height = height;
                const ctx = output.getContext('2d', { willReadFrequently: true });
                const overlay = document.createElement('canvas');
                overlay.width = width; overlay.height = height;
                const overlayCtx = overlay.getContext('2d');
                const decoration = document.createElement('canvas');
                decoration.width = width; decoration.height = height;
                const decorationCtx = decoration.getContext('2d');
                decorationCtx.fillStyle = 'rgba(255, 128, 0, 0.5)';
                decorationCtx.fillRect(400, 500, 110, 90);
                const checks = [];
                for (const mirror of [false, true]) {
                    renderPhoto(ctx, source, assets, 'none', 'none', mirror);
                    const baseline = ctx.getImageData(0, 0, width, height).data;
                    for (const frame of ['insta', 'x', 'original', 'borderless']) {
                        const artwork = frame === 'borderless' ? decoration : assets[frame];
                        renderPhoto(ctx, source, { ...assets, borderless: artwork }, frame, 'none', mirror);
                        const actual = ctx.getImageData(0, 0, width, height).data;
                        overlayCtx.clearRect(0, 0, width, height);
                        overlayCtx.drawImage(artwork, width * 0.05, height * 0.05, width * 0.9, height * 0.9);
                        const layer = overlayCtx.getImageData(0, 0, width, height).data;
                        let transparentPixels = 0, movedPixels = 0, blendedPixels = 0, blendErrors = 0;
                        const blendSamples = [];
                        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                            // Inside the card, even translucent artwork must leave the camera
                            // unchanged. The outer band is tested separately for corners/shadow.
                            if (x < 116 || x >= 964 || y < 134 || y >= 1306) continue;
                            const i = (y * width + x) * 4;
                            if (layer[i + 3] === 0) {
                                transparentPixels++;
                                if ([0, 1, 2, 3].some(c => actual[i + c] !== baseline[i + c])) movedPixels++;
                            } else if (layer[i + 3] < 255) {
                                // SVG/bitmap edge antialiasing can differ across canvas backends.
                                // Verify alpha blending in flat translucent areas, away from edges.
                                if (![i - 4, i + 4, i - width * 4, i + width * 4].every(neighbor =>
                                    [0, 1, 2, 3].every(c => layer[neighbor + c] === layer[i + c]))) continue;
                                blendedPixels++;
                                const alpha = layer[i + 3] / 255;
                                if ([0, 1, 2].some(c => Math.abs(actual[i + c] - (layer[i + c] * alpha + baseline[i + c] * (1 - alpha))) > 2)) {
                                    blendErrors++;
                                    if (blendSamples.length < 2) blendSamples.push({ x, y, actual: Array.from(actual.slice(i, i + 4)), layer: Array.from(layer.slice(i, i + 4)), baseline: Array.from(baseline.slice(i, i + 4)) });
                                }
                            }
                        }
                        checks.push({ frame, mirror, transparentPixels, movedPixels, blendedPixels, blendErrors, blendSamples });
                    }
                }
                // A solid test card makes its 5% inset, rounded corner, and outer shadow
                // measurable without depending on the supplied artwork's opaque areas.
                const solid = document.createElement('canvas');
                solid.width = width; solid.height = height;
                const solidCtx = solid.getContext('2d');
                solidCtx.fillStyle = '#ff00ff'; solidCtx.fillRect(0, 0, width, height);
                renderPhoto(ctx, source, assets, 'none', 'none', false);
                const baseline = ctx.getImageData(0, 0, width, height).data;
                renderPhoto(ctx, source, { ...assets, solid }, 'solid', 'none', false);
                const pixel = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
                const geometry = {
                    insetTop: pixel(540, 90), roundedCorner: pixel(60, 78),
                    margin: pixel(20, 720), shadow: pixel(540, 1380),
                    shadowBaseline: Array.from(baseline.slice((1380 * width + 540) * 4, (1380 * width + 540) * 4 + 4))
                };
                renderPhoto(ctx, source, assets, 'none', 'none', false);
                geometry.offMatches = ctx.getImageData(0, 0, width, height).data.every((value, i) => value === baseline[i]);
                return { checks, geometry };
            });
            for (const result of results.checks) {
                assert.ok(result.transparentPixels > 1000);
                assert.equal(result.movedPixels, 0, `${result.frame}, mirror=${result.mirror}: camera pixels match frame OFF exactly`);
                assert.equal(result.blendErrors, 0, `${result.frame}: translucent pixels blend over the unchanged camera image; ${JSON.stringify(result.blendSamples)}`);
                if (result.frame === 'borderless') assert.ok(result.blendedPixels > 100);
            }
            assert.deepEqual(results.geometry.insetTop, [255, 0, 255, 255], 'the frame lies inside a 5% margin');
            assert.notDeepEqual(results.geometry.roundedCorner, [255, 0, 255, 255], 'the card corner is rounded');
            assert.notDeepEqual(results.geometry.margin, [255, 0, 255, 255], 'camera remains visible around the card');
            assert.ok(results.geometry.shadow[1] < results.geometry.shadowBaseline[1], 'a subtle shadow appears below the card');
            assert.equal(results.geometry.offMatches, true, 'frame OFF removes both artwork and shadow');
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });

    await t.test('only the rounded card exterior is blurred; OFF, live updates and sharp poses are preserved', async () => {
        const { page, errors } = await open('detail');
        try {
            await page.goto(base);
            const checks = await page.evaluate(async () => {
                const { renderPhoto, PHOTO_WIDTH: width, PHOTO_HEIGHT: height } = await import('/photo-renderer.mjs');
                const makeCanvas = () => Object.assign(document.createElement('canvas'), { width, height });
                const source = makeCanvas();
                source.videoWidth = width; source.videoHeight = height;
                const sourceCtx = source.getContext('2d');
                sourceCtx.fillStyle = '#282828'; sourceCtx.fillRect(0, 0, width, height);
                sourceCtx.fillStyle = '#dcdcdc';
                for (let x = 12; x < width; x += 24) sourceCtx.fillRect(x, 0, 12, height);
                const output = makeCanvas();
                const ctx = output.getContext('2d', { willReadFrequently: true });
                const pose = makeCanvas();
                const poseCtx = pose.getContext('2d');
                poseCtx.fillStyle = '#ff00ff'; poseCtx.fillRect(0, 0, width, height);
                // Transparent artwork isolates the blur mask from any frame artwork/shadow.
                const assets = { probe: makeCanvas(), pose1: pose };
                const render = (frame, mirror, pose = 'none') => {
                    renderPhoto(ctx, source, assets, frame, pose, mirror);
                    return ctx.getImageData(0, 0, width, height).data;
                };
                const pixel = (data, x, y) => Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
                const results = [];
                for (const mirror of [false, true]) {
                    const baseline = render('none', mirror);
                    const blurred = render('probe', mirror);
                    let changedInside = 0;
                    for (let y = 140; y < 1300; y++) for (let x = 120; x < 960; x++) {
                        const i = (y * width + x) * 4;
                        if ([0, 1, 2, 3].some(c => blurred[i + c] !== baseline[i + c])) changedInside++;
                    }
                    results.push({
                        mirror, changedInside,
                        // Includes a point inside the rectangular bounds but outside its rounded corner.
                        outside: [[20, 720], [1060, 720], [540, 20], [540, 1420], [60, 78]].map(([x, y]) => ({
                            before: pixel(baseline, x, y), after: pixel(blurred, x, y)
                        })),
                        offMatches: render('none', mirror).every((value, i) => value === baseline[i]),
                        pose: pixel(render('probe', mirror, 'pose1'), 800, 1000)
                    });
                }
                // A new source frame must replace the cached work image, including all four edges.
                sourceCtx.fillStyle = '#4078b0'; sourceCtx.fillRect(0, 0, width, height);
                const updated = render('probe', false);
                return { results, edges: [[0, 0], [1079, 0], [0, 1439], [1079, 1439]].map(([x, y]) => pixel(updated, x, y)) };
            });
            for (const result of checks.results) {
                assert.equal(result.changedInside, 0, `mirror=${result.mirror}: the entire card interior stays pixel-identical`);
                for (const { before, after } of result.outside) {
                    assert.ok(Math.abs(before[0] - after[0]) > 30, 'fine exterior stripes are softened');
                    assert.ok(after[0] > 90 && after[0] < 170, 'blur reduces contrast without changing brightness');
                    assert.equal(after[3], 255);
                }
                assert.equal(result.offMatches, true, 'OFF immediately restores the sharp camera at the same crop');
                assert.deepEqual(result.pose, [255, 0, 255, 255], 'the character is drawn sharply above the blurred camera');
            }
            for (const edge of checks.edges) assert.deepEqual(edge, [64, 120, 176, 255], 'new frames update and edges do not darken');
            await page.goto(`${base}/photo.html`);
            await waitLive(page);
            if (process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'photo-blur-live.png'), fullPage: true });
            assert.deepEqual(errors, []);
        } finally { await page.close(); }
    });

    await t.test('home → 12 frame/pose combinations including OFF → PNG → retake → home; preview equals export', async () => {
        const { page, errors } = await open();
        try {
            await page.goto(base);
            assert.match(await page.locator('a[href="photo.html"]').textContent(), /おまけ：ぎだにゃんと記念撮影！/);
            if (process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'photo-home.png'), fullPage: true });
            await page.getByRole('link', { name: /PHOTO/ }).click();
            await waitLive(page);
            assert.equal(await page.evaluate(() => window.photoTest.requests[0].audio), false);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await page.evaluate(() => document.querySelector('#captureButton').getBoundingClientRect().bottom <= innerHeight), true, 'mobile shutter fits in the viewport');
            for (const frame of ['insta', 'x', 'original', 'none']) {
                for (const pose of ['pose1', 'pose2', 'none']) {
                    await selectChoice(page, 'frame', frame);
                    await selectChoice(page, 'pose', pose);
                    if (process.env.PHOTO_SCREENSHOT_DIR && ['insta', 'x'].includes(frame) && pose === 'none') {
                        await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, `photo-frame-${frame}.png`), fullPage: true });
                    }
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
                        const right = Array.from(ctx.getImageData(880, 500, 1, 1).data);
                        const posePixels = ctx.getImageData(690, 855, 300, 360).data;
                        let poseDifferences = 0;
                        for (let i = 0; i < posePixels.length; i += 4) {
                            if ([0, 1, 2].some(c => Math.abs(posePixels[i + c] - right[c]) > 8)) poseDifferences++;
                        }
                        return { width: image.width, height: image.height, type: blob.type,
                            equal: actual.every((v, i) => v === expected[i]),
                            left: Array.from(ctx.getImageData(200, 500, 1, 1).data),
                            right, poseDifferences,
                            corners: [[0, 0], [1079, 0], [0, 1439], [1079, 1439]].map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data)) };
                    });
                    assert.equal(result.width, 1080);
                    assert.equal(result.height, 1440);
                    assert.equal(result.type, 'image/png');
                    assert.equal(result.equal, true);
                    assert.ok(result.left[2] > result.left[0], 'selfie: blue is mirrored to the left');
                    assert.ok(result.right[0] > result.right[2], 'selfie: red is mirrored to the right');
                    if (frame === 'none') {
                        result.corners.forEach((pixel, i) => {
                            assert.equal(pixel[3], 255);
                            assert.ok(i % 2 === 0 ? pixel[2] > pixel[0] : pixel[0] > pixel[2], 'frame OFF fills every corner with camera pixels');
                        });
                        assert.equal(result.poseDifferences > 0, pose !== 'none', 'pose selection stays independent of frame OFF');
                    }
                    if (frame === 'none' && pose === 'none') {
                        const [download] = await Promise.all([page.waitForEvent('download'), page.click('#savePhoto')]);
                        assert.match(download.suggestedFilename(), /^gidanyan-photo-.*\.png$/);
                        assert.equal(await download.failure(), null);
                        if (process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'photo-mobile.png'), fullPage: true });
                    }
                    await page.click('#retakeButton');
                    await waitLive(page);
                    assert.equal(await page.getAttribute('#frameButton', 'value'), frame);
                    assert.equal(await page.getAttribute('#poseButton', 'value'), pose);
                }
            }
            await page.locator('#frameButton').press('Enter');
            await page.locator('#poseButton').press('Space');
            assert.equal(await page.getAttribute('#frameButton', 'value'), 'insta', 'frame wraps from OFF to first');
            assert.equal(await page.getAttribute('#poseButton', 'value'), 'pose1', 'pose wraps from OFF to first');
            assert.equal(await page.textContent('#frameCount'), '1 / 3');
            assert.equal(await page.textContent('#poseCount'), '1 / 2');
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
            await page.route('**/frame-x.png', route => route.abort());
            await page.goto(`${base}/photo.html`);
            await page.waitForFunction(() => !document.querySelector('#retryCamera').hidden);
            assert.match(await page.textContent('#photoStatus'), /フレーム画像/);
            assert.equal(await page.evaluate(() => window.photoTest.requests.length), 0);
            await page.unroute('**/frame-x.png');
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

    await t.test('small and landscape screens fit live, captured and error states; help closes and restores focus', async () => {
        const { page, errors } = await open();
        try {
            await page.goto(`${base}/photo.html`);
            await waitLive(page);
            for (const viewport of [{ width: 320, height: 480 }, { width: 320, height: 568 }, { width: 390, height: 664 }, { width: 390, height: 844 }, { width: 568, height: 320 }, { width: 844, height: 390 }]) {
                await page.setViewportSize(viewport);
                await assertFits(page);
                if (process.env.PHOTO_SCREENSHOT_DIR && viewport.width === 390 && viewport.height === 664) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'photo-compact-live.png'), fullPage: true });
                await page.click('#helpButton');
                assert.equal(await page.isVisible('#helpDialog'), true);
                await page.getByRole('button', { name: '閉じる' }).click();
                assert.equal(await page.isVisible('#helpDialog'), false);
                assert.equal(await page.evaluate(() => document.activeElement.id), 'helpButton');
                await page.click('#captureButton');
                await page.waitForFunction(() => !document.querySelector('#resultActions').hidden);
                await assertFits(page);
                await page.click('#retakeButton');
                await waitLive(page);
            }
            await page.click('#helpButton');
            await page.keyboard.press('Escape');
            assert.equal(await page.isVisible('#helpDialog'), false);
            assert.deepEqual(errors, []);
        } finally { await page.close(); }

        const denied = await open('deny');
        try {
            await denied.page.goto(`${base}/photo.html`);
            await denied.page.waitForFunction(() => !document.querySelector('#retryCamera').hidden);
            for (const viewport of [{ width: 320, height: 480 }, { width: 390, height: 664 }, { width: 568, height: 320 }]) {
                await denied.page.setViewportSize(viewport);
                await assertFits(denied.page);
                assert.equal(await denied.page.evaluate(() => {
                    const title = document.querySelector('#previewMessage').getBoundingClientRect();
                    const detail = document.querySelector('#photoStatus').getBoundingClientRect();
                    const cover = document.querySelector('#previewCover').getBoundingClientRect();
                    return detail.top >= title.bottom && detail.bottom <= cover.bottom;
                }), true, 'error detail sits below its heading inside the preview');
                if (process.env.PHOTO_SCREENSHOT_DIR && viewport.width === 390) await denied.page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'photo-compact-error.png'), fullPage: true });
            }
            assert.deepEqual(denied.errors, []);
        } finally { await denied.page.close(); }
    });
});
