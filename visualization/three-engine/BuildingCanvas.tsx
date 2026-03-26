'use client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { ZoneStatus } from '../../shared/types';
import { resolveNodeStatuses } from '../../frontend/utils/resolveNodeStatuses';
import buildingGraph from '../../shared/building-graph.json';
import BuildingNode from './BuildingNode';
import EvacuationPath from './EvacuationPath';
import {
  CAMERA_CONFIG,
  LIGHTING_CONFIG,
  FLOOR_CONFIG,
} from './sceneConfig';

interface Props {
  zones: ZoneStatus[];
  evacuationPath: string[] | null;
}

export default function BuildingCanvas({ zones, evacuationPath }: Props) {
  const activeNodes = resolveNodeStatuses(buildingGraph as any, zones);
  const fireNodeIds = activeNodes.filter((n) => n.status === 'fire').map((n) => n.id);
  const pathSet = new Set(evacuationPath ?? []);
  const evacuationActive = (evacuationPath ?? []).length > 0;

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f172a' }}>
      <Canvas
        camera={{
          position: CAMERA_CONFIG.position,
          fov: CAMERA_CONFIG.fov,
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={LIGHTING_CONFIG.ambientIntensity} />
        <directionalLight
          intensity={LIGHTING_CONFIG.directionalIntensity}
          position={LIGHTING_CONFIG.directionalPosition}
        />

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[FLOOR_CONFIG.width, FLOOR_CONFIG.height]} />
          <meshStandardMaterial color={FLOOR_CONFIG.color} />
        </mesh>

        {/* Grid */}
        <gridHelper
          args={[
            FLOOR_CONFIG.width,
            FLOOR_CONFIG.width,
            new THREE.Color(FLOOR_CONFIG.gridColor),
            new THREE.Color(FLOOR_CONFIG.gridColor),
          ]}
        />

        {/* Building nodes */}
        {activeNodes.map((node) => (
          <BuildingNode
            key={node.id}
            node={node}
            isFireNode={fireNodeIds.includes(node.id)}
            isOnEvacuationPath={evacuationActive ? pathSet.has(node.id) : true}
          />
        ))}

        {/* Evacuation path line */}
        {evacuationPath && evacuationPath.length > 1 && (
          <EvacuationPath path={evacuationPath} nodes={activeNodes} />
        )}

        <OrbitControls enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  );
}
