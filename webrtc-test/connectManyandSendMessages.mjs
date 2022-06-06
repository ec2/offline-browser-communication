import { expect } from "chai";
import { step } from "mocha-steps";
import { connect } from "./connect.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Size should be given in 'bytes'
function generate_static_data(size) {
  let buffer = new ArrayBuffer(size);
  let view = new Uint32Array(buffer.slice(0, 4));
  window.crypto.getRandomValues(view);
  return buffer;
}

let msgToSend = null;
let numMessages = 0;
let numConnection = 20;
let res = 0;
let peerConnAndDataChan = [];
let msgsSent = Array(numConnection).fill(0);
let t1;
let reported_data = [];

let promiseResolve, promiseReject;

let waitForDone = new Promise(function (resolve, reject) {
  promiseResolve = resolve;
  promiseReject = reject;
});

function setupMessages(numMessagesPerConn, payloadSize) {
  msgToSend = generate_static_data(payloadSize);
  numMessages = numMessagesPerConn;
}

async function sendPayloads(numMesssagesPerConn, payloadSize) {
  console.log("Start");
  setupMessages(numMesssagesPerConn, payloadSize);
  const t0 = performance.now();

  // we only send when there is space in the buffer
  const send = async (n, dc) => {
    while (msgsSent[n] < numMesssagesPerConn) {
      if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
        dc.onbufferedamountlow = () => {
          dc.onbufferedamountlow = null;
          send(n, dc);
        };
        return;
      }
      // console.log(`Node: ${n}, Msg: ${msgsSent[n]}`)
      msgsSent[n]++;
      dc.send(msgToSend);
    }
  };

  await Promise.all(
    peerConnAndDataChan.map(async (v, n) => {
      let pc = v.pc;
      let dc = v.dc;
      return send(n, dc);
    })
  );

  // wait for all the messages that we sent to be echoed back
  await waitForDone;
  // await sleep(25_000)
  console.warn(
    `Total time ${(t1 - t0).toFixed(2)}ms with average RTT ${(
      (t1 - t0) /
      (numConnection * numMesssagesPerConn)
    ).toFixed(2)}ms (avg over ${numConnection * numMesssagesPerConn} runs)`
  );
  console.log("End");
  expect(
    res,
    `sent and received ${numMessages} messages of ${msgToSend.byteLength} bytes each`
  ).to.equal(numMessages * numConnection);
  reported_data.push({
    payloadsPerPeer: numMesssagesPerConn,
    payloadSize: payloadSize,
    totalTimeRTT: (t1 - t0).toFixed(2),
    averageRTT: ((t1 - t0) / (numConnection * numMesssagesPerConn)).toFixed(2),
  });
}

describe(`connect to ${numConnection} servers and send messages`, () => {
  before(async function () {
    console.log(`Connecting to all ${numConnection} servers`);
    this.timeout(100_000);
    let peerConnections = [];
    for (let i = 0; i < numConnection; i++) {
      // remote
      // const {pc, dataChannel} = await connect('15.223.38.243', 5000+i)

      // local
      const { pc, dataChannel } = await connect("192.168.1.8", 5000 + i);
      peerConnections.push(pc);
      dataChannel.onmessage = (e) => {
        if (
          msgToSend.byteLength ==
          String.fromCharCode.apply(null, new Uint8Array(e.data)).length
        ) {
          res++;
        }
        if (res == numMessages * numConnection) {
          console.log(`Res ${res}`);
          t1 = performance.now();
          promiseResolve();
        }
      };
      peerConnAndDataChan.push({ pc: pc, dc: dataChannel });
    }
    await sleep(30000);
    peerConnections.forEach((pc, _) => {
      expect(
        pc.iceConnectionState,
        "connection state is incorrect"
      ).to.be.oneOf(["connected", "completed"]);
    });
    console.log(`Successfully connected to all ${numConnection} servers`);
  });

  beforeEach(async function () {
    res = 0;
    waitForDone = new Promise(function (resolve, reject) {
      promiseResolve = resolve;
      promiseReject = reject;
    });
    msgsSent = Array(numConnection).fill(0);
  });

  // 100 bytes

  // 0.5M
  step("send 5000 messages of size 100 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(5000, 100);
  });
  // 1M
  step("send 10000 messages of size 100 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(10000, 100);
  });
  // 4M
  step("send 40000 messages of size 100 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(40000, 100);
  });

  // 1000 bytes

  // 0.5M
  step("send 500 messages of size 1000 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(500, 1000);
  });
  // 1M
  step("send 1000 messages of size 1000 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(1000, 1000);
  });
  // 4M
  step("send 4000 messages of size 1000 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(4000, 1000);
  });

  // 2500 bytes

  // 0.5M
  step("send 200 messages of size 2500 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(200, 2500);
  });
  // 1M
  step("send 400 messages of size 2500 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(400, 2500);
  });
  // 4M
  step("send 1600 messages of size 2500 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(1600, 2500);
  });

  // 65535 bytes

  step("send 10 messages of size 65535 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(10, 65535);
  });
  step("send 20 messages of size 65535 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(20, 65535);
  });
  step("send 50 messages of size 65535 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(50, 65535);
  });
  step("send 100 messages of size 65535 bytes", async function () {
    this.timeout(600_000);
    await sendPayloads(100, 65535);
  });

  after(function () {
    console.log(
      `| Payload Size (bytes) | Num Payloads Per Peer | Total Time RTT (ms) | Average RTT (ms) |`
    );
    console.log(`|------|------|----------|-----|`);
    reported_data.forEach((v, _) => {
      console.log(
        `|${v.payloadSize}|${v.payloadsPerPeer}|${v.totalTimeRTT}|${v.averageRTT}|`
      );
    });
  });
});
