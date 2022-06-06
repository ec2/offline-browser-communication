import { expect } from 'chai'
import { connect } from "./connect.mjs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

describe('connect to 20 servers and send messages', () => {
  it('connect to twenty servers and send messages', async function () {
    this.timeout(10_000)
    let peerConnections = []
    for (let i = 0 ; i<20 ; i++) {
      const {pc, dataChannel} = await connect('192.168.1.108', 5000+i)
      peerConnections.push(pc)
    }
    await sleep(3000)
    peerConnections.forEach((pc, _) => {
      expect(pc.iceConnectionState, 'connection state is incorrect').to.equal('connected')
    })
  })
})
