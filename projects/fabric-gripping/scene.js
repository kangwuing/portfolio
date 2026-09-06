import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";

const canvas = document.querySelector("#scene-canvas");
const fallback = document.querySelector("#scene-fallback");

if (!canvas) {
    document.dispatchEvent(new CustomEvent("fabricviz:error", {
        detail: { message: "The 3D canvas is unavailable." }
    }));
    throw new Error("Missing #scene-canvas");
}

const STAGES = [
    {
        key: "overview",
        title: "System overview",
        primary: "6 stages",
        secondary: "Cut · sense · plan · grip · transfer · place",
        tertiary: "Interactive research visualization"
    },
    {
        key: "sense",
        title: "Vision sensing",
        primary: "< 1 mm",
        secondary: "Projected-contour positional error",
        tertiary: "Zivid RGB-D capture and contour validation"
    },
    {
        key: "fuse",
        title: "Boundary perception",
        primary: "RGB + normal",
        secondary: "Complementary visual and geometric cues",
        tertiary: "Research layer shown without unpublished model details"
    },
    {
        key: "optimize",
        title: "Offline FEM optimization",
        primary: "0.259 → 0.109",
        secondary: "Flatness index in the reported example",
        tertiary: "57.8% lower; points are precomputed offline"
    },
    {
        key: "grasp",
        title: "Four-point gripping",
        primary: "40 / 40",
        secondary: "Fold-free placements across two tested shapes",
        tertiary: "Four needle grippers preserve point spacing"
    },
    {
        key: "place",
        title: "Transfer and placement",
        primary: "< 3 s",
        secondary: "Reported online vision-to-robot pipeline",
        tertiary: "Optimized grip points are retrieved, not solved live"
    }
];

const COMPONENTS = {
    cutter: {
        id: "cutter",
        title: "Pattern cutting and feed",
        copy: "A stylized cutting-and-conveyor station supplies pre-cut garment components to the handling cell.",
        meta: "Shima Seiki P-CAM161 · upstream process"
    },
    camera: {
        id: "camera",
        title: "3D vision sensor",
        copy: "Top-down RGB-D sensing supports part detection, contour extraction, registration and projected-contour validation.",
        meta: "Zivid 2 M70 · hand–eye calibrated"
    },
    fabric: {
        id: "fabric",
        title: "Flexible fabric component",
        copy: "The cloth surface is a lightweight visual approximation. Its motion communicates sag and folding risk, not a live solver result.",
        meta: "Orthotropic shell model in offline LS-DYNA analysis"
    },
    robot: {
        id: "robot",
        title: "Industrial robot",
        copy: "The manipulator approaches the registered target, lifts the material and transports it while maintaining the selected grip spacing.",
        meta: "Stäubli TX90L · 6-axis handling"
    },
    gripper: {
        id: "gripper",
        title: "Four-point needle gripper",
        copy: "An adjustable cross-jig places four gripping regions selected by the sequential optimization procedure.",
        meta: "Four 20 × 20 mm gripping regions in the FEM model"
    },
    sewing: {
        id: "sewing",
        title: "Placement and sewing station",
        copy: "The robot releases the component on the downstream platform for the next garment-manufacturing operation.",
        meta: "JUKI AMS-224EN · downstream context"
    }
};

let renderer;
try {
    renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
    });
} catch (error) {
    fallback?.removeAttribute("hidden");
    canvas.setAttribute("hidden", "");
    document.dispatchEvent(new CustomEvent("fabricviz:error", {
        detail: { message: "WebGL is unavailable. Showing the verified project overview instead." }
    }));
    throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07111d, 0.025);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const cameraPresets = [
    { position: [8.6, 7.2, 10.8], target: [0.25, 0.65, 0] },
    { position: [0.4, 10.5, 8.2], target: [0.3, 0, 0] },
    { position: [10.8, 4.2, 0.6], target: [0.4, 0.7, 0] }
];
let viewIndex = 0;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minDistance = 7;
controls.maxDistance = 20;
controls.minPolarAngle = 0.32;
controls.maxPolarAngle = Math.PI * 0.48;
const coarsePointer = window.matchMedia("(pointer: coarse)");
const exploreToggle = document.querySelector("#explore-3d");

function setTouchExploration(enabled) {
    if (!coarsePointer.matches) {
        controls.enabled = true;
        return;
    }
    controls.enabled = enabled;
    canvas.classList.toggle("is-exploring", enabled);
    canvas.style.touchAction = enabled ? "none" : "pan-y";
    exploreToggle?.setAttribute("aria-pressed", String(enabled));
    if (exploreToggle) exploreToggle.textContent = enabled ? "Release scroll" : "Explore 3D";
}

