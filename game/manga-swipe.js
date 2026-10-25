// Native touch/trackpad scrolling, with mouse dragging and keyboard support.
window.createMangaSwipe = (track, onChange) => {
    let pointer = null;
    let startX = 0;
    let startScroll = 0;
    const page = () => Math.max(0, Math.min(track.children.length - 1,
        Math.round(track.scrollLeft / (track.clientWidth || 1))));
    let current = 0;
    const update = () => { current = page(); onChange(current); };
    const go = index => {
        const clamped = Math.max(0, Math.min(track.children.length - 1, index));
        track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    };
    track.addEventListener("scroll", update, { passive: true });
    track.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        go(event.key === "Home" ? 0 : event.key === "End" ? track.children.length - 1 :
            page() + (event.key === "ArrowRight" ? 1 : -1));
    });
    track.addEventListener("dragstart", event => event.preventDefault());
    track.addEventListener("pointerdown", event => {
        if (event.pointerType !== "mouse" || event.button !== 0) return;
        pointer = event.pointerId; startX = event.clientX; startScroll = track.scrollLeft;
        track.setPointerCapture(pointer);
        track.classList.add("is-dragging");
    });
    track.addEventListener("pointermove", event => {
        if (pointer !== event.pointerId) return;
        track.scrollLeft = startScroll + startX - event.clientX;
    });
    const release = event => {
        if (pointer !== event.pointerId) return;
        pointer = null;
        track.classList.remove("is-dragging");
        go(page());
    };
    track.addEventListener("pointerup", release);
    track.addEventListener("pointercancel", release);
    track.addEventListener("lostpointercapture", release);
    // Keep the selected page when rotating a phone or resizing a tablet window.
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => {
        track.scrollLeft = current * track.clientWidth;
    }).observe(track);
    return { reset() { current = 0; track.scrollLeft = 0; } };
};
