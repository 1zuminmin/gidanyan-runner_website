import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const launcher = readFileSync(new URL("../game/launch.js", import.meta.url), "utf8");
const pageScript = readFileSync(new URL("../game/script.js", import.meta.url), "utf8");
const stageLabels = { easy: "Easy", normal: "Normal", hard: "Hard", ex: "EX" };
const tick = () => new Promise(resolve => setImmediate(resolve));

test("all stage links open pages that pass the selected stage to the shared loader", () => {
    const selection = readFileSync(new URL("../game/stage-select.html", import.meta.url), "utf8");
    Object.entries(stageLabels).forEach(([difficulty, label], index) => {
        const page = `stage${index + 1}.html`;
        assert.ok(selection.includes(`href="${page}"`));
        const html = readFileSync(new URL(`../game/${page}`, import.meta.url), "utf8");
        assert.ok(html.includes(`data-difficulty="${difficulty}"`));
        assert.ok(html.includes(`data-difficulty-label="${label}"`));
        assert.match(html, /id="unityFrame"/);
        assert.match(html, /src="script\.js\?v=/);
    });
    assert.doesNotMatch(selection, /準備中/);
});

function element() {
    const classes = new Set();
    return { style: {}, hidden: false, textContent: "", disabled: false, contentWindow: {},
        classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) },
        setAttribute() {}, removeAttribute(name) { delete this[name]; }, scrollIntoView() {}, addEventListener(type, fn) { this[type] = fn; },
        querySelector() { return this.label ??= element(); } };
}

function environment(difficulty = "easy", { manualImages = false } = {}) {
    const elements = new Map();
    const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
    const messages = [], scripts = [], timers = new Map(), timerDelays = new Map(), decodeRequests = [];
    let timerId = 0;
    function makeImage() {
        const image = element();
        image.replaceWith = replacement => elements.set("#mangaImage", replacement);
        image.decode = () => new Promise((resolve, reject) => {
            decodeRequests.push({ image, resolve, reject });
            if (!manualImages) resolve();
        });
        return image;
    }
    const initialImage = makeImage();
    initialImage.src = "images/stage1_manga-p1.png";
    initialImage.hidden = true;
    elements.set("#mangaImage", initialImage);
    get("#pageNumber").hidden = true;
    const window = { location: { search: difficulty === null ? "" : `?difficulty=${difficulty}&loadId=1`, origin: "http://localhost", href: "http://localhost/gidanyan-runner_website/game/stage1.html" },
        parent: { postMessage: message => messages.push(message) },
        setTimeout(fn, delay) { const id = ++timerId; timerDelays.set(id, delay); timers.set(id, () => { timers.delete(id); timerDelays.delete(id); fn(); }); return id; },
        clearTimeout(id) { timers.delete(id); timerDelays.delete(id); }, addEventListener(type, fn) { this[type] = fn; } };
    const document = { body: { dataset: { difficulty, difficultyLabel: stageLabels[difficulty] }, appendChild: script => scripts.push(script) },
        querySelector: get, getElementById: id => get(`#${id}`), createElement: element, addEventListener() {} };
    const context = { window, document, URL, URLSearchParams, console, Image: makeImage, createUnityInstance: async () => ({ SetFullscreen() {} }) };
    return { context, window, get, messages, scripts, timers, timerDelays, decodeRequests };
}

function launch(difficulty) {
    const env = environment(difficulty);
    runInNewContext(launcher + '\nstartGidanyanGame({}, "Build/unity.loader.js");', env.context);
    return env;
}

for (const difficulty of Object.keys(stageLabels)) {
    test(`${difficulty}: loader completion alone cannot enable PLAY`, async () => {
        const e = launch(difficulty);
        e.scripts[0].onload();
        await tick();
        assert.equal(e.messages.length, 0);
        e.window.gidanyanStageLoaded(difficulty, "");
        await tick();
        assert.equal(e.messages[0].type, "ready");
        assert.equal(e.messages[0].difficulty, difficulty);
        assert.equal(e.get("#status").textContent, `${stageLabels[difficulty]}の準備ができました`);
        assert.equal(e.timers.size, 0);
    });
}

test("scene readiness can arrive before the Unity instance", async () => {
    const e = launch("easy");
    e.window.gidanyanStageLoaded("easy", "");
    await tick();
    assert.equal(e.messages.length, 0);
    e.scripts[0].onload();
    await tick();
    assert.equal(e.messages[0].type, "ready");
});

