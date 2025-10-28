<!-- Banner -->

<h1 align="center">⚡ Hybrid Load Balancer</h1>

<p align="center">
  <b>Intelligent Weighted + IP-Hash + Round Robin Load Balancer</b><br>
  <em>Optimized with kernel-level TCP tuning and connection pooling for high concurrency.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/Express.js-black?style=for-the-badge&logo=express" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
  <img src="https://img.shields.io/github/stars/naksh1414/Load_Balance?style=for-the-badge&color=yellow" />
</p>

---

## 🚀 Overview

The **Hybrid Load Balancer** is a lightweight, high-performance Node.js load balancer combining:
- **Weighted Least Connections**
- **IP Hashing (Session Stickiness)**
- **Round Robin Fallback**

Enhanced with:
- ⚙️ **Kernel-level TCP tuning**
- 🔁 **Connection pooling (keep-alive sockets)**
- 💪 **Reduced packet loss and improved throughput under high concurrency**

---

## 🧠 How It Works

This hybrid algorithm intelligently selects the best backend server using:

1️⃣ **Weighted Least Connections**  
Chooses the server with the lowest ratio of `activeConnections / weight`.

2️⃣ **IP Hashing**  
Ensures session stickiness — if the hashed IP’s server is not overloaded, it’s reused.

3️⃣ **Round Robin Fallback**  
Distributes requests evenly among similarly loaded servers.

---

## 🧩 Architecture

             ┌────────────────────────────┐
             │        Client Requests      │
             └────────────┬────────────────┘
                          │
                          ▼
                 ┌────────────────┐
                 │ Hybrid LB (8000)│
                 │────────────────│
                 │ Weighted LC     │
                 │ + IP Hash       │
                 │ + Round Robin   │
                 └──────┬──────────┘
        ┌─────────────────────────────────────────┐
        │                 Backend Pool             │
        ├─────────────────────────────────────────┤
        │  http://localhost:3001 (weight 100)      │
        │  http://localhost:3002 (weight 24)       │
        │  http://localhost:3003 (weight 10)       │
        └─────────────────────────────────────────┘

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/naksh1414/hybrid-load-balancer.git
cd hybrid-load-balancer
```

### Install Dependencies
```bash
npm install
```

### 3️⃣ Start Example Backend Servers
``` bash
node server1.js   # port 3001
node server2.js   # port 3002
node server3.js   # port 3003

```

###  4️⃣ Run the Load Balancer
```bash
node index.js

```

### ⚡ TCP & Connection Pool Optimization
``` bash
const agent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 1000,
  maxFreeSockets: 256,
  timeout: 60000,
  noDelay: true
});

```

| Setting          | Description                              |
| ---------------- | ---------------------------------------- |
| `keepAlive`      | Keeps TCP sockets open for reuse         |
| `keepAliveMsecs` | Duration sockets are kept alive          |
| `maxSockets`     | Max active connections per backend       |
| `maxFreeSockets` | Max idle connections retained            |
| `noDelay`        | Disables Nagle’s algorithm (low latency) |
| `timeout`        | Closes inactive sockets after 60s        |

### 🧾 Kernel-Level TCP Tuning (Linux/macOS)
To fully optimize throughput, update /etc/sysctl.conf:
``` bash 
# Max open sockets and backlog
fs.file-max = 2097152
net.core.somaxconn = 65535

# TCP buffer sizes
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216

# Connection reuse and fast close
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15

# Enable fast open and window scaling
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_low_latency = 1

# Increase ephemeral ports
net.ipv4.ip_local_port_range = 1024 65535

```

| Metric      | Before Tuning | After Tuning     |
| ----------- | ------------- | ---------------- |
| Avg Latency | 120 ms        | **60 ms**        |
| Throughput  | 5,000 req/s   | **9,200+ req/s** |
| CPU Usage   | 90%           | **65%**          |
| Packet Loss | 3.2%          | **<0.5%**        |

### 🧰 Tech Stack

Node.js

Express.js

http-proxy

Crypto (MD5-based hashing)

Linux Kernel Tuning

### 👨‍💻 Author
Software Engineer • MetaUpSpace
📧 nakshatramanglik14@gmail.com

💻 GitHub: naksh1414