setTouchExploration(false);
exploreToggle?.addEventListener("click", () => {
    setTouchExploration(exploreToggle.getAttribute("aria-pressed") !== "true");
});
coarsePointer.addEventListener?.("change", () => setTouchExploration(false));

function applyView(index = viewIndex, immediate = false) {
    viewIndex = (index + cameraPresets.length) % cameraPresets.length;
    const preset = cameraPresets[viewIndex];
    const nextPosition = new THREE.Vector3(...preset.position);
    const nextTarget = new THREE.Vector3(...preset.target);
    if (immediate) {
        camera.position.copy(nextPosition);
        controls.target.copy(nextTarget);
        controls.update();
        return;
    }
    camera.userData.transition = {
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPosition: nextPosition,
        toTarget: nextTarget,
        progress: 0
    };
}

applyView(0, true);

const hemi = new THREE.HemisphereLight(0xb9ddff, 0x112132, 2.1);
scene.add(hemi);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.3);
keyLight.position.set(-3, 9, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
scene.add(keyLight);

const cyanLight = new THREE.PointLight(0x44d7df, 24, 9, 2);
cyanLight.position.set(-1.2, 3.8, -1.7);
scene.add(cyanLight);

const warmLight = new THREE.PointLight(0xffa46f, 16, 8, 2);
warmLight.position.set(4.4, 2.8, 2.2);
scene.add(warmLight);

const world = new THREE.Group();
scene.add(world);

const interactiveMeshes = [];
const beltRollers = [];
const accentMaterials = [];

const materials = {
    dark: new THREE.MeshStandardMaterial({ color: 0x172331, metalness: 0.72, roughness: 0.32 }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x263443, metalness: 0.45, roughness: 0.46 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xaebdca, metalness: 0.82, roughness: 0.23 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe8f0f5, metalness: 0.25, roughness: 0.28 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x28c4d6, emissive: 0x063f47, emissiveIntensity: 0.5, metalness: 0.35, roughness: 0.28 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x2f71d9, emissive: 0x071d45, emissiveIntensity: 0.35, metalness: 0.35, roughness: 0.35 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe88349, emissive: 0x3a1304, emissiveIntensity: 0.28, roughness: 0.38 }),
    belt: new THREE.MeshStandardMaterial({ color: 0x2a3440, metalness: 0.15, roughness: 0.72 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x83ebff, transparent: true, opacity: 0.14, roughness: 0.08, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false })
};

accentMaterials.push(materials.cyan, materials.blue, materials.orange);

function mesh(geometry, material, { position, rotation, cast = true, receive = true } = {}) {
    const object = new THREE.Mesh(geometry, material);
    if (position) object.position.set(...position);
    if (rotation) object.rotation.set(...rotation);
    object.castShadow = cast;
    object.receiveShadow = receive;
    return object;
}

function markComponent(group, component) {
    group.userData.component = component;
    group.traverse((object) => {
        if (!object.isMesh) return;
        object.userData.component = component;
        interactiveMeshes.push(object);
    });
    return group;
}

function addRoundedPlatform(width, depth, position, color = 0x122233) {
    const group = new THREE.Group();
    const base = mesh(new THREE.BoxGeometry(width, 0.34, depth), new THREE.MeshStandardMaterial({
        color,
        metalness: 0.48,
        roughness: 0.42
    }), { position: [0, -0.1, 0] });
    const trim = mesh(new THREE.BoxGeometry(width + 0.08, 0.07, depth + 0.08), materials.cyan, {
        position: [0, 0.105, 0]
    });
    trim.material = materials.cyan.clone();
    trim.material.transparent = true;
    trim.material.opacity = 0.58;
    group.add(base, trim);
    group.position.set(...position);
    world.add(group);
    return group;
}

const ground = mesh(new THREE.CircleGeometry(12, 80), new THREE.MeshStandardMaterial({
    color: 0x08131f,
    metalness: 0.18,
    roughness: 0.8,
    transparent: true,
    opacity: 0.94
}), { position: [0, -0.49, 0], rotation: [-Math.PI / 2, 0, 0], cast: false });
ground.receiveShadow = true;
world.add(ground);

const grid = new THREE.GridHelper(20, 40, 0x245a70, 0x142d3c);
grid.position.y = -0.475;
grid.material.transparent = true;
grid.material.opacity = 0.35;
world.add(grid);

function createConveyor(length, width, x, z) {
    const group = new THREE.Group();
    const belt = mesh(new THREE.BoxGeometry(length, 0.16, width), materials.belt, { position: [0, 0.18, 0] });
    group.add(belt);
    const railGeometry = new THREE.BoxGeometry(length + 0.2, 0.17, 0.1);
    group.add(
        mesh(railGeometry, materials.steel, { position: [0, 0.25, width / 2 + 0.03] }),
        mesh(railGeometry, materials.steel, { position: [0, 0.25, -width / 2 - 0.03] })
    );
    const rollerGeometry = new THREE.CylinderGeometry(0.12, 0.12, width + 0.12, 18);
    for (let px = -length / 2 + 0.22; px < length / 2; px += 0.42) {
        const roller = mesh(rollerGeometry, materials.steel, {
            position: [px, 0.29, 0],
            rotation: [Math.PI / 2, 0, 0]
        });
        roller.scale.set(0.68, 1, 0.68);
        beltRollers.push(roller);
        group.add(roller);
    }
    group.position.set(x, -0.18, z);
    world.add(group);
    return group;
}

