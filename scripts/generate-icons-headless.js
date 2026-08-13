const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: {
      offscreen: true
    }
  });

  const buildDir = path.join(__dirname, '../build');
  const svgPath = path.join(buildDir, 'icon.svg');
  if (!fs.existsSync(svgPath)) {
    console.error('Error: build/icon.svg does not exist! Run node scripts/prep-icons.js first.');
    app.quit();
    return;
  }

  const svgContent = fs.readFileSync(svgPath, 'utf8');

  // Replace default viewBox width/height with 1024 so it renders perfectly at full scale
  const scaledSvgContent = svgContent
    .replace('width="512"', 'width="1024"')
    .replace('height="512"', 'height="1024"');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body, html { margin: 0; padding: 0; overflow: hidden; background: transparent; }
        svg { width: 1024px; height: 1024px; display: block; }
      </style>
    </head>
    <body>
      ${scaledSvgContent}
    </body>
    </html>
  `;

  const tempHtml = path.join(__dirname, 'temp.html');
  fs.writeFileSync(tempHtml, htmlContent, 'utf8');

  win.loadURL('file://' + tempHtml);

  win.webContents.once('did-finish-load', async () => {
    // Wait for rendering and glows to finish
    await new Promise(r => setTimeout(r, 1000));
    
    const image = await win.capturePage();
    const pngBuffer = image.toPNG();

    // Save high-resolution PNG
    const pngPath = path.join(buildDir, 'icon.png');
    fs.writeFileSync(pngPath, pngBuffer);
    console.log('[Icon] Saved build/icon.png (1024x1024)');

    // Save a copy to the root directory for runtime use
    fs.writeFileSync(path.join(__dirname, '../icon.png'), pngBuffer);
    console.log('[Icon] Saved root icon.png');

    // Clean up temporary HTML file
    fs.unlinkSync(tempHtml);

    // Build icon.icns on macOS using built-in command lines
    if (process.platform === 'darwin') {
      try {
        console.log('[Icon] Creating icon.icns using sips and iconutil...');
        const iconsetDir = path.join(buildDir, 'icon.iconset');
        if (fs.existsSync(iconsetDir)) {
          fs.rmSync(iconsetDir, { recursive: true, force: true });
        }
        fs.mkdirSync(iconsetDir, { recursive: true });

        // Resize into various sizes needed by macOS iconset guidelines
        const sizes = [
          { size: 16, name: 'icon_16x16.png' },
          { size: 32, name: 'icon_16x16@2x.png' },
          { size: 32, name: 'icon_32x32.png' },
          { size: 64, name: 'icon_32x32@2x.png' },
          { size: 128, name: 'icon_128x128.png' },
          { size: 256, name: 'icon_128x128@2x.png' },
          { size: 256, name: 'icon_256x256.png' },
          { size: 512, name: 'icon_256x256@2x.png' },
          { size: 512, name: 'icon_512x512.png' },
          { size: 1024, name: 'icon_512x512@2x.png' }
        ];

        for (const s of sizes) {
          execSync(`sips -z ${s.size} ${s.size} "${pngPath}" --out "${path.join(iconsetDir, s.name)}"`);
        }

        // Generate icns
        execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`);
        console.log('[Icon] Successfully generated build/icon.icns');

        // Clean up iconset folder
        fs.rmSync(iconsetDir, { recursive: true, force: true });
      } catch (err) {
        console.error('[Icon] Failed to compile icon.icns:', err);
      }
    }

    app.quit();
  });
});
