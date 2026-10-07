const mangaPages = [
    "images/stage1_manga-p1.png",
    "images/stage1_manga-p2.png",
    "images/stage1_manga-p3.png",
    "images/stage1_manga-p4.png"
];

let currentPage = 0;
const mangaImages = [];
let mangaState = "idle";
let useInitialImage = true;
let mangaRetryCount = 0;
let unityState = "idle";
let unityLoadId = 0;
let unityLoadTimeout;

const UNITY_URL = "./index.html?v=20261007-stages1";
const UNITY_MESSAGE_SOURCE = "gidanyan-unity";
const UNITY_LOAD_TIMEOUT_MS = 180000;
const MANGA_LOAD_TIMEOUT_MS = 60000;
const difficulty = document.body.dataset.difficulty;
const difficultyLabel = document.body.dataset.difficultyLabel;

let mangaImage =
    document.getElementById("mangaImage");

const mangaStatus = document.getElementById("mangaStatus");
const mangaRetryBtn = document.getElementById("mangaRetryBtn");

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

async function loadMangaImage(index) {
    const image = index === 0 && useInitialImage ? mangaImage : new Image();
    useInitialImage = false;
    image.id = "mangaImage";
    image.className = "manga-image";
    image.alt = `${difficultyLabel}の漫画・${index + 1}ページ目`;
    image.fetchPriority = index === 0 ? "high" : "auto";
    image.decoding = "async";

    if (image !== mangaImage) {
        const url = new URL(mangaPages[index], window.location.href);
        if (mangaRetryCount > 0) url.searchParams.set("mangaRetry", String(mangaRetryCount));
        image.src = url.href;
    }

    let timeout;
    try {
        await Promise.race([
            image.decode(),
            new Promise((_, reject) => {
                timeout = window.setTimeout(() => reject(new Error("Manga load timed out")), MANGA_LOAD_TIMEOUT_MS);
            })
        ]);
        return image;
    } catch (error) {
        // Stop a stalled request before retrying; keep the currently displayed page intact.
        image.removeAttribute("src");
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

function showMangaPage(index) {
    const image = mangaImages[index];
    if (!image) return;
    image.hidden = false;
    if (image !== mangaImage) mangaImage.replaceWith(image);
    mangaImage = image;
    currentPage = index;
    pageNumber.textContent = `${index + 1} / ${mangaPages.length}`;
    pageNumber.hidden = false;
}

async function prepareManga() {
    if (mangaState === "loading" || mangaState === "ready") return;
    mangaState = "loading";
    updateActionButton();

    try {
        // Display page 1 first, then prepare pages 2–4 in reading order.
        // Retain decoded image elements so turning a page never starts another download.
        while (mangaImages.length < mangaPages.length) {
            const index = mangaImages.length;
            const image = await loadMangaImage(index);
            mangaImages.push(image);
            if (index === 0) showMangaPage(0);
            updateActionButton();
        }
        mangaState = "ready";
        startUnityLoad();
    } catch {
        mangaState = "error";
        updateActionButton();
    }
}

function updateActionButton() {
    const isLastPage = currentPage === mangaPages.length - 1;

    nextBtn.classList.remove("is-loading", "is-error");
    unityStatus.hidden = true;
    mangaRetryBtn.hidden = mangaState !== "error";
    mangaRetryBtn.disabled = mangaState === "loading";
    mangaStatus.hidden = true;

    if (mangaState === "error") {
        mangaStatus.hidden = false;
        mangaStatus.textContent = `漫画の${mangaImages.length + 1}ページ目を読み込めませんでした。「漫画を再試行」を押してください。`;
    }

    if (!mangaImages[0] || (!isLastPage && !mangaImages[currentPage + 1])) {
        nextBtn.disabled = true;
        btnText.textContent = mangaState === "error" ? "NEXT" : "漫画読込中…";
        if (mangaState !== "error") {
            nextBtn.classList.add("is-loading");
            mangaStatus.hidden = false;
            mangaStatus.textContent = mangaImages[0] ? "次のページを読み込んでいます…" : "漫画を読み込んでいます…";
        }
        return;
    }

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
    if (mangaState !== "ready") return;
    window.clearTimeout(unityLoadTimeout);

    unityLoadId++;
    setUnityState("loading");

    const url = new URL(UNITY_URL, window.location.href);
    url.searchParams.set("difficulty", difficulty);
    url.searchParams.set("loadId", String(unityLoadId));

    if (isRetry) {
        url.searchParams.set("retry", String(Date.now()));
    }

    // 漫画4枚の取得・デコード後に、画面外のiframeでUnityを準備する。
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
        String(message.loadId) !== String(unityLoadId) ||
        message.difficulty !== difficulty ||
        !["ready", "error"].includes(message.type) ||
        unityState !== "loading"
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
    if (nextBtn.disabled) return;

    // まだ次の漫画がある場合
    if (currentPage < mangaPages.length - 1) {

        showMangaPage(currentPage + 1);
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

mangaRetryBtn.addEventListener("click", () => {
    if (mangaState !== "error") return;
    mangaRetryCount++;
    prepareManga();
});

prepareManga();
