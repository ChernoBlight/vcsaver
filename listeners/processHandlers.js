module.exports = [
  {
    emitter: process,
    name: 'unhandledRejection',
    execute(error) {
      console.error('Unhandled Rejection:', error);
    },
  },
  {
    emitter: process,
    name: 'uncaughtException',
    execute(error) {
      console.error('Uncaught Exception:', error);
    },
  },
  {
    emitter: process,
    name: 'SIGINT',
    execute() {
      const runtime = require('../utils/runtime');
      for (const key of [...runtime.activeSessions.keys()]) {
        const [guildId, userId] = key.split(':');
        runtime.endSession(guildId, userId);
      }
      runtime.saveVcData();
      process.exit(0);
    },
  },
  {
    emitter: process,
    name: 'SIGTERM',
    execute() {
      const runtime = require('../utils/runtime');
      for (const key of [...runtime.activeSessions.keys()]) {
        const [guildId, userId] = key.split(':');
        runtime.endSession(guildId, userId);
      }
      runtime.saveVcData();
      process.exit(0);
    },
  },
];