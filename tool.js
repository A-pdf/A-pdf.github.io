import * as pdfjsLib from
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";


/* =========================================================
   LIBRARIES
========================================================= */

const PDFLib = window.PDFLib;

const {
    PDFDocument,
    rgb,
    degrees,
    StandardFonts
} = PDFLib;


/* =========================================================
   ELEMENTS
========================================================= */

const $ = id => document.getElementById(id);

const startScreen = $("startScreen");
const loadingScreen = $("loadingScreen");
const editorWorkspace = $("editorWorkspace");

const mergeScreen = $("mergeScreen");
const imagesPdfScreen = $("imagesPdfScreen");
const pdfImagesScreen = $("pdfImagesScreen");
const extractImagesScreen = $("extractImagesScreen");
const infoScreen = $("infoScreen");

const pdfInput = $("pdfInput");

const pageThumbnails = $("pageThumbnails");
const viewerPages = $("viewerPages");

const progressBar = $("progressBar");
const progressPercent = $("progressPercent");
const progressDetail = $("progressDetail");
const loadingMessage = $("loadingMessage");

const zoomText = $("zoomText");

const toolTitle = $("toolTitle");


/* =========================================================
   STATE
========================================================= */

let currentTool =
    new URLSearchParams(location.search).get("tool") || "editor";

let originalPdfBytes = null;

let pdfDocument = null;

let pageData = [];

let selectedPages = new Set();

let currentPageIndex = 0;

let zoom = 1;

let activeEditorTool = "select";

let addedObjects = [];

let drawingData = [];

let isLoading = false;


/* =========================================================
   TOOL INFORMATION
========================================================= */

const toolInfo = {

    editor: {
        title: "Edit PDF",
        description:
            "Add text, images, drawings and signatures to your PDF."
    },

    organize: {
        title: "Organize Pages",
        description:
            "Select and rearrange your PDF pages."
    },

    delete: {
        title: "Delete Pages",
        description:
            "Select any pages and remove them from your PDF."
    },

    rotate: {
        title: "Rotate Pages",
        description:
            "Select pages and rotate them."
    },

    split: {
        title: "Split PDF",
        description:
            "Create separate PDFs from selected page ranges."
    },

    extract: {
        title: "Extract Pages",
        description:
            "Select exactly which pages you want to extract."
    },

    watermark: {
        title: "Watermark PDF",
        description:
            "Add a watermark to your PDF."
    },

    "page-numbers": {
        title: "Page Numbers",
        description:
            "Add page numbers to your PDF."
    },

    sign: {
        title: "Sign PDF",
        description:
            "Draw and place your signature."
    },

    compress: {
        title: "Compress PDF",
        description:
            "Create a smaller optimized PDF."
    },

    metadata: {
        title: "PDF Information",
        description:
            "Inspect information about your PDF."
    }

};


/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {

    setupToolScreen();

    setupCommonEvents();

    setupEditorEvents();

    setupConversionEvents();

    setupModalEvents();

    setupSignatureCanvas();

}

initialize();


/* =========================================================
   SCREEN SETUP
========================================================= */

function hideAllScreens() {

    startScreen.classList.add("hidden");

    editorWorkspace.classList.add("hidden");

    mergeScreen.classList.add("hidden");

    imagesPdfScreen.classList.add("hidden");

    pdfImagesScreen.classList.add("hidden");

    extractImagesScreen.classList.add("hidden");

    infoScreen.classList.add("hidden");

}


function setupToolScreen() {

    hideAllScreens();

    const info = toolInfo[currentTool];

    if (currentTool === "merge") {

        mergeScreen.classList.remove("hidden");

        toolTitle.textContent = "Merge PDF";

        return;
    }

    if (currentTool === "images-to-pdf") {

        imagesPdfScreen.classList.remove("hidden");

        toolTitle.textContent = "Images to PDF";

        return;
    }

    if (currentTool === "pdf-to-image") {

        pdfImagesScreen.classList.remove("hidden");

        toolTitle.textContent = "PDF to Images";

        return;
    }

    if (currentTool === "extract-images") {

        extractImagesScreen.classList.remove("hidden");

        toolTitle.textContent =
            "Extract Images from PDF";

        return;
    }

    if (currentTool === "metadata") {

        infoScreen.classList.remove("hidden");

        toolTitle.textContent = "PDF Information";

        return;
    }

    startScreen.classList.remove("hidden");

    toolTitle.textContent =
        info?.title || "PDF Tool";

    $("startTitle").textContent =
        info?.title || "Open a PDF";

    $("startDescription").textContent =
        info?.description ||
        "Select a PDF from your device to begin.";

}


/* =========================================================
   COMMON EVENTS
========================================================= */

function setupCommonEvents() {

    pdfInput.addEventListener(
        "change",
        async event => {

            const file = event.target.files[0];

            if (!file) return;

            await openPdf(file);

        }
    );


    $("headerZoomIn").addEventListener(
        "click",
        () => changeZoom(0.15)
    );


    $("headerZoomOut").addEventListener(
        "click",
        () => changeZoom(-0.15)
    );


    $("fitPageBtn").addEventListener(
        "click",
        fitPage
    );


    $("previousPageBtn").addEventListener(
        "click",
        () => {

            if (currentPageIndex > 0) {

                currentPageIndex--;

                scrollToPage(currentPageIndex);

                selectSinglePage(currentPageIndex);

            }

        }
    );


    $("nextPageBtn").addEventListener(
        "click",
        () => {

            if (currentPageIndex < pageData.length - 1) {

                currentPageIndex++;

                scrollToPage(currentPageIndex);

                selectSinglePage(currentPageIndex);

            }

        }
    );


    $("downloadBtn").addEventListener(
        "click",
        downloadCurrentPdf
    );

}


/* =========================================================
   PROGRESS
========================================================= */

function showLoading(
    title = "Opening PDF",
    message = "Preparing your document..."
) {

    isLoading = true;

    loadingScreen.classList.remove("hidden");

    loadingMessage.textContent = message;

    $("loadingTitle").textContent = title;

    updateProgress(0, "Starting...");

}


