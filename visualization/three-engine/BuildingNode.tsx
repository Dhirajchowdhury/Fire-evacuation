'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { BuildingNode as BuildingNodeType } from '../../shared/types';
import { NODE_SIZES, NODE_COLORS } from './sceneConfig';

interface Props {
  node: BuildingNodeType;
  isOnEvacuationPath: boolean;
  isFireNode: boolean;
}

export default function BuildingNode({ node, isOnEvacuationPath, isFireNode }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const size = NODE_SIZES[node.type] ?? NODE_SIZES.room;

  // Pulsing animation for fire nodes
  useFrame(({ clock }: { clock: THREE.Clock }) => {
    if (!meshRef.current || !isFireNode) return;
    const scale = 1.0 + 0.08 * Math.sin(clock.getElapsedTime() * 1.5 * Math.PI);
    meshRef.current.scale.setScalar(scale);
  });

  // Resolve color and material props
  let color = NODE_COLORS[node.status] ?? NODE_COLORS.safe;
  let emissive = '#000000';
  let emissiveIntensity = 0;
  let opacity = 1;
  let transparent = false;
  let staticScale = 1;

  if (isFireNode) {
    color = '#ef4444';
  } else if (isOnEvacuationPath) {
    color = '#22c55e';
    emissive = '#166534';
    emissiveIntensity = 0.6;
    staticScale = 1.05;
  } else if (!isOnEvacuationPath) {
    // Dim non-path nodes when an evacuation is active — caller passes isOnEvacuationPath=false
    // We detect "evacuation active" by checking if the node is neither fire nor path
    opacity = 0.6;
    transparent = true;
  }

  const labelY = node.position.y + size.h + 0.4;

  return (
    <group position={[node.position.x, node.position.y, node.position.z]}>
      {/* Fire point light */}
      {isFireNode && (
        <pointLight color="#ef4444" intensity={2} distance={4} position={[0, size.h + 0.5, 0]} />
      )}

      {/* Node mesh */}
      <mesh ref={meshRef} scale={isFireNode ? 1 : staticScale}>
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          opacity={opacity}
          transparent={transparent}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, labelY, 0]}
        fontSize={0.28}
        color="white"
        anchorX="center"
        anchorY="bottom"
      >
        {node.label}
      </Text>
    </group>
  );
}
