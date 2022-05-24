import { expect } from 'chai'
import { connect } from "./connect.mjs";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

describe('connect to one server', () => {
  it('connect to one server', async function () {
    this.timeout(10_000)
    const {pc, dataChannel} = await connect('0.0.0.0', 5000)
    await sleep(3000)
    expect(pc.connectionState, 'connection state is incorrect').to.equal('connected')
  })
})
