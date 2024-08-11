import { expect } from "chai";
import { testContext as tc } from "./setup.js";


describe('sms endpoint responses', () => {
  it('should respond with sms responses', async () => {
    let response = await fetch(`http://localhost:${tc.port}/sms/sms`, {
      method: "POST",
      headers: {
        'content-type': 'application/json',
        'x-twilio-signature': 'ok',
      },
      body: JSON.stringify({
        Body: 'hello',
        From: '+18880001234'
      })
    });

    expect(response.ok).to.be.true

    let text = await response.text();

    expect(text).to.eq('<?xml version="1.0" encoding="UTF-8"?><Response><Message to="+12349995678" from="+12349991234">+18880001234 said: hello</Message></Response>')
  });
});
