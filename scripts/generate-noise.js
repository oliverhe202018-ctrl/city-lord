const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

function generateNoise(width, height, opacity = 0.05) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fill transparent
  ctx.clearRect(0, 0, width, height);

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Random grayscale value
    const val = Math.floor(Math.random() * 255);
    
    data[i] = val;     // R
    data[i + 1] = val; // G
    data[i + 2] = val; // B
    data[i + 3] = Math.floor(Math.random() * 255 * opacity); // Alpha
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

// Generate a 256x256 noise texture
const buffer = generateNoise(256, 256, 0.1); // 10% opacity
const outputPath = path.join(process.cwd(), 'public', 'noise.png');

fs.writeFileSync(outputPath, buffer);
console.log(`Noise texture generated at: ${outputPath}`);
