// src/build.ts
import { promises as fs } from 'fs';
import { join } from 'path';

async function build() {
  console.log('🔨 Building static site...');
  
  // Create dist directory
  await fs.mkdir('dist', { recursive: true });
  
  // Bundle TypeScript to JavaScript
  const result = await Bun.build({
    entrypoints: ['./src/main.ts'],
    outdir: './dist',
    minify: true,
    target: 'browser',
    format: 'esm',
    splitting: false,
    sourcemap: 'external',
    naming: 'main.js'
  });

  if (!result.success) {
    console.error('❌ Build failed:');
    result.logs.forEach(log => console.error(log));
    process.exit(1);
  }

  // Copy HTML and CSS files
  await fs.copyFile('./src/index.html', './dist/index.html');
  await fs.copyFile('./src/styles.css', './dist/styles.css');
  
  console.log('✅ Build complete! Static files are in ./dist directory');
  console.log('📁 Deploy the ./dist directory to your static hosting service');
}

build().catch(console.error);