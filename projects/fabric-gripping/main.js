const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

const STAGES = {
    overview: {
        step: "Stage 00",
        title: "Integrated garment-handling line",
        copy: "The visualization connects automatic cutting, vision-guided robotic manipulation, and downstream sewing. Select a stage to isolate its role.",
        meta: "Camera · conveyor · robot · needle gripper · placement bed",
        metrics: [
            ["System stages", "6"],
            ["Needle grippers", "4"],
            ["Online cycle", "3 s"],
        ],
        scope: "Values reflect the reported experimental configuration, not a universal production guarantee.",
    },
    sense: {
        step: "Stage 01",
        title: "Acquire the fabric workspace",
        copy: "A fixed overhead 3D camera captures synchronized optical and geometric information. The sensing layer makes faint cutting boundaries available to the perception pipeline.",
        meta: "RGB · depth · surface normals · sensor confidence",
        metrics: [
            ["Reported detection", "29/30"],
            ["Image capture", "0.4 s"],
            ["Projection deviation", "<1 mm"],
        ],
        scope: "Detection and projection values come from the reported system tests; sample scopes differ between experiments.",
    },
    fuse: {
        step: "Stage 02",
        title: "Fuse optical and geometric cues",
        copy: "The perception layer combines optical appearance with geometric surface cues to make faint fabric boundaries easier to localize before robotic manipulation.",
        meta: "RGB appearance · surface geometry · boundary localization",
        metrics: [
            ["Optical input", "RGB"],
            ["Geometry cue", "Normals"],
            ["Pipeline output", "Boundary"],
        ],
        scope: "This stage is a generic system-level explanation; no unpublished model architecture or evaluation result is disclosed.",
    },
    optimize: {
        step: "Stage 03",
        title: "Precompute four gripping locations",
        copy: "Offline FEM analysis scores fabric flatness while a sequential search moves four candidate gripping regions in eight directions. Accepted positions are stored for online retrieval.",
        meta: "LS-DYNA offline · 8 search directions · 20 mm initial step",
        metrics: [
            ["Flatness index", "0.259→0.109"],
            ["Reported reduction", "57.8%"],
            ["Gripping regions", "4"],
        ],
        scope: "The displayed deformation and heatmap are explanatory representations of precomputed analysis, not a browser FEM solve.",
    },
    grasp: {
        step: "Stage 04",
        title: "Register, approach, and engage",
        copy: "The observed part is aligned to its CAD template, stored gripping points are mapped into the robot frame, and four adjustable needle grippers secure the fabric.",
        meta: "CAD matching · ICP alignment · robot frame · needle engagement",
        metrics: [
            ["ICP fitness", ">90%"],
            ["Reported RMSE", "<3"],
            ["Gripping points", "4"],
        ],
        scope: "The source does not state a unit for the reported ICP RMSE; none is implied here.",
    },
    place: {
        step: "Stage 05",
        title: "Transfer and release the part",
        copy: "The robot preserves the geometric relationship among the gripping points during transfer, approaches the target plane, retracts the needles, and releases the component for the next operation.",
        meta: "Lift · transfer · target approach · needle retraction · release",
        metrics: [
            ["Fold-free trials", "40/40"],
            ["Tested shapes", "2"],
            ["Online pipeline", "3 s"],
        ],
        scope: "The 40 trials cover the two reported garment shapes and should not be generalized to arbitrary fabrics or geometries.",
    },
};

const VIEWS = [
    { id: "isometric", label: "Isometric" },
    { id: "top", label: "Top" },
    { id: "sensor", label: "Sensor" },
];

const state = {
    stage: "overview",
    playing: !reducedMotion.matches,
    view: "isometric",
    labels: window.innerWidth > 720,
    heatmap: false,
    speed: 1,
};

const elements = {
    system: document.querySelector("#interactive-system"),
    canvas: document.querySelector("#scene-canvas"),
    sceneStatus: document.querySelector("#scene-status span:last-child"),
    activeViewLabel: document.querySelector("#active-view-label"),
    stageButtons: [...document.querySelectorAll("[data-stage]")],
    play: document.querySelector("#play-toggle"),
    restart: document.querySelector("#restart-sequence"),
    view: document.querySelector("#view-cycle"),
    resetView: document.querySelector("#reset-view"),
    labels: document.querySelector("#toggle-labels"),
    heatmap: document.querySelector("#toggle-heatmap"),
    speed: document.querySelector("#speed-control"),
    inspectorStep: document.querySelector("#inspector-step"),
    inspectorTitle: document.querySelector("#inspector-title"),
    inspectorCopy: document.querySelector("#inspector-copy"),
    inspectorMeta: document.querySelector("#inspector-meta"),
    metricLabels: [
        document.querySelector("#metric-primary-label"),
        document.querySelector("#metric-secondary-label"),
        document.querySelector("#metric-tertiary-label"),
    ],
    metricValues: [
        document.querySelector("#metric-primary"),
        document.querySelector("#metric-secondary"),
        document.querySelector("#metric-tertiary"),
    ],
    metricsScope: document.querySelector("#metrics-scope"),
    themeToggle: document.querySelector("#theme-toggle"),
    themeLabel: document.querySelector("[data-theme-label]"),
    themeColor: document.querySelector("#theme-color"),
};

