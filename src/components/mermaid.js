'use client'
// components/Mermaid.js
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

const Mermaid = ({ chart }) => {
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      mermaid.contentLoaded();
    }
  }, [chart]);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: true });
  }, []);

  return <div className="mermaid" ref={chartRef}>{chart}</div>;
};

export default Mermaid;