function updateProgress(percent, detail) {

    const safe =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(percent)
            )
        );

    progressBar.style.width =
        safe + "%";

    progressPercent.textContent =
        safe + "%";

    progressDetail.textContent =
        detail || "";
}


function finishLoading() {

    updateProgress(
        100,
        "PDF ready ✓"
    );

    setTimeout(
        () => {

            loadingScreen.classList.add("hidden");

            isLoading = false;

        },
        350
    );

}


/* =========================================================
   OPEN PDF
========================================================= */

async function openPdf(file) {

    try {

        showLoading(
            "Opening PDF",
            "Reading your file..."
        );

        originalPdfBytes =
            new Uint8Array(
                await file.arrayBuffer()
            );

        updateProgress(
            15,
            "Loading PDF structure..."
        );

        pdfDocument =
            await pdfjsLib.getDocument({
                data: originalPdfBytes
            }).promise;

        const total =
            pdfDocument.numPages;

        pageData = [];

        selectedPages.clear();

        addedObjects = [];

        drawingData = [];

        updateProgress(
            25,
            `Found ${total} page${total === 1 ? "" : "s"}...`
        );


        /*
         * Render thumbnails first.
         */

        pageThumbnails.innerHTML = "";

        viewerPages.innerHTML = "";


        for (
            let i = 1;
            i <= total;
            i++
        ) {

            pageData.push({
                originalIndex: i - 1,
                currentIndex: i - 1,
                rotation: 0,
                deleted: false
            });

            createThumbnailPlaceholder(
                i - 1
            );

            const percent =
                25 +
                ((i / total) * 25);

            updateProgress(
                percent,
                `Preparing page ${i} of ${total}...`
            );

        }


        /*
         * Render full viewer pages progressively.
         */

        for (
            let i = 1;
            i <= total;
            i++
        ) {

            await renderViewerPage(
                i,
                i - 1
            );

            const percent =
                50 +
                ((i / total) * 45);

            updateProgress(
                percent,
                `Rendering page ${i} of ${total}...`
            );

            /*
             * Give the browser a moment so the
             * progress UI remains responsive.
             */

            await nextFrame();

        }


        updateSidebar();

        updatePageControls();

        editorWorkspace.classList.remove(
            "hidden"
        );

        startScreen.classList.add(
            "hidden"
        );

        finishLoading();

        /*
         * Fit after layout becomes visible.
         */

        requestAnimationFrame(
            () => fitPage()
        );

    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not open this PDF.\n\n" +
            "The file may be damaged, encrypted, or unsupported."
        );

    }

}


/* =========================================================
   THUMBNAIL PLACEHOLDER
========================================================= */

function createThumbnailPlaceholder(index) {

    const item =
        document.createElement("div");

    item.className =
        "page-thumbnail";

    item.dataset.index =
        index;

    const canvas =
        document.createElement("canvas");

    canvas.width = 120;

    canvas.height = 160;

    item.appendChild(canvas);


    const number =
        document.createElement("div");

    number.className =
        "thumbnail-number";

    number.textContent =
        `Page ${index + 1}`;

    item.appendChild(number);


    item.addEventListener(
        "click",
        event => {

            if (event.ctrlKey || event.metaKey) {

                togglePageSelection(index);

            } else {

                selectSinglePage(index);

            }

            scrollToPage(index);

        }
    );


    pageThumbnails.appendChild(item);

}


/* =========================================================
   RENDER THUMBNAIL
========================================================= */

async function renderThumbnail(
    pdfPage,
    index
) {

    const item =
        pageThumbnails.querySelector(
            `[data-index="${index}"]`
        );

    if (!item) return;

    const canvas =
        item.querySelector("canvas");

    const base =
        pdfPage.getViewport({
            scale: 1
        });

    const width = 160;

    const scale =
        width / base.width;

    const viewport =
        pdfPage.getViewport({
            scale
        });

    canvas.width =
        Math.ceil(viewport.width);

    canvas.height =
        Math.ceil(viewport.height);

    const context =
        canvas.getContext("2d");

    await pdfPage.render({
        canvasContext: context,
        viewport
    }).promise;

}


/* =========================================================
   RENDER FULL PAGE
========================================================= */

async function renderViewerPage(
    pdfNumber,
    index
) {

    const pdfPage =
        await pdfDocument.getPage(
            pdfNumber
        );


    const baseViewport =
        pdfPage.getViewport({
            scale: 1
        });


    const viewport =
        pdfPage.getViewport({
            scale: 1
        });


    const page =
        document.createElement("div");

    page.className =
        "viewer-page";

    page.dataset.index =
        index;


    const canvas =
        document.createElement("canvas");


    canvas.width =
        Math.ceil(viewport.width);

    canvas.height =
        Math.ceil(viewport.height);


    canvas.style.width =
        `${viewport.width}px`;

    canvas.style.height =
        `${viewport.height}px`;


    const context =
        canvas.getContext("2d", {
            alpha: false
        });


    await pdfPage.render({
        canvasContext: context,
        viewport
    }).promise;


    page.appendChild(canvas);


    const overlay =
        document.createElement("div");

    overlay.className =
        "page-overlay";

    page.appendChild(overlay);


    viewerPages.appendChild(page);


    pageData[index].baseWidth =
        baseViewport.width;

    pageData[index].baseHeight =
        baseViewport.height;

    pageData[index].pageElement =
        page;

    pageData[index].canvas =
        canvas;

    pageData[index].overlay =
        overlay;


    /*
     * Also render thumbnail.
     */

    await renderThumbnail(
        pdfPage,
        index
    );

}


/* =========================================================
   PAGE SELECTION
========================================================= */

function selectSinglePage(index) {

    selectedPages.clear();

    selectedPages.add(index);

    currentPageIndex = index;

    updateSidebar();

    updatePageControls();

}


function togglePageSelection(index) {

    if (selectedPages.has(index)) {

        selectedPages.delete(index);

    } else {

        selectedPages.add(index);

    }

    if (selectedPages.size > 0) {

        currentPageIndex =
            [...selectedPages][0];

    }

    updateSidebar();

    updatePageControls();

}


