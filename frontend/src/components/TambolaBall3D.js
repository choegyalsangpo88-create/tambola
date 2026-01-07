import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// The actual 3D Ball mesh
function Ball({ number, isVisible, onAnimationComplete }) {
  const meshRef = useRef();
  const [scale, setScale] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle, growing, holding, shrinking
  const targetScale = useRef(0);
  
  useEffect(() => {
    if (isVisible && number) {
      // Start grow animation
      setPhase('growing');
      targetScale.current = 1;
    } else if (!isVisible && phase !== 'idle') {
      // Start shrink animation
      setPhase('shrinking');
      targetScale.current = 0;
    }
  }, [isVisible, number]);
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // Smooth scale animation with easing
    const currentScale = scale;
    const target = targetScale.current;
    
    if (phase === 'growing') {
      // Casino-style pop: overshoot then settle
      const newScale = THREE.MathUtils.lerp(currentScale, target * 1.15, delta * 4);
      setScale(Math.min(newScale, 1.15));
      
      if (newScale >= 1.1) {
        setPhase('settling');
      }
    } else if (phase === 'settling') {
      const newScale = THREE.MathUtils.lerp(currentScale, 1, delta * 8);
      setScale(newScale);
      
      if (Math.abs(newScale - 1) < 0.01) {
        setScale(1);
        setPhase('holding');
      }
    } else if (phase === 'shrinking') {
      const newScale = THREE.MathUtils.lerp(currentScale, 0, delta * 5);
      setScale(Math.max(newScale, 0));
      
      if (newScale < 0.05) {
        setScale(0);
        setPhase('idle');
        if (onAnimationComplete) onAnimationComplete();
      }
    }
    
    // Apply scale
    meshRef.current.scale.setScalar(scale);
    
    // Subtle rotation while holding
    if (phase === 'holding') {
      meshRef.current.rotation.y += delta * 0.3;
    }
    
    // Fast spin during grow/shrink
    if (phase === 'growing' || phase === 'settling') {
      meshRef.current.rotation.y += delta * 8;
      meshRef.current.rotation.x += delta * 2;
    }
    if (phase === 'shrinking') {
      meshRef.current.rotation.y += delta * 10;
    }
  });
  
  if (!number && phase === 'idle') return null;
  
  return (
    <group ref={meshRef} scale={0}>
      {/* Main red ball */}
      <mesh castShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial
          color="#cc0000"
          metalness={0.1}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
          reflectivity={0.9}
          envMapIntensity={1}
        />
      </mesh>
      
      {/* Front white patch */}
      <mesh position={[0, 0, 0.95]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.55, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0}
          roughness={0.3}
        />
      </mesh>
      
      {/* Front number */}
      <Text
        position={[0, 0, 0.97]}
        fontSize={0.6}
        color="#111111"
        font="/fonts/Arial-Black.ttf"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {number || '?'}
      </Text>
      
      {/* Back white patch */}
      <mesh position={[0, 0, -0.95]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[0.55, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0}
          roughness={0.3}
        />
      </mesh>
      
      {/* Back number */}
      <Text
        position={[0, 0, -0.97]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.6}
        color="#111111"
        font="/fonts/Arial-Black.ttf"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {number || '?'}
      </Text>
    </group>
  );
}

// Loading fallback
function LoadingBall() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshBasicMaterial color="#cc0000" transparent opacity={0.5} />
    </mesh>
  );
}

// Main component
export default function TambolaBall3D({ number, previousNumber, isNewNumber }) {
  const [displayNumber, setDisplayNumber] = useState(number);
  const [showBall, setShowBall] = useState(!!number);
  const [key, setKey] = useState(0);
  
  useEffect(() => {
    if (isNewNumber && number !== displayNumber) {
      // New number called - shrink old, then show new
      if (displayNumber) {
        setShowBall(false);
        // Wait for shrink animation, then show new number
        setTimeout(() => {
          setDisplayNumber(number);
          setKey(k => k + 1);
          setShowBall(true);
        }, 400);
      } else {
        // No previous number, just show new one
        setDisplayNumber(number);
        setKey(k => k + 1);
        setShowBall(true);
      }
    } else if (!isNewNumber && number) {
      setDisplayNumber(number);
      setShowBall(true);
    }
  }, [number, isNewNumber]);
  
  return (
    <div className="w-full h-full" style={{ minHeight: '180px' }}>
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <spotLight
          position={[5, 5, 5]}
          angle={0.3}
          penumbra={1}
          intensity={1.5}
          castShadow
        />
        <spotLight
          position={[-5, 3, 5]}
          angle={0.3}
          penumbra={1}
          intensity={0.8}
        />
        <pointLight position={[0, -3, 3]} intensity={0.3} />
        
        {/* Environment for reflections */}
        <Environment preset="studio" />
        
        {/* The ball */}
        <Suspense fallback={<LoadingBall />}>
          <Ball
            key={key}
            number={displayNumber}
            isVisible={showBall}
          />
        </Suspense>
        
        {/* Shadow */}
        <ContactShadows
          position={[0, -1.5, 0]}
          opacity={0.5}
          scale={4}
          blur={2}
          far={4}
        />
      </Canvas>
    </div>
  );
}
