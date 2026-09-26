require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')).sort();
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (!command.data || typeof command.execute !== 'function') {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        continue;
      }
      client.commands.set(command.data.name, command);
      console.log(`${command.data.name} command loaded`);
    } catch (error) {
      console.error(`Failed to load command at ${filePath}:`, error);
    }
  }
} else {
  console.warn(`Commands folder not found at ${commandsPath}`);
}

const listenersPath = path.join(__dirname, 'listeners');
if (fs.existsSync(listenersPath)) {
  const listenerFiles = fs.readdirSync(listenersPath).filter(file => file.endsWith('.js')).sort();
  for (const file of listenerFiles) {
    const filePath = path.join(listenersPath, file);
    try {
      const loaded = require(filePath);
      const listeners = Array.isArray(loaded) ? loaded : [loaded];
      for (const listener of listeners) {
        if (!listener.name || typeof listener.execute !== 'function') {
          console.warn(`[WARNING] The listener at ${filePath} is missing a required "name" or "execute" property.`);
          continue;
        }
        const emitter = listener.emitter || client;
        const handler = (...args) => Promise.resolve()
          .then(() => listener.execute(...args, client))
          .catch(error => console.error(`Listener ${listener.name} failed:`, error));
        if (listener.once) emitter.once(listener.name, handler);
        else emitter.on(listener.name, handler);
      }
    } catch (error) {
      console.error(`Failed to load listener at ${filePath}:`, error);
    }
  }
} else {
  console.warn(`Listeners folder not found at ${listenersPath}`);
}

client.login(process.env.TOKEN);
