// commands/manage-points.js
const { SlashCommandBuilder } = require('discord.js');
const HRController = require('../controllers/hrController');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-points')
        .setDescription('HR command to manage user points')
        // ALL REQUIRED OPTIONS MUST COME FIRST
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to manage points for')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add Points', value: 'add' },
                    { name: 'Remove Points', value: 'remove' },
                    { name: 'Set Points', value: 'set' },
                    { name: '🚨 Remove ALL Points', value: 'remove_all' }
                )
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the point adjustment')
                .setRequired(true)
        )
        // OPTIONAL OPTIONS MUST COME AFTER ALL REQUIRED OPTIONS
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of points (not needed for remove_all)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(1000)
        ),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const action = interaction.options.getString('action');
        const reason = interaction.options.getString('reason');
        const amount = interaction.options.getInteger('amount');

        // Validate amount for actions that need it
        if (action !== 'remove_all' && !amount) {
            return await interaction.reply({
                content: '❌ **Error:** Amount is required for add, remove, and set actions.',
                ephemeral: true
            });
        }

        // For remove_all, amount is not needed
        const finalAmount = action === 'remove_all' ? 0 : amount;

        await HRController.managePoints(interaction, targetUser, action, finalAmount, reason);
    },
};