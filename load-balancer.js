const express = require("express");
const httpProxy = require("http-proxy");
const crypto = require("crypto");

const app = express();
const proxy = httpProxy.createProxyServer();
const PORT = 8000;

// backend server class with weight and active connection count
class BackendServer {
  constructor(url, weight = 1) {
    this.url = url;
    this.weight = weight;
    this.activeConnections = 0;
    this.active = true; 
  }
}

// Sample backend server list
let servers = [
  new BackendServer("http://localhost:3001", 100), 
  new BackendServer("http://localhost:3002", 24),
  new BackendServer("http://localhost:3003", 10)
];

let roundRobinIndex = 0;

// Simple hash function based on crypto for client IP
function ipHash(ip) {

  // Create a hash value and convert it to a number
  const hash = crypto.createHash("md5").update(ip).digest("hex");
  return parseInt(hash.slice(0, 8), 16);

}

// Hybrid algorithm
function getHybridServer(clientIp) {
  
  const healthyServers = servers.filter(s => s.active);
  if (healthyServers.length === 0) {
    throw new Error("No healthy backend servers available");
  }

  // Calculate weighted load (activeConnections / weight) for each server
  let bestServer = healthyServers[0];
  let bestRatio = bestServer.activeConnections / bestServer.weight;

  healthyServers.forEach(server => {
    const ratio = server.activeConnections / server.weight;
    if (ratio < bestRatio) {
      bestServer = server;
      bestRatio = ratio;
    }
  });

  // If client IP is provided, calculate candidate using IP hash
  
  if (clientIp) {
    const hash = ipHash(clientIp);
    const candidateIndex = hash % healthyServers.length;
    const candidate = healthyServers[candidateIndex];
    const candidateRatio = candidate.activeConnections / candidate.weight;

    // If the candidate's load is within 20% of the best server's load, use it
    if (candidateRatio <= bestRatio * 1.2) {
      console.log(`Hybrid: Using IP-hash candidate ${candidate.url}`);
      return candidate;
    }
  }

  // Fallback: if multiple servers have similar load, use round robin
  // Find all servers with a ratio within 10% of bestRatio
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

// Middleware to forward requests with our hybrid algorithm
app.use((req, res, next) => {
  try {
    // Use req.ip as client identifier (Express sets this based on request)
    const targetServer = getHybridServer(req.ip);
    // Increment active connections for the selected server
    targetServer.activeConnections++;
    console.log(`Routing request from ${req.ip} to ${targetServer.url}. Active connections: ${targetServer.activeConnections}`);

    // Proxy the request to the target server
    proxy.web(req, res, { target: targetServer.url }, err => {
      console.error("Proxy error:", err);
      res.status(502).send("Bad Gateway");
    });

    // When response is finished, decrement active connections
    res.on("finish", () => {
      targetServer.activeConnections = Math.max(0, targetServer.activeConnections - 1);
    });
  } catch (error) {
    console.error("Error in load balancer:", error);
    res.status(503).send("Service Unavailable");
  }
});

// Start the load balancer
app.listen(PORT, () => {
  console.log(`Hybrid Load Balancer running on port ${PORT}`);
});
