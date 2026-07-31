import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import * as THREE from 'three';

export const ProceduralBuilder: React.FC = () => {
  const blueprint = useStore(state => state.blueprint);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Slow anti-gravity rotation for the entire group
      groupRef.current.rotation.y += delta * 0.1;
      groupRef.current.rotation.x += delta * 0.05;
    }
  });

  if (!blueprint || blueprint.length === 0) {
    // Default idling visual
    return (
      <mesh>
        <torusKnotGeometry args={[1, 0.3, 100, 16]} />
        <meshStandardMaterial color="#00f0ff" wireframe opacity={0.3} transparent />
      </mesh>
    );
  }

  return (
    <group ref={groupRef}>
      {blueprint.map((item, index) => {
        const position = new THREE.Vector3(...(item.position || [0, 0, 0]));
        return (
          <mesh key={index} position={position}>
            {item.type === 'sphere' && <sphereGeometry args={[item.radius || 1, 32, 32]} />}
            {item.type === 'box' && <boxGeometry args={[item.size || 1, item.size || 1, item.size || 1]} />}
            {item.type === 'cylinder' && <cylinderGeometry args={[item.radius || 1, item.radius || 1, item.height || 2, 32]} />}
            <meshStandardMaterial 
              color={item.color || '#ffffff'} 
              emissive={item.color || '#ffffff'}
              emissiveIntensity={0.2}
              wireframe={item.wireframe || false}
            />
          </mesh>
        );
      })}
    </group>
  );
};
