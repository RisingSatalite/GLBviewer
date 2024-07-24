// components/ThreeGLBViewer.js

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ThreeGLBViewer = () => {
  const mountRef = useRef(null);
  const fileInputRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [camera, setCamera] = useState(null);
  const [renderer, setRenderer] = useState(null);
  const [controls, setControls] = useState(null);
  const [model, setModel] = useState(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const currentMount = mountRef.current;

    // Create a scene
    const scene = new THREE.Scene();
    setScene(scene);

    // Create a camera
    const camera = new THREE.PerspectiveCamera(
      75,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    setCamera(camera);

    // Create a renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);
    setRenderer(renderer);

    // Add lighting
    const light = new THREE.AmbientLight(0xffffff); // Soft white light
    scene.add(light);

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    setControls(controls);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup function
    return () => {
      renderer.dispose();
      currentMount.removeChild(renderer.domElement);
    };
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);

      // Load the GLB file
      const loader = new GLTFLoader();
      loader.load(url, (gltf) => {
        if (model) {
          scene.remove(model); // Remove the previous model
        }
        const loadedModel = gltf.scene;
        setModel(loadedModel);
        scene.add(loadedModel);
      });
    }
  };

  const handleScaleChange = (event) => {
    const newScale = event.target.value;
    setScale(newScale);
    if (model) {
      model.scale.set(newScale, newScale, newScale);
    }
  };

  return (
    <div className="bg-slate-500" style={{ height: '100vh', overflow: 'hidden' }}>
      <input
        type="file"
        accept=".glb"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ position: 'absolute', zIndex: 1 }}
      />
      <div ref={mountRef} style={{ width: '100%', height: '90%' }} />
      {model && (
        <div style={{ position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center', zIndex: 1 }}>
          <label htmlFor="scale">Scale: </label>
          <input
            id="scale"
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={scale}
            onChange={handleScaleChange}
          />
        </div>
      )}
    </div>
  );
};

export default ThreeGLBViewer;
