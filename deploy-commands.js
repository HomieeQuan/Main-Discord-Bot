// deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');

const commands = [];

// Check if commands folder exists
if (!fs.existsSync('./commands')) {
    console.error('❌ Commands folder not found!');
    process.exit(1);
}

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

if (commandFiles.length === 0) {
    console.error('❌ No command files found!');
    process.exit(1);
}

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`📝 Found command: ${command.data.name}`);
    } else {
        console.log(`⚠️  Command ${file} is missing required properties`);
    }
}

const rest = new REST().setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log(`🔄 Refreshing ${commands.length} slash command(s)...`);
        
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        
        console.log(`✅ Successfully registered ${data.length} commands!`);
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
})();