const mainConveyor = createConveyor(5.1, 2.15, -0.55, 0);
const outputConveyor = createConveyor(2.5, 1.75, 5.05, 0.15);

function createCutter() {
    const group = new THREE.Group();
    addRoundedPlatform(2.4, 2.1, [-4.25, -0.22, 0], 0x17384c);
    const posts = [-0.88, 0.88];
    posts.forEach((z) => {
        group.add(mesh(new THREE.BoxGeometry(0.14, 1.45, 0.14), materials.steel, { position: [-0.72, 0.92, z] }));
        group.add(mesh(new THREE.BoxGeometry(0.14, 1.45, 0.14), materials.steel, { position: [0.72, 0.92, z] }));
    });
    group.add(mesh(new THREE.BoxGeometry(1.65, 0.14, 1.95), materials.steel, { position: [0, 1.58, 0] }));
    const head = mesh(new THREE.BoxGeometry(0.38, 0.45, 0.38), materials.orange, { position: [0.08, 1.28, 0.05] });
    const blade = mesh(new THREE.ConeGeometry(0.08, 0.38, 16), materials.white, { position: [0.08, 0.94, 0.05] });
    group.add(head, blade);
    group.position.set(-4.25, 0, 0);
    world.add(markComponent(group, COMPONENTS.cutter));
    return group;
}

const cutter = createCutter();

function createVisionRig() {
    const group = new THREE.Group();
    const upright = mesh(new THREE.BoxGeometry(0.16, 3.35, 0.16), materials.steel, { position: [0, 1.42, 0] });
    const boom = mesh(new THREE.BoxGeometry(2.2, 0.16, 0.16), materials.steel, { position: [0.98, 3.02, 0] });
    const sensor = mesh(new THREE.BoxGeometry(0.62, 0.34, 0.48), materials.dark, { position: [1.73, 2.78, 0] });
    const lens = mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.16, 24), materials.cyan, {
        position: [1.73, 2.55, 0],
        rotation: [0, 0, 0]
    });
    const indicator = mesh(new THREE.SphereGeometry(0.045, 16, 16), materials.cyan, { position: [1.52, 2.78, 0.25] });
    group.add(upright, boom, sensor, lens, indicator);
    group.position.set(-2.2, 0, -1.45);
    world.add(markComponent(group, COMPONENTS.camera));
    return { group, sensor, lens, indicator };
}

const visionRig = createVisionRig();

