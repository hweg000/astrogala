import React, { useState, useEffect } from 'react';
import Galaxy from './Galaxy';
import Particles from './Particles';

export default function InteractiveBackground() {
  // Background is now fixed to galaxy
  const bgMode = 'galaxy';

  useEffect(() => {
    // No-op, fixed background
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -100, background: '#0d0618' }}>
      {bgMode === 'galaxy' && (
        <Galaxy 
          starSpeed={0.15} 
          rotationSpeed={0.03} 
          density={1.2} 
          glowIntensity={0.4} 
        />
      )}
      {bgMode === 'particles' && (
        <Particles
          particleColors={['#e11d48', '#ffffff', '#ff8da1']}
          particleCount={300}
          particleSpread={15}
          speed={0.1}
          particleBaseSize={80}
          moveParticlesOnHover={true}
        />
      )}
    </div>
  );
}
