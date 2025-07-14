// commands/view-logs.js
const { SlashCommandBuilder } = require('discord.js');
const HRController = require('../controllers/hrController');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-logs')
        .setDescription('View event submission logs (HR only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Filter by specific user (optional)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('event-type')
                .setDescription('Filter by event type (optional)')
                .setRequired(false)
                .addChoices(
                    { name: '30-Minute Patrol', value: 'patrol_30min' },
                    { name: 'Attending Event', value: 'attend_event' },
                    { name: 'SWAT Event', value: 'attend_swat_event' },
                    { name: 'Hosting Event', value: 'host_swat_event' },
                    { name: 'Backup Request', value: 'backup_request' },
                    { name: 'GHOST Protection Good', value: 'ghost_protection_good' },
                    { name: 'GHOST Protection Bad', value: 'ghost_protection_bad' },
                    { name: 'TET Private', value: 'tet_private' },
                    { name: 'TET Public', value: 'tet_public' },
                    { name: 'SLRPD Inspection', value: 'slrpd_inspection' },
                    { name: 'Combat Training', value: 'combat_training' },
                    { name: 'SWAT Inspection', value: 'swat_inspection' },
                    { name: 'Deployment', value: 'gang_deployment' },
                    { name: 'HR Point Adjustment', value: 'hr_point_adjustment' }
                ))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days to look back (default: 7)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(30))
        .setDMPermission(false),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const eventType = interaction.options.getString('event-type');
        const days = interaction.options.getInteger('days') || 7;

        await HRController.viewLogs(interaction, targetUser, eventType, days);
    },
};