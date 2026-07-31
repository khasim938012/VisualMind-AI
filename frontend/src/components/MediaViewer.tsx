import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { Float, Html } from '@react-three/drei';

import { RealisticEngine } from './RealisticEngine';

export const MediaViewer: React.FC = () => {
  const { imageUrl, videoUrl, modelName, status } = useStore();
  
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

  useFrame((_, delta) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * (status === 'thinking' ? 0.5 : 0.05);
      particlesRef.current.rotation.x += delta * 0.02;
    }
  });

  const renderMedia = () => {
    if (modelName === 'engine') {
        return <RealisticEngine />;
    }

    if (modelName) {
        // Fallback for models since we don't have local GLB files yet
        // In the future, you could use: const { scene } = useGLTF(`/models/${modelName}.glb`)
        return (
            <Float speed={3} rotationIntensity={1} floatIntensity={2}>
              <mesh>
                <boxGeometry args={[2, 2, 2]} />
                <meshStandardMaterial 
                  color={'#ff00ff'} 
                  wireframe 
                  emissive={'#ff00ff'}
                  emissiveIntensity={0.8}
                />
              </mesh>
              <Html position={[0, -2, 0]} center>
                  <div style={{ color: '#ff00ff', fontFamily: 'monospace', textShadow: '0 0 5px #ff00ff', whiteSpace: 'nowrap' }}>
                      [3D Model Placeholder for {modelName.toUpperCase()}]
                      <br/>
                      <small style={{opacity:0.5}}>Add {modelName}.glb to public/models/ to load</small>
                  </div>
              </Html>
            </Float>
        );
    }

    // Default Abstract Core (if no media)
    return (
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
    );
  };

  return (
    <group>
      {/* Background Particles (Data Streams) */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
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

      {renderMedia()}
    </group>
  );
};
