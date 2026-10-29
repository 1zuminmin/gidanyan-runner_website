const fallbackMangaPages = [
    "images/stage1_manga-p1.png",
    "images/stage1_manga-p2.png",
    "images/stage1_manga-p3.png",
    "images/stage1_manga-p4.png"
];
const courseMangaPages = {
    "ex": [
        "stories/before/ex/01.png",
        "stories/before/ex/02.png",
        "stories/before/ex/03.png",
        "stories/before/ex/04.png"
    ],
    "easy": [
        "stories/before/easy/01.png",
        "stories/before/easy/02.png",
        "stories/before/easy/03.png",
        "stories/before/easy/04.png"
    ],
    "normal": [
        "stories/before/normal/01.jpg",
        "stories/before/normal/02.jpg",
        "stories/before/normal/03.jpg",
        "stories/before/normal/04.png"
    ],
    "hard": [
        "stories/before/hard/01.png",
        "stories/before/hard/02.png",
        "stories/before/hard/03.png",
        "stories/before/hard/04.png"
    ]
};
const mangaPages = courseMangaPages[document.body.dataset.difficulty] || fallbackMangaPages;

let currentPage = 0;
const mangaImages = [];
let mangaState = "idle";
let useInitialImage = true;
let mangaRetryCount = 0;
let unityState = "idle";
let unityLoadId = 0;
let unityLoadTimeout;
let unityProgress = 0;
const unityProgressBar = document.getElementById("unityProgress");

const UNITY_URL = "./index.html?v=20261028-0331";
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

const mangaTrack = document.getElementById("mangaTrack");

const btnText =
    nextBtn.querySelector(".btn-text");

const mangaReader = document.getElementById("mangaReader");

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
    image.id = `mangaImage-${index}`;
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

    currentPage = index;
    pageNumber.textContent = `${index + 1} / ${mangaPages.length}`;
    pageNumber.hidden = false;
}

async function prepareManga() {
    if (mangaState === "loading" || mangaState === "ready") return;
    mangaState = "loading";
    updateActionButton();

    try {
        // Display page 1 first, then prepare the remaining pages in reading order.
        // Retain decoded image elements so turning a page never starts another download.
        while (mangaImages.length < mangaPages.length) {
            const index = mangaImages.length;
            const image = await loadMangaImage(index);
            mangaImages.push(image);
            image.hidden = false;
            if (index === 0) {
                if (image !== mangaImage) mangaImage.replaceWith(image);
                mangaImage = image;
            } else {
                const slide = document.createElement("div");
                slide.className = "manga-slide";
                const box = document.createElement("div");
                box.className = courseMangaPages[difficulty] ? "manga-box full-page-manga" : "manga-box";
                box.appendChild(image);
                slide.appendChild(box);
                mangaTrack.appendChild(slide);
            }
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
    nextBtn.hidden = false;
    unityProgressBar.hidden = unityState !== "loading";
    unityProgressBar.value = unityProgress;
    nextBtn.classList.remove("is-loading", "is-error");
    unityStatus.hidden = true;
    mangaRetryBtn.hidden = mangaState !== "error";
    mangaRetryBtn.disabled = mangaState === "loading";
    mangaStatus.hidden = true;

    if (mangaState === "error") {
        mangaStatus.hidden = false;
        mangaStatus.textContent = `漫画の${mangaImages.length + 1}ページ目を読み込めませんでした。「漫画を再試行」を押してください。`;
    }

    if (mangaState !== "ready") {
        nextBtn.disabled = true;
        btnText.textContent = "PLAY";
        if (mangaState !== "error") {
            nextBtn.classList.add("is-loading");
            mangaStatus.hidden = false;
            mangaStatus.textContent = mangaImages[0] ? "次のページを読み込んでいます…" : "漫画を読み込んでいます…";
        }
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
    btnText.textContent = "PLAY";
    unityStatus.textContent = unityProgress === 100
        ? "お出かけ準備中だにゃ！（読み込み完了・起動準備中）"
        : `お出かけ準備中だにゃ！ ${unityProgress}%`;
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
    unityProgress = 0;
    setUnityState("loading");

    const url = new URL(UNITY_URL, window.location.href);
    url.searchParams.set("difficulty", difficulty);
    url.searchParams.set("loadId", String(unityLoadId));

    if (isRetry) {
        url.searchParams.set("retry", String(Date.now()));
    }

    // 漫画全ページの取得・デコード後に、画面外のiframeでUnityを準備する。
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
        !["ready", "error", "progress"].includes(message.type) ||
        unityState !== "loading"
    ) {
        return;
    }

    if (message.type === "progress") {
        if (!Number.isFinite(message.progress) || message.progress < 0 || message.progress > 100) return;
        unityProgress = Math.max(unityProgress, Math.round(message.progress));
        updateActionButton();
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

window.createMangaSwipe(mangaTrack, index => {
    showMangaPage(index);
    updateActionButton();
});

nextBtn.addEventListener("click", () => {
    if (nextBtn.disabled) return;


    if (unityState === "error") {
        startUnityLoad(true);
        return;
    }

    if (unityState !== "ready") {
        return;
    }

    // 漫画のどのページからでもPLAYで開始する
    mangaReader.hidden = true;
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