test("a mismatched scene is an error", async () => {
    const e = launch("easy");
    e.scripts[0].onload();
    e.window.gidanyanStageLoaded("normal", "");
    await tick();
    assert.equal(e.messages[0].type, "error");
    assert.equal(e.get("#loading").classList.contains("hidden"), false);
});

for (const difficulty of ["unknown", "", "toString", "constructor", "__proto__"]) {
    test(`${difficulty || "empty"}: unsupported selection starts no download`, () => {
        const e = launch(difficulty);
        assert.equal(e.scripts.length, 0);
        assert.equal(e.messages[0].type, "error");
    });
}

test("a direct game link defaults to Normal", async () => {
    const e = launch(null);
    e.scripts[0].onload();
    e.window.gidanyanStageLoaded("normal", "");
    await tick();
    assert.equal(e.messages[0].difficulty, "normal");
    assert.equal(e.messages[0].type, "ready");
});

test("download failures and timeouts report error, never late ready", async () => {
    for (const failure of ["download", "timeout", "scene"]) {
        const e = launch("easy");
        if (failure === "download") e.scripts[0].onerror();
        else if (failure === "timeout") [...e.timers.values()][0]();
        else e.window.gidanyanStageLoaded("easy", "シーンを準備できませんでした。");
        await tick();
        e.scripts[0].onload();
        e.window.gidanyanStageLoaded("easy", "");
        await tick();
        assert.equal(e.messages.length, 1);
        assert.equal(e.messages[0].type, "error");
        assert.equal(e.timers.size, 0);
    }
});

for (const difficulty of Object.keys(stageLabels)) {
    test(`${difficulty}: page navigation, message validation and retry keep the selection`, async () => {
        const e = environment(difficulty);
        runInNewContext(pageScript, e.context);
        await tick();
        const button = e.get("#nextBtn"), frame = e.get("#unityFrame");
        assert.equal(new URL(frame.src).searchParams.get("difficulty"), difficulty);
        assert.equal(new URL(frame.src).pathname, "/gidanyan-runner_website/game/index.html");
        button.click(); button.click(); button.click();
        assert.equal(e.get("#pageNumber").textContent, "4 / 4");
        assert.equal(button.disabled, true);
        const message = { source: frame.contentWindow, origin: "http://localhost", data: { source: "gidanyan-unity", difficulty, type: "ready", loadId: "1" } };
        for (const change of [{ source: {} }, { origin: "http://unrelated.test" }, { data: { ...message.data, loadId: "0" } }, { data: { ...message.data, difficulty: difficulty === "hard" ? "ex" : "hard" } }, { data: { ...message.data, type: "unrelated" } }]) {
            e.window.message({ ...message, ...change });
            assert.equal(button.disabled, true);
            assert.equal(e.timers.size, 1);
        }
        [...e.timers.values()][0]();
        assert.equal(button.querySelector().textContent, "再試行");
        e.window.message(message);
        assert.equal(button.querySelector().textContent, "再試行");
        button.click();
        const retry = new URL(frame.src);
        assert.equal(retry.searchParams.get("difficulty"), difficulty);
        assert.equal(retry.searchParams.get("loadId"), "2");
        assert.ok(retry.searchParams.has("retry"));
        e.window.message(message);
        assert.equal(button.disabled, true);
        e.window.message({ ...message, data: { ...message.data, loadId: "2" } });
        assert.equal(button.querySelector().textContent, "PLAY");
        button.click();
        assert.equal(e.get("#unityContainer").classList.contains("is-visible"), true);
    });
}

function mangaEnvironment() {
    const e = environment("easy", { manualImages: true });
    runInNewContext(pageScript, e.context);
    return e;
}

