const { SlashCommandBuilder } = require('discord.js');
const { canUseRole } = require('../utils/runtime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of recent messages in this channel')
    .addIntegerOption(option => option
      .setName('amount')
      .setDescription('Number of messages to delete (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100))
    .addUserOption(option => option
      .setName('user')
      .setDescription('Only delete messages from this user (optional)')
      .setRequired(false)),
  async execute(interaction) {
    if (!canUseRole('purge', interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this command. You need one of the allowed roles.',
        ephemeral: true,
      });
    }
    const amount = interaction.options.getInteger('amount', true);
    const filterUser = interaction.options.getUser('user');
    if (!interaction.channel?.isTextBased()) {
      return interaction.reply({ content: 'This command can only be used in a text channel.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => null);
    try {
      const fetchLimit = filterUser ? Math.min(100, amount * 3) : amount;
      const fetched = await interaction.channel.messages.fetch({ limit: fetchLimit });
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      let toDelete = [...fetched.values()].filter(message => message.createdTimestamp > twoWeeksAgo);
      if (filterUser) toDelete = toDelete.filter(message => message.author.id === filterUser.id);
      toDelete = toDelete.slice(0, amount);
      if (toDelete.length === 0) {
        return interaction.editReply(filterUser
          ? `No recent messages from **${filterUser.username}** found (messages older than 14 days cannot be bulk-deleted).`
          : 'No recent messages found to delete (messages older than 14 days cannot be bulk-deleted).');
      }
      const deleted = await interaction.channel.bulkDelete(toDelete, true);
      const userNote = filterUser ? ` from **${filterUser.username}**` : '';
      await interaction.editReply(`🗑️ Deleted **${deleted.size}** message(s)${userNote}.`);
    } catch (error) {
      console.error('Purge failed:', error.message);
      await interaction.editReply('Failed to delete messages. Make sure I have **Manage Messages** permission in this channel.');
    }
  },
};