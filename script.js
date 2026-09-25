const mangaPages = [
    "images/stage1_manga-p1.png",
    "images/stage1_manga-p2.png",
    "images/stage1_manga-p3.png",
    "images/stage1_manga-p4.png"
];

let currentPage = 0;
let unityState = "loading";
let unityLoadId = 0;
let unityLoadTimeout;

const UNITY_URL = "./game/index.html?v=20260924-2003";
const UNITY_MESSAGE_SOURCE = "gidanyan-unity";
const UNITY_LOAD_TIMEOUT_MS = 180000;

const mangaImage =
    document.getElementById("mangaImage");

const pageNumber =
    document.getElementById("pageNumber");

const nextBtn =
    document.getElementById("nextBtn");

const btnText =
    nextBtn.querySelector(".btn-text");

const mangaBox =
    document.querySelector(".manga-box");

const unityContainer =
    document.getElementById("unityContainer");

const unityFrame =
    document.getElementById("unityFrame");

const unityStatus =
    document.getElementById("unityStatus");

const unityOrigin =
    new URL(UNITY_URL, window.location.href).origin;

function updateActionButton() {
    const isLastPage = currentPage === mangaPages.length - 1;

    nextBtn.classList.remove("is-loading", "is-error");
    unityStatus.hidden = true;

    if (!isLastPage) {
        nextBtn.disabled = false;
        btnText.textContent = "NEXT";
        return;
    }

    if (unityState === "ready") {
        nextBtn.disabled = false;
        btnText.textContent = "PLAY";
        return;
    }

    unityStatus.hidden = false;

    if (unityState === "error") {
        nextBtn.disabled = false;
        nextBtn.classList.add("is-error");
        btnText.textContent = "再試行";
        return;
    }

    nextBtn.disabled = true;
    nextBtn.classList.add("is-loading");
    btnText.textContent = "ゲーム読込中…";
    unityStatus.textContent = "ゲームを準備しています。しばらくお待ちください。";
}

function setUnityState(state, message = "") {
    unityState = state;

    if (state === "error") {
        unityStatus.textContent = message ||
            "ゲームの読み込みに失敗しました。「再試行」を押してください。";
    }

    updateActionButton();
}

function startUnityLoad(isRetry = false) {
    window.clearTimeout(unityLoadTimeout);

    unityLoadId++;
    setUnityState("loading");

    const url = new URL(UNITY_URL, window.location.href);
    url.searchParams.set("loadId", String(unityLoadId));

    if (isRetry) {
        url.searchParams.set("retry", String(Date.now()));
    }

    // 最初の漫画が表示された直後から、画面外の同じiframeでUnityを準備する。
    unityFrame.src = url.href;

    unityLoadTimeout = window.setTimeout(() => {
        setUnityState(
            "error",
            "ゲームの読み込みが時間内に完了しませんでした。「再試行」を押してください。"
        );
    }, UNITY_LOAD_TIMEOUT_MS);
}

window.addEventListener("message", event => {
    if (event.source !== unityFrame.contentWindow || event.origin !== unityOrigin) {
        return;
    }

    const message = event.data;

    if (
        !message ||
        message.source !== UNITY_MESSAGE_SOURCE ||
        String(message.loadId) !== String(unityLoadId)
    ) {
        return;
    }

    window.clearTimeout(unityLoadTimeout);

    if (message.type === "ready") {
        setUnityState("ready");
    } else if (message.type === "error") {
        setUnityState(
            "error",
            message.message || "ゲームの読み込みに失敗しました。「再試行」を押してください。"
        );
    }
});

nextBtn.addEventListener("click", () => {

    // まだ次の漫画がある場合
    if (currentPage < mangaPages.length - 1) {

        currentPage++;

        mangaImage.src = mangaPages[currentPage];
        mangaImage.alt = `ステージ1の漫画・${currentPage + 1}ページ目`;

        pageNumber.textContent =
            `${currentPage + 1} / ${mangaPages.length}`;

        updateActionButton();

        return;
    }

    if (unityState === "error") {
        startUnityLoad(true);
        return;
    }

    if (unityState !== "ready") {
        return;
    }

    // 4枚目でPLAYを押した場合
    mangaBox.style.display = "none";
    nextBtn.style.display = "none";
    unityStatus.hidden = true;

    // 読み込み済みのiframeをそのまま画面内へ移動する。
    unityContainer.classList.remove("is-preloading");
    unityContainer.classList.add("is-visible");
    unityContainer.setAttribute("aria-hidden", "false");

    unityContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

startUnityLoad();
