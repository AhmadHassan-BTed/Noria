const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function main() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const svgPath = path.resolve(__dirname, '../docs/images/noria-logo.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  // Set content with styling to ensure it is centered and transparent
  await page.setContent(`
    <html>
      <style>
        body {
          margin: 0;
          background: transparent;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 512px;
          height: 512px;
        }
        svg {
          width: 512px;
          height: 512px;
        }
      </style>
      <body>
        ${svgContent}
      </body>
    </html>
  `);
  
  const pngPath = path.resolve(__dirname, '../docs/images/noria-logo.png');
  await page.screenshot({
    path: pngPath,
    omitBackground: true,
    clip: { x: 0, y: 0, width: 512, height: 512 }
  });
  
  console.log(`[Success] Rendered SVG to PNG: ${pngPath}`);
  await browser.close();
}

main().catch(err => {
  console.error('[Error] Failed to render SVG:', err);
  process.exit(1);
});
