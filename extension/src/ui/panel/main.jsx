import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Panel from './Panel.jsx';
import '../index.css';
import '../legacy.css'; // overview, cards, Markdown, onboarding styles

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Panel />
  </StrictMode>,
);
