import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { startSiteServer } from './helpers/site-server.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

test('game navigation and moved URLs work under the GitHub Pages project path', async t => {
    const { base, close } = await startSiteServer();
    t.after(close);
    const browser = await chromium.launch({ channel: process.env.PHOTO_TEST_BROWSER || 'chrome', headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [], missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
        if (response.url().startsWith(base) && response.status() >= 400) missing.push(new URL(response.url()).pathname);
    });
    // Verify the host page's paths/handshake without downloading the unchanged Unity binary.
    await page.route('**/game/index.html?**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
        <title>Test game</title><script>
        const p = new URLSearchParams(location.search);
        parent.postMessage({ source: 'gidanyan-unity', type: 'ready', difficulty: p.get('difficulty'), loadId: p.get('loadId') }, location.origin);
        </script>` }));
    await page.addInitScript(() => {
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Test camera disabled', 'NotAllowedError'); } });
    });
    await page.goto(base);
    await page.getByRole('link', { name: /GAME START/ }).click();
    assert.equal(page.url(), `${base}/game/stage-select.html`);
    assert.match(await page.locator('a[href="stage4.html"]').textContent(), /スコアアタック！/);
    if (process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'game-grouped-selection.png'), fullPage: true });
    for (const [index, difficulty] of ['easy', 'normal', 'hard', 'ex'].entries()) {
        await page.locator(`a[href="stage${index + 1}.html"]`).click();
        await page.waitForFunction(() => !document.querySelector('#nextBtn').disabled);
        assert.equal(await page.locator('#mangaImage').evaluate(img => img.complete && img.naturalWidth > 0), true);
        assert.equal(await page.locator('.manga-box').evaluate(box => getComputedStyle(box).borderTopWidth), '5px');
        assert.equal(await page.getByRole('button', { name: 'BACK', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: 'NEXT', exact: true }).click();
        assert.equal(await page.locator('#pageNumber').textContent(), '2 / 4');
        await page.getByRole('button', { name: 'BACK', exact: true }).click();
        assert.equal(await page.locator('#pageNumber').textContent(), '1 / 4');
        assert.equal(await page.getByRole('button', { name: 'BACK', exact: true }).isDisabled(), true);
        if (index === 0) {
            for (const width of [320, 390, 768]) {
                await page.setViewportSize({ width, height: 844 });
                const layout = await page.evaluate(() => {
                    const image = document.querySelector('#mangaImage').getBoundingClientRect();
                    const box = document.querySelector('.manga-box').getBoundingClientRect();
                    const back = document.querySelector('#prevBtn').getBoundingClientRect();
                    const next = document.querySelector('#nextBtn').getBoundingClientRect();
                    const exit = document.querySelector('.back-link').getBoundingClientRect();
                    return {
                        imageRatio: image.width / image.height,
                        frameWidth: box.width - image.width * 1252 / 1536,
                        frameHeight: box.height - image.height * 916 / 2048,
                        panelLeft: image.left + image.width * 142 / 1536 - box.left,
                        panelTop: image.top + image.height * 566 / 2048 - box.top,
                        controlsBelowImage: back.top >= box.bottom && next.top >= box.bottom,
                        buttonsSideBySide: Math.abs(back.top - next.top) < 1 && back.right < next.left,
                        tapSize: Math.min(back.height, next.height), exitAboveImage: exit.bottom <= box.top,
                        overflow: document.documentElement.scrollWidth > innerWidth
                    };
                });
                assert.ok(Math.abs(layout.imageRatio - 0.75) < 0.001);
                assert.ok(Math.abs(layout.frameWidth - 10) < 1 && Math.abs(layout.frameHeight - 10) < 1, 'frame hugs the comic panel');
                assert.ok(Math.abs(layout.panelLeft - 5) < 1 && Math.abs(layout.panelTop - 5) < 1, 'the whole panel fits inside the border');
                assert.equal(layout.controlsBelowImage && layout.buttonsSideBySide && layout.exitAboveImage, true);
                assert.ok(layout.tapSize >= 44);
                assert.equal(layout.overflow, false);
                if (process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, `manga-navigation-${width}.png`), fullPage: true });
            }
            await page.setViewportSize({ width: 390, height: 844 });
        }
        for (let step = 0; step < 3; step++) {
            await page.getByRole('button', { name: 'NEXT', exact: true }).click();
            if (index === 0 && process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, `manga-page-${step + 2}.png`), fullPage: true });
        }
        await page.getByRole('button', { name: 'BACK', exact: true }).click();
        assert.equal(await page.locator('#pageNumber').textContent(), '3 / 4');
        await page.getByRole('button', { name: 'NEXT', exact: true }).click();
        await page.getByRole('button', { name: 'PLAY', exact: true }).click();
        assert.equal(await page.locator('#mangaReader').isHidden(), true);
        const frameURL = new URL(await page.locator('#unityFrame').getAttribute('src'));
        assert.equal(frameURL.pathname, new URL(`${base}/game/index.html`).pathname);
        assert.equal(frameURL.searchParams.get('difficulty'), difficulty);
        assert.equal(await page.locator('#unityContainer').getAttribute('aria-hidden'), 'false');
        await page.getByRole('link', { name: '戻る', exact: true }).click();
        assert.equal(page.url(), `${base}/game/stage-select.html`);
    }
    await page.getByRole('link', { name: '戻る', exact: true }).click();
    assert.equal(page.url(), `${base}/index.html`);
    await page.getByRole('link', { name: /PHOTO/ }).click();
    await page.waitForFunction(() => !document.querySelector('#retryCamera').hidden);
    assert.equal(page.url(), `${base}/photo/index.html`);
    if (process.env.PHOTO_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PHOTO_SCREENSHOT_DIR, 'photo-back-label.png'), fullPage: true });
    await page.getByRole('link', { name: '戻る', exact: true }).click();
    assert.equal(page.url(), `${base}/index.html`);
    assert.deepEqual(missing, [], 'canonical pages and their resources never fall back to 404');

    for (const [oldPath, newPath] of [['stage-select.html', 'game/stage-select.html'], ...[1, 2, 3, 4].map(i => [`stage${i}.html`, `game/stage${i}.html`]), ['photo.html', 'photo/index.html']]) {
        await page.goto(`${base}/${oldPath}?from=bookmark#keep`);
        await page.waitForURL(`${base}/${newPath}?from=bookmark#keep`);
    }
    assert.deepEqual(errors, []);
});
