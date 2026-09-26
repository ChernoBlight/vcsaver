require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  REST,
  Routes,
  EmbedBuilder,
  Events,
  ChannelType,
} = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const afkData = new Map();

// ====================== PING ROLES ======================
const PING_ROLES_PATH = path.join(__dirname, 'pingroles.json');
/** @type {Map<string, Set<string>>} guildId -> Set of roleIds */
const allowedPingRoles = new Map();

const BOT_OWNER_IDS = ['469617185552203786', '925493978856579152'];

function loadPingRoles() {
  try {
    if (fs.existsSync(PING_ROLES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(PING_ROLES_PATH, 'utf8'));
      for (const [guildId, roles] of Object.entries(raw)) {
        allowedPingRoles.set(guildId, new Set(Array.isArray(roles) ? roles : []));
      }
      console.log('Ping roles data loaded.');
    }
  } catch (err) {
    console.error('Failed to load ping roles:', err.message);
  }
}

function savePingRoles() {
  try {
    const obj = {};
    for (const [guildId, roleSet] of allowedPingRoles) {
      obj[guildId] = [...roleSet];
    }
    fs.writeFileSync(PING_ROLES_PATH, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to save ping roles:', err.message);
  }
}

function getAllowedRoles(guildId) {
  if (!allowedPingRoles.has(guildId)) {
    allowedPingRoles.set(guildId, new Set());
  }
  return allowedPingRoles.get(guildId);
}

function canUsePingCommand(member) {
  if (!member) return false;
  // Bot owners can always use it
  if (BOT_OWNER_IDS.includes(member.id)) return true;
  const allowed = getAllowedRoles(member.guild.id);
  if (allowed.size === 0) return false;
  return member.roles.cache.some(role => allowed.has(role.id));
}

// ====================== SAY ROLES ======================
const SAY_ROLES_PATH = path.join(__dirname, 'sayroles.json');
/** @type {Map<string, Set<string>>} guildId -> Set of roleIds */
const allowedSayRoles = new Map();

function loadSayRoles() {
  try {
    if (fs.existsSync(SAY_ROLES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SAY_ROLES_PATH, 'utf8'));
      for (const [guildId, roles] of Object.entries(raw)) {
        allowedSayRoles.set(guildId, new Set(Array.isArray(roles) ? roles : []));
      }
      console.log('Say roles data loaded.');
    }
  } catch (err) {
    console.error('Failed to load say roles:', err.message);
  }
}

