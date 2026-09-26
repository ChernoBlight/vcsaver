const { REST, Routes, Events } = require('discord.js');
const runtime = require('../utils/runtime');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    runtime.initialize();
    setInterval(runtime.saveVcData, 5 * 60 * 1000);

    for (const guild of client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isVoiceBased()) continue;
        for (const [memberId, member] of channel.members) {
          if (!member.user.bot) runtime.startSession(guild.id, memberId, channel.id);
        }
      }
    }
    console.log(`Tracking ${runtime.activeSessions.size} active VC session(s).`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = [...client.commands.values()].map(command => command.data.toJSON());
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
      console.log('Cleared old global commands.');
      for (const [guildId, guild] of client.guilds.cache) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
        console.log(`Registered commands to server: ${guild.name}`);
      }
    } catch (error) {
      console.error('Failed to update commands:', error);
    }
  },
};