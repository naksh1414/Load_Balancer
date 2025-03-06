const axios = require("axios");

async function runTest(numRequests) {
  const results = [];
  for (let i = 0; i < numRequests; i++) {
    const start = Date.now();
    try {
      await axios.get("http://localhost:8000/");
      const latency = Date.now() - start;
      results.push({ success: true, latency });
    } catch (err) {
      results.push({ success: false, latency: null });
    }
  }
  return results;
}

function calculateEfficiency(results) {
  const total = results.length;
  const successes = results.filter(r => r.success);
  const errorRate = ((total - successes.length) / total) * 10; // lower is better
  const avgLatency = successes.reduce((acc, cur) => acc + cur.latency, 0) / successes.length;
  
  // Normalize latency to a score out of 10 (example thresholds)
  let latencyScore = 10;
  if (avgLatency > 1000) latencyScore = 2;
  else if (avgLatency > 500) latencyScore = 5;
  else if (avgLatency > 200) latencyScore = 7;
  
  // Example throughput as number of requests per second
  const duration = Math.max(...results.map(r => r.latency)) || 1;
  const throughput = (successes.length / duration) * 1000; // req/sec
  let throughputScore = 10;
  if (throughput < 50) throughputScore = 3;
  else if (throughput < 100) throughputScore = 5;
  else if (throughput < 200) throughputScore = 7;
  
  // Assume a uniformity score from backend logs, for now set a placeholder
  const uniformityScore = 8;
  
  // Composite score example:
  const efficiencyScore = (0.4 * latencyScore) + (0.3 * throughputScore) + (0.2 * uniformityScore) + (0.1 * (10 - errorRate));
  return efficiencyScore.toFixed(2);
}

(async () => {
  const numRequests = 1000;
  console.log(`Sending ${numRequests} requests...`);
  const results = await runTest(numRequests);
  console.log(`Efficiency Score: ${calculateEfficiency(results)}`);
})();