function saveSayRoles() {
  try {
    const obj = {};
    for (const [guildId, roleSet] of allowedSayRoles) {
      obj[guildId] = [...roleSet];
    }
    fs.writeFileSync(SAY_ROLES_PATH, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to save say roles:', err.message);
  }
}

function getAllowedSayRoles(guildId) {
  if (!allowedSayRoles.has(guildId)) {
    allowedSayRoles.set(guildId, new Set());
  }
  return allowedSayRoles.get(guildId);
}

function canUseSayCommand(member) {
  if (!member) return false;
  if (BOT_OWNER_IDS.includes(member.id)) return true;
  const allowed = getAllowedSayRoles(member.guild.id);
  if (allowed.size === 0) return false;
  return member.roles.cache.some(role => allowed.has(role.id));
}

// ====================== PURGE ROLES ======================
const PURGE_ROLES_PATH = path.join(__dirname, 'purgeroles.json');
/** @type {Map<string, Set<string>>} guildId -> Set of roleIds */
const allowedPurgeRoles = new Map();

function loadPurgeRoles() {
  try {
    if (fs.existsSync(PURGE_ROLES_PATH)) {
      const raw = JSON.parse(fs.readFileSync(PURGE_ROLES_PATH, 'utf8'));
      for (const [guildId, roles] of Object.entries(raw)) {
        allowedPurgeRoles.set(guildId, new Set(Array.isArray(roles) ? roles : []));
      }
      console.log('Purge roles data loaded.');
    }
  } catch (err) {
    console.error('Failed to load purge roles:', err.message);
  }
}

function savePurgeRoles() {
  try {
    const obj = {};
    for (const [guildId, roleSet] of allowedPurgeRoles) {
      obj[guildId] = [...roleSet];
    }
    fs.writeFileSync(PURGE_ROLES_PATH, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to save purge roles:', err.message);
  }
}

function getAllowedPurgeRoles(guildId) {
  if (!allowedPurgeRoles.has(guildId)) {
    allowedPurgeRoles.set(guildId, new Set());
  }
  return allowedPurgeRoles.get(guildId);
}

function canUsePurgeCommand(member) {
  if (!member) return false;
  if (BOT_OWNER_IDS.includes(member.id)) return true;
  const allowed = getAllowedPurgeRoles(member.guild.id);
  if (allowed.size === 0) return false;
  return member.roles.cache.some(role => allowed.has(role.id));
}

// ====================== LOG CHANNEL ======================
const LOG_CHANNELS_PATH = path.join(__dirname, 'logchannels.json');
/** @type {Map<string, string>} guildId -> channelId */
const logChannels = new Map();

function loadLogChannels() {
  try {
    if (fs.existsSync(LOG_CHANNELS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(LOG_CHANNELS_PATH, 'utf8'));
      for (const [guildId, channelId] of Object.entries(raw)) {
        if (channelId) logChannels.set(guildId, channelId);
      }
      console.log('Log channels data loaded.');
    }
  } catch (err) {
    console.error('Failed to load log channels:', err.message);
  }
}

function saveLogChannels() {
  try {
    const obj = {};
    for (const [guildId, channelId] of logChannels) {
      obj[guildId] = channelId;
    }
    fs.writeFileSync(LOG_CHANNELS_PATH, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to save log channels:', err.message);
  }
}

function getLogChannelId(guildId) {
  return logChannels.get(guildId) || null;
}

/**
 * Send a log embed to the guild's configured log channel (if set).
 * Silently fails if no channel is set or send fails.
 */
async function sendLog(guild, embed) {
  const channelId = getLogChannelId(guild.id);
  if (!channelId) return;

  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[${guild.name}] Failed to send log:`, err.message);
  }
}

// ====================== VC TIME TRACKER ======================
const VC_DATA_PATH = path.join(__dirname, 'vcdata.json');

/** @type {Map<string, Map<string, { totalMs: number }>>} */
const vcData = new Map();

/**
 * Active sessions: "guildId:userId" -> { joinTime: number, channelId: string }
 */
const activeSessions = new Map();

function loadVcData() {
  try {
    if (fs.existsSync(VC_DATA_PATH)) {
      const raw = JSON.parse(fs.readFileSync(VC_DATA_PATH, 'utf8'));
      for (const [guildId, users] of Object.entries(raw)) {
        const userMap = new Map();
        for (const [userId, data] of Object.entries(users)) {
          userMap.set(userId, { totalMs: data.totalMs || 0 });
        }
        vcData.set(guildId, userMap);
      }
      console.log('VC time data loaded.');
    }
  } catch (err) {
    console.error('Failed to load VC data:', err.message);
  }
}

function saveVcData() {
  try {
    const obj = {};
    for (const [guildId, userMap] of vcData) {
      obj[guildId] = {};
      for (const [userId, data] of userMap) {
        let total = data.totalMs;
        const key = `${guildId}:${userId}`;
        if (activeSessions.has(key)) {
          total += Date.now() - activeSessions.get(key).joinTime;
        }
        obj[guildId][userId] = { totalMs: total };
      }
    }
    fs.writeFileSync(VC_DATA_PATH, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Failed to save VC data:', err.message);
  }
}

function getUserData(guildId, userId) {
  if (!vcData.has(guildId)) vcData.set(guildId, new Map());
  const userMap = vcData.get(guildId);
  if (!userMap.has(userId)) userMap.set(userId, { totalMs: 0 });
  return userMap.get(userId);
}

function startSession(guildId, userId, channelId) {
  const key = `${guildId}:${userId}`;
  if (activeSessions.has(key)) {
    activeSessions.get(key).channelId = channelId;
    return;
  }
  activeSessions.set(key, { joinTime: Date.now(), channelId });
}

function endSession(guildId, userId) {
  const key = `${guildId}:${userId}`;
  if (!activeSessions.has(key)) return;
  const { joinTime } = activeSessions.get(key);
  const duration = Date.now() - joinTime;
  const data = getUserData(guildId, userId);
  data.totalMs += duration;
  activeSessions.delete(key);
  saveVcData();
}

function updateSessionChannel(guildId, userId, channelId) {
  const key = `${guildId}:${userId}`;
  if (activeSessions.has(key)) {
    activeSessions.get(key).channelId = channelId;
  }
}

function getTotalMs(guildId, userId) {
  const data = getUserData(guildId, userId);
  let total = data.totalMs;
  const key = `${guildId}:${userId}`;
  if (activeSessions.has(key)) {
    total += Date.now() - activeSessions.get(key).joinTime;
  }
  return total;
}

function getCurrentChannelId(guildId, userId) {
  const key = `${guildId}:${userId}`;
  return activeSessions.has(key) ? activeSessions.get(key).channelId : null;
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

setInterval(saveVcData, 5 * 60 * 1000);

process.on('SIGINT', () => {
  for (const key of [...activeSessions.keys()]) {
    const [guildId, userId] = key.split(':');
    endSession(guildId, userId);
  }
  saveVcData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  for (const key of [...activeSessions.keys()]) {
    const [guildId, userId] = key.split(':');
    endSession(guildId, userId);
  }
  saveVcData();
  process.exit(0);
});

// ====================== COMMANDS ======================
const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your current voice channel and AFK'),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel'),
  new SlashCommandBuilder()
    .setName('ping-user')
    .setDescription('Ping a specific user multiple times (default: 2 pings)')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user to ping')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('Number of times to ping (1-50, default 2)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)
    ),
  // Right-click a user → Apps → Ping User
  new ContextMenuCommandBuilder()
    .setName('Ping User')
    .setType(ApplicationCommandType.User),
  new SlashCommandBuilder()
    .setName('set-ping-roles')
    .setDescription('Set which roles are allowed to use /ping-user (bot owners only)')
    .addRoleOption(opt =>
      opt.setName('role1')
        .setDescription('First allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role2')
        .setDescription('Second allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role3')
        .setDescription('Third allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role4')
        .setDescription('Fourth allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role5')
        .setDescription('Fifth allowed role')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say a message')
    .addStringOption(opt =>
      opt.setName('message')
        .setDescription('The message the bot should send')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send the message in (defaults to current channel)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  new SlashCommandBuilder()
    .setName('set-say-roles')
    .setDescription('Set which roles are allowed to use /say (bot owners only)')
    .addRoleOption(opt =>
      opt.setName('role1')
        .setDescription('First allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role2')
        .setDescription('Second allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role3')
        .setDescription('Third allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role4')
        .setDescription('Fourth allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role5')
        .setDescription('Fifth allowed role')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of recent messages in this channel')
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Only delete messages from this user (optional)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('set-purge-roles')
    .setDescription('Set which roles are allowed to use /purge (bot owners only)')
    .addRoleOption(opt =>
      opt.setName('role1')
        .setDescription('First allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role2')
        .setDescription('Second allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role3')
        .setDescription('Third allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role4')
        .setDescription('Fourth allowed role')
        .setRequired(false)
    )
    .addRoleOption(opt =>
      opt.setName('role5')
        .setDescription('Fifth allowed role')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('set-log-channel')
    .setDescription('Set the channel where interaction & VC join/leave logs are sent (bot owners only)')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The text channel to send logs to (omit to disable logging)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    ),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency'),
  new SlashCommandBuilder()
    .setName('vctime')
    .setDescription('Check voice channel time for a member')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The member to check (defaults to you)')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('vcleaderboard')
    .setDescription('Show the top members by voice channel time')
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('How many members to show (default 10, max 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ),
].map(c => c.toJSON());

// ====================== READY ======================
client.once(Events.ClientReady, async (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  loadVcData();
  loadPingRoles();
  loadSayRoles();
  loadPurgeRoles();
  loadLogChannels();

  // Start tracking anyone already in a voice channel
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (!channel.isVoiceBased()) continue;
      for (const [memberId, member] of channel.members) {
        if (member.user.bot) continue;
        startSession(guild.id, memberId, channel.id);
      }
    }
  }
  console.log(`Tracking ${activeSessions.size} active VC session(s).`);

  // Clear old global commands, then register per-guild (instant updates)
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: [] });
    console.log('🧹 Cleared old global commands.');

    for (const [guildId, guild] of c.guilds.cache) {
      await rest.put(Routes.applicationGuildCommands(c.user.id, guildId), {
        body: commands,
      });
      console.log(`✅ Registered commands to server: ${guild.name}`);
    }
  } catch (error) {
    console.error('❌ Failed to update commands:', error);
  }
});

// Register commands when bot joins a new server
client.on(Events.GuildCreate, async (guild) => {
  console.log(`👋 Joined a new server: ${guild.name} (ID: ${guild.id})`);
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
      body: commands,
    });
    console.log(`✅ Successfully loaded commands for new server: ${guild.name}`);
  } catch (error) {
    console.error(`❌ Failed to register commands for new server ${guild.name}:`, error);
  }
});

// Prevent crashes
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

// ====================== OTHER BOTS' SLASH COMMANDS (via messages) ======================
// Discord only sends interactionCreate to the bot that owns the command.
// When any user runs a slash command (including other bots), Discord posts a
// message with message.interaction set. We listen for those to log them.
client.on(Events.MessageCreate, async (message) => {
  // Only care about messages that came from a slash / application command
  if (!message.interaction || !message.guild) return;

  // Skip our own bot's commands — those are already logged in interactionCreate
  if (message.interaction.user?.id === client.user?.id) return;
  // Also skip if the message author is us (the command response is from us)
  if (message.author?.id === client.user?.id) return;

  const guildId = message.guild.id;
  if (!getLogChannelId(guildId)) return;

  const runner = message.interaction.user;
  const commandName = message.interaction.commandName || message.interaction.name || 'unknown';
  const botAuthor = message.author; // the bot that owns the command (message author)

  const embed = new EmbedBuilder()
    .setColor(0xEB459E) // pink/magenta to distinguish from our own command logs
    .setAuthor({
      name: runner?.tag || runner?.username || 'Unknown user',
      iconURL: runner?.displayAvatarURL?.({ size: 128 }) || null,
    })
    .setTitle('🤖 Slash Command Used (Other Bot)')
    .setDescription(`\`/${commandName}\``)
    .addFields(
      { name: 'User', value: runner ? `<@${runner.id}>` : 'Unknown', inline: true },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
      {
        name: 'Bot',
        value: botAuthor ? `${botAuthor.tag} (<@${botAuthor.id}>)` : 'Unknown',
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: `User ID: ${runner?.id || 'unknown'} • Bot ID: ${botAuthor?.id || 'unknown'}` });

  await sendLog(message.guild, embed).catch(() => {});
});

// ====================== VOICE STATE UPDATE (TRACKER + LOG) ======================
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guildId = newState.guild?.id || oldState.guild?.id;
  if (!guildId) return;

  const userId = newState.id || oldState.id;
  if (!userId) return;

  const member = newState.member || oldState.member;
  if (member?.user?.bot) return;

  const guild = newState.guild || oldState.guild;
  const wasInVC = !!oldState.channelId;
  const isInVC = !!newState.channelId;

  // --- VC time tracking ---
  if (!wasInVC && isInVC) {
    startSession(guildId, userId, newState.channelId);
  } else if (wasInVC && !isInVC) {
    endSession(guildId, userId);
  } else if (wasInVC && isInVC && oldState.channelId !== newState.channelId) {
    updateSessionChannel(guildId, userId, newState.channelId);
  }

  // --- VC join / leave / move logging ---
  if (!getLogChannelId(guildId)) return;

  const displayName = member?.displayName || member?.user?.username || userId;
  const avatar = member?.user?.displayAvatarURL({ size: 128 }) || null;

  if (!wasInVC && isInVC) {
    // Joined a VC
    const channel = newState.channel;
    const embed = new EmbedBuilder()
      .setColor(0x57F287) // green
      .setAuthor({ name: displayName, iconURL: avatar })
      .setTitle('🟢 Joined Voice Channel')
      .setDescription(`**${displayName}** joined **${channel?.name || 'Unknown'}**`)
      .addFields(
        { name: 'User', value: `<@${userId}>`, inline: true },
        { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Unknown', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `User ID: ${userId}` });

    await sendLog(guild, embed);
  } else if (wasInVC && !isInVC) {
    // Left a VC
    const channel = oldState.channel;
    const embed = new EmbedBuilder()
      .setColor(0xED4245) // red
      .setAuthor({ name: displayName, iconURL: avatar })
      .setTitle('🔴 Left Voice Channel')
      .setDescription(`**${displayName}** left **${channel?.name || 'Unknown'}**`)
      .addFields(
        { name: 'User', value: `<@${userId}>`, inline: true },
        { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Unknown', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `User ID: ${userId}` });

    await sendLog(guild, embed);
  } else if (wasInVC && isInVC && oldState.channelId !== newState.channelId) {
    // Moved between VCs
    const fromChannel = oldState.channel;
    const toChannel = newState.channel;
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C) // yellow
      .setAuthor({ name: displayName, iconURL: avatar })
      .setTitle('🔄 Moved Voice Channel')
      .setDescription(
        `**${displayName}** moved from **${fromChannel?.name || 'Unknown'}** to **${toChannel?.name || 'Unknown'}**`
      )
      .addFields(
        { name: 'User', value: `<@${userId}>`, inline: true },
        { name: 'From', value: fromChannel ? `<#${fromChannel.id}>` : 'Unknown', inline: true },
        { name: 'To', value: toChannel ? `<#${toChannel.id}>` : 'Unknown', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `User ID: ${userId}` });

    await sendLog(guild, embed);
  }
});

// ====================== OTHER BOTS / PREFIX COMMANDS LOG ======================
// Note: Other bots' *slash* commands cannot be logged — Discord only delivers
// interactions to the application that owns the command. This logs:
//  • Messages from other bots (common for prefix-command bots & command replies)
//  • Messages that look like prefix commands (e.g. !help, .play, ?ban)
const PREFIX_COMMAND_REGEX = /^[!./?$%~>]+\S+/;

client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.id === client.user.id) return;
  if (!getLogChannelId(message.guild.id)) return;

  const isOtherBot = message.author.bot;
  const looksLikeCommand = PREFIX_COMMAND_REGEX.test(message.content.trim());

  // Only log other bots' messages, or human messages that look like prefix commands
  if (!isOtherBot && !looksLikeCommand) return;

  const content = message.content
    ? (message.content.length > 1000 ? message.content.slice(0, 997) + '...' : message.content)
    : '*No text content*';

  const embed = new EmbedBuilder()
    .setColor(isOtherBot ? 0xEB459E : 0x5865F2) // pink for bots, blurple for prefix cmds
    .setAuthor({
      name: message.author.tag,
      iconURL: message.author.displayAvatarURL({ size: 128 }),
    })
    .setTitle(isOtherBot ? '🤖 Bot Message / Command' : '💬 Prefix-style Command')
    .setDescription(content)
    .addFields(
      { name: 'User', value: `<@${message.author.id}>`, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      ...(isOtherBot
        ? [{ name: 'Bot', value: 'Yes', inline: true }]
        : [])
    )
    .setTimestamp()
    .setFooter({ text: `User ID: ${message.author.id} • Msg ID: ${message.id}` });

  if (message.attachments.size > 0) {
    embed.addFields({
      name: 'Attachments',
      value: [...message.attachments.values()].map(a => `[${a.name}](${a.url})`).join('\n').slice(0, 1024),
    });
  }

  await sendLog(message.guild, embed).catch(() => {});
});

