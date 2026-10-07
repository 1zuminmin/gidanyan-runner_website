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
    let timeout;

    const notifyParent = (type, message = "") => {
        window.parent.postMessage({ source: "gidanyan-unity", type, loadId, difficulty, message }, window.location.origin);
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
                fill.style.width = `${Math.round(progress * 100)}%`;
                status.textContent = `ゲームを読み込んでいます ${Math.round(progress * 100)}%`;
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
        notifyParent("ready");
    }).catch(fail);

    document.addEventListener("touchmove", event => event.preventDefault(), { passive: false });
}
