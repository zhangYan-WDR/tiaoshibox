const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Vector SVG source for 调试百宝箱 (TiaoshiBox) logo
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" fill="none">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#151821" />
      <stop offset="50%" stop-color="#0f1118" />
      <stop offset="100%" stop-color="#07080b" />
    </linearGradient>
    <linearGradient id="border-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)" />
      <stop offset="100%" stop-color="rgba(0,0,0,0.6)" />
    </linearGradient>
    <linearGradient id="neon-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00f0ff" />
      <stop offset="60%" stop-color="#0077ff" />
      <stop offset="100%" stop-color="#a29bfe" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.5" />
    </filter>
    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  
  {/* Dark background panel */}
  <rect x="2" y="2" width="96" height="96" rx="22" fill="url(#bg-grad)" stroke="url(#border-grad)" stroke-width="1.5" filter="url(#shadow)" />
  
  {/* Subtle top gloss */}
  <path d="M2.5 24C2.5 12.1259 12.1259 2.5 24 2.5H76C87.8741 2.5 97.5 12.1259 97.5 24V40C97.5 40 70 30 50 30C30 30 2.5 40 2.5 40V24Z" fill="white" fill-opacity="0.02" />
  
  {/* Outer Circuit Nodes */}
  <g stroke="url(#neon-grad)" stroke-width="2" stroke-linecap="round" opacity="0.4">
    <path d="M15 28 H24 V20" fill="none" />
    <circle cx="15" cy="28" r="2" fill="#00f0ff" />
    <path d="M85 28 H76 V20" fill="none" />
    <circle cx="85" cy="28" r="2" fill="#a29bfe" />
    <path d="M15 72 H24 V80" fill="none" />
    <circle cx="15" cy="72" r="2" fill="#00f0ff" />
    <path d="M85 72 H76 V80" fill="none" />
    <circle cx="85" cy="72" r="2" fill="#a29bfe" />
  </g>

  {/* Main 'T' + Wrench cyber tool logo in center */}
  <g filter="url(#neon-glow)">
    {/* T-bar top */}
    <rect x="24" y="26" width="52" height="9" rx="3" fill="url(#neon-grad)" />
    
    {/* Center connection block */}
    <rect x="44" y="32" width="12" height="8" fill="url(#neon-grad)" />
    
    {/* Wrench Shaft / T-stem */}
    <path d="M46 38 H54 V62 H46 Z" fill="url(#neon-grad)" />
    
    {/* Cyber Wrench Jaw at bottom */}
    <circle cx="50" cy="68" r="10" fill="none" stroke="url(#neon-grad)" stroke-width="6" />
    {/* Wrench opening */}
    <rect x="46" y="68" width="8" height="12" fill="#0f1118" />
    <circle cx="50" cy="68" r="4" fill="url(#neon-grad)" />
  </g>
</svg>`;

// Write icon.svg
fs.writeFileSync(path.join(buildDir, 'icon.svg'), svgContent, 'utf8');
console.log('Successfully generated build/icon.svg');

// Also copy icon.png placeholder or build it in next step