test("slow manga: display page 1 first, block rapid NEXT, and start Unity only after all four decodes", async () => {
    const e = mangaEnvironment();
    const button = e.get("#nextBtn"), frame = e.get("#unityFrame");
    assert.equal(e.decodeRequests.length, 1);
    assert.equal(e.get("#mangaImage").hidden, true);
    assert.equal(e.get("#pageNumber").hidden, true);
    assert.equal(frame.src, undefined);
    for (let i = 0; i < 3; i++) {
        e.decodeRequests[i].resolve();
        await tick();
        if (i > 0) button.click();
        assert.equal(e.get("#mangaImage"), e.decodeRequests[i].image);
        assert.equal(e.get("#mangaImage").hidden, false);
        assert.equal(e.get("#pageNumber").textContent, `${i + 1} / 4`);
        assert.equal(e.decodeRequests.length, i + 2);
        assert.equal(button.disabled, true);
        button.click(); button.click();
        assert.equal(e.get("#pageNumber").textContent, `${i + 1} / 4`);
        assert.equal(frame.src, undefined);
        assert.deepEqual([...e.timerDelays.values()], [60000]);
    }
    e.decodeRequests[3].resolve();
    await tick();
    assert.equal(new URL(frame.src).searchParams.get("difficulty"), "easy");
    assert.deepEqual([...e.timerDelays.values()], [180000]);
    assert.equal(e.get("#pageNumber").textContent, "3 / 4");
    button.click();
    assert.equal(e.get("#pageNumber").textContent, "4 / 4");
    assert.equal(e.get("#mangaImage"), e.decodeRequests[3].image);
    assert.equal(e.decodeRequests.length, 4);
});

test("first image failure has a retry and never starts Unity", async () => {
    const e = mangaEnvironment();
    e.decodeRequests[0].reject(new Error("Offline"));
    await tick();
    assert.equal(e.get("#mangaRetryBtn").hidden, false);
    assert.equal(e.get("#mangaImage").hidden, true);
    assert.equal(e.get("#pageNumber").hidden, true);
    assert.equal(e.get("#unityFrame").src, undefined);
    assert.equal(e.timers.size, 0);
    e.get("#mangaRetryBtn").click();
    e.get("#mangaRetryBtn").click();
    assert.equal(e.decodeRequests.length, 2);
    assert.match(e.decodeRequests[1].image.src, /stage1_manga-p1\.png\?mangaRetry=1$/);
    e.decodeRequests[1].resolve();
    await tick();
    assert.equal(e.get("#mangaImage"), e.decodeRequests[1].image);
    assert.equal(e.get("#mangaImage").hidden, false);
    assert.equal(e.get("#pageNumber").textContent, "1 / 4");
});

test("failed later page keeps earlier images readable and resumes at the failed page", async () => {
    const e = mangaEnvironment();
    for (let i = 0; i < 3; i++) { e.decodeRequests[i].resolve(); await tick(); }
    e.decodeRequests[3].reject(new Error("Image decode failed"));
    await tick();
    const button = e.get("#nextBtn");
    assert.equal(e.get("#mangaRetryBtn").hidden, false);
    assert.match(e.get("#mangaStatus").textContent, /4ページ目/);
    button.click(); button.click(); button.click();
    assert.equal(e.get("#pageNumber").textContent, "3 / 4");
    assert.equal(e.get("#mangaImage"), e.decodeRequests[2].image);
    assert.equal(e.get("#unityFrame").src, undefined);
    e.get("#mangaRetryBtn").click();
    assert.equal(e.decodeRequests.length, 5);
    assert.match(e.decodeRequests[4].image.src, /stage1_manga-p4\.png\?mangaRetry=1$/);
    assert.equal(e.get("#pageNumber").textContent, "3 / 4");
    e.decodeRequests[4].resolve();
    await tick();
    assert.ok(e.get("#unityFrame").src);
    assert.equal(e.get("#pageNumber").textContent, "3 / 4");
    button.click();
    assert.equal(e.get("#pageNumber").textContent, "4 / 4");
    assert.equal(e.get("#mangaImage"), e.decodeRequests[4].image);
});

test("timed-out image cannot advance the page or start Unity when it completes late", async () => {
    const e = mangaEnvironment();
    e.decodeRequests[0].resolve();
    await tick();
    const stalled = e.decodeRequests[1];
    [...e.timers.values()][0]();
    await tick();
    assert.equal(stalled.image.src, undefined);
    assert.equal(e.get("#mangaRetryBtn").hidden, false);
    e.get("#mangaRetryBtn").click();
    stalled.resolve();
    await tick();
    assert.equal(e.get("#nextBtn").disabled, true);
    assert.equal(e.get("#pageNumber").textContent, "1 / 4");
    assert.equal(e.get("#unityFrame").src, undefined);
    assert.equal(e.decodeRequests.length, 3);
    e.decodeRequests[2].resolve();
    await tick();
    assert.equal(e.get("#nextBtn").disabled, false);
    e.get("#nextBtn").click();
    assert.equal(e.get("#mangaImage"), e.decodeRequests[2].image);
    assert.equal(e.get("#pageNumber").textContent, "2 / 4");
});
