const mangaPages = [
    "漫画ダミー 1",
    "漫画ダミー 2",
    "漫画ダミー 3",
    "漫画ダミー 4"
];

let currentPage = 0;

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

nextBtn.addEventListener("click", () => {

    // まだ次の漫画がある場合
    if (currentPage < mangaPages.length - 1) {

        currentPage++;

        mangaImage.textContent =
            mangaPages[currentPage];

        pageNumber.textContent =
            `${currentPage + 1} / ${mangaPages.length}`;

        // 4枚目でPLAY表示に変更
        if (currentPage === mangaPages.length - 1) {
            btnText.textContent = "PLAY";
        }

        return;
    }

    // 4枚目でPLAYを押した場合
    mangaBox.style.display = "none";
    nextBtn.style.display = "none";

    unityContainer.style.display = "block";

    // Unity Webビルドを読み込む
    unityFrame.src = "./game/index.html";

    unityContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});