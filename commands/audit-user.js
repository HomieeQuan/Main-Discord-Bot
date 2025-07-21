// commands/audit-user.js - COMPLETE FIXED VERSION - handles both old and new screenshot formats
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PermissionChecker = require('../utils/permissionChecker');
const PointCalculator = require('../utils/pointCalculator');
const RankSystem = require('../utils/rankSystem');
const SWATEmbeds = require('../views/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('audit-user')
        .setDescription('Complete user audit with all logs and screenshots (HR only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to audit')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days to audit (default: 7)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(30))
        .setDMPermission(false),

    async execute(interaction) {
        try {
            // Permission check
            if (!PermissionChecker.canManageSystem(interaction.member)) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('🚫 Only HR can use the audit system!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const days = interaction.options.getInteger('days') || 7;

            await interaction.deferReply({ ephemeral: true });

            console.log(`🔍 AUDIT: ${interaction.member.displayName || interaction.user.username} auditing ${interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username} (${days} days)`);

            // Gather audit data
            const auditData = await this.gatherAuditData(targetUser, days, interaction);
            
            if (!auditData.user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} not found in database.`);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // Send audit summary
            const summaryEmbed = this.createSummaryEmbed(auditData, targetUser, days, interaction);
            await interaction.editReply({ embeds: [summaryEmbed] });

            // Send event logs
            if (auditData.events.length > 0) {
                const logsEmbed = this.createLogsEmbed(auditData, days);
                await interaction.followUp({ embeds: [logsEmbed], ephemeral: true });
            }

            // Send ALL screenshots
            if (auditData.eventsWithScreenshots.length > 0) {
                await this.sendAllScreenshots(interaction, auditData.eventsWithScreenshots, targetUser);
            } else {
                const noScreenshotsEmbed = new EmbedBuilder()
                    .setColor('#ffaa00')
                    .setTitle('📸 No Screenshots Found')
                    .setDescription(`No event screenshots found for ${interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username} in the last ${days} days.`);
                
                await interaction.followUp({ embeds: [noScreenshotsEmbed], ephemeral: true });
            }

            // Send audit actions
            const actionsEmbed = this.createAuditActionsEmbed(targetUser, auditData, interaction);
            await interaction.followUp({ embeds: [actionsEmbed], ephemeral: true });

            // Log audit action
            await this.logAuditAction(interaction.user, targetUser, days, auditData.events.length, interaction);

        } catch (error) {
            console.error('❌ Audit error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Audit System Error')
                .setDescription('Failed to complete user audit')
                .addFields(
                    { name: 'Error', value: error.message || 'Unknown error occurred', inline: false }
                )
                .setTimestamp();
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    },

    async gatherAuditData(targetUser, days, interaction) {
        try {
            console.log(`📊 Gathering audit data for ${interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username}...`);
            
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            if (!user) return { user: null };

            const dateLimit = new Date();
            dateLimit.setDate(dateLimit.getDate() - days);

            const events = await EventLog.find({
                userId: targetUser.id,
                submittedAt: { $gte: dateLimit }
            }).sort({ submittedAt: -1 });

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

            // FIXED: Get ALL events with valid screenshots using new logic
            const eventsWithScreenshots = events.filter(event => {
                const urls = getAllScreenshotUrls(event);
                return urls.length > 0;
            });

            const weeklyRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints } 
            }) + 1;

            const allTimeRank = await SWATUser.countDocuments({ 
                allTimePoints: { $gt: user.allTimePoints } 
            }) + 1;

            console.log(`📋 Audit data gathered: ${events.length} events, ${eventsWithScreenshots.length} with screenshots`);

            return {
                user,
                events,
                eventsWithScreenshots,
                weeklyRank,
                allTimeRank,
                dateRange: {
                    from: dateLimit,
                    to: new Date()
                }
            };

        } catch (error) {
            console.error('❌ Gather audit data error:', error);
            throw error;
        }
    },

    createSummaryEmbed(auditData, targetUser, days, interaction) {
        const { user, events, eventsWithScreenshots, weeklyRank, allTimeRank } = auditData;

        const totalPoints = events.reduce((sum, event) => sum + event.pointsAwarded, 0);
        const totalEvents = events.length;
        const boostedEvents = events.filter(e => e.boostedPoints).length;
        
        const currentRank = RankSystem.formatRank(user);
        const eligibility = RankSystem.checkPromotionEligibility(user);
        const lockStatus = RankSystem.checkRankLockExpiry(user);

        // FIXED: Use server nickname instead of Discord username
        const targetDisplayName = interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username;

        const summaryEmbed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
            .setTitle(`🔍 User Audit - ${targetDisplayName}`)
            .setDescription(`**Audit Period:** ${days} days (${auditData.dateRange.from.toLocaleDateString()} - ${auditData.dateRange.to.toLocaleDateString()})`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                {
                    name: '👤 User Overview',
                    value: [
                        `**Current Rank:** ${currentRank}`,
                        `**Weekly:** ${user.weeklyPoints}/${user.weeklyQuota} pts (${user.quotaCompleted ? '✅ Complete' : '⏳ In Progress'})`,
                        `**All-Time:** ${user.allTimePoints} pts`,
                        `**Booster:** ${user.isBooster ? '💎 Yes (2x Points)' : '❌ No'}`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📊 Audit Results',
                    value: [
                        `**Events Submitted:** ${totalEvents}`,
                        `**Points Earned:** ${totalPoints}`,
                        `**Boosted Events:** ${boostedEvents}/${totalEvents}`,
                        `**Screenshots Found:** ${eventsWithScreenshots.length}`
                    ].join('\n'),
                    inline: true
                },
                {
                    name: '🏆 Current Rankings',
                    value: [
                        `**Weekly Rank:** #${weeklyRank}`,
                        `**All-Time Rank:** #${allTimeRank}`,
                        `**Total Events:** ${user.totalEvents}`,
                        `**Points Today:** ${user.dailyPointsToday || 0}`
                    ].join('\n'),
                    inline: true
                }
            );

        // Add rank progression info
        if (!RankSystem.isExecutiveOrHigher(user.rankLevel)) {
            // Ensure rankPoints is properly set - SIMPLIFIED FIX
            const safeUser = {
                rankPoints: user.rankPoints || 0,
                rankLevel: user.rankLevel || 1,
                rankName: user.rankName || 'Probationary Operator'
            };
            
            const rankProgress = RankSystem.createRankProgressBar(safeUser);
            summaryEmbed.addFields({
                name: '📈 Rank Progression',
                value: rankProgress,
                inline: false
            });

            if (eligibility.eligible) {
                summaryEmbed.addFields({
                    name: '🎯 Promotion Status',
                    value: `✅ **ELIGIBLE** for promotion to ${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}!`,
                    inline: false
                });
            } else if (eligibility.nextRank) {
                summaryEmbed.addFields({
                    name: '📈 Next Promotion',
                    value: `${eligibility.requirements?.pointsRemaining || 0} more rank points needed for ${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}`,
                    inline: false
                });
            }
        }

        // Add rank lock info
        if (!lockStatus.expired && lockStatus.daysRemaining) {
            summaryEmbed.addFields({
                name: '🔒 Rank Lock',
                value: `${lockStatus.daysRemaining} days remaining`,
                inline: true
            });
        }

        summaryEmbed.addFields({
            name: '👀 Audited By',
            value: `${interaction.member.displayName || interaction.user.username}`,
            inline: true
        });

        summaryEmbed.setFooter({ 
            text: `${totalEvents} events found • ${eventsWithScreenshots.length} screenshots available` 
        }).setTimestamp();

        return summaryEmbed;
    },

    createLogsEmbed(auditData, days) {
        const { events } = auditData;

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📋 Event Logs Detail')
            .setDescription(`All events in the last ${days} days`)
            .setTimestamp();

        if (events.length === 0) {
            embed.setDescription('No events found in the audit period.');
            return embed;
        }

        // Group events by type
        const eventsByType = {};
        events.forEach(event => {
            const eventName = PointCalculator.getEventName(event.eventType);
            if (!eventsByType[eventName]) {
                eventsByType[eventName] = [];
            }
            eventsByType[eventName].push(event);
        });

        // Create fields for each event type
        let fieldCount = 0;
        for (const [eventType, typeEvents] of Object.entries(eventsByType)) {
            if (fieldCount >= 8) break;

            const eventText = typeEvents.slice(0, 3).map(event => {
                const date = event.submittedAt.toLocaleDateString();
                const time = event.submittedAt.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                let line = `• ${date} ${time} - ${event.pointsAwarded}pts`;
                
                if (event.boostedPoints) line += ' 💎';
                if (event.quantity && event.quantity > 1) line += ` (x${event.quantity})`;
                if (event.attendeesPassed && event.attendeesPassed > 0) {
                    line += ` [${event.attendeesPassed} passed]`;
                }

                // FIXED: Check for screenshots using both formats
                const hasScreenshot = (event.screenshotUrls && Array.isArray(event.screenshotUrls) && event.screenshotUrls.length > 0) ||
                                    (event.screenshotUrl && 
                                     event.screenshotUrl !== 'HR_ADJUSTMENT' && 
                                     event.screenshotUrl !== 'HR_CRITICAL_ADJUSTMENT' &&
                                     event.screenshotUrl !== 'AUTO_BOOSTER_SYNC' &&
                                     !event.screenshotUrl.startsWith('HR_') && 
                                     !event.screenshotUrl.startsWith('SYSTEM_'));
                                     
                if (hasScreenshot) line += ' 📸';

                return line;
            }).join('\n');

            const totalPoints = typeEvents.reduce((sum, e) => sum + e.pointsAwarded, 0);
            embed.addFields({
                name: `${eventType} (${typeEvents.length} events, ${totalPoints} pts)`,
                value: eventText + (typeEvents.length > 3 ? `\n... and ${typeEvents.length - 3} more` : ''),
                inline: true
            });

            fieldCount++;
        }

        const totalPoints = events.reduce((sum, e) => sum + e.pointsAwarded, 0);
        // FIXED: Count screenshots using new logic
        const eventsWithScreenshots = events.filter(e => {
            return (e.screenshotUrls && Array.isArray(e.screenshotUrls) && e.screenshotUrls.length > 0) ||
                   (e.screenshotUrl && 
                    e.screenshotUrl !== 'HR_ADJUSTMENT' && 
                    e.screenshotUrl !== 'HR_CRITICAL_ADJUSTMENT' &&
                    e.screenshotUrl !== 'AUTO_BOOSTER_SYNC' &&
                    !e.screenshotUrl.startsWith('HR_') && 
                    !e.screenshotUrl.startsWith('SYSTEM_'));
        }).length;

        embed.addFields({
            name: '📊 Summary',
            value: [
                `**Total Events:** ${events.length}`,
                `**Total Points:** ${totalPoints}`,
                `**Events with Screenshots:** ${eventsWithScreenshots}`,
                `**Event Types:** ${Object.keys(eventsByType).length}`
            ].join('\n'),
            inline: false
        });

        return embed;
    },

    async sendAllScreenshots(interaction, eventsWithScreenshots, targetUser) {
        try {
            console.log(`📸 Sending ALL ${eventsWithScreenshots.length} screenshots...`);

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

            // FIXED: Calculate total screenshots properly
            const totalScreenshots = eventsWithScreenshots.reduce((sum, event) => {
                const urls = getAllScreenshotUrls(event);
                return sum + urls.length;
            }, 0);

            // Send intro message
            const introEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📸 All Event Screenshots')
                .setDescription(`Displaying all ${totalScreenshots} screenshots for ${interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username}`)
                .addFields({
                    name: '📋 Info',
                    value: 'Screenshots will appear below. Please wait for all to load.',
                    inline: false
                });

            await interaction.followUp({ embeds: [introEmbed], ephemeral: true });

            // Send each screenshot
            let overallScreenshotIndex = 0;
            
            for (let i = 0; i < eventsWithScreenshots.length; i++) {
                const event = eventsWithScreenshots[i];
                
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

                        const eventEmbed = new EmbedBuilder()
                            .setColor(event.boostedPoints ? '#ff6600' : '#00ff00')
                            .setTitle(`📸 ${overallScreenshotIndex}/${totalScreenshots}: ${eventName}`)
                            .setDescription(`**Description:** ${event.description || 'No description provided'}`)
                            .addFields(
                                { name: '🎯 Points', value: `${event.pointsAwarded} pts`, inline: true },
                                { name: '💎 Booster', value: event.boostedPoints ? '2x Yes' : 'No', inline: true },
                                { name: '📅 Date', value: `${submissionDate} ${submissionTime}`, inline: true }
                            )
                            .setImage(screenshotUrl)
                            .setFooter({ 
                                text: `Screenshot ${screenshotIndex + 1} of ${screenshotUrls.length} for this event • Event ${i + 1}/${eventsWithScreenshots.length}` 
                            });

                        // Add quantity info if more than 1
                        if (event.quantity && event.quantity > 1) {
                            eventEmbed.addFields({
                                name: '🔢 Quantity',
                                value: `x${event.quantity}`,
                                inline: true
                            });
                        }

                        // Add attendees info for tryouts
                        if (event.attendeesPassed && event.attendeesPassed > 0) {
                            eventEmbed.addFields({
                                name: '👥 Attendees Passed',
                                value: `${event.attendeesPassed} (+${event.attendeesPassed} bonus points)`,
                                inline: true
                            });
                        }

                        await interaction.followUp({ embeds: [eventEmbed], ephemeral: true });
                        
                        console.log(`📸 Sent screenshot ${overallScreenshotIndex}/${totalScreenshots}: ${eventName}`);
                        
                        // Rate limiting delay
                        if (overallScreenshotIndex < totalScreenshots) {
                            await new Promise(resolve => setTimeout(resolve, 800));
                        }
                    }
                    
                } catch (screenshotError) {
                    console.error(`❌ Error sending screenshot ${i + 1}:`, screenshotError);
                    
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle(`❌ Screenshot ${i + 1} Failed`)
                        .setDescription('Could not load this screenshot')
                        .addFields(
                            { name: 'Event', value: PointCalculator.getEventName(event.eventType), inline: true },
                            { name: 'Date', value: event.submittedAt.toLocaleDateString(), inline: true }
                        );
                    
                    await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
                }
            }

            // Send completion message
            const completionEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ All Screenshots Displayed')
                .setDescription(`Completed showing all ${totalScreenshots} screenshots.`);

            await interaction.followUp({ embeds: [completionEmbed], ephemeral: true });

        } catch (error) {
            console.error('❌ Send all screenshots error:', error);
        }
    },

    createAuditActionsEmbed(targetUser, auditData, interaction) {
        const { user, events } = auditData;
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🔧 Available HR Actions')
            .setDescription('Management options for this user')
            .setTimestamp();

        embed.addFields({
            name: '💯 Point Management',
            value: [
                `\`/manage-points user:${interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username} action:add amount:[points] reason:[reason]\``,
                `\`/manage-points user:${interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username} action:remove amount:[points] reason:[reason]\``
            ].join('\n'),
            inline: false
        });

        if (user.promotionEligible) {
            embed.addFields({
                name: '🎖️ Promotion Actions',
                value: [
                    `\`/promote-operator review user:${interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username}\``,
                    `\`/promote-operator approve user:${interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username}\``
                ].join('\n'),
                inline: false
            });
        }

        embed.addFields({
            name: '📊 Reference Info',
            value: [
                `**User ID:** ${targetUser.id}`,
                `**Events Found:** ${events.length}`,
                `**Account Created:** ${user.createdAt?.toLocaleDateString() || 'Unknown'}`
            ].join('\n'),
            inline: false
        });

        return embed;
    },

    async logAuditAction(hrUser, targetUser, days, eventCount, interaction) {
        try {
            // FIXED: Use server nicknames for both users
            const targetDisplayName = interaction.guild.members.cache.get(targetUser.id)?.displayName || targetUser.username;
            const hrDisplayName = interaction.member.displayName || hrUser.username;

            const auditLog = new EventLog({
                userId: targetUser.id,
                username: targetDisplayName, // FIXED: Use target user's server nickname
                eventType: 'hr_audit_action',
                description: `HR AUDIT: ${days} days, ${eventCount} events reviewed`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_AUDIT_ACTION',
                hrAction: {
                    hrUser: hrUser.id,
                    hrUsername: hrDisplayName, // FIXED: Use server nickname
                    action: 'user_audit',
                    reason: `HR audit of ${targetDisplayName}` // FIXED: Use server nickname
                }
            });

            await auditLog.save();
            console.log(`📝 Audit logged: ${hrDisplayName} audited ${targetDisplayName}`);

        } catch (error) {
            console.error('❌ Failed to log audit action:', error);
        }
    }
};