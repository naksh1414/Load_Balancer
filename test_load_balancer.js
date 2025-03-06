const axios = require("axios");
const { assert } = require("chai");

const LOAD_BALANCER_URL = "http://localhost:8000/";

// Helper function to send a GET request
async function sendRequest() {
  try {
    const response = await axios.get(LOAD_BALANCER_URL);
    return response.data;
  } catch (error) {
    throw new Error("Request failed: " + error.message);
  }
}

describe("Hybrid Load Balancer Distribution", function () {
  // Increase timeout for async operations if needed
  this.timeout(30000);

  it("should distribute load among backend servers", async function () {
    const totalRequests = 100; // You can increase this number for more rigorous testing
    const responses = [];
    
    // Send requests concurrently
    for (let i = 0; i < totalRequests; i++) {
      responses.push(sendRequest());
    }
    
    const results = await Promise.all(responses);
    
    // Count the responses by backend identifier (assumes backend returns something like "Response from server on port XXXX")
    const distribution = {};
    
    results.forEach((data) => {
      const match = data.match(/port (\d+)/);
      if (match && match[1]) {
        const port = match[1];
        distribution[port] = (distribution[port] || 0) + 1;
      }
    });
    
    console.log("Request distribution among backend servers:", distribution);
    
    // Assert that requests are distributed across at least two different servers.
    // You can adjust this check based on your expected distribution.
    assert.isAtLeast(Object.keys(distribution).length, 2, "Requests should be distributed to at least 2 servers");

    // Optionally, you can add further checks for minimum request counts per server.
    Object.keys(distribution).forEach(port => {
      assert.isAbove(distribution[port], 0, `Server on port ${port} should have received requests`);
    });
  });
});
