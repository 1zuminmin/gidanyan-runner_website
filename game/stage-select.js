(() => {
    const progressPrefix = "gidanyan-story-unlocked-v1:";
    const cards = document.querySelectorAll(".stage-card[data-difficulty]");
    const isCleared = difficulty => {
        try {
            // EX uses the same flag, saved when its result screen is shown.
            return window.localStorage.getItem(progressPrefix + difficulty) === "true";
        } catch {
            // Keep stage selection usable when browser storage is blocked.
            return false;
        }
    };

    const updateProgress = () => {
        const easyCleared = isCleared("easy");
        cards.forEach(card => {
            const difficulty = card.dataset.difficulty;
            const cleared = difficulty === "easy" ? easyCleared : isCleared(difficulty);
            const label = card.querySelector(".stage-status");
            const startHere = difficulty === "easy" && !cleared;
            const next = difficulty === "normal" && easyCleared && !cleared;
            label.textContent = cleared ? "CLEAR" : startHere ? "まずはここから" : "NEXT";
            label.classList.toggle("stage-status--start", startHere);
            label.hidden = !cleared && !startHere && !next;
        });
    };

    updateProgress();
    // Back/forward navigation can restore this page without running scripts again.
    window.addEventListener("pageshow", updateProgress);
    window.addEventListener("storage", event => {
        if (event.key === null || event.key.startsWith(progressPrefix)) updateProgress();
    });
})();