function updateSidebar() {

    document
        .querySelectorAll(".page-thumbnail")
        .forEach(item => {

            const index =
                Number(item.dataset.index);

            item.classList.toggle(
                "selected",
                selectedPages.has(index)
            );

        });


    document
        .querySelectorAll(".viewer-page")
        .forEach(page => {

            const index =
                Number(page.dataset.index);

            page.style.outline =
                selectedPages.has(index)
                    ? "3px solid #111827"
                    : "none";

        });


    const count =
        pageData.length;

    $("sidebarPageCount").textContent =
        `${count} page${count === 1 ? "" : "s"}`;

    $("selectionStatus").textContent =
        selectedPages.size
            ? `${selectedPages.size} page${selectedPages.size === 1 ? "" : "s"} selected`
            : "No page selected";

}


/* =========================================================
   SELECT ALL
========================================================= */

$("selectAllPages").addEventListener(
    "click",
    () => {

        selectedPages.clear();

        pageData.forEach(
            (_, index) =>
                selectedPages.add(index)
        );

        updateSidebar();

        updatePageControls();

    }
);


/* =========================================================
   PAGE CONTROLS
========================================================= */

function updatePageControls() {

    $("currentPageNumber").textContent =
        pageData.length
            ? currentPageIndex + 1
            : 0;

    $("totalPageNumber").textContent =
        pageData.length;

}


function scrollToPage(index) {

    const page =
        pageData[index]?.pageElement;

    if (!page) return;

    page.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    currentPageIndex = index;

    updatePageControls();

}


/* =========================================================
   ZOOM
========================================================= */

function changeZoom(amount) {

    zoom =
        Math.max(
            0.4,
            Math.min(
                3.5,
                zoom + amount
            )
        );

    applyZoom();

}


function applyZoom() {

    const percentage =
        Math.round(zoom * 100);

    zoomText.textContent =
        percentage + "%";


    document
        .querySelectorAll(".viewer-page")
        .forEach(page => {

            page.style.transform =
                `scale(${zoom})`;

            /*
             * Keep layout usable when zoomed.
             */

            page.style.marginBottom =
                `${(zoom - 1) * page.offsetHeight}px`;

        });

}


function fitPage() {

    const viewer =
        $("viewer");

    if (!viewer || !pageData.length)
        return;

    const index =
        currentPageIndex;

    const data =
        pageData[index];

    if (!data?.baseWidth)
        return;


    const availableWidth =
        viewer.clientWidth - 80;

    const availableHeight =
        viewer.clientHeight - 80;


    const widthScale =
        availableWidth /
        data.baseWidth;

    const heightScale =
        availableHeight /
        data.baseHeight;


    zoom =
        Math.min(
            widthScale,
            heightScale,
            1.5
        );

    zoom =
        Math.max(
            zoom,
            0.4
        );

    applyZoom();

}


/* =========================================================
   EDITOR TOOLBAR
========================================================= */

function setupEditorEvents() {

    document
        .querySelectorAll(".editor-tool[data-editor-tool]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    activeEditorTool =
                        button.dataset.editorTool;

                    document
                        .querySelectorAll(
                            ".editor-tool[data-editor-tool]"
                        )
                        .forEach(
                            b =>
                                b.classList.remove(
                                    "active"
                                )
                        );

                    button.classList.add(
                        "active"
                    );


                    if (
                        activeEditorTool ===
                        "text"
                    ) {

                        openTextModal();

                    }


                    if (
                        activeEditorTool ===
                        "image"
                    ) {

                        $("editorImageInput").click();

                    }


                    if (
                        activeEditorTool ===
                        "draw"
                    ) {

                        activateDrawing();

                    }


                    if (
                        activeEditorTool ===
                        "sign"
                    ) {

                        openSignatureModal();

                    }

                }
            );

        });


    $("deleteSelectedBtn")
        .addEventListener(
            "click",
            deleteSelectedPages
        );


    $("rotateLeftBtn")
        .addEventListener(
            "click",
            () =>
                rotateSelectedPages(-90)
        );


    $("rotateRightBtn")
        .addEventListener(
            "click",
            () =>
                rotateSelectedPages(90)
        );


    $("moveUpBtn")
        .addEventListener(
            "click",
            () =>
                moveSelectedPages(-1)
        );


    $("moveDownBtn")
        .addEventListener(
            "click",
            () =>
                moveSelectedPages(1)
        );


    $("editorImageInput")
        .addEventListener(
            "change",
            handleImageUpload
        );

}


/* =========================================================
   DELETE ACTUAL PAGES
========================================================= */

function deleteSelectedPages() {

    if (!selectedPages.size) {

        alert(
            "Select one or more pages first."
        );

        return;
    }


    if (
        selectedPages.size >=
        pageData.length
    ) {

        alert(
            "At least one page must remain in the PDF."
        );

        return;
    }


    const indexes =
        [...selectedPages]
            .sort(
                (a,b) => b - a
            );


    for (const index of indexes) {

        pageData.splice(
            index,
            1
        );

    }


    /*
     * Re-index every remaining page.
     */

    pageData.forEach(
        (page, index) => {

            page.currentIndex =
                index;

            if (page.pageElement) {

                page.pageElement.dataset.index =
                    index;

            }

        }
    );


    /*
     * Rebuild visual UI.
     */

    rebuildViewerFromState();

}


/* =========================================================
   ROTATE
========================================================= */

function rotateSelectedPages(amount) {

    if (!selectedPages.size) {

        alert(
            "Select one or more pages first."
        );

        return;
    }


    selectedPages.forEach(
        index => {

            const page =
                pageData[index];

            page.rotation =
                (
                    page.rotation +
                    amount +
                    360
                ) % 360;


            if (page.pageElement) {

                page.pageElement.style.transform =
                    `rotate(${page.rotation}deg) scale(${zoom})`;

            }

        }
    );

}


/* =========================================================
   REORDER
========================================================= */

