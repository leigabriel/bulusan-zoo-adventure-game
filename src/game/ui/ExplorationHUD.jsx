import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ActionButton, ModalShell } from './UIComponents.jsx';

const ANIMAL_BOOK_ENTRIES = [
    { name: 'White-tailed Deer', scientific: 'Odocoileus virginianus', file: 'Deer.gltf', habitat: 'Forest edges', diet: 'Leaves, grass, and berries', behavior: 'Alert and gentle', status: 'Least Concern', fact: 'Its white tail warns the herd of danger.', description: 'A graceful forest friend that helps keep plants growing in balance.' },
    { name: 'Domestic Horse', scientific: 'Equus caballus', file: 'Horse.gltf', habitat: 'Open grassland', diet: 'Grass, hay, and grains', behavior: 'Social and curious', status: 'Domesticated', fact: 'Horses can sleep standing up.', description: 'A strong, kind companion that loves wide spaces and caring people.' },
    { name: 'Ostrich', scientific: 'Struthio camelus', file: 'ostrich/scene.gltf', habitat: 'Dry grassland', diet: 'Plants and small insects', behavior: 'Fast runner', status: 'Least Concern', fact: 'It is the world\'s largest living bird.', description: 'A tall bird with powerful legs and a very speedy run.' },
    { name: 'Donkey', scientific: 'Equus asinus', file: 'Donkey.gltf', habitat: 'Grassland and farms', diet: 'Grass and hay', behavior: 'Patient and hardworking', status: 'Domesticated', fact: 'Long ears help donkeys stay cool.', description: 'A sure-footed helper with a calm and friendly nature.' },
    { name: 'Domestic Cow', scientific: 'Bos taurus', file: 'Cow.gltf', habitat: 'Pastures and farms', diet: 'Grass and hay', behavior: 'Gentle herd animal', status: 'Domesticated', fact: 'Cows have excellent memories.', description: 'A peaceful grazer that enjoys living with its herd.' },
    { name: 'Alpaca', scientific: 'Vicugna pacos', file: 'Alpaca.gltf', habitat: 'Mountain grasslands', diet: 'Grass and plants', behavior: 'Quiet and social', status: 'Domesticated', fact: 'Its fleece is soft and warm.', description: 'A fluffy animal from the Andes with a gentle personality.' },
    { name: 'Red Deer Stag', scientific: 'Cervus elaphus', file: 'Stag.gltf', habitat: 'Woodlands', diet: 'Plants and grasses', behavior: 'Protective and alert', status: 'Least Concern', fact: 'A stag grows a new set of antlers each year.', description: 'A majestic deer whose antlers show how healthy it is.' },
    { name: 'Bull', scientific: 'Bos taurus', file: 'Bull.gltf', habitat: 'Grassland and farms', diet: 'Grass and hay', behavior: 'Strong and watchful', status: 'Domesticated', fact: 'Bulls can recognize familiar faces.', description: 'A powerful bovine that deserves space, patience, and care.' },
    { name: 'Forest Monkey', scientific: 'Macaca fascicularis', file: 'monkey/scene.gltf', habitat: 'Tropical forest', diet: 'Fruit, seeds, and insects', behavior: 'Playful and clever', status: 'Least Concern', fact: 'Monkeys use many different calls to communicate.', description: 'A clever climber that helps spread seeds through the forest.' },
    { name: 'Rabbit', scientific: 'Oryctolagus cuniculus', file: 'rabbit/scene.gltf', habitat: 'Meadows and woodland edges', diet: 'Grass, herbs, and vegetables', behavior: 'Quiet and quick', status: 'Least Concern', fact: 'A rabbit\'s teeth keep growing throughout its life.', description: 'A small, speedy friend with a twitching nose and soft fur.' },
    { name: 'Bengal Tiger', scientific: 'Panthera tigris tigris', file: 'tiger/scene.gltf', habitat: 'Forests and grasslands', diet: 'Meat', behavior: 'Solitary and stealthy', status: 'Endangered', fact: 'Every tiger has a unique stripe pattern.', description: 'A magnificent big cat that needs protected forests to survive.' },
];

