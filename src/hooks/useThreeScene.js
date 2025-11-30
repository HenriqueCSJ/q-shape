import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ATOMIC_DATA } from '../constants/atomicData';

/**
 * Custom hook for managing Three.js 3D visualization scene
 *
 * Handles the complete Three.js scene lifecycle including:
 * - Scene, camera, and renderer initialization
 * - Orbital controls with auto-rotation support
 * - Atom rendering as spheres with proper materials and shadows
 * - Bond rendering as cylinders connecting metal center to coordinating atoms
 * - Atom label rendering using canvas textures and sprites
 * - Ideal geometry overlay visualization with wireframe
 * - Animation loop with proper cleanup on unmount
 * - Responsive canvas resizing
 *
 * @param {Object} params - Hook parameters
 * @param {React.RefObject} params.canvasRef - Reference to the canvas DOM element
 * @param {Array} params.atoms - Array of atom objects with {element, x, y, z} properties
 * @param {number} params.selectedMetal - Index of the selected metal center atom
 * @param {Array} params.coordAtoms - Array of coordinating atoms with {idx, atom, distance} properties
 * @param {Object} params.bestGeometry - Best matching geometry with {rotationMatrix, refCoords} properties
 * @param {boolean} params.autoRotate - Enable/disable automatic camera rotation
 * @param {boolean} params.showIdeal - Show/hide ideal geometry overlay
 * @param {boolean} params.showLabels - Show/hide atom element labels
 *
 * @returns {Object} Scene references
 * @returns {React.RefObject} sceneRef - Reference to the Three.js scene
 * @returns {React.RefObject} rendererRef - Reference to the WebGL renderer
 * @returns {React.RefObject} cameraRef - Reference to the perspective camera
 * @returns {React.RefObject} controlsRef - Reference to the orbit controls
 *
 * @example
 * const { sceneRef, rendererRef, cameraRef, controlsRef } = useThreeScene({
 *   canvasRef,
 *   atoms,
 *   selectedMetal,
 *   coordAtoms,
 *   bestGeometry,
 *   autoRotate,
 *   showIdeal,
 *   showLabels
 * });
 */
