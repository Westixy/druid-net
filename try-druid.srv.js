const druid = require('./druid-net.js')

druid.PARAMS.debug=true

const server = new druid.Server()

server.on('helloSrv',(client,data)=>{
  client.emit('helloWorld',`Hello ${data.myName} !`)
  server.clients.uid[client.uid].emit('helloFromUid','Bitch')
  server.clients.uid[client.uid].emit('helloFromUid','Bitch','and some')
})

server.on('heyEveryoneWE',(client,...data)=>{
  server.broadcast('aBroadcastWE',data) // With Emitter
})

server.on('heyEveryone',(client,...data)=>{
  server.broadcast('aBroadcast',data,[client]) // Without Emitter
})

server.bridgeEvents(['bridgeEventWE'],true) // with emitter

server.bridgeEvents(['bridgeEvent']) // without emitter

server.start()
