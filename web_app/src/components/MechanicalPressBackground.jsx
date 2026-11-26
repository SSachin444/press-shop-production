import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * MechanicalPressBackground
 *
 * Renders a mechanically synchronized 3D industrial stamping press in the fixed
 * background behind all UI surfaces without intercepting pointer or scroll events.
 * Driven strictly by existing document scrollY (advances on scroll down, reverses
 * identically on scroll up, freezes when scrolling stops, zero scroll hijacking).
 */
export default function MechanicalPressBackground() {
  const containerRef = useRef(null);
  const [webglFallback, setWebglFallback] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === 'undefined') return undefined;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let hasWebGL = false;
    try {
      const probe = document.createElement('canvas');
      hasWebGL = Boolean(
        typeof probe.getContext === 'function' &&
          (probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl'))
      );
    } catch {
      hasWebGL = false;
    }
    if (!hasWebGL) {
      setWebglFallback(true);
      return undefined;
    }

    let renderer;
    let scene;
    let camera;
    let rafId = null;
    let disposed = false;

    const geometries = [];
    const materials = [];
    const trackGeo = (g) => {
      geometries.push(g);
      return g;
    };
    const trackMat = (m) => {
      materials.push(m);
      return m;
    };

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.pointerEvents = 'none';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);
    } catch {
      setWebglFallback(true);
      return undefined;
    }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.set(3.2, 1.25, 11.4);
    camera.lookAt(0.4, 0.1, 0);

    // Industrial Studio Lighting
    const ambient = new THREE.AmbientLight(0xe2e8f0, 1.35);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
    keyLight.position.set(6, 9, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const orangeRim = new THREE.PointLight(0xf97316, 4.5, 18);
    orangeRim.position.set(-4.5, 2.5, 4.5);
    scene.add(orangeRim);

    const greenAccentLight = new THREE.PointLight(0x16a34a, 3.2, 16);
    greenAccentLight.position.set(4.8, -1.5, 4.2);
    scene.add(greenAccentLight);

    // Metallic Industrial PBR Materials
    const frameDarkSteel = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.72, roughness: 0.34 })
    );
    const machinedSteel = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.22 })
    );
    const chromeShaft = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.94, roughness: 0.14 })
    );
    const orangeSafetyMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.45, roughness: 0.35 })
    );
    const greenSafetyMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x16a34a, metalness: 0.4, roughness: 0.35 })
    );
    const dieHardenedMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.24 })
    );
    const sheetMetalMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.9,
        roughness: 0.2,
        emissive: new THREE.Color(0xea580c),
        emissiveIntensity: 0.04,
      })
    );

    const pressGroup = new THREE.Group();
    pressGroup.position.set(0.65, -0.15, 0);
    scene.add(pressGroup);

    // ----------------------------------------------------------------
    // 1. MAIN PRESS FRAME (Bed, Bolster, Columns, Gibs, Upper Crown)
    // ----------------------------------------------------------------
    const bed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.6, 0.85, 2.5)), frameDarkSteel);
    bed.position.set(0, -2.55, 0);
    bed.receiveShadow = true;
    pressGroup.add(bed);

    const bolster = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.2, 0.34, 2.0)), machinedSteel);
    bolster.position.set(0, -1.96, 0);
    bolster.receiveShadow = true;
    pressGroup.add(bolster);

    [-2.05, 2.05].forEach((colX) => {
      const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 4.7, 1.85)), frameDarkSteel);
      col.position.set(colX, 0.15, 0);
      col.castShadow = true;
      col.receiveShadow = true;
      pressGroup.add(col);

      // Machined gib guide rail on inner column face
      const gib = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 3.1, 0.85)), machinedSteel);
      gib.position.set(colX > 0 ? colX - 0.42 : colX + 0.42, -0.25, 0.1);
      pressGroup.add(gib);
    });

    const crown = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.3, 1.15, 2.2)), frameDarkSteel);
    crown.position.set(0, 2.65, 0);
    crown.castShadow = true;
    pressGroup.add(crown);

    // Industrial Orange Crown Trim + Green Status Beacon
    const crownStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.34, 0.16, 2.24)), orangeSafetyMat);
    crownStripe.position.set(0, 2.15, 0);
    pressGroup.add(crownStripe);

    const statusBeacon = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 16)), greenSafetyMat);
    statusBeacon.position.set(-2.1, 3.38, 0.55);
    pressGroup.add(statusBeacon);

    // ----------------------------------------------------------------
    // 2. FLYWHEEL (Spoked Heavy Cast Wheel on Right Crown Side)
    // ----------------------------------------------------------------
    const flywheelGroup = new THREE.Group();
    flywheelGroup.position.set(2.85, 2.55, -0.15);
    pressGroup.add(flywheelGroup);

    const fwRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.18, 0.18, 16, 42)), frameDarkSteel);
    fwRim.rotation.y = Math.PI / 2;
    flywheelGroup.add(fwRim);

    const fwOrangeRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.98, 0.045, 10, 36)), orangeSafetyMat);
    fwOrangeRing.rotation.y = Math.PI / 2;
    flywheelGroup.add(fwOrangeRing);

    const fwHub = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.42, 20)), machinedSteel);
    fwHub.rotation.z = Math.PI / 2;
    flywheelGroup.add(fwHub);

    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 2.15, 0.12)), machinedSteel);
      spoke.rotation.x = (i * Math.PI) / 3;
      flywheelGroup.add(spoke);
    }

    // ----------------------------------------------------------------
    // 3. CRANKSHAFT & ECCENTRIC CRANK THROW
    // ----------------------------------------------------------------
    const crownCenterY = 2.42;
    const crankRadius = 0.62;
    const rodLength = 2.05;

    const mainShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.2, 5.95, 20)), chromeShaft);
    mainShaft.rotation.z = Math.PI / 2;
    mainShaft.position.set(0.1, crownCenterY, 0);
    pressGroup.add(mainShaft);

    const crankThrowGroup = new THREE.Group();
    crankThrowGroup.position.set(0, crownCenterY, 0.22);
    pressGroup.add(crankThrowGroup);

    const crankWeb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.54, 1.05, 0.22)), machinedSteel);
    crankWeb.position.set(0, crankRadius * 0.5, 0);
    crankThrowGroup.add(crankWeb);

    const crankPin = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.56, 20)), orangeSafetyMat);
    crankPin.rotation.x = Math.PI / 2;
    crankPin.position.set(0, crankRadius, 0.15);
    crankThrowGroup.add(crankPin);

    // ----------------------------------------------------------------
    // 4. CONNECTING ROD (PITMAN ARM)
    // ----------------------------------------------------------------
    const conRodGroup = new THREE.Group();
    pressGroup.add(conRodGroup);

    const rodBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, rodLength, 0.26)), machinedSteel);
    conRodGroup.add(rodBeam);

    const rodUpperCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 18)), frameDarkSteel);
    rodUpperCap.rotation.x = Math.PI / 2;
    rodUpperCap.position.set(0, rodLength / 2, 0);
    conRodGroup.add(rodUpperCap);

    const rodLowerCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 18)), frameDarkSteel);
    rodLowerCap.rotation.x = Math.PI / 2;
    rodLowerCap.position.set(0, -rodLength / 2, 0);
    conRodGroup.add(rodLowerCap);

    // ----------------------------------------------------------------
    // 5. RAM (SLIDE) + 6. UPPER DIE (PUNCH)
    // ----------------------------------------------------------------
    const ramGroup = new THREE.Group();
    pressGroup.add(ramGroup);

    const wristClevis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 0.42, 0.65)), machinedSteel);
    wristClevis.position.set(0, 0.15, 0.22);
    ramGroup.add(wristClevis);

    const ramBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.15, 0.92, 1.35)), frameDarkSteel);
    ramBody.position.set(0, -0.45, 0.05);
    ramBody.castShadow = true;
    ramGroup.add(ramBody);

    const ramAccent = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.18, 0.12, 1.38)), orangeSafetyMat);
    ramAccent.position.set(0, -0.82, 0.05);
    ramGroup.add(ramAccent);

    // 6. Upper Die (Punch with stepped forming profile)
    const upperDieShoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.24, 1.2)), dieHardenedMat);
    upperDieShoe.position.set(0, -1.03, 0.05);
    ramGroup.add(upperDieShoe);

    const upperPunch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.34, 1.0)), machinedSteel);
    upperPunch.position.set(0, -1.32, 0.05);
    upperPunch.castShadow = true;
    ramGroup.add(upperPunch);

    // ----------------------------------------------------------------
    // 7. LOWER DIE (DIE BLOCK)
    // ----------------------------------------------------------------
    const lowerDieGroup = new THREE.Group();
    lowerDieGroup.position.set(0, -1.58, 0.05);
    pressGroup.add(lowerDieGroup);

    const lowerBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.55, 0.42, 1.28)), dieHardenedMat);
    lowerBase.position.set(0, 0, 0);
    lowerBase.receiveShadow = true;
    lowerDieGroup.add(lowerBase);

    // Left & right die shoulders forming central stamping channel
    [-0.9, 0.9].forEach((sx) => {
      const shoulder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.28, 1.12)), machinedSteel);
      shoulder.position.set(sx, 0.34, 0);
      lowerDieGroup.add(shoulder);
    });

    // ----------------------------------------------------------------
    // 8 & 9. METAL SHEET & REAL-TIME FORMING DEFORMATION
    // ----------------------------------------------------------------
    const sheetGeo = trackGeo(new THREE.BoxGeometry(2.85, 0.06, 1.05, 44, 2, 8));
    const basePositions = Float32Array.from(sheetGeo.attributes.position.array);
    const sheetMesh = new THREE.Mesh(sheetGeo, sheetMetalMat);
    const sheetRestY = -1.06;
    sheetMesh.position.set(0, sheetRestY, 0.05);
    sheetMesh.castShadow = true;
    pressGroup.add(sheetMesh);

    const applyKinematicPose = (theta) => {
      // Crank pin world-relative coords in XY plane
      const crankPinX = crankRadius * Math.sin(theta);
      const crankPinY = crownCenterY + crankRadius * Math.cos(theta);

      // Crank throw & flywheel synchronized rotation
      crankThrowGroup.rotation.z = -theta;
      flywheelGroup.rotation.x = theta * 3.0; // geared high-speed flywheel rotation

      // Exact slider-crank wrist pin vertical coordinate
      const underRoot = Math.max(0.01, rodLength * rodLength - crankPinX * crankPinX);
      const wristPinY = crankPinY - Math.sqrt(underRoot);

      // Connecting rod center & exact tilt angle connecting wrist pin -> crank pin
      const rodMidX = crankPinX * 0.5;
      const rodMidY = (crankPinY + wristPinY) * 0.5;
      const rodAngle = -Math.atan2(crankPinX, crankPinY - wristPinY);

      conRodGroup.position.set(rodMidX, rodMidY, 0.36);
      conRodGroup.rotation.z = rodAngle;

      // Ram + Upper Die position
      ramGroup.position.set(0, wristPinY, 0);

      // Upper punch bottom face Y
      const upperPunchBottomY = wristPinY - 1.49;
      const contactThresholdY = sheetRestY + 0.03;
      const maxPenetration = 0.29;
      const penetration = Math.max(0, Math.min(1, (contactThresholdY - upperPunchBottomY) / maxPenetration));

      // Deform Metal Sheet vertices reversibly into formed channel profile
      const posAttr = sheetGeo.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = basePositions[i];
        const by = basePositions[i + 1];
        const absX = Math.abs(bx);
        let dy = 0;
        if (absX < 0.56) {
          // Central stamped pocket
          dy = -0.25 * penetration;
        } else if (absX < 0.72) {
          // Smooth wall draw transition
          const t = 1 - (absX - 0.56) / 0.16;
          dy = -0.25 * penetration * (0.5 - 0.5 * Math.cos(t * Math.PI));
        } else {
          // Outer flange subtle draw-in lift
          dy = 0.015 * penetration;
        }
        arr[i + 1] = by + dy;
      }
      posAttr.needsUpdate = true;
      sheetGeo.computeVertexNormals();

      // Subtle thermal forming glow when die presses sheet
      sheetMetalMat.emissiveIntensity = 0.03 + penetration * 0.28;
      orangeRim.intensity = 4.0 + penetration * 3.5;
    };

    const BASE_THETA = 0.36;
    const PIXELS_PER_STROKE = 460;
    const computeTargetTheta = () =>
      prefersReducedMotion ? BASE_THETA : BASE_THETA + ((window.scrollY || 0) / PIXELS_PER_STROKE) * Math.PI * 2;

    let currentTheta = computeTargetTheta();
    let targetTheta = currentTheta;

    const renderFrame = () => {
      if (disposed || document.hidden) return;
      applyKinematicPose(currentTheta);
      renderer.render(scene, camera);
    };

    // Initial render
    renderFrame();

    const tick = () => {
      rafId = null;
      if (disposed || document.hidden) return;
      const diff = targetTheta - currentTheta;
      if (Math.abs(diff) > 0.0008) {
        currentTheta += diff * 0.22;
        renderFrame();
        rafId = window.requestAnimationFrame(tick);
      } else if (currentTheta !== targetTheta) {
        currentTheta = targetTheta;
        renderFrame();
      }
    };

    const scheduleRender = () => {
      if (disposed || document.hidden) return;
      if (!rafId) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onScroll = () => {
      if (prefersReducedMotion) return;
      targetTheta = computeTargetTheta();
      scheduleRender();
    };

    const onResize = () => {
      if (disposed) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderFrame();
    };

    const onVisibility = () => {
      if (!document.hidden) {
        targetTheta = computeTargetTheta();
        currentTheta = targetTheta;
        renderFrame();
      } else if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  return (
    <div className="press-bg-layer" aria-hidden="true">
      {!webglFallback ? (
        <div ref={containerRef} className="press-bg-canvas-host" />
      ) : (
        <svg className="press-bg-fallback" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
          <rect x="70" y="310" width="260" height="45" rx="4" fill="#1e293b" />
          <rect x="95" y="95" width="42" height="215" fill="#334155" />
          <rect x="263" y="95" width="42" height="215" fill="#334155" />
          <rect x="75" y="45" width="250" height="58" rx="4" fill="#1e293b" />
          <rect x="75" y="92" width="250" height="10" fill="#ea580c" />
          <circle cx="335" cy="75" r="46" fill="none" stroke="#334155" strokeWidth="12" />
          <rect x="148" y="145" width="104" height="56" rx="4" fill="#475569" />
          <rect x="155" y="255" width="90" height="5" fill="#94a3b8" />
        </svg>
      )}
      <div className="press-bg-veil" />
    </div>
  );
}
