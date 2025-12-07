// controllers/leaderboardController.js - UPDATED: Paginated leaderboards with navigation buttons
const SWATUser = require('../models/SWATUser');
const SWATEmbeds = require('../views/embedBuilder');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const RankSystem = require('../utils/rankSystem');

class LeaderboardController {
    // Enhanced weekly leaderboard (SWAT + CMU combined) with pagination
    static async getWeeklyLeaderboard(interaction) {
        try {
            console.log('📊 Starting weekly leaderboard (SWAT + CMU combined)...');
            
            // Get ALL users sorted by weekly points
            const users = await SWATUser.find({})
                .sort({ weeklyPoints: -1 });

            if (users.length === 0) {
                const emptyEmbed = this.createEmptyLeaderboardEmbed('weekly');
                return await interaction.reply({ embeds: [emptyEmbed] });
            }

            // Get enhanced statistics
            const StatisticsController = require('./statisticsController');
            const enhancedStats = await StatisticsController.getEnhancedStatistics();

            // Start on page 1
            const page = 1;
            const totalPages = Math.ceil(users.length / 10);

            // Create first page embed and buttons
            const { embed, components } = await this.createPaginatedLeaderboardEmbed(
                users, 
                'weekly', 
                page,
                totalPages,
                enhancedStats
            );

            const message = await interaction.reply({ 
                embeds: [embed], 
                components: components,
                fetchReply: true 
            });

            // Set up button collector if there are multiple pages
            if (totalPages > 1) {
                this.setupPagination(message, users, 'weekly', enhancedStats);
            }

        } catch (error) {
            console.error('❌ Enhanced weekly leaderboard error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve weekly leaderboard. Please try again later.');
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }

    // Enhanced all-time leaderboard (SWAT + CMU combined) with pagination
    static async getAllTimeLeaderboard(interaction) {
        try {
            console.log('📊 Starting all-time leaderboard (SWAT + CMU combined)...');
            
            // Get ALL users sorted by all-time points
            const users = await SWATUser.find({})
                .sort({ allTimePoints: -1 });

            if (users.length === 0) {
                const emptyEmbed = this.createEmptyLeaderboardEmbed('alltime');
                return await interaction.reply({ embeds: [emptyEmbed] });
            }

            // Start on page 1
            const page = 1;
            const totalPages = Math.ceil(users.length / 10);

            // Create first page embed and buttons
            const { embed, components } = await this.createPaginatedLeaderboardEmbed(
                users, 
                'alltime', 
                page,
                totalPages,
                null
            );

            const message = await interaction.reply({ 
                embeds: [embed], 
                components: components,
                fetchReply: true 
            });

            // Set up button collector if there are multiple pages
            if (totalPages > 1) {
                this.setupPagination(message, users, 'alltime', null);
            }

        } catch (error) {
            console.error('❌ All-time leaderboard error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve all-time leaderboard. Please try again later.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }

    // Create empty leaderboard embed
    static createEmptyLeaderboardEmbed(type) {
        return new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📊 SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
            .setDescription('No members have submitted events yet.')
            .addFields({
                name: '💡 Get Started',
                value: 'Use `/submit-event` to start earning points!',
                inline: false
            })
            .setTimestamp();
    }

    // Create paginated leaderboard embed (10 users per page)
    static async createPaginatedLeaderboardEmbed(users, type, page, totalPages, stats = null) {
        const startIndex = (page - 1) * 10;
        const endIndex = Math.min(startIndex + 10, users.length);
        const pageUsers = users.slice(startIndex, endIndex);

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📊 SWAT ${type === 'weekly' ? 'Weekly' : 'All-Time'} Leaderboard`)
            .setDescription(`Showing ranks ${startIndex + 1}-${endIndex} of ${users.length} members`)
            .setTimestamp();

        // Add enhanced statistics for weekly leaderboards (only on page 1)
        if (page === 1 && type === 'weekly' && stats) {
            const swatCount = users.filter(u => (u.unit || 'SWAT') === 'SWAT').length;
            const cmuCount = users.filter(u => u.unit === 'CMU').length;
            
            let statsText = `**Total Members:** ${stats.totalOperators} (🛡️ ${swatCount} SWAT • 🏥 ${cmuCount} CMU)\n`;
            statsText += `**Quota Completed:** ${stats.quotaCompleted}/${stats.totalOperators} (${stats.quotaRate}%)\n`;
            statsText += `**Average Points:** ${stats.averagePoints}\n`;
            
            if (stats.mostActive) {
                const mostActiveDivision = stats.mostActive.unit === 'CMU' ? '🏥' : '🛡️';
                statsText += `**Most Active:** ${stats.mostActive.username} ${mostActiveDivision} (${stats.mostActive.weeklyEvents} events)`;
            }
            
            embed.addFields({
                name: '📈 Weekly Statistics',
                value: statsText,
                inline: false
            });
        }

        // Format users on this page
        let rankingsText = '';
        for (let i = 0; i < pageUsers.length; i++) {
            const user = pageUsers[i];
            const rank = startIndex + i + 1;
            
            // Medal for top 3
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
            
            // Get division emoji only
            const divisionEmoji = user.unit === 'CMU' ? '🏥' : '🛡️';
            
            // Get specialized unit badge
            const unitBadge = user.specializedUnit === 'SOG' ? '⚔️' : 
                            user.specializedUnit === 'TET' ? '🎓' : '';
            
            const points = type === 'weekly' ? user.weeklyPoints : user.allTimePoints;
            
            rankingsText += `${medal} **${user.username}** ${divisionEmoji}${unitBadge}\n`;
            rankingsText += `   └ ${points} pts\n`;
        }

        embed.addFields({
            name: page === 1 ? '🏆 Top 10' : `📋 Rankings ${startIndex + 1}-${endIndex}`,
            value: rankingsText || 'No data',
            inline: false
        });

        // Add legend (only on page 1)
        if (page === 1) {
            const legendText = '🥇🥈🥉 Top 3 Positions\n🛡️ SWAT • 🏥 CMU • ⚔️ SOG • 🎓 TET';
            
            embed.addFields({
                name: '📖 Legend',
                value: legendText,
                inline: false
            });
        }

        // Add page number to footer
        embed.setFooter({ text: `Page ${page}/${totalPages}` });

        // Create navigation buttons
        const components = this.createNavigationButtons(page, totalPages);

        return { embed, components };
    }

    // Create navigation buttons
    static createNavigationButtons(currentPage, totalPages) {
        if (totalPages <= 1) return [];

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('leaderboard_first')
                    .setLabel('⏮️ First')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId('leaderboard_prev')
                    .setLabel('◀️ Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 1),
                new ButtonBuilder()
                    .setCustomId('leaderboard_page')
                    .setLabel(`${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('leaderboard_next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages),
                new ButtonBuilder()
                    .setCustomId('leaderboard_last')
                    .setLabel('Last ⏭️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage === totalPages)
            );

        return [row];
    }

    // Set up pagination collector
    static setupPagination(message, users, type, stats) {
        let currentPage = 1;
        const totalPages = Math.ceil(users.length / 10);

        const collector = message.createMessageComponentCollector({
            filter: i => i.customId.startsWith('leaderboard_'),
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            // Handle button clicks
            if (i.customId === 'leaderboard_first') {
                currentPage = 1;
            } else if (i.customId === 'leaderboard_prev') {
                currentPage = Math.max(1, currentPage - 1);
            } else if (i.customId === 'leaderboard_next') {
                currentPage = Math.min(totalPages, currentPage + 1);
            } else if (i.customId === 'leaderboard_last') {
                currentPage = totalPages;
            }

            // Update the message with new page
            const { embed, components } = await this.createPaginatedLeaderboardEmbed(
                users,
                type,
                currentPage,
                totalPages,
                currentPage === 1 ? stats : null // Only show stats on page 1
            );

            await i.update({ embeds: [embed], components: components });
        });

        collector.on('end', async () => {
            // Disable buttons when collector expires
            try {
                const disabledComponents = this.createNavigationButtons(currentPage, totalPages);
                disabledComponents[0].components.forEach(button => {
                    if (!button.data.disabled) {
                        button.setDisabled(true);
                    }
                });
                
                await message.edit({ components: disabledComponents });
            } catch (error) {
                console.log('Could not disable buttons:', error.message);
            }
        });
    }

    // Enhanced user position with progress bars
    static async getUserPosition(interaction, targetUser) {
        try {
            const user = await SWATUser.findOne({ discordId: targetUser.id });
            
            if (!user) {
                const errorEmbed = SWATEmbeds.createErrorEmbed(`${targetUser.username} hasn't submitted any events yet.`);
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            const unit = user.unit || 'SWAT';
            const divisionEmoji = division === 'CMU' ? '🏥' : '🛡️';

            // Calculate positions (overall only - no division split)
            const weeklyRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints } 
            }) + 1;

            const allTimeRank = await SWATUser.countDocuments({ 
                allTimePoints: { $gt: user.allTimePoints } 
            }) + 1;

            // Get trend information
            const StatisticsController = require('./statisticsController');
            const trend = await StatisticsController.calculateUserTrend(user.discordId);

            // Create progress bar
            const ProgressBarGenerator = require('../utils/progressBar');
            const quotaProgress = ProgressBarGenerator.createQuotaProgressBar(user.weeklyPoints, user.weeklyQuota);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${divisionEmoji} ${targetUser.username}'s Leaderboard Position`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { 
                        name: '🎯 Weekly Quota Progress', 
                        value: quotaProgress, 
                        inline: false 
                    },
                    { 
                        name: '🏆 Weekly Rank', 
                        value: `#${weeklyRank} ${trend.direction}`, 
                        inline: true 
                    },
                    { 
                        name: '🏅 All-Time Rank', 
                        value: `#${allTimeRank} (${user.allTimePoints} pts)`, 
                        inline: true 
                    },
                    { 
                        name: '🔥 Points Today', 
                        value: `${user.dailyPointsToday || 0} points`, 
                        inline: true 
                    },
                    { 
                        name: '📊 Weekly Performance', 
                        value: `${user.weeklyPoints} points • ${user.weeklyEvents} events`, 
                        inline: true 
                    },
                    { 
                        name: '🎯 Quota Status', 
                        value: user.quotaCompleted ? '✅ Completed!' : '⏳ In Progress', 
                        inline: true 
                    },
                    { 
                        name: '🏢 Unit', 
                        value: `${divisionEmoji} ${division}`, 
                        inline: true 
                    }
                )
                .setFooter({ 
                    text: user.isBooster ? `${division} Division • Server Booster (2x Points) 💎` : `${division} Division`
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('❌ User position error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to retrieve user position. Please try again later.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }
}

module.exports = LeaderboardController;