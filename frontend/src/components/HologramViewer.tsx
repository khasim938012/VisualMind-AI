import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { Float, Html } from '@react-three/drei';

export const HologramViewer: React.FC = () => {
  const imageUrl = useStore(state => state.imageUrl);
  const status = useStore(state => state.status);
  
  const particlesRef = useRef<THREE.Points>(null);
  const particlesCount = 2000;
  
  const positions = useMemo(() => {
    const pos = new Float32Array(particlesCount * 3);
    for (let i = 0; i < particlesCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * (status === 'thinking' ? 0.5 : 0.05);
      particlesRef.current.rotation.x += delta * 0.02;
    }
  });

  return (
    <group>
      {/* Background Particles (Data Streams) */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlesCount}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial 
          size={0.05} 
          color={status === 'listening' ? '#ff3366' : '#00e5ff'} 
          transparent 
          opacity={0.6} 
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Hologram Image */}
      {imageUrl && (
        <Float speed={2} rotationIntensity={0.2} floatIntensity={1}>
          <Html position={[0, 0, 0]} center transform sprite zIndexRange={[100, 0]}>
            <div style={{
              background: 'rgba(0, 229, 255, 0.1)',
              padding: '10px',
              border: '1px solid rgba(0, 229, 255, 0.5)',
              borderRadius: '10px',
              boxShadow: '0 0 30px rgba(0, 229, 255, 0.3)',
              backdropFilter: 'blur(5px)'
            }}>
              <img 
                src={imageUrl} 
                alt="Hologram" 
                style={{
                  maxWidth: '400px', 
                  maxHeight: '400px', 
                  objectFit: 'contain', 
                  borderRadius: '5px',
                  display: 'block'
                }} 
              />
            </div>
          </Html>
        </Float>
      )}

      {/* Default Abstract Core (if no image) */}
      {!imageUrl && (
        <Float speed={3} rotationIntensity={1} floatIntensity={2}>
          <mesh>
            <icosahedronGeometry args={[2, 1]} />
            <meshStandardMaterial 
              color={status === 'thinking' ? '#ffffff' : '#00e5ff'} 
              wireframe 
              emissive={status === 'thinking' ? '#ffffff' : '#00e5ff'}
              emissiveIntensity={0.5}
            />
          </mesh>
        </Float>
      )}
    </group>
  );
};
