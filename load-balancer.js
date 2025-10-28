const express = require("express");
const httpProxy = require("http-proxy");
const crypto = require("crypto");
const axios = require("axios");

const app = express();
const proxy = httpProxy.createProxyServer();
const PORT = 8000;

// Backend server class with weight, latency, and active connection tracking
class BackendServer {
  constructor(url, weight = 1) {
    this.url = url;
    this.weight = weight;
    this.baseWeight = weight; // original weight
    this.activeConnections = 0;
    this.active = true;
    this.latency = 100; // default latency in ms
  }
}

// Backend server list
let servers = [
  new BackendServer("http://localhost:3001", 100),
  new BackendServer("http://localhost:3002", 24),
  new BackendServer("http://localhost:3003", 10)
];

let roundRobinIndex = 0;

/* ------------------------------ Helper Functions ------------------------------ */

// Create a consistent hash for IP
function ipHash(ip) {
  const hash = crypto.createHash("md5").update(ip).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

// Select best server using hybrid algorithm
function getHybridServer(clientIp) {
  const healthyServers = servers.filter(s => s.active);
  if (healthyServers.length === 0) {
    throw new Error("No healthy backend servers available");
  }

  // Calculate weighted load (activeConnections / weight)
  let bestServer = healthyServers[0];
  let bestRatio = bestServer.activeConnections / bestServer.weight;

  healthyServers.forEach(server => {
    const ratio = server.activeConnections / server.weight;
    if (ratio < bestRatio) {
      bestServer = server;
      bestRatio = ratio;
    }
  });

  // Try IP-hash candidate if client IP exists
  if (clientIp) {
    const hash = ipHash(clientIp);
    const candidateIndex = hash % healthyServers.length;
    const candidate = healthyServers[candidateIndex];
    const candidateRatio = candidate.activeConnections / candidate.weight;

    // If candidate load is within 20% of best, use it
    if (candidateRatio <= bestRatio * 1.2) {
      console.log(`Hybrid: Using IP-hash candidate ${candidate.url}`);
      return candidate;
    }
  }

  // Fallback: Round robin among similar servers (within 10% of best ratio)
  const similarServers = healthyServers.filter(s => {
    const ratio = s.activeConnections / s.weight;
    return ratio <= bestRatio * 1.1;
  });

  if (similarServers.length > 1) {
    const selected = similarServers[roundRobinIndex % similarServers.length];
    roundRobinIndex++;
    console.log(`Hybrid: Using Round Robin among similar servers, selected ${selected.url}`);
    return selected;
  }

  console.log(`Hybrid: Using Weighted Least Connections, selected ${bestServer.url}`);
  return bestServer;
}

/* ------------------------------ TCP Tuning ------------------------------ */

// Optimized kernel-level TCP tuning and connection pooling
const net = require("net");
net.createServer().maxConnections = 10000;
require("http").globalAgent.maxSockets = Infinity;
require("https").globalAgent.maxSockets = Infinity;

/* ------------------------------ Dynamic Weight Adjustment ------------------------------ */

// Function to probe server latency and adjust weight dynamically
async function monitorServerLatency() {
  for (const server of servers) {
    const start = Date.now();
    try {
      await axios.get(`${server.url}/health`, { timeout: 1000 });
      const latency = Date.now() - start;
      server.latency = latency;

      // Adjust weight inversely proportional to latency
      // (lower latency => higher effective weight)
      const adjustedWeight = Math.max(1, server.baseWeight * (100 / (latency + 1)));
      server.weight = adjustedWeight;

      console.log(
        `Latency Check: ${server.url} = ${latency}ms | Adjusted Weight = ${adjustedWeight.toFixed(2)}`
      );
    } catch (error) {
      console.error(`Latency probe failed for ${server.url}:`, error.message);
      server.active = false;
    }
  }
}

// Run latency monitoring every 10 seconds
setInterval(monitorServerLatency, 10000);

/* ------------------------------ Request Handling ------------------------------ */

app.use((req, res, next) => {
  try {
    const targetServer = getHybridServer(req.ip);
    targetServer.activeConnections++;

    console.log(
      `Routing request from ${req.ip} → ${targetServer.url}. Active: ${targetServer.activeConnections}`
    );

    proxy.web(req, res, { target: targetServer.url }, err => {
      console.error("Proxy error:", err);
      res.status(502).send("Bad Gateway");
    });

    res.on("finish", () => {
      targetServer.activeConnections = Math.max(0, targetServer.activeConnections - 1);
    });
  } catch (error) {
    console.error("Error in load balancer:", error);
    res.status(503).send("Service Unavailable");
  }
});

/* ------------------------------ Start Server ------------------------------ */

app.listen(PORT, () => {
  console.log(`🚀 Hybrid Load Balancer running on port ${PORT}`);
  monitorServerLatency(); // initial check
});