function moveSelectedPages(direction) {

    if (!selectedPages.size) {

        alert(
            "Select one or more pages first."
        );

        return;
    }


    const indexes =
        [...selectedPages]
            .sort(
                direction < 0
                    ? (a,b) => a-b
                    : (a,b) => b-a
            );


    if (direction < 0) {

        for (const index of indexes) {

            if (index <= 0)
                continue;

            [
                pageData[index - 1],
                pageData[index]
            ] =
            [
                pageData[index],
                pageData[index - 1]
            ];

        }

    } else {

        for (const index of indexes) {

            if (
                index >=
                pageData.length - 1
            )
                continue;

            [
                pageData[index + 1],
                pageData[index]
            ] =
            [
                pageData[index],
                pageData[index + 1]
            ];

        }

    }


    selectedPages =
        new Set(
            [...selectedPages]
                .map(index => {

                    const page =
                        pageData[index];

                    return pageData.indexOf(
                        page
                    );

                })
        );


    rebuildViewerFromState();

}


/* =========================================================
   REBUILD VISUAL ORDER
========================================================= */

function rebuildViewerFromState() {

    const oldSelection =
        [...selectedPages];

    pageThumbnails.innerHTML = "";

    viewerPages.innerHTML = "";


    pageData.forEach(
        (data, index) => {

            data.currentIndex =
                index;

            createThumbnailPlaceholder(
                index
            );

        }
    );


    /*
     * We need to rerender from the original
     * PDF because order changed.
     */

    rerenderAllPages().then(
        () => {

            selectedPages.clear();

            oldSelection.forEach(
                index => {

                    if (
                        index <
                        pageData.length
                    ) {

                        selectedPages.add(
                            index
                        );

                    }

                }
            );

            updateSidebar();

            updatePageControls();

            applyZoom();

        }
    );

}


async function rerenderAllPages() {

    for (
        let index = 0;
        index < pageData.length;
        index++
    ) {

        const data =
            pageData[index];

        const originalPage =
            data.originalIndex + 1;

        await renderViewerPageUsingData(
            originalPage,
            index,
            data
        );

    }

}


async function renderViewerPageUsingData(
    pdfNumber,
    index,
    data
) {

    const pdfPage =
        await pdfDocument.getPage(
            pdfNumber
        );


    const viewport =
        pdfPage.getViewport({
            scale: 1,
            rotation: data.rotation
        });


    const page =
        document.createElement("div");

    page.className =
        "viewer-page";

    page.dataset.index =
        index;


    const canvas =
        document.createElement("canvas");


    canvas.width =
        Math.ceil(viewport.width);

    canvas.height =
        Math.ceil(viewport.height);


    canvas.style.width =
        `${viewport.width}px`;

    canvas.style.height =
        `${viewport.height}px`;


    const context =
        canvas.getContext("2d", {
            alpha: false
        });


    await pdfPage.render({
        canvasContext: context,
        viewport
    }).promise;


    page.appendChild(canvas);


    const overlay =
        document.createElement("div");

    overlay.className =
        "page-overlay";

    page.appendChild(overlay);


    viewerPages.appendChild(page);


    data.pageElement =
        page;

    data.canvas =
        canvas;

    data.overlay =
        overlay;

    data.baseWidth =
        viewport.width;

    data.baseHeight =
        viewport.height;


    await renderThumbnail(
        pdfPage,
        index
    );

}


/* =========================================================
   ADD TEXT
========================================================= */

function openTextModal() {

    if (!selectedPages.size) {

        alert(
            "Select a page first."
        );

        return;
    }

    $("textInput").value = "";

    $("textModal")
        .classList.remove(
            "hidden"
        );

    setTimeout(
        () =>
            $("textInput").focus(),
        50
    );

}


function addTextObject() {

    const text =
        $("textInput").value.trim();

    if (!text)
        return;


    const index =
        [...selectedPages][0];


    const data =
        pageData[index];

    if (!data?.overlay)
        return;


    const object =
        document.createElement("div");

    object.className =
        "pdf-object text-object";

    object.textContent =
        text;

    object.style.left =
        "80px";

    object.style.top =
        "80px";


    data.overlay.appendChild(
        object
    );


    addedObjects.push({
        type: "text",
        pageIndex: index,
        text,
        x: 80,
        y: 80
    });


    makeObjectDraggable(
        object,
        addedObjects[
            addedObjects.length - 1
        ]
    );


    $("textModal")
        .classList.add(
            "hidden"
        );

}


/* =========================================================
   IMAGE
========================================================= */

async function handleImageUpload(event) {

    const file =
        event.target.files[0];

    event.target.value = "";

    if (!file)
        return;


    if (!selectedPages.size) {

        alert(
            "Select a page first."
        );

        return;
    }


    const index =
        [...selectedPages][0];

    const data =
        pageData[index];


    if (!data?.overlay)
        return;


    /*
     * Convert every supported image to PNG.
     * This means WebP also works.
     */

    const pngData =
        await imageToPngDataUrl(file);


    const image =
        document.createElement("img");

    image.className =
        "pdf-object image-object";

    image.src =
        pngData;

    image.style.left =
        "80px";

    image.style.top =
        "80px";


    data.overlay.appendChild(
        image
    );


    const objectData = {

        type: "image",

        pageIndex: index,

        dataUrl: pngData,

        x: 80,

        y: 80,

        width: 180

    };


    image.style.width =
        objectData.width + "px";


    addedObjects.push(
        objectData
    );


    makeObjectDraggable(
        image,
        objectData
    );

}


