// views/embedBuilder.js - FIXED clean rank lock display for null values
const { EmbedBuilder } = require('discord.js');
const PointCalculator = require('../utils/pointCalculator');

class SWATEmbeds {
    // 🔧 FIXED: Enhanced personal stats with clean rank lock display
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

            // 🔧 FIXED: Clean rank lock status display
            const lockStatus = RankSystem.checkRankLockExpiry(user);
            
            // Only show rank lock field if user is actually locked
            if (!lockStatus.expired && lockStatus.daysRemaining && user.rankLockUntil) {
                embed.addFields({
                    name: '🔒 Rank Lock',
                    value: `${lockStatus.daysRemaining} day${lockStatus.daysRemaining > 1 ? 's' : ''} remaining`,
                    inline: true
                });
            }
            // Don't show anything for null rank locks - cleaner display

            // Rank progression (only for non-Executive ranks)
            if (!RankSystem.isExecutiveOrHigher(user.rankLevel)) {
                const rankProgress = RankSystem.createRankProgressBar(user);
                embed.addFields({
                    name: '📈 Rank Progress',
                    value: rankProgress,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '👑 Executive Status',
                    value: 'Hand-picked rank - no point requirements',
                    inline: false
                });
            }

            // Weekly quota progress
            embed.addFields({
                name: '🎯 Weekly Quota Progress',
                value: ProgressBarGenerator.createQuotaProgressBar(user.weeklyPoints, user.weeklyQuota),
                inline: false
            });

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

            // Promotion eligibility notification
            if (user.promotionEligible) {
                const eligibility = RankSystem.checkPromotionEligibility(user);
                if (eligibility.eligible && eligibility.nextRank) {
                    embed.addFields({
                        name: '🎯 Promotion Available!',
                        value: `Eligible for promotion to **${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}**! Contact HR for review.`,
                        inline: false
                    });
                }
            }

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
            // Fallback to basic embed
            return this.createBasicPersonalStatsEmbed(user, discordUser, weeklyRank, allTimeRank, recentEvents);
        }
    }

    // Clean minimal leaderboard - No trophy spam, simple design
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

            // Generate clean operator list
            const operatorLines = [];
            
            for (let i = 0; i < activeUsers.length; i++) {
                const user = activeUsers[i];
                const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
                const position = i + 1;
                
                // CLEAN DESIGN: Only rank emoji for Elite+ ranks
                const rankEmoji = RankSystem.isEliteOrHigher(user.rankLevel) ? 
                    `${RankSystem.getRankEmoji(user.rankLevel)} ` : '';
                
                // CLEAN DESIGN: Only trophy for #1, simple numbers for everyone else
                const positionDisplay = position === 1 ? '🏆' : `${position}.`;
                
                const line = `${positionDisplay} ${rankEmoji}**${user.username}** - ${points} pts`;
                operatorLines.push(line);
            }

            // Split into chunks if needed (Discord 1024 char limit per field)
            const allOperatorsText = operatorLines.join('\n');
            
            if (allOperatorsText.length <= 1024) {
                embed.addFields({
                    name: 'Rankings',
                    value: allOperatorsText,
                    inline: false
                });
            } else {
                // Split into two fields if too long
                const midPoint = Math.ceil(operatorLines.length / 2);
                const firstHalf = operatorLines.slice(0, midPoint).join('\n');
                const secondHalf = operatorLines.slice(midPoint).join('\n');

                embed.addFields(
                    {
                        name: 'Rankings',
                        value: firstHalf,
                        inline: false
                    },
                    {
                        name: 'Rankings (continued)',
                        value: secondHalf,
                        inline: false
                    }
                );
            }

            // Simple footer
            embed.setFooter({ 
                text: `${activeUsers.length} active operator${activeUsers.length === 1 ? '' : 's'}` 
            });

            return embed;
            
        } catch (error) {
            console.error('❌ Clean leaderboard embed error:', error);
            // Fallback to basic leaderboard
            return this.createBasicLeaderboardEmbed(users, type);
        }
    }

    // 🔧 FIXED: Fallback basic personal stats embed with clean rank lock display
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
    
            // 🔧 FIXED: Clean rank lock status display with safe null checks
            const lockStatus = RankSystem.checkRankLockExpiry(user);
            
            // Only show rank lock field if user is actually locked
            if (!lockStatus.expired && lockStatus.daysRemaining && user.rankLockUntil) {
                embed.addFields({
                    name: '🔒 Rank Lock',
                    value: `${lockStatus.daysRemaining} day${lockStatus.daysRemaining > 1 ? 's' : ''} remaining`,
                    inline: true
                });
            }
    
            // 🔧 FIXED: Rank progression with safe null checks (only for non-Executive ranks)
            if (!RankSystem.isExecutiveOrHigher(user.rankLevel)) {
                const rankProgress = RankSystem.createRankProgressBar(user);
                embed.addFields({
                    name: '📈 Rank Progress',
                    value: rankProgress,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: '👑 Executive Status',
                    value: 'Hand-picked rank - no point requirements',
                    inline: false
                });
            }
    
            // 🔧 FIXED: Weekly quota progress with safe null checks
            embed.addFields({
                name: '🎯 Weekly Quota Progress',
                value: ProgressBarGenerator.createQuotaProgressBar(user.weeklyPoints || 0, user.weeklyQuota || 10),
                inline: false
            });
    
            // 🔧 FIXED: Performance stats with safe null checks
            embed.addFields(
                { 
                    name: '🏆 Weekly Rank', 
                    value: `#${weeklyRank}`, 
                    inline: true 
                },
                { 
                    name: '⭐ All-Time Points', 
                    value: `${user.allTimePoints || 0} points`, 
                    inline: true 
                },
                { 
                    name: '🏅 All-Time Rank', 
                    value: `#${allTimeRank}`, 
                    inline: true 
                },
                { 
                    name: '📊 Events This Week', 
                    value: `${user.weeklyEvents || 0} events`, 
                    inline: true 
                },
                { 
                    name: '🔥 Points Today', 
                    value: `${user.dailyPointsToday || 0} points`, 
                    inline: true 
                },
                { 
                    name: '📈 Total Events', 
                    value: `${user.totalEvents || 0} events`, 
                    inline: true 
                }
            );
    
            // 🔧 FIXED: Promotion eligibility notification with safe checks
            if (user.promotionEligible) {
                const eligibility = RankSystem.checkPromotionEligibility(user);
                if (eligibility.eligible && eligibility.nextRank) {
                    embed.addFields({
                        name: '🎯 Promotion Available!',
                        value: `Eligible for promotion to **${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}**! Contact HR for review.`,
                        inline: false
                    });
                }
            }
    
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
            // Fallback to basic embed
            return this.createBasicPersonalStatsEmbed(user, discordUser, weeklyRank, allTimeRank, recentEvents);
        }
    }

    // Clean basic leaderboard embed
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

        // Clean list
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
            value: operatorLines.join('\n'),
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