const scanConeMaterial = new THREE.MeshBasicMaterial({
    color: 0x45deee,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const scanCone = mesh(new THREE.ConeGeometry(1.28, 2.4, 4, 1, true), scanConeMaterial, {
    position: [-0.47, 1.37, -1.45],
    rotation: [0, Math.PI / 4, 0],
    cast: false,
    receive: false
});
world.add(scanCone);

function createTankTopTexture() {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 512;
    textureCanvas.height = 384;
    const context = textureCanvas.getContext("2d");
    const gradient = context.createLinearGradient(40, 40, 470, 340);
    gradient.addColorStop(0, "#60e5e2");
    gradient.addColorStop(0.48, "#2faad7");
    gradient.addColorStop(1, "#3775da");
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(156, 34);
    context.bezierCurveTo(185, 66, 213, 72, 256, 72);
    context.bezierCurveTo(299, 72, 327, 66, 356, 34);
    context.lineTo(430, 77);
    context.bezierCurveTo(385, 125, 380, 181, 390, 344);
    context.lineTo(122, 344);
    context.bezierCurveTo(132, 181, 127, 125, 82, 77);
    context.closePath();
    context.fill();
    context.strokeStyle = "rgba(230,255,255,.72)";
    context.lineWidth = 5;
    context.stroke();
    context.strokeStyle = "rgba(8,72,120,.42)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(132, 316);
    context.lineTo(380, 316);
    context.moveTo(154, 63);
    context.bezierCurveTo(188, 103, 222, 112, 256, 112);
    context.bezierCurveTo(290, 112, 324, 103, 358, 63);
    context.stroke();
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
}

const clothGeometry = new THREE.PlaneGeometry(2.35, 1.72, 24, 18);
clothGeometry.rotateX(-Math.PI / 2);
const baseClothPositions = Float32Array.from(clothGeometry.attributes.position.array);
const clothMaterial = new THREE.MeshPhysicalMaterial({
    map: createTankTopTexture(),
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.02,
    clearcoat: 0.12,
    emissive: 0x04303b,
    emissiveIntensity: 0.2
});
const clothMesh = mesh(clothGeometry, clothMaterial);
clothMesh.renderOrder = 2;
const clothGroup = new THREE.Group();
clothGroup.position.set(-0.75, 0.18, 0);
clothGroup.add(clothMesh);
world.add(markComponent(clothGroup, COMPONENTS.fabric));

const heatmapMaterial = new THREE.MeshBasicMaterial({
    color: 0xf4b65d,
    wireframe: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
});
const heatmapMesh = mesh(clothGeometry, heatmapMaterial, { position: [0, 0.025, 0], cast: false, receive: false });
clothGroup.add(heatmapMesh);

const boundaryPoints = [
    [-0.48, -0.74], [-0.8, -0.61], [-1.05, -0.38], [-0.86, -0.07],
    [-0.67, 0.27], [-0.62, 0.7], [0.62, 0.7], [0.67, 0.27],
    [0.86, -0.07], [1.05, -0.38], [0.8, -0.61], [0.48, -0.74], [-0.48, -0.74]
].map(([x, z]) => new THREE.Vector3(x, 0.055, z));
const boundaryGeometry = new THREE.BufferGeometry().setFromPoints(boundaryPoints);
const boundaryLine = new THREE.Line(boundaryGeometry, new THREE.LineBasicMaterial({
    color: 0x7ef8ff,
    transparent: true,
    opacity: 0.95,
    depthTest: false
}));
boundaryLine.renderOrder = 5;
clothGroup.add(boundaryLine);

const gripStart = [
    new THREE.Vector3(-0.36, 0.1, -0.34),
    new THREE.Vector3(0.36, 0.1, -0.34),
    new THREE.Vector3(-0.36, 0.1, 0.38),
    new THREE.Vector3(0.36, 0.1, 0.38)
];
const gripEnd = [
    new THREE.Vector3(-0.82, 0.1, -0.54),
    new THREE.Vector3(0.82, 0.1, -0.54),
    new THREE.Vector3(-0.66, 0.1, 0.56),
    new THREE.Vector3(0.66, 0.1, 0.56)
];
const gripMarkers = gripStart.map((position, index) => {
    const marker = mesh(new THREE.SphereGeometry(0.085, 20, 20), index % 2 ? materials.orange : materials.cyan, {
        position: position.toArray(),
        cast: false,
        receive: false
    });
    marker.userData.pulseOffset = index * 0.7;
    clothGroup.add(marker);
    return marker;
});
const trailGeometry = new THREE.BufferGeometry().setFromPoints(gripStart.flatMap((point, index) => [
    point.clone().setY(0.06), gripEnd[index].clone().setY(0.06)
]));
const gripTrails = new THREE.LineSegments(trailGeometry, new THREE.LineDashedMaterial({
    color: 0xffbd73,
    transparent: true,
    opacity: 0.7,
    dashSize: 0.08,
    gapSize: 0.05,
    depthTest: false
}));
gripTrails.computeLineDistances();
clothGroup.add(gripTrails);

function createFusionLayer() {
    const group = new THREE.Group();
    const panelGeometry = new THREE.PlaneGeometry(1.1, 0.72);
    const rgb = mesh(panelGeometry, new THREE.MeshBasicMaterial({
        color: 0x34badd,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false
    }), { position: [-0.66, 0, 0], cast: false, receive: false });
    const normal = mesh(panelGeometry, new THREE.MeshBasicMaterial({
        color: 0xef8bd8,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false
    }), { position: [0.66, 0, 0], cast: false, receive: false });
    const core = mesh(new THREE.IcosahedronGeometry(0.25, 1), new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x27cfe1,
        emissiveIntensity: 1.4,
        metalness: 0.5,
        roughness: 0.18
    }), { position: [0, -0.82, 0], cast: false, receive: false });
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x7beef3, transparent: true, opacity: 0.68 });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.66, -0.38, 0), new THREE.Vector3(0, -0.82, 0),
        new THREE.Vector3(0.66, -0.38, 0), new THREE.Vector3(0, -0.82, 0),
        new THREE.Vector3(0, -1.05, 0), new THREE.Vector3(0, -1.75, 0)
    ]), lineMaterial);
    group.add(rgb, normal, core, lines);
    group.position.set(-0.5, 2.55, -0.6);
    group.rotation.x = -0.12;
    world.add(group);
    return { group, rgb, normal, core };
}

const fusion = createFusionLayer();

