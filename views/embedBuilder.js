// views/embedBuilder.js - Enhanced with rank system integration and clean leaderboard
const { EmbedBuilder } = require('discord.js');
const PointCalculator = require('../utils/pointCalculator');

class SWATEmbeds {
    // Enhanced personal stats with rank progression
    static createPersonalStatsEmbed(user, discordUser, weeklyRank, allTimeRank, recentEvents = []) {
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
                name: '🎖️ Current Rank',
                value: currentRank,
                inline: true
            });

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
                    inline: true
                });
            }

            // Rank lock status
            const lockStatus = RankSystem.checkRankLockExpiry(user);
            if (!lockStatus.expired && lockStatus.daysRemaining) {
                embed.addFields({
                    name: '🔒 Rank Lock',
                    value: `${lockStatus.daysRemaining} days remaining`,
                    inline: true
                });
            } else if (lockStatus.expired) {
                embed.addFields({
                    name: '🔓 Rank Status',
                    value: 'Available for promotion',
                    inline: true
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
                    name: '📈 Events This Week', 
                    value: `${user.weeklyEvents} events`, 
                    inline: true 
                },
                { 
                    name: '🔥 Points Today', 
                    value: `${user.dailyPointsToday || 0} points`, 
                    inline: true 
                },
                { 
                    name: '📊 Total Events', 
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
    }// CLEAN MINIMAL LEADERBOARD - NEW DESIGN
    static async createEnhancedLeaderboardEmbed(users, type = 'weekly', enhancedStats = null) {
        try {
            const RankSystem = require('../utils/rankSystem');
            const StatisticsController = require('../controllers/statisticsController');
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`🏆 SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
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

            // Generate top operator (always #1)
            const topOperator = activeUsers[0];
            const topPoints = type === 'weekly' ? topOperator.weeklyPoints : topOperator.allTimePoints;
            const topTrend = await this.calculateTrendIndicator(topOperator, 1);
            const topRankEmoji = RankSystem.isEliteOrHigher(topOperator.rankLevel) ? 
                `${RankSystem.getRankEmoji(topOperator.rankLevel)} ` : '';

            const topOperatorText = `🏆 ${topRankEmoji}**${topOperator.username}** - ${topPoints} points ${topTrend}`;

            embed.addFields({
                name: '🏆 Top Operator',
                value: topOperatorText,
                inline: false
            });

            // Generate all other operators (if more than 1)
            if (activeUsers.length > 1) {
                const otherOperators = [];
                
                for (let i = 1; i < activeUsers.length; i++) {
                    const user = activeUsers[i];
                    const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
                    const position = i + 1;
                    const trend = await this.calculateTrendIndicator(user, position);
                    const rankEmoji = RankSystem.isEliteOrHigher(user.rankLevel) ? 
                        `${RankSystem.getRankEmoji(user.rankLevel)} ` : '';

                    const line = `${position}. ${rankEmoji}**${user.username}** - ${points} points ${trend}`;
                    otherOperators.push(line);
                }

                // Split into chunks if too long for one field (Discord has 1024 char limit per field)
                const operatorText = otherOperators.join('\n');
                
                if (operatorText.length <= 1024) {
                    embed.addFields({
                        name: '📊 All Operators',
                        value: operatorText,
                        inline: false
                    });
                } else {
                    // Split into multiple fields if too long
                    const midPoint = Math.ceil(otherOperators.length / 2);
                    const firstHalf = otherOperators.slice(0, midPoint).join('\n');
                    const secondHalf = otherOperators.slice(midPoint).join('\n');

                    embed.addFields(
                        {
                            name: '📊 All Operators',
                            value: firstHalf,
                            inline: false
                        },
                        {
                            name: '📊 All Operators (continued)',
                            value: secondHalf,
                            inline: false
                        }
                    );
                }
            }

            // Add simple footer with count
            embed.setFooter({ 
                text: `Showing ${activeUsers.length} active operator${activeUsers.length === 1 ? '' : 's'}` 
            });

            return embed;
            
        } catch (error) {
            console.error('❌ Clean leaderboard embed error:', error);
            // Fallback to basic leaderboard
            return this.createBasicLeaderboardEmbed(users, type);
        }
    }

    // Helper method to calculate trend indicators
    static async calculateTrendIndicator(user, currentPosition) {
        try {
            const StatisticsController = require('../controllers/statisticsController');
            
            // Check if user has a previous rank stored
            const previousRank = user.previousRank;
            
            if (!previousRank || previousRank === 0) {
                // New user to leaderboard
                return '🆕';
            }
            
            const rankChange = previousRank - currentPosition;
            
            if (rankChange > 0) {
                // Moved up
                return `⬆️${rankChange}`;
            } else if (rankChange < 0) {
                // Moved down
                return `⬇️${Math.abs(rankChange)}`;
            } else {
                // No change
                return '➡️';
            }
            
        } catch (error) {
            console.error('❌ Trend calculation error:', error);
            return ''; // Return empty if calculation fails
        }
    }// Fallback basic personal stats embed (in case rank system fails)
    // Fallback basic personal stats embed (in case rank system fails)
    static createBasicPersonalStatsEmbed(user, discordUser, weeklyRank, allTimeRank, recentEvents = []) {
        const ProgressBarGenerator = require('../utils/progressBar');
        
        const embed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
            .setTitle(`📊 ${user.username}'s SWAT Statistics`)
            .setThumbnail(discordUser.displayAvatarURL())
            .addFields(
                { 
                    name: '🎯 Weekly Quota Progress', 
                    value: ProgressBarGenerator.createQuotaProgressBar(user.weeklyPoints, user.weeklyQuota), 
                    inline: false 
                },
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
                    name: '📈 Events This Week', 
                    value: `${user.weeklyEvents} events`, 
                    inline: true 
                },
                { 
                    name: '🔥 Points Today', 
                    value: `${user.dailyPointsToday || 0} points`, 
                    inline: true 
                },
                { 
                    name: '📊 Total Events', 
                    value: `${user.totalEvents} events`, 
                    inline: true 
                }
            )
            .setFooter({ 
                text: user.isBooster ? 'Server Booster (2x Points) 💎' : 'Standard Points' 
            })
            .setTimestamp();

        if (recentEvents.length > 0) {
            const recentEventsText = recentEvents
                .map(event => `• ${PointCalculator.getEventName(event.eventType)} (${event.pointsAwarded}pts)`)
                .join('\n');
            
            embed.addFields({ 
                name: '📋 Recent Events (Last 5)', 
                value: recentEventsText, 
                inline: false 
            });
        }

        return embed;
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

        // Top operator
        const topOperator = activeUsers[0];
        const topPoints = type === 'weekly' ? topOperator.weeklyPoints : topOperator.allTimePoints;
        const topRankEmoji = RankSystem.isEliteOrHigher(topOperator.rankLevel) ? 
            `${RankSystem.getRankEmoji(topOperator.rankLevel)} ` : '';

        embed.addFields({
            name: '🏆 Top Operator',
            value: `🏆 ${topRankEmoji}**${topOperator.username}** - ${topPoints} points`,
            inline: false
        });

        // Other operators
        if (activeUsers.length > 1) {
            const otherOperators = [];
            
            for (let i = 1; i < activeUsers.length; i++) {
                const user = activeUsers[i];
                const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
                const rankEmoji = RankSystem.isEliteOrHigher(user.rankLevel) ? 
                    `${RankSystem.getRankEmoji(user.rankLevel)} ` : '';

                otherOperators.push(`${i + 1}. ${rankEmoji}**${user.username}** - ${points} points`);
            }

            embed.addFields({
                name: '📊 All Operators',
                value: otherOperators.join('\n'),
                inline: false
            });
        }

        embed.setFooter({ 
            text: `Showing ${activeUsers.length} active operator${activeUsers.length === 1 ? '' : 's'}` 
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