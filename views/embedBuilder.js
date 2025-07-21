// views/embedBuilder.js - FIXED leaderboard spacing and added better readability
const { EmbedBuilder } = require('discord.js');
const PointCalculator = require('../utils/pointCalculator');

class SWATEmbeds {
    // 🔧 ENHANCED: Personal stats with clean rank lock display and Discord timestamps
    static createPersonalStatsEmbed(user, discordUser, weeklyRank, allTimeRank, recentEvents = [], isPersonalStats = true) {
        try {
            const RankSystem = require('../utils/rankSystem');
            const ProgressBarGenerator = require('../utils/progressBar');
            
            const embed = new EmbedBuilder()
                .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
                .setTitle(`📊 ${user.username}'s SWAT Statistics`)
                .setThumbnail(discordUser.displayAvatarURL());

            // Current rank display
            const currentRank = RankSystem.formatRank(user);
            embed.addFields({
                name: 'Current Rank',
                value: currentRank,
                inline: true
            });

            // 🔧 ENHANCED: Clean rank lock status display with Discord timestamps
            const lockStatus = RankSystem.checkRankLockExpiry(user);
            
            // Only show rank lock field if user is actually locked
            if (!lockStatus.expired && lockStatus.daysRemaining && user.rankLockUntil) {
                const discordTimestamp = lockStatus.discordTimestamp || Math.floor(new Date(user.rankLockUntil).getTime() / 1000);
                
                embed.addFields({
                    name: '🔒 Rank Lock',
                    value: `Expires <t:${discordTimestamp}:R> (<t:${discordTimestamp}:f>)`,
                    inline: true
                });
            }

            // Rank progression (only for non-Executive ranks)
            if (RankSystem.isExecutiveOrHigher(user.rankLevel)) {
                embed.addFields({
                    name: '🎯 Weekly Quota',
                    value: 'No quota required',
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '🎯 Weekly Quota Progress',
                    value: ProgressBarGenerator.createQuotaProgressBar(user.weeklyPoints, user.weeklyQuota),
                    inline: false
                });
            }

            // 🔧 ENHANCED: Promotion eligibility with Discord timestamps
            const eligibility = RankSystem.checkPromotionEligibility(user);

            // Show promotion status for users who aren't at max rank
            if (eligibility.nextRank && !RankSystem.isExecutiveOrHigher(user.rankLevel)) {
                const pointsCheck = RankSystem.checkPointRequirements(user);
                
                if (pointsCheck.pointsMet && !eligibility.rankLocked) {
                    embed.addFields({
                        name: '🎯 Promotion Available!',
                        value: `✅ **ELIGIBLE** for promotion to **${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}**! Contact HR for review.`,
                        inline: false
                    });
                } else if (pointsCheck.pointsMet && eligibility.rankLocked) {
                    const discordTimestamp = eligibility.discordTimestamp || Math.floor(new Date(user.rankLockUntil).getTime() / 1000);
                    
                    embed.addFields({
                        name: '🎯 Promotion Status',
                        value: `✅ **Point requirements met!** You'll be eligible for promotion to **${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}** when your rank lock expires <t:${discordTimestamp}:R>.`,
                        inline: false
                    });
                } else if (!pointsCheck.pointsMet && eligibility.requirements) {
                    const pointsNeeded = eligibility.requirements.pointsRemaining;
                    embed.addFields({
                        name: '📈 Next Promotion',
                        value: `${pointsNeeded} more rank points needed for ${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}`,
                        inline: false
                    });
                }
            }

            

            // Performance stats
            embed.addFields(
                { 
                    name: '🏆 Weekly Rank', 
                    value: `#${weeklyRank}`, 
                    inline: true 
                },
                { 
                    name: '⭐ All-Time Points', 
                    value: `${user.allTimePoints} points`, 
                    inline: true 
                },
                { 
                    name: '🏅 All-Time Rank', 
                    value: `#${allTimeRank}`, 
                    inline: true 
                },
                { 
                    name: '📊 Events This Week', 
                    value: `${user.weeklyEvents} events`, 
                    inline: true 
                },
                { 
                    name: '🔥 Points Today', 
                    value: `${user.dailyPointsToday || 0} points`, 
                    inline: true 
                },
                { 
                    name: '📈 Total Events', 
                    value: `${user.totalEvents} events`, 
                    inline: true 
                }
            );

            embed.setFooter({ 
                text: user.isBooster ? 'Server Booster (2x Points) 💎' : 'Standard Points' 
            }).setTimestamp();

            // Add recent events with attendees info
            if (recentEvents.length > 0) {
                const recentEventsText = recentEvents
                    .map(event => {
                        const eventName = PointCalculator.getEventName(event.eventType);
                        let line = `• ${eventName} (${event.pointsAwarded}pts)`;
                        
                        // Add attendees info for tryouts
                        if (event.attendeesPassed && event.attendeesPassed > 0) {
                            line += ` [${event.attendeesPassed} passed]`;
                        }
                        
                        return line;
                    })
                    .join('\n');
                
                embed.addFields({ 
                    name: '📋 Recent Events (Last 5)', 
                    value: recentEventsText, 
                    inline: false 
                });
            }

            return embed;
            
        } catch (error) {
            console.error('❌ Enhanced stats embed error:', error);
            return this.createBasicPersonalStatsEmbed(user, discordUser, weeklyRank, allTimeRank, recentEvents);
        }
    }

