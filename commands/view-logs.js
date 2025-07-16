// commands/view-logs.js - FIXED server nicknames and emoji clutter
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EventLog = require('../models/EventLog');
const PermissionChecker = require('../utils/permissionChecker');
const PointCalculator = require('../utils/pointCalculator');
const SWATEmbeds = require('../views/embedBuilder');

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
        try {
            // Check HR permission
            if (!PermissionChecker.canManageSystem(interaction.member)) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Only HR can use this command!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const eventType = interaction.options.getString('event-type');
            const days = interaction.options.getInteger('days') || 7;

            await interaction.deferReply();

            console.log(`📋 HR Log View: ${interaction.user.username} viewing logs (${days} days, user: ${targetUser?.username || 'all'}, type: ${eventType || 'all'})`);

            // Build query filters
            const query = {};
            
            // Date filter (last X days)
            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);
            query.submittedAt = { $gte: dateLimit };

            // User filter
            if (targetUser) {
                query.userId = targetUser.id;
            }

            // Event type filter
            if (eventType) {
                query.eventType = eventType;
            }

            // Get filtered logs
            const logs = await EventLog.find(query)
                .sort({ submittedAt: -1 })
                .limit(25); // Limit to 25 most recent

            if (logs.length === 0) {
                const noLogsEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('No Event Logs Found')
                    .setDescription('No event logs match your search criteria.')
                    .addFields(
                        { 
                            name: 'Search Criteria', 
                            value: `User: ${targetUser?.displayName || targetUser?.username || 'All'}\nEvent Type: ${eventType || 'All'}\nLast ${days} days`, 
                            inline: false 
                        }
                    );

                return await interaction.editReply({ embeds: [noLogsEmbed] });
            }

            // FIXED: Create logs embed with server nicknames and clean formatting
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Event Logs')
                .setDescription(`Showing ${logs.length} most recent logs`)
                .setTimestamp();

            // FIXED: Add filters info with server nicknames
            let filterText = `**Filters:** Last ${days} days`;
            if (targetUser) {
                // Get server nickname for target user
                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                const targetDisplayName = targetMember?.displayName || targetUser.username;
                filterText += ` • User: ${targetDisplayName}`;
            }
            if (eventType) filterText += ` • Type: ${eventType}`;
            
            embed.addFields({ name: 'Search Criteria', value: filterText, inline: false });

            // Group logs by user for better readability
            const logsByUser = {};
            logs.forEach(log => {
                // Use the stored username (which should be server nickname from our updates)
                const displayName = log.username;
                if (!logsByUser[displayName]) {
                    logsByUser[displayName] = [];
                }
                logsByUser[displayName].push(log);
            });

            // FIXED: Add log entries with clean formatting and screenshot counts
            let fieldCount = 0;
            for (const [displayName, userLogs] of Object.entries(logsByUser)) {
                if (fieldCount >= 8) break; // Discord embed field limit

                const logText = userLogs.slice(0, 3).map(log => {
                    const date = log.submittedAt.toLocaleDateString();
                    const time = log.submittedAt.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    const eventName = PointCalculator.getEventName(log.eventType);
                    
                    // FIXED: Get screenshot count using the new method
                    const screenshotCount = log.getScreenshotCount ? log.getScreenshotCount() : 
                                          (log.screenshotUrls ? log.screenshotUrls.length : 
                                           (log.screenshotUrl ? 1 : 0));
                    
                    // FIXED: Clean format without emoji clutter
                    let line = `${eventName} (${log.pointsAwarded}pts) - ${date} ${time}`;
                    
                    // Add screenshot count as text
                    if (screenshotCount > 0) {
                        line += ` - ${screenshotCount} screenshot${screenshotCount > 1 ? 's' : ''}`;
                    }
                    
                    // Add quantity if more than 1
                    if (log.quantity && log.quantity > 1) {
                        line += ` (x${log.quantity})`;
                    }
                    
                    // Add attendees for tryouts
                    if (log.attendeesPassed && log.attendeesPassed > 0) {
                        line += ` [${log.attendeesPassed} passed]`;
                    }

                    return `• ${line}`;
                }).join('\n');

                embed.addFields({
                    name: `${displayName} (${userLogs.length} events)`,
                    value: logText + (userLogs.length > 3 ? `\n... and ${userLogs.length - 3} more` : ''),
                    inline: true
                });

                fieldCount++;
            }

            // Add summary statistics
            const totalPoints = logs.reduce((sum, log) => sum + log.pointsAwarded, 0);
            const uniqueUsers = new Set(logs.map(log => log.username)).size;
            const totalScreenshots = logs.reduce((sum, log) => {
                const count = log.getScreenshotCount ? log.getScreenshotCount() : 
                             (log.screenshotUrls ? log.screenshotUrls.length : 
                              (log.screenshotUrl ? 1 : 0));
                return sum + count;
            }, 0);
            
            embed.addFields({
                name: 'Summary',
                value: `**Total Events:** ${logs.length}\n**Unique Users:** ${uniqueUsers}\n**Total Points:** ${totalPoints}\n**Total Screenshots:** ${totalScreenshots}`,
                inline: false
            });

            // FIXED: Add screenshot viewing tip with server nicknames
            if (targetUser && totalScreenshots > 0) {
                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                const targetDisplayName = targetMember?.displayName || targetUser.username;
                
                embed.addFields({
                    name: 'View Screenshots',
                    value: `Use \`/view-screenshots user:${targetDisplayName}\` to see submitted screenshots`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

            console.log(`✅ Log view completed: ${logs.length} logs shown to ${interaction.user.username}`);

        } catch (error) {
            console.error('❌ View logs error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve event logs. Please try again later.');
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },
};