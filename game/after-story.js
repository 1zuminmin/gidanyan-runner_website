(() => {
    const frame = document.getElementById("unityFrame");
    const container = document.getElementById("unityContainer");
    const panel = document.getElementById("clearStory");
    const reader = document.getElementById("clearStoryReader");
    const open = document.getElementById("openClearStory");
    const status = document.getElementById("clearStoryStatus");
    const pages = document.getElementById("clearStoryPages");
    const navigation = document.getElementById("clearStoryNavigation");
    const pageNumber = document.getElementById("clearStoryPageNumber");

    const notice = document.getElementById("storyNotice");
    document.getElementById("openStoryNotice").addEventListener("click", () => open.click());
    document.getElementById("dismissStoryNotice").addEventListener("click", () => { notice.hidden = true; });

    document.getElementById("openRecordRegistration")?.addEventListener("click", () => {
        const registration = document.getElementById("recordRegistration");
        if (!registration || registration.hidden) return;
        notice.hidden = true;
        registration.focus({ preventScroll: true });
        registration.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const storyTiming = document.body.dataset.difficulty === "ex" ? "プレイ後" : "クリア後";

    let images = [];
    let currentPage = 0;
    const clearPages = () => {
        images = [];
        currentPage = 0;
        navigation.hidden = true;
        swipeReader.reset();
        pageNumber.textContent = "";
        pages.replaceChildren();
    };
    const updatePageStatus = () => {
        const image = images[currentPage];
        open.hidden = image?.storyState !== "error";
        status.textContent = !image ? "" : image.storyState === "error"
            ? `このページを読み込めませんでした。上の「${storyTiming}ストーリーを読む」で再試行できます。`
            : image.storyState === "ready" ? "" : "ページを読み込んでいます…";
    };
    const showPage = index => {
        if (index < 0 || index >= images.length) return;
        currentPage = index;

        images[index].loading = "eager";
        pageNumber.textContent = `${index + 1} / ${images.length}`;

        navigation.hidden = false;
        updatePageStatus();
    };
    const swipeReader = window.createMangaSwipe(pages, showPage);
    const course = document.body.dataset.difficulty;
    // Keep each course independent, including when different tabs finish together.
    const progressKey = `gidanyan-story-unlocked-v1:${course}`;
    let request = 0;
    let unlocked = false;
    // Saved access permits rereading; only this visit's result shows the notice.
    let hasCurrentResult = false;
    try {
        unlocked = window.localStorage.getItem(progressKey) === "true";
    } catch {
        // Storage may be disabled. The current page can still unlock its story.
    }
    const reset = () => {
        hasCurrentResult = false;
        notice.hidden = true;
        request++;
        panel.hidden = !unlocked;
        reader.hidden = true;
        open.hidden = false;
        open.setAttribute("aria-expanded", "false");
        clearPages();
    };
    window.addEventListener("message", event => {
        const message = event.data;
        if (!frame.src || event.source !== frame.contentWindow) return;
        const expected = new URL(frame.src, window.location.href);
        if (event.origin !== expected.origin || !message || message.source !== "gidanyan-unity" ||
            message.difficulty !== course || String(message.loadId) !== expected.searchParams.get("loadId")) return;
        if (message.type === "run-started") reset();
        // Background loading must not close a restored story being read.
        if (message.type !== "result") return;
        if (typeof message.cleared !== "boolean") return;
        if (!container.classList.contains("is-visible")) return;
        reset();
        // Extra is endless: its result is normally a failed run, not a goal clear.
        if (!message.cleared && course !== "ex") return;
        unlocked = true;
        hasCurrentResult = true;
        try {
            window.localStorage.setItem(progressKey, "true");
        } catch {
            // Preserve access for this visit even if persistent storage is unavailable.
        }
        panel.hidden = false;
        notice.hidden = false;
    });
    open.addEventListener("click", async () => {
        if (!unlocked) return;
        notice.hidden = true;
        const token = ++request;
        reader.hidden = false;
        open.hidden = true;
        open.setAttribute("aria-expanded", "true");
        document.getElementById("clearStoryTitle").textContent = `${document.body.dataset.difficultyLabel} ${storyTiming}ストーリー`;
        document.getElementById("clearStoryTitle").focus({ preventScroll: true });
        reader.scrollIntoView({ behavior: "smooth", block: "start" });
        status.textContent = "お話を読み込んでいます…";
        clearPages();
        try {
            const response = await fetch("stories/manifest.json", { cache: "no-cache" });
            if (!response.ok) throw new Error("manifest");
            const manifest = await response.json();
            if (token !== request) return;
            const list = manifest[course];
            if (!Array.isArray(list) || list.length === 0) {
                status.textContent = "このコースの続きのお話は、ただいま準備中です。お楽しみに！";
                return;
            }
            if (!list.every(name => typeof name === "string" && /^[a-zA-Z0-9_-]+\.(png|jpe?g|webp)$/i.test(name))) throw new Error("pages");

            list.forEach((name, index) => {
                const image = document.createElement("img");
                image.alt = `${document.body.dataset.difficultyLabel} ${storyTiming}ストーリー ${index + 1}ページ目`;
                image.loading = index === 0 ? "eager" : "lazy";
                image.decoding = "async";
                image.hidden = false;
                image.storyState = "loading";
                image.addEventListener("load", () => {
                    image.storyState = "ready";
                    if (token === request && index === currentPage) updatePageStatus();
                });
                image.addEventListener("error", () => {
                    image.storyState = "error";
                    if (token === request && index === currentPage) updatePageStatus();
                });
                image.src = `stories/${course}/${name}`;
                images.push(image);
                const slide = document.createElement("div");
                slide.className = "manga-slide";
                slide.appendChild(image);
                pages.appendChild(slide);
            });
            showPage(0);
        } catch {
            if (token === request) {
                open.hidden = false;
                status.textContent = "お話を読み込めませんでした。上のボタンからもう一度お試しください。";
            }
        }
    });
    document.getElementById("closeClearStory").addEventListener("click", () => {
        request++;
        reader.hidden = true;
        open.hidden = false;
        open.setAttribute("aria-expanded", "false");
        notice.hidden = !hasCurrentResult;
        document.getElementById("stageBackLink").focus({ preventScroll: true });
        document.getElementById("stageHeader").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    reset();
})();
