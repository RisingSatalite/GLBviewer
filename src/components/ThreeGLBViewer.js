import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const disposeModel = (model) => {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  model.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (!object.material) return;

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (item?.isTexture) textures.add(item);
          });
        }
      });
    });
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
};

const frameModel = (loadedModel, camera, controls, preserveDirection = false) => {
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
  const direction = preserveDirection
    ? camera.position.clone().sub(controls.target).normalize()
    : new THREE.Vector3(1, 0.7, 1).normalize();

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
  const fileReaderRef = useRef(null);
  const dragCounterRef = useRef(0);
  const modelRef = useRef(null);
  const modelBaseScaleRef = useRef(null);
  const loadIdRef = useRef(0);
  const [model, setModel] = useState(null);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [dragActive, setDragActive] = useState(false);

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
      if (modelRef.current) frameModel(modelRef.current, camera, controls, true);
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
      fileReaderRef.current?.abort();
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      dracoLoader.dispose();
      if (modelRef.current) disposeModel(modelRef.current);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      dracoLoaderRef.current = null;
      fileReaderRef.current = null;
      modelRef.current = null;
    };
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    const requestId = ++loadIdRef.current;
    fileReaderRef.current?.abort();
    if (!file.name.toLowerCase().endsWith('.glb')) {
      setLoading(null);
      setError('Please choose a .glb file.');
      return;
    }

    setLoading({ phase: 'Reading file', progress: 0 });
    setError('');
    setFileInfo({ name: file.name, size: file.size });

    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        fileReaderRef.current = reader;
        reader.onprogress = (event) => {
          if (requestId === loadIdRef.current && event.lengthComputable) {
            setLoading({
              phase: 'Reading file',
              progress: Math.round((event.loaded / event.total) * 100),
            });
          }
        };
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('The selected file could not be read as binary data.'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
        reader.onabort = () => reject(new Error('File reading was cancelled.'));
        reader.readAsArrayBuffer(file);
      });
      if (requestId !== loadIdRef.current) return;

      setLoading({ phase: 'Parsing model', progress: null });
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.setDRACOLoader(dracoLoaderRef.current);
      loader.parse(
        data,
        '',
        (gltf) => {
          if (requestId !== loadIdRef.current) {
            disposeModel(gltf.scene);
            return;
          }

          const scene = sceneRef.current;
          const controls = controlsRef.current;
          const camera = cameraRef.current;
          if (!scene || !controls || !camera) {
            disposeModel(gltf.scene);
            return;
          }

          const loadedModel = gltf.scene;
          loadedModel.updateMatrixWorld(true);

          try {
            scene.add(loadedModel);
            frameModel(loadedModel, camera, controls);

            const previousModel = modelRef.current;
            if (previousModel) {
              scene.remove(previousModel);
              disposeModel(previousModel);
            }
            modelRef.current = loadedModel;
            setModel(loadedModel);
            modelBaseScaleRef.current = loadedModel.scale.clone();
            setScale(1);
          } catch (loadError) {
            scene.remove(loadedModel);
            disposeModel(loadedModel);
            setLoading(null);
            setError(loadError instanceof Error ? loadError.message : String(loadError));
            return;
          }
          setLoading(null);
        },
        (loadError) => {
          if (requestId !== loadIdRef.current) return;
          setLoading(null);
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      );
    } catch (loadError) {
      if (requestId !== loadIdRef.current) return;
      setLoading(null);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  const handleFileChange = (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    handleFile(file);
  };

  const handleDragEnter = (event) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setDragActive(true);
  };

  const handleDragLeave = (event) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragActive(false);
  };

  const handleDrop = (event) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragCounterRef.current = 0;
    setDragActive(false);
    const file = Array.from(event.dataTransfer.files).find((item) =>
      item.name.toLowerCase().endsWith('.glb')
    );
    if (file) {
      handleFile(file);
    } else {
      setError('Drop a .glb file to open it.');
    }
  };

  const handleScaleChange = (event) => {
    const newScale = Number(event.target.value);
    setScale(newScale);
    if (modelRef.current && modelBaseScaleRef.current) {
      modelRef.current.scale
        .copy(modelBaseScaleRef.current)
        .multiplyScalar(newScale);
      if (cameraRef.current) {
        const bounds = new THREE.Box3().setFromObject(modelRef.current);
        const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.01);
        const center = bounds.getCenter(new THREE.Vector3());
        const distance = cameraRef.current.position.distanceTo(center);
        cameraRef.current.near = Math.max(distance - radius * 2, 0.01);
        cameraRef.current.far = distance + radius * 2;
        cameraRef.current.updateProjectionMatrix();
      }
    }
  };

  const handleFitModel = (resetScale = false) => {
    const loadedModel = modelRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!loadedModel || !camera || !controls) return;
    if (resetScale && modelBaseScaleRef.current) {
      loadedModel.scale.copy(modelBaseScaleRef.current);
      setScale(1);
    }
    frameModel(loadedModel, camera, controls);
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-500"
      onDragEnter={handleDragEnter}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="absolute left-4 top-4 z-10 flex flex-col gap-2">
        <label className="w-fit cursor-pointer rounded bg-white px-3 py-2 text-sm text-slate-900 shadow">
          Choose a GLB file
          <input
            type="file"
            accept=".glb,model/gltf-binary"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
        {loading && (
          <div
            className="min-w-52 rounded bg-white/90 px-3 py-2 text-sm text-slate-900 shadow"
            role="status"
            aria-live="polite"
          >
            <p>
              {loading.phase}
              {loading.progress !== null ? `: ${loading.progress}%` : '…'}
            </p>
            {loading.progress !== null && (
              <progress
                className="mt-1 w-full"
                value={loading.progress}
                max="100"
                aria-label="File read progress"
              />
            )}
          </div>
        )}
        {fileInfo && (
          <p className="max-w-md truncate rounded bg-slate-900/70 px-3 py-2 text-xs text-white">
            {fileInfo.name} · {formatFileSize(fileInfo.size)}
          </p>
        )}
        {error && (
          <p role="alert" className="max-w-md rounded bg-red-950/90 px-3 py-2 text-sm text-white">
            Could not display this file: {error}
          </p>
        )}
      </div>
      <div ref={mountRef} className="h-full w-full" />
      {dragActive && (
        <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-xl border-4 border-dashed border-white bg-slate-950/60 text-2xl font-semibold text-white">
          Drop a GLB file to open it
        </div>
      )}
      {model && (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded bg-white/90 px-4 py-2 text-sm text-slate-900 shadow">
          <button type="button" onClick={() => handleFitModel()} className="rounded border px-3 py-1">
            Fit model
          </button>
          <button
            type="button"
            onClick={() => handleFitModel(true)}
            className="rounded border px-3 py-1"
          >
            Reset view
          </button>
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
