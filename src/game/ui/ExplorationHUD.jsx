import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ActionButton, ModalShell } from './UIComponents.jsx';
import { ANIMAL_METADATA } from '../data/animalMetadata.js';
import { createGLTFLoader } from '../utils/gltfLoader.js';
import { resolveAssetUrl } from '../utils/localAssets.js';

const ANIMAL_BOOK_ENTRIES = ANIMAL_METADATA;

const snapshotCache = new Map();
const pendingSnapshots = new Map();

async function getAnimalModelSnapshot(entry) {
    if (!entry || !entry.file) return null;
    if (snapshotCache.has(entry.name)) {
        return snapshotCache.get(entry.name);
    }
    if (pendingSnapshots.has(entry.name)) {
        return pendingSnapshots.get(entry.name);
    }

    const promise = (async () => {
        try {
            const width = 256;
            const height = 256;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const scene = new THREE.Scene();
            scene.background = null;

            const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
            camera.position.set(0, 0.8, 3.8);
            camera.lookAt(0, 0, 0);

            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
            renderer.setSize(width, height);
            renderer.setPixelRatio(1);
            renderer.outputColorSpace = THREE.SRGBColorSpace;

            const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
            scene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xfff0dd, 2.5);
            dirLight.position.set(3, 5, 4);
            scene.add(dirLight);

            const loader = createGLTFLoader();
            const modelPath = `/models/animals/${entry.file}`;
            const modelUrl = await resolveAssetUrl(modelPath);
            loader.setResourcePath(modelPath.slice(0, modelPath.lastIndexOf('/') + 1));

            const gltf = await new Promise((resolve) => {
                loader.load(modelUrl, resolve, undefined, () => resolve(null));
            });

            if (gltf && gltf.scene) {
                const model = gltf.scene.clone();
                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z) || 1;
                const scale = 2.0 / maxDim;
                model.scale.multiplyScalar(scale);

                const center = new THREE.Vector3();
                box.getCenter(center);
                model.position.sub(center.multiplyScalar(scale));
                model.position.y -= 0.15;
                model.rotation.y = Math.PI / 4.5;

                scene.add(model);
                renderer.render(scene, camera);

                const snapshot2D = document.createElement('canvas');
                snapshot2D.width = width;
                snapshot2D.height = height;
                const ctx2d = snapshot2D.getContext('2d');
                ctx2d.drawImage(canvas, 0, 0);

                renderer.dispose();
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry?.dispose();
                        if (Array.isArray(child.material)) child.material.forEach((m) => m?.dispose());
                        else child.material?.dispose();
                    }
                });

                snapshotCache.set(entry.name, snapshot2D);
                return snapshot2D;
            }
        } catch (e) {
            console.warn(`Failed to generate snapshot for ${entry.name}`, e);
        }
        return null;
    })();

    pendingSnapshots.set(entry.name, promise);
    const result = await promise;
    pendingSnapshots.delete(entry.name);
    return result;
}

export function CameraPreview({ dataUrl, onSave, onRetake, onClose }) {
    if (!dataUrl) return null;
    return (
        <ModalShell isOpen={true} onClose={onClose} title="Your Zoo Photo" size="md">
            <img
                src={dataUrl}
                alt="Bulusan Zoo"
                className="max-h-[55dvh] w-full rounded-xl border-4 border-amber-200 object-contain"
            />
            <div className="mt-4 grid grid-cols-3 gap-2">
                <ActionButton size="sm" onClick={onSave}>Save Photo</ActionButton>
                <ActionButton size="sm" variant="secondary" onClick={onRetake}>Retake</ActionButton>
                <ActionButton size="sm" variant="secondary" onClick={onClose}>Close</ActionButton>
            </div>
        </ModalShell>
    );
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return y;
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
    return y + lineHeight;
}