const EMOJI_MAP = {
    'White-tailed Deer': '🦌',
    'Domestic Horse': '🐎',
    'Ostrich': '🦤',
    'Donkey': '🐴',
    'Domestic Cow': '🐄',
    'Alpaca': '🦙',
    'Red Deer Stag': '🦌',
    'Bull': '🐂',
    'Forest Monkey': '🐒',
    'Rabbit': '🐇',
    'Bengal Tiger': '🐅'
};

export function WelcomePaper({
    isOpen,
    onClose,
    objective = 'Discover animals and gently feed every friend.',
}) {
    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            title="Welcome Paper"
            size="sm"
            closeOnBackdrop={false}
        >
            <div className="rounded-2xl border-2 border-amber-200 bg-[#fff8df] p-4 text-slate-800 shadow-inner">
                <h2 className="text-center text-xl font-black text-emerald-900">
                    Welcome to Bulusan Zoo Adventure
                </h2>
                <p className="mt-3 text-sm font-semibold leading-relaxed">
                    Explore the paths, meet friendly animals, and learn about the natural beauty of Bulusan.
                </p>
                <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Your objective</p>
                    <p className="mt-1 text-sm font-black">{objective}</p>
                </div>
                <ActionButton className="mt-4 w-full" onClick={onClose}>
                    Start Exploring
                </ActionButton>
            </div>
        </ModalShell>
    );
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
    const bookApiRef = useRef(null);
    const maxSpread = Math.ceil((ANIMAL_BOOK_ENTRIES.length + 1) / 2);

    const fedAnimalsStr = JSON.stringify(fedAnimals);
    const discoveredAnimalsStr = JSON.stringify(discoveredAnimals);

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
                    name: entry.name,
                    scientific: entry.scientific,
                    emoji: EMOJI_MAP[entry.name] || '❓',
                    description: entry.description,
                    fact: entry.fact,
                    fed: fedMap[entry.name]
                });
            } else {
                bookData.push({ type: 'locked' });
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
        camera.position.set(0, 12, 10);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.2);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        scene.add(dirLight);

        const textures = [];
        const anisotropy = renderer.capabilities.getMaxAnisotropy();

        for (let i = 0; i < bookData.length; i++) {
            const pageData = bookData[i];
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = 1400;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#fdf6e3';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(0,0,0,0.05)';
            ctx.lineWidth = 15;
            ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

            if (pageData.type === 'cover_outside') {
                ctx.fillStyle = '#4ade80';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(0, 0, 80, canvas.height);

                ctx.fillStyle = '#064e3b';
                ctx.textAlign = 'center';
                ctx.font = 'bold 80px "Arial", sans-serif';
                ctx.fillText("BULUSAN ZOO", canvas.width / 2 + 20, 300);
                ctx.font = 'bold 150px "Arial", sans-serif';
                ctx.fillText("ANIMALS", canvas.width / 2 + 20, 480);
                ctx.font = '400px sans-serif';
                ctx.fillText("🦒", canvas.width / 2 + 20, 950);
                ctx.font = 'bold 40px "Arial", sans-serif';
                ctx.fillText("Explorer's Board Book", canvas.width / 2 + 20, 1250);

            } else if (pageData.type === 'pattern') {
                ctx.fillStyle = '#f0e8d0';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(0,0,0,0.05)';
                ctx.font = '60px sans-serif';
                for (let x = 0; x < canvas.width; x += 120) {
                    for (let y = 0; y < canvas.height; y += 120) {
                        ctx.save();
                        ctx.translate(x + 60, y + 60);
                        ctx.rotate(Math.random() * Math.PI * 2);
                        ctx.fillText("🐾", -30, 20);
                        ctx.restore();
                    }
                }
            } else if (pageData.type === 'title') {
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.font = 'italic 60px "Georgia", serif';
                ctx.fillText("An Interactive Journey", canvas.width / 2, 500);
                ctx.font = 'bold 100px "Arial", sans-serif';
                ctx.fillText("ANIMAL GUIDE", canvas.width / 2, 650);
            } else if (pageData.type === 'animal') {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.font = '350px sans-serif';
                ctx.fillText(pageData.emoji, canvas.width / 2 + 15, 415);
                ctx.fillStyle = '#333';
                ctx.fillText(pageData.emoji, canvas.width / 2, 400);

                ctx.fillStyle = '#1f2937';
                ctx.font = 'bold 80px "Arial", sans-serif';
                ctx.fillText(pageData.name.toUpperCase(), canvas.width / 2, 750);

                ctx.fillStyle = '#6b7280';
                ctx.font = 'italic 40px "Georgia", serif';
                ctx.fillText(pageData.scientific, canvas.width / 2, 830);

                ctx.fillStyle = '#4b5563';
                ctx.font = '40px "Arial", sans-serif';
                wrapText(ctx, pageData.description, canvas.width / 2, 950, canvas.width - 200, 50);

                ctx.fillStyle = '#065f46';
                ctx.font = 'bold 36px "Arial", sans-serif';
                wrapText(ctx, `Fact: ${pageData.fact}`, canvas.width / 2, 1150, canvas.width - 200, 45);

                if (pageData.fed) {
                    ctx.fillStyle = '#22c55e';
                    ctx.font = 'bold 45px "Arial", sans-serif';
                    ctx.fillText("⭐ Fed Successfully ⭐", canvas.width / 2, 1300);
                }

                ctx.fillStyle = '#9ca3af';
                ctx.font = '40px "Arial", sans-serif';
                ctx.textAlign = (i % 2 !== 0) ? 'left' : 'right';
                const px = (i % 2 !== 0) ? 60 : canvas.width - 60;
                ctx.fillText(`Page ${i - 1}`, px, canvas.height - 60);

            } else if (pageData.type === 'locked') {
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#d1d5db';
                ctx.font = '400px sans-serif';
                ctx.fillText("?", canvas.width / 2, 500);

                ctx.fillStyle = '#9ca3af';
                ctx.font = 'bold 80px "Arial", sans-serif';
                ctx.fillText("UNDISCOVERED", canvas.width / 2, 850);

                ctx.font = '40px "Arial", sans-serif';
                ctx.fillText("Explore the zoo to unlock.", canvas.width / 2, 950);
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.anisotropy = anisotropy;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.center.set(0.5, 0.5);
            // FIXED: Removed tex.rotation = Math.PI / 2; to keep right page upright

            textures.push(tex);
        }

        const leftTextures = textures.map((texture) => {
            const leftTexture = texture.clone();
            leftTexture.needsUpdate = true;
            leftTexture.center.set(0.5, 0.5);
            // FIXED: Flipped 180 degrees so left pages aren't mirrored/upside-down
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
                await animateValue(flipHinge.rotation, 'z', Math.PI, 800);

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
                await animateValue(flipHinge.rotation, 'z', 0, 800);

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
        animateValue(camera.position, 'y', 7, 1200);
        animateValue(camera.position, 'z', 6.5, 1200);
        animateValue(frontCoverHinge.rotation, 'z', Math.PI, 1200).then(() => {
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
                    className={`pointer-events-auto flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white/90 text-slate-800 text-2xl sm:text-4xl font-bold shadow-xl transition-all active:scale-95 ${spread === 0 || isAnimating ? 'opacity-0 disabled pointer-events-none' : 'opacity-100 hover:bg-white'}`}
                    onClick={() => {
                        onPageTurn?.();
                        bookApiRef.current?.turnBackward();
                    }}
                    aria-label="Previous Page"
                >
                    &#10094;
                </button>
                <button
                    className={`pointer-events-auto flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white/90 text-slate-800 text-2xl sm:text-4xl font-bold shadow-xl transition-all active:scale-95 ${spread >= maxSpread || isAnimating ? 'opacity-0 disabled pointer-events-none' : 'opacity-100 hover:bg-white'}`}
                    onClick={() => {
                        onPageTurn?.();
                        bookApiRef.current?.turnForward();
                    }}
                    aria-label="Next Page"
                >
                    &#10095;
                </button>
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