# Hybrid Load Balancer

A small HTTP load balancer in Node.js that picks a backend per request by combining three
strategies: **weighted least connections**, **IP-hash stickiness** and a **round-robin fallback**.
Backend weights adapt to measured latency, and unhealthy backends are taken out of rotation.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)
![Express](https://img.shields.io/badge/Express-4-black)
![License](https://img.shields.io/badge/license-ISC-blue)

## How a backend is chosen

For every request, `getHybridServer(clientIp)` in [`load-balancer.js`](load-balancer.js):

1. **Filters to healthy backends.** If none are healthy, the request gets `503`.
2. **Finds the least-loaded backend** by the ratio `activeConnections / weight`.
3. **Tries IP-hash stickiness.** The client IP is hashed (MD5) to a preferred backend. That
   backend is used if its load ratio is within **20%** of the best one, so a client keeps hitting
   the same server unless it is noticeably busier.
4. **Falls back to round robin** across all backends whose load ratio is within **10%** of the
   best, spreading traffic evenly when several servers are equally free.
5. Otherwise it uses the least-loaded backend.

Active connections are incremented when a request is proxied and decremented when the
response finishes.

## Latency-aware weights and health checks

Every **10 seconds** each backend's `/health` endpoint is probed (1 s timeout):

- The measured latency adjusts the backend's effective weight:
  `weight = max(1, baseWeight × 100 / (latency + 1))`, so faster backends receive more traffic.
- A backend whose probe fails is marked unhealthy and skipped. It is brought back as soon as a
  later probe succeeds.

## Architecture

```
            clients
               │
               ▼
   ┌───────────────────────┐
   │  Load balancer :8000  │  weighted least-connections
   │  (Express + http-proxy)│  + IP hash + round robin
   └───────────┬───────────┘
      ┌────────┼────────┐        health probe every 10 s
      ▼        ▼        ▼        adjusts weights by latency
   :3001     :3002     :3003
  (w=100)   (w=24)    (w=10)
```

## Run it locally

Requires Node.js 18+.

```bash
git clone https://github.com/naksh1414/Load_Balancer.git
cd Load_Balancer
npm install

# start three example backends (separate terminals)
PORT=3001 node server.js
PORT=3002 node server.js
PORT=3003 node server.js

# start the load balancer on :8000
node load-balancer.js
```

Then send requests to `http://localhost:8000/` and watch the logs show which strategy chose
each backend.

## Tests and metrics

With the backends and load balancer running:

```bash
npx mocha test_load_balancer.js   # checks requests are distributed across backends
npm run metrics                     # latency / throughput / error-rate score
```

## Project structure

| File | Purpose |
| --- | --- |
| `load-balancer.js` | Selection algorithm, health checks, proxying |
| `server.js` | Example backend with `/` and `/health` |
| `test_load_balancer.js` | Mocha test for request distribution |
| `runMetricsTest.js` | Simple latency and throughput scoring script |

## Possible next steps

- Configure backends from environment or a service registry instead of a fixed list
- Per-client rate limiting backed by Redis
- Containerise with Docker Compose for one-command startup
- Concurrent load testing (e.g. autocannon or k6) for realistic throughput numbers

## Author

Nakshatra Manglik · [nakshatramanglik14@gmail.com](mailto:nakshatramanglik14@gmail.com) ·
[GitHub](https://github.com/naksh1414)