// ====================== JOIN FUNCTION ======================
async function joinChannel(channel) {
  const existing = getVoiceConnection(channel.guild.id);
  if (existing) existing.destroy();

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
    debug: false,
  });

  afkData.set(channel.guild.id, channel.id);

  connection.on('debug', (message) => {
    console.log(`[VOICE DEBUG] ${message}`);
  });

  connection.on('error', (error) => {
    console.error(`[${channel.guild.name}] Connection error:`, error.message);
  });

  connection.on('stateChange', (oldState, newState) => {
    console.log(`[${channel.guild.name}] ${oldState.status} → ${newState.status}`);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    if (!afkData.has(channel.guild.id)) return;

    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
      return;
    } catch {}

    console.log(`[${channel.guild.name}] Disconnected → rejoining in 3s...`);
    await new Promise(r => setTimeout(r, 3000));

    try {
      const targetId = afkData.get(channel.guild.id);
      const target = await channel.guild.channels.fetch(targetId).catch(() => null);
      if (!target?.isVoiceBased()) {
        afkData.delete(channel.guild.id);
        connection.destroy();
        return;
      }
      connection.destroy();
      await joinChannel(target);
    } catch (err) {
      console.error(`[${channel.guild.name}] Rejoin failed:`, err.message);
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`[${channel.guild.name}] ✅ Fully Ready in ${channel.name}`);
  } catch {
    console.log(`[${channel.guild.name}] ⚠️ Did not reach Ready in time`);
  }

  return connection;
}

