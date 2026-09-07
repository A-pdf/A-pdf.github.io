import * as pdfjsLib from
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs";


pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";


/* =========================================================
   PDF-LIB
========================================================= */

const PDFLib = window.PDFLib;

const {
    PDFDocument,
    rgb,
    degrees,
    StandardFonts
} = PDFLib;


/* =========================================================
   HELPERS
========================================================= */

const $ = id =>
    document.getElementById(id);


/* =========================================================
   ELEMENTS
========================================================= */

const startScreen =
    $("startScreen");

const loadingScreen =
    $("loadingScreen");

const editorWorkspace =
    $("editorWorkspace");

const mergeScreen =
    $("mergeScreen");

const imagesPdfScreen =
    $("imagesPdfScreen");

const pdfImagesScreen =
    $("pdfImagesScreen");

const extractImagesScreen =
    $("extractImagesScreen");

const infoScreen =
    $("infoScreen");

const pdfInput =
    $("pdfInput");

const pageThumbnails =
    $("pageThumbnails");

const viewer =
    $("viewer");

const viewerPages =
    $("viewerPages");

const zoomText =
    $("zoomText");

const toolTitle =
    $("toolTitle");

const progressBar =
    $("progressBar");

const progressPercent =
    $("progressPercent");

const progressDetail =
    $("progressDetail");

const loadingMessage =
    $("loadingMessage");


/* =========================================================
   STATE
========================================================= */

let currentTool =
    new URLSearchParams(location.search).get("tool") ||
    "editor";

let originalPdfBytes = null;

let pdfDocument = null;

let pageData = [];

let selectedPages = new Set();

let currentPageIndex = 0;

let zoom = 1;

let activeEditorTool = "select";

let isLoading = false;

let renderToken = 0;

let pageNumbersEnabled = false;

let watermarkText = "";

let addedObjects = [];

let drawingData = [];

let mergeFiles = [];

let selectedImages = [];


/*
 * Render quality.
 *
 * We deliberately render at a real canvas resolution
 * instead of using CSS transform scaling.
 */
const BASE_RENDER_SCALE = 1.35;

const MIN_ZOOM = 0.4;

const MAX_ZOOM = 3;


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
            "Select the pages you want to put into a new PDF."
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
            "Create an optimized copy of your PDF."
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

initialize();


function initialize() {

    setupToolScreen();

    setupCommonEvents();

    setupEditorEvents();

    setupConversionEvents();

    setupModalEvents();

    setupSignatureCanvas();

}


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

    const info =
        toolInfo[currentTool];


    if (currentTool === "merge") {

        mergeScreen.classList.remove("hidden");

        toolTitle.textContent =
            "Merge PDF";

        return;
    }


    if (currentTool === "images-to-pdf") {

        imagesPdfScreen.classList.remove("hidden");

        toolTitle.textContent =
            "Images to PDF";

        return;
    }


    if (currentTool === "pdf-to-image") {

        pdfImagesScreen.classList.remove("hidden");

        toolTitle.textContent =
            "PDF to Images";

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

        toolTitle.textContent =
            "PDF Information";

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

            const file =
                event.target.files[0];

            event.target.value = "";

            if (!file)
                return;

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
        previousPage
    );


    $("nextPageBtn").addEventListener(
        "click",
        nextPage
    );


    $("downloadBtn").addEventListener(
        "click",
        downloadCurrentPdf
    );


    viewer.addEventListener(
        "scroll",
        handleViewerScroll,
        {
            passive: true
        }
    );

}


/* =========================================================
   LOADING
========================================================= */

function showLoading(
    title = "Opening PDF",
    message = "Preparing your document..."
) {

    isLoading = true;

    loadingScreen.classList.remove(
        "hidden"
    );

    $("loadingTitle").textContent =
        title;

    loadingMessage.textContent =
        message;

    updateProgress(
        0,
        "Starting..."
    );

}


function updateProgress(
    percent,
    detail = ""
) {

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
        detail;

}


async function finishLoading() {

    updateProgress(
        100,
        "PDF ready ✓"
    );

    await wait(300);

    loadingScreen.classList.add(
        "hidden"
    );

    isLoading = false;

}


/* =========================================================
   OPEN PDF
========================================================= */

