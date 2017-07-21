const net = require('net')
const Emitter = require('events')
const UID = require('uniqueid')
const cliUID = UID('client')
const flog = require('fancy-log')

const DNET_STATE={
  DISCONNECTED: 0,
  CONNECTING:   1,
  CONNECTED:    2,
  RECONNECTING: 3,
  LISTENING:    4
}

const ENCODING = 'utf8'
const SPLIT_CHAR = '\u001a'

let debug = true

const tool = {
  stateToString(state){
    for(const key in DNET_STATE){
      if(DNET_STATE[key]===state) return key
    }
    return undefined
  },
  parseData(data){
    data = data.toString(ENCODING).split(SPLIT_CHAR)
    data.pop()
    return data.map(d=>JSON.parse(d))
  },
  prepareEvent(ev,...args){return JSON.stringify({
    _action:'event',
    timestamp:(new Date()).getTime(),
    ev,
    args
  })+SPLIT_CHAR},
  log(...args){
    if(debug){
      flog('# DEBUG : '+args.join(' '))
    }
  }
}


// ==================================
//
//               CLIENT
//
// ==================================

class Client {
  constructor({
      srvIp='127.0.0.1',
      srvPort='1337',
      socket=undefined,
      maxTries=100,
      timeBtwTries=1000,
      onConnect=()=>{},
      onDisconnect=()=>{},
      onStateChange=()=>{},
      onClose=()=>{},
      onData=()=>{},
      onError=()=>{}
    }={}) {
    tool.log('Client:constructor')
    this.srvIp=srvIp
    this.srvPort=srvPort
    this._initSocket(socket)
    this._maxTries=maxTries
    this._timeBtwTries=timeBtwTries
    this._tries=0
    this.state=DNET_STATE.DISCONNECTED
    this._em=new Emitter()
    this._ev={
      onConnect,
      onDisconnect,
      onStateChange,
      onClose,
      onData,
      onError
    }
    this.meta={}
  }

  on(ev,callback){
    tool.log('Client:on')
    this._em.on(ev,callback)
  }

  emit(ev,...args){
    tool.log('Client:emit:'+ev)
    this._queue.add(tool.prepareEvent(ev,...args))
  }

  _tryReconnect(){
    tool.log('Client:_tryReconnect')
    this._tries++
    if(this._tries>=this._maxTries){
      this._ev.onError(new Error('Number of tries exeeded'))
    }else{
      setTimeout(()=>this.connect(),this._timeBtwTries)
    }
  }

  _initSocket(socket=new net.Socket()){
    tool.log('Client:constructor')
    this.socket=socket
    this.socket.setEncoding(ENCODING)
    this.socket.setNoDelay(false)
    this._queue=new Queue(
      (next,that,data)=>{
        this.socket.write(data,ENCODING,()=>{
          tool.log('Client:End of Write')
          next(that)
        })
      }
    )
    this.socket.on('connect',()=>{
      this._tries=0
      this._changeState(DNET_STATE.CONNECTED)
      this._ev.onConnect()
    })
    this.socket.on('close',had_error=>{
      this._changeState(DNET_STATE.DISCONNECTED)
      this._ev.onDisconnect()
      if(had_error){
        this._tryReconnect()
      }
    })
    this.socket.on('error',err=>{
      this._ev.onError(err)
      tool.log('ERROR :',err)
    })
    this.socket.on('data', data=>{
      data=tool.parseData(data)
      tool.log('Client:Socket:ondata-->'+data)
      data.forEach(d=>{
        this._ev.onData(d)
        if(d._action=='event')
          this._em.emit(d.ev,...d.args)
      })
      
    })
  }

  _changeState(state){
    tool.log('STATE CHANGE :',tool.stateToString(state))
    this.state=state
    this._ev.onStateChange(state)
  }

  connect(){
    tool.log('Client:connect')
    if(this.socket!==undefined){
      this._initSocket()
    }
    this._changeState(DNET_STATE.CONNECTING)
    this.socket.connect(this.srvPort,this.srvIp)
  }

  disconnect(){
    tool.log('Client:disconnect')
    this.socket.destroy()
  }
}

// ==================================
//
//           SERVER::Client
//
// ==================================

class ClientOfServer {
  constructor(socket,{uid=cliUID(),meta={}}={}) {
    tool.log('COS['+this.uid+']:constructor')
    this.socket=socket
    this.uid=uid
    this.meta=meta
    this._queue=new Queue(
      (next,that,data)=>{
        this.socket.write(data,ENCODING,()=>{
          tool.log('COS['+this.uid+']:End of Write')
          next(that)
        })
      }
    )
  }
  emit(ev,...args){
    if(this.socket.destroyed !== true){
      tool.log('COS['+this.uid+']:emit:'+ev)
      this._queue.add(tool.prepareEvent(ev,...args))      
    }
  }
}

// ==================================
//
//               SERVER
//
// ==================================

