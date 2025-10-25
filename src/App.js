import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import './App.css';

// Constants
import { ATOMIC_DATA, ALL_METALS } from './constants/atomicData';
import { REFERENCE_GEOMETRIES } from './constants/referenceGeometries';

// Services
import calculateShapeMeasure from './services/shapeAnalysis/shapeCalculator';
import { calculateAdditionalMetrics, calculateQualityMetrics } from './services/shapeAnalysis/qualityMetrics';
import { detectOptimalRadius } from './services/coordination/radiusDetector';
import { detectMetalCenter } from './services/coordination/metalDetector';
import { getCoordinatingAtoms } from './services/coordination/sphereDetector';

// Utilities
import { parseXYZ, validateXYZ } from './utils/fileParser';
import { interpretShapeMeasure } from './utils/geometry';

// --- START: REACT COMPONENT ---
export default function CoordinationGeometryAnalyzer() {
    const [atoms, setAtoms] = useState([]);
    const [selectedMetal, setSelectedMetal] = useState(null);
    const [coordRadius, setCoordRadius] = useState(3.0);
    const [autoRadius, setAutoRadius] = useState(true);
    const [coordAtoms, setCoordAtoms] = useState([]);
    const [geometryResults, setGeometryResults] = useState([]);
    const [bestGeometry, setBestGeometry] = useState(null);
    const [fileName, setFileName] = useState("");
    const [autoRotate, setAutoRotate] = useState(false);
    const [showIdeal, setShowIdeal] = useState(true);
    const [showLabels, setShowLabels] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [analysisParams, setAnalysisParams] = useState({ mode: 'default', key: 0 });
    const [progress, setProgress] = useState(null);
    const [additionalMetrics, setAdditionalMetrics] = useState(null);
    const [qualityMetrics, setQualityMetrics] = useState(null);
    const [error, setError] = useState(null);
    const [warnings, setWarnings] = useState([]);

    // New features for v1.1.0
    const [radiusInput, setRadiusInput] = useState("3.000");
    const [radiusStep, setRadiusStep] = useState(0.05);
    const [targetCNInput, setTargetCNInput] = useState("");

    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const resultsCache = useRef(new Map());

    const getCacheKey = useCallback((metalIdx, radius, atomsData, mode) => {
        if (metalIdx == null || !atomsData || atomsData.length === 0) return null;
        try {
            return `${mode}-${metalIdx}-${radius.toFixed(3)}-${atomsData.map(a => `${a.element}${a.x.toFixed(3)}${a.y.toFixed(3)}${a.z.toFixed(3)}`).join('-')}`;
        } catch (error) {
            console.error("Error generating cache key:", error);
            return null;
        }
    }, []);


    const handleFileUpload = useCallback((e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setError(null);
        setWarnings([]);
        setFileName(file.name.replace(/\.xyz$/i, ""));
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const content = String(ev.target?.result || "");
                const validation = validateXYZ(content);
                
                if (!validation.valid) {
                    throw new Error(validation.error);
                }
                
                if (validation.warnings && validation.warnings.length > 0) {
                    setWarnings(validation.warnings);
                }
                
                const parsedAtoms = parseXYZ(content);
                setAtoms(parsedAtoms);
                
                const metalIdx = detectMetalCenter(parsedAtoms);
                setSelectedMetal(metalIdx);
                
                if (metalIdx != null) {
                    const radius = detectOptimalRadius(parsedAtoms[metalIdx], parsedAtoms);
                    setCoordRadius(radius);
                    setAutoRadius(true);
                }
                
                setAnalysisParams({ mode: 'default', key: Date.now() });
                resultsCache.current.clear();
                
            } catch (err) {
                console.error("File upload error:", err);
                setError(err.message);
            }
        };
        
        reader.onerror = () => {
            const errorMsg = "Failed to read file - please check file permissions and try again";
            setError(errorMsg);
        };
        
        reader.readAsText(file);
    }, []);

    // New handlers for v1.1.0 features
    const handleRadiusInputChange = (e) => {
        const val = e.target.value;
        setRadiusInput(val);
        const parsed = parseFloat(val);
        if (Number.isFinite(parsed) && parsed > 0) {
            setCoordRadius(parsed);
            setAutoRadius(false);
        }
    };

    const handleRadiusStepChange = (e) => {
        setRadiusStep(parseFloat(e.target.value));
    };

    const handleFindRadiusForCN = () => {
        const cn = parseInt(targetCNInput, 10);
        if (!Number.isFinite(cn) || cn < 2 || cn > 24) {
            setWarnings(prev => [...prev, "Please enter a valid Coordination Number (2-24)"]);
            return;
        }

        if (selectedMetal == null || !atoms.length) {
            setWarnings(prev => [...prev, "Please load a file and select a metal center first"]);
            return;
        }

        try {
            const metal = atoms[selectedMetal];
            const center = new THREE.Vector3(metal.x, metal.y, metal.z);

            const allNeighbors = atoms
                .map((atom, idx) => {
                    if (idx === selectedMetal) return null;
                    const pos = new THREE.Vector3(atom.x, atom.y, atom.z);
                    const distance = pos.distanceTo(center);
                    if (!isFinite(distance)) return null;
                    return { atom, idx, distance, vec: pos.sub(center) };
                })
                .filter((x) => x && x.distance > 0.1)
                .sort((a, b) => a.distance - b.distance);

            if (allNeighbors.length < cn) {
                setWarnings(prev => [...prev, `Not enough neighbors for CN=${cn}. Found only ${allNeighbors.length}.`]);
                return;
            }

            const lastIncluded = allNeighbors[cn - 1];
            let optimalRadius;
            let gapInfo = "";

            if (allNeighbors.length > cn) {
                const firstExcluded = allNeighbors[cn];
                optimalRadius = (lastIncluded.distance + firstExcluded.distance) / 2.0;
                const gap = firstExcluded.distance - lastIncluded.distance;
                gapInfo = ` (Gap to next atom: ${gap.toFixed(3)} Å)`;
            } else {
                optimalRadius = lastIncluded.distance + 0.4;
                gapInfo = " (Last available atom)";
            }

            setCoordRadius(optimalRadius);
            setAutoRadius(false);
            setWarnings(prev => [...prev, `✅ Set radius to ${optimalRadius.toFixed(3)} Å for CN=${cn}${gapInfo}`]);

        } catch (error) {
            console.error("Error in handleFindRadiusForCN:", error);
            setWarnings(prev => [...prev, `Error finding radius: ${error.message}`]);
        }
    };

    useEffect(() => {
        if (selectedMetal != null && atoms.length > 0 && autoRadius) {
            try {
                const radius = detectOptimalRadius(atoms[selectedMetal], atoms);
                setCoordRadius(radius);
            } catch (error) {
                console.error("Error auto-detecting radius:", error);
                setWarnings(prev => [...prev, "Failed to auto-detect radius, using manual value"]);
            }
        }
    }, [selectedMetal, autoRadius, atoms]);

    // Sync radiusInput string with coordRadius number (v1.1.0)
    useEffect(() => {
        if (isFinite(coordRadius)) {
            setRadiusInput(coordRadius.toFixed(3));
        }
    }, [coordRadius]);

    useEffect(() => {
        if (selectedMetal == null || atoms.length === 0) return;
        
        const cacheKey = getCacheKey(selectedMetal, coordRadius, atoms, analysisParams.mode);
        
        if (cacheKey && resultsCache.current.has(cacheKey)) {
            const cached = resultsCache.current.get(cacheKey);
            setGeometryResults(cached.results);
            setBestGeometry(cached.best);
            setAdditionalMetrics(cached.metrics);
            setQualityMetrics(cached.quality);
            setCoordAtoms(cached.coordAtoms); // RESTORE coordAtoms from cache
            return;
        }
        
        setIsLoading(true);
        setProgress(null);
        setError(null);

        const timer = setTimeout(() => {
            try {
                const selected = getCoordinatingAtoms(atoms, selectedMetal, coordRadius);
                setCoordAtoms(selected);

                const metrics = calculateAdditionalMetrics(selected);
                setAdditionalMetrics(metrics);

                const cn = selected.length;
                const geometries = REFERENCE_GEOMETRIES[cn];
                
                if (!geometries) {
                    setGeometryResults([]);
                    setBestGeometry(null);
                    setQualityMetrics(null);
                    setIsLoading(false);
                    if (cn > 0) {
                        setWarnings(prev => [...prev, `No reference geometries available for coordination number ${cn}`]);
                    }
                    return;
                }

                const actualCoords = selected.map((c) => [c.vec.x, c.vec.y, c.vec.z]);
                const results = [];
                
                const geometryNames = Object.keys(geometries);
                
                const processGeometry = (index) => {
                    if (index >= geometryNames.length) {
                        results.sort((a, b) => a.shapeMeasure - b.shapeMeasure);
                        const finiteResults = results.filter(r => isFinite(r.shapeMeasure));
                        
                        if(finiteResults.length > 0) {
                            setGeometryResults(finiteResults);
                            const best = finiteResults[0];
                            setBestGeometry(best);
                            
                            const quality = calculateQualityMetrics(selected, best, best.shapeMeasure);
                            setQualityMetrics(quality);
                            
                            if (cacheKey) {
                                resultsCache.current.set(cacheKey, {
                                    results: finiteResults,
                                    best,
                                    metrics,
                                    quality,
                                    coordAtoms: selected // CACHE coordAtoms
                                });
                            }
                        } else {
                            setGeometryResults([]);
                            setBestGeometry(null);
                            setQualityMetrics(null);
                            setError("Analysis completed but no valid geometries found");
                        }
                        setIsLoading(false);
                        setProgress(null);
                        return;
                    }
                    
                    const name = geometryNames[index];
                    const refCoords = geometries[name];
                    
                    setProgress({ 
                        geometry: name, 
                        current: index + 1, 
                        total: geometryNames.length,
                        stage: 'Initializing'
                    });
                    
                    setTimeout(() => {
                        try {
                            const { measure, alignedCoords, rotationMatrix } = calculateShapeMeasure(
                                actualCoords, 
                                refCoords, 
                                analysisParams.mode,
                                (progressInfo) => {
                                    setProgress({
                                        geometry: name,
                                        current: index + 1,
                                        total: geometryNames.length,
                                        ...progressInfo
                                    });
                                }
                            );
                            
                            results.push({ 
                                name, 
                                shapeMeasure: measure, 
                                refCoords, 
                                alignedCoords,
                                rotationMatrix
                            });
                            
                            processGeometry(index + 1);
                        } catch(error) {
                            console.error(`Error processing geometry ${name}:`, error);
                            setWarnings(prev => [...prev, `Failed to analyze ${name}: ${error.message}`]);
                            processGeometry(index + 1);
                        }
                    }, 10);
                };
                
                processGeometry(0);

            } catch (error) {
                console.error("Failed to perform geometry analysis:", error);
                setError(`Analysis failed: ${error.message}`);
                setGeometryResults([]);
                setBestGeometry(null);
                setQualityMetrics(null);
                setIsLoading(false);
                setProgress(null);
            }
        }, 20);

        return () => clearTimeout(timer);

    }, [selectedMetal, atoms, coordRadius, analysisParams, getCacheKey]);

    // FIX 3: Add coordRadius to dependencies to ensure re-render when slider changes
    useEffect(() => {
        if (!canvasRef.current || atoms.length === 0 || selectedMetal == null) return;

        const canvas = canvasRef.current;
        const container = canvas.parentElement;

        if (rendererRef.current) {
            rendererRef.current.dispose();
        }

        const width = container.clientWidth || 800;
        const height = 600;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);
        sceneRef.current = scene;

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

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        const metal = atoms[selectedMetal];
        const center = new THREE.Vector3(metal.x, metal.y, metal.z);
        camera.position.set(center.x + 12, center.y + 8, center.z + 12);
        camera.lookAt(center);
        cameraRef.current = camera;
        
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

        const handleResize = () => {
            const newWidth = container.clientWidth || 800;
            const newHeight = 600;
            camera.aspect = newWidth / newHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(newWidth, newHeight, false);
        };
        
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

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

        const coordinatedIdx = new Set(coordAtoms.map((c) => c.idx));
        
        atoms.forEach((a, idx) => {
            const data = ATOMIC_DATA[a.element] || { radius: 0.6, color: 0xcccccc };
            const isMetal = idx === selectedMetal;
            const isCoord = coordinatedIdx.has(idx);
            
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
        
        if (bestGeometry && bestGeometry.rotationMatrix && bestGeometry.refCoords && showIdeal) {
            const idealGroup = new THREE.Group();
            const scalingFactor = coordAtoms.length > 0 
                ? coordAtoms.reduce((acc, curr) => acc + curr.distance, 0) / coordAtoms.length 
                : 1;

            const inverseRotation = bestGeometry.rotationMatrix.clone().invert();

            const idealCoordsVec = bestGeometry.refCoords.map(c => new THREE.Vector3(...c));
            const rotatedIdealCoords = idealCoordsVec.map(v => v.clone().applyMatrix4(inverseRotation));
            
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

            const edges = [];
            
            // FIX 1: Adaptive threshold based on coordination number
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

        renderer.render(scene, camera);

        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
            controls.dispose();
            scene.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
                    else object.material.dispose();
                }
            });
            renderer.dispose();
        };
    }, [atoms, selectedMetal, coordAtoms, bestGeometry, autoRotate, showIdeal, showLabels, coordRadius]); // Added coordRadius here

    useEffect(() => {
        if (controlsRef.current) {
            controlsRef.current.autoRotate = autoRotate;
        }
    }, [autoRotate]);


    // FIX 2: Ensure report uses current state values and clear dependency issues
    const generateReport = useCallback(() => {
        if (!atoms.length || selectedMetal == null || !bestGeometry) return;
        
        try {
            // Capture current state values at the time of report generation
            const currentCoordAtoms = coordAtoms;
            const currentCoordRadius = coordRadius;
            const currentBestGeometry = bestGeometry;
            const currentGeometryResults = geometryResults;
            const currentAdditionalMetrics = additionalMetrics;
            const currentQualityMetrics = qualityMetrics;
            const currentWarnings = warnings;
            const currentFileName = fileName;
            const currentAnalysisMode = analysisParams.mode;
            
            const canvas = canvasRef.current;
            const oldWidth = canvas.width;
            const oldHeight = canvas.height;
            
            rendererRef.current.setSize(1920, 1440, false);
            cameraRef.current.aspect = 1920 / 1440;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            const imgData = canvas.toDataURL('image/png');
            
            rendererRef.current.setSize(oldWidth, oldHeight, false);
            cameraRef.current.aspect = oldWidth / oldHeight;
            cameraRef.current.updateProjectionMatrix();

            const metal = atoms[selectedMetal];
            const date = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' });
            const {name, shapeMeasure} = currentBestGeometry;
            const interpretation = interpretShapeMeasure(shapeMeasure);
            
            const totalAvailableGeometries = Object.values(REFERENCE_GEOMETRIES).reduce((sum, geoms) => sum + Object.keys(geoms).length, 0);
            const cnGeometries = currentCoordAtoms.length > 0 ? Object.keys(REFERENCE_GEOMETRIES[currentCoordAtoms.length] || {}).length : 0;

                        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Q-Shape Report: ${currentFileName}</title>
<style>
@media print {
  body { margin: 0; padding: 20px; background: white !important; }
  .no-print { display: none; }
  @page { size: A4; margin: 15mm; }
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  color: #1e293b;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  min-height: 100vh;
}

header {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  border-bottom: 3px solid #4f46e5;
  margin-bottom: 2rem;
}

h1 {
  margin: 0;
  color: #312e81;
  font-size: 2.25rem;
  font-weight: 800;
  letter-spacing: -0.025em;
}

header p {
  margin: 0.75rem 0 0;
  color: #475569;
  font-size: 1rem;
}

header p:first-of-type {
  margin-top: 1rem;
}

header p strong {
  color: #1e293b;
}

h2 {
  color: #312e81;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 2.5rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
}

h3 {
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
}

.info-box {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 2px solid #93c5fd;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.info-box h3 {
  margin-top: 0;
  color: #1e40af;
}

.info-box p {
  margin: 0.5rem 0;
  color: #475569;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.summary-item {
  padding: 1rem;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 8px;
  border-left: 3px solid #4f46e5;
}

.summary-item strong {
  display: block;
  color: #64748b;
  font-size: 0.85em;
  margin-bottom: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-item span {
  font-size: 1.25em;
  font-weight: 700;
  color: #1e293b;
}

.quality-score {
  font-size: 2.5rem;
  font-weight: 800;
  text-align: center;
  padding: 2rem;
  border-radius: 12px;
  margin: 1.5rem 0;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}

.metric-box {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #4f46e5;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  transition: all 0.2s;
}

.metric-box:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.metric-label {
  font-size: 0.85em;
  color: #64748b;
  margin-bottom: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 1.5em;
  font-weight: 700;
  color: #312e81;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

th, td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

th {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  font-weight: 700;
  font-size: 0.9em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

tbody tr {
  transition: background 0.2s;
}

tbody tr:hover {
  background: #f8fafc;
}

tbody tr:nth-child(even) {
  background: #fafbfc;
}

tbody tr:nth-child(even):hover {
  background: #f1f5f9;
}

.best-result {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%) !important;
  font-weight: 700;
  border-left: 4px solid #10b981;
}

.best-result:hover {
  background: linear-gradient(135deg, #bbf7d0 0%, #86efac 100%) !important;
}

img {
  max-width: 100%;
  height: auto;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  margin: 1rem 0;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  display: block;
}

.warning-box {
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 2px solid #f59e0b;
  border-radius: 12px;
  padding: 1.5rem;
  margin: 1.5rem 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.warning-box h3 {
  margin-top: 0;
  color: #92400e;
}

.warning-box ul {
  margin: 0.5rem 0 0;
  padding-left: 1.5rem;
  color: #78350f;
}

.download-btn {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  margin: 1rem 0;
  display: inline-block;
  box-shadow: 0 4px 6px rgba(79, 70, 229, 0.4);
  transition: all 0.2s;
}

.download-btn:hover {
  background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 8px rgba(79, 70, 229, 0.5);
}

footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #e2e8f0;
  text-align: center;
  color: #64748b;
  font-size: 0.9em;
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

footer p {
  margin: 0.5rem 0;
}

footer strong {
  color: #1e293b;
}

.university-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.university-section img {
  width: 60px;
  height: 60px;
  border: none;
  box-shadow: none;
  margin: 0;
}

.university-info {
  text-align: left;
}

.university-info p {
  margin: 0.25rem 0;
}

@media print {
  .quality-score,
  .metric-box {
    break-inside: avoid;
  }

  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
}
</style>
</head>
<body>
<div class="no-print" style="text-align: center; margin-bottom: 2rem;">
  <button class="download-btn" onclick="window.print()">📄 Download as PDF</button>
</div>

<header>
  <h1>🔬 Q-Shape (Quantitative Shape Analyzer)</h1>
  <p><strong>Coordination Geometry Analysis Report</strong></p>
  <p><strong>File:</strong> ${currentFileName}.xyz</p>
  <p><strong>Generated on:</strong> ${date}</p>
  <p><strong>Analysis Mode:</strong> ${currentAnalysisMode === 'intensive' ? 'Intensive (High Precision) with Kabsch Alignment' : 'Standard with Improved Kabsch Alignment'}</p>
  <p style="font-style: italic; margin-top: 1rem; font-size: 0.9rem;">Cite this: Junior, H. C. S. Q-Shape (Quantitative Shape Analyzer). 2025.</p>
</header>

<main>
  <div class="info-box">
    <h3>📐 SHAPE 2.1 Complete Coverage</h3>
    <p>This analysis uses the <strong>complete SHAPE 2.1 reference geometry library</strong> with ${totalAvailableGeometries} geometries across all coordination numbers (CN=2-12).</p>
    <p>For CN=${currentCoordAtoms.length}, ${cnGeometries} reference geometries were analyzed.</p>
  </div>

  <h2>📊 Analysis Summary</h2>
  <div class="summary-grid">
    <div class="summary-item">
      <strong>Metal Center</strong>
      <span>${metal.element} (#${selectedMetal+1})</span>
    </div>
    <div class="summary-item">
      <strong>Coordination Number</strong>
      <span>${currentCoordAtoms.length}</span>
    </div>
    <div class="summary-item">
      <strong>Coordination Radius</strong>
      <span>${currentCoordRadius.toFixed(3)} Å</span>
    </div>
    <div class="summary-item">
      <strong>Best Match Geometry</strong>
      <span style="color:${interpretation.color};">${name}</span>
    </div>
    <div class="summary-item">
      <strong>CShM Value</strong>
      <span style="color:${interpretation.color};">${shapeMeasure.toFixed(4)}</span>
    </div>
    <div class="summary-item">
      <strong>Interpretation</strong>
      <span style="color:${interpretation.color};">${interpretation.text}</span>
    </div>
  </div>

  ${currentQualityMetrics ? `
  <h2>🎯 Quality Metrics</h2>
  <div class="quality-score" style="background: linear-gradient(135deg, ${currentQualityMetrics.overallQualityScore > 80 ? '#d1fae5' : currentQualityMetrics.overallQualityScore > 60 ? '#fef3c7' : '#fee2e2'}, transparent); color: ${currentQualityMetrics.overallQualityScore > 80 ? '#059669' : currentQualityMetrics.overallQualityScore > 60 ? '#d97706' : '#dc2626'};">
    Overall Quality Score: ${currentQualityMetrics.overallQualityScore.toFixed(1)}/100
  </div>
  <div class="metrics-grid">
    <div class="metric-box">
      <div class="metric-label">Angular Distortion Index</div>
      <div class="metric-value">${currentQualityMetrics.angularDistortionIndex.toFixed(3)}°</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Lower is better (ideal = 0)</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Bond Length Uniformity</div>
      <div class="metric-value">${currentQualityMetrics.bondLengthUniformityIndex.toFixed(1)}%</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Higher is better (ideal = 100)</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Shape Deviation Parameter</div>
      <div class="metric-value">${currentQualityMetrics.shapeDeviationParameter.toFixed(4)}</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Normalized distortion measure</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">RMSD</div>
      <div class="metric-value">${currentQualityMetrics.rmsd.toFixed(4)} Å</div>
      <div style="font-size: 0.8em; color: #64748b; margin-top: 0.5rem;">Root mean square deviation</div>
    </div>
  </div>
  ` : ''}

  ${currentAdditionalMetrics ? `
  <h2>📈 Bond Statistics</h2>
  <div class="metrics-grid">
    <div class="metric-box">
      <div class="metric-label">Mean Bond Length</div>
      <div class="metric-value">${currentAdditionalMetrics.meanBondLength.toFixed(4)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Std Dev Bond Length</div>
      <div class="metric-value">${currentAdditionalMetrics.stdDevBondLength.toFixed(4)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Bond Length Range</div>
      <div class="metric-value">${currentAdditionalMetrics.minBondLength.toFixed(3)} - ${currentAdditionalMetrics.maxBondLength.toFixed(3)} Å</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Mean L-M-L Angle</div>
      <div class="metric-value">${currentAdditionalMetrics.angleStats.mean.toFixed(2)}° ± ${currentAdditionalMetrics.angleStats.stdDev.toFixed(2)}°</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Angle Range</div>
      <div class="metric-value">${currentAdditionalMetrics.angleStats.min.toFixed(1)}° - ${currentAdditionalMetrics.angleStats.max.toFixed(1)}°</div>
    </div>
    <div class="metric-box">
      <div class="metric-label">Number of L-M-L Angles</div>
      <div class="metric-value">${currentAdditionalMetrics.angleStats.count}</div>
    </div>
  </div>
  ` : ''}

  <h2>🎨 3D Visualization Snapshot</h2>
  <img src="${imgData}" alt="3D rendering of the coordination complex">

  <h2>📋 Geometry Analysis Results</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Geometry</th>
        <th>CShM</th>
        <th>Interpretation</th>
        <th>Confidence</th>
      </tr>
    </thead>
    <tbody>
      ${currentGeometryResults.map((r, i) => `
      <tr class="${i === 0 ? 'best-result' : ''}">
        <td>${i + 1}</td>
        <td><strong>${r.name}</strong></td>
        <td style="font-family: monospace; font-weight: 600;">${r.shapeMeasure.toFixed(4)}</td>
        <td style="color: ${interpretShapeMeasure(r.shapeMeasure).color}; font-weight: 600;">${interpretShapeMeasure(r.shapeMeasure).text}</td>
        <td style="font-weight: 600;">${interpretShapeMeasure(r.shapeMeasure).confidence}%</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>🔗 Coordinating Atoms</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Element</th>
        <th>Distance (Å)</th>
        <th>Coordinates (x, y, z)</th>
      </tr>
    </thead>
    <tbody>
      ${currentCoordAtoms.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${c.atom.element}</strong></td>
        <td style="font-family: monospace;">${c.distance.toFixed(4)}</td>
        <td style="font-family: monospace; font-size: 0.9em;">${c.atom.x.toFixed(4)}, ${c.atom.y.toFixed(4)}, ${c.atom.z.toFixed(4)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  ${currentWarnings.length > 0 ? `
  <div class="warning-box">
    <h3>⚠️ Warnings</h3>
    <ul>
      ${currentWarnings.map(w => `<li>${w}</li>`).join('')}
    </ul>
  </div>
  ` : ''}
</main>

<footer>
  <p>Report generated by <strong>Q-Shape (Quantitative Shape Analyzer)</strong></p>
  <p style="margin-top: 1rem;">Complete SHAPE 2.1 coverage with ${totalAvailableGeometries} reference geometries • Improved Kabsch alignment with Jacobi SVD • Optimized Hungarian algorithm</p>
  <p style="margin-top: 1rem; font-size: 0.85em;">For citation: Llunell, M.; Casanova, D.; Cirera, J.; Alemany, P.; Alvarez, S. SHAPE, version 2.1; Universitat de Barcelona: Barcelona, Spain, 2013.</p>

  <div class="university-section">
    <img src="https://raw.githubusercontent.com/HenriqueCSJ/NomenclaturaQuimica/refs/heads/main/UFRRJ.png" alt="UFRRJ Logo">
    <div class="university-info">
      <p style="font-weight: bold; color: #1e293b;">Universidade Federal Rural do Rio de Janeiro (UFRRJ)</p>
      <p>Departamento de Química Fundamental</p>
      <p>Prof. Dr. Henrique C. S. Junior</p>
    </div>
  </div>
</footer>
</body>
</html>`;;
            
            const reportWindow = window.open("", "_blank");
            if (reportWindow) {
                reportWindow.document.write(html);
                reportWindow.document.close();
            } else {
                setError("Popup blocked. Please allow popups for this site to view the report.");
            }
        } catch (err) {
            console.error("Report generation failed:", err);
            setError(`Report generation failed: ${err.message}`);
        }
    }, [atoms, selectedMetal, bestGeometry, fileName, analysisParams, coordRadius, coordAtoms, geometryResults, additionalMetrics, qualityMetrics, warnings]);

//     const totalGeometries = useMemo(() => {
//         return Object.values(REFERENCE_GEOMETRIES).reduce((sum, geoms) => sum + Object.keys(geoms).length, 0);
//     }, []);

    return (
    <div className="app-container">
      <div className="app-content">
      <header className="app-header">
        <h1>
            🔬 Q-Shape (Quantitative Shape Analyzer)
        </h1>
        <p>
            <strong>Complete SHAPE 2.1 Coverage</strong>
        </p>
        <p style={{fontStyle: 'italic'}}>
            Cite this: Junior, H. C. S. Q-Shape (Quantitative Shape Analyzer). 2025.
        </p>
      </header>
      
      {error && (
        <div className="alert alert-error">
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="alert alert-warning">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <strong>⚠️ Warnings:</strong>
            <button
              onClick={() => setWarnings([])}
              style={{
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
          <ul>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      
      <div className="card">
        <label className="control-label">
          📁 Load Molecular Structure (.xyz)
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="file" 
            accept=".xyz" 
            onChange={handleFileUpload} 
            className="file-upload-input" 
          />
        </div>
      </div>

      {atoms.length > 0 && (
      <>
        <div className="controls-section">
          <div className="card">
            <label className="control-label">
              🎯 Metal Center
            </label>
            <select 
              value={selectedMetal ?? ''} 
              onChange={(e) => setSelectedMetal(Number(e.target.value))} 
              className="select-input"
            >
              <option value="">Select central atom</option>
              {atoms.map((a, i) => ( 
                <option key={i} value={i}> 
                  #{i + 1}: {a.element}{ALL_METALS.has(a.element) ? ' ⭐' : ''} 
                </option> 
              ))}
            </select>
          </div>
          
          <div className="card">
            <div className="slider-header">
              <label className="control-label">
                📏 Coordination Radius: {coordRadius.toFixed(2)} Å
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoRadius}
                  onChange={(e) => setAutoRadius(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Auto
              </label>
            </div>

            {/* Precise Radius Control - v1.1.0 */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={radiusInput}
                  onChange={handleRadiusInputChange}
                  disabled={autoRadius}
                  placeholder="3.000"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace'
                  }}
                />
                <select
                  value={radiusStep}
                  onChange={handleRadiusStepChange}
                  disabled={autoRadius}
                  className="select-input"
                  style={{ width: 'auto', padding: '0.5rem' }}
                >
                  <option value={0.50}>±0.50 Å</option>
                  <option value={0.10}>±0.10 Å</option>
                  <option value={0.05}>±0.05 Å</option>
                  <option value={0.01}>±0.01 Å</option>
                </select>
                <button
                  onClick={() => {
                    const newVal = coordRadius + radiusStep;
                    setCoordRadius(newVal);
                    setAutoRadius(false);
                  }}
                  disabled={autoRadius}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: autoRadius ? '#e2e8f0' : '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: autoRadius ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  +
                </button>
                <button
                  onClick={() => {
                    const newVal = Math.max(1.5, coordRadius - radiusStep);
                    setCoordRadius(newVal);
                    setAutoRadius(false);
                  }}
                  disabled={autoRadius}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: autoRadius ? '#e2e8f0' : '#4f46e5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: autoRadius ? 'not-allowed' : 'pointer',
                    fontWeight: 600
                  }}
                >
                  −
                </button>
              </div>
            </div>

            <input
              type="range"
              min="1.5"
              max="6.0"
              step="0.05"
              value={coordRadius}
              onChange={(e) => {
                setCoordRadius(parseFloat(e.target.value));
                setAutoRadius(false);
              }}
              style={{
                width: '100%',
                accentColor: '#4f46e5'
              }}
            />
          </div>

          {/* Find Radius by CN - v1.1.0 */}
          <div className="card">
            <label className="control-label">
              🎯 Find Radius by Coordination Number
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <input
                type="text"
                value={targetCNInput}
                onChange={(e) => setTargetCNInput(e.target.value)}
                placeholder="Target CN (2-24)"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.95rem'
                }}
              />
              <button
                onClick={handleFindRadiusForCN}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                Find Radius
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>
              Automatically finds optimal radius for target CN using gap detection
            </div>
          </div>
        </div>

        {selectedMetal != null && (
        <div style={{ 
          padding: '1.5rem', 
          background: '#fff', 
          border: '2px solid #e2e8f0', 
          borderRadius: '12px', 
          marginBottom: '2rem', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)' 
        }}>
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem',
              marginBottom: '1.5rem'
            }}>
                <div>
                    <h3 style={{ 
                        margin: '0 0 1rem', 
                        color: '#1e293b',
                        fontSize: '1.25rem',
                        fontWeight: 700
                    }}>
                        📊 Coordination Summary
                    </h3>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'auto 1fr', 
                        gap: '0.5rem 1rem',
                        fontSize: '0.95rem',
                        color: '#475569'
                    }}>
                        <strong>Metal:</strong> 
                        <span>{atoms[selectedMetal].element}</span>
                        
                        <strong>CN:</strong> 
                        <span>{coordAtoms.length}</span>
                        
                        <strong>Ligands:</strong> 
                        <span>{coordAtoms.map(c=>c.atom.element).join(', ') || 'None'}</span>
                    </div>
                    
                    {additionalMetrics && (
                        <div style={{ 
                            marginTop: '1rem',
                            padding: '1rem',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            fontSize: '0.9rem'
                        }}>
                            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>📏 Bond Statistics</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div><strong>Mean:</strong> {additionalMetrics.meanBondLength.toFixed(3)} Å</div>
                                <div><strong>Std Dev:</strong> {additionalMetrics.stdDevBondLength.toFixed(3)} Å</div>
                                <div><strong>Min:</strong> {additionalMetrics.minBondLength.toFixed(3)} Å</div>
                                <div><strong>Max:</strong> {additionalMetrics.maxBondLength.toFixed(3)} Å</div>
                            </div>
                        </div>
                    )}
                </div>
                
                {qualityMetrics && (
                    <div style={{ 
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        borderRadius: '12px',
                        border: '2px solid #86efac'
                    }}>
                        <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#15803d', fontSize: '1.1rem' }}>
                            🎯 Quality Score
                        </div>
                        <div style={{ 
                            fontSize: '2.5rem', 
                            fontWeight: 800, 
                            color: qualityMetrics.overallQualityScore > 80 ? '#059669' : qualityMetrics.overallQualityScore > 60 ? '#d97706' : '#dc2626',
                            textAlign: 'center',
                            margin: '0.5rem 0'
                        }}>
                            {qualityMetrics.overallQualityScore.toFixed(1)}
                        </div>
                        <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.9rem' }}>
                            out of 100
                        </div>
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#475569' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <div><strong>RMSD:</strong> {qualityMetrics.rmsd.toFixed(4)}</div>
                                <div><strong>Ang. Dist:</strong> {qualityMetrics.angularDistortionIndex.toFixed(2)}°</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
                          
            <div style={{ 
              display: 'flex', 
              gap: '0.75rem',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
                <button 
                    onClick={() => setAnalysisParams({ mode: 'intensive', key: Date.now() })} 
                    disabled={isLoading} 
                    style={{ 
                        padding: '1rem 2rem', 
                        background: isLoading ? '#d1d5db' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '10px', 
                        fontWeight: 700, 
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        boxShadow: isLoading ? 'none' : '0 4px 6px rgba(22, 163, 74, 0.4)',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    {isLoading && analysisParams.mode === 'intensive' ? '⚡ Running...' : '⚡ Intensive Analysis'}
                </button>
                
                <button 
                    onClick={generateReport} 
                    disabled={!bestGeometry || isLoading} 
                    style={{ 
                        padding: '1rem 2rem', 
                        background: bestGeometry && !isLoading 
                            ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)' 
                            : '#cbd5e1', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '10px', 
                        fontWeight: 700, 
                        cursor: bestGeometry && !isLoading ? 'pointer' : 'not-allowed',
                        boxShadow: bestGeometry && !isLoading ? '0 4px 6px rgba(79, 70, 229, 0.4)' : 'none',
                        transition: 'all 0.2s',
                        fontSize: '1rem',
                        minWidth: '200px'
                    }}
                    onMouseOver={(e) => bestGeometry && !isLoading && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                > 
                    📄 Generate Report 
                </button>
            </div>
            
            {progress && (
                <div style={{ 
                    marginTop: '1.5rem', 
                    padding: '1rem', 
                    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', 
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1'
                }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '0.75rem',
                        alignItems: 'center'
                    }}>
                        <span style={{ 
                            fontWeight: 700, 
                            color: '#1e293b',
                            fontSize: '0.95rem'
                        }}>
                            Analyzing: {progress.geometry} ({progress.current}/{progress.total})
                        </span>
                        <span style={{ 
                            fontWeight: 700, 
                            color: analysisParams.mode === 'intensive' ? '#16a34a' : '#4f46e5',
                            fontSize: '1.1rem'
                        }}>
                            {progress.percentage}%
                        </span>
                    </div>
                    <div style={{ 
                        width: '100%', 
                        height: '12px', 
                        background: '#e2e8f0', 
                        borderRadius: '6px', 
                        overflow: 'hidden',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ 
                            width: `${progress.percentage}%`, 
                            height: '100%', 
                            background: analysisParams.mode === 'intensive' 
                                ? 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)' 
                                : 'linear-gradient(90deg, #4f46e5 0%, #6366f1 100%)', 
                            transition: 'width 0.3s ease',
                            borderRadius: '6px'
                        }} />
                    </div>
                    <div style={{ 
                        marginTop: '0.75rem', 
                        color: '#64748b',
                        fontSize: '0.85rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span><strong>Stage:</strong> {progress.stage}</span>
                        {progress.extra && <span style={{ fontStyle: 'italic' }}>{progress.extra}</span>}
                    </div>
                </div>
            )}
        </div>
        )}

        <div className="main-layout">
          <div className="visualization-card">
           <div className="visualization-header">
              <h3 className="card-title">
                  🎨 3D Visualization
              </h3>
              <div className="visualization-controls">
                  <label style={{ 
                      fontSize: '0.85rem', 
                      color: '#475569', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 500
                  }}>
                      <input 
                          type="checkbox" 
                          checked={showIdeal} 
                          onChange={(e) => setShowIdeal(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                      /> 
                      Show Ideal
                  </label>
                  <label style={{ 
                      fontSize: '0.85rem', 
                      color: '#475569', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 500
                  }}>
                      <input 
                          type="checkbox" 
                          checked={showLabels} 
                          onChange={(e) => setShowLabels(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                      /> 
                      Labels
                  </label>
                  <label style={{ 
                      fontSize: '0.85rem', 
                      color: '#475569', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: 500
                  }}>
                      <input 
                          type="checkbox" 
                          checked={autoRotate} 
                          onChange={(e) => setAutoRotate(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                      /> 
                      Rotate
                  </label>
              </div>
           </div>
           <div className="canvas-container">
             <canvas 
               ref={canvasRef} 
               style={{ 
                 width: '100%', 
                 height: '100%', 
                 display: 'block',
                 borderRadius: '8px'
               }} 
             />
           </div>
           <p style={{ 
             marginTop: '1rem', 
             color: '#64748b', 
             fontSize: '0.85rem',
             textAlign: 'center',
             fontStyle: 'italic'
           }}>
             💡 Mouse: rotate • Scroll: zoom • Right-click: pan
           </p>
          </div>
          
          <div>
            <h3 style={{ 
                margin: '0 0 1rem 0', 
                color: '#1e293b',
                fontSize: '1.25rem',
                fontWeight: 700
            }}>
                📈 Geometry Analysis Results
            </h3>
            {isLoading ? (
                <div style={{ 
                    padding: '3rem 2rem', 
                    textAlign: 'center', 
                    color: '#475569', 
                    background: '#fff', 
                    border: '2px solid #e2e8f0', 
                    borderRadius: '12px', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ 
                        fontSize: '3rem', 
                        marginBottom: '1rem',
                        animation: 'pulse 2s infinite'
                    }}>
                        🔬
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                        Running {analysisParams.mode === 'intensive' ? 'Intensive' : 'Standard'} Analysis
                    </div>
                    {progress && (
                        <div style={{ 
                            marginTop: '1rem', 
                            fontSize: '0.9rem',
                            color: '#64748b'
                        }}>
                            <div style={{ fontWeight: 600 }}>{progress.geometry}</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                {progress.stage} • {progress.percentage}%
                            </div>
                        </div>
                    )}
                </div>
            ) : geometryResults.length > 0 ? (
                <div className="results-container">
                    {geometryResults.slice(0, 15).map((r, i) => {
                        const inter = interpretShapeMeasure(r.shapeMeasure);
                        return (
                        <div 
                            key={i} 
                            style={{ 
                                padding: '1rem', 
                                background: i === 0 
                                    ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' 
                                    : i % 2 === 0 ? '#f9fafb' : '#fff', 
                                borderBottom: i < 14 ? '1px solid #e2e8f0' : 'none', 
                                borderLeft: i === 0 ? '4px solid #10b981' : '4px solid transparent',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = i === 0 ? 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)' : '#f1f5f9'}
                            onMouseOut={(e) => e.currentTarget.style.background = i === 0 ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : i % 2 === 0 ? '#f9fafb' : '#fff'}
                        >
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginBottom: '0.5rem' 
                            }}>
                                <strong style={{ 
                                    fontSize: '0.95rem', 
                                    color: i === 0 ? '#15803d' : '#1e293b',
                                    flex: 1
                                }}>
                                    {i + 1}. {r.name}
                                </strong>
                                <div style={{ 
                                    fontSize: '1.1rem', 
                                    fontWeight: 800, 
                                    color: inter.color,
                                    fontFamily: 'monospace'
                                }}>
                                    {r.shapeMeasure.toFixed(4)}
                                </div>
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '0.8rem'
                            }}>
                                <span style={{ color: '#64748b' }}>
                                    <strong style={{ color: inter.color }}>{inter.text}</strong>
                                </span>
                                <span style={{ 
                                    color: inter.confidence > 80 ? '#059669' : inter.confidence > 50 ? '#f59e0b' : '#dc2626',
                                    fontWeight: 600
                                }}>
                                    {inter.confidence}%
                                </span>
                            </div>
                        </div>
                        );
                    })}
                    {geometryResults.length > 15 && (
                        <div style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center', 
                            background: '#f8fafc',
                            color: '#64748b',
                            fontSize: '0.85rem',
                            fontStyle: 'italic'
                        }}>
                            + {geometryResults.length - 15} more (see report)
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ 
                    padding: '3rem 2rem', 
                    textAlign: 'center', 
                    color: '#64748b', 
                    background: '#fff', 
                    border: '2px solid #e2e8f0', 
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    {selectedMetal == null 
                        ? 'Select a metal center to begin analysis' 
                        : 'No reference geometries for this coordination number'}
                </div>
            )}
          </div>
        </div>

        <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
            <h3 style={{
                margin: '0 0 1rem 0',
                color: '#1e293b',
                fontSize: '1.25rem',
                fontWeight: 700
            }}>
                📚 References
            </h3>
            <ul style={{ listStyle: 'decimal inside', paddingLeft: '0', color: '#475569', fontSize: '0.9rem' }}>
                <li style={{ marginBottom: '0.5rem' }}>
                    Pinsky, M.; Avnir, D. <em>Inorg. Chem.</em> <strong>1998</strong>, 37, 5575–5582.
                </li>
                <li style={{ marginBottom: '0.5rem' }}>
                    Alvarez, S. et al. <em>Coord. Chem. Rev.</em> <strong>2005</strong>, 249, 1693–1708.
                </li>
                <li>
                    Llunell, M. et al. SHAPE 2.1, Universitat de Barcelona, 2013.
                </li>
            </ul>
        </div>
      </>
      )}
      
      <footer style={{
        marginTop: '3rem',
        paddingTop: '1.5rem',
        borderTop: '1px solid #e2e8f0',
        textAlign: 'center',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <img src="https://raw.githubusercontent.com/HenriqueCSJ/NomenclaturaQuimica/refs/heads/main/UFRRJ.png" alt="UFRRJ Logo" style={{ width: 80, height: 80 }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#333' }}>Universidade Federal Rural do Rio de Janeiro (UFRRJ)</p>
            <p style={{ margin: 0 }}>Departamento de Química Fundamental</p>
            <p style={{ margin: 0 }}>Prof. Dr. Henrique C. S. Junior</p>
          </div>
        </div>
      </footer>

      
    </div>
</div>
    );
}

