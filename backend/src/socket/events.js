module.exports = function configurarSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    socket.on('unirse_local', (local_id) => {
      socket.join(`local_${local_id}`);
      console.log(`📍 Socket ${socket.id} unido al local ${local_id}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
  });
};
