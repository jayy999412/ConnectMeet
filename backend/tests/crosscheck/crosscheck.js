// Byte-for-byte cross-check against Agora's official Node builder.
// We pin Math.random (-> salt) and Date (-> ts) so both implementations are
// deterministic and therefore directly comparable.
const FIXED_MS = 1700000000 * 1000;
const SALT = Math.floor(0.5 * 0xffffffff); // 2147483647

const RealDate = Date;
global.Date = class extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FIXED_MS);
    else super(...args);
  }
  static now() {
    return FIXED_MS;
  }
};
Math.random = () => 0.5;

const AccessToken = require('agora-access-token/src/AccessToken').AccessToken;

const APP_ID = '0123456789abcdef0123456789abcdef';
const CERT = 'fedcba9876543210fedcba9876543210';
const CHANNEL = '12345';
const UID = 42;
const EXPIRE = 1900000000;
const TS = Math.floor(FIXED_MS / 1000) + 24 * 3600;

const rtc = new AccessToken(APP_ID, CERT, CHANNEL, String(UID));
rtc.addPriviledge(1, EXPIRE); // join
rtc.addPriviledge(2, EXPIRE); // publish audio
rtc.addPriviledge(3, EXPIRE); // publish video
rtc.addPriviledge(4, EXPIRE); // publish data

const rtm = new AccessToken(APP_ID, CERT, String(UID), '');
rtm.addPriviledge(1000, EXPIRE); // rtm login

console.log(JSON.stringify({ salt: SALT, ts: TS, rtc: rtc.build(), rtm: rtm.build() }));
