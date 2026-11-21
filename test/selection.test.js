const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const {
  BackendServer,
  servers,
  getHybridServer,
  monitorServerLatency,
  ipHash,
} = require("../load-balancer");

// Replace the backend pool for each test.
function useServers(list) {
  servers.splice(0, servers.length, ...list);
}

function backend(name, weight, activeConnections = 0) {
  const s = new BackendServer(`http://${name}`, weight);
  s.activeConnections = activeConnections;
  return s;
}

// Silence the balancer's routing logs during tests.
beforeEach(() => {
  console.log = () => {};
  console.error = () => {};
});

test("picks the backend with the lowest connections-to-weight ratio", () => {
  const a = backend("a", 100, 50); // 0.5
  const b = backend("b", 10, 1);   // 0.1  <- least loaded relative to capacity
  const c = backend("c", 10, 9);   // 0.9
  useServers([a, b, c]);

  assert.equal(getHybridServer(), b);
});

test("skips unhealthy backends", () => {
  const a = backend("a", 100, 50);
  const b = backend("b", 10, 1);
  const c = backend("c", 10, 9);
  b.active = false;
  useServers([a, b, c]);

  assert.equal(getHybridServer(), a);
});

test("throws when no backend is healthy", () => {
  const a = backend("a", 10);
  const b = backend("b", 10);
  a.active = false;
  b.active = false;
  useServers([a, b]);

  assert.throws(() => getHybridServer(), /No healthy backend/);
});

test("round-robins across equally loaded backends", () => {
  const a = backend("a", 10);
  const b = backend("b", 10);
  useServers([a, b]);

  const picked = new Set([getHybridServer(), getHybridServer()]);
  assert.equal(picked.size, 2, "two consecutive requests should go to different backends");
});

test("keeps a client on the same backend (IP-hash stickiness)", () => {
  const pool = [backend("a", 10), backend("b", 10), backend("c", 10)];
  useServers(pool);
  const ip = "203.0.113.7";

  const first = getHybridServer(ip);
  assert.equal(first, pool[ipHash(ip) % pool.length]);
  for (let i = 0; i < 5; i++) {
    assert.equal(getHybridServer(ip), first);
  }
});

test("moves a client off its sticky backend when that backend is much busier", () => {
  const idle = backend("idle", 10, 0);
  const busy = backend("busy", 10, 5);
  useServers([idle, busy]);

  // Find a client IP that hashes to the busy backend (index 1).
  let ip;
  for (let i = 0; i < 1000; i++) {
    if (ipHash(`10.0.0.${i}`) % 2 === 1) {
      ip = `10.0.0.${i}`;
      break;
    }
  }
  assert.ok(ip, "expected to find an IP that maps to the busy backend");

  assert.equal(getHybridServer(ip), idle);
});

test("health check marks a failing backend unhealthy and brings it back when it recovers", async () => {
  const originalGet = axios.get;
  const s = backend("flaky", 10);
  useServers([s]);

  try {
    axios.get = async () => {
      throw new Error("connection refused");
    };
    await monitorServerLatency();
    assert.equal(s.active, false);

    axios.get = async () => ({ status: 200 });
    await monitorServerLatency();
    assert.equal(s.active, true);
    assert.ok(s.weight > s.baseWeight, "a fast backend should get a higher effective weight");
  } finally {
    axios.get = originalGet;
  }
});
