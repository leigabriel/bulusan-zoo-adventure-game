import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ActionButton, ModalShell } from './UIComponents.jsx';
import { createGLTFLoader } from '../utils/gltfLoader.js';

const ANIMAL_BOOK_ENTRIES = [
    { name: 'White-tailed Deer', scientific: 'Odocoileus virginianus', file: 'Deer.gltf', habitat: 'Forest edges', diet: 'Leaves, grass, and berries', behavior: 'Alert and gentle', status: 'Least Concern', fact: 'Its white tail warns the herd of danger.', description: 'A graceful forest friend that helps keep plants growing in balance.' },
    { name: 'Domestic Horse', scientific: 'Equus caballus', file: 'Horse.gltf', habitat: 'Open grassland', diet: 'Grass, hay, and grains', behavior: 'Social and curious', status: 'Domesticated', fact: 'Horses can sleep standing up.', description: 'A strong, kind companion that loves wide spaces and caring people.' },
    { name: 'Ostrich', scientific: 'Struthio camelus', file: 'ostrich/scene.gltf', habitat: 'Dry grassland', diet: 'Plants and small insects', behavior: 'Fast runner', status: 'Least Concern', fact: 'It is the world’s largest living bird.', description: 'A tall bird with powerful legs and a very speedy run.' },
    { name: 'Donkey', scientific: 'Equus asinus', file: 'Donkey.gltf', habitat: 'Grassland and farms', diet: 'Grass and hay', behavior: 'Patient and hardworking', status: 'Domesticated', fact: 'Long ears help donkeys stay cool.', description: 'A sure-footed helper with a calm and friendly nature.' },
    { name: 'Domestic Cow', scientific: 'Bos taurus', file: 'Cow.gltf', habitat: 'Pastures and farms', diet: 'Grass and hay', behavior: 'Gentle herd animal', status: 'Domesticated', fact: 'Cows have excellent memories.', description: 'A peaceful grazer that enjoys living with its herd.' },
    { name: 'Alpaca', scientific: 'Vicugna pacos', file: 'Alpaca.gltf', habitat: 'Mountain grasslands', diet: 'Grass and plants', behavior: 'Quiet and social', status: 'Domesticated', fact: 'Its fleece is soft and warm.', description: 'A fluffy animal from the Andes with a gentle personality.' },
    { name: 'Red Deer Stag', scientific: 'Cervus elaphus', file: 'Stag.gltf', habitat: 'Woodlands', diet: 'Plants and grasses', behavior: 'Protective and alert', status: 'Least Concern', fact: 'A stag grows a new set of antlers each year.', description: 'A majestic deer whose antlers show how healthy it is.' },
    { name: 'Bull', scientific: 'Bos taurus', file: 'Bull.gltf', habitat: 'Grassland and farms', diet: 'Grass and hay', behavior: 'Strong and watchful', status: 'Domesticated', fact: 'Bulls can recognize familiar faces.', description: 'A powerful bovine that deserves space, patience, and care.' },
    { name: 'Forest Monkey', scientific: 'Macaca fascicularis', file: 'monkey/scene.gltf', habitat: 'Tropical forest', diet: 'Fruit, seeds, and insects', behavior: 'Playful and clever', status: 'Least Concern', fact: 'Monkeys use many different calls to communicate.', description: 'A clever climber that helps spread seeds through the forest.' },
    { name: 'Rabbit', scientific: 'Oryctolagus cuniculus', file: 'rabbit/scene.gltf', habitat: 'Meadows and woodland edges', diet: 'Grass, herbs, and vegetables', behavior: 'Quiet and quick', status: 'Least Concern', fact: 'A rabbit’s teeth keep growing throughout its life.', description: 'A small, speedy friend with a twitching nose and soft fur.' },
    { name: 'Bengal Tiger', scientific: 'Panthera tigris tigris', file: 'tiger/scene.gltf', habitat: 'Forests and grasslands', diet: 'Meat', behavior: 'Solitary and stealthy', status: 'Endangered', fact: 'Every tiger has a unique stripe pattern.', description: 'A magnificent big cat that needs protected forests to survive.' },
];

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