async function openPdf(file) {

    if (isLoading)
        return;


    showLoading(
        "Opening PDF",
        "Reading your file..."
    );


    try {

        /*
         * Make a permanent copy.
         *
         * PDF.js may transfer ArrayBuffers
         * to its worker, so never rely on the
         * same buffer afterwards.
         */

        const buffer =
            await file.arrayBuffer();

        originalPdfBytes =
            new Uint8Array(
                buffer.slice(0)
            );


        updateProgress(
            10,
            "Reading PDF structure..."
        );


        const pdfBytesForJs =
            new Uint8Array(
                originalPdfBytes
            );


        pdfDocument =
            await pdfjsLib.getDocument({
                data: pdfBytesForJs
            }).promise;


        const total =
            pdfDocument.numPages;


        if (!total) {
            throw new Error(
                "PDF contains no pages."
            );
        }


        pageData = [];

        selectedPages.clear();

        addedObjects = [];

        drawingData = [];

        currentPageIndex = 0;

        zoom = 1;

        pageNumbersEnabled =
            currentTool === "page-numbers";

        watermarkText =
            "";


        pageThumbnails.innerHTML =
            "";

        viewerPages.innerHTML =
            "";


        updateProgress(
            20,
            `Found ${total} page${total === 1 ? "" : "s"}...`
        );


        /*
         * Build stable page identities.
         */

        for (
            let i = 1;
            i <= total;
            i++
        ) {

            const pdfPage =
                await pdfDocument.getPage(i);

            const base =
                pdfPage.getViewport({
                    scale: 1,
                    rotation: 0
                });

            const sourceRotation =
                normalizeRotation(
                    pdfPage.rotate || 0
                );


            const data = {

                id:
                    "page-" +
                    crypto.randomUUID(),

                originalIndex:
                    i - 1,

                rotation:
                    0,

                sourceRotation,

                baseWidth:
                    base.width,

                baseHeight:
                    base.height,

                pageElement:
                    null,

                canvas:
                    null,

                overlay:
                    null,

                renderScale:
                    BASE_RENDER_SCALE

            };


            pageData.push(data);


            createThumbnailPlaceholder(
                data
            );


            updateProgress(
                20 +
                (i / total) * 15,
                `Preparing page ${i} of ${total}...`
            );


            await nextFrame();

        }


        /*
         * Render every page before the editor
         * becomes available.
         *
         * Therefore the user sees:
         *
         * 0% → 100% → PDF editor.
         */

        await renderAllPages(
            35,
            95
        );


        /*
         * Select first page.
         */

        selectedPages.clear();

        if (pageData.length) {
            selectedPages.add(
                pageData[0].id
            );
        }


        updateSidebar();

        updatePageControls();


        /*
         * Show editor ONLY after rendering.
         */

        editorWorkspace.classList.remove(
            "hidden"
        );

        startScreen.classList.add(
            "hidden"
        );


        updateProgress(
            98,
            "Finalizing viewer..."
        );


        await nextFrame();


        updateProgress(
            100,
            "PDF ready ✓"
        );


        await wait(350);


        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;


        /*
         * Calculate fit after layout exists.
         */

        await fitPage(false);


        /*
         * Tool-specific setup.
         */

        if (
            currentTool === "watermark"
        ) {

            const value =
                prompt(
                    "Enter watermark text:"
                );

            if (value?.trim()) {

                watermarkText =
                    value.trim();

            }

        }


        if (
            currentTool === "page-numbers"
        ) {

            pageNumbersEnabled = true;

            $("pageNumbersBtn")
                .classList.add("active");

        }


        updateSidebar();


    } catch (error) {

        console.error(
            "A-PDF open error:",
            error
        );

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not open this PDF.\n\n" +
            "The file may be damaged, encrypted, or unsupported.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   PAGE THUMBNAILS
========================================================= */

function createThumbnailPlaceholder(
    data
) {

    const item =
        document.createElement("div");

    item.className =
        "page-thumbnail";

    item.dataset.id =
        data.id;


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
        "Page";

    item.appendChild(number);


    item.addEventListener(
        "click",
        event => {

            const index =
                pageData.indexOf(data);

            if (index < 0)
                return;


            if (
                event.ctrlKey ||
                event.metaKey
            ) {

                togglePageSelection(
                    data.id
                );

            } else {

                selectSinglePage(
                    data.id
                );

            }


            scrollToPage(index);

        }
    );


    pageThumbnails.appendChild(
        item
    );

}


/* =========================================================
   RENDER ALL PAGES
========================================================= */

async function renderAllPages(
    progressStart = 0,
    progressEnd = 100
) {

    const token =
        ++renderToken;


    viewerPages.innerHTML =
        "";


    for (
        let index = 0;
        index < pageData.length;
        index++
    ) {

        if (
            token !== renderToken
        ) {
            return;
        }


        await renderPage(
            pageData[index],
            index
        );


        const percent =
            progressStart +
            ((index + 1) /
                pageData.length) *
            (progressEnd - progressStart);


        updateProgress(
            percent,
            `Rendering page ${index + 1} of ${pageData.length}...`
        );


        await nextFrame();

    }


    updateSidebar();

}


/* =========================================================
   RENDER SINGLE PAGE
========================================================= */

async function renderPage(
    data,
    index
) {

    const pdfPage =
        await pdfDocument.getPage(
            data.originalIndex + 1
        );


    const effectiveRotation =
        getEffectiveRotation(data);


    const renderScale =
        BASE_RENDER_SCALE *
        zoom;


    const viewport =
        pdfPage.getViewport({
            scale: renderScale,
            rotation: effectiveRotation
        });


    const page =
        document.createElement("div");

    page.className =
        "viewer-page";

    page.dataset.id =
        data.id;


    page.dataset.index =
        index;


    page.style.width =
        `${viewport.width}px`;

    page.style.height =
        `${viewport.height}px`;


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
        canvas.getContext(
            "2d",
            {
                alpha: false
            }
        );


    await pdfPage.render({
        canvasContext: context,
        viewport
    }).promise;


    page.appendChild(
        canvas
    );


    const overlay =
        document.createElement("div");

    overlay.className =
        "page-overlay";


    page.appendChild(
        overlay
    );


    /*
     * Clicking a page selects it.
     */

    page.addEventListener(
        "click",
        event => {

            if (
                activeEditorTool !==
                "select"
            ) {
                return;
            }


            if (
                event.target.closest(
                    ".pdf-object"
                )
            ) {
                return;
            }


            selectSinglePage(
                data.id
            );

        }
    );


    viewerPages.appendChild(
        page
    );


    data.pageElement =
        page;

    data.canvas =
        canvas;

    data.overlay =
        overlay;

    data.renderScale =
        renderScale;

    data.renderedWidth =
        viewport.width;

    data.renderedHeight =
        viewport.height;


    /*
     * Recreate objects on this page.
     */

    renderObjectsForPage(
        data
    );


    /*
     * Recreate drawing.
     */

    const drawing =
        getDrawingForPage(
            data.id
        );

    if (drawing) {

        createDrawingCanvas(
            data,
            drawing
        );

    }


    /*
     * Thumbnail.
     */

    await renderThumbnail(
        pdfPage,
        data
    );

}


/* =========================================================
   THUMBNAIL RENDERING
========================================================= */

async function renderThumbnail(
    pdfPage,
    data
) {

    const item =
        pageThumbnails.querySelector(
            `[data-id="${data.id}"]`
        );

    if (!item)
        return;


    const canvas =
        item.querySelector("canvas");


    const effectiveRotation =
        getEffectiveRotation(data);


    const base =
        pdfPage.getViewport({
            scale: 1,
            rotation: effectiveRotation
        });


    const width =
        160;


    const scale =
        width / base.width;


    const viewport =
        pdfPage.getViewport({
            scale,
            rotation: effectiveRotation
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


    item.querySelector(
        ".thumbnail-number"
    ).textContent =
        `Page ${pageData.indexOf(data) + 1}`;

}


/* =========================================================
   PAGE SELECTION
========================================================= */

function selectSinglePage(id) {

    selectedPages.clear();

    selectedPages.add(id);


    const index =
        pageData.findIndex(
            page =>
                page.id === id
        );


    if (index >= 0) {

        currentPageIndex =
            index;

    }


    updateSidebar();

    updatePageControls();

}


function togglePageSelection(id) {

    if (
        selectedPages.has(id)
    ) {

        selectedPages.delete(id);

    } else {

        selectedPages.add(id);

    }


    if (
        selectedPages.size
    ) {

        const first =
            [...selectedPages][0];

        const index =
            pageData.findIndex(
                page =>
                    page.id === first
            );

        if (index >= 0) {
            currentPageIndex =
                index;
        }

    }


    updateSidebar();

    updatePageControls();

}


/* =========================================================
   SIDEBAR
========================================================= */

function updateSidebar() {

    document
        .querySelectorAll(".page-thumbnail")
        .forEach(item => {

            const id =
                item.dataset.id;

            item.classList.toggle(
                "selected",
                selectedPages.has(id)
            );

        });


    document
        .querySelectorAll(".viewer-page")
        .forEach(page => {

            const id =
                page.dataset.id;

            page.classList.toggle(
                "selected-page",
                selectedPages.has(id)
            );

        });


    const count =
        pageData.length;


    $("sidebarPageCount").textContent =
        `${count} page${count === 1 ? "" : "s"}`;


    $("selectionStatus").textContent =
        selectedPages.size
            ? `${selectedPages.size} page${selectedPages.size === 1 ? "" : "s"} selected`
            : "No page selected";


    updatePageControls();

}


/* =========================================================
   SELECT ALL
========================================================= */

$("selectAllPages").addEventListener(
    "click",
    () => {

        selectedPages.clear();


        pageData.forEach(
            page =>
                selectedPages.add(
                    page.id
                )
        );


        if (pageData.length) {

            currentPageIndex = 0;

        }


        updateSidebar();

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


function previousPage() {

    if (
        currentPageIndex <= 0
    )
        return;


    currentPageIndex--;

    selectSinglePage(
        pageData[currentPageIndex].id
    );

    scrollToPage(
        currentPageIndex
    );

}


function nextPage() {

    if (
        currentPageIndex >=
        pageData.length - 1
    )
        return;


    currentPageIndex++;

    selectSinglePage(
        pageData[currentPageIndex].id
    );

    scrollToPage(
        currentPageIndex
    );

}


function scrollToPage(index) {

    const data =
        pageData[index];

    if (
        !data?.pageElement
    )
        return;


    data.pageElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center"
    });


    currentPageIndex =
        index;

    updatePageControls();

}


/* =========================================================
   SCROLL DETECTION
========================================================= */

let scrollFrame = null;


function handleViewerScroll() {

    if (scrollFrame)
        return;


    scrollFrame =
        requestAnimationFrame(
            () => {

                scrollFrame = null;


                if (!pageData.length)
                    return;


                const center =
                    viewer.getBoundingClientRect().top +
                    viewer.clientHeight / 2;


                let bestIndex = 0;

                let bestDistance =
                    Infinity;


                pageData.forEach(
                    (data, index) => {

                        if (
                            !data.pageElement
                        )
                            return;


                        const rect =
                            data.pageElement.getBoundingClientRect();


                        const pageCenter =
                            rect.top +
                            rect.height / 2;


                        const distance =
                            Math.abs(
                                pageCenter -
                                center
                            );


                        if (
                            distance <
                            bestDistance
                        ) {

                            bestDistance =
                                distance;

                            bestIndex =
                                index;

                        }

                    }
                );


                currentPageIndex =
                    bestIndex;

                updatePageControls();

            }
        );

}


/* =========================================================
   ZOOM
========================================================= */

async function changeZoom(
    amount
) {

    if (
        !pageData.length ||
        isLoading
    )
        return;


    zoom =
        clamp(
            zoom + amount,
            MIN_ZOOM,
            MAX_ZOOM
        );


    await rerenderForZoom();

}


async function rerenderForZoom() {

    showLoading(
        "Rendering PDF",
        "Changing document zoom..."
    );


    try {

        const savedCurrentId =
            pageData[
                currentPageIndex
            ]?.id;


        await renderAllPages(
            5,
            95
        );


        updateZoomText();


        const newIndex =
            pageData.findIndex(
                page =>
                    page.id ===
                    savedCurrentId
            );


        if (newIndex >= 0) {

            currentPageIndex =
                newIndex;

        }


        updateSidebar();


        updateProgress(
            100,
            "Zoom ready ✓"
        );


        await wait(250);


        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;


    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not change zoom."
        );

    }

}


function updateZoomText() {

    zoomText.textContent =
        Math.round(
            zoom * 100
        ) + "%";

}


/* =========================================================
   FIT PAGE
========================================================= */

async function fitPage(
    rerender = true
) {

    if (
        !pageData.length
    )
        return;


    const data =
        pageData[
            currentPageIndex
        ];


    if (!data)
        return;


    const availableWidth =
        Math.max(
            100,
            viewer.clientWidth - 70
        );


    const availableHeight =
        Math.max(
            100,
            viewer.clientHeight - 70
        );


    const effectiveRotation =
        getEffectiveRotation(data);


    const pdfWidth =
        effectiveRotation === 90 ||
        effectiveRotation === 270
            ? data.baseHeight
            : data.baseWidth;


    const pdfHeight =
        effectiveRotation === 90 ||
        effectiveRotation === 270
            ? data.baseWidth
            : data.baseHeight;


    const desiredRenderScale =
        Math.min(
            availableWidth / pdfWidth,
            availableHeight / pdfHeight
        );


    zoom =
        clamp(
            desiredRenderScale /
            BASE_RENDER_SCALE,
            MIN_ZOOM,
            1.8
        );


    updateZoomText();


    if (rerender) {

        await rerenderForZoom();

    }

}


/* =========================================================
   EDITOR TOOLS
========================================================= */

function setupEditorEvents() {

    document
        .querySelectorAll(
            ".editor-tool[data-editor-tool]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const tool =
                            button.dataset.editorTool;


                        setActiveEditorTool(
                            tool
                        );


                        if (
                            tool === "text"
                        ) {

                            openTextModal();

                        }


                        if (
                            tool === "image"
                        ) {

                            $("editorImageInput")
                                .click();

                        }


                        if (
                            tool === "draw"
                        ) {

                            activateDrawing();

                        }


                        if (
                            tool === "sign"
                        ) {

                            openSignatureModal();

                        }

                    }
                );

            }
        );


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


    $("watermarkBtn")
        .addEventListener(
            "click",
            toggleWatermark
        );


    $("pageNumbersBtn")
        .addEventListener(
            "click",
            togglePageNumbers
        );

}


