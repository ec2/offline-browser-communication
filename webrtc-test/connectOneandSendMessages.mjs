import { expect } from "chai";
import { connect } from "./connect.mjs";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Size should be given in 'bytes'
function generate_static_data(size) {
  return new ArrayBuffer(size);
}

describe("connect to one server", () => {
  let peerConn;
  let dataChan;
  let res = 0;
  let msgToSend = generate_static_data(65535);
  let numMessages = 100;
  let t1;
  before(async function () {
    this.timeout(10_000);
    const { pc, dataChannel } = await connect("192.168.1.108", 5000);
    await sleep(3000);
    expect(pc.iceConnectionState, "connection state is incorrect").to.equal(
      "connected"
    );
    peerConn = pc;
    dataChan = dataChannel;

    dataChannel.onmessage = (e) => {
      // console.log(`got message: ${new Uint8Array(e.data).length}`)
      if (
        msgToSend.byteLength ==
        String.fromCharCode.apply(null, new Uint8Array(e.data)).length
      ) {
        res++;
      }
      if (res == numMessages) {
        t1 = performance.now();
      }
      // log(`Message from ${ip}:${port} payload '${String.fromCharCode.apply(null, new Uint8Array(e.data))}'`)
    };
  });

  it("send messages", async function () {
    this.timeout(10000);
    var threshold = dataChan.bufferedAmountLowThreshold;
    console.log(`Data Channel threahold: ${threshold}`);

    const t0 = performance.now();
    for (let i = 0; i < numMessages; i++) {
      dataChan.send(msgToSend);
    }

    await sleep(3000);
    console.warn(
      `${((t1 - t0) / numMessages).toFixed(2)}ms (avg over ${numMessages} runs)`
    );

    expect(
      res,
      `sent and received ${numMessages} messages of ${msgToSend.byteLength} bytes each`
    ).to.equal(numMessages);
    let stats = await peerConn.getStats();
    stats.forEach((report) => {
      Object.keys(report).forEach((statName) => {
        // if (statName == "totalRoundTripTime"||statName == "currentRoundTripTime" || statName == "bytesSent" || statName == "bytesReceived"  ) {
        console.log(`${statName} ${report[statName]}`);
        // }
      });
      console.log();
    });
  });
});
