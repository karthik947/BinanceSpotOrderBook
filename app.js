const log = console.log;
const express = require('express');
const app = express();
const server = app.listen(4000, () =>
  log(`Realtime Orderbook started on port 4000`)
);

//Expres Server
app.use(express.json());
app.use('/serveapi', require('./Routes/serveapi'));
app.use('/', require('./Routes/pages'));
app.get('/', (_, res) => {
  res.redirect('/home');
});

//Dependent Modules
const binancews = require('./Utils/binancews');

//Socket
const socketio = require('socket.io');
const io = socketio(server);

io.on('connection', (socket) => {
  log(`New socket connection established with id ${socket.id}`);
  socket.on('SYMBOL', (payload) => {
    binancews.switchSymbol(payload);
  });
});

//Event Emitter
binancews.EE.on('OBUPDATES', (payload) => {
  io.emit('OBUPDATES', payload);
});