    // 🔧 ISSUE #3 FIX: Enhanced leaderboard with better spacing and readability
    static async createEnhancedLeaderboardEmbed(users, type = 'weekly', enhancedStats = null) {
        try {
            const RankSystem = require('../utils/rankSystem');
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
                .setTimestamp();

            // Filter active users (with points > 0) and limit to 25
            const activeUsers = users.filter(user => {
                const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
                return points > 0;
            }).slice(0, 25);

            if (activeUsers.length === 0) {
                embed.setDescription('No active operators this period. Use `/submit-event` to get on the leaderboard!');
                return embed;
            }

            // 🔧 FIXED: Generate clean operator list with improved spacing
            const operatorLines = [];
            
            for (let i = 0; i < activeUsers.length; i++) {
                const user = activeUsers[i];
                const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
                const position = i + 1;
                
                // Clean design: Only rank emoji for Elite+ ranks
                const rankEmoji = RankSystem.isEliteOrHigher(user.rankLevel) ? 
                    `${RankSystem.getRankEmoji(user.rankLevel)} ` : '';
                
                // Clean design: Only trophy for #1, clean numbers for everyone else
                const positionDisplay = position === 1 ? '🏆' : `${position}.`;
                
                // 🔧 IMPROVED SPACING: Add extra space and formatting for better readability
                const line = `${positionDisplay} ${rankEmoji}**${user.username}** - ${points} pts`;
                operatorLines.push(line);
            }

            // 🔧 BETTER SPACING: Split into chunks with proper field organization
            const allOperatorsText = operatorLines.join('\n\n'); // 🔧 ADDED: Double newlines for better spacing
            
            if (allOperatorsText.length <= 1024) {
                embed.addFields({
                    name: `Rankings`,  // ✅ SIMPLE AND CLEAN
                    value: allOperatorsText,
                    inline: false
                });
            } else {
                // 🔧 IMPROVED: Split into two fields with better organization
                const midPoint = Math.ceil(operatorLines.length / 2);
                const firstHalf = operatorLines.slice(0, midPoint).join('\n\n'); // 🔧 ADDED: Double spacing
                const secondHalf = operatorLines.slice(midPoint).join('\n\n'); // 🔧 ADDED: Double spacing

                embed.addFields(
                    {
                        name: `Rankings`,  
                        value: firstHalf,
                        inline: false
                    },
                    {
                        name: `Rankings (continued)`,  
                        value: secondHalf,
                        inline: false
                    }
                );
            }

            // 🔧 ENHANCED: Add blank field for visual separation
            embed.addFields({
                name: '\u200b', // Invisible character for spacing
                value: '\u200b',
                inline: false
            });

            // Simple footer with better formatting
            embed.setFooter({ 
                text: `${activeUsers.length} active operator${activeUsers.length === 1 ? '' : 's'} • Use /submit-event to climb the ranks!` 
            });

            return embed;
            
        } catch (error) {
            console.error('❌ Enhanced leaderboard embed error:', error);
            return this.createBasicLeaderboardEmbed(users, type);
        }
    }

