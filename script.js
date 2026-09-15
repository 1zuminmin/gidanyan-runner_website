const mangaPages = [
    "images/stage1_manga-p1.png",
    "images/stage1_manga-p2.png",
    "images/stage1_manga-p3.png",
    "images/stage1_manga-p4.png"
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

        mangaImage.src = mangaPages[currentPage];
        mangaImage.alt = `ステージ1の漫画・${currentPage + 1}ページ目`;

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