function imageToPngDataUrl(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload =
                () => {

                    const img =
                        new Image();

                    img.onload =
                        () => {

                            const canvas =
                                document.createElement(
                                    "canvas"
                                );

                            canvas.width =
                                img.naturalWidth;

                            canvas.height =
                                img.naturalHeight;


                            const ctx =
                                canvas.getContext(
                                    "2d"
                                );

                            ctx.drawImage(
                                img,
                                0,
                                0
                            );


                            resolve(
                                canvas.toDataURL(
                                    "image/png"
                                )
                            );

                        };

                    img.onerror =
                        reject;

                    img.src =
                        reader.result;

                };

            reader.onerror =
                reject;

            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   DRAG OBJECTS
========================================================= */

function makeObjectDraggable(
    element,
    objectData
) {

    let dragging = false;

    let startX = 0;
    let startY = 0;

    let originalX = 0;
    let originalY = 0;


    element.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            dragging = true;

            element.setPointerCapture(
                event.pointerId
            );

            startX =
                event.clientX;

            startY =
                event.clientY;

            originalX =
                parseFloat(
                    element.style.left
                ) || 0;

            originalY =
                parseFloat(
                    element.style.top
                ) || 0;

        }
    );


    element.addEventListener(
        "pointermove",
        event => {

            if (!dragging)
                return;


            const dx =
                event.clientX -
                startX;

            const dy =
                event.clientY -
                startY;


            const x =
                originalX + dx / zoom;

            const y =
                originalY + dy / zoom;


            element.style.left =
                x + "px";

            element.style.top =
                y + "px";


            objectData.x =
                x;

            objectData.y =
                y;

        }
    );


    element.addEventListener(
        "pointerup",
        () => {

            dragging = false;

        }
    );

}


/* =========================================================
   DRAW
========================================================= */

function activateDrawing() {

    if (!selectedPages.size) {

        alert(
            "Select a page first."
        );

        return;
    }


    const index =
        [...selectedPages][0];

    const data =
        pageData[index];

    if (!data?.overlay)
        return;


    let canvas =
        data.overlay.querySelector(
            ".draw-overlay"
        );


    if (canvas)
        return;


    canvas =
        document.createElement(
            "canvas"
        );

    canvas.className =
        "draw-overlay";


    const rect =
        data.pageElement.getBoundingClientRect();


    canvas.width =
        data.canvas.width;

    canvas.height =
        data.canvas.height;


    data.overlay.appendChild(
        canvas
    );


    const ctx =
        canvas.getContext("2d");


    ctx.lineWidth = 3;

    ctx.lineCap = "round";

    ctx.strokeStyle =
        "#111827";


    let drawing = false;


    function point(event) {

        const bounds =
            canvas.getBoundingClientRect();

        return {

            x:
                (event.clientX -
                bounds.left) *
                canvas.width /
                bounds.width,

            y:
                (event.clientY -
                bounds.top) *
                canvas.height /
                bounds.height

        };

    }


    canvas.addEventListener(
        "pointerdown",
        event => {

            drawing = true;

            const p =
                point(event);

            ctx.beginPath();

            ctx.moveTo(
                p.x,
                p.y
            );

        }
    );


    canvas.addEventListener(
        "pointermove",
        event => {

            if (!drawing)
                return;

            const p =
                point(event);

            ctx.lineTo(
                p.x,
                p.y
            );

            ctx.stroke();

        }
    );


    canvas.addEventListener(
        "pointerup",
        () => {

            drawing = false;

        }
    );


    canvas.addEventListener(
        "pointerleave",
        () => {

            drawing = false;

        }
    );


    drawingData.push({
        pageIndex: index,
        canvas
    });

}


/* =========================================================
   SIGNATURE
========================================================= */

let signatureCanvas;
let signatureContext;
let signing = false;


function setupSignatureCanvas() {

    signatureCanvas =
        $("signatureCanvas");

    signatureContext =
        signatureCanvas.getContext(
            "2d"
        );


    signatureContext.lineWidth =
        3;

    signatureContext.lineCap =
        "round";

    signatureContext.strokeStyle =
        "#111827";


    signatureCanvas.addEventListener(
        "pointerdown",
        event => {

            signing = true;

            const p =
                getCanvasPoint(
                    signatureCanvas,
                    event
                );

            signatureContext.beginPath();

            signatureContext.moveTo(
                p.x,
                p.y
            );

        }
    );


    signatureCanvas.addEventListener(
        "pointermove",
        event => {

            if (!signing)
                return;

            const p =
                getCanvasPoint(
                    signatureCanvas,
                    event
                );

            signatureContext.lineTo(
                p.x,
                p.y
            );

            signatureContext.stroke();

        }
    );


    signatureCanvas.addEventListener(
        "pointerup",
        () =>
            signing = false
    );

    signatureCanvas.addEventListener(
        "pointerleave",
        () =>
            signing = false
    );

}


function getCanvasPoint(
    canvas,
    event
) {

    const rect =
        canvas.getBoundingClientRect();

    return {

        x:
            (event.clientX -
            rect.left) *
            canvas.width /
            rect.width,

        y:
            (event.clientY -
            rect.top) *
            canvas.height /
            rect.height

    };

}


function openSignatureModal() {

    if (!selectedPages.size) {

        alert(
            "Select a page first."
        );

        return;
    }


    signatureContext.clearRect(
        0,
        0,
        signatureCanvas.width,
        signatureCanvas.height
    );


    $("signatureModal")
        .classList.remove(
            "hidden"
        );

}


function useSignature() {

    const dataUrl =
        signatureCanvas.toDataURL(
            "image/png"
        );


    const index =
        [...selectedPages][0];

    const data =
        pageData[index];


    const image =
        document.createElement("img");

    image.className =
        "pdf-object image-object";

    image.src =
        dataUrl;

    image.style.left =
        "80px";

    image.style.top =
        "80px";

    image.style.width =
        "220px";


    data.overlay.appendChild(
        image
    );


    const objectData = {

        type: "image",

        pageIndex: index,

        dataUrl,

        x: 80,

        y: 80,

        width: 220

    };


    addedObjects.push(
        objectData
    );


    makeObjectDraggable(
        image,
        objectData
    );


    $("signatureModal")
        .classList.add(
            "hidden"
        );

}


/* =========================================================
   MODALS
========================================================= */

