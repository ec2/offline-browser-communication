import { expect } from "chai";
import { step } from "mocha-steps";
import { connect_plexed } from "./connect.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Size should be given in 'bytes'
function generate_static_data(size) {
  let buffer = new ArrayBuffer(size);
  let view = new Uint32Array(buffer.slice(0, 4));
  window.crypto.getRandomValues(view);
  return buffer;
}


function percentile(arr, p) {
  if (arr.length === 0) return 0;
  if (typeof p !== 'number') throw new TypeError('p must be a number');
  if (p <= 0) return arr[0];
  if (p >= 1) return arr[arr.length - 1];

  var index = (arr.length - 1) * p,
      lower = Math.floor(index),
      upper = lower + 1,
      weight = index % 1;

  if (upper >= arr.length) return arr[lower];
  return arr[lower] * (1 - weight) + arr[upper] * weight;
}

let msgToSend = null;
let numMessages = 0;
let numConnection = 1;
let res = 0;
let peerConnAndDataChan = [];
let t1;
let reported_data = [];
const num_data_channels = 1;

// let msgsSent = Array(numConnection).fill(Array(num_data_channels).fill(0));
let msgsSent = Array.from({ length: numConnection }, (v, k) =>
  Array(num_data_channels).fill(0)
);
let interval = setInterval(() => {
  // console.log(peerConnAndDataChan.map(({dcs}) => dcs.map(dc => dc.bufferedAmount)).flat())
  console.log(peerConnAndDataChan.map(({pc}) => pc.iceConnectionState))
}, 10_000)

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
  const send = async (i_nodes, i_dc, dc) => {
    // while(msgsSent[i_nodes][i_dc] != numMesssagesPerConn) {
      if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
        // console.log(`Buffered hit on Node: ${i_nodes}, Chan: ${i_dc}`);
        await new Promise((resolve, reject) => {
          let id
          const onBufferedAmountLow = () => {
            dc.onbufferedamountlow = null;
            clearTimeout(id)
            resolve(send(i_nodes, i_dc, dc));
          };
          const onTimeout = () => {
            dc.onBufferedAmountLow = null
            console.log(`channel state ${dc.readyState}`)
            reject(new Error(`Timed out: ${i_nodes}, ${i_dc}, ${dc.bufferedAmount}, ${dc.bufferedAmountLowThreshold}`))
          }
          id = setTimeout(onTimeout, 10000)
          dc.onbufferedamountlow = onBufferedAmountLow
        });
        return;
      }
      msgsSent[i_nodes][i_dc]++;
      // console.log(msgsSent)
      // console.log(
      //   `Node: ${i_nodes}, Chan: ${i_dc}, Msg: ${msgsSent[i_nodes][i_dc]}`
      // );
      await dc.send(msgToSend);
    // }
  };


  let id_dc = 0;
  let id_node = 0;
  let i = 0;
  
  while (i != (numConnection * num_data_channels * numMesssagesPerConn)) {
    if (id_node == numConnection) {
      id_node = 0
      id_dc ++
      if (id_dc == num_data_channels) {
        id_dc = 0
      }
      // console.log(`id_dc: ${id_dc}`)
    }
    let { pc, dcs } = peerConnAndDataChan[id_node]; 
    if (pc.t0_send == null) {
      pc.t0_send = performance.now()
      pc.bytesSent = (await pc.getBandwidth()).bytesSent
    }
    await send(id_node, id_dc, dcs[id_dc])
    id_node++
    i++
  }

  // console.log(msgsSent);
  console.log("waiting for done");
  // await Promise.all(sends)

  // wait for all the messages that we sent to be echoed back
  await waitForDone;
  clearInterval(interval)
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
  ).to.equal(numMessages * numConnection * num_data_channels);
  const mbps = (key) => {
    const mbpsUpPerPc = peerConnAndDataChan.map(({pc}) =>
      pc[key].reduce((prev, curr) => prev + curr, 0) / pc[key].length).sort(function(a, b){return a-b})
    console.log('sorted ', mbpsUpPerPc)
    return {
      _50th: percentile(mbpsUpPerPc, 0.5),
      _95th: percentile(mbpsUpPerPc, 0.95),
    }
  }
  reported_data.push({
    payloadsPerPeer: numMesssagesPerConn,
    payloadSize: payloadSize,
    totalTimeRTT: (t1 - t0).toFixed(2),
    averageRTT: ((t1 - t0) / (numConnection * numMesssagesPerConn)).toFixed(2),
    mbpsUp: mbps('send_points'),
    mbpsDown: mbps('receive_points'),
  });
}