function setActiveEditorTool(
    tool
) {

    activeEditorTool =
        tool;


    document
        .querySelectorAll(
            ".editor-tool[data-editor-tool]"
        )
        .forEach(
            button =>
                button.classList.toggle(
                    "active",
                    button.dataset.editorTool ===
                    tool
                )
        );

}


/* =========================================================
   DELETE PAGES
========================================================= */

function deleteSelectedPages() {

    if (
        selectedPages.size === 0
    ) {

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


    const deletedIds =
        new Set(
            selectedPages
        );


    pageData =
        pageData.filter(
            page =>
                !deletedIds.has(
                    page.id
                )
        );


    /*
     * Remove objects belonging to
     * deleted pages.
     */

    addedObjects =
        addedObjects.filter(
            object =>
                !deletedIds.has(
                    object.pageId
                )
        );


    drawingData =
        drawingData.filter(
            drawing =>
                !deletedIds.has(
                    drawing.pageId
                )
        );


    selectedPages.clear();


    currentPageIndex =
        Math.min(
            currentPageIndex,
            pageData.length - 1
        );


    if (pageData.length) {

        selectedPages.add(
            pageData[
                currentPageIndex
            ].id
        );

    }


    rebuildViewer();

}


/* =========================================================
   ROTATION
========================================================= */

function rotateSelectedPages(
    amount
) {

    if (
        selectedPages.size === 0
    ) {

        alert(
            "Select one or more pages first."
        );

        return;

    }


    pageData.forEach(
        page => {

            if (
                selectedPages.has(
                    page.id
                )
            ) {

                page.rotation =
                    normalizeRotation(
                        page.rotation +
                        amount
                    );

            }

        }
    );


    rebuildViewer();

}


/* =========================================================
   REORDER
========================================================= */

function moveSelectedPages(
    direction
) {

    if (
        selectedPages.size === 0
    ) {

        alert(
            "Select one or more pages first."
        );

        return;

    }


    if (
        direction < 0
    ) {

        /*
         * Move selected pages upward
         * without jumping over another
         * selected page.
         */

        for (
            let i = 1;
            i < pageData.length;
            i++
        ) {

            if (
                selectedPages.has(
                    pageData[i].id
                ) &&
                !selectedPages.has(
                    pageData[i - 1].id
                )
            ) {

                [
                    pageData[i - 1],
                    pageData[i]
                ] =
                [
                    pageData[i],
                    pageData[i - 1]
                ];

            }

        }

    } else {

        /*
         * Move selected pages downward.
         */

        for (
            let i =
                pageData.length - 2;
            i >= 0;
            i--
        ) {

            if (
                selectedPages.has(
                    pageData[i].id
                ) &&
                !selectedPages.has(
                    pageData[i + 1].id
                )
            ) {

                [
                    pageData[i],
                    pageData[i + 1]
                ] =
                [
                    pageData[i + 1],
                    pageData[i]
                ];

            }

        }

    }


    rebuildViewer();

}


/* =========================================================
   REBUILD VIEWER
========================================================= */

async function rebuildViewer() {

    showLoading(
        "Updating PDF",
        "Refreshing your pages..."
    );


    try {

        await renderAllPages(
            5,
            95
        );


        updateSidebar();


        updateProgress(
            100,
            "Pages updated ✓"
        );


        await wait(250);


        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;


    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not update the PDF."
        );

    }

}


