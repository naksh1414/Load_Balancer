const express = require("express");
const httpProxy = require("http-proxy");
const crypto = require("crypto");
const http = require("http");

const app = express();
const proxy = httpProxy.createProxyServer();
const PORT = 8000;

// --- Optimized kernel-level TCP & connection pooling ---
const agent = new http.Agent({
  keepAlive: true,            // Reuse sockets to reduce handshake overhead
  keepAliveMsecs: 60000,      // Keep sockets alive for 60s
  maxSockets: 1000,           // Max concurrent sockets per target
  maxFreeSockets: 256,        // Max idle sockets to retain
  timeout: 60000,             // Socket timeout
  noDelay: true               // Disable Nagle’s algorithm for low-latency
});

// backend server class
class BackendServer {
  constructor(url, weight = 1) {
    this.url = url;
    this.weight = weight;
    this.activeConnections = 0;
    this.active = true; 
  }
}

// Backend servers
let servers = [
  new BackendServer("http://localhost:3001", 100),
  new BackendServer("http://localhost:3002", 24),
  new BackendServer("http://localhost:3003", 10)
];

let roundRobinIndex = 0;

function ipHash(ip) {
  const hash = crypto.createHash("md5").update(ip).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

// --- Hybrid load selection logic ---
function getHybridServer(clientIp) {
  const healthyServers = servers.filter(s => s.active);
  if (healthyServers.length === 0) {
    throw new Error("No healthy backend servers available");
  }

  let bestServer = healthyServers[0];
  let bestRatio = bestServer.activeConnections / bestServer.weight;

  healthyServers.forEach(server => {
    const ratio = server.activeConnections / server.weight;
    if (ratio < bestRatio) {
      bestServer = server;
      bestRatio = ratio;
    }
  });

  if (clientIp) {
    const hash = ipHash(clientIp);
    const candidateIndex = hash % healthyServers.length;
    const candidate = healthyServers[candidateIndex];
    const candidateRatio = candidate.activeConnections / candidate.weight;

    if (candidateRatio <= bestRatio * 1.2) {
      console.log(`Hybrid: Using IP-hash candidate ${candidate.url}`);
      return candidate;
    }
  }

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

// --- Middleware for proxying requests ---
app.use((req, res) => {
  try {
    const targetServer = getHybridServer(req.ip);
    targetServer.activeConnections++;
    console.log(`Routing request from ${req.ip} to ${targetServer.url}. Active: ${targetServer.activeConnections}`);

    proxy.web(
      req,
      res,
      { target: targetServer.url, agent },
      err => {
        console.error("Proxy error:", err);
        res.status(502).send("Bad Gateway");
      }
    );

    res.on("finish", () => {
      targetServer.activeConnections = Math.max(0, targetServer.activeConnections - 1);
    });
  } catch (error) {
    console.error("Error in load balancer:", error);
    res.status(503).send("Service Unavailable");
  }
});

app.listen(PORT, () => {
  console.log(`Hybrid Load Balancer running on port ${PORT}`);
  console.log("TCP and connection pooling optimizations enabled.");
});
