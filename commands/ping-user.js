const { SlashCommandBuilder } = require('discord.js');
const { executePingUser } = require('../utils/runtime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping-user')
    .setDescription('Ping a specific user multiple times (default: 2 pings)')
    .addUserOption(option => option.setName('user').setDescription('The user to ping').setRequired(true))
    .addIntegerOption(option => option
      .setName('count')
      .setDescription('Number of times to ping (1-50, default 2)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(50)),
  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const count = interaction.options.getInteger('count') || 2;
    await executePingUser(interaction, target, count);
  },
};