export function AnimalBookModal({ isOpen, onClose, discoveredAnimals = [], fedAnimals = {}, onPageTurn }) {
    const [page, setPage] = useState(0);
    const [turning, setTurning] = useState(false);
    const modelHostRef = useRef(null);
    const modelResourcesRef = useRef(null);
    const turnTimerRef = useRef(null);
    const moveRef = useRef(null);
    const pageCount = ANIMAL_BOOK_ENTRIES.length + 2;
    const entry = page > 1 ? ANIMAL_BOOK_ENTRIES[page - 2] : null;
    const unlocked = entry ? discoveredAnimals.includes(entry.name) : true;

    const move = useCallback((delta) => {
        if (turning) return;
        const next = Math.max(0, Math.min(pageCount - 1, page + delta));
        if (next === page) return;
        setTurning(true);
        onPageTurn?.();
        turnTimerRef.current = window.setTimeout(() => { setPage(next); setTurning(false); turnTimerRef.current = null; }, 420);
    }, [onPageTurn, page, pageCount, turning]);

    useEffect(() => { moveRef.current = move; }, [move]);

    useEffect(() => {
        if (!isOpen || !entry || !unlocked || !modelHostRef.current) return undefined;
        const host = modelHostRef.current;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(Math.max(160, host.clientWidth), Math.max(130, host.clientHeight));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.replaceChildren(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, renderer.domElement.width / renderer.domElement.height, 0.1, 100);
        camera.position.set(0, 0.8, 4.2);
        scene.add(new THREE.HemisphereLight(0xfff3d0, 0x355c4b, 2.2));
        const key = new THREE.DirectionalLight(0xffffff, 2.5);
        key.position.set(3, 4, 5);
        scene.add(key);
        let mounted = true;
        let animationFrame;
        createGLTFLoader().load(`/models/animals/${entry.file}`, (gltf) => {
            if (!mounted) return;
            const model = gltf.scene;
            model.scale.setScalar(entry.file.includes('scene.gltf') ? 1.1 : 1);
            model.position.y = -1;
            scene.add(model);
            modelResourcesRef.current = { model };
        }, undefined, () => { });
        const animate = () => { if (!mounted) return; animationFrame = requestAnimationFrame(animate); const model = modelResourcesRef.current?.model; if (model) model.rotation.y += 0.006; renderer.render(scene, camera); };
        animate();
        return () => {
            mounted = false;
            cancelAnimationFrame(animationFrame);
            modelResourcesRef.current?.model?.traverse((child) => { if (!child.isMesh) return; child.geometry?.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => { material?.map?.dispose?.(); material?.dispose?.(); }); });
            modelResourcesRef.current = null;
            scene.clear();
            renderer.dispose();
            renderer.forceContextLoss?.();
            renderer.domElement.remove();
        };
    }, [entry, isOpen, unlocked]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => { if (event.key === 'ArrowLeft') moveRef.current?.(-1); if (event.key === 'ArrowRight') moveRef.current?.(1); };
        const onTouchStart = (event) => { if (modelHostRef.current) modelHostRef.current.bookTouchX = event.touches[0].clientX; };
        const onTouchEnd = (event) => { const start = modelHostRef.current?.bookTouchX; const end = event.changedTouches[0].clientX; if (Number.isFinite(start) && Math.abs(end - start) > 35) moveRef.current?.(end < start ? 1 : -1); };
        window.addEventListener('keydown', onKeyDown);
        const host = modelHostRef.current;
        host?.addEventListener('touchstart', onTouchStart, { passive: true });
        host?.addEventListener('touchend', onTouchEnd, { passive: true });
        return () => { window.removeEventListener('keydown', onKeyDown); host?.removeEventListener('touchstart', onTouchStart); host?.removeEventListener('touchend', onTouchEnd); if (turnTimerRef.current) window.clearTimeout(turnTimerRef.current); };
    }, [isOpen]);

    if (!isOpen) return null;
    return <div className="fixed inset-0 z-120 flex items-center justify-center bg-emerald-950/55 p-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)]" data-ui-modal="true"><div className="relative flex h-[min(92dvh,38rem)] w-full max-w-5xl flex-col rounded-3xl border-8 border-[#653b1d] bg-[#8a542b] p-2 shadow-2xl sm:p-4"><button type="button" onClick={onClose} aria-label="Close Animal Book" className="absolute right-2 top-2 z-10 h-11 w-11 rounded-full bg-white text-2xl font-black text-slate-900 shadow-lg">&times;</button><div className="mb-2 flex items-center justify-between px-2 text-white sm:px-4"><h2 className="text-lg font-black uppercase tracking-wider sm:text-2xl">Animal Book</h2><span className="text-xs font-black">{page + 1} / {pageCount}</span></div><div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-[#f8e8bb] p-2 shadow-inner sm:p-5"><div className="grid h-full min-h-0 grid-cols-2 gap-1 rounded-lg border-4 border-[#c89a58] bg-[#fff8df] p-2 shadow-[inset_0_0_18px_rgba(93,54,20,.22)] sm:gap-3 sm:p-5"><div className="flex min-h-0 flex-col border-r-2 border-[#d2b477] pr-2 sm:pr-4">{entry ? <><p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Explorer notes</p><h3 className="mt-1 text-base font-black text-emerald-900 sm:text-2xl">{unlocked ? entry.name : '???'}</h3><p className="text-[10px] font-bold italic text-slate-500 sm:text-xs">{unlocked ? entry.scientific : 'Unknown species'}</p><div ref={modelHostRef} className="my-2 min-h-25 flex-1 rounded-xl bg-emerald-100/60 sm:min-h-40">{!unlocked ? <div className="grid h-full place-items-center text-7xl opacity-25 grayscale">{entry.name === 'Rabbit' ? '🐇' : '🐾'}</div> : null}</div>{unlocked ? <p className="text-[11px] font-semibold leading-snug text-slate-700 sm:text-sm">{entry.description}</p> : <p className="text-center text-xs font-black text-slate-600">Discover this animal to unlock</p>}</> : <div className="flex h-full flex-col justify-center text-center"><p className="text-4xl">{page === 0 ? '🌋' : '🏅'}</p><h3 className="mt-2 text-xl font-black text-emerald-900">{page === 0 ? 'Bulusan Zoo' : 'Zoo Ranger Achievement'}</h3><p className="mt-3 text-xs font-semibold leading-relaxed text-slate-700 sm:text-sm">{page === 0 ? 'A place to explore, care for animals, and protect the living world around Bulusan.' : 'Every discovery and every gentle feeding makes you a better Zoo Ranger.'}</p></div>}</div><div className="min-h-0 overflow-y-auto pl-2 sm:pl-4">{entry && unlocked ? <div className="space-y-2 text-[10px] text-slate-700 sm:space-y-3 sm:text-sm"><p><b>Habitat:</b> {entry.habitat}</p><p><b>Diet:</b> {entry.diet}</p><p><b>Behavior:</b> {entry.behavior}</p><p><b>Conservation:</b> {entry.status}</p><p><b>Fun fact:</b> {entry.fact}</p><div className="rounded-xl bg-emerald-100 p-2 font-black text-emerald-900">{fedAnimals[entry.name] ? 'Fed successfully' : 'Not fed yet'}</div></div> : <p className="text-xs font-semibold leading-relaxed text-slate-600">Turn the page to meet another Bulusan animal.</p>}</div></div></div><div className="mt-2 flex justify-between gap-2"><ActionButton size="sm" variant="secondary" disabled={turning || page === 0} onClick={() => move(-1)}>Previous</ActionButton><ActionButton size="sm" variant="primary" disabled={turning || page === pageCount - 1} onClick={() => move(1)}>Next</ActionButton></div></div></div>;
}
