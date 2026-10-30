"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function ShieldScene() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 9);
    scene.add(new THREE.AmbientLight(0xbcd7ff, 2.7));
    const key = new THREE.DirectionalLight(0xffffff, 6);
    key.position.set(-3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x70caff, 8);
    rim.position.set(4, 1, -2);
    scene.add(rim);
    const group = new THREE.Group();
    scene.add(group);

    const outline = new THREE.Shape();
    outline.moveTo(0, 1.63);
    outline.lineTo(1.29, 1.13);
    outline.lineTo(1.25, -0.08);
    outline.bezierCurveTo(1.18, -0.91, 0.58, -1.45, 0, -1.77);
    outline.bezierCurveTo(-0.58, -1.45, -1.18, -0.91, -1.25, -0.08);
    outline.lineTo(-1.29, 1.13);
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth: 0.27,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.09,
      bevelThickness: 0.07,
      curveSegments: 36,
    });
    geometry.center();
    const shell = new THREE.Mesh(
      geometry,
      new THREE.MeshPhysicalMaterial({
        color: 0x0877f9,
        metalness: 0.64,
        roughness: 0.23,
        clearcoat: 1,
      }),
    );
    group.add(shell);
    const inset = new THREE.Mesh(
      geometry,
      new THREE.MeshPhysicalMaterial({
        color: 0x082b70,
        metalness: 0.55,
        roughness: 0.28,
        clearcoat: 1,
      }),
    );
    inset.scale.set(0.85, 0.85, 0.8);
    inset.position.z = 0.14;
    group.add(inset);
    const innerRim = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        outline
          .getPoints(80)
          .map((p) => new THREE.Vector3(p.x * 0.78, p.y * 0.78 + 0.07, 0.34)),
      ),
      new THREE.LineBasicMaterial({
        color: 0x5ba9ff,
        transparent: true,
        opacity: 0.45,
      }),
    );
    group.add(innerRim);

    const card = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.76, 0.08),
      new THREE.MeshPhysicalMaterial({
        color: 0xeaf4ff,
        metalness: 0.35,
        roughness: 0.2,
      }),
    );
    card.position.set(-0.02, 0.04, 0.42);
    card.rotation.z = -0.09;
    group.add(card);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.13, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x10468c }),
    );
    stripe.position.set(0, 0.14, 0.055);
    card.add(stripe);
    const chip = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.12, 0.025),
      new THREE.MeshStandardMaterial({
        color: 0x88b8e9,
        metalness: 0.6,
        roughness: 0.3,
      }),
    );
    chip.position.set(-0.32, -0.15, 0.055);
    card.add(chip);

    const orbit = new THREE.Group();
    orbit.rotation.set(1.08, 0.22, -0.42);
    scene.add(orbit);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.12, 0.014, 8, 160),
      new THREE.MeshStandardMaterial({
        color: 0x278aff,
        metalness: 0.5,
        roughness: 0.25,
        emissive: 0x0069ff,
        emissiveIntensity: 0.5,
      }),
    );
    orbit.add(ring);
    const satellite = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x82c9ff,
        emissive: 0x167dff,
        emissiveIntensity: 1.5,
      }),
    );
    orbit.add(satellite);
    const startedAt = performance.now();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let pointerX = 0;
    let pointerY = 0;
    let visible = true;
    let frame = 0;
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const onMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 0.24;
      pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 0.12;
    };
    const resetPointer = () => {
      pointerX = 0;
      pointerY = 0;
    };
    const render = () => {
      frame = requestAnimationFrame(render);
      if (!visible || document.hidden) return;
      const t = motion.matches ? 0 : (performance.now() - startedAt) / 1000;
      group.rotation.y =
        -0.3 + Math.sin(t * 0.5) * 0.1 + (motion.matches ? 0 : pointerX);
      group.rotation.x = 0.06 + (motion.matches ? 0 : pointerY);
      group.rotation.z = -0.05;
      group.position.y = Math.sin(t * 0.8) * 0.075;
      satellite.position.set(
        Math.cos(t * 0.45 + 0.7) * 2.12,
        Math.sin(t * 0.45 + 0.7) * 2.12,
        0,
      );
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    visibilityObserver.observe(container);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", resetPointer);
    resize();
    render();
    setReady(true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibilityObserver.disconnect();
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", resetPointer);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="shield-scene" ref={host} aria-hidden="true">
      {!ready && (
        <img
          className="shield-fallback"
          src="/brand/disputeguard-logo.svg"
          alt=""
        />
      )}
    </div>
  );
}
