import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const frameModel = (loadedModel, camera, controls) => {
  const bounds = new THREE.Box3().setFromObject(loadedModel);
  if (bounds.isEmpty()) {
    throw new Error('The file loaded but contains no visible 3D geometry.');
  }

  const center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.01);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const distance =
    Math.max(
      radius / Math.sin(verticalFov / 2),
      radius / Math.sin(horizontalFov / 2)
    ) * 1.2;
  const direction = new THREE.Vector3(1, 0.7, 1).normalize();

  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(distance - radius * 2, 0.01);
  camera.far = distance + radius * 2;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
};

const ThreeGLBViewer = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const dracoLoaderRef = useRef(null);
  const modelRef = useRef(null);
  const modelBaseScaleRef = useRef(null);
  const loadIdRef = useRef(0);
  const [model, setModel] = useState(null);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x64748b);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2);
    keyLight.position.set(1, 2, 3);
    scene.add(keyLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    dracoLoaderRef.current = dracoLoader;

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (modelRef.current) frameModel(modelRef.current, camera, controls);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationFrameId;
    const animate = () => {
      animationFrameId = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      loadIdRef.current += 1;
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      dracoLoader.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      dracoLoaderRef.current = null;
    };
  }, []);

  const handleFileChange = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const requestId = ++loadIdRef.current;
    setLoading(true);
    setError('');

    try {
      const data = await file.arrayBuffer();
      if (requestId !== loadIdRef.current) return;

      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.setDRACOLoader(dracoLoaderRef.current);
      loader.parse(
        data,
        '',
        (gltf) => {
          if (requestId !== loadIdRef.current) return;

          const scene = sceneRef.current;
          const controls = controlsRef.current;
          const camera = cameraRef.current;
          if (!scene || !controls || !camera) return;

          if (modelRef.current) scene.remove(modelRef.current);
          const loadedModel = gltf.scene;
          loadedModel.updateMatrixWorld(true);

          try {
            scene.add(loadedModel);
            frameModel(loadedModel, camera, controls);

            modelRef.current = loadedModel;
            setModel(loadedModel);
            modelBaseScaleRef.current = loadedModel.scale.clone();
            setScale(1);
          } catch (loadError) {
            scene.remove(loadedModel);
            modelRef.current = null;
            modelBaseScaleRef.current = null;
            setModel(null);
            setLoading(false);
            setError(loadError instanceof Error ? loadError.message : String(loadError));
            return;
          }
          setLoading(false);
        },
        (loadError) => {
          if (requestId !== loadIdRef.current) return;
          setLoading(false);
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      );
    } catch (loadError) {
      if (requestId !== loadIdRef.current) return;
      setLoading(false);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  const handleScaleChange = (event) => {
    const newScale = Number(event.target.value);
    setScale(newScale);
    if (modelRef.current && modelBaseScaleRef.current) {
      modelRef.current.scale
        .copy(modelBaseScaleRef.current)
        .multiplyScalar(newScale);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-500">
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        <label className="w-fit cursor-pointer rounded bg-white px-3 py-2 text-sm text-slate-900 shadow">
          {loading ? 'Loading model…' : 'Choose a GLB file'}
          <input
            type="file"
            accept=".glb,model/gltf-binary"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
        {error && (
          <p role="alert" className="max-w-md rounded bg-red-950/90 px-3 py-2 text-sm text-white">
            Could not display this file: {error}
          </p>
        )}
      </div>
      <div ref={mountRef} className="h-full w-full" />
      {model && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded bg-white/90 px-4 py-2 text-sm text-slate-900 shadow">
          <label htmlFor="scale">Scale</label>
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
