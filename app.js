// app.js
require('dotenv').config();

// Import configurations
const connectDB = require('./config/connectdb');
const { createDiscordClient, connectDiscordBot } = require('./config/discordClient');
const AutomationScheduler = require('./utils/automationScheduler');

// Import for loading commands
const fs = require('fs');
const { Collection } = require('discord.js');

async function startBot() {
    try {
        console.log('🚀 Starting SWAT Bot...');
        
        // Connect to MongoDB
        await connectDB();
        
        // Create Discord client
        const client = createDiscordClient();
        
        // Initialize commands collection
        client.commands = new Collection();

        // Load commands from commands folder
        const commandsPath = './commands';
        if (fs.existsSync(commandsPath)) {
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const command = require(`${commandsPath}/${file}`);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    console.log(`✅ Loaded command: ${command.data.name}`);
                } else {
                    console.log(`⚠️  Command ${file} is missing required properties`);
                }
            }
        }
        
        // Bot ready event
        client.once('ready', () => {
            console.log(`✅ Bot is online! Logged in as ${client.user.tag}`);
            console.log(`🎯 Bot is in ${client.guilds.cache.size} server(s)`);
            
            // Start automation scheduler
            console.log('🤖 Starting daily automation scheduler...');
            client.automationScheduler = new AutomationScheduler(client);
            client.automationScheduler.start();
            console.log('✅ Daily automation scheduler started successfully');
        });

        // Handle slash commands
        client.on('interactionCreate', async interaction => {
            if (!interaction.isChatInputCommand()) return;

            const command = client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`❌ No command matching ${interaction.commandName} was found.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`❌ Error executing ${interaction.commandName}:`, error);
                
                const reply = { 
                    content: 'There was an error while executing this command!', 
                    ephemeral: true 
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        });
        

        // Error handling
        client.on('error', error => {
            console.error('❌ Discord client error:', error);
        });
        
        // Connect to Discord
        await connectDiscordBot(client);
        
        console.log('🎉 Bot started successfully!');
        
    } catch (error) {
        console.error('💥 Failed to start bot:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Shutting down...');
    process.exit(0);
});

module.exports = { startBot };