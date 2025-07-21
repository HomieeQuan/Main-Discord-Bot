// commands/view-screenshots.js - FIXED to handle multiple screenshots per event
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
                .setDescription('Maximum number of events to show (default: 5)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10))
        .setDMPermission(false),

    async execute(interaction) {
        try {
            // Check HR permission
            if (!PermissionChecker.canManageSystem(interaction.member)) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Only HR can view submitted screenshots!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const days = interaction.options.getInteger('days') || 7;
            const limit = interaction.options.getInteger('limit') || 5;

            await interaction.deferReply({ ephemeral: true });

            // FIXED: Get server nickname for target user
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const targetDisplayName = targetMember?.displayName || targetUser.username;

            console.log(`📸 Screenshot audit request: ${interaction.user.username} viewing ${targetDisplayName} (${days} days, limit ${limit})`);

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
                ]
            })
            .sort({ submittedAt: -1 })
            .limit(limit);

            console.log(`📊 Found ${events.length} events for ${targetDisplayName}`);

            // FIXED: Helper function to get all screenshot URLs (handles both formats)
            const getAllScreenshotUrls = (event) => {
                // Check for screenshots in the new format (screenshotUrls array)
                if (event.screenshotUrls && Array.isArray(event.screenshotUrls) && event.screenshotUrls.length > 0) {
                    // Filter out system/HR URLs
                    const validUrls = event.screenshotUrls.filter(url => 
                        url && 
                        url !== 'HR_ADJUSTMENT' && 
                        url !== 'HR_CRITICAL_ADJUSTMENT' &&
                        url !== 'AUTO_BOOSTER_SYNC' &&
                        !url.startsWith('HR_') &&
                        !url.startsWith('SYSTEM_')
                    );
                    return validUrls;
                }
                
                // Check for screenshots in the old format (single screenshotUrl)
                if (event.screenshotUrl && 
                    event.screenshotUrl !== 'HR_ADJUSTMENT' && 
                    event.screenshotUrl !== 'HR_CRITICAL_ADJUSTMENT' &&
                    event.screenshotUrl !== 'AUTO_BOOSTER_SYNC' &&
                    !event.screenshotUrl.startsWith('HR_') &&
                    !event.screenshotUrl.startsWith('SYSTEM_')) {
                    return [event.screenshotUrl]; // Convert single URL to array
                }
                
                return []; // No valid screenshots
            };

            // FIXED: Filter events that have valid screenshots using new logic
            const eventsWithScreenshots = events.filter(event => {
                const urls = getAllScreenshotUrls(event);
                return urls.length > 0;
            });

            if (eventsWithScreenshots.length === 0) {
                const noEventsEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('No Screenshots Found')
                    .setDescription(`No event submissions with screenshots found for ${targetDisplayName} in the last ${days} days.`)
                    .addFields(
                        { 
                            name: 'Search Criteria', 
                            value: `User: ${targetDisplayName}\nLast ${days} days\nLimit: ${limit} events`, 
                            inline: false 
                        },
                        { 
                            name: 'Possible Reasons', 
                            value: '• User hasn\'t submitted events recently\n• Events don\'t have valid screenshots\n• Try increasing the days parameter', 
                            inline: false 
                        }
                    )
                    .setTimestamp();

                return await interaction.editReply({ embeds: [noEventsEmbed] });
            }

            // FIXED: Calculate total screenshot count properly
            const totalScreenshots = eventsWithScreenshots.reduce((sum, event) => {
                const urls = getAllScreenshotUrls(event);
                return sum + urls.length;
            }, 0);

            // Send intro message
            const introEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Event Screenshots')
                .setDescription(`Displaying screenshots for ${targetDisplayName}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: 'Search Criteria', 
                        value: `Last ${days} days • Showing ${eventsWithScreenshots.length} events`, 
                        inline: true 
                    },
                    { 
                        name: 'Date Range', 
                        value: `${dateLimit.toLocaleDateString()} - ${new Date().toLocaleDateString()}`, 
                        inline: true 
                    },
                    { 
                        name: 'Total Screenshots', 
                        value: `${totalScreenshots} screenshots from ${eventsWithScreenshots.length} events`, 
                        inline: true 
                    },
                    { 
                        name: 'Viewing As', 
                        value: interaction.user.username, 
                        inline: true 
                    }
                )
                .setFooter({ text: 'Screenshots will appear below...' })
                .setTimestamp();

            await interaction.editReply({ embeds: [introEmbed] });

            // FIXED: Send ALL screenshots for each event
            let overallScreenshotIndex = 0;
            
            for (let eventIndex = 0; eventIndex < eventsWithScreenshots.length; eventIndex++) {
                const event = eventsWithScreenshots[eventIndex];
                
                try {
                    // Get all screenshot URLs for this event using helper function
                    const screenshotUrls = getAllScreenshotUrls(event);
                    
                    if (screenshotUrls.length === 0) continue;

                    const eventName = PointCalculator.getEventName(event.eventType);
                    const submissionDate = event.submittedAt.toLocaleDateString();
                    const submissionTime = event.submittedAt.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });

                    // FIXED: Send each screenshot individually with proper numbering
                    for (let screenshotIndex = 0; screenshotIndex < screenshotUrls.length; screenshotIndex++) {
                        const screenshotUrl = screenshotUrls[screenshotIndex];
                        overallScreenshotIndex++;

                        const screenshotEmbed = new EmbedBuilder()
                            .setColor(event.boostedPoints ? '#ff6600' : '#00ff00')
                            .setTitle(`Event ${eventIndex + 1}/${eventsWithScreenshots.length}: ${eventName}`)
                            .setDescription(`**Description:** ${event.description || 'No description provided'}`)
                            .addFields(
                                { name: 'Points', value: `${event.pointsAwarded} pts`, inline: true },
                                { name: 'Booster', value: event.boostedPoints ? '2x Yes' : 'No', inline: true },
                                { name: 'Date', value: `${submissionDate} ${submissionTime}`, inline: true }
                            )
                            .setImage(screenshotUrl)
                            .setFooter({ 
                                text: `Screenshot ${screenshotIndex + 1} of ${screenshotUrls.length} for this event • Overall ${overallScreenshotIndex}/${totalScreenshots}` 
                            });

                        // Add quantity info if more than 1
                        if (event.quantity && event.quantity > 1) {
                            screenshotEmbed.addFields({
                                name: 'Quantity',
                                value: `x${event.quantity}`,
                                inline: true
                            });
                        }

                        // Add attendees info for tryouts
                        if (event.attendeesPassed && event.attendeesPassed > 0) {
                            screenshotEmbed.addFields({
                                name: 'Attendees Passed',
                                value: `${event.attendeesPassed} (+${event.attendeesPassed} bonus points)`,
                                inline: true
                            });
                        }

                        await interaction.followUp({ embeds: [screenshotEmbed], ephemeral: true });
                        
                        console.log(`📸 Sent screenshot ${screenshotIndex + 1}/${screenshotUrls.length} for event ${eventIndex + 1}: ${eventName}`);
                        
                        // Rate limiting delay between screenshots
                        if (overallScreenshotIndex < totalScreenshots) {
                            await new Promise(resolve => setTimeout(resolve, 800));
                        }
                    }
                    
                } catch (screenshotError) {
                    console.error(`❌ Error sending screenshots for event ${eventIndex + 1}:`, screenshotError);
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle(`Screenshot Error - Event ${eventIndex + 1}`)
                        .setDescription('Failed to load screenshots for this event')
                        .addFields(
                            { name: 'Event', value: PointCalculator.getEventName(event.eventType), inline: true },
                            { name: 'Date', value: event.submittedAt.toLocaleDateString(), inline: true },
                            { name: 'Error', value: 'Screenshot URLs may be invalid or expired', inline: false }
                        );
                    
                    await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
                }
            }

            // Send completion message
            const completionEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Screenshots Display Complete')
                .setDescription(`Completed showing all ${totalScreenshots} screenshots from ${eventsWithScreenshots.length} events.`)
                .addFields(
                    { 
                        name: 'Summary', 
                        value: `**User:** ${targetDisplayName}\n**Events:** ${eventsWithScreenshots.length}\n**Screenshots:** ${totalScreenshots}`, 
                        inline: false 
                    }
                )
                .setFooter({ text: 'Screenshot audit completed' })
                .setTimestamp();

            await interaction.followUp({ embeds: [completionEmbed], ephemeral: true });

            // Log the audit action
            console.log(`✅ SCREENSHOT AUDIT COMPLETE: ${interaction.user.username} viewed ${totalScreenshots} screenshots for ${targetDisplayName}`);

        } catch (error) {
            console.error('❌ View screenshots error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Screenshot Viewer Error')
                .setDescription('Failed to retrieve screenshots')
                .addFields(
                    { name: 'Error Details', value: error.message || 'Unknown error occurred', inline: false },
                    { name: 'Troubleshooting', value: '• Check if user has submitted events\n• Try reducing the days parameter\n• Contact bot administrator if issue persists', inline: false }
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