/* =========================================================
   TEXT
========================================================= */

function openTextModal() {

    if (
        selectedPages.size === 0
    ) {

        alert(
            "Select a page first."
        );

        setActiveEditorTool(
            "select"
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
        $("textInput")
            .value
            .trim();


    if (!text)
        return;


    const pageId =
        [...selectedPages][0];


    const data =
        pageData.find(
            page =>
                page.id ===
                pageId
        );


    if (!data)
        return;


    const scale =
        data.renderScale;


    const objectData = {

        id:
            "object-" +
            crypto.randomUUID(),

        type:
            "text",

        pageId,

        text,

        x:
            80 / scale,

        y:
            80 / scale,

        fontSize:
            18

    };


    addedObjects.push(
        objectData
    );


    renderObject(
        data,
        objectData
    );


    $("textModal")
        .classList.add(
            "hidden"
        );


    setActiveEditorTool(
        "select"
    );

}


/* =========================================================
   IMAGE
========================================================= */

async function handleImageUpload(
    event
) {

    const file =
        event.target.files[0];

    event.target.value = "";


    if (!file)
        return;


    if (
        selectedPages.size === 0
    ) {

        alert(
            "Select a page first."
        );

        setActiveEditorTool(
            "select"
        );

        return;

    }


    try {

        const pageId =
            [...selectedPages][0];


        const data =
            pageData.find(
                page =>
                    page.id ===
                    pageId
            );


        if (!data)
            return;


        const dataUrl =
            await imageToPngDataUrl(
                file
            );


        const scale =
            data.renderScale;


        const objectData = {

            id:
                "object-" +
                crypto.randomUUID(),

            type:
                "image",

            pageId,

            dataUrl,

            x:
                80 / scale,

            y:
                80 / scale,

            width:
                180 / scale

        };


        addedObjects.push(
            objectData
        );


        renderObject(
            data,
            objectData
        );


    } catch (error) {

        console.error(error);

        alert(
            "Could not add this image."
        );

    }


    setActiveEditorTool(
        "select"
    );

}


function imageToPngDataUrl(
    file
) {

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
   OBJECT RENDERING
========================================================= */

function renderObjectsForPage(
    data
) {

    addedObjects
        .filter(
            object =>
                object.pageId ===
                data.id
        )
        .forEach(
            object =>
                renderObject(
                    data,
                    object
                )
        );

}


function renderObject(
    data,
    objectData
) {

    if (!data.overlay)
        return;


    const existing =
        data.overlay.querySelector(
            `[data-object-id="${objectData.id}"]`
        );


    if (existing)
        existing.remove();


    if (
        objectData.type ===
        "text"
    ) {

        const element =
            document.createElement(
                "div"
            );


        element.className =
            "pdf-object text-object";


        element.dataset.objectId =
            objectData.id;


        element.textContent =
            objectData.text;


        const scale =
            data.renderScale;


        element.style.left =
            objectData.x *
            scale +
            "px";


        element.style.top =
            objectData.y *
            scale +
            "px";


        element.style.fontSize =
            objectData.fontSize *
            scale +
            "px";


        data.overlay.appendChild(
            element
        );


        makeObjectDraggable(
            element,
            objectData,
            data
        );

        return;

    }


    if (
        objectData.type ===
        "image"
    ) {

        const image =
            document.createElement(
                "img"
            );


        image.className =
            "pdf-object image-object";


        image.dataset.objectId =
            objectData.id;


        image.src =
            objectData.dataUrl;


        const scale =
            data.renderScale;


        image.style.left =
            objectData.x *
            scale +
            "px";


        image.style.top =
            objectData.y *
            scale +
            "px";


        image.style.width =
            objectData.width *
            scale +
            "px";


        data.overlay.appendChild(
            image
        );


        makeObjectDraggable(
            image,
            objectData,
            data
        );

    }

}


/* =========================================================
   DRAG OBJECTS
========================================================= */

function makeObjectDraggable(
    element,
    objectData,
    data
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

            event.stopPropagation();


            dragging = true;


            element.setPointerCapture(
                event.pointerId
            );


            startX =
                event.clientX;

            startY =
                event.clientY;


            originalX =
                objectData.x;

            originalY =
                objectData.y;

        }
    );


    element.addEventListener(
        "pointermove",
        event => {

            if (!dragging)
                return;


            const scale =
                data.renderScale;


            const dx =
                event.clientX -
                startX;


            const dy =
                event.clientY -
                startY;


            objectData.x =
                Math.max(
                    0,
                    originalX +
                    dx / scale
                );


            objectData.y =
                Math.max(
                    0,
                    originalY +
                    dy / scale
                );


            element.style.left =
                objectData.x *
                scale +
                "px";


            element.style.top =
                objectData.y *
                scale +
                "px";

        }
    );


    element.addEventListener(
        "pointerup",
        () => {

            dragging = false;

        }
    );


    element.addEventListener(
        "pointercancel",
        () => {

            dragging = false;

        }
    );

}


/* =========================================================
   DRAWING
========================================================= */

function getDrawingForPage(
    pageId
) {

    return drawingData.find(
        drawing =>
            drawing.pageId ===
            pageId
    );

}


function activateDrawing() {

    if (
        selectedPages.size === 0
    ) {

        alert(
            "Select a page first."
        );

        setActiveEditorTool(
            "select"
        );

        return;

    }


    const pageId =
        [...selectedPages][0];


    const data =
        pageData.find(
            page =>
                page.id ===
                pageId
        );


    if (!data)
        return;


    let drawing =
        getDrawingForPage(
            pageId
        );


    if (!drawing) {

        drawing = {

            id:
                "drawing-" +
                crypto.randomUUID(),

            pageId,

            strokes: []

        };


        drawingData.push(
            drawing
        );

    }


    createDrawingCanvas(
        data,
        drawing
    );

}


function createDrawingCanvas(
    data,
    drawing
) {

    if (!data.overlay)
        return;


    const old =
        data.overlay.querySelector(
            ".draw-overlay"
        );


    if (old)
        old.remove();


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.className =
        "draw-overlay";


    canvas.width =
        data.canvas.width;

    canvas.height =
        data.canvas.height;


    data.overlay.appendChild(
        canvas
    );


    const ctx =
        canvas.getContext("2d");


    ctx.lineWidth =
        Math.max(
            2,
            3 *
            data.renderScale
        );


    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";

    ctx.strokeStyle =
        "#111827";


    redrawDrawing(
        canvas,
        data,
        drawing
    );


    let activeStroke = null;


    function pointFromEvent(
        event
    ) {

        const rect =
            canvas.getBoundingClientRect();


        const viewX =
            (
                event.clientX -
                rect.left
            ) /
            data.renderScale;


        const viewY =
            (
                event.clientY -
                rect.top
            ) /
            data.renderScale;


        return viewToPdfPoint(
            data,
            viewX,
            viewY
        );

    }


    canvas.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            canvas.setPointerCapture(
                event.pointerId
            );


            activeStroke = [];

            const p =
                pointFromEvent(
                    event
                );


            activeStroke.push(
                p
            );


            const view =
                pdfToViewPoint(
                    data,
                    p.x,
                    p.y
                );


            ctx.beginPath();

            ctx.moveTo(
                view.x *
                data.renderScale,
                view.y *
                data.renderScale
            );

        }
    );


    canvas.addEventListener(
        "pointermove",
        event => {

            if (
                !activeStroke
            )
                return;


            const p =
                pointFromEvent(
                    event
                );


            const last =
                activeStroke[
                    activeStroke.length - 1
                ];


            if (
                Math.hypot(
                    p.x - last.x,
                    p.y - last.y
                ) < 0.5
            ) {
                return;
            }


            activeStroke.push(
                p
            );


            const view =
                pdfToViewPoint(
                    data,
                    p.x,
                    p.y
                );


            ctx.lineTo(
                view.x *
                data.renderScale,
                view.y *
                data.renderScale
            );


            ctx.stroke();

        }
    );


    function finishStroke() {

        if (
            !activeStroke ||
            activeStroke.length === 0
        ) {

            activeStroke = null;

            return;

        }


        drawing.strokes.push(
            activeStroke
        );


        activeStroke = null;

    }


    canvas.addEventListener(
        "pointerup",
        finishStroke
    );


    canvas.addEventListener(
        "pointercancel",
        finishStroke
    );

}


