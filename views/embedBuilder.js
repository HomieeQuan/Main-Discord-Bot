// views/embedBuilder.js
const { EmbedBuilder } = require('discord.js');
const PointCalculator = require('../utils/pointCalculator');

class SWATEmbeds {
    // Creates the embed shown when someone submits an event
    static createEventSubmissionEmbed(user, eventType, description, actualPoints, basePoints, isBooster, screenshot) {
        const embed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')  // Green if quota complete, orange if not
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
            .setThumbnail(screenshot.url)  // Shows the screenshot
            .setFooter({ 
                text: `Total Events: ${user.totalEvents}` 
            })
            .setTimestamp();

        // Add special message if they just completed quota
        if (user.quotaCompleted && user.weeklyPoints - actualPoints < user.weeklyQuota) {
            embed.setDescription(embed.data.description + '\n\n🎉 **Congratulations! You\'ve completed your weekly quota!**');
        }

        return embed;
    }

    // NEW: Creates embed for personal stats
    static createPersonalStatsEmbed(user, discordUser, weeklyRank, allTimeRank, recentEvents = []) {
        const embed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')  // Green if quota complete
            .setTitle(`📊 ${discordUser.username}'s SWAT Statistics`)
            .setThumbnail(discordUser.displayAvatarURL())
            .addFields(
                { 
                    name: '🎯 Weekly Quota Progress', 
                    value: `${user.weeklyPoints}/${user.weeklyQuota} points ${user.quotaCompleted ? '✅' : '⏳'}`, 
                    inline: true 
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
                    name: '📊 Total Events', 
                    value: `${user.totalEvents} events`, 
                    inline: true 
                }
            )
            .setFooter({ 
                text: user.isBooster ? 'Server Booster (2x Points) 💎' : 'Standard Points' 
            })
            .setTimestamp();

        // Add recent events if any
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

    // NEW: Creates embed when user has no stats yet
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

    // Creates embed for error messages
    static createErrorEmbed(message) {
        return new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Error')
            .setDescription(message)
            .setTimestamp();
    }

    // Creates embed for permission errors
    static createPermissionErrorEmbed() {
        return new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Permission Denied')
            .setDescription('You need the "Special Weapons and Tactics" or "HR" role to submit events!')
            .setTimestamp();
    }

    // Add this method to your SWATEmbeds class in views/embedBuilder.js

    static createEventSubmissionEmbedWithQuantity(user, eventType, description, totalPoints, pointsPerEvent, isBooster, screenshot, quantity) {
        const embed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
            .setTitle('✅ Event(s) Submitted Successfully!')
            .setDescription(`**${PointCalculator.getEventName(eventType)}** ${quantity > 1 ? `(x${quantity})` : ''}`)
            .addFields(
                { 
                    name: '📊 Points Awarded', 
                    value: quantity > 1 ? 
                        `${totalPoints} points (${pointsPerEvent} per event × ${quantity} events${isBooster ? ' × 2 booster' : ''})` :
                        isBooster ? 
                            `${totalPoints} points (${pointsPerEvent/2} base × 2 booster bonus)` : 
                            `${totalPoints} points`, 
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

        // Add quota completion message
        if (user.quotaCompleted && user.weeklyPoints - totalPoints < user.weeklyQuota) {
            embed.setDescription(embed.data.description + '\n\n🎉 **Congratulations! You\'ve completed your weekly quota!**');
        }

        return embed;
    }

            // Creates leaderboard embed
    static createLeaderboardEmbed(users, type = 'weekly', totalUsers = 0, completedQuota = 0) {
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`🏆 SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
            .setDescription(`Top ${Math.min(users.length, 50)} Operators`)
            .setTimestamp();

        // Generate leaderboard text
        let topThreeText = '';
        let restOfLeaderboard = '';

        for (let i = 0; i < Math.min(users.length, 50); i++) {
            const user = users[i];
            const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
            const quota = type === 'weekly' ? (user.quotaCompleted ? ' ✅' : ' ⏳') : '';
            
            let medal = '';
            if (i === 0) medal = '🥇';
            else if (i === 1) medal = '🥈';
            else if (i === 2) medal = '🥉';
            else medal = `${i + 1}.`;

            const line = `${medal} **${user.username}** - ${points} pts${quota}\n`;
            
            if (i < 3) {
                topThreeText += line;
            } else if (i < 15) { // Show top 15 in main section
                restOfLeaderboard += line;
            }
        }

        // Add top 3 as special field
        if (topThreeText) {
            embed.addFields({ 
                name: '🏆 Top 3 Operators', 
                value: topThreeText, 
                inline: false 
            });
        }

        // Add rest of leaderboard
        if (restOfLeaderboard) {
            embed.addFields({ 
                name: '📊 Rankings', 
                value: restOfLeaderboard, 
                inline: false 
            });
        }

        // Add statistics for weekly leaderboard
        if (type === 'weekly' && totalUsers > 0) {
            const averagePoints = users.length > 0 ? 
                (users.reduce((sum, u) => sum + u.weeklyPoints, 0) / users.length).toFixed(1) : 0;

            embed.addFields({ 
                name: '📈 Weekly Statistics', 
                value: `**Total Operators:** ${totalUsers}\n**Quota Completed:** ${completedQuota}/${totalUsers}\n**Average Points:** ${averagePoints}`, 
                inline: false 
            });
        }

        return embed;
    }

    static async createEnhancedLeaderboardEmbed(users, type = 'weekly', enhancedStats = null) {
        const { EmbedBuilder } = require('discord.js');
        const ProgressBarGenerator = require('../utils/progressBar');
        const StatisticsController = require('../controllers/statisticsController');
        
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`🏆 SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
            .setDescription(`Top ${Math.min(users.length, 50)} Operators`)
            .setTimestamp();
    
        // Generate enhanced leaderboard text with trends
        let topThreeText = '';
        let restOfLeaderboard = '';
    
        for (let i = 0; i < Math.min(users.length, 15); i++) {
            const user = users[i];
            const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
            
            let medal = '';
            if (i === 0) medal = '🥇';
            else if (i === 1) medal = '🥈';
            else if (i === 2) medal = '🥉';
            else medal = `${i + 1}.`;
    
            // Get trend for this user
            const trend = await StatisticsController.calculateUserTrend(user.discordId);
            
            // Create progress bar for weekly leaderboard
            let progressInfo = '';
            if (type === 'weekly') {
                const quota = user.quotaCompleted ? '✅' : '⏳';
                const miniBar = ProgressBarGenerator.createMiniProgressBar(user.weeklyPoints, user.weeklyQuota);
                progressInfo = ` ${miniBar}`;
            }
    
            // Build line with trend indicator
            const trendText = trend.direction + (trend.rankChange > 0 ? ` (+${trend.rankChange})` : '');
            const dailyPoints = trend.pointsToday > 0 ? ` 🔥${trend.pointsToday}` : '';
            
            const line = `${medal} **${user.username}** - ${points} pts${progressInfo} ${trendText}${dailyPoints}\n`;
            
            if (i < 3) {
                topThreeText += line;
            } else {
                restOfLeaderboard += line;
            }
        }
    
        // Add top 3 operators
        if (topThreeText) {
            embed.addFields({ 
                name: '🏆 Top 3 Operators', 
                value: topThreeText, 
                inline: false 
            });
        }
    
        // Add rest of leaderboard
        if (restOfLeaderboard) {
            embed.addFields({ 
                name: '📊 Rankings', 
                value: restOfLeaderboard, 
                inline: false 
            });
        }
    
        // Add enhanced statistics (only for weekly)
        if (type === 'weekly' && enhancedStats) {
            let statsText = `**Total Operators:** ${enhancedStats.totalOperators}\n`;
            statsText += `**Quota Completed:** ${enhancedStats.quotaCompleted}/${enhancedStats.totalOperators} (${enhancedStats.quotaRate}%)\n`;
            statsText += `**Average Points:** ${enhancedStats.averagePoints}\n`;
            statsText += `**Average Events:** ${enhancedStats.averageEvents} per operator`;
    
            embed.addFields({ 
                name: '📈 Weekly Statistics', 
                value: statsText, 
                inline: false 
            });
    
            // Add performance highlights
            let highlightsText = '';
            if (enhancedStats.mostActive) {
                highlightsText += `🔥 **Most Active:** ${enhancedStats.mostActive.username} (${enhancedStats.mostActive.weeklyEvents} events)\n`;
            }
            if (enhancedStats.biggestGainer && enhancedStats.biggestGainer.dailyPointsToday > 0) {
                highlightsText += `⚡ **Today's Top Performer:** ${enhancedStats.biggestGainer.username} (+${enhancedStats.biggestGainer.dailyPointsToday} pts today)`;
            }
    
            if (highlightsText) {
                embed.addFields({ 
                    name: '🌟 Performance Highlights', 
                    value: highlightsText, 
                    inline: false 
                });
            }
        }
    
        // Add legend
        embed.addFields({ 
            name: '📖 Legend', 
            value: '⬆️ Rank improved • ⬇️ Rank dropped • ➡️ No change • 🔥 Points earned today\n[████░░░░] Progress bar • ✅ Quota complete • ⏳ In progress', 
            inline: false 
        });
    
        return embed;
    }

    static createPersonalStatsEmbed(user, discordUser, weeklyRank, allTimeRank, recentEvents = []) {
        const ProgressBarGenerator = require('../utils/progressBar');
        
        const embed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
            .setTitle(`📊 ${discordUser.username}'s SWAT Statistics`)
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
    
        // Add recent events if any
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

    // Creates embed when no users found
    static createEmptyLeaderboardEmbed(type = 'weekly') {
        return new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle(`🏆 SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
            .setDescription('No operators found on the leaderboard yet!\n\nUse `/submit-event` to start earning points and climb the ranks!')
            .addFields(
                { name: '🎯 Weekly Quota', value: '10 points', inline: true },
                { name: '📈 Get Started', value: 'Submit your first event!', inline: true }
            )
            .setTimestamp();
    }
}

module.exports = SWATEmbeds;