export function AnimalBookModal({ isOpen, onClose, discoveredAnimals = [], fedAnimals = {}, onPageTurn }) {
    const containerRef = useRef(null);
    const [spread, setSpread] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [, setSnapshotsReady] = useState(0);
    const bookApiRef = useRef(null);
    const maxSpread = Math.ceil((ANIMAL_BOOK_ENTRIES.length + 1) / 2);

    const fedAnimalsStr = JSON.stringify(fedAnimals);
    const discoveredAnimalsStr = JSON.stringify(discoveredAnimals);

    useEffect(() => {
        if (!isOpen) return;
        const discoveredArr = JSON.parse(discoveredAnimalsStr);
        let mounted = true;

        const loadSnapshots = async () => {
            const entriesToLoad = ANIMAL_BOOK_ENTRIES.filter((e) => discoveredArr.includes(e.name));
            await Promise.all(entriesToLoad.map(getAnimalModelSnapshot));
            if (mounted) {
                setSnapshotsReady((c) => c + 1);
            }
        };

        loadSnapshots();
        return () => { mounted = false; };
    }, [isOpen, discoveredAnimalsStr]);

    useEffect(() => {
        if (!isOpen || !containerRef.current) return;

        let disposed = false;
        const container = containerRef.current;

        const fedMap = JSON.parse(fedAnimalsStr);
        const discoveredArr = JSON.parse(discoveredAnimalsStr);

        const bookData = [
            { type: 'cover_outside' },
            { type: 'pattern' },
            { type: 'title' }
        ];

        ANIMAL_BOOK_ENTRIES.forEach(entry => {
            if (discoveredArr.includes(entry.name)) {
                bookData.push({
                    type: 'animal',
                    entry,
                    name: entry.name,
                    scientific: entry.scientific,
                    description: entry.description,
                    fact: entry.fact,
                    fed: fedMap[entry.name]
                });
            } else {
                bookData.push({ type: 'locked', entry });
            }
        });

        if (bookData.length % 2 === 0) {
            bookData.push({ type: 'pattern' });
        }

        const MAX_SPREAD = Math.floor((bookData.length - 2) / 2);
        const scene = new THREE.Scene();
        scene.background = null;

        const width = container.clientWidth;
        const height = container.clientHeight;
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
        camera.position.set(0, 10, 8.5);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.3);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        scene.add(dirLight);

        const textures = [];
        const anisotropy = renderer.capabilities.getMaxAnisotropy();

        for (let i = 0; i < bookData.length; i++) {
            const pageData = bookData[i];
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 700;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#fdf6e3';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 8;
            ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

            if (pageData.type === 'cover_outside') {
                ctx.fillStyle = '#4ade80';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(0, 0, 40, canvas.height);

                ctx.fillStyle = '#064e3b';
                ctx.textAlign = 'center';
                ctx.font = 'bold 40px "Arial", sans-serif';
                ctx.fillText("BULUSAN ZOO", canvas.width / 2 + 10, 150);
                ctx.font = 'bold 75px "Arial", sans-serif';
                ctx.fillText("ANIMALS", canvas.width / 2 + 10, 240);
                ctx.font = '180px sans-serif';
                ctx.fillText("🦒", canvas.width / 2 + 10, 480);
                ctx.font = 'bold 20px "Arial", sans-serif';
                ctx.fillText("Explorer's Board Book", canvas.width / 2 + 10, 620);

            } else if (pageData.type === 'pattern') {
                ctx.fillStyle = '#f0e8d0';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(0,0,0,0.05)';
                ctx.font = '30px sans-serif';
                for (let x = 0; x < canvas.width; x += 60) {
                    for (let y = 0; y < canvas.height; y += 60) {
                        ctx.save();
                        ctx.translate(x + 30, y + 30);
                        ctx.rotate(Math.random() * Math.PI * 2);
                        ctx.fillText("🐾", -15, 10);
                        ctx.restore();
                    }
                }
            } else if (pageData.type === 'title') {
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.font = 'italic 30px "Georgia", serif';
                ctx.fillText("An Interactive Journey", canvas.width / 2, 250);
                ctx.font = 'bold 50px "Arial", sans-serif';
                ctx.fillText("ANIMAL GUIDE", canvas.width / 2, 330);
            } else if (pageData.type === 'animal') {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const snapshot = snapshotCache.get(pageData.name);
                if (snapshot) {
                    // Frame background
                    ctx.fillStyle = '#ecfdf5';
                    ctx.strokeStyle = '#a7f3d0';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.roundRect(canvas.width / 2 - 120, 70, 240, 240, 20);
                    ctx.fill();
                    ctx.stroke();

                    // Render 3D Model Snapshot
                    ctx.drawImage(snapshot, canvas.width / 2 - 110, 80, 220, 220);
                } else {
                    ctx.fillStyle = '#059669';
                    ctx.font = '80px sans-serif';
                    ctx.fillText("🐾", canvas.width / 2, 190);
                }

                ctx.fillStyle = '#1f2937';
                ctx.font = 'bold 36px "Arial", sans-serif';
                ctx.fillText(pageData.name.toUpperCase(), canvas.width / 2, 360);

                ctx.fillStyle = '#6b7280';
                ctx.font = 'italic 20px "Georgia", serif';
                ctx.fillText(pageData.scientific, canvas.width / 2, 400);

                ctx.fillStyle = '#4b5563';
                ctx.font = '20px "Arial", sans-serif';
                wrapText(ctx, pageData.description, canvas.width / 2, 460, canvas.width - 80, 26);

                ctx.fillStyle = '#065f46';
                ctx.font = 'bold 18px "Arial", sans-serif';
                wrapText(ctx, `Fact: ${pageData.fact}`, canvas.width / 2, 570, canvas.width - 80, 24);

                if (pageData.fed) {
                    ctx.fillStyle = '#22c55e';
                    ctx.font = 'bold 22px "Arial", sans-serif';
                    ctx.fillText("⭐ Fed Successfully ⭐", canvas.width / 2, 640);
                }

                ctx.fillStyle = '#9ca3af';
                ctx.font = '20px "Arial", sans-serif';
                ctx.textAlign = (i % 2 !== 0) ? 'left' : 'right';
                const px = (i % 2 !== 0) ? 30 : canvas.width - 30;
                ctx.fillText(`Page ${i - 1}`, px, canvas.height - 30);

            } else if (pageData.type === 'locked') {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.fillStyle = '#f3f4f6';
                ctx.strokeStyle = '#e5e7eb';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.roundRect(canvas.width / 2 - 120, 100, 240, 240, 20);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#9ca3af';
                ctx.font = '120px sans-serif';
                ctx.fillText("❓", canvas.width / 2, 220);

                ctx.fillStyle = '#9ca3af';
                ctx.font = 'bold 36px "Arial", sans-serif';
                ctx.fillText("UNDISCOVERED", canvas.width / 2, 420);

                ctx.font = '20px "Arial", sans-serif';
                ctx.fillText("Explore the zoo to unlock.", canvas.width / 2, 480);
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.anisotropy = anisotropy;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.center.set(0.5, 0.5);

            textures.push(tex);
        }

        const leftTextures = textures.map((texture) => {
            const leftTexture = texture.clone();
            leftTexture.needsUpdate = true;
            leftTexture.center.set(0.5, 0.5);
            leftTexture.rotation = Math.PI;
            return leftTexture;
        });

        const edgeCanvas = document.createElement('canvas');
        edgeCanvas.width = 128; edgeCanvas.height = 128;
        const ectx = edgeCanvas.getContext('2d');
        ectx.fillStyle = '#e5e5d5';
        ectx.fillRect(0, 0, 128, 128);
        ectx.fillStyle = '#d5d5c5';
        for (let i = 0; i < 128; i += 6) ectx.fillRect(0, i, 128, 2);
        const edgeTex = new THREE.CanvasTexture(edgeCanvas);
        edgeTex.wrapS = THREE.RepeatWrapping; edgeTex.wrapT = THREE.RepeatWrapping;
        edgeTex.repeat.set(1, 10);
        edgeTex.anisotropy = anisotropy;

        const bookGroup = new THREE.Group();
        scene.add(bookGroup);

        const bWidth = 4;
        const bHeight = 5.6;
        const thickness = 0.15;

        const matEdge = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.8 });
        const matCoverGreen = new THREE.MeshStandardMaterial({ color: '#4ade80', roughness: 0.6 });

        function createMaterialArray(topTex, bottomTex, isCover = false) {
            return [
                matEdge, matEdge,
                isCover && !topTex ? matCoverGreen : new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.7 }),
                isCover && !bottomTex ? matCoverGreen : new THREE.MeshStandardMaterial({ map: bottomTex, roughness: 0.7 }),
                matEdge, matEdge
            ];
        }

        const backCover = new THREE.Mesh(new THREE.BoxGeometry(bWidth, thickness, bHeight), createMaterialArray(textures[2], null, true));
        backCover.position.set(bWidth / 2, thickness / 2, 0);
        bookGroup.add(backCover);

        const frontCoverHinge = new THREE.Group();
        frontCoverHinge.position.set(0, thickness, 0);
        bookGroup.add(frontCoverHinge);

        const frontCover = new THREE.Mesh(new THREE.BoxGeometry(bWidth, thickness, bHeight), createMaterialArray(textures[0], leftTextures[1], true));
        frontCover.position.set(bWidth / 2, thickness / 2, 0);
        frontCoverHinge.add(frontCover);

        const flipHinge = new THREE.Group();
        flipHinge.position.set(0, thickness + 0.001, 0);
        bookGroup.add(flipHinge);

        const flippingPage = new THREE.Mesh(new THREE.BoxGeometry(bWidth, thickness, bHeight), createMaterialArray(textures[0], leftTextures[0], false));
        flippingPage.position.set(bWidth / 2, thickness / 2, 0);
        flipHinge.add(flippingPage);
        flippingPage.visible = false;

        let activeAnimations = [];
        function animateValue(obj, prop, endVal, duration) {
            return new Promise(resolve => {
                const startVal = obj[prop];
                const startTime = performance.now();
                activeAnimations.push({
                    update: (time) => {
                        let t = (time - startTime) / duration;
                        if (t >= 1) {
                            obj[prop] = endVal;
                            resolve();
                            return true;
                        }
                        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                        obj[prop] = startVal + (endVal - startVal) * ease;
                        return false;
                    }
                });
            });
        }

        let internalSpread = 0;

        function updateStaticMaterials(spreadIdx) {
            frontCover.material[3].map = leftTextures[spreadIdx * 2 + 1];
            frontCover.material[3].needsUpdate = true;
            backCover.material[2].map = textures[spreadIdx * 2 + 2];
            backCover.material[2].needsUpdate = true;
        }

        bookApiRef.current = {
            turnForward: async () => {
                if (internalSpread >= MAX_SPREAD) return;
                setIsAnimating(true);
                const nextSpread = internalSpread + 1;

                flippingPage.visible = true;
                flippingPage.material[2].map = textures[internalSpread * 2 + 2];
                flippingPage.material[3].map = leftTextures[nextSpread * 2 + 1];
                flippingPage.material.forEach(m => m.needsUpdate = true);

                backCover.material[2].map = textures[nextSpread * 2 + 2];
                backCover.material[2].needsUpdate = true;

                flipHinge.rotation.z = 0;
                await animateValue(flipHinge.rotation, 'z', Math.PI, 600);

                internalSpread = nextSpread;
                setSpread(internalSpread);
                updateStaticMaterials(internalSpread);
                flippingPage.visible = false;
                setIsAnimating(false);
            },
            turnBackward: async () => {
                if (internalSpread <= 0) return;
                setIsAnimating(true);
                const prevSpread = internalSpread - 1;

                flippingPage.visible = true;
                flippingPage.material[2].map = textures[prevSpread * 2 + 2];
                flippingPage.material[3].map = leftTextures[internalSpread * 2 + 1];
                flippingPage.material.forEach(m => m.needsUpdate = true);

                frontCover.material[3].map = leftTextures[prevSpread * 2 + 1];
                frontCover.material[3].needsUpdate = true;

                flipHinge.rotation.z = Math.PI;
                await animateValue(flipHinge.rotation, 'z', 0, 600);

                internalSpread = prevSpread;
                setSpread(internalSpread);
                updateStaticMaterials(internalSpread);
                flippingPage.visible = false;
                setIsAnimating(false);
            }
        };

        requestAnimationFrame(() => {
            if (!disposed) setIsAnimating(true);
        });
        updateStaticMaterials(0);
        animateValue(camera.position, 'y', 7, 700);
        animateValue(camera.position, 'z', 6.5, 700);
        animateValue(frontCoverHinge.rotation, 'z', Math.PI, 700).then(() => {
            setIsAnimating(false);
        });

        let animationFrame;
        const animate = (time) => {
            if (disposed) return;
            animationFrame = requestAnimationFrame(animate);
            activeAnimations = activeAnimations.filter(anim => !anim.update(time));
            renderer.render(scene, camera);
        };
        animationFrame = requestAnimationFrame(animate);

        const handleResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            disposed = true;
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrame);
            renderer.dispose();
            textures.forEach(t => t.dispose());
            leftTextures.forEach(t => t.dispose());
            edgeTex.dispose();
            bookGroup.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            container.innerHTML = '';
        };
    }, [isOpen, discoveredAnimalsStr, fedAnimalsStr]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/20 backdrop-blur-md touch-none" data-ui-modal="true">
            <div ref={containerRef} className="absolute inset-0" />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 sm:px-12 z-50">
                <button
                    disabled={spread === 0 || isAnimating}
                    className={`pointer-events-auto flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white/95 text-slate-800 text-2xl sm:text-4xl font-bold shadow-[0_6px_0_0_#cbd5e1] transition-all active:translate-y-1 active:shadow-none ${spread === 0 || isAnimating ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-white'}`}
                    onClick={() => {
                        onPageTurn?.();
                        bookApiRef.current?.turnBackward();
                    }}
                    aria-label="Previous Page"
                >
                    &#10094;
                </button>
                <button
                    disabled={spread >= maxSpread || isAnimating}
                    className={`pointer-events-auto flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white/95 text-slate-800 text-2xl sm:text-4xl font-bold shadow-[0_6px_0_0_#cbd5e1] transition-all active:translate-y-1 active:shadow-none ${spread >= maxSpread || isAnimating ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-white'}`}
                    onClick={() => {
                        onPageTurn?.();
                        bookApiRef.current?.turnForward();
                    }}
                    aria-label="Next Page"
                >
                    &#10095;
                </button>
            </div>

            <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-50 -translate-x-1/2 rounded-full bg-emerald-950/90 px-4 py-2 text-xs font-black text-white shadow-[0_4px_0_0_rgba(0,0,0,.3)]" aria-live="polite">
                {spread + 1} / {maxSpread + 1}
            </div>

            <button
                className="absolute top-6 right-6 sm:top-8 sm:right-8 z-50 pointer-events-auto w-12 h-12 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black text-2xl shadow-lg border-2 border-white transition-transform active:scale-95 flex items-center justify-center"
                onClick={onClose}
                aria-label="Close Book"
            >
                &times;
            </button>
        </div>
    );
}
