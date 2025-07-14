// commands/submit-event.js
const { SlashCommandBuilder } = require('discord.js');
const EventController = require('../controllers/eventController');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('submit-event')
        .setDescription('Submit a SWAT event for points')
        .addStringOption(option =>
            option.setName('event-type')
                .setDescription('Type of event completed')
                .setRequired(true)
                .addChoices(
                    { name: '30-Minute Patrol (1pt)', value: 'patrol_30min' },
                    { name: 'Attending an Event (2pts)', value: 'attend_event' },
                    { name: 'Attending SWAT Event (3pts)', value: 'attend_swat_event' },
                    { name: 'Co-Hosting/Hosting SWAT Event (4pts)', value: 'host_swat_event' },
                    { name: 'Backup Request (3pts)', value: 'backup_request' },
                    { name: 'GHOST Protection [Good Rating 7/10+] (4pts)', value: 'ghost_protection_good' },
                    { name: 'GHOST Protection [Bad Rating 6/10-] (2pts)', value: 'ghost_protection_bad' },
                    { name: 'TET [Private Tryout] (1pt)', value: 'tet_private' },
                    { name: 'TET [Public Tryout] (2pts)', value: 'tet_public' },
                    { name: 'SLRPD Inspection Ceremony (2pts)', value: 'slrpd_inspection' },
                    { name: 'Combat Training (1pt)', value: 'combat_training' },
                    { name: 'SWAT Inspection Ceremony (3pts)', value: 'swat_inspection' },
                    { name: 'Deployment (4pts)', value: 'gang_deployment' }
                ))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Brief description (for patrols: include total duration)')
                .setRequired(true)
                .setMaxLength(500))
        .addAttachmentOption(option =>
            option.setName('screenshot')
                .setDescription('Screenshot proof of the event(s)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('How many times did you do this event? (Default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20))
        .setDMPermission(false),

    async execute(interaction) {
        const eventType = interaction.options.getString('event-type');
        const description = interaction.options.getString('description');
        const screenshot = interaction.options.getAttachment('screenshot');
        const quantity = interaction.options.getInteger('quantity') || 1;

        await EventController.submitEvent(interaction, eventType, description, screenshot, quantity);
    },
};