// ====================== SHARED: ping a user N times ======================
async function executePingUser(interaction, target, count) {
  if (!canUsePingCommand(interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. You need one of the allowed roles.',
      ephemeral: true,
    });
  }

  if (count < 1 || count > 50) {
    return interaction.reply({ content: 'Count must be between 1 and 50.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  const mention = `<@${target.id}>`;
  for (let i = 1; i <= count; i++) {
    try {
      await interaction.channel.send(`${mention}`);
    } catch (err) {
      console.error('Failed to send ping:', err.message);
      break;
    }
    if (i < count) await new Promise(r => setTimeout(r, 300));
  }

  await interaction.editReply(`Pinged **${target.username}** **${count}x**.`);
}

// ====================== INTERACTIONS ======================
client.on('interactionCreate', async (interaction) => {
  // Handle user context menu (right-click user → Apps → Ping User)
  if (interaction.isUserContextMenuCommand()) {
    try {
      // Log context menu usage
      if (interaction.guild && getLogChannelId(interaction.guildId)) {
        const target = interaction.targetUser;
        const logEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
            name: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL({ size: 128 }),
          })
          .setTitle('⚡ Context Menu Used')
          .setDescription(`\`${interaction.commandName}\``)
          .addFields(
            { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
            { name: 'Target', value: target ? `<@${target.id}>` : 'Unknown', inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `User ID: ${interaction.user.id}` });

        sendLog(interaction.guild, logEmbed).catch(() => {});
      }

      if (interaction.commandName === 'Ping User') {
        const target = interaction.targetUser;
        // Context menu has no count option — default to 2
        await executePingUser(interaction, target, 2);
      }
    } catch (err) {
      console.error('Context menu interaction error:', err);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    // --- Log the interaction ---
    if (interaction.guild && getLogChannelId(interaction.guildId)) {
      const options = interaction.options.data
        .map(opt => {
          if (opt.type === 6) return `${opt.name}: <@${opt.value}>`; // USER
          if (opt.type === 8) return `${opt.name}: <@&${opt.value}>`; // ROLE
          if (opt.type === 7) return `${opt.name}: <#${opt.value}>`; // CHANNEL
          return `${opt.name}: ${opt.value}`;
        })
        .join('\n') || '*None*';

      const logEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL({ size: 128 }),
        })
        .setTitle('⚡ Slash Command Used')
        .setDescription(`\`/${interaction.commandName}\``)
        .addFields(
          { name: 'User', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
          { name: 'Options', value: options }
        )
        .setTimestamp()
        .setFooter({ text: `User ID: ${interaction.user.id}` });

      // Fire and forget — don't block command handling
      sendLog(interaction.guild, logEmbed).catch(() => {});
    }

    // JOIN
    if (interaction.commandName === 'join') {
      await interaction.deferReply().catch(() => null);

      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) return interaction.editReply('You need to be in a voice channel first!');
      if (getVoiceConnection(interaction.guildId)) return interaction.editReply('I am already connected!');

      try {
        await joinChannel(voiceChannel);
        await interaction.editReply(`Joined **${voiceChannel.name}** and going AFK 💤`);
      } catch (err) {
        console.error(err);
        await interaction.editReply('Failed to join the voice channel.');
      }
    }

    // LEAVE
    if (interaction.commandName === 'leave') {
      const connection = getVoiceConnection(interaction.guildId);
      if (!connection) return interaction.reply({ content: 'I am not in a voice channel!', ephemeral: true });

      afkData.delete(interaction.guildId);
      connection.destroy();
      await interaction.reply('Left the voice channel.');
    }

    // PING - user ping with count parameter (slash command)
    if (interaction.commandName === 'ping-user') {
      const target = interaction.options.getUser('user');
      const count = interaction.options.getInteger('count') || 2;
      await executePingUser(interaction, target, count);
    }

    // SET PING ROLES (bot owners only)
    if (interaction.commandName === 'set-ping-roles') {
      if (!BOT_OWNER_IDS.includes(interaction.user.id)) {
        return interaction.reply({
          content: 'Only the bot owners can use this command.',
          ephemeral: true,
        });
      }

      const roles = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role);
      }

      const guildId = interaction.guildId;
      const roleSet = getAllowedRoles(guildId);
      roleSet.clear();

      if (roles.length === 0) {
        savePingRoles();
        return interaction.reply({
          content: '✅ Cleared all allowed roles for `/ping-user`. No one (except bot owners) can use it now.',
          ephemeral: true,
        });
      }

      for (const role of roles) {
        roleSet.add(role.id);
      }
      savePingRoles();

      const roleMentions = roles.map(r => `<@&${r.id}>`).join(', ');
      await interaction.reply({
        content: `✅ Allowed roles for \`/ping-user\` set to: ${roleMentions}`,
        ephemeral: true,
      });
    }

    // SAY
    if (interaction.commandName === 'say') {
      if (!canUseSayCommand(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to use this command. You need one of the allowed roles.',
          ephemeral: true,
        });
      }

      const message = interaction.options.getString('message', true);
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

      if (!targetChannel?.isTextBased()) {
        return interaction.reply({
          content: 'I can only send messages to text channels.',
          ephemeral: true,
        });
      }

      try {
        await targetChannel.send({ content: message, allowedMentions: { parse: ['users', 'roles'] } });
        await interaction.reply({
          content: targetChannel.id === interaction.channelId
            ? '✅ Message sent.'
            : `✅ Message sent to <#${targetChannel.id}>.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error('Failed to send /say message:', err.message);
        await interaction.reply({
          content: 'Failed to send the message. Make sure I have permission to send messages in that channel.',
          ephemeral: true,
        });
      }
    }

    // SET SAY ROLES (bot owners only)
    if (interaction.commandName === 'set-say-roles') {
      if (!BOT_OWNER_IDS.includes(interaction.user.id)) {
        return interaction.reply({
          content: 'Only the bot owners can use this command.',
          ephemeral: true,
        });
      }

      const roles = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role);
      }

      const guildId = interaction.guildId;
      const roleSet = getAllowedSayRoles(guildId);
      roleSet.clear();

      if (roles.length === 0) {
        saveSayRoles();
        return interaction.reply({
          content: '✅ Cleared all allowed roles for `/say`. No one (except bot owners) can use it now.',
          ephemeral: true,
        });
      }

      for (const role of roles) {
        roleSet.add(role.id);
      }
      saveSayRoles();

      const roleMentions = roles.map(r => `<@&${r.id}>`).join(', ');
      await interaction.reply({
        content: `✅ Allowed roles for \`/say\` set to: ${roleMentions}`,
        ephemeral: true,
      });
    }

    // PURGE
    if (interaction.commandName === 'purge') {
      if (!canUsePurgeCommand(interaction.member)) {
        return interaction.reply({
          content: 'You do not have permission to use this command. You need one of the allowed roles.',
          ephemeral: true,
        });
      }

      const amount = interaction.options.getInteger('amount', true);
      const filterUser = interaction.options.getUser('user');

      if (!interaction.channel?.isTextBased()) {
        return interaction.reply({
          content: 'This command can only be used in a text channel.',
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true }).catch(() => null);

      try {
        // Fetch a bit more when filtering by user so we can still hit the requested amount
        const fetchLimit = filterUser ? Math.min(100, amount * 3) : amount;
        const fetched = await interaction.channel.messages.fetch({ limit: fetchLimit });

        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        let toDelete = [...fetched.values()].filter(msg => msg.createdTimestamp > twoWeeksAgo);

        if (filterUser) {
          toDelete = toDelete.filter(msg => msg.author.id === filterUser.id);
        }

        toDelete = toDelete.slice(0, amount);

        if (toDelete.length === 0) {
          return interaction.editReply(
            filterUser
              ? `No recent messages from **${filterUser.username}** found (messages older than 14 days cannot be bulk-deleted).`
              : 'No recent messages found to delete (messages older than 14 days cannot be bulk-deleted).'
          );
        }

        const deleted = await interaction.channel.bulkDelete(toDelete, true);

        const userNote = filterUser ? ` from **${filterUser.username}**` : '';
        await interaction.editReply(`🗑️ Deleted **${deleted.size}** message(s)${userNote}.`);
      } catch (err) {
        console.error('Purge failed:', err.message);
        await interaction.editReply(
          'Failed to delete messages. Make sure I have **Manage Messages** permission in this channel.'
        );
      }
    }

    // SET PURGE ROLES (bot owners only)
    if (interaction.commandName === 'set-purge-roles') {
      if (!BOT_OWNER_IDS.includes(interaction.user.id)) {
        return interaction.reply({
          content: 'Only the bot owners can use this command.',
          ephemeral: true,
        });
      }

      const roles = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role);
      }

      const guildId = interaction.guildId;
      const roleSet = getAllowedPurgeRoles(guildId);
      roleSet.clear();

      if (roles.length === 0) {
        savePurgeRoles();
        return interaction.reply({
          content: '✅ Cleared all allowed roles for `/purge`. No one (except bot owners) can use it now.',
          ephemeral: true,
        });
      }

      for (const role of roles) {
        roleSet.add(role.id);
      }
      savePurgeRoles();

      const roleMentions = roles.map(r => `<@&${r.id}>`).join(', ');
      await interaction.reply({
        content: `✅ Allowed roles for \`/purge\` set to: ${roleMentions}`,
        ephemeral: true,
      });
    }

    // SET LOG CHANNEL (bot owners only)
    if (interaction.commandName === 'set-log-channel') {
      if (!BOT_OWNER_IDS.includes(interaction.user.id)) {
        return interaction.reply({
          content: 'Only the bot owners can use this command.',
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel('channel');
      const guildId = interaction.guildId;

      if (!channel) {
        logChannels.delete(guildId);
        saveLogChannels();
        return interaction.reply({
          content: '✅ Logging disabled. No log channel is set.',
          ephemeral: true,
        });
      }

      logChannels.set(guildId, channel.id);
      saveLogChannels();

      await interaction.reply({
        content: `✅ Log channel set to <#${channel.id}>. Interaction and voice join/leave events will be logged there.`,
        ephemeral: true,
      });
    }

    // PING - bot latency check
    if (interaction.commandName === 'ping') {
      await interaction.reply('Pinging...');
      const reply = await interaction.fetchReply();
      const latency = reply.createdTimestamp - interaction.createdTimestamp;
      const apiLatency = Math.round(client.ws.ping);

      await interaction.editReply(
        `Pong! 🏓\nBot Latency: **${latency}ms**\nAPI Latency: **${apiLatency}ms**`
      );
    }

    // VCTIME
    if (interaction.commandName === 'vctime') {
      const target = interaction.options.getUser('user') || interaction.user;
      const totalMs = getTotalMs(interaction.guildId, target.id);
      const formatted = formatDuration(totalMs);
      const channelId = getCurrentChannelId(interaction.guildId, target.id);

      let statusText = '⚫ Not in VC';
      if (channelId) {
        const channel = interaction.guild.channels.cache.get(channelId);
        const channelName = channel ? channel.name : 'Unknown channel';
        statusText = `🟢 In **${channelName}**`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎙️ Voice Channel Time')
        .setDescription(
          target.id === interaction.user.id
            ? `You have spent **${formatted}** in voice channels.`
            : `**${target.username}** has spent **${formatted}** in voice channels.`
        )
        .addFields(
          { name: 'Status', value: statusText, inline: true },
          { name: 'Total', value: formatted, inline: true }
        )
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

    // VCLEADERBOARD
    if (interaction.commandName === 'vcleaderboard') {
      const limit = interaction.options.getInteger('limit') || 10;
      const guildId = interaction.guildId;
      const userMap = vcData.get(guildId) || new Map();

      const entries = [];
      for (const [userId] of userMap) {
        entries.push({ userId, totalMs: getTotalMs(guildId, userId) });
      }

      // Also include people currently in VC who might not be in vcData yet
      for (const key of activeSessions.keys()) {
        if (!key.startsWith(guildId + ':')) continue;
        const userId = key.split(':')[1];
        if (!entries.find(e => e.userId === userId)) {
          entries.push({ userId, totalMs: getTotalMs(guildId, userId) });
        }
      }

      entries.sort((a, b) => b.totalMs - a.totalMs);
      const top = entries.slice(0, limit);

      if (top.length === 0) {
        return interaction.reply({ content: 'No voice channel time recorded yet.', ephemeral: true });
      }

      const lines = await Promise.all(
        top.map(async (entry, i) => {
          let name = entry.userId;
          try {
            // Prefer guild display name (nickname → global name → username)
            const member = await interaction.guild.members.fetch(entry.userId);
            name = member.displayName;
          } catch {
            try {
              // Fallback if the user left the server
              const user = await client.users.fetch(entry.userId);
              name = user.displayName || user.username;
            } catch {}
          }

          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
          const channelId = getCurrentChannelId(guildId, entry.userId);
          let liveInfo = '';
          if (channelId) {
            const channel = interaction.guild.channels.cache.get(channelId);
            const channelName = channel ? channel.name : 'Unknown';
            liveInfo = ` 🟢 *${channelName}*`;
          }
          return `${medal} **${name}**${liveInfo} — ${formatDuration(entry.totalMs)}`;
        })
      );

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🏆 VC Time Leaderboard')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Top ${top.length} • Green = currently in VC` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Interaction error:', err);
  }
});

// ====================== LOGIN ======================
client.login(process.env.TOKEN);