function createRobot() {
    const group = new THREE.Group();
    group.position.set(2.25, 0, 1.78);
    const base = mesh(new THREE.CylinderGeometry(0.55, 0.68, 0.55, 32), materials.white, { position: [0, 0.28, 0] });
    const waist = mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.34, 28), materials.blue, { position: [0, 0.68, 0] });
    group.add(base, waist);

    const linkGeometry = new THREE.CylinderGeometry(0.19, 0.22, 1, 24);
    const linkA = mesh(linkGeometry, materials.white);
    const linkB = mesh(linkGeometry, materials.white);
    const linkC = mesh(new THREE.CylinderGeometry(0.12, 0.15, 1, 20), materials.steel);
    const jointA = mesh(new THREE.SphereGeometry(0.29, 24, 24), materials.blue);
    const jointB = mesh(new THREE.SphereGeometry(0.25, 24, 24), materials.blue);
    const jointC = mesh(new THREE.SphereGeometry(0.19, 20, 20), materials.cyan);
    group.add(linkA, linkB, linkC, jointA, jointB, jointC);

    world.add(markComponent(group, COMPONENTS.robot));
    return { group, base, waist, links: [linkA, linkB, linkC], joints: [jointA, jointB, jointC] };
}

const robot = createRobot();

function createGripper() {
    const group = new THREE.Group();
    const crossA = mesh(new THREE.BoxGeometry(1.6, 0.11, 0.12), materials.steel);
    const crossB = mesh(new THREE.BoxGeometry(0.12, 0.11, 1.15), materials.steel);
    const mount = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 24), materials.cyan, { position: [0, 0.18, 0] });
    group.add(crossA, crossB, mount);
    [[-0.7, -0.48], [0.7, -0.48], [-0.7, 0.48], [0.7, 0.48]].forEach(([x, z]) => {
        const carriage = mesh(new THREE.BoxGeometry(0.22, 0.15, 0.22), materials.dark, { position: [x, -0.04, z] });
        const needle = mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.38, 12), materials.orange, { position: [x, -0.26, z] });
        group.add(carriage, needle);
    });
    group.scale.setScalar(0.8);
    world.add(markComponent(group, COMPONENTS.gripper));
    return group;
}

const gripper = createGripper();

function createSewingStation() {
    const group = new THREE.Group();
    const platform = mesh(new THREE.BoxGeometry(2.2, 0.3, 2.0), materials.charcoal, { position: [0, 0.1, 0] });
    const bed = mesh(new THREE.BoxGeometry(1.75, 0.08, 1.45), materials.steel, { position: [0, 0.3, 0] });
    const column = mesh(new THREE.BoxGeometry(0.34, 1.45, 0.42), materials.white, { position: [0.65, 0.96, -0.5] });
    const head = mesh(new THREE.BoxGeometry(1.15, 0.34, 0.46), materials.white, { position: [0.18, 1.55, -0.5] });
    const needle = mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.72, 12), materials.orange, { position: [-0.28, 1.06, -0.5] });
    group.add(platform, bed, column, head, needle);
    group.position.set(3.62, -0.35, 0.05);
    world.add(markComponent(group, COMPONENTS.sewing));
    return group;
}

const sewing = createSewingStation();

function setCylinderBetween(object, start, end) {
    const direction = end.clone().sub(start);
    const length = Math.max(direction.length(), 0.001);
    object.position.copy(start).add(end).multiplyScalar(0.5);
    object.scale.set(1, length, 1);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}

const robotBase = new THREE.Vector3(2.25, 0.84, 1.78);
const elbow = new THREE.Vector3();
const wrist = new THREE.Vector3();
const tool = new THREE.Vector3();

function updateRobot(target) {
    tool.copy(target);
    const horizontal = new THREE.Vector3(target.x - robotBase.x, 0, target.z - robotBase.z);
    const reach = Math.min(horizontal.length(), 3.2);
    const direction = horizontal.lengthSq() > 0.0001 ? horizontal.normalize() : new THREE.Vector3(-1, 0, 0);
    elbow.copy(robotBase).addScaledVector(direction, 0.72 + reach * 0.16).add(new THREE.Vector3(0, 1.45, 0));
    elbow.z += 0.28;
    wrist.copy(target).lerp(elbow, 0.36).add(new THREE.Vector3(0, 0.42, 0));
    const localBase = robotBase.clone().sub(robot.group.position);
    const localElbow = elbow.clone().sub(robot.group.position);
    const localWrist = wrist.clone().sub(robot.group.position);
    const localTool = tool.clone().sub(robot.group.position);
    setCylinderBetween(robot.links[0], localBase, localElbow);
    setCylinderBetween(robot.links[1], localElbow, localWrist);
    setCylinderBetween(robot.links[2], localWrist, localTool);
    robot.joints[0].position.copy(localBase);
    robot.joints[1].position.copy(localElbow);
    robot.joints[2].position.copy(localWrist);
    gripper.position.copy(target);
}