/* =========================================================
   DRAWING REDRAW
========================================================= */

function redrawDrawing(
    canvas,
    data,
    drawing
) {

    const ctx =
        canvas.getContext("2d");


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ctx.lineWidth =
        Math.max(
            2,
            3 *
            data.renderScale
        );


    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";

    ctx.strokeStyle =
        "#111827";


    for (
        const stroke of drawing.strokes
    ) {

        if (
            !stroke.length
        )
            continue;


        const first =
            pdfToViewPoint(
                data,
                stroke[0].x,
                stroke[0].y
            );


        ctx.beginPath();

        ctx.moveTo(
            first.x *
            data.renderScale,
            first.y *
            data.renderScale
        );


        for (
            let i = 1;
            i < stroke.length;
            i++
        ) {

            const p =
                pdfToViewPoint(
                    data,
                    stroke[i].x,
                    stroke[i].y
                );


            ctx.lineTo(
                p.x *
                data.renderScale,
                p.y *
                data.renderScale
            );

        }


        ctx.stroke();

    }

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

    signatureContext.lineJoin =
        "round";

    signatureContext.strokeStyle =
        "#111827";


    signatureCanvas.addEventListener(
        "pointerdown",
        event => {

            signing = true;

            signatureCanvas.setPointerCapture(
                event.pointerId
            );


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
        "pointercancel",
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
            (
                event.clientX -
                rect.left
            ) *
            canvas.width /
            rect.width,

        y:
            (
                event.clientY -
                rect.top
            ) *
            canvas.height /
            rect.height

    };

}


function openSignatureModal() {

    if (
        selectedPages.size === 0
    ) {

        alert(
            "Select a page first."
        );

        setActiveEditorTool(
            "select"
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


    const pageId =
        [...selectedPages][0];


    const data =
        pageData.find(
            page =>
                page.id ===
                pageId
        );


    if (!data)
        return;


    const scale =
        data.renderScale;


    const objectData = {

        id:
            "object-" +
            crypto.randomUUID(),

        type:
            "image",

        pageId,

        dataUrl,

        x:
            80 / scale,

        y:
            80 / scale,

        width:
            220 / scale

    };


    addedObjects.push(
        objectData
    );


    renderObject(
        data,
        objectData
    );


    $("signatureModal")
        .classList.add(
            "hidden"
        );


    setActiveEditorTool(
        "select"
    );

}


/* =========================================================
   MODALS
========================================================= */

function setupModalEvents() {

    $("closeTextModal")
        .addEventListener(
            "click",
            closeTextModal
        );


    $("cancelText")
        .addEventListener(
            "click",
            closeTextModal
        );


    $("addText")
        .addEventListener(
            "click",
            addTextObject
        );


    $("closeSignatureModal")
        .addEventListener(
            "click",
            closeSignatureModal
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


function closeTextModal() {

    $("textModal")
        .classList.add(
            "hidden"
        );

    setActiveEditorTool(
        "select"
    );

}


function closeSignatureModal() {

    $("signatureModal")
        .classList.add(
            "hidden"
        );

    setActiveEditorTool(
        "select"
    );

}


/* =========================================================
   WATERMARK
========================================================= */

function toggleWatermark() {

    if (
        !pageData.length
    ) {

        alert(
            "Open a PDF first."
        );

        return;

    }


    const value =
        prompt(
            "Enter watermark text:",
            watermarkText ||
            "A-PDF"
        );


    if (
        value === null
    )
        return;


    watermarkText =
        value.trim();


    if (!watermarkText) {

        alert(
            "Watermark text cannot be empty."
        );

        return;

    }


    $("watermarkBtn")
        .classList.add(
            "active"
        );


    setTimeout(
        () =>
            $("watermarkBtn")
                .classList.remove(
                    "active"
                ),
        400
    );

}


/* =========================================================
   PAGE NUMBERS
========================================================= */

function togglePageNumbers() {

    pageNumbersEnabled =
        !pageNumbersEnabled;


    $("pageNumbersBtn")
        .classList.toggle(
            "active",
            pageNumbersEnabled
        );


    if (pageNumbersEnabled) {

        alert(
            "Page numbers will be added when you download the PDF."
        );

    }

}


/* =========================================================
   CONVERSION EVENTS
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


/* =========================================================
   MERGE
========================================================= */

function showMergeFiles(
    event
) {

    mergeFiles =
        [...event.target.files];


    const list =
        $("mergeFileList");


    list.innerHTML =
        "";


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
                <span>
                    ${index + 1}.
                    ${escapeHtml(file.name)}
                </span>
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

    if (
        mergeFiles.length < 2
    )
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
                new Uint8Array(
                    await mergeFiles[i]
                        .arrayBuffer()
                );


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
                    merged.addPage(
                        page
                    )
            );


            updateProgress(
                (
                    (i + 1) /
                    mergeFiles.length
                ) * 100,
                `Adding PDF ${i + 1} of ${mergeFiles.length}...`
            );


            await nextFrame();

        }


        const result =
            await merged.save();


        await finishLoading();


        downloadBytes(
            result,
            "A-PDF-merged.pdf"
        );


    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not merge these PDFs.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   IMAGE → PDF
========================================================= */

function previewImages(
    event
) {

    selectedImages =
        [...event.target.files];


    renderImagePreview();

}


function renderImagePreview() {

    const grid =
        $("imagePreviewGrid");


    grid.innerHTML =
        "";


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


                    renderImagePreview();

                };


            item.appendChild(
                img
            );


            item.appendChild(
                name
            );


            item.appendChild(
                remove
            );


            grid.appendChild(
                item
            );

        }
    );


    $("imagesPdfButton")
        .classList.toggle(
            "hidden",
            selectedImages.length === 0
        );

}


async function imagesToPdf() {

    if (
        selectedImages.length === 0
    )
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


            /*
             * Convert every image,
             * including WebP, to PNG.
             */

            const dataUrl =
                await imageToPngDataUrl(
                    file
                );


            const image =
                await pdf.embedPng(
                    dataUrl
                );


            const maxWidth =
                595;

            const maxHeight =
                842;


            const scale =
                Math.min(
                    maxWidth /
                    image.width,

                    maxHeight /
                    image.height,

                    1
                );


            const width =
                image.width *
                scale;


            const height =
                image.height *
                scale;


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
                (
                    (i + 1) /
                    selectedImages.length
                ) * 100,
                `Converting image ${i + 1} of ${selectedImages.length}...`
            );


            await nextFrame();

        }


        const bytes =
            await pdf.save();


        await finishLoading();


        downloadBytes(
            bytes,
            "A-PDF-images.pdf"
        );


    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not create the PDF.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   PDF → IMAGE
