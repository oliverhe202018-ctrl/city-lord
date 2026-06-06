const http = require('https');

const data = JSON.stringify({
  module: 'city',
  action: 'fetchCityStats',
  args: ['110000']
});

const options = {
  hostname: 'cl1.4567666.xyz',
  port: 443,
  path: '/api/v1/rpc',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers);
    console.log('RESPONSE:', body);
  });
});

req.on('error', (e) => {
  console.error('ERROR:', e.message);
});

req.write(data);
req.end();