function setupModalEvents() {

    $("closeTextModal")
        .addEventListener(
            "click",
            () =>
                $("textModal")
                    .classList.add(
                        "hidden"
                    )
        );


    $("cancelText")
        .addEventListener(
            "click",
            () =>
                $("textModal")
                    .classList.add(
                        "hidden"
                    )
        );


    $("addText")
        .addEventListener(
            "click",
            addTextObject
        );


    $("closeSignatureModal")
        .addEventListener(
            "click",
            () =>
                $("signatureModal")
                    .classList.add(
                        "hidden"
                    )
        );


    $("clearSignature")
        .addEventListener(
            "click",
            () => {

                signatureContext.clearRect(
                    0,
                    0,
                    signatureCanvas.width,
                    signatureCanvas.height
                );

            }
        );


    $("useSignature")
        .addEventListener(
            "click",
            useSignature
        );

}


/* =========================================================
   MERGE PDF
========================================================= */

function setupConversionEvents() {

    $("mergeInput")
        .addEventListener(
            "change",
            showMergeFiles
        );


    $("mergeButton")
        .addEventListener(
            "click",
            mergePdfs
        );


    $("imagesPdfInput")
        .addEventListener(
            "change",
            previewImages
        );


    $("imagesPdfButton")
        .addEventListener(
            "click",
            imagesToPdf
        );


    $("pdfImagesInput")
        .addEventListener(
            "change",
            pdfToImages
        );


    $("extractImagesInput")
        .addEventListener(
            "change",
            extractImages
        );


    $("infoInput")
        .addEventListener(
            "change",
            showPdfInfo
        );

}


let mergeFiles = [];


function showMergeFiles(event) {

    mergeFiles =
        [...event.target.files];

    const list =
        $("mergeFileList");

    list.innerHTML = "";


    mergeFiles.forEach(
        (file, index) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "file-item";

            item.innerHTML = `
                <i class="fa-solid fa-file-pdf"></i>
                <span>${index + 1}. ${escapeHtml(file.name)}</span>
            `;

            list.appendChild(
                item
            );

        }
    );


    $("mergeButton")
        .classList.toggle(
            "hidden",
            mergeFiles.length < 2
        );

}


async function mergePdfs() {

    if (mergeFiles.length < 2)
        return;


    showLoading(
        "Merging PDFs",
        "Combining your files..."
    );


    try {

        const merged =
            await PDFDocument.create();


        for (
            let i = 0;
            i < mergeFiles.length;
            i++
        ) {

            const bytes =
                await mergeFiles[i]
                    .arrayBuffer();


            const source =
                await PDFDocument.load(
                    bytes
                );


            const copied =
                await merged.copyPages(
                    source,
                    source.getPageIndices()
                );


            copied.forEach(
                page =>
                    merged.addPage(page)
            );


            updateProgress(
                ((i + 1) /
                    mergeFiles.length) *
                    100,
                `Adding PDF ${i + 1} of ${mergeFiles.length}...`
            );

        }


        const result =
            await merged.save();


        finishLoading();


        downloadBytes(
            result,
            "A-PDF-merged.pdf"
        );

    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        alert(
            "Could not merge these PDFs."
        );

    }

}


/* =========================================================
   IMAGES → PDF
========================================================= */

let selectedImages = [];


function previewImages(event) {

    selectedImages =
        [...event.target.files];


    const grid =
        $("imagePreviewGrid");

    grid.innerHTML = "";


    selectedImages.forEach(
        (file, index) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "image-preview-item";


            const img =
                document.createElement(
                    "img"
                );

            img.src =
                URL.createObjectURL(
                    file
                );


            const name =
                document.createElement(
                    "span"
                );

            name.textContent =
                file.name;


            const remove =
                document.createElement(
                    "button"
                );

            remove.textContent =
                "Remove";


            remove.onclick =
                () => {

                    selectedImages.splice(
                        index,
                        1
                    );

                    previewImages({
                        target: {
                            files: selectedImages
                        }
                    });

                };


            item.appendChild(img);

            item.appendChild(name);

            item.appendChild(remove);

            grid.appendChild(item);

        }
    );


    $("imagesPdfButton")
        .classList.toggle(
            "hidden",
            selectedImages.length === 0
        );

}


async function imagesToPdf() {

    if (!selectedImages.length)
        return;


    showLoading(
        "Creating PDF",
        "Converting your images..."
    );


    try {

        const pdf =
            await PDFDocument.create();


        for (
            let i = 0;
            i < selectedImages.length;
            i++
        ) {

            const file =
                selectedImages[i];


            const dataUrl =
                await imageFileToDataUrl(
                    file
                );


            const image =
                await embedImageFromDataUrl(
                    pdf,
                    dataUrl
                );


            const scale =
                Math.min(
                    595 / image.width,
                    842 / image.height
                );


            const width =
                image.width * scale;

            const height =
                image.height * scale;


            const page =
                pdf.addPage([
                    width,
                    height
                ]);


            page.drawImage(
                image,
                {
                    x: 0,
                    y: 0,
                    width,
                    height
                }
            );


            updateProgress(
                ((i + 1) /
                    selectedImages.length) *
                    100,
                `Converting image ${i + 1} of ${selectedImages.length}...`
            );

        }


        const bytes =
            await pdf.save();


        finishLoading();


        downloadBytes(
            bytes,
            "A-PDF-images.pdf"
        );

    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        alert(
            "Could not create the PDF."
        );

    }

}


/* =========================================================
   PDF → IMAGES
========================================================= */