========================================================= */

async function pdfToImages(
    event
) {

    const file =
        event.target.files[0];


    event.target.value = "";


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
                data:
                    new Uint8Array(bytes)
            }).promise;


        const results =
            $("pdfImageResults");


        results.innerHTML =
            "";


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
                Math.ceil(
                    viewport.width
                );


            canvas.height =
                Math.ceil(
                    viewport.height
                );


            const context =
                canvas.getContext(
                    "2d"
                );


            await page.render({
                canvasContext:
                    context,
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


            card.appendChild(
                img
            );


            card.appendChild(
                link
            );


            results.appendChild(
                card
            );


            updateProgress(
                (i / pdf.numPages) * 100,
                `Rendering page ${i} of ${pdf.numPages}...`
            );


            await nextFrame();

        }


        await finishLoading();


    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not convert this PDF.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   EXTRACT EMBEDDED IMAGES
========================================================= */

async function extractImages(
    event
) {

    const file =
        event.target.files[0];


    event.target.value = "";


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
                data:
                    new Uint8Array(bytes)
            }).promise;


        const results =
            $("extractedImagesResults");


        results.innerHTML =
            "";


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
                i <
                operatorList.fnArray.length;
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
                        !imageNames.includes(
                            name
                        )
                    ) {

                        imageNames.push(
                            name
                        );

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

                        const raw =
                            image.data instanceof
                            Uint8ClampedArray
                                ? image.data
                                : new Uint8ClampedArray(
                                    image.data.buffer ||
                                    image.data
                                );


                        if (
                            raw.length !==
                            image.width *
                            image.height *
                            4
                        ) {
                            continue;
                        }


                        const imageData =
                            new ImageData(
                                raw,
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


                } catch (
                    imageError
                ) {

                    console.warn(
                        "Could not extract image:",
                        imageError
                    );

                }

            }


            updateProgress(
                (
                    pageNumber /
                    pdf.numPages
                ) * 100,
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


        await finishLoading();


    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not inspect this PDF.\n\n" +
            error.message
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


    card.appendChild(
        img
    );


    card.appendChild(
        name
    );


    card.appendChild(
        link
    );


    container.appendChild(
        card
    );

}


/* =========================================================
   PDF INFORMATION
========================================================= */

