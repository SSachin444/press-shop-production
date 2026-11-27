import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * MechanicalPressBackground
 *
 * Renders a complete, responsive, scroll-synchronized 3D mechanical stamping press
 * in the fixed background without intercepting pointer or scroll events.
 * Scroll down drives the stroke forward, scroll up reverses identically,
 * and stopping freezes motion cleanly.
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.24;
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
    camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 80);

    // Balanced Studio & Industrial Shopfloor Lighting
    const ambient = new THREE.AmbientLight(0xf1f5f9, 1.55);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(6.5, 9.5, 9.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.15);
    fillLight.position.set(-7.5, 4.0, 6.0);
    scene.add(fillLight);

    const orangeRim = new THREE.PointLight(0xf97316, 4.2, 22);
    orangeRim.position.set(-4.5, 1.8, 5.2);
    scene.add(orangeRim);

    const greenAccentLight = new THREE.PointLight(0x16a34a, 2.8, 18);
    greenAccentLight.position.set(5.2, -1.8, 4.8);
    scene.add(greenAccentLight);

    // Industrial PBR Materials
    const frameIndustrialBlue = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x16325b, metalness: 0.62, roughness: 0.34 })
    );
    const crownDeepNavy = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x14243a, metalness: 0.68, roughness: 0.32 })
    );
    const machinedSteel = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.88, roughness: 0.22 })
    );
    const chromeShaft = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.94, roughness: 0.14 })
    );
    const movingDarkSteel = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.84, roughness: 0.26 })
    );
    const safetyYellowMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.32, roughness: 0.36 })
    );
    const orangeAccentMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.38, roughness: 0.34 })
    );
    const greenStatusMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x16a34a,
        metalness: 0.3,
        roughness: 0.3,
        emissive: new THREE.Color(0x16a34a),
        emissiveIntensity: 0.35,
      })
    );
    const blueMotorMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.55, roughness: 0.32 })
    );
    const sheetMetalMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xdbe4ee,
        metalness: 0.9,
        roughness: 0.18,
        emissive: new THREE.Color(0xf97316),
        emissiveIntensity: 0.04,
      })
    );

    const pressGroup = new THREE.Group();
    scene.add(pressGroup);

    // ----------------------------------------------------------------
    // 1. COMPLETE PRESS FRAME (Base Plate, Bed, Bolster, Columns, Crown)
    // ----------------------------------------------------------------
    const basePlinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.35, 2.9)), crownDeepNavy);
    basePlinth.position.set(0, -3.05, 0);
    basePlinth.receiveShadow = true;
    pressGroup.add(basePlinth);

    const bed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.8, 0.85, 2.55)), frameIndustrialBlue);
    bed.position.set(0, -2.5, 0);
    bed.receiveShadow = true;
    pressGroup.add(bed);

    const bolster = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.3, 0.34, 2.05)), machinedSteel);
    bolster.position.set(0, -1.9, 0);
    bolster.receiveShadow = true;
    pressGroup.add(bolster);

    [-2.15, 2.15].forEach((colX) => {
      const col = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.8, 4.75, 1.9)), frameIndustrialBlue);
      col.position.set(colX, 0.18, 0);
      col.castShadow = true;
      col.receiveShadow = true;
      pressGroup.add(col);

      // Machined gib guide rail on inner column face
      const gib = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.15, 3.15, 0.88)), chromeShaft);
      gib.position.set(colX > 0 ? colX - 0.44 : colX + 0.44, -0.22, 0.1);
      pressGroup.add(gib);

      // Tie-rod hex cap nuts on top crown corners
      const tieNut = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 6)), chromeShaft);
      tieNut.position.set(colX, 3.38, 0.65);
      pressGroup.add(tieNut);
    });

    const crown = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.65, 1.18, 2.25)), crownDeepNavy);
    crown.position.set(0, 2.68, 0);
    crown.castShadow = true;
    pressGroup.add(crown);

    // Crown Orange Accent & Clutch Housing
    const crownStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.7, 0.16, 2.29)), orangeAccentMat);
    crownStripe.position.set(0, 2.16, 0);
    pressGroup.add(crownStripe);

    const clutchHousing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.75, 0.75, 0.55, 28)), movingDarkSteel);
    clutchHousing.rotation.z = Math.PI / 2;
    clutchHousing.position.set(-2.9, 2.55, 0);
    pressGroup.add(clutchHousing);

    // Top Drive Motor & Gearbox Cover on Upper Crown
    const driveMotor = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 1.15, 20)), blueMotorMat);
    driveMotor.rotation.z = Math.PI / 2;
    driveMotor.position.set(1.2, 3.62, -0.25);
    pressGroup.add(driveMotor);

    const beltGuard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 1.25, 0.7)), safetyYellowMat);
    beltGuard.position.set(2.25, 3.12, -0.22);
    beltGuard.rotation.z = -0.35;
    pressGroup.add(beltGuard);

    // Top Pneumatic Counterbalance Cylinders + Green Run Beacon
    [-1.4, 0.1].forEach((cx) => {
      const cyl = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 16)), machinedSteel);
      cyl.position.set(cx, 3.55, -0.45);
      pressGroup.add(cyl);
    });

    const statusBeacon = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.15, 0.36, 16)), greenStatusMat);
    statusBeacon.position.set(-2.15, 3.45, -0.45);
    pressGroup.add(statusBeacon);

    // ----------------------------------------------------------------
    // 2. FLYWHEEL + SAFETY CAGE GUARD (Right Crown Side)
    // ----------------------------------------------------------------
    const flywheelGroup = new THREE.Group();
    flywheelGroup.position.set(3.0, 2.58, -0.1);
    pressGroup.add(flywheelGroup);

    const fwRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.18, 0.18, 16, 44)), movingDarkSteel);
    fwRim.rotation.y = Math.PI / 2;
    flywheelGroup.add(fwRim);

    const fwOrangeRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.98, 0.05, 10, 38)), orangeAccentMat);
    fwOrangeRing.rotation.y = Math.PI / 2;
    flywheelGroup.add(fwOrangeRing);

    const fwHub = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.44, 20)), chromeShaft);
    fwHub.rotation.z = Math.PI / 2;
    flywheelGroup.add(fwHub);

    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 2.18, 0.12)), machinedSteel);
      spoke.rotation.x = (i * Math.PI) / 3;
      flywheelGroup.add(spoke);
    }

    // Yellow Flywheel Protective Perimeter Ring & Stanchions
    const fwGuardRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(1.38, 0.055, 10, 42)), safetyYellowMat);
    fwGuardRing.rotation.y = Math.PI / 2;
    fwGuardRing.position.set(3.0, 2.58, -0.1);
    pressGroup.add(fwGuardRing);

    // ----------------------------------------------------------------
    // 3. CRANKSHAFT & ECCENTRIC CRANK THROW
    // ----------------------------------------------------------------
    const crownCenterY = 2.44;
    const crankRadius = 0.62;
    const rodLength = 2.04;

    const mainShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.21, 0.21, 6.25, 20)), chromeShaft);
    mainShaft.rotation.z = Math.PI / 2;
    mainShaft.position.set(0.05, crownCenterY, 0);
    pressGroup.add(mainShaft);

    const crankThrowGroup = new THREE.Group();
    crankThrowGroup.position.set(0, crownCenterY, 0.24);
    pressGroup.add(crankThrowGroup);

    const crankWeb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.56, 1.06, 0.22)), machinedSteel);
    crankWeb.position.set(0, crankRadius * 0.5, 0);
    crankThrowGroup.add(crankWeb);

    const crankPin = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.19, 0.19, 0.58, 20)), orangeAccentMat);
    crankPin.rotation.x = Math.PI / 2;
    crankPin.position.set(0, crankRadius, 0.16);
    crankThrowGroup.add(crankPin);

    // ----------------------------------------------------------------
    // 4. CONNECTING ROD (PITMAN ARM)
    // ----------------------------------------------------------------
    const conRodGroup = new THREE.Group();
    pressGroup.add(conRodGroup);

    const rodBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, rodLength, 0.28)), chromeShaft);
    conRodGroup.add(rodBeam);

    const rodUpperCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 18)), movingDarkSteel);
    rodUpperCap.rotation.x = Math.PI / 2;
    rodUpperCap.position.set(0, rodLength / 2, 0);
    conRodGroup.add(rodUpperCap);

    const rodLowerCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.23, 0.23, 0.36, 18)), movingDarkSteel);
    rodLowerCap.rotation.x = Math.PI / 2;
    rodLowerCap.position.set(0, -rodLength / 2, 0);
    conRodGroup.add(rodLowerCap);

    // ----------------------------------------------------------------
    // 5. RAM (SLIDE) + 6. UPPER DIE (PUNCH)
    // ----------------------------------------------------------------
    const ramGroup = new THREE.Group();
    pressGroup.add(ramGroup);

    const wristClevis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.78, 0.42, 0.68)), machinedSteel);
    wristClevis.position.set(0, 0.15, 0.22);
    ramGroup.add(wristClevis);

    const ramBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.25, 0.94, 1.38)), frameIndustrialBlue);
    ramBody.position.set(0, -0.45, 0.05);
    ramBody.castShadow = true;
    ramGroup.add(ramBody);

    const ramAccent = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.28, 0.12, 1.42)), safetyYellowMat);
    ramAccent.position.set(0, -0.82, 0.05);
    ramGroup.add(ramAccent);

    const upperDieShoe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 0.24, 1.2)), movingDarkSteel);
    upperDieShoe.position.set(0, -1.03, 0.05);
    ramGroup.add(upperDieShoe);

    const upperPunch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 0.35, 1.02)), chromeShaft);
    upperPunch.position.set(0, -1.32, 0.05);
    upperPunch.castShadow = true;
    ramGroup.add(upperPunch);

    // ----------------------------------------------------------------
    // 7. LOWER DIE & YELLOW SAFETY LIGHT CURTAINS
    // ----------------------------------------------------------------
    const lowerDieGroup = new THREE.Group();
    lowerDieGroup.position.set(0, -1.55, 0.05);
    pressGroup.add(lowerDieGroup);

    const lowerBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.65, 0.42, 1.32)), movingDarkSteel);
    lowerBase.position.set(0, 0, 0);
    lowerBase.receiveShadow = true;
    lowerDieGroup.add(lowerBase);

    [-0.92, 0.92].forEach((sx) => {
      const shoulder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.7, 0.28, 1.14)), chromeShaft);
      shoulder.position.set(sx, 0.34, 0);
      lowerDieGroup.add(shoulder);
    });

    // Yellow Safety Guards / Light-Curtain Columns on Front Left & Right
    [-2.75, 2.75].forEach((gx) => {
      const safetyPost = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 3.1, 0.16)), safetyYellowMat);
      safetyPost.position.set(gx, -1.18, 1.25);
      pressGroup.add(safetyPost);

      const postCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.14, 0.22)), orangeAccentMat);
      postCap.position.set(gx, 0.4, 1.25);
      pressGroup.add(postCap);
    });

    // Orange Side Operator Control Console Pedestal
    const controlBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.72, 0.45)), crownDeepNavy);
    controlBox.position.set(-2.95, -0.6, 0.95);
    pressGroup.add(controlBox);

    const eStopBtn = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 14)), orangeAccentMat);
    eStopBtn.rotation.x = Math.PI / 2;
    eStopBtn.position.set(-2.95, -0.42, 1.2);
    pressGroup.add(eStopBtn);

    // ----------------------------------------------------------------
    // 8. METAL SHEET & REAL-TIME FORMING DEFORMATION
    // ----------------------------------------------------------------
    const sheetGeo = trackGeo(new THREE.BoxGeometry(2.9, 0.065, 1.08, 44, 2, 8));
    const basePositions = Float32Array.from(sheetGeo.attributes.position.array);
    const sheetMesh = new THREE.Mesh(sheetGeo, sheetMetalMat);
    const sheetRestY = -1.03;
    sheetMesh.position.set(0, sheetRestY, 0.05);
    sheetMesh.castShadow = true;
    pressGroup.add(sheetMesh);

    const updateCameraFraming = () => {
      const w = Math.max(320, window.innerWidth);
      const h = Math.max(320, window.innerHeight);
      const aspect = w / h;
      camera.aspect = aspect;

      // Full press spans approx width=8.4 (-3.6..4.8) and height=7.4 (-3.3..4.1)
      const vFovRad = (camera.fov * Math.PI) / 180;
      const tanHalfV = Math.tan(vFovRad / 2);
      const neededDistV = 3.85 / tanHalfV;
      const neededDistH = 4.4 / (tanHalfV * aspect);
      const dist = Math.max(12.2, neededDistV, neededDistH) * 1.06;

      // Offset press slightly rightward on wide viewports so left sidebar leaves machine clear
      pressGroup.position.set(aspect >= 1.25 ? 0.55 : 0.05, -0.1, 0);
      camera.position.set(aspect >= 1.25 ? 2.4 : 0.85, 0.95, dist);
      camera.lookAt(0.15, 0.2, 0);
      camera.updateProjectionMatrix();
    };

    updateCameraFraming();

    const applyKinematicPose = (theta) => {
      const crankPinX = crankRadius * Math.sin(theta);
      const crankPinY = crownCenterY + crankRadius * Math.cos(theta);

      crankThrowGroup.rotation.z = -theta;
      flywheelGroup.rotation.x = theta * 3.0;

      const underRoot = Math.max(0.01, rodLength * rodLength - crankPinX * crankPinX);
      const wristPinY = crankPinY - Math.sqrt(underRoot);

      const rodMidX = crankPinX * 0.5;
      const rodMidY = (crankPinY + wristPinY) * 0.5;
      const rodAngle = -Math.atan2(crankPinX, crankPinY - wristPinY);

      conRodGroup.position.set(rodMidX, rodMidY, 0.36);
      conRodGroup.rotation.z = rodAngle;
      ramGroup.position.set(0, wristPinY, 0);

      const upperPunchBottomY = wristPinY - 1.49;
      const contactThresholdY = sheetRestY + 0.03;
      const maxPenetration = 0.29;
      const penetration = Math.max(0, Math.min(1, (contactThresholdY - upperPunchBottomY) / maxPenetration));

      const posAttr = sheetGeo.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = basePositions[i];
        const by = basePositions[i + 1];
        const absX = Math.abs(bx);
        let dy = 0;
        if (absX < 0.56) {
          dy = -0.25 * penetration;
        } else if (absX < 0.72) {
          const t = 1 - (absX - 0.56) / 0.16;
          dy = -0.25 * penetration * (0.5 - 0.5 * Math.cos(t * Math.PI));
        } else {
          dy = 0.015 * penetration;
        }
        arr[i + 1] = by + dy;
      }
      posAttr.needsUpdate = true;
      sheetGeo.computeVertexNormals();

      sheetMetalMat.emissiveIntensity = 0.04 + penetration * 0.28;
      orangeRim.intensity = 4.0 + penetration * 3.2;
    };

    const BASE_THETA = 0.42;
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
      updateCameraFraming();
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
        <svg className="press-bg-fallback" viewBox="0 0 460 420" preserveAspectRatio="xMidYMid meet">
          <rect x="65" y="340" width="290" height="36" rx="4" fill="#14243A" />
          <rect x="85" y="310" width="250" height="34" rx="4" fill="#16325B" />
          <rect x="105" y="95" width="44" height="215" fill="#16325B" />
          <rect x="271" y="95" width="44" height="215" fill="#16325B" />
          <rect x="78" y="42" width="264" height="58" rx="4" fill="#14243A" />
          <rect x="78" y="90" width="264" height="10" fill="#F97316" />
          <rect x="235" y="16" width="60" height="26" rx="4" fill="#2563EB" />
          <circle cx="356" cy="74" r="46" fill="none" stroke="#334155" strokeWidth="12" />
          <circle cx="356" cy="74" r="56" fill="none" stroke="#FACC15" strokeWidth="4" />
          <rect x="86" y="150" width="10" height="160" fill="#FACC15" />
          <rect x="324" y="150" width="10" height="160" fill="#FACC15" />
          <rect x="155" y="145" width="110" height="56" rx="4" fill="#16325B" />
          <rect x="165" y="255" width="90" height="6" fill="#94A3B8" />
        </svg>
      )}
      <div className="press-bg-veil" />
    </div>
  );
}
