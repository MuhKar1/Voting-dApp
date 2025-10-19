import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@solana/wallet-adapter-react-ui/styles.css';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
