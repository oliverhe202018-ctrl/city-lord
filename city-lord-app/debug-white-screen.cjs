const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((request, response) => {
    console.log('REQUEST: ' + request.url);
    let filePath = path.join(__dirname, 'dist', request.url === '/' ? 'index.html' : request.url);
    
    // Remove query params
    filePath = filePath.split('?')[0];
    
    // If path is a directory (or doesn't exist), maybe serve index.html for SPA routing
    if (!fs.existsSync(filePath)) {
        filePath = path.join(__dirname, 'dist', 'index.html');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(500);
            response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            response.end(); 
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
});

server.listen(0, async () => {
    const port = server.address().port;
    console.log(`Server running on port ${port}`);
    
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR STACK:', error.stack || error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText || ''));

    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
    
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
    server.close();
    console.log('Done');
});