    // Clean basic leaderboard embed (fallback)
    static createBasicLeaderboardEmbed(users, type = 'weekly') {
        const RankSystem = require('../utils/rankSystem');
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
            .setTimestamp();

        // Filter active users
        const activeUsers = users.filter(user => {
            const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
            return points > 0;
        }).slice(0, 25);

        if (activeUsers.length === 0) {
            embed.setDescription('No active operators this period. Use `/submit-event` to get on the leaderboard!');
            return embed;
        }

        // Clean list with better spacing
        const operatorLines = [];
        
        for (let i = 0; i < activeUsers.length; i++) {
            const user = activeUsers[i];
            const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
            const rankEmoji = RankSystem.isEliteOrHigher(user.rankLevel) ? 
                `${RankSystem.getRankEmoji(user.rankLevel)} ` : '';
            const positionDisplay = i === 0 ? '🏆' : `${i + 1}.`;
            
            operatorLines.push(`${positionDisplay} ${rankEmoji}**${user.username}** - ${points} pts`);
        }

        embed.addFields({
            name: 'Rankings',
            value: operatorLines.join('\n\n'), // 🔧 ADDED: Double spacing for fallback too
            inline: false
        });

        embed.setFooter({ 
            text: `${activeUsers.length} active operator${activeUsers.length === 1 ? '' : 's'}` 
        });

        return embed;
    }

    // Standard embed methods (keeping existing functionality)
    static createEventSubmissionEmbed(user, eventType, description, actualPoints, basePoints, isBooster, screenshot) {
        const embed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
            .setTitle('✅ Event Submitted Successfully!')
            .setDescription(`**${PointCalculator.getEventName(eventType)}**`)
            .addFields(
                { 
                    name: '📊 Points Awarded', 
                    value: isBooster ? 
                        `${actualPoints} points (${basePoints} base × 2 booster bonus)` : 
                        `${actualPoints} points`, 
                    inline: true 
                },
                { 
                    name: '📈 Weekly Progress', 
                    value: `${user.weeklyPoints}/${user.weeklyQuota} points`, 
                    inline: true 
                },
                { 
                    name: '🎯 Quota Status', 
                    value: user.quotaCompleted ? '✅ Completed!' : '⏳ In Progress', 
                    inline: true 
                },
                { 
                    name: '📝 Description', 
                    value: description, 
                    inline: false 
                }
            )
            .setThumbnail(screenshot.url)
            .setFooter({ 
                text: `Total Events: ${user.totalEvents}` 
            })
            .setTimestamp();

        if (user.quotaCompleted && user.weeklyPoints - actualPoints < user.weeklyQuota) {
            embed.setDescription(embed.data.description + '\n\n🎉 **Congratulations! You\'ve completed your weekly quota!**');
        }

        return embed;
    }

    static createNoStatsEmbed() {
        return new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('📊 No Statistics Found')
            .setDescription('You haven\'t submitted any events yet! Use `/submit-event` to get started and begin tracking your SWAT performance.')
            .addFields(
                { name: '🎯 Weekly Quota', value: '10 points', inline: true },
                { name: '📈 Get Started', value: 'Submit your first event!', inline: true }
            )
            .setTimestamp();
    }

    static createErrorEmbed(message) {
        return new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Error')
            .setDescription(message)
            .setTimestamp();
    }

    static createPermissionErrorEmbed() {
        return new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Permission Denied')
            .setDescription('You need the "Special Weapons and Tactics" or "HR" role to submit events!')
            .setTimestamp();
    }

    static createEmptyLeaderboardEmbed(type = 'weekly') {
        return new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle(`SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
            .setDescription('No operators found on the leaderboard yet!\n\nUse `/submit-event` to start earning points and climb the ranks!')
            .addFields(
                { name: '🎯 Weekly Quota', value: '10 points', inline: true },
                { name: '📈 Get Started', value: 'Submit your first event!', inline: true }
            )
            .setTimestamp();
    }
}

module.exports = SWATEmbeds;