const idleTool = new THREE.Vector3(1.02, 1.76, 0.92);
const aboveFabric = new THREE.Vector3(-0.72, 1.4, 0.02);
const onFabric = new THREE.Vector3(-0.72, 0.72, 0.02);
const liftedFabric = new THREE.Vector3(-0.22, 1.65, 0.1);
const aboveTarget = new THREE.Vector3(3.55, 1.62, 0.06);
const onTarget = new THREE.Vector3(3.55, 0.64, 0.06);

function interpolatePath(points, t) {
    const scaled = THREE.MathUtils.clamp(t, 0, 0.99999) * (points.length - 1);
    const index = Math.floor(scaled);
    const local = scaled - index;
    return points[index].clone().lerp(points[Math.min(index + 1, points.length - 1)], THREE.MathUtils.smoothstep(local, 0, 1));
}

function deformCloth({ sag = 0.03, flatness = 0.6, lift = 0 } = {}) {
    const positions = clothGeometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
        const offset = index * 3;
        const x = baseClothPositions[offset];
        const z = baseClothPositions[offset + 2];
        const radial = Math.min(1, Math.hypot(x / 1.18, z / 0.86));
        const wave = Math.sin(x * 4.6 + z * 2.1) * Math.cos(z * 4.1 - x) * 0.055;
        const edgeSag = -Math.pow(radial, 1.7) * sag;
        const centerLift = Math.max(0, 1 - radial) * lift;
        positions.setXYZ(index, x, baseClothPositions[offset + 1] + edgeSag + wave * flatness + centerLift, z);
    }
    positions.needsUpdate = true;
    clothGeometry.computeVertexNormals();
}

function createLabelLayer() {
    const host = canvas.parentElement;
    const layer = document.createElement("div");
    layer.className = "scene-label-layer";
    layer.setAttribute("aria-hidden", "true");
    const targets = [
        { key: "cutter", object: cutter, offset: new THREE.Vector3(0, 1.9, 0) },
        { key: "camera", object: visionRig.sensor, offset: new THREE.Vector3(0, 0.35, 0) },
        { key: "fabric", object: clothGroup, offset: new THREE.Vector3(0, 0.35, 0) },
        { key: "robot", object: robot.group, offset: new THREE.Vector3(0, 2.8, 0) },
        { key: "sewing", object: sewing, offset: new THREE.Vector3(0, 2.05, 0) }
    ];
    targets.forEach((target) => {
        const label = document.createElement("span");
        label.className = "scene-label";
        label.textContent = COMPONENTS[target.key].title;
        layer.append(label);
        target.element = label;
    });
    host?.append(layer);
    return { layer, targets };
}

const labels = createLabelLayer();
const tooltip = document.querySelector("#scene-tooltip") || (() => {
    const element = document.createElement("div");
    element.id = "scene-tooltip";
    element.className = "scene-tooltip";
    element.hidden = true;
    canvas.parentElement?.append(element);
    return element;
})();

let activeStageIndex = 0;
let stageElapsed = 0;
let playing = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let speed = 1;
let labelsVisible = window.innerWidth > 720;
let heatmapEnabled = true;
const stageDuration = 4.4;
const clock = new THREE.Clock();
let isVisible = true;
let hoveredComponent = null;
const highlightedMaterials = new Map();

function dispatch(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
}

function setStage(key, { preserveTime = false } = {}) {
    const index = STAGES.findIndex((stage) => stage.key === key);
    if (index < 0) return;
    activeStageIndex = index;
    if (!preserveTime) stageElapsed = key === "overview" ? 0 : stageDuration * 0.16;
    const stage = STAGES[index];
    scanCone.visible = ["sense", "fuse"].includes(stage.key);
    fusion.group.visible = stage.key === "fuse";
    boundaryLine.visible = ["sense", "fuse", "optimize"].includes(stage.key);
    gripTrails.visible = stage.key === "optimize";
    gripMarkers.forEach((marker) => { marker.visible = ["optimize", "grasp"].includes(stage.key); });
    heatmapMesh.visible = heatmapEnabled && stage.key === "optimize";
    dispatch("fabricviz:stagechange", { stage: stage.key, key: stage.key, index, title: stage.title });
    dispatch("fabricviz:metrics", {
        primary: stage.primary,
        secondary: stage.secondary,
        tertiary: stage.tertiary
    });
}

function setPlaying(next) {
    playing = Boolean(next);
    dispatch("fabricviz:playstate", { playing });
}

