export const NODE_SIZES: Record<string, { w: number; h: number; d: number }> = {
  room:     { w: 2.5, h: 1,   d: 2.5 },
  corridor: { w: 3.5, h: 0.5, d: 1   },
  hub:      { w: 3,   h: 0.8, d: 3   },
  exit:     { w: 1.2, h: 2,   d: 1.2 },
};

export const NODE_COLORS: Record<string, string> = {
  safe:    '#22c55e',
  fire:    '#ef4444',
  blocked: '#6b7280',
  exit:    '#3b82f6',
};

export const CAMERA_CONFIG = {
  position: [0, 14, 10] as [number, number, number],
  fov: 60,
};

export const LIGHTING_CONFIG = {
  ambientIntensity: 0.5,
  directionalIntensity: 0.8,
  directionalPosition: [5, 10, 5] as [number, number, number],
};

export const FLOOR_CONFIG = {
  width: 20,
  height: 20,
  color: '#1e293b',
  gridColor: '#334155',
};
