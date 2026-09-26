const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const database = new DatabaseSync(path.join(__dirname, '..', 'data.sqlite'));

database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    ping_roles TEXT NOT NULL DEFAULT '[]',
    say_roles TEXT NOT NULL DEFAULT '[]',
    purge_roles TEXT NOT NULL DEFAULT '[]',
    log_channel_id TEXT
  );
  CREATE TABLE IF NOT EXISTS vc_time (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    total_ms INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );
`);

const statements = {
  guildSettings: database.prepare('SELECT * FROM guild_settings WHERE guild_id = ?'),
  allGuildSettings: database.prepare('SELECT * FROM guild_settings'),
  setRoles: database.prepare(`
    INSERT INTO guild_settings (guild_id, ping_roles, say_roles, purge_roles)
    VALUES (?, '[]', '[]', '[]')
    ON CONFLICT(guild_id) DO NOTHING
  `),
  updateRoles: {
    ping: database.prepare('UPDATE guild_settings SET ping_roles = ? WHERE guild_id = ?'),
    say: database.prepare('UPDATE guild_settings SET say_roles = ? WHERE guild_id = ?'),
    purge: database.prepare('UPDATE guild_settings SET purge_roles = ? WHERE guild_id = ?'),
  },
  setLogChannel: database.prepare(`
    INSERT INTO guild_settings (guild_id, log_channel_id)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET log_channel_id = excluded.log_channel_id
  `),
  allVoiceTime: database.prepare('SELECT guild_id, user_id, total_ms FROM vc_time'),
  upsertVoiceTime: database.prepare(`
    INSERT INTO vc_time (guild_id, user_id, total_ms)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET total_ms = excluded.total_ms
  `),
};

function parseRoleList(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ensureGuild(guildId) {
  statements.setRoles.run(guildId);
}

function setRoles(kind, guildId, roles) {
  ensureGuild(guildId);
  statements.updateRoles[kind].run(JSON.stringify(roles), guildId);
}

function setLogChannel(guildId, channelId) {
  statements.setLogChannel.run(guildId, channelId);
}

function loadSettings() {
  return statements.allGuildSettings.all();
}

function loadVoiceTime() {
  return statements.allVoiceTime.all();
}

function saveVoiceTime(guildId, userId, totalMs) {
  statements.upsertVoiceTime.run(guildId, userId, Math.max(0, Math.floor(totalMs)));
}

function importLegacyJson(directory) {
  const roleFiles = [
    ['pingroles.json', 'ping_roles'],
    ['sayroles.json', 'say_roles'],
    ['purgeroles.json', 'purge_roles'],
  ];
  const importSettings = database.transaction(() => {
    const guilds = new Map();
    for (const [filename, column] of roleFiles) {
      const filePath = path.join(directory, filename);
      if (!fs.existsSync(filePath)) continue;
      const values = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const [guildId, roles] of Object.entries(values)) {
        const row = guilds.get(guildId) || {};
        row[column] = JSON.stringify(Array.isArray(roles) ? roles : []);
        guilds.set(guildId, row);
      }
    }

    const logPath = path.join(directory, 'logchannels.json');
    if (fs.existsSync(logPath)) {
      const values = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      for (const [guildId, channelId] of Object.entries(values)) {
        const row = guilds.get(guildId) || {};
        row.log_channel_id = channelId || null;
        guilds.set(guildId, row);
      }
    }

    const insertGuild = database.prepare(`
      INSERT INTO guild_settings (guild_id, ping_roles, say_roles, purge_roles, log_channel_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO NOTHING
    `);
    for (const [guildId, row] of guilds) {
      insertGuild.run(
        guildId,
        row.ping_roles || '[]',
        row.say_roles || '[]',
        row.purge_roles || '[]',
        row.log_channel_id || null
      );
    }

    const vcPath = path.join(directory, 'vcdata.json');
    if (fs.existsSync(vcPath)) {
      const values = JSON.parse(fs.readFileSync(vcPath, 'utf8'));
      for (const [guildId, users] of Object.entries(values)) {
        for (const [userId, value] of Object.entries(users)) {
          database.prepare(`
            INSERT INTO vc_time (guild_id, user_id, total_ms)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id, user_id) DO NOTHING
          `).run(guildId, userId, Math.max(0, Math.floor(value.totalMs || 0)));
        }
      }
    }
  });

  try {
    importSettings();
  } catch (error) {
    console.error('Failed to import legacy JSON data:', error.message);
  }
}

module.exports = {
  database,
  importLegacyJson,
  loadSettings,
  loadVoiceTime,
  parseRoleList,
  saveVoiceTime,
  setLogChannel,
  setRoles,
};