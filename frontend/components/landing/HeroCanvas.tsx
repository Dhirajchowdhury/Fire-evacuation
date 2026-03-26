'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const W = el.clientWidth;
    const H = el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, 0, 12);

    // ── Fire orb — layered spheres ──────────────────────────────────────────
    const orbGroup = new THREE.Group();
    orbGroup.position.set(3.5, 0, 0);
    scene.add(orbGroup);

    // Core — bright inner sphere
    const coreGeo = new THREE.SphereGeometry(1.1, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff6030'),
      transparent: true,
      opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    orbGroup.add(core);

    // Mid glow layer
    const midGeo = new THREE.SphereGeometry(1.7, 32, 32);
    const midMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff3b2f'),
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
    });
    orbGroup.add(new THREE.Mesh(midGeo, midMat));

    // Outer halo
    const haloGeo = new THREE.SphereGeometry(2.6, 32, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#cc1a10'),
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    orbGroup.add(new THREE.Mesh(haloGeo, haloMat));

    // Far halo — very faint
    const farGeo = new THREE.SphereGeometry(4.2, 16, 16);
    const farMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff2200'),
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
    });
    orbGroup.add(new THREE.Mesh(farGeo, farMat));

    // ── Spark ring around orb ───────────────────────────────────────────────
    const sparkCount = 60;
    const sparkPos   = new Float32Array(sparkCount * 3);
    const sparkCol   = new Float32Array(sparkCount * 3);
    const sparkAngles = new Float32Array(sparkCount);
    const sparkRadii  = new Float32Array(sparkCount);
    const sparkSpeeds = new Float32Array(sparkCount);

    const sparkPalette = [
      new THREE.Color('#ff6030'),
      new THREE.Color('#ff3b2f'),
      new THREE.Color('#ff8c42'),
      new THREE.Color('#ffaa55'),
    ];

    for (let i = 0; i < sparkCount; i++) {
      sparkAngles[i] = Math.random() * Math.PI * 2;
      sparkRadii[i]  = 1.8 + Math.random() * 2.4;
      sparkSpeeds[i] = (0.3 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1);
      const c = sparkPalette[Math.floor(Math.random() * sparkPalette.length)];
      sparkCol[i * 3] = c.r; sparkCol[i * 3 + 1] = c.g; sparkCol[i * 3 + 2] = c.b;
    }

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color',    new THREE.BufferAttribute(sparkCol, 3));
    const sparkMat = new THREE.PointsMaterial({
      size: 0.07, vertexColors: true, transparent: true,
      opacity: 0.85, sizeAttenuation: true, depthWrite: false,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    orbGroup.add(sparks);

    // ── Background particles ────────────────────────────────────────────────
    const bgCount = 220;
    const bgPos   = new Float32Array(bgCount * 3);
    const bgCol   = new Float32Array(bgCount * 3);
    const bgVel   = new Float32Array(bgCount * 3);

    const bgPalette = [
      new THREE.Color('#ef4444'),
      new THREE.Color('#dc2626'),
      new THREE.Color('#f97316'),
      new THREE.Color('#1a0808'),
      new THREE.Color('#0a0a0a'),
    ];

    for (let i = 0; i < bgCount; i++) {
      bgPos[i * 3]     = (Math.random() - 0.5) * 28;
      bgPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      bgPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
      bgVel[i * 3]     = (Math.random() - 0.5) * 0.004;
      bgVel[i * 3 + 1] = (Math.random() - 0.5) * 0.004;
      bgVel[i * 3 + 2] = 0;
      const c = bgPalette[Math.floor(Math.random() * bgPalette.length)];
      bgCol[i * 3] = c.r; bgCol[i * 3 + 1] = c.g; bgCol[i * 3 + 2] = c.b;
    }

    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    bgGeo.setAttribute('color',    new THREE.BufferAttribute(bgCol, 3));
    const bgMat = new THREE.PointsMaterial({
      size: 0.055, vertexColors: true, transparent: true,
      opacity: 0.5, sizeAttenuation: true, depthWrite: false,
    });
    const bgParticles = new THREE.Points(bgGeo, bgMat);
    scene.add(bgParticles);

    // ── Mouse parallax ──────────────────────────────────────────────────────
    const mouse = { x: 0, y: 0 };
    const targetCam = { x: 0, y: 0 };
    function onMouseMove(e: MouseEvent) {
      mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // ── Resize ──────────────────────────────────────────────────────────────
    function onResize() {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    }
    window.addEventListener('resize', onResize);

    // ── Animation loop ──────────────────────────────────────────────────────
    let rafId: number;
    const clock = new THREE.Clock();

    function animate() {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Orb pulse
      const pulse = 1 + Math.sin(t * 2.2) * 0.06;
      orbGroup.scale.setScalar(pulse);
      coreMat.opacity = 0.75 + Math.sin(t * 2.2) * 0.15;
      midMat.opacity  = 0.28 + Math.sin(t * 1.8) * 0.08;
      haloMat.opacity = 0.08 + Math.sin(t * 1.4) * 0.04;

      // Orb slow rotation
      orbGroup.rotation.y = t * 0.18;
      orbGroup.rotation.z = Math.sin(t * 0.3) * 0.08;

      // Sparks orbit
      const posArr = sparkGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < sparkCount; i++) {
        sparkAngles[i] += sparkSpeeds[i] * 0.012;
        const r = sparkRadii[i] + Math.sin(t * 1.5 + i) * 0.15;
        posArr[i * 3]     = Math.cos(sparkAngles[i]) * r;
        posArr[i * 3 + 1] = Math.sin(sparkAngles[i]) * r * 0.6 + Math.sin(t + i * 0.5) * 0.2;
        posArr[i * 3 + 2] = Math.sin(sparkAngles[i] * 0.7) * r * 0.3;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = 0.6 + Math.sin(t * 1.2) * 0.25;

      // Background particles drift
      const bgArr = bgGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < bgCount; i++) {
        bgArr[i * 3]     += bgVel[i * 3];
        bgArr[i * 3 + 1] += bgVel[i * 3 + 1];
        // Wrap
        if (bgArr[i * 3]     >  14) bgArr[i * 3]     = -14;
        if (bgArr[i * 3]     < -14) bgArr[i * 3]     =  14;
        if (bgArr[i * 3 + 1] >   8) bgArr[i * 3 + 1] =  -8;
        if (bgArr[i * 3 + 1] <  -8) bgArr[i * 3 + 1] =   8;
      }
      bgGeo.attributes.position.needsUpdate = true;
      bgParticles.rotation.y = t * 0.015;

      // Camera parallax
      targetCam.x += (mouse.x * 0.6 - targetCam.x) * 0.04;
      targetCam.y += (-mouse.y * 0.4 - targetCam.y) * 0.04;
      camera.position.x = targetCam.x + Math.sin(t * 0.05) * 0.3;
      camera.position.y = targetCam.y + Math.cos(t * 0.04) * 0.2;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      [coreGeo, midGeo, haloGeo, farGeo, sparkGeo, bgGeo].forEach(g => g.dispose());
      [coreMat, midMat, haloMat, farMat, sparkMat, bgMat].forEach(m => m.dispose());
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
