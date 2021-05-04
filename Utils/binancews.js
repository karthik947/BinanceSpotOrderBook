const Websocket = require('ws');
const events = require('events');

let binancews = {
  EE: new events(), //event emitter
  ws: '',
  switchSymbol({ symbol }) {
    if (binancews.ws) binancews.ws.terminate();
    binancews.ws = new Websocket(
      `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth`
    );
    binancews.ws.on('message', binancews.processStream);
  },
  processStream(payload) {
    const pl = JSON.parse(payload);
    binancews.EE.emit('OBUPDATES', pl);
  },
};

module.exports = binancews;
