const test = require('japa')
const druid = require('./druid-net')

druid.PARAMS.debug=false

function onStart(){
  test('SERVER::Listen', assert=>{
    assert.equal(srv.state,druid.DNET_STATE.LISTENING)   
  })
}

const srv = new druid.Server({
  onStart,
})

srv.start()


