/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Build script to combine JS and CSS into single HTML files for MCP resources
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildDir = join(__dirname, 'build');
const distDir = join(__dirname, 'dist');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

console.log('Building component HTML files...\n');

try {
  // Read all assets from build directory
  const assetsDir = join(buildDir, 'assets');
  const files = readdirSync(assetsDir);

  // Find the main JS and CSS files
  const jsFile = files.find(f => f.endsWith('.js') && f.startsWith('index'));
  const cssFile = files.find(f => f.endsWith('.css') && f.startsWith('index'));

  if (!jsFile) {
    throw new Error('JavaScript file not found in build/assets/');
  }

  console.log(`Found JS file: ${jsFile}`);
  if (cssFile) {
    console.log(`Found CSS file: ${cssFile}`);
  }

  // Read the files
  const jsContent = readFileSync(join(assetsDir, jsFile), 'utf8');
  const cssContent = cssFile ? readFileSync(join(assetsDir, cssFile), 'utf8') : '';

  // Create the HTML template
  const createHtml = (title) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="color-scheme" content="light dark">
  <title>${title}</title>
  ${cssContent ? `<style>${cssContent}</style>` : ''}
</head>
<body>
  <div id="root"></div>
  <script type="module">
${jsContent}
  </script>
</body>
</html>`;

  // Create three identical HTML files (they all use the same component that auto-detects)
  const widgets = [
    { name: 'kelly-calculator.html', title: 'Kelly Criterion Calculator' },
    { name: 'probability-estimator.html', title: 'Probability Estimator' },
    { name: 'unit-calculator.html', title: 'Unit Betting Calculator' }
  ];

  widgets.forEach(widget => {
    const html = createHtml(widget.title);
    const outputPath = join(distDir, widget.name);
    writeFileSync(outputPath, html, 'utf8');

    const size = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(2);
    console.log(`✓ Created ${widget.name} (${size} KB)`);
  });

  console.log('\n✓ Build complete! Component HTML files are in component/dist/\n');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
