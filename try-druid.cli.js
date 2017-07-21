const druid = require('./druid-net.js')

const client = new druid.Client({
  onConnect(){
    console.log(`Client connected to ${client.srvIp}:${client.srvPort}`)
    client.emit('helloSrv',{myName:'The Best client of the year'})
    client.emit('helloSrv',{myName:'The Best client of the year'},'and some')
    client.emit('heyEveryoneWE','Hello guys (and me)')
    client.emit('heyEveryoneWE','Hello guys (and me)','and some')
    client.emit('heyEveryone','Hello guys')
    client.emit('bridgeEventWE','Bridge Event (and me)')
    client.emit('bridgeEvent','Bridge Event')
    client.emit('bridgeEventWE','Bridge Event','and some')
  },
  onDisconnect(){
    console.log('Client disconnected')
  },
  onStateChange(state){
    console.log('stateChanged to',druid.tool.stateToString(state))
  }
})

client.on('helloWorld',console.log)
client.on('helloFromUid',console.log)
client.on('aBroadcastWE',console.log)
client.on('aBroadcast',console.log)
client.on('bridgeEventWE',console.log)
client.on('bridgeEvent',console.log)

client.connect()



setTimeout(()=>client.disconnect(),20000)