const { Client, GatewayIntentBits } = require('discord.js');

function createDiscordClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ]
    });

    return client;
}

async function connectDiscordBot(client) {
    try {
        await client.login(process.env.BOT_TOKEN);
        console.log('✅ Discord bot connected successfully');
        return client;
    } catch (error) {
        console.error('❌ Discord connection error:', error);
        throw error;
    }
}

module.exports = {
    createDiscordClient,
    connectDiscordBot
};