export function useThreeScene({
    canvasRef,
    atoms,
    selectedMetal,
    coordAtoms,
    bestGeometry,
    autoRotate,
    showIdeal,
    showLabels
}) {
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || atoms.length === 0 || selectedMetal == null) return;

        const canvas = canvasRef.current;
        const container = canvas.parentElement;

        if (rendererRef.current) {
            rendererRef.current.dispose();
        }

        const width = container.clientWidth || 800;
        const height = 600;

        // Initialize scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);
        sceneRef.current = scene;

        // Initialize renderer
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: "high-performance",
            alpha: false
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;

        // Initialize camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        const metal = atoms[selectedMetal];
        const center = new THREE.Vector3(metal.x, metal.y, metal.z);
        camera.position.set(center.x + 12, center.y + 8, center.z + 12);
        camera.lookAt(center);
        cameraRef.current = camera;

        // Initialize controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(center);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 5;
        controls.maxDistance = 50;
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 1.0;
        controlsRef.current = controls;

        // Handle window resizing
        const handleResize = () => {
            const newWidth = container.clientWidth || 800;
            const newHeight = 600;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight, false);
        };

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        // Add lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
        keyLight.position.set(20, 20, 15);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048;
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.camera.near = 0.5;
        keyLight.shadow.camera.far = 100;
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
        fillLight.position.set(-15, 10, -10);
        scene.add(fillLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(0, -10, -15);
        scene.add(backLight);

        // Render atoms as spheres
        const coordinatedIdx = new Set(coordAtoms.map((c) => c.idx));

        atoms.forEach((a, idx) => {
            const data = ATOMIC_DATA[a.element] || { radius: 0.6, color: 0xcccccc };
            const isMetal = idx === selectedMetal;
            const isCoord = coordinatedIdx.has(idx);

            // Only render metal center and coordinating atoms
            if (!isMetal && !isCoord) {
                return;
            }

            const geo = new THREE.SphereGeometry(data.radius * 0.3, 32, 32);
            const mat = new THREE.MeshStandardMaterial({
                color: data.color,
                metalness: isMetal ? 0.6 : 0.1,
                roughness: isMetal ? 0.4 : 0.7,
                emissive: isMetal ? new THREE.Color(data.color) : 0x000000,
                emissiveIntensity: isMetal ? 0.2 : 0,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(a.x, a.y, a.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);

            // Add atom labels if enabled
            if (showLabels && (isMetal || isCoord)) {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 256;
                canvas.height = 128;
                context.fillStyle = 'rgba(255, 255, 255, 0.9)';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.font = 'bold 48px Arial';
                context.fillStyle = isMetal ? '#dc2626' : '#1e40af';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(a.element, canvas.width / 2, canvas.height / 2);

                const texture = new THREE.CanvasTexture(canvas);
                const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.position.set(a.x, a.y + data.radius * 0.5, a.z);
                sprite.scale.set(0.8, 0.4, 1);
                scene.add(sprite);
            }
        });

        // Render bonds as cylinders
        coordAtoms.forEach((c) => {
            const p0 = center;
            const p1 = new THREE.Vector3(c.atom.x, c.atom.y, c.atom.z);
            const bondVec = p1.clone().sub(p0);
            const bondGeo = new THREE.CylinderGeometry(0.08, 0.08, bondVec.length(), 16);
            const bondMat = new THREE.MeshStandardMaterial({
                color: 0x64748b,
                metalness: 0.3,
                roughness: 0.6
            });
            const bondMesh = new THREE.Mesh(bondGeo, bondMat);
            bondMesh.position.copy(p0).add(bondVec.clone().multiplyScalar(0.5));
            bondMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bondVec.clone().normalize());
            bondMesh.castShadow = true;
            scene.add(bondMesh);
        });

        // Render ideal geometry overlay if enabled
        if (bestGeometry && bestGeometry.rotationMatrix && bestGeometry.refCoords && showIdeal) {
            const idealGroup = new THREE.Group();
            const scalingFactor = coordAtoms.length > 0
                ? coordAtoms.reduce((acc, curr) => acc + curr.distance, 0) / coordAtoms.length
                : 1;

            const inverseRotation = bestGeometry.rotationMatrix.clone().invert();

            const idealCoordsVec = bestGeometry.refCoords.map(c => new THREE.Vector3(...c));
            const rotatedIdealCoords = idealCoordsVec.map(v => v.clone().applyMatrix4(inverseRotation));

            // Render ideal vertices as spheres
            rotatedIdealCoords.forEach((rotatedVec) => {
                const pos = rotatedVec.clone().multiplyScalar(scalingFactor).add(center);
                const geo = new THREE.SphereGeometry(0.2, 24, 24);
                const mat = new THREE.MeshStandardMaterial({
                    color: 0xff00ff,
                    transparent: true,
                    opacity: 0.8,
                    metalness: 0.5,
                    roughness: 0.3,
                    emissive: 0xff00ff,
                    emissiveIntensity: 0.3
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.copy(pos);
                idealGroup.add(mesh);
            });

            // Render ideal edges as lines
            const edges = [];

            // Adaptive threshold based on coordination number
            // Lower CN needs more generous threshold
            const cnThreshold = coordAtoms.length <= 4 ? 2.5 : 2.2;

            for (let i = 0; i < idealCoordsVec.length; i++) {
                for (let j = i + 1; j < idealCoordsVec.length; j++) {
                    const dist = idealCoordsVec[i].distanceTo(idealCoordsVec[j]);
                    if (dist < cnThreshold) {
                        const p0 = rotatedIdealCoords[i].clone().multiplyScalar(scalingFactor).add(center);
                        const p1 = rotatedIdealCoords[j].clone().multiplyScalar(scalingFactor).add(center);
                        edges.push(p0, p1);
                    }
                }
            }

            if (edges.length > 0) {
                const lineGeo = new THREE.BufferGeometry().setFromPoints(edges);
                const lineMat = new THREE.LineBasicMaterial({
                    color: 0xff00ff,
                    transparent: true,
                    opacity: 0.6,
                    linewidth: 2
                });
                const lines = new THREE.LineSegments(lineGeo, lineMat);
                idealGroup.add(lines);
            }

            scene.add(idealGroup);
        }

        // Initial render
        renderer.render(scene, camera);

        // Animation loop
        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Cleanup on unmount
        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            controls.dispose();

            // CRITICAL FIX: Properly dispose all Three.js resources including textures
            scene.traverse(object => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach(material => {
                        // Dispose textures explicitly to prevent memory leaks
                        if (material.map) material.map.dispose();
                        if (material.lightMap) material.lightMap.dispose();
                        if (material.bumpMap) material.bumpMap.dispose();
                        if (material.normalMap) material.normalMap.dispose();
                        if (material.specularMap) material.specularMap.dispose();
                        if (material.envMap) material.envMap.dispose();
                        if (material.alphaMap) material.alphaMap.dispose();
                        if (material.aoMap) material.aoMap.dispose();
                        if (material.displacementMap) material.displacementMap.dispose();
                        if (material.emissiveMap) material.emissiveMap.dispose();
                        if (material.gradientMap) material.gradientMap.dispose();
                        if (material.metalnessMap) material.metalnessMap.dispose();
                        if (material.roughnessMap) material.roughnessMap.dispose();
                        material.dispose();
                    });
                }
            });
            renderer.dispose();
        };
    // Note: canvasRef is intentionally excluded from dependencies as refs are stable
    // and we only want to rebuild the scene when the actual data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atoms, selectedMetal, coordAtoms, bestGeometry, autoRotate, showIdeal, showLabels]);

    // Update auto-rotation when toggle changes
    useEffect(() => {
        if (controlsRef.current) {
            controlsRef.current.autoRotate = autoRotate;
        }
    }, [autoRotate]);

    return {
        sceneRef,
        rendererRef,
        cameraRef,
        controlsRef
    };
}
