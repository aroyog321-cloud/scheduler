const https = require('https');

https.get('https://novenote.vercel.app', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const hexRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    const matches = data.match(hexRegex) || [];
    
    // Count frequencies
    const counts = {};
    matches.forEach(m => {
      const lower = m.toLowerCase();
      counts[lower] = (counts[lower] || 0) + 1;
    });
    
    // Sort and print
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log("Found colors on novenote.vercel.app:");
    sorted.slice(0, 15).forEach(([hex, count]) => {
      console.log(`${hex} : ${count} times`);
    });
  });
}).on('error', err => {
  console.error("Error fetching:", err.message);
});
