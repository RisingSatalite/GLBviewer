'use client';

import dynamic from 'next/dynamic';

const ThreeGLBViewer = dynamic(() => import('../components/ThreeGLBViewer'), { ssr: false });

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <div className="pointer-events-none absolute right-4 top-4 z-10 rounded bg-slate-900/70 px-3 py-2 text-right text-sm text-white">
        <h1 className="font-semibold">GLB file viewer</h1>
        <p>Drag to rotate and use two fingers or the scroll wheel to zoom.</p>
      </div>
      <ThreeGLBViewer />
    </main>
  );
}
