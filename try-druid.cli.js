const druid = require('./druid-net.js')

druid.PARAMS.debug=true

const client = new druid.Client({
  maxTries:20
})

client.event.on('connect',()=>{
  console.log(`Client connected to ${client.srvIp}:${client.srvPort}`)
  client.emit('helloSrv',{myName:'The Best client of the year'})
  client.emit('helloSrv',{myName:'The Best client of the year'},'and some')
  client.emit('heyEveryoneWE','Hello guys (and me)')
  client.emit('heyEveryoneWE','Hello guys (and me)','and some')
  client.emit('heyEveryone','Hello guys')
  client.emit('bridgeEventWE','Bridge Event (and me)')
  client.emit('bridgeEvent','Bridge Event')
  client.emit('bridgeEventWE','Bridge Event','and some')
})

//client.event.on('error',druid.tool.log)

client.event.on('disconnect',()=>{
  console.log('Client disconnected')
})

client.event.on('state_change',(state, state_str)=>{
  console.log('stateChanged to',state,':',state_str)
})

client.on('helloWorld',console.log)
client.on('helloFromUid',console.log)
client.on('aBroadcastWE',console.log)
client.on('aBroadcast',console.log)
client.on('bridgeEventWE',console.log)
client.on('bridgeEvent',console.log)

client.connect()
