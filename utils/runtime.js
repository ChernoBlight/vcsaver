const store = require('./database');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');

const BOT_OWNER_IDS = ['469617185552203786', '925493978856579152'];
const allowedRoles = {
  ping: new Map(),
  say: new Map(),
  purge: new Map(),
};
const logChannels = new Map();
const vcData = new Map();
const activeSessions = new Map();
const afkData = new Map();

function initialize() {
  store.importLegacyJson(require('node:path').join(__dirname, '..'));

  for (const row of store.loadSettings()) {
    allowedRoles.ping.set(row.guild_id, new Set(store.parseRoleList(row.ping_roles)));
    allowedRoles.say.set(row.guild_id, new Set(store.parseRoleList(row.say_roles)));
    allowedRoles.purge.set(row.guild_id, new Set(store.parseRoleList(row.purge_roles)));
    if (row.log_channel_id) logChannels.set(row.guild_id, row.log_channel_id);
  }

  for (const row of store.loadVoiceTime()) {
    getUserData(row.guild_id, row.user_id).totalMs = row.total_ms;
  }
}

function getAllowedRoles(kind, guildId) {
  const roleMap = allowedRoles[kind];
  if (!roleMap.has(guildId)) roleMap.set(guildId, new Set());
  return roleMap.get(guildId);
}

function canUseRole(kind, member) {
  if (!member) return false;
  if (BOT_OWNER_IDS.includes(member.id)) return true;
  const allowed = getAllowedRoles(kind, member.guild.id);
  return allowed.size > 0 && member.roles.cache.some(role => allowed.has(role.id));
}

function setAllowedRoles(kind, guildId, roles) {
  const roleIds = roles.map(role => typeof role === 'string' ? role : role.id);
  allowedRoles[kind].set(guildId, new Set(roleIds));
  store.setRoles(kind, guildId, roleIds);
}

function getLogChannelId(guildId) {
  return logChannels.get(guildId) || null;
}

function setLogChannel(guildId, channelId) {
  if (channelId) logChannels.set(guildId, channelId);
  else logChannels.delete(guildId);
  store.setLogChannel(guildId, channelId || null);
}

async function sendLog(guild, embed) {
  const channelId = getLogChannelId(guild.id);
  if (!channelId) return;

  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`[${guild.name}] Failed to send log:`, error.message);
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
  getUserData(guildId, userId);
  if (activeSessions.has(key)) {
    activeSessions.get(key).channelId = channelId;
    return;
  }
  activeSessions.set(key, { joinTime: Date.now(), channelId });
}

function saveVcData() {
  for (const [guildId, userMap] of vcData) {
    for (const [userId, data] of userMap) {
      const session = activeSessions.get(`${guildId}:${userId}`);
      const total = data.totalMs + (session ? Date.now() - session.joinTime : 0);
      store.saveVoiceTime(guildId, userId, total);
    }
  }
}

function endSession(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const session = activeSessions.get(key);
  if (!session) return;
  getUserData(guildId, userId).totalMs += Date.now() - session.joinTime;
  activeSessions.delete(key);
  saveVcData();
}

function updateSessionChannel(guildId, userId, channelId) {
  const session = activeSessions.get(`${guildId}:${userId}`);
  if (session) session.channelId = channelId;
}

function getTotalMs(guildId, userId) {
  const session = activeSessions.get(`${guildId}:${userId}`);
  return getUserData(guildId, userId).totalMs + (session ? Date.now() - session.joinTime : 0);
}

function getCurrentChannelId(guildId, userId) {
  return activeSessions.get(`${guildId}:${userId}`)?.channelId || null;
}

function formatDuration(ms) {
  ms = Math.max(0, ms);
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000) % 24;
  const days = Math.floor(ms / 86400000);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

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

  connection.on('debug', message => console.log(`[VOICE DEBUG] ${message}`));
  connection.on('error', error => console.error(`[${channel.guild.name}] Connection error:`, error.message));
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

    await new Promise(resolve => setTimeout(resolve, 3000));
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
    } catch (error) {
      console.error(`[${channel.guild.name}] Rejoin failed:`, error.message);
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`[${channel.guild.name}] Fully ready in ${channel.name}`);
  } catch {
    console.log(`[${channel.guild.name}] Did not reach ready in time`);
  }
  return connection;
}

async function executePingUser(interaction, target, count) {
  if (!canUseRole('ping', interaction.member)) {
    return interaction.reply({
      content: 'You do not have permission to use this command. You need one of the allowed roles.',
      ephemeral: true,
    });
  }
  if (count < 1 || count > 50) {
    return interaction.reply({ content: 'Count must be between 1 and 50.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => null);
  for (let index = 1; index <= count; index++) {
    try {
      await interaction.channel.send(`<@${target.id}>`);
    } catch (error) {
      console.error('Failed to send ping:', error.message);
      break;
    }
    if (index < count) await new Promise(resolve => setTimeout(resolve, 300));
  }
  await interaction.editReply(`Pinged **${target.username}** **${count}x**.`);
}

module.exports = {
  BOT_OWNER_IDS,
  activeSessions,
  afkData,
  canUseRole,
  endSession,
  executePingUser,
  formatDuration,
  getAllowedRoles,
  getCurrentChannelId,
  getLogChannelId,
  getTotalMs,
  getUserData,
  joinChannel,
  logChannels,
  saveVcData,
  sendLog,
  setAllowedRoles,
  setLogChannel,
  startSession,
  updateSessionChannel,
  vcData,
  initialize,
};