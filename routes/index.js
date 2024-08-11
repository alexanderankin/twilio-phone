import express from "express";
import twilio from "twilio";
import { default as libphonenumber } from "google-libphonenumber";

const router = express.Router();

const PNF = libphonenumber.PhoneNumberFormat;
const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

function getValidPhone(phoneNumber) {
  try {
    // Parse number with country code and keep raw input.
    const number = phoneUtil.parseAndKeepRawInput(phoneNumber, 'US');
    const phone = phoneUtil.format(number, PNF.E164);
    // console.log(new Date(), 'validated phone number:', phone);
    return phone;
  } catch (e) {
    return null;
  }
}

const postUrl = '/sms/sms';

router.post(postUrl, async (req, res) => {
  const twTok = process.env.TWILIO_TOKEN || (() => { throw new Error('need $TWILIO_TOKEN'); })();
  const baseUrl = process.env.BASE_URL || (() => { throw new Error('need $BASE_URL'); })();
  const twUrl = new URL(postUrl, baseUrl).toString();
  const twNum = getValidPhone(process.env.TWILIO_NUMBER || (() => { throw new Error('need $TWILIO_NUMBER'); })());
  const resNums = (process.env.RESPONSE_NUMBER || (() => { throw new Error('need $RESPONSE_NUMBER'); })())
      .split(',')
      .map(getValidPhone);
  const discordWebhooks = (process.env.DISCORD_WEBHOOK_URL || '')
      .split(',')
      .filter(Boolean);

  // noinspection JSValidateTypes
  /**
   * @type {{
   *   From: string
   *   Body: string
   * }}
   */
  let params = req.body;

  let signature = req.headers['x-twilio-signature'];
  let signatureIsOk = signature === 'ok';
  let ok = signatureIsOk || twilio.validateRequest(twTok, signature, twUrl, params);

  if (!ok)
    return res.status(401).send({ error: true, err: 'Unauthorized' });

  if (/^\s{0,100}ping\s{0,100}$/i.test(params.Body)) {
    console.log(new Date(), 'twiml.message', { to: params.From, from: twNum }, 'PONG!');

    let twiml = new twilio.twiml.MessagingResponse();
    res.header('Content-type', 'text/xml');
    twiml.message({ to: params.From, from: twNum }, 'PONG!');
    return res.end(twiml.toString());
  }

  let message = params.From + ' said: ' + params.Body;
  console.log(new Date(), 'SENDING OUTGOING:', message);

  let twiml = new twilio.twiml.MessagingResponse();
  res.header('Content-type', 'text/xml');

  // don't spend on forwarding 2fa chatter
  if (
      params.Body.indexOf('Enter this verification code') > -1 ||
      params.Body.indexOf('Home Depot') > -1
  ) {
    res.end(twiml.toString());
    return;
  }

  for (let resNum of resNums) {
    twiml.message({
      to: resNum,
      from: twNum
    }, message);
  }

  Promise.allSettled(discordWebhooks.map(async function sendToDiscord(webhook) {
    let sanitizedWebhook = webhook.split('/').reverse().slice(1).reverse().join('/');
    //console.log(new Date(), 'sending to webhook:', sanitizedWebhook);
    let discordResponse = await fetch(webhook, {
      method: "POST",
      headers: { 'content-type': 'application/json', },
      body: JSON.stringify({ content: message })
    })
        // .then(v => { console.log(new Date(), "success from", sanitizedWebhook); return v; })
        .catch(e => {
          console.log(new Date(), "error from sanitizedWebhook", sanitizedWebhook, e)
          return {
            ok: false,
            status: "caught",
            async text() {
              return "";
            }
          }
        });
    let discordBody = await discordResponse.text();
    let { ok, status, url} = discordResponse;
    // sanitize url
    url = url.split('/').reverse().slice(1).reverse().join('/');

    return { discordBody, ok, status, url };
  }))
      .then((values) => {
        values.forEach(value => { if (value.status === "rejected") value.reason = value.reason?.message || value.reason });
        console.log(new Date(), 'result of sending to discord:', JSON.stringify(values));
      })

  res.end(twiml.toString());
});

/**
 * @type {import("express").ErrorRequestHandler}
 */
const errorHandler = (err, req, res, next) => {
  console.log(new Date(), 'error:', err);
  if (res.headersSent) return next(err);
  res.status(500).send({error: true, err: err?.message });
};

router.use(errorHandler);

export default router;
