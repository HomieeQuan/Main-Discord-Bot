// commands/view-screenshots.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EventLog = require('../models/EventLog');
const PermissionChecker = require('../utils/permissionChecker');
const PointCalculator = require('../utils/pointCalculator');
const SWATEmbeds = require('../views/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-screenshots')
        .setDescription('View submitted event screenshots for auditing (HR only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view screenshots for')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days to look back (default: 7)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(30))
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Maximum number of screenshots to show (default: 3)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(5))
        .setDMPermission(false),

    async execute(interaction) {
        try {
            // Check HR permission
            if (!PermissionChecker.canManageSystem(interaction.member)) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('🚫 Only HR can view submitted screenshots!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const days = interaction.options.getInteger('days') || 7;
            const limit = interaction.options.getInteger('limit') || 3;

            await interaction.deferReply({ ephemeral: true });

            console.log(`🔍 Screenshot audit request: ${interaction.user.username} viewing ${targetUser.username} (${days} days, limit ${limit})`);

            // Build query for user's recent events
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);

            const events = await EventLog.find({
                userId: targetUser.id,
                submittedAt: { $gte: dateLimit },
                $and: [
                    { eventType: { $ne: 'hr_point_adjustment' } },
                    { eventType: { $ne: 'hr_critical_action' } },
                    { eventType: { $ne: 'booster_status_change' } },
                    { eventType: { $ne: 'hr_booster_fix' } }
                ],
                screenshotUrl: { $exists: true, $ne: null, $ne: '' },
                $nor: [
                    { screenshotUrl: 'HR_ADJUSTMENT' },
                    { screenshotUrl: 'HR_CRITICAL_ADJUSTMENT' },
                    { screenshotUrl: 'AUTO_BOOSTER_SYNC' },
                    { screenshotUrl: 'HR_BOOSTER_FIX' }
                ]
            })
            .sort({ submittedAt: -1 })
            .limit(limit);

            console.log(`📊 Found ${events.length} events with screenshots for ${targetUser.username}`);

            if (events.length === 0) {
                const noEventsEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('📸 No Screenshots Found')
                    .setDescription(`No event submissions with screenshots found for ${targetUser.username} in the last ${days} days.`)
                    .addFields(
                        { name: '🔍 Search Criteria', value: `User: ${targetUser.username}\nLast ${days} days\nLimit: ${limit} events`, inline: false },
                        { name: '💡 Possible Reasons', value: '• User hasn\'t submitted events recently\n• Events don\'t have valid screenshots\n• Try increasing the days parameter', inline: false }
                    )
                    .setTimestamp();

                return await interaction.editReply({ embeds: [noEventsEmbed] });
            }

            // Send screenshots one by one to avoid embed limits
            const responses = [];

            // First, send summary
            const summaryEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`📸 Screenshot Audit - ${targetUser.username}`)
                .setDescription(`Found ${events.length} event submissions with screenshots`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '🔍 Search Criteria', value: `Last ${days} days • Showing ${events.length}/${limit} events`, inline: true },
                    { name: '📅 Date Range', value: `${dateLimit.toLocaleDateString()} - ${new Date().toLocaleDateString()}`, inline: true },
                    { name: '👀 Viewing As', value: interaction.user.username, inline: true }
                )
                .setFooter({ text: 'Screenshots will be shown below...' })
                .setTimestamp();

            await interaction.editReply({ embeds: [summaryEmbed] });

            // Then send each screenshot individually
            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                
                try {
                    const eventName = PointCalculator.getEventName(event.eventType);
                    const submissionDate = event.submittedAt.toLocaleDateString();
                    const submissionTime = event.submittedAt.toLocaleTimeString();

                    const eventEmbed = new EmbedBuilder()
                        .setColor(event.boostedPoints ? '#ff6600' : '#00ff00')
                        .setTitle(`📋 Event ${i + 1}/${events.length}: ${eventName}`)
                        .setDescription(`**Description:** ${event.description || 'No description provided'}`)
                        .addFields(
                            { name: '🎯 Points', value: `${event.pointsAwarded} pts`, inline: true },
                            { name: '💎 Booster', value: event.boostedPoints ? '2x Yes' : 'No', inline: true },
                            { name: '🔢 Quantity', value: (event.quantity || 1).toString(), inline: true },
                            { name: '📅 Date', value: submissionDate, inline: true },
                            { name: '⏰ Time', value: submissionTime, inline: true },
                            { name: '🆔 ID', value: event._id.toString().slice(-8), inline: true }
                        )
                        .setImage(event.screenshotUrl)
                        .setFooter({ text: `Event ${i + 1} of ${events.length} • Screenshot URL: ${event.screenshotUrl.length > 50 ? event.screenshotUrl.substring(0, 50) + '...' : event.screenshotUrl}` });

                    // Send as follow-up message
                    await interaction.followUp({ embeds: [eventEmbed], ephemeral: true });
                    
                    console.log(`📸 Sent screenshot ${i + 1}/${events.length} for ${targetUser.username}`);
                    
                    // Small delay to prevent rate limiting
                    if (i < events.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                } catch (screenshotError) {
                    console.error(`❌ Error sending screenshot ${i + 1}:`, screenshotError);
                    
                    // Send error embed for this specific screenshot
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle(`❌ Screenshot ${i + 1} Error`)
                        .setDescription('Failed to load this screenshot')
                        .addFields(
                            { name: 'Event', value: PointCalculator.getEventName(event.eventType), inline: true },
                            { name: 'Date', value: event.submittedAt.toLocaleDateString(), inline: true },
                            { name: 'Error', value: 'Screenshot URL may be invalid or expired', inline: false }
                        );
                    
                    await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
                }
            }

            // Log the audit action
            console.log(`✅ SCREENSHOT AUDIT COMPLETE: ${interaction.user.username} viewed ${events.length} screenshots for ${targetUser.username}`);

        } catch (error) {
            console.error('❌ View screenshots error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Screenshot Viewer Error')
                .setDescription('Failed to retrieve screenshots')
                .addFields(
                    { name: 'Error Details', value: error.message || 'Unknown error occurred', inline: false },
                    { name: '💡 Troubleshooting', value: '• Check if user has submitted events\n• Try reducing the days parameter\n• Contact bot administrator if issue persists', inline: false }
                )
                .setTimestamp();
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};