'use client'
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Mermaid = dynamic(() => import('mermaid').then((mod) => mod.default), { ssr: false });

export default function CustomDiagram() {
  const [isMounted, setIsMounted] = useState(false);
  const diagramCode = "graph TD A[Start] --> B[End]";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      {isMounted && (
        <div>
          <Mermaid>{diagramCode}</Mermaid>
        </div>
      )}
    </main>
  );
}