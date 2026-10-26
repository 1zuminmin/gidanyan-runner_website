// Shared by the Unity template and the website. Ready means the selected scene is initialized.
function startGidanyanGame(config, loaderUrl) {
    const params = new URLSearchParams(window.location.search);
    const difficulty = (params.get("difficulty") ?? "normal").toLowerCase();
    const loadId = params.get("loadId") || "";
    const canvas = document.querySelector("#unity-canvas");
    const loading = document.querySelector("#loading");
    const fill = document.querySelector("#fill");
    const status = document.querySelector("#status");
    let finished = false;
    let stageIsReady = false;
    let timeout;
    let lastPercent = -1;

    const notifyParent = (type, message = "") => {
        window.parent.postMessage({ source: "gidanyan-unity", type, loadId, difficulty, message }, window.location.origin);
    };
    window.gidanyanRunState = (reportedDifficulty, state) => {
        if (!stageIsReady || reportedDifficulty !== difficulty) return;
        if (!["started", "cleared", "failed"].includes(state)) return;
        window.parent.postMessage({ source: "gidanyan-unity", loadId, difficulty,
            type: state === "started" ? "run-started" : "result",
            cleared: state === "cleared" }, window.location.origin);
    };
    window.gidanyanRunResult = (reportedDifficulty, score, distance, candy, elapsed) => {
        if (!stageIsReady || difficulty !== "ex" || reportedDifficulty !== difficulty) return;
        if (![score, distance, candy].every(n => Number.isSafeInteger(n) && n >= 0) || !Number.isFinite(elapsed) || elapsed < 0) return;
        window.parent.postMessage({ source: "gidanyan-unity", loadId, difficulty, type: "result-score",
            result: { ruleset: "ex-v1", score, distance, candy, elapsed } }, window.location.origin);
    };
    const fail = error => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        status.textContent = error instanceof Error ? error.message : String(error);
        notifyParent("error", status.textContent);
    };

    const stageLabels = { easy: "Easy", normal: "Normal", hard: "Hard", ex: "EX" };
    if (!Object.hasOwn(stageLabels, difficulty)) {
        fail("この難易度はまだ遊べません。難易度選択へ戻ってください。");
        return;
    }

    const sceneReady = new Promise((resolve, reject) => {
        window.gidanyanStageLoaded = (loadedDifficulty, error) => {
            if (error) reject(new Error(error));
            else if (loadedDifficulty !== difficulty) reject(new Error("選んだ難易度を準備できませんでした。"));
            else resolve();
        };
        timeout = window.setTimeout(() => reject(new Error("ゲームの準備が時間内に完了しませんでした。再試行してください。")), 180000);
    });

    const unityReady = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = loaderUrl;
        script.onload = () => {
            Promise.resolve().then(() => createUnityInstance(canvas, config, progress => {
                if (finished) return;
                if (!Number.isFinite(progress)) return;
                const percent = Math.max(lastPercent, Math.round(Math.max(0, Math.min(1, progress)) * 100));
                fill.style.width = `${percent}%`;
                status.textContent = percent === 100 ? "お出かけ準備中だにゃ！（読み込み完了・起動準備中）" : `お出かけ準備中だにゃ！ ${percent}%`;
                if (percent !== lastPercent) {
                    lastPercent = percent;
                    window.parent.postMessage({ source: "gidanyan-unity", type: "progress", loadId, difficulty, progress: percent }, window.location.origin);
                }
            })).then(resolve, reject);
        };
        script.onerror = () => reject(new Error("ゲームの読み込みファイルを取得できませんでした。再試行してください。"));
        document.body.appendChild(script);
    });

    Promise.all([unityReady, sceneReady]).then(([instance]) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        status.textContent = `${stageLabels[difficulty]}の準備ができました`;
        loading.classList.add("hidden");
        loading.setAttribute("aria-hidden", "true");
        document.querySelector("#fullscreen").onclick = () => instance.SetFullscreen(1);
        stageIsReady = true;
        notifyParent("ready");
    }).catch(fail);

    document.addEventListener("touchmove", event => event.preventDefault(), { passive: false });
}
