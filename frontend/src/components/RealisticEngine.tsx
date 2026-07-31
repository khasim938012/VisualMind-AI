import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { Float, MeshTransmissionMaterial } from '@react-three/drei';

export const RealisticEngine: React.FC = () => {
  const { animationData } = useStore();
  
  // Parse animation data
  const pistonsSpeed = animationData?.pistons === 'fast' ? 10 : animationData?.pistons === 'slow' ? 3 : 0;
  const blockOpacity = animationData?.blockOpacity ?? 1.0;
  const isExploded = animationData?.explode ?? false;
  
  const pistonGroupRef = useRef<THREE.Group>(null);
  const blockRef = useRef<THREE.Mesh>(null);
  
  // Pistons logic
  const pistonCount = 6; // V6 Engine
  const pistons = useMemo(() => {
    const arr = [];
    for (let i = 0; i < pistonCount; i++) {
        const row = Math.floor(i / 3); // 0 or 1
        const col = i % 3;
        arr.push({
            id: i,
            x: (col - 1) * 1.5,
            y: 0,
            z: (row === 0 ? -1 : 1) * 0.8,
            offset: i * (Math.PI / 3) // phase offset
        });
    }
    return arr;
  }, []);

  const pistonRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    // Animate pistons up and down
    if (pistonsSpeed > 0) {
        pistons.forEach((piston, i) => {
            if (pistonRefs.current[i]) {
                pistonRefs.current[i]!.position.y = Math.sin(state.clock.elapsedTime * pistonsSpeed + piston.offset) * 0.8;
            }
        });
    }

    // Handle explode animation
    const targetY = isExploded ? 2 : 0;
    if (blockRef.current) {
        blockRef.current.position.y += (targetY - blockRef.current.position.y) * 0.1;
    }
  });

  return (
    <Float speed={1} rotationIntensity={0.5} floatIntensity={1}>
        <group rotation={[0.4, -0.6, 0]}>
            {/* The Engine Block Cover */}
            <mesh ref={blockRef} position={[0, 0, 0]}>
                <boxGeometry args={[5, 3, 3]} />
                <MeshTransmissionMaterial 
                    color="#1a1a24"
                    roughness={0.2}
                    thickness={1}
                    transmission={blockOpacity < 1 ? 0.9 : 0} // glass effect when transparent
                    opacity={blockOpacity}
                    transparent
                    resolution={1024}
                />
            </mesh>

            {/* The Pistons inside */}
            <group ref={pistonGroupRef} position={[0, -0.5, 0]}>
                {pistons.map((p, i) => (
                    <group key={p.id} position={[p.x, p.y, p.z]}>
                        {/* Cylinder Hole */}
                        <mesh position={[0, 0, 0]}>
                            <cylinderGeometry args={[0.6, 0.6, 2, 32]} />
                            <meshStandardMaterial color="#0a0a0f" metalness={0.8} roughness={0.5} side={THREE.BackSide} />
                        </mesh>
                        {/* Moving Piston Head */}
                        <mesh ref={el => pistonRefs.current[i] = el} position={[0, 0, 0]}>
                            <cylinderGeometry args={[0.55, 0.55, 0.5, 32]} />
                            <meshStandardMaterial color="#silver" metalness={1} roughness={0.2} emissive="#00e5ff" emissiveIntensity={pistonsSpeed > 0 ? 0.5 : 0} />
                        </mesh>
                    </group>
                ))}
            </group>
        </group>
    </Float>
  );
};