async function showPdfInfo(
    event
) {

    const file =
        event.target.files[0];


    event.target.value = "";


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
                data:
                    new Uint8Array(bytes)
            }).promise;


        const pdfLibDocument =
            await PDFDocument.load(
                new Uint8Array(bytes)
            );


        const info =
            $("infoResults");


        info.innerHTML =
            "";


        addInfo(
            info,
            "File name",
            file.name
        );


        addInfo(
            info,
            "File size",
            formatBytes(
                bytes.length
            )
        );


        addInfo(
            info,
            "Pages",
            pdf.numPages
        );


        addInfo(
            info,
            "PDF version",
            pdfLibDocument.getVersion()
        );


        addInfo(
            info,
            "Title",
            pdfLibDocument.getTitle() ||
            "—"
        );


        addInfo(
            info,
            "Author",
            pdfLibDocument.getAuthor() ||
            "—"
        );


        addInfo(
            info,
            "Subject",
            pdfLibDocument.getSubject() ||
            "—"
        );


        addInfo(
            info,
            "Creator",
            pdfLibDocument.getCreator() ||
            "—"
        );


        addInfo(
            info,
            "Producer",
            pdfLibDocument.getProducer() ||
            "—"
        );


        updateProgress(
            100,
            "Information ready ✓"
        );


        await finishLoading();


    } catch (error) {

        console.error(error);

        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;

        alert(
            "Could not read this PDF.\n\n" +
            error.message
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
        <small>
            ${escapeHtml(title)}
        </small>

        <strong>
            ${escapeHtml(
                String(value)
            )}
        </strong>
    `;


    container.appendChild(
        item
    );

}


/* =========================================================
   DOWNLOAD / BUILD PDF
========================================================= */

async function downloadCurrentPdf() {

    if (
        !originalPdfBytes
    ) {

        alert(
            "Open a PDF first."
        );

        return;

    }


    if (
        pageData.length === 0
    ) {

        alert(
            "There are no pages to download."
        );

        return;

    }


    /*
     * Split / Extract:
     * only selected pages are exported.
     */

    let exportPages =
        [...pageData];


    if (
        currentTool === "split" ||
        currentTool === "extract"
    ) {

        if (
            selectedPages.size === 0
        ) {

            alert(
                "Select the pages you want to extract first."
            );

            return;

        }


        exportPages =
            pageData.filter(
                page =>
                    selectedPages.has(
                        page.id
                    )
            );

    }


    /*
     * Delete / Organize / Rotate / Editor
     * all use current pageData order.
     */


    showLoading(
        "Creating PDF",
        "Applying your changes..."
    );


    try {

        const source =
            await PDFDocument.load(
                new Uint8Array(
                    originalPdfBytes
                )
            );


        const output =
            await PDFDocument.create();


        const pageMap =
            new Map();


        /*
         * Copy pages in current order.
         */

        for (
            let i = 0;
            i < exportPages.length;
            i++
        ) {

            const data =
                exportPages[i];


            const sourcePage =
                source.getPage(
                    data.originalIndex
                );


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
             * Store output index by stable page ID.
             */

            pageMap.set(
                data.id,
                i
            );


            /*
             * Preserve source rotation,
             * then add our rotation.
             */

            const sourceRotation =
                normalizeRotation(
                    sourcePage
                        .getRotation()
                        .angle
                );


            const finalRotation =
                normalizeRotation(
                    sourceRotation +
                    data.rotation
                );


            page.setRotation(
                degrees(
                    finalRotation
                )
            );


            updateProgress(
                (
                    (i + 1) /
                    exportPages.length
                ) * 45,
                `Building page ${i + 1} of ${exportPages.length}...`
            );


            await nextFrame();

        }


        /*
         * Add text/image/signature objects.
         */

        const font =
            await output.embedFont(
                StandardFonts.Helvetica
            );


        const relevantObjects =
            addedObjects.filter(
                object =>
                    pageMap.has(
                        object.pageId
                    )
            );


        for (
            let i = 0;
            i < relevantObjects.length;
            i++
        ) {

            const object =
                relevantObjects[i];


            const targetIndex =
                pageMap.get(
                    object.pageId
                );


            if (
                targetIndex === undefined
            )
                continue;


            const pdfPage =
                output.getPage(
                    targetIndex
                );


            const data =
                pageData.find(
                    page =>
                        page.id ===
                        object.pageId
                );


            if (!data)
                continue;


            const rotation =
                getEffectiveRotation(
                    data
                );


            if (
                object.type ===
                "text"
            ) {

                drawTextMapped(
                    pdfPage,
                    object,
                    data,
                    font,
                    rotation
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


                drawImageMapped(
                    pdfPage,
                    image,
                    object,
                    data,
                    rotation
                );

            }


            updateProgress(
                45 +
                (
                    (i + 1) /
                    Math.max(
                        1,
                        relevantObjects.length
                    )
                ) * 15,
                `Applying edit ${i + 1}...`
            );


            await nextFrame();

        }


        /*
         * Draw vector strokes.
         */

        const relevantDrawings =
            drawingData.filter(
                drawing =>
                    pageMap.has(
                        drawing.pageId
                    )
            );


        for (
            const drawing of relevantDrawings
        ) {

            const targetIndex =
                pageMap.get(
                    drawing.pageId
                );


            if (
                targetIndex === undefined
            )
                continue;


            const pdfPage =
                output.getPage(
                    targetIndex
                );


            for (
                const stroke of drawing.strokes
            ) {

                for (
                    let i = 1;
                    i < stroke.length;
                    i++
                ) {

                    const a =
                        stroke[i - 1];

                    const b =
                        stroke[i];


                    pdfPage.drawLine({

                        start: {
                            x: a.x,
                            y: a.y
                        },

                        end: {
                            x: b.x,
                            y: b.y
                        },

                        thickness: 2,

                        color:
                            rgb(
                                0.07,
                                0.09,
                                0.12
                            ),

                        opacity: 1

                    });

                }

            }

        }


        /*
         * Watermark.
         */

        if (
            watermarkText.trim()
        ) {

            for (
                let i = 0;
                i < output.getPageCount();
                i++
            ) {

                const page =
                    output.getPage(i);


                const width =
                    page.getWidth();


                const height =
                    page.getHeight();


                page.drawText(
                    watermarkText,
                    {

                        x:
                            width * 0.2,

                        y:
                            height * 0.5,

                        size:
                            Math.min(
                                42,
                                width / 10
                            ),

                        font,

                        color:
                            rgb(
                                0.5,
                                0.5,
                                0.5
                            ),

                        opacity:
                            0.25,

                        rotate:
                            degrees(-35)

                    }
                );

            }

        }


        /*
         * Page numbers.
         */

        if (
            pageNumbersEnabled
        ) {

            for (
                let i = 0;
                i < output.getPageCount();
                i++
            ) {

                const page =
                    output.getPage(i);


                const text =
                    String(i + 1);


                const size =
                    10;


                const textWidth =
                    font.widthOfTextAtSize(
                        text,
                        size
                    );


                page.drawText(
                    text,
                    {

                        x:
                            (
                                page.getWidth() -
                                textWidth
                            ) / 2,

                        y:
                            18,

                        size,

                        font,

                        color:
                            rgb(
                                0.25,
                                0.25,
                                0.25
                            )

                    }
                );

            }

        }


        updateProgress(
            90,
            "Finalizing PDF..."
        );


        /*
         * pdf-lib object streams provide basic
         * structural optimization.
         */

        const bytes =
            await output.save({
                useObjectStreams: true
            });


        updateProgress(
            100,
            "PDF ready ✓"
        );


        await wait(350);


        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;


        let filename =
            `A-PDF-${currentTool}.pdf`;


        if (
            currentTool === "split"
        ) {

            filename =
                "A-PDF-split.pdf";

        }


        if (
            currentTool === "extract"
        ) {

            filename =
                "A-PDF-extracted-pages.pdf";

        }


        if (
            currentTool === "delete"
        ) {

            filename =
                "A-PDF-deleted-pages.pdf";

        }


        downloadBytes(
            bytes,
            filename
        );


    } catch (error) {

        console.error(
            "PDF creation error:",
            error
        );


        loadingScreen.classList.add(
            "hidden"
        );

        isLoading = false;


        alert(
            "Could not create the edited PDF.\n\n" +
            error.message
        );

    }

}


/* =========================================================
   DRAW TEXT MAPPED TO PDF COORDINATES
========================================================= */

function drawTextMapped(
    page,
    object,
    data,
    font,
    rotation
) {

    const point =
        viewToPdfPoint(
            data,
            object.x,
            object.y
        );


    /*
     * For rotated pages, keep text positioned
     * according to the visual editor.
     *
     * PDF page rotation itself controls
     * final page orientation.
     */

    let x =
        point.x;


    let y =
        point.y -
        object.fontSize;


    const W =
        data.baseWidth;


    const H =
        data.baseHeight;


    if (
        rotation === 90
    ) {

        x =
            point.x;

        y =
            point.y -
            object.fontSize;

    }


    if (
        rotation === 180
    ) {

        x =
            point.x;

        y =
            point.y -
            object.fontSize;

    }


    if (
        rotation === 270
    ) {

        x =
            point.x;

        y =
            point.y -
            object.fontSize;

    }


    /*
     * Keep inside page where possible.
     */

    x =
        clamp(
            x,
            0,
            page.getWidth() -
            object.fontSize
        );


    y =
        clamp(
            y,
            0,
            page.getHeight() -
            object.fontSize
        );


    page.drawText(
        object.text,
        {

            x,

            y,

            size:
                object.fontSize,

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


/* =========================================================
   DRAW IMAGE MAPPED TO PDF
========================================================= */

function drawImageMapped(
    page,
    image,
    object,
    data,
    rotation
) {

    const x =
        object.x;


    const yTop =
        object.y;


    const width =
        object.width;


    const ratio =
        image.height /
        image.width;


    const height =
        width *
        ratio;


    const W =
        data.baseWidth;


    const H =
        data.baseHeight;


    let pdfX;
    let pdfY;
    let pdfWidth;
    let pdfHeight;


    if (
        rotation === 0
    ) {

        pdfX =
            x;

        pdfY =
            H -
            yTop -
            height;

        pdfWidth =
            width;

        pdfHeight =
            height;

    } else if (
        rotation === 90
    ) {

        pdfX =
            yTop;

        pdfY =
            W -
            x -
            width;

        pdfWidth =
            height;

        pdfHeight =
            width;

    } else if (
        rotation === 180
    ) {

        pdfX =
            W -
            x -
            width;

        pdfY =
            yTop;

        pdfWidth =
            width;

        pdfHeight =
            height;

    } else {

        /*
         * 270 degrees.
         */

        pdfX =
            H -
            yTop -
            height;

        pdfY =
            x;

        pdfWidth =
            height;

        pdfHeight =
            width;

    }


    pdfX =
        clamp(
            pdfX,
            0,
            Math.max(
                0,
                page.getWidth() -
                pdfWidth
            )
        );


    pdfY =
        clamp(
            pdfY,
            0,
            Math.max(
                0,
                page.getHeight() -
                pdfHeight
            )
        );


    page.drawImage(
        image,
        {

            x:
                pdfX,

            y:
                pdfY,

            width:
                pdfWidth,

            height:
                pdfHeight

        }
    );

}


/* =========================================================
   ROTATION / COORDINATES
========================================================= */

function normalizeRotation(
    value
) {

    let result =
        value % 360;


    if (
        result < 0
    ) {

        result += 360;

    }


    return result;

}


function getEffectiveRotation(
    data
) {

    return normalizeRotation(
        data.sourceRotation +
        data.rotation
    );

}


/*
 * View coordinates:
 *
 * x = left
 * y = top
 *
 * PDF coordinates:
 *
 * x = left
 * y = bottom
 */

function viewToPdfPoint(
    data,
    viewX,
    viewY
) {

    const W =
        data.baseWidth;


    const H =
        data.baseHeight;


    const rotation =
        getEffectiveRotation(
            data
        );


    if (
        rotation === 0
    ) {

        return {

            x: viewX,

            y:
                H -
                viewY

        };

    }


    if (
        rotation === 90
    ) {

        return {

            x:
                viewY,

            y:
                W -
                viewX

        };

    }


    if (
        rotation === 180
    ) {

        return {

            x:
                W -
                viewX,

            y:
                viewY

        };

    }


    return {

        x:
            H -
            viewY,

        y:
            viewX

    };

}


function pdfToViewPoint(
    data,
    pdfX,
    pdfY
) {

    const W =
        data.baseWidth;


    const H =
        data.baseHeight;


    const rotation =
        getEffectiveRotation(
            data
        );


    if (
        rotation === 0
    ) {

        return {

            x:
                pdfX,

            y:
                H -
                pdfY

        };

    }


    if (
        rotation === 90
    ) {

        return {

            x:
                W -
                pdfY,

            y:
                pdfX

        };

    }


    if (
        rotation === 180
    ) {

        return {

            x:
                W -
                pdfX,

            y:
                pdfY

        };

    }


    return {

        x:
            pdfY,

        y:
            H -
            pdfX

    };

}


/* =========================================================
   DOWNLOAD HELPER
========================================================= */

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
        3000
    );

}


/* =========================================================
   HELPERS
========================================================= */

function clamp(
    value,
    min,
    max
) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );

}


function formatBytes(
    bytes
) {

    if (!bytes)
        return "0 Bytes";


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const index =
        Math.min(
            units.length - 1,
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            )
        );


    return (
        (
            bytes /
            Math.pow(
                1024,
                index
            )
        ).toFixed(
            index === 0
                ? 0
                : 2
        )
        +
        " " +
        units[index]
    );

}


function escapeHtml(
    value
) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function nextFrame() {

    return new Promise(
        resolve =>
            requestAnimationFrame(
                resolve
            )
    );

}


function wait(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}