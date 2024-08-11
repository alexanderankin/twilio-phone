import http from "node:http";

import app from "../app.js";

export const testContext = {
  /**
   * @type http.Server | null
   */
  server: null,
  get port() {
    return this.server?.address().port
  }
};

before(async function setup() {
  let server = http.createServer(app);
  testContext.server = server;
  await new Promise(r => server.listen(0, null, 500, () => r()));

  process.env.TWILIO_TOKEN = 'TWILIO_TOKEN';
  process.env.BASE_URL = `http://localhost:${testContext.port}`;
  process.env.TWILIO_NUMBER = `+12349991234`;
  process.env.RESPONSE_NUMBER = `+12349995678`;
});

after(async function tearDown() {
  if (testContext.server) {
    await new Promise((r, j) => {
      testContext.server.close(e => e ? j(e) : r());
    });
  }
});
