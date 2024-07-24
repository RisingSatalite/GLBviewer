'use client'

import dynamic from 'next/dynamic';

const ThreeGLBViewer = dynamic(() => import('../components/ThreeGLBViewer'), { ssr: false });

export default function Home() {
  
  return (
    <main className=" items-center p-24">
      <div>GLB file viewer</div>
      <p>Use 2 finger to zoom, and click and drag to view the model from different directions.</p>
      <ThreeGLBViewer/>
    </main>
  );
}//<Mermaid chart={mermaidChart} />
