'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BuildingNode } from '../../shared/types';

interface Props {
  path: string[];
  nodes: BuildingNode[];
}

export default function EvacuationPath({ path, nodes }: Props) {
  const lineRef = useRef<THREE.Line>(null);

  const geometry = useMemo(() => {
    if (!path || path.length < 2) return null;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const points: THREE.Vector3[] = [];

    for (const id of path) {
      const node = nodeMap.get(id);
      if (node) {
        points.push(new THREE.Vector3(node.position.x, 1.2, node.position.z));
      }
    }

    if (points.length < 2) return null;

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [path, nodes]);

  // Animate dashed line by pulsing dashSize
  useFrame(({ clock }) => {
    if (!lineRef.current) return;
    const mat = lineRef.current.material as THREE.LineDashedMaterial;
    mat.dashSize = 0.25 + Math.abs(Math.sin(clock.getElapsedTime() * 1.5)) * 0.15;
    mat.needsUpdate = true;
  });

  if (!geometry) return null;

  return (
    <primitive
      object={
        (() => {
          const mat = new THREE.LineDashedMaterial({
            color: '#22c55e',
            linewidth: 2,
            dashSize: 0.3,
            gapSize: 0.15,
          });
          const line = new THREE.Line(geometry, mat);
          line.computeLineDistances(); // required for dashes to render
          return line;
        })()
      }
      ref={lineRef}
    />
  );
}