const emit = (name, detail = {}) => {
    document.dispatchEvent(new CustomEvent(`fabricviz:${name}`, { detail }));
};

const currentView = () => VIEWS.find((item) => item.id === state.view) ?? VIEWS[0];

const renderPlayState = () => {
    if (!elements.play) return;
    elements.play.setAttribute("aria-pressed", String(state.playing));
    const label = elements.play.querySelector("[data-control-label]");
    if (label) label.textContent = state.playing ? "Pause" : "Play";
    const icon = elements.play.querySelector("svg");
    if (icon) {
        icon.dataset.icon = state.playing ? "pause" : "play";
        icon.innerHTML = state.playing
            ? '<path d="M9 5v14M15 5v14"></path>'
            : '<path d="m8 5 11 7-11 7V5Z"></path>';
    }
};

const renderViewState = () => {
    const view = currentView();
    const label = elements.view?.querySelector("[data-view-label]");
    if (label) label.textContent = view.label;
    if (elements.activeViewLabel) elements.activeViewLabel.textContent = `${view.label} view`;
};

const renderSwitch = (element, checked) => {
    element?.setAttribute("aria-checked", String(checked));
};

const renderInspector = (data) => {
    if (!data) return;
    if (elements.inspectorStep && data.step) elements.inspectorStep.textContent = data.step;
    if (elements.inspectorTitle && data.title) elements.inspectorTitle.textContent = data.title;
    if (elements.inspectorCopy && data.copy) elements.inspectorCopy.textContent = data.copy;
    if (elements.inspectorMeta && data.meta) elements.inspectorMeta.textContent = data.meta;
};

const renderMetrics = (metrics, scope) => {
    metrics?.slice(0, 3).forEach((metric, index) => {
        const [label, value] = Array.isArray(metric)
            ? metric
            : [metric.label, metric.value];
        if (elements.metricLabels[index] && label != null) elements.metricLabels[index].textContent = String(label);
        if (elements.metricValues[index] && value != null) elements.metricValues[index].textContent = String(value);
    });
    if (elements.metricsScope && scope) elements.metricsScope.textContent = scope;
};

