const http = require('http');
const data = JSON.stringify({ duration: 5 });
const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/playlist/69a66f35859e1a6383197e7f',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};
const req = http.request(options, (res) => {
  console.log('status', res.statusCode);
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('body', body);
  });
});
req.on('error', (err) => console.error('error', err));
req.write(data);
req.end();
