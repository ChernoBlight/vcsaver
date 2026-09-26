const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { BOT_OWNER_IDS, setLogChannel } = require('../utils/runtime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-log-channel')
    .setDescription('Set the channel where interaction & VC join/leave logs are sent (bot owners only)')
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('The text channel to send logs to (omit to disable logging)')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  async execute(interaction) {
    if (!BOT_OWNER_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: 'Only the bot owners can use this command.', ephemeral: true });
    }
    const channel = interaction.options.getChannel('channel');
    setLogChannel(interaction.guildId, channel?.id || null);
    if (!channel) {
      return interaction.reply({ content: '✅ Logging disabled. No log channel is set.', ephemeral: true });
    }
    await interaction.reply({
      content: `✅ Log channel set to <#${channel.id}>. Interaction and voice join/leave events will be logged there.`,
      ephemeral: true,
    });
  },
};