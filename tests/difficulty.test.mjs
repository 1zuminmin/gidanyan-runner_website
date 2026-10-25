import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

const launcher = readFileSync(new URL("../game/launch.js", import.meta.url), "utf8");
const swipeScript = readFileSync(new URL("../game/manga-swipe.js", import.meta.url), "utf8");
const pageScript = swipeScript + "\n" + readFileSync(new URL("../game/script.js", import.meta.url), "utf8");
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
    return { children: [], clientWidth: 320, scrollLeft: 0, appendChild(child) { this.children.push(child); }, setPointerCapture() {}, scrollTo({left}) { this.scrollLeft=left; this.scroll?.(); }, style: {}, hidden: false, textContent: "", disabled: false, contentWindow: {},
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
    get("#mangaTrack").children.push(element());
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


for (const course of Object.keys(stageLabels)) for (let startPage=0; startPage<4; startPage++) test(`${course}: PLAY is visible from page 1 and starts from page ${startPage+1}`, async () => {
 const e=environment(course);runInNewContext(pageScript,e.context);await tick();
 const track=e.get('#mangaTrack'),button=e.get('#nextBtn'),frame=e.get('#unityFrame');
 assert.equal(track.children.length,4);assert.equal(button.hidden,false);assert.equal(button.disabled,true);
 assert.equal(button.querySelector('.btn-text').textContent,'PLAY');
 button.click();assert.equal(e.get('#unityContainer').classList.contains('is-visible'),false);
 const valid={source:frame.contentWindow,origin:'http://localhost',data:{source:'gidanyan-unity',difficulty:course,type:'ready',loadId:'1'}};
 e.window.message({...valid,origin:'https://evil.example'});assert.equal(button.disabled,true);
 e.window.message(valid);assert.equal(button.disabled,false);
 track.scrollTo({left:startPage*320});
 assert.equal(button.hidden,false);assert.equal(button.disabled,false);
 button.click();assert.equal(e.get('#unityContainer').classList.contains('is-visible'),true);
});
test('slow or failed manga remains readable, retry resumes, Unity waits for all pages',async()=>{
 const e=environment('easy',{manualImages:true});runInNewContext(pageScript,e.context);
 const frame=e.get('#unityFrame');assert.equal(frame.src,undefined);
 e.decodeRequests[0].resolve();await tick();
 assert.equal(e.get('#pageNumber').textContent,'1 / 4');
 e.decodeRequests[1].reject(new Error('offline'));await tick();
 assert.equal(e.get('#mangaRetryBtn').hidden,false);assert.equal(frame.src,undefined);
 e.get('#mangaRetryBtn').click();e.decodeRequests[2].resolve();await tick();
 e.decodeRequests[3].resolve();await tick();e.decodeRequests[4].resolve();await tick();
 assert.equal(e.get('#mangaTrack').children.length,4);assert.ok(frame.src);
});
