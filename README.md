# Druid-net

Simple node TCP-IP event manager

## Getting started

Server :
```js
const {Server} = require('druid-net')
const server = new Server()

server.on('anEvent',(client,data)=>{
    // dont send to emitter
    server.broadcast('anEvent',[data],[client])
    // send to emitter
    server.broadcast('anEvent',[data],)
    
})
// or do the same :
server.bridgeEvent('anEvent') // dont send to emitter
server.bridgeEvent('anEvent',true) // send to emitter

server.start() 
```

Client :
```js
const {Client} = require('druid-net')
const client = new Client()

// emit some
client.emit('anEvent',{some:'data'})
// recive some
client.on('anEvent',(data)=>{
    // do what to do width data
})

client.connect()
```

## TODO

- add some hooks for the clients of server
- fix the client tryreconnect
- fix the client disconnect
- implements tests
- add some comments :D
- do the entire documentation :D