function resetSequence() {
    activeStageIndex = 0;
    stageElapsed = 0;
    setStage("overview", { preserveTime: true });
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function updateStagePose(time, delta) {
    const stage = STAGES[activeStageIndex];
    const phase = THREE.MathUtils.clamp(stageElapsed / stageDuration, 0, 1);
    let toolTarget = idleTool.clone();
    let clothPosition = new THREE.Vector3(-0.75, 0.18, 0);
    let sag = 0.05;
    let flatness = 0.55;
    let lift = 0;

    if (stage.key === "overview") {
        toolTarget.y += Math.sin(time * 0.8) * 0.045;
        clothPosition.x = -1.65 + ((time * 0.08) % 0.9);
        scanConeMaterial.opacity = 0.025;
    }

    if (stage.key === "sense") {
        toolTarget.copy(idleTool);
        scanConeMaterial.opacity = 0.07 + Math.sin(time * 3.2) * 0.028;
        scanCone.scale.setScalar(0.92 + Math.sin(time * 2.2) * 0.035);
        boundaryLine.material.opacity = 0.58 + Math.sin(time * 4) * 0.38;
        visionRig.indicator.scale.setScalar(0.9 + Math.sin(time * 5) * 0.22);
    }

    if (stage.key === "fuse") {
        toolTarget.copy(idleTool);
        fusion.group.position.y = 2.56 + Math.sin(time * 1.6) * 0.06;
        fusion.core.rotation.x += delta * 0.8;
        fusion.core.rotation.y += delta * 1.2;
        const pulse = 0.88 + Math.sin(time * 3.4) * 0.12;
        fusion.rgb.scale.setScalar(pulse);
        fusion.normal.scale.setScalar(1.76 - pulse * 0.75);
    }

    if (stage.key === "optimize") {
        toolTarget.copy(aboveFabric).add(new THREE.Vector3(0.8, 0.4, 0.4));
        const progress = THREE.MathUtils.smoothstep(phase, 0.04, 0.92);
        gripMarkers.forEach((marker, index) => {
            marker.position.copy(gripStart[index]).lerp(gripEnd[index], progress);
            marker.scale.setScalar(0.9 + Math.sin(time * 4 + marker.userData.pulseOffset) * 0.18);
        });
        sag = THREE.MathUtils.lerp(0.18, 0.055, progress);
        flatness = THREE.MathUtils.lerp(1, 0.22, progress);
        heatmapMaterial.color.setHSL(THREE.MathUtils.lerp(0.08, 0.76, progress), 0.78, 0.62);
    }

    if (stage.key === "grasp") {
        const t = THREE.MathUtils.smoothstep(phase, 0, 1);
        toolTarget = interpolatePath([aboveFabric, onFabric, onFabric, liftedFabric], t);
        const liftProgress = THREE.MathUtils.smoothstep(t, 0.52, 1);
        clothPosition.lerpVectors(new THREE.Vector3(-0.75, 0.18, 0), new THREE.Vector3(-0.22, 1.15, 0.1), liftProgress);
        sag = THREE.MathUtils.lerp(0.08, 0.34, liftProgress);
        flatness = 0.24;
        lift = liftProgress * 0.11;
    }

    if (stage.key === "place") {
        const t = THREE.MathUtils.smoothstep(phase, 0, 1);
        toolTarget = interpolatePath([liftedFabric, aboveTarget, onTarget, aboveTarget], t);
        const travel = THREE.MathUtils.smoothstep(t, 0.04, 0.68);
        const release = THREE.MathUtils.smoothstep(t, 0.64, 0.86);
        clothPosition.lerpVectors(new THREE.Vector3(-0.22, 1.15, 0.1), new THREE.Vector3(3.55, 0.33, 0.06), travel);
        sag = THREE.MathUtils.lerp(0.34, 0.035, release);
        flatness = THREE.MathUtils.lerp(0.24, 0.05, release);
        lift = (1 - release) * 0.12;
    }

    clothGroup.position.copy(clothPosition);
    deformCloth({ sag, flatness, lift });
    updateRobot(toolTarget);

    const beltSpeed = playing ? delta * speed * 3.2 : delta * 0.15;
    beltRollers.forEach((roller) => { roller.rotation.x -= beltSpeed; });
    materials.cyan.emissiveIntensity = 0.42 + Math.sin(time * 2.4) * 0.14;
}

function updateCameraTransition(delta) {
    const transition = camera.userData.transition;
    if (!transition) return;
    transition.progress = Math.min(1, transition.progress + delta * 1.8);
    const eased = THREE.MathUtils.smoothstep(transition.progress, 0, 1);
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
    if (transition.progress >= 1) delete camera.userData.transition;
}

function updateLabels() {
    labels.layer.hidden = !labelsVisible;
    if (!labelsVisible) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    labels.targets.forEach((target) => {
        const position = new THREE.Vector3();
        target.object.getWorldPosition(position);
        position.add(target.offset);
        position.project(camera);
        const visible = position.z > -1 && position.z < 1;
        target.element.style.transform = `translate(-50%, -50%) translate(${(position.x * 0.5 + 0.5) * width}px, ${(-position.y * 0.5 + 0.5) * height}px)`;
        target.element.style.opacity = visible ? "1" : "0";
    });
}

function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (canvas.width === Math.floor(width * renderer.getPixelRatio()) && canvas.height === Math.floor(height * renderer.getPixelRatio())) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function restoreHover() {
    highlightedMaterials.forEach((previous, material) => {
        material.emissive.setHex(previous.emissive);
        material.emissiveIntensity = previous.intensity;
    });
    highlightedMaterials.clear();
    hoveredComponent = null;
    tooltip.hidden = true;
    canvas.style.cursor = "grab";
}

function applyHover(component) {
    if (!component || hoveredComponent?.id === component.id) return;
    restoreHover();
    hoveredComponent = component;
    interactiveMeshes.filter((object) => object.userData.component?.id === component.id).forEach((object) => {
        const materialList = Array.isArray(object.material) ? object.material : [object.material];
        materialList.forEach((material) => {
            if (!material?.emissive) return;
            if (!highlightedMaterials.has(material)) {
                highlightedMaterials.set(material, {
                    emissive: material.emissive.getHex(),
                    intensity: material.emissiveIntensity || 0
                });
            }
            material.emissive.setHex(0x1bd4e7);
            material.emissiveIntensity = 0.72;
        });
    });
    tooltip.textContent = component.title;
    tooltip.hidden = false;
    canvas.style.cursor = "pointer";
    dispatch("fabricviz:inspect", component);
}

function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactiveMeshes, false)[0];
    if (hit?.object.userData.component) applyHover(hit.object.userData.component);
    else restoreHover();
    if (!tooltip.hidden) {
        tooltip.style.left = `${event.clientX - rect.left + 14}px`;
        tooltip.style.top = `${event.clientY - rect.top + 14}px`;
    }
}

canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerleave", restoreHover);
canvas.addEventListener("dblclick", () => applyView(0));

document.addEventListener("fabricviz:stage", (event) => {
    const key = event.detail?.stage || event.detail?.key || event.detail;
    setStage(String(key));
});
document.addEventListener("fabricviz:play", (event) => {
    const next = event.detail?.playing ?? event.detail?.play ?? event.detail;
    setPlaying(next === undefined ? !playing : Boolean(next));
});
document.addEventListener("fabricviz:restart", resetSequence);
document.addEventListener("fabricviz:view", () => applyView(viewIndex + 1));
document.addEventListener("fabricviz:reset-view", () => applyView(0));
document.addEventListener("fabricviz:toggle-labels", (event) => {
    labelsVisible = event.detail?.enabled ?? !labelsVisible;
});
document.addEventListener("fabricviz:toggle-heatmap", (event) => {
    heatmapEnabled = event.detail?.enabled ?? !heatmapEnabled;
    heatmapMesh.visible = heatmapEnabled && STAGES[activeStageIndex].key === "optimize";
});
document.addEventListener("fabricviz:speed", (event) => {
    speed = THREE.MathUtils.clamp(Number(event.detail?.speed ?? event.detail ?? 1), 0.5, 2);
});
document.addEventListener("fabricviz:bootstrap", (event) => {
    const next = event.detail || {};
    if (next.stage) setStage(next.stage);
    if (typeof next.playing === "boolean") setPlaying(next.playing);
    if (typeof next.labels === "boolean") labelsVisible = next.labels;
    if (typeof next.heatmap === "boolean") {
        heatmapEnabled = next.heatmap;
        heatmapMesh.visible = heatmapEnabled && STAGES[activeStageIndex].key === "optimize";
    }
    if (next.speed) speed = THREE.MathUtils.clamp(Number(next.speed), 0.5, 2);
    if (next.view === "top") applyView(1, true);
    else if (next.view === "sensor") applyView(2, true);
    else applyView(0, true);
});

new ResizeObserver(resize).observe(canvas);

if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) clock.getDelta();
    }, { threshold: 0.01 }).observe(canvas);
}

document.addEventListener("visibilitychange", () => {
    isVisible = !document.hidden;
    if (isVisible) clock.getDelta();
});

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    if (!isVisible) return;
    const time = clock.elapsedTime;
    if (playing) {
        stageElapsed += delta * speed;
        if (stageElapsed >= stageDuration) {
            const next = (activeStageIndex + 1) % STAGES.length;
            stageElapsed = 0;
            setStage(STAGES[next].key, { preserveTime: true });
        }
    }
    updateStagePose(time, delta);
    updateCameraTransition(delta);
    controls.update();
    updateLabels();
    resize();
    renderer.render(scene, camera);
}

setStage("overview", { preserveTime: true });
dispatch("fabricviz:playstate", { playing });
dispatch("fabricviz:ready", {
    stages: STAGES.map(({ key, title }) => ({ key, title })),
    playing,
    version: "1.0.0"
});
animate();