async function pdfToImages(event) {

    const file =
        event.target.files[0];

    if (!file)
        return;


    showLoading(
        "Converting PDF",
        "Rendering your pages..."
    );


    try {

        const bytes =
            new Uint8Array(
                await file.arrayBuffer()
            );


        const pdf =
            await pdfjsLib.getDocument({
                data: bytes
            }).promise;


        const results =
            $("pdfImageResults");

        results.innerHTML = "";


        for (
            let i = 1;
            i <= pdf.numPages;
            i++
        ) {

            const page =
                await pdf.getPage(i);


            const viewport =
                page.getViewport({
                    scale: 2
                });


            const canvas =
                document.createElement(
                    "canvas"
                );


            canvas.width =
                viewport.width;

            canvas.height =
                viewport.height;


            const context =
                canvas.getContext("2d");


            await page.render({
                canvasContext: context,
                viewport
            }).promise;


            const dataUrl =
                canvas.toDataURL(
                    "image/png"
                );


            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "result-card";


            const img =
                document.createElement(
                    "img"
                );

            img.src =
                dataUrl;


            const link =
                document.createElement(
                    "a"
                );

            link.href =
                dataUrl;

            link.download =
                `A-PDF-page-${i}.png`;

            link.textContent =
                `Download Page ${i}`;


            card.appendChild(img);

            card.appendChild(link);

            results.appendChild(card);


            updateProgress(
                (i / pdf.numPages) * 100,
                `Rendering page ${i} of ${pdf.numPages}...`
            );

            await nextFrame();

        }


        finishLoading();

    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        alert(
            "Could not convert this PDF."
        );

    }

}


/* =========================================================
   EXTRACT EMBEDDED IMAGES
========================================================= */

async function extractImages(event) {

    const file =
        event.target.files[0];

    if (!file)
        return;


    showLoading(
        "Extracting Images",
        "Searching the PDF..."
    );


    try {

        const bytes =
            new Uint8Array(
                await file.arrayBuffer()
            );


        const pdf =
            await pdfjsLib.getDocument({
                data: bytes
            }).promise;


        const results =
            $("extractedImagesResults");

        results.innerHTML = "";


        let found = 0;


        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {

            const page =
                await pdf.getPage(
                    pageNumber
                );


            const operatorList =
                await page.getOperatorList();


            const imageNames =
                [];


            for (
                let i = 0;
                i < operatorList.fnArray.length;
                i++
            ) {

                const fn =
                    operatorList.fnArray[i];


                if (
                    fn ===
                    pdfjsLib.OPS.paintImageXObject ||
                    fn ===
                    pdfjsLib.OPS.paintInlineImageXObject
                ) {

                    const args =
                        operatorList.argsArray[i];


                    const name =
                        args?.[0];


                    if (
                        name &&
                        !imageNames.includes(name)
                    ) {

                        imageNames.push(name);

                    }

                }

            }


            for (
                const name of imageNames
            ) {

                try {

                    const image =
                        await new Promise(
                            (resolve, reject) => {

                                const timeout =
                                    setTimeout(
                                        () =>
                                            reject(
                                                new Error(
                                                    "Image timeout"
                                                )
                                            ),
                                        5000
                                    );


                                page.objs.get(
                                    name,
                                    data => {

                                        clearTimeout(
                                            timeout
                                        );

                                        resolve(
                                            data
                                        );

                                    }
                                );

                            }
                        );


                    if (
                        !image ||
                        !image.width ||
                        !image.height
                    )
                        continue;


                    const canvas =
                        document.createElement(
                            "canvas"
                        );


                    canvas.width =
                        image.width;

                    canvas.height =
                        image.height;


                    const context =
                        canvas.getContext(
                            "2d"
                        );


                    if (
                        image.bitmap
                    ) {

                        context.drawImage(
                            image.bitmap,
                            0,
                            0
                        );

                    } else if (
                        image.data
                    ) {

                        const imageData =
                            new ImageData(
                                new Uint8ClampedArray(
                                    image.data.buffer ||
                                    image.data
                                ),
                                image.width,
                                image.height
                            );

                        context.putImageData(
                            imageData,
                            0,
                            0
                        );

                    } else {

                        continue;

                    }


                    const dataUrl =
                        canvas.toDataURL(
                            "image/png"
                        );


                    found++;


                    createExtractedImageCard(
                        results,
                        dataUrl,
                        pageNumber,
                        found
                    );


                } catch (imageError) {

                    console.warn(
                        "Could not extract image:",
                        imageError
                    );

                }

            }


            updateProgress(
                (pageNumber /
                    pdf.numPages) *
                    100,
                `Checking page ${pageNumber} of ${pdf.numPages}...`
            );

            await nextFrame();

        }


        if (!found) {

            results.innerHTML = `
                <div class="info-item">
                    <strong>
                        No directly embedded images were found.
                    </strong>
                </div>
            `;

        }


        finishLoading();

    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        alert(
            "Could not inspect this PDF."
        );

    }

}


function createExtractedImageCard(
    container,
    dataUrl,
    pageNumber,
    imageNumber
) {

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "extracted-item";


    const img =
        document.createElement(
            "img"
        );

    img.src =
        dataUrl;


    const name =
        document.createElement(
            "span"
        );

    name.textContent =
        `Image ${imageNumber} — Page ${pageNumber}`;


    const link =
        document.createElement(
            "a"
        );

    link.href =
        dataUrl;

    link.download =
        `A-PDF-extracted-${imageNumber}.png`;

    link.textContent =
        "Download";


    link.style.display =
        "block";

    link.style.marginTop =
        "7px";

    link.style.fontSize =
        "11px";

    link.style.fontWeight =
        "700";

    link.style.color =
        "#111827";


    card.appendChild(img);

    card.appendChild(name);

    card.appendChild(link);

    container.appendChild(card);

}


/* =========================================================
   PDF INFORMATION
========================================================= */

async function showPdfInfo(event) {

    const file =
        event.target.files[0];

    if (!file)
        return;


    showLoading(
        "Reading PDF",
        "Collecting document information..."
    );


    try {

        const bytes =
            new Uint8Array(
                await file.arrayBuffer()
            );


        const pdf =
            await pdfjsLib.getDocument({
                data: bytes
            }).promise;


        const pdfLibDocument =
            await PDFDocument.load(
                bytes
            );


        const pages =
            pdf.numPages;


        const size =
            formatBytes(
                bytes.length
            );


        const info =
            $("infoResults");


        info.innerHTML = "";


        addInfo(
            info,
            "File name",
            file.name
        );

        addInfo(
            info,
            "File size",
            size
        );

        addInfo(
            info,
            "Pages",
            pages
        );

        addInfo(
            info,
            "PDF version",
            pdfLibDocument.getVersion()
        );

        addInfo(
            info,
            "Title",
            pdfLibDocument.getTitle() || "—"
        );

        addInfo(
            info,
            "Author",
            pdfLibDocument.getAuthor() || "—"
        );

        addInfo(
            info,
            "Subject",
            pdfLibDocument.getSubject() || "—"
        );

        addInfo(
            info,
            "Creator",
            pdfLibDocument.getCreator() || "—"
        );

        addInfo(
            info,
            "Producer",
            pdfLibDocument.getProducer() || "—"
        );


        finishLoading();

    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        alert(
            "Could not read this PDF."
        );

    }

}


