export async function connect_plexed(
  ip,
  port,
  num_channels,
  log = console.log
) {
  let t0 = performance.now()
  const pc = new RTCPeerConnection();
  pc.oniceconnectionstatechange = (_) =>
    log(`${ip}:${port} ${pc.iceConnectionState}`);
  // pc.totalBytesSent = 0;
  // pc.totalBytesReceived = 0;
  pc.bytesReceived = 0
  pc.bytesSent = 0

  pc.resetBandwidth = () => {
    pc.send_points = []
    pc.receive_points = []
    pc.t0_receive = null
    pc.t0_send = null
  }
  pc.resetBandwidth()

  // calculate bandwith of each peerconnection
  pc.getBandwidth = async () => {
    const stats = await pc.getStats(null)
    const stat = Array.from(stats.values()).find(r => r.type === 'candidate-pair')
    const {bytesReceived, bytesSent} = stat
    return {bytesReceived, bytesSent}
  }
  pc.bandwidth = () => {
    const printBytes = async () => {
      // let bps = (pc.totalBytesReceived *8) / ((t1-t0)/1000)
      // console.log(`Node: ${port} Throughput download  ${bps/1024/1024}`)
      try {
        const {bytesReceived, bytesSent} = await pc.getBandwidth()
        let t1 = performance.now()
        if (pc.t0_receive != null) {
          const mbpsDown = ((bytesReceived - pc.bytesReceived)*8) / ((t1 - pc.t0_receive)/1000) / 1024 / 1024
          pc.receive_points.push(mbpsDown)
        }
        if (pc.t0_send != null) {
          const mbpsUp = ((bytesSent - pc.bytesSent)*8) / ((t1 - pc.t0_send)/1000) / 1024 / 1024
          pc.send_points.push(mbpsUp)
        }
      } catch (e) {
        console.log(e)
      }

      setTimeout(printBytes, 200)
    }
    printBytes()
  }
  pc.bandwidth();

  let dataChannels = [];
  for (let i = 0; i < num_channels; i++) {
    const dataChannel = pc.createDataChannel(`${port}:${i}`);
    dataChannel.binaryType = "arraybuffer";
    dataChannel.onclose = () => log(`${ip}:${port} sendChannel has closed`);
    dataChannel.onopen = () => {
      log(`${ip}:${port} sendChannel has opened`)
    };
    dataChannel.onmessage = (e) => {
      // log(`Message from ${ip}:${port} payload '${String.fromCharCode.apply(null, new Uint8Array(e.data))}'`)
    };
    dataChannel.onerror = (e) => {
      log(e);
    };
    dataChannel.bufferedAmountLowThreshold = 4096*1024;
    dataChannels.push(dataChannel);
  }
  const answer = `v=0
o=- 521628857 1575883112 IN IP4 ${ip}
s=-
t=0 0
a=fingerprint:sha-256 4D:FB:C1:3C:65:CD:81:B3:6C:82:D3:88:49:11:B1:16:DC:65:A5:08:19:64:B5:72:1C:4A:18:40:D0:20:E3:45
a=group:BUNDLE 0
a=ice-lite
m=application 9 DTLS/SCTP ${port}
c=IN IP4 ${ip}
a=setup:active
a=mid:0
a=sendrecv
a=sctpmap:${port} webrtc-datachannel 1024
a=ice-ufrag:fKVhbscsMWDGAnBg
a=ice-pwd:xGjQkAvKIVkBeVTGWcvCQtnVAeapczwa
a=candidate:foundation 1 udp 2130706431 ${ip} ${port} typ host generation 0
a=end-of-candidates
`;

  pc.onnegotiationneeded = (_) =>
    pc
      .createOffer()
      .then((d) => {
        if (!d.sdp) throw new Error("sdp must be defined");
        d.sdp = d.sdp.replace(/^a=ice-ufrag.*$/m, "a=ice-ufrag:V6j+");
        d.sdp = d.sdp.replace(
          /^a=ice-pwd.*$/m,
          "a=ice-pwd:OEKutPgoHVk/99FfqPOf444w"
        );
        void pc.setLocalDescription(d).catch((o) => log("offer err", o));
        void pc
          .setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: answer })
          )
          .catch((o) => log("answer err", o));
      })
      .catch(log);

  return {
    pc,
    dataChannels,
  };
}
export async function connect(ip, port, log = console.log) {
  const pc = new RTCPeerConnection();

  pc.oniceconnectionstatechange = (_) =>
    log(`${ip}:${port} ${pc.iceConnectionState}`);

  const dataChannel = pc.createDataChannel("foo");
  dataChannel.binaryType = "arraybuffer";
  dataChannel.onclose = () => log(`${ip}:${port} sendChannel has closed`);
  dataChannel.onopen = () => log(`${ip}:${port} sendChannel has opened`);
  dataChannel.onmessage = (e) => {
    // log(`Message from ${ip}:${port} payload '${String.fromCharCode.apply(null, new Uint8Array(e.data))}'`)
  };
  dataChannel.onerror = (e) => {
    log(e);
  };

  // dataChannel.onbufferedamountlow = e => {
  //   log(`Buffer low event ${e}`)
  // };

  const answer = `v=0
o=- 521628857 1575883112 IN IP4 ${ip}
s=-
t=0 0
a=fingerprint:sha-256 4D:FB:C1:3C:65:CD:81:B3:6C:82:D3:88:49:11:B1:16:DC:65:A5:08:19:64:B5:72:1C:4A:18:40:D0:20:E3:45
a=group:BUNDLE 0
a=ice-lite
m=application 9 DTLS/SCTP ${port}
c=IN IP4 ${ip}
a=setup:active
a=mid:0
a=sendrecv
a=sctpmap:${port} webrtc-datachannel 1024
a=ice-ufrag:fKVhbscsMWDGAnBg
a=ice-pwd:xGjQkAvKIVkBeVTGWcvCQtnVAeapczwa
a=candidate:foundation 1 udp 2130706431 ${ip} ${port} typ host generation 0
a=end-of-candidates
`;

  pc.onnegotiationneeded = (_) =>
    pc
      .createOffer()
      .then((d) => {
        if (!d.sdp) throw new Error("sdp must be defined");
        d.sdp = d.sdp.replace(/^a=ice-ufrag.*$/m, "a=ice-ufrag:V6j+");
        d.sdp = d.sdp.replace(
          /^a=ice-pwd.*$/m,
          "a=ice-pwd:OEKutPgoHVk/99FfqPOf444w"
        );
        void pc.setLocalDescription(d).catch((o) => log("offer err", o));
        void pc
          .setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: answer })
          )
          .catch((o) => log("answer err", o));
      })
      .catch(log);

  return {
    pc,
    dataChannel,
  };
}
