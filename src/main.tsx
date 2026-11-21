import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <p className="brand">ULAM<span>?</span></p>
      <div className="intro">
        <p className="eyebrow">A LITTLE HELP FOR EVERYDAY MEALS</p>
        <h1>Anong ulam<span>?</span></h1>
        <p>Good food starts with a little inspiration. We’re preparing a place to plan, shop, and cook at your own pace.</p>
        <p className="status">The kitchen is coming together.</p>
      </div>
      <p className="footer">MADE FOR THE EVERYDAY TABLE</p>
    </main>
  </StrictMode>,
);