describe(`connect to ${numConnection} servers and send messages`, () => {
  before(async function () {
    console.log(`Connecting to all ${numConnection} servers`);
    this.timeout(100_000);
    let peerConnections = [];
    for (let i = 0; i < numConnection; i++) {
      // remote
      const { pc, dataChannels } = await connect_plexed(
        "15.223.38.243",
        5000 + i,
        num_data_channels
      );
      // local
      // const { pc, dataChannels } = await connect_plexed(
      //   "192.168.51.254",
      //   5000 + i,
      //   num_data_channels
      // );
      peerConnections.push(pc);
      pc.resetBandwidth();
      dataChannels.forEach((v, i) => {
        v.onmessage = async (e) => {
          if (pc.t0_receive == null){
            pc.t0_receive = performance.now()
            pc.bytesReceived = (await pc.getBandwidth()).bytesReceived
          }
          
          if (
            msgToSend.byteLength ==
            String.fromCharCode.apply(null, new Uint8Array(e.data)).length
          ) {
            pc.totalBytesReceived += msgToSend.byteLength
            // console.log(`Message received number: ${res}`);
            res++;
          }
          if (res == numMessages * numConnection * num_data_channels) {
            // console.log(`Res ${res}`);
            t1 = performance.now();
            promiseResolve();
          }
        };
      });
      peerConnAndDataChan.push({ pc: pc, dcs: dataChannels });
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
    msgsSent = Array.from({ length: numConnection }, (v, k) =>
      Array(num_data_channels).fill(0)
    );
    peerConnAndDataChan.map(({pc}) => {
      console.log('pc.send_points', pc.send_points)
      console.log('pc.receive_points', pc.receive_points)
      pc.resetBandwidth()
    })
  });

// Measuring Ping
[
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 100},
  {msgCount: 1, msgSize: 800},
  {msgCount: 1, msgSize: 800},
  {msgCount: 1, msgSize: 800},
  {msgCount: 1, msgSize: 800},
  {msgCount: 1, msgSize: 800},
  {msgCount: 1, msgSize: 800},
  {msgCount: 1, msgSize: 1500},
  {msgCount: 1, msgSize: 1500},
  {msgCount: 1, msgSize: 1500},
  {msgCount: 1, msgSize: 1500},
  {msgCount: 1, msgSize: 1500},
  {msgCount: 1, msgSize: 1500},
  {msgCount: 1, msgSize: 3000},
  {msgCount: 1, msgSize: 3000},
  {msgCount: 1, msgSize: 3000},
  {msgCount: 1, msgSize: 3000},
  {msgCount: 1, msgSize: 3000},
  {msgCount: 1, msgSize: 3000},
  {msgCount: 1, msgSize: 3000},
  {msgCount: 1, msgSize: 6000},
  {msgCount: 1, msgSize: 6000},
  {msgCount: 1, msgSize: 6000},
  {msgCount: 1, msgSize: 6000},
  {msgCount: 1, msgSize: 6000},
  {msgCount: 1, msgSize: 6000},
  {msgCount: 1, msgSize: 6000},
  {msgCount: 1, msgSize: 6000},
  {msgCount: 1, msgSize: 12000},
  {msgCount: 1, msgSize: 12000},
  {msgCount: 1, msgSize: 12000},
  {msgCount: 1, msgSize: 12000},
  {msgCount: 1, msgSize: 12000},
  {msgCount: 1, msgSize: 12000},
  {msgCount: 1, msgSize: 12000},
  {msgCount: 1, msgSize: 12000},
  {msgCount: 1, msgSize: 12000},
].forEach(({msgCount, msgSize}) => {
  step(`send ${msgCount} messages of size ${msgSize} bytes`, async function () {
    // messageSize = msgSize;
    this.timeout(2_400_000);
    await sendPayloads(msgCount, msgSize);
  });
})



  after(function () {
    // msgSize => []rtt
    const msgTypes = new Map()
    reported_data.forEach(data => {
      let rtts = msgTypes.get(data.payloadSize)
      if (!rtts) {
        rtts = []
        msgTypes.set(data.payloadSize, rtts)
      }
      rtts.push(data.totalTimeRTT)
    })

    console.log(
      `| Payload Size (bytes) | RTT (p50) |  RTT (p95) |`
    );
    console.log(`|------|------|----------|-----|-----|-----|`);
    for (const [msgSize, rtts] of msgTypes.entries()) {
      rtts.sort((a, b) => a - b)
      // p50
      const p50 = percentile(rtts, 0.5)
      // p95
      const p95 = percentile(rtts, 0.95)
      
      console.log(`${msgSize} | ${p50} | ${p95}`)
    } 
  });
});
