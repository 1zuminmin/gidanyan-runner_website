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

const unityContainer =
    document.getElementById("unityContainer");

nextBtn.addEventListener("click", () => {

    currentPage++;

    if (currentPage < mangaPages.length) {

        mangaImage.textContent =
            mangaPages[currentPage];

        pageNumber.textContent =
            `${currentPage + 1} / ${mangaPages.length}`;
    }

    if (currentPage === mangaPages.length - 1) {

        const btnText =
            nextBtn.querySelector(".btn-text");

        btnText.textContent = "PLAY";
    }

    if (currentPage >= mangaPages.length) {

        document.querySelector(".manga-box")
            .style.display = "none";

        nextBtn.style.display = "none";

        unityContainer.style.display =
            "block";
    }

});