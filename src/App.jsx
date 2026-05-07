import React, { useState } from 'react';
import AppOffline from './AppOffline';
import AppFirebase from './AppFirebase';

export default function App() {
  const [mode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const betaParam = params.get('beta');
    
    if (betaParam === 'true') {
      localStorage.setItem('point_hugao_mode', 'firebase');
      return 'firebase';
    } else if (betaParam === 'false') {
      localStorage.setItem('point_hugao_mode', 'offline');
      return 'offline';
    }
    
    return localStorage.getItem('point_hugao_mode') || 'firebase';
  });

  // Renderização direta, sem lazy load para evitar erros de chunk
  if (mode === 'firebase') {
    return <AppFirebase />;
  }

  return <AppOffline />;
}