function addInfo(
    container,
    title,
    value
) {

    const item =
        document.createElement(
            "div"
        );

    item.className =
        "info-item";

    item.innerHTML = `
        <small>${escapeHtml(title)}</small>
        <strong>${escapeHtml(String(value))}</strong>
    `;

    container.appendChild(item);

}


/* =========================================================
   DOWNLOAD ACTUAL EDITED PDF
========================================================= */

async function downloadCurrentPdf() {

    if (!originalPdfBytes) {

        alert(
            "Open a PDF first."
        );

        return;
    }


    showLoading(
        "Creating PDF",
        "Applying your changes..."
    );


    try {

        const source =
            await PDFDocument.load(
                originalPdfBytes
            );


        const output =
            await PDFDocument.create();


        /*
         * Page order is determined by pageData.
         * Deleted pages are already removed from this array.
         */

        for (
            let i = 0;
            i < pageData.length;
            i++
        ) {

            const data =
                pageData[i];


            const copied =
                await output.copyPages(
                    source,
                    [
                        data.originalIndex
                    ]
                );


            const page =
                copied[0];


            output.addPage(
                page
            );


            /*
             * Apply actual page rotation.
             */

            if (
                data.rotation
            ) {

                page.setRotation(
                    degrees(
                        data.rotation
                    )
                );

            }


            updateProgress(
                (i / pageData.length) *
                65,
                `Building page ${i + 1} of ${pageData.length}...`
            );

        }


        /*
         * Add objects.
         */

        for (
            const object of addedObjects
        ) {

            /*
             * Find the current position of the
             * original page.
             */

            const currentIndex =
                pageData.findIndex(
                    page =>
                        page.originalIndex ===
                        object.originalPageIndex ??
                        object.pageIndex
                );


            let targetIndex =
                object.pageIndex;


            /*
             * For objects added before page reordering,
             * pageIndex is mapped using the original index
             * where possible.
             */

            if (
                object.originalPageIndex !==
                undefined
            ) {

                const mapped =
                    pageData.findIndex(
                        page =>
                            page.originalIndex ===
                            object.originalPageIndex
                    );

                if (mapped >= 0)
                    targetIndex = mapped;

            }


            if (
                targetIndex < 0 ||
                targetIndex >= output.getPageCount()
            )
                continue;


            const pdfPage =
                output.getPage(
                    targetIndex
                );


            if (
                object.type ===
                "text"
            ) {

                const font =
                    await output.embedFont(
                        StandardFonts.Helvetica
                    );


                pdfPage.drawText(
                    object.text,
                    {
                        x: object.x,
                        y:
                            pdfPage.getHeight() -
                            object.y -
                            20,

                        size: 18,

                        font,

                        color:
                            rgb(
                                0.07,
                                0.09,
                                0.12
                            )
                    }
                );

            }


            if (
                object.type ===
                "image"
            ) {

                const image =
                    await output.embedPng(
                        object.dataUrl
                    );


                const width =
                    object.width || 180;


                const ratio =
                    image.height /
                    image.width;


                const height =
                    width * ratio;


                pdfPage.drawImage(
                    image,
                    {
                        x: object.x,

                        y:
                            pdfPage.getHeight() -
                            object.y -
                            height,

                        width,

                        height
                    }
                );

            }

        }


        /*
         * Draw signatures/drawings.
         */

        for (
            const drawing of drawingData
        ) {

            const targetIndex =
                drawing.pageIndex;


            if (
                targetIndex < 0 ||
                targetIndex >=
                output.getPageCount()
            )
                continue;


            const page =
                output.getPage(
                    targetIndex
                );


            const dataUrl =
                drawing.canvas.toDataURL(
                    "image/png"
                );


            const image =
                await output.embedPng(
                    dataUrl
                );


            page.drawImage(
                image,
                {
                    x: 0,
                    y: 0,

                    width:
                        page.getWidth(),

                    height:
                        page.getHeight()
                }
            );

        }


        updateProgress(
            90,
            "Finalizing PDF..."
        );


        const bytes =
            await output.save({
                useObjectStreams: true
            });


        updateProgress(
            100,
            "PDF ready ✓"
        );


        downloadBytes(
            bytes,
            `A-PDF-${currentTool}.pdf`
        );


        finishLoading();

    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        alert(
            "Could not create the edited PDF.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   HELPERS
========================================================= */

async function imageFileToDataUrl(
    file
) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload =
                () =>
                    resolve(
                        reader.result
                    );

            reader.onerror =
                reject;

            reader.readAsDataURL(
                file
            );

        }
    );

}


async function embedImageFromDataUrl(
    pdf,
    dataUrl
) {

    if (
        dataUrl.startsWith(
            "data:image/png"
        )
    ) {

        return pdf.embedPng(
            dataUrl
        );

    }

    return pdf.embedJpg(
        dataUrl
    );

}


function downloadBytes(
    bytes,
    filename
) {

    const blob =
        new Blob(
            [bytes],
            {
                type:
                    "application/pdf"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();


    setTimeout(
        () =>
            URL.revokeObjectURL(
                url
            ),
        2000
    );

}


function formatBytes(bytes) {

    if (!bytes)
        return "0 Bytes";


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        (bytes /
        Math.pow(1024, index))
            .toFixed(
                index === 0 ? 0 : 2
            )
        +
        " " +
        units[index]
    );

}


function escapeHtml(value) {

    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function nextFrame() {

    return new Promise(
        resolve =>
            requestAnimationFrame(
                resolve
            )
    );

}