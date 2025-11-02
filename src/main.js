import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

const container = document.getElementById('app');

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0f12);

// Camera
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
camera.position.set(0, 1.6, 3);

// Controls (non-XR)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
hemi.position.set(0, 1, 0);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(3, 5, 2);
scene.add(dir);

// Floor (visible in VR; transparent in AR)
const floor = new THREE.Mesh(
	new THREE.CircleGeometry(4, 48),
	new THREE.MeshStandardMaterial({ color: 0x1d2230, metalness: 0.2, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

// Spinning cube
const cube = new THREE.Mesh(
	new THREE.BoxGeometry(0.3, 0.3, 0.3),
	new THREE.MeshStandardMaterial({ color: 0x4f82ff })
);
cube.position.set(0, 0.4, -1);
scene.add(cube);

// Reticle for AR placement (optional simple indicator)
const reticle = new THREE.Mesh(
	new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2),
	new THREE.MeshBasicMaterial({ color: 0x00ffa2 })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

let xrHitTestSource = null;
let xrLocalSpace = null;

// Inject VR and AR buttons
document.querySelector('.buttons')?.appendChild(VRButton.createButton(renderer));
document.querySelector('.buttons')?.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

renderer.xr.addEventListener('sessionstart', async () => {
	const session = renderer.xr.getSession();
	const viewerSpace = await session.requestReferenceSpace('viewer');
	xrLocalSpace = await session.requestReferenceSpace('local');
	const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
	xrHitTestSource = hitTestSource;
	reticle.visible = true;
});

renderer.xr.addEventListener('sessionend', () => {
	reticle.visible = false;
	xrHitTestSource = null;
	xrLocalSpace = null;
});

// Place a cube on tap in AR
function onSelect() {
	if (!reticle.visible) return;
	const placed = cube.clone();
	placed.material = placed.material.clone();
	placed.material.color.offsetHSL(Math.random() * 0.2, 0.2, 0.1);
	placed.position.setFromMatrixPosition(reticle.matrix);
	placed.quaternion.setFromRotationMatrix(reticle.matrix);
	scene.add(placed);
}

renderer.xr.addEventListener('sessionstart', () => {
	const session = renderer.xr.getSession();
	session.addEventListener('select', onSelect);
});

// Resize handling
window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation
const clock = new THREE.Clock();
renderer.setAnimationLoop((timestamp, frame) => {
	const dt = clock.getDelta();
	cube.rotation.x += dt * 0.6;
	cube.rotation.y += dt * 0.8;

	controls.update();

	// AR hit test update
	if (frame && xrHitTestSource && xrLocalSpace) {
		const hitTestResults = frame.getHitTestResults(xrHitTestSource);
		if (hitTestResults.length > 0) {
			const refSpace = renderer.xr.getReferenceSpace() || xrLocalSpace;
			const pose = hitTestResults[0].getPose(refSpace);
			if (pose) {
				reticle.visible = true;
				reticle.matrix.fromArray(pose.transform.matrix);
				floor.visible = false; // hide floor in AR when surface found
			}
		} else {
			reticle.visible = false;
		}
	}

	renderer.render(scene, camera);
});