class Server{
  constructor({
      listenIp='0.0.0.0',
      listenPort='1337',
      onStart=()=>{},
      onStop=()=>{},
      onError=()=>{},
      onData=()=>{},
      onClientConnect=()=>{},
      onClientDisconnect=()=>{},
      onClientRemoved=()=>{},
    }={}) {
    tool.log('Server:constructor')
    this.clients={
      array:[],
      uid:{}
    }
    this.listen={
      ip:listenIp,
      port:listenPort
    }
    this._ev={
      onStart,
      onStop,
      onError,
      onData,
      onClientConnect,
      onClientDisconnect,
      onClientRemoved
    }
    this.state=DNET_STATE.DISCONNECTED
    this._em=new Emitter()
    this._initServer()
  }

  start(){
    tool.log('Server:start')
    this.server.listen(this.listen.port,this.listen.ip)
  }

  stop(){
    tool.log('Server:stop')
    this.server.close()
  }

  broadcast(
    ev,
    args,
    ignore=[]
  ) {
    tool.log('Server:broadcast')
    for(const client of this.clients.array){
      tool.log('Broadcast:'+ev,this.clients.array.map(c=>c.uid))
      if(ignore.indexOf(client)===-1){
        client.emit(ev,...args)
      }
    }
  }

  on(ev,callback){
    tool.log('Server:on')
    this._em.on(ev,callback)
  }

  bridgeEvents(evs,toEmitter=false){
    tool.log('Server:bridgeEvents')
    if(evs instanceof String) evs=[evs]
    for(const ev of evs){
      this._em.on(ev,(client,...args)=>{
        tool.log('Server:bridgeEvents:on:'+ev)
        this.broadcast(ev,args,toEmitter===true ? [] : [client])
      })
    } 
  }

  emit(client,ev,...args){
    tool.log('Server:emit')
    client.emit(ev,...args)
  }
  
  _initServer(){
    tool.log('Server:_initServer')
    this.server=net.createServer(socket=>this._addClient(socket))
    this.server.on('close',(...args)=>{
      this.state=DNET_STATE.DISCONNECTED
      this._ev.onStop(...args)
    })
    this.server.on('listening',(...args)=>{
      tool.log('Server:on:listrening')
      this.state=DNET_STATE.LISTENING
      this._ev.onStart(...args)
    })
    this.server.on('error',this._ev.onError)
  }

  _addClient(socket){
    tool.log('Server:_addClient')
    const cli = new ClientOfServer(socket)
    socket.setEncoding(ENCODING)
    socket.setNoDelay(false)
    socket.on('connect',()=>tool.log(`COS[${cli.uid}] connected`))
    socket.on('data',data=>{
      data=tool.parseData(data)
      tool.log(`COS[${cli.uid}]:socket:on:data --> `+data)
      data.forEach((d,i)=>{
        tool.log(`COS[${cli.uid}]:socket:on:data[${i}] --> [ ${d._action} , ${d.ev} , ${d.args} ]`)
        this._ev.onData(d)
        if(d._action=='event')
          this._em.emit(d.ev,cli,...d.args)
      })
    })
    socket.on('close',(...args)=>{
      tool.log(`COS[${cli.uid}]:socket:on:close (disconnected)`)
      this._ev.onClientDisconnect(cli,...args)
      this._removeClient(cli)
    })
    this.clients.uid[cli.uid]=cli
    this.clients.array.push(cli)
    this._ev.onClientConnect(cli)
  }

  _removeClient(socket){
    tool.log('Server:_removeClient')    
    const clio = (socket instanceof net.Socket)?
      this._findClient(socket):
      {client:socket,index:this.clients.array.indexOf(socket)}
    this._ev.onClientRemoved(clio.client)
    this.clients.array.splice(clio.index,1)    
    delete this.clients.uid[clio.client.uid]
    tool.log('Server:_removeClient:removed:'+clio.client.uid)    
  }

  _findClient(socket){
    tool.log('Server:_findClient')
    const cliIndex = this.clients.array.map(c=>c.socket).array.indexOf(socket)
    const cli = this.clients.array[cliIndex]
    tool.log('Server:_findClient:return:'+cli.uid)    
    return {client:cli,index:cliIndex}
  }
}


// ==================================
//
//               QUEUE
//
// ==================================


class Queue{
  constructor(action=(next,that,data)=>{next(that,data)}){
    tool.log('Queue:constructor')
    this.queue=[]
    this.action=action
    this.state=0
  }
  add(text){
    tool.log('Queue:add')
    this.queue.push(text)
    if(this.state===0){
      this._next(this)
    }
  }

  // NOTE: I don't no why i need to give "that(this)" reference... if somone has the response i accept
  _next(that){ 
    tool.log('Queue:_next')
    that.state=1
    if(that.queue.length===0){
      that.state=0
      tool.log('Queue:_next:END')
      return
    }
    let data = that.queue.splice(0,1)[0]
    tool.log('Queue:_next:data --> ',data)
    that.action(that._next,that,data)
  }
}

module.exports={
  DNET_STATE,
  tool,
  ENCODING,
  debug,
  Client,
  Server,
  ClientOfServer,
  Queue
}
