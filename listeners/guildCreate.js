const { REST, Routes, Events } = require('discord.js');

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    console.log(`Joined a new server: ${guild.name} (ID: ${guild.id})`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const commands = [...guild.client.commands.values()].map(command => command.data.toJSON());
    try {
      await rest.put(Routes.applicationGuildCommands(guild.client.user.id, guild.id), { body: commands });
      console.log(`Successfully loaded commands for new server: ${guild.name}`);
    } catch (error) {
      console.error(`Failed to register commands for new server ${guild.name}:`, error);
    }
  },
};