const setStage = (stage, options = {}) => {
    if (!STAGES[stage]) return;
    state.stage = stage;
    elements.stageButtons.forEach((button) => {
        const active = button.dataset.stage === stage;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    renderInspector(STAGES[stage]);
    renderMetrics(STAGES[stage].metrics, STAGES[stage].scope);
    if (options.emit !== false) emit("stage", { stage, source: options.source ?? "ui" });
};

const setPlaying = (playing, options = {}) => {
    state.playing = Boolean(playing);
    renderPlayState();
    if (options.emit !== false) emit("play", { playing: state.playing, source: options.source ?? "ui" });
};

const setSceneStatus = (status, message) => {
    if (elements.system && status) elements.system.dataset.sceneState = status;
    if (elements.sceneStatus && message) elements.sceneStatus.textContent = message;
};

const setTheme = (theme, persist = false) => {
    const nextTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    root.style.colorScheme = nextTheme;
    const dark = nextTheme === "dark";

    elements.themeToggle?.setAttribute("aria-pressed", String(dark));
    elements.themeToggle?.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
    if (elements.themeLabel) elements.themeLabel.textContent = dark ? "Light" : "Dark";
    elements.themeToggle?.querySelector(".theme-icon--moon")?.toggleAttribute("hidden", dark);
    elements.themeToggle?.querySelector(".theme-icon--sun")?.toggleAttribute("hidden", !dark);
    if (elements.themeColor) elements.themeColor.content = dark ? "#070b12" : "#edf4ff";

    if (persist) {
        try {
            localStorage.setItem("portfolio-theme", nextTheme);
        } catch {
            // The selected theme still applies to this visit.
        }
    }
    emit("theme", { theme: nextTheme });
};

elements.stageButtons.forEach((button, index) => {
    button.addEventListener("click", () => setStage(button.dataset.stage, { source: "stage-button" }));
    button.addEventListener("keydown", (event) => {
        let nextIndex = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % elements.stageButtons.length;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + elements.stageButtons.length) % elements.stageButtons.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = elements.stageButtons.length - 1;
        if (nextIndex == null) return;
        event.preventDefault();
        elements.stageButtons[nextIndex].focus();
        elements.stageButtons[nextIndex].click();
    });
});

elements.play?.addEventListener("click", () => setPlaying(!state.playing, { source: "play-control" }));

elements.restart?.addEventListener("click", () => {
    setStage("overview", { emit: false });
    setPlaying(!reducedMotion.matches, { emit: false });
    emit("restart", { ...state });
});

elements.view?.addEventListener("click", () => {
    const index = VIEWS.findIndex((item) => item.id === state.view);
    state.view = VIEWS[(index + 1) % VIEWS.length].id;
    renderViewState();
    emit("view", { view: state.view, source: "view-cycle" });
});

elements.resetView?.addEventListener("click", () => {
    state.view = "isometric";
    renderViewState();
    emit("reset-view", { view: state.view });
});

elements.labels?.addEventListener("click", () => {
    state.labels = !state.labels;
    renderSwitch(elements.labels, state.labels);
    emit("toggle-labels", { enabled: state.labels });
});

elements.heatmap?.addEventListener("click", () => {
    state.heatmap = !state.heatmap;
    renderSwitch(elements.heatmap, state.heatmap);
    emit("toggle-heatmap", { enabled: state.heatmap });
});

elements.speed?.addEventListener("change", () => {
    const speed = Number.parseFloat(elements.speed.value);
    state.speed = Number.isFinite(speed) ? speed : 1;
    emit("speed", { speed: state.speed });
});

elements.themeToggle?.addEventListener("click", () => {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
});

systemTheme.addEventListener("change", (event) => {
    let stored = null;
    try {
        stored = localStorage.getItem("portfolio-theme");
    } catch {
        // Follow the system theme when storage is unavailable.
    }
    if (!stored) setTheme(event.matches ? "dark" : "light");
});

reducedMotion.addEventListener("change", (event) => {
    if (event.matches) setPlaying(false, { source: "reduced-motion" });
    emit("motion-preference", { reduced: event.matches });
});

elements.canvas?.addEventListener("keydown", (event) => {
    if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        setPlaying(!state.playing, { source: "canvas-keyboard" });
    }
    if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        elements.resetView?.click();
    }
});

document.addEventListener("fabricviz:ready", () => {
    setSceneStatus("ready", "Interactive model ready");
    emit("bootstrap", { ...state, reducedMotion: reducedMotion.matches, theme: root.dataset.theme });
});

document.addEventListener("fabricviz:error", (event) => {
    const message = event.detail?.message || "3D unavailable — showing project overview";
    setSceneStatus("error", message);
});

document.addEventListener("fabricviz:stagechange", (event) => {
    if (STAGES[event.detail?.stage]) setStage(event.detail.stage, { emit: false });
});

document.addEventListener("fabricviz:playstate", (event) => {
    if (typeof event.detail?.playing === "boolean") setPlaying(event.detail.playing, { emit: false });
});

document.addEventListener("fabricviz:viewchange", (event) => {
    if (VIEWS.some((item) => item.id === event.detail?.view)) {
        state.view = event.detail.view;
        renderViewState();
    }
});

document.addEventListener("fabricviz:inspect", (event) => {
    renderInspector(event.detail);
});

document.addEventListener("fabricviz:metrics", (event) => {
    renderMetrics(event.detail?.metrics, event.detail?.scope);
});

if (window.matchMedia("(pointer: fine)").matches && !reducedMotion.matches) {
    document.querySelectorAll("[data-spotlight]").forEach((surface) => {
        surface.addEventListener("pointermove", (event) => {
            const bounds = surface.getBoundingClientRect();
            surface.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`);
            surface.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`);
        }, { passive: true });
    });
}

setTheme(root.dataset.theme);
setStage(state.stage, { emit: false });
renderPlayState();
renderViewState();
renderSwitch(elements.labels, state.labels);
renderSwitch(elements.heatmap, state.heatmap);

window.fabricVizUI = Object.freeze({
    getState: () => ({ ...state }),
    setStage: (stage) => setStage(stage, { source: "api" }),
    setPlaying: (playing) => setPlaying(playing, { source: "api" }),
    reportError: (message) => setSceneStatus("error", message),
});

emit("ui-ready", { ...state, reducedMotion: reducedMotion.matches, theme: root.dataset.theme });

import("./scene.js").catch(() => {
    setSceneStatus("error", "3D unavailable — showing project overview");
});

window.setTimeout(() => {
    if (elements.system?.dataset.sceneState === "loading") {
        setSceneStatus("error", "3D is taking longer than expected — showing project overview");
    }
}, 12000);
