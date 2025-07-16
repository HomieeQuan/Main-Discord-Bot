// commands/submit-event.js - FIXED null screenshot handling
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
                    { name: 'TET [Private Tryout] (2pts)', value: 'tet_private' },
                    { name: 'TET [Public Tryout] (3pts)', value: 'tet_public' },
                    { name: 'SLRPD Inspection Ceremony (2pts)', value: 'slrpd_inspection' },
                    { name: 'Combat Training (2pts)', value: 'combat_training' },
                    { name: 'SWAT Inspection Ceremony (3pts)', value: 'swat_inspection' },
                    { name: 'Deployment (4pts)', value: 'gang_deployment' }
                ))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Brief description (for patrols: include total duration)')
                .setRequired(true)
                .setMaxLength(500))
        .addAttachmentOption(option =>
            option.setName('screenshot1')
                .setDescription('Primary screenshot proof (REQUIRED)')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('screenshot2')
                .setDescription('Additional screenshot proof (optional)')
                .setRequired(false))
        .addAttachmentOption(option =>
            option.setName('screenshot3')
                .setDescription('Additional screenshot proof (optional)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('How many times did you do this event? (Default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20))
        .addIntegerOption(option =>
            option.setName('attendees-passed')
                .setDescription('🎯 For tryouts only: How many people passed? (+1 point each)')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(50))
        .setDMPermission(false),

    async execute(interaction) {
        const eventType = interaction.options.getString('event-type');
        const description = interaction.options.getString('description');
        const screenshot1 = interaction.options.getAttachment('screenshot1');
        const screenshot2 = interaction.options.getAttachment('screenshot2');
        const screenshot3 = interaction.options.getAttachment('screenshot3');
        const quantity = interaction.options.getInteger('quantity') || 1;
        const attendeesPassed = interaction.options.getInteger('attendees-passed') || 0;

        // FIXED: Collect only non-null screenshots
        const screenshots = [screenshot1];
        if (screenshot2) screenshots.push(screenshot2);
        if (screenshot3) screenshots.push(screenshot3);

        console.log(`📸 Screenshots collected: ${screenshots.length} (screenshot1: ${!!screenshot1}, screenshot2: ${!!screenshot2}, screenshot3: ${!!screenshot3})`);

        // Validate attendees_passed is only used for tryouts
        const isTryoutEvent = eventType === 'tet_private' || eventType === 'tet_public';
        
        if (attendeesPassed > 0 && !isTryoutEvent) {
            return await interaction.reply({
                content: '❌ **Attendees passed** can only be used for Private or Public Tryouts.\n\n💡 **Tip**: This field is for tracking how many people passed a tryout you hosted.',
                ephemeral: true
            });
        }

        if (isTryoutEvent && attendeesPassed === 0) {
            return await interaction.reply({
                content: '❌ **Tryout events require attendees passed count.**\n\nHow many people passed the tryout? Use the `attendees-passed` option to get bonus points!\n\n🎯 **Example**: If 5 people passed your tryout, you get +5 bonus points!',
                ephemeral: true
            });
        }

        // Call the event controller with the screenshots array
        await EventController.submitEvent(interaction, eventType, description, screenshots, quantity, attendeesPassed);
    },
};