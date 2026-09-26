const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { canUseRole } = require('../utils/runtime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say a message')
    .addStringOption(option => option
      .setName('message')
      .setDescription('The message the bot should send')
      .setRequired(true)
      .setMaxLength(2000))
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Channel to send the message in (defaults to current channel)')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  async execute(interaction) {
    if (!canUseRole('say', interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this command. You need one of the allowed roles.',
        ephemeral: true,
      });
    }
    const message = interaction.options.getString('message', true);
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    if (!targetChannel?.isTextBased()) {
      return interaction.reply({ content: 'I can only send messages to text channels.', ephemeral: true });
    }
    try {
      await targetChannel.send({ content: message, allowedMentions: { parse: ['users', 'roles'] } });
      await interaction.reply({
        content: targetChannel.id === interaction.channelId ? '✅ Message sent.' : `✅ Message sent to <#${targetChannel.id}>.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Failed to send /say message:', error.message);
      await interaction.reply({
        content: 'Failed to send the message. Make sure I have permission to send messages in that channel.',
        ephemeral: true,
      });
    }
  },
};