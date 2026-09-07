const themeBtn = document.getElementById("themeBtn");

if (themeBtn) {
    themeBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark");

        const icon = themeBtn.querySelector("i");

        if (document.body.classList.contains("dark")) {
            icon.className = "fa-solid fa-sun";
            localStorage.setItem("aPdfTheme", "dark");
        } else {
            icon.className = "fa-solid fa-moon";
            localStorage.setItem("aPdfTheme", "light");
        }
    });

    if (localStorage.getItem("aPdfTheme") === "dark") {
        document.body.classList.add("dark");
        themeBtn.querySelector("i").className = "fa-solid fa-sun";
    }
}

document.querySelectorAll("[data-tool]").forEach(button => {
    button.addEventListener("click", () => {
        const tool = button.dataset.tool;
        window.location.href =
            `tool.html?tool=${encodeURIComponent(tool)}`;
    });
});