// controllers/eventController.js - Updated with rank progression integration and display names
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PointCalculator = require('../utils/pointCalculator');
const PermissionChecker = require('../utils/permissionChecker');
const SWATEmbeds = require('../views/embedBuilder');
const RankSystem = require('../utils/rankSystem');
const PromotionChecker = require('../utils/promotionChecker');
const { EmbedBuilder } = require('discord.js');

class EventController {
    // Updated to handle rank progression alongside point system
    static async submitEvent(interaction, eventType, description, screenshot, quantity = 1, attendeesPassed = 0) {
        try {
            // Step 1: Check permissions
            if (!PermissionChecker.canSubmitLogs(interaction.member)) {
                const errorEmbed = SWATEmbeds.createPermissionErrorEmbed();
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Step 2: Validate screenshot
            if (!screenshot.contentType?.startsWith('image/')) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Please provide a valid image screenshot!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Step 3: Validate inputs
            if (quantity < 1 || quantity > 20) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Quantity must be between 1 and 20!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (attendeesPassed < 0 || attendeesPassed > 50) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Attendees passed must be between 0 and 50!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            await interaction.deferReply();

            // Step 4: Get or create user
            let user = await SWATUser.findOne({ discordId: interaction.user.id });
            if (!user) {
                user = new SWATUser({
                    discordId: interaction.user.id,
                    username: interaction.member.displayName || interaction.user.username, // FIXED: Use display name
                    isBooster: PermissionChecker.isBooster(interaction.member),
                    // Rank system defaults are set in schema
                    rankName: 'Probationary Operator',
                    rankLevel: 1,
                    rankPoints: 0
                });
            } else {
                user.username = interaction.member.displayName || interaction.user.username; // FIXED: Use display name
                user.isBooster = PermissionChecker.isBooster(interaction.member);
            }

            // Step 5: Calculate points (both leaderboard and rank points)
            const isBooster = PermissionChecker.isBooster(interaction.member);
            const basePointsPerEvent = PointCalculator.calculateBasePoints(eventType);
            
            // Calculate bonus points from attendees (only for tryouts)
            const isTryoutEvent = eventType === 'tet_private' || eventType === 'tet_public';
            const attendeesBonus = isTryoutEvent ? attendeesPassed : 0;
            
            // Points per event = base points + attendees bonus
            const pointsPerEventWithBonus = basePointsPerEvent + attendeesBonus;
            
            // Apply booster multiplier to the total (base + bonus)
            const actualPointsPerEvent = isBooster ? pointsPerEventWithBonus * 2 : pointsPerEventWithBonus;
            
            // Multiply by quantity for total points
            const totalPoints = actualPointsPerEvent * quantity;

            // Step 6: Update LEADERBOARD points (existing system)
            user.weeklyPoints += totalPoints;
            user.allTimePoints += totalPoints;
            user.totalEvents += quantity;
            user.weeklyEvents += quantity;
            user.quotaCompleted = user.weeklyPoints >= user.weeklyQuota;

            // Step 7: Update RANK points (NEW - separate from leaderboard points)
            // Only add rank points if user is not at Executive+ level (hand-picked ranks)
            if (!RankSystem.isExecutiveOrHigher(user.rankLevel)) {
                user.rankPoints += totalPoints;
                console.log(`📈 Rank points: ${user.username} gained ${totalPoints} rank points (now ${user.rankPoints})`);
            }

            // Step 8: Daily points tracking (existing feature)
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (!user.lastDailyReset || user.lastDailyReset < startOfDay) {
                user.dailyPointsToday = totalPoints;
                user.lastDailyReset = now;
            } else {
                user.dailyPointsToday = (user.dailyPointsToday || 0) + totalPoints;
            }

            // Step 9: Update rank tracking for trends
            if (!user.previousRank || user.previousRank === 0) {
                const currentRank = await SWATUser.countDocuments({ 
                    weeklyPoints: { $gt: user.weeklyPoints - totalPoints }
                }) + 1;
                user.previousRank = currentRank;
            }

            // Step 10: Update quota streak tracking
            if (user.quotaCompleted && !user.lastQuotaCompletion) {
                user.lastQuotaCompletion = now;
                user.quotaStreak = (user.quotaStreak || 0) + 1;
            }

            await user.save();

            // Step 11: Check for promotion eligibility (NEW)
            let promotionResult = null;
            try {
                promotionResult = await PromotionChecker.checkPromotionEligibility(interaction.user.id);
            } catch (error) {
                console.error('❌ Promotion check error:', error);
                // Don't fail the entire submission if promotion check fails
            }

            // Step 12: Create enhanced event log
            const enhancedDescription = isTryoutEvent && attendeesPassed > 0 
                ? `${description} (${attendeesPassed} attendees passed)`
                : description;
                
            const finalDescription = quantity > 1 
                ? `${enhancedDescription} (x${quantity})` 
                : enhancedDescription;

            const eventLog = new EventLog({
                userId: interaction.user.id,
                username: interaction.member.displayName || interaction.user.username, // FIXED: Use display name
                eventType,
                description: finalDescription,
                pointsAwarded: totalPoints,
                boostedPoints: isBooster,
                screenshotUrl: screenshot.url,
                quantity: quantity
            });

            // Add attendees data if it's a tryout
            if (isTryoutEvent) {
                eventLog.attendeesPassed = attendeesPassed;
            }

            await eventLog.save();

            // Step 13: Create response embed with rank information
            const embed = this.createEnhancedSubmissionEmbed(
                user, eventType, description, totalPoints, basePointsPerEvent, 
                isBooster, screenshot, quantity, attendeesPassed, attendeesBonus
            );

            await interaction.editReply({ embeds: [embed] });

            // Step 14: Send promotion notification if user became eligible
            if (promotionResult && promotionResult.newlyEligible) {
                const promoNotification = PromotionChecker.createEligibilityNotification(promotionResult);
                if (promoNotification) {
                    const promoEmbed = new EmbedBuilder()
                        .setColor(promoNotification.color)
                        .setTitle(promoNotification.title)
                        .setDescription(promoNotification.description)
                        .addFields(promoNotification.fields)
                        .setTimestamp();

                    // Send as follow-up message to user
                    await interaction.followUp({ 
                        embeds: [promoEmbed], 
                        ephemeral: true 
                    });

                    // TODO: Also notify HR (will add in Phase 3)
                    console.log(`🎯 PROMOTION NOTIFICATION: ${user.username} eligible for ${promotionResult.nextRank.name}`);
                }
            }

            // Enhanced logging
            console.log(`📊 Event submitted by ${user.username}:`);
            console.log(`   - Event: ${eventType} x${quantity}`);
            console.log(`   - Leaderboard points: ${totalPoints}`);
            console.log(`   - Rank points: +${totalPoints} (total: ${user.rankPoints})`);
            console.log(`   - Current rank: ${RankSystem.formatRank(user)}`);
            if (isTryoutEvent && attendeesPassed > 0) {
                console.log(`   - Attendees bonus: +${attendeesPassed} points`);
            }
            console.log(`   - Weekly total: ${user.weeklyPoints}/${user.weeklyQuota}`);

        } catch (error) {
            console.error('❌ Event submission error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to submit event. Please try again later.');
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }

    // Create enhanced submission embed with rank progression information
    static createEnhancedSubmissionEmbed(user, eventType, description, totalPoints, basePoints, isBooster, screenshot, quantity, attendeesPassed, attendeesBonus) {
        const isTryoutEvent = attendeesPassed > 0;
        
        const embed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
            .setTitle('✅ Event(s) Submitted Successfully!')
            .setDescription(`**${PointCalculator.getEventName(eventType)}** ${quantity > 1 ? `(x${quantity})` : ''}`)
            .setThumbnail(screenshot.url)
            .setTimestamp();

        // Build detailed points explanation
        let pointsExplanation = '';
        if (quantity > 1) {
            if (isTryoutEvent) {
                pointsExplanation = `${totalPoints} points\n(${basePoints} base + ${attendeesBonus} attendees`;
                if (isBooster) pointsExplanation += ` × 2 booster`;
                pointsExplanation += ` × ${quantity} events)`;
            } else {
                pointsExplanation = `${totalPoints} points\n(${basePoints} per event`;
                if (isBooster) pointsExplanation += ` × 2 booster`;
                pointsExplanation += ` × ${quantity} events)`;
            }
        } else {
            if (isTryoutEvent) {
                pointsExplanation = `${totalPoints} points\n(${basePoints} base + ${attendeesBonus} attendees`;
                if (isBooster) pointsExplanation += ` × 2 booster`;
                pointsExplanation += ')';
            } else {
                pointsExplanation = isBooster ? 
                    `${totalPoints} points\n(${basePoints} base × 2 booster)` : 
                    `${totalPoints} points`;
            }
        }

        // Add rank progression info
        const rankProgress = RankSystem.createRankProgressBar(user);
        const currentRank = RankSystem.formatRank(user);
        
        embed.addFields(
            { 
                name: '📊 Points Awarded', 
                value: pointsExplanation, 
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
                name: '🎖️ Current Rank',
                value: currentRank,
                inline: true
            }
        );

        // Add rank progression (only for non-Executive ranks)
        if (!RankSystem.isExecutiveOrHigher(user.rankLevel)) {
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

        // Add rank lock info if applicable
        const lockStatus = RankSystem.checkRankLockExpiry(user);
        if (!lockStatus.expired && lockStatus.daysRemaining) {
            embed.addFields({
                name: '🔒 Rank Lock',
                value: `${lockStatus.daysRemaining} days remaining`,
                inline: true
            });
        }

        // Add tryout-specific information
        if (isTryoutEvent) {
            embed.addFields({
                name: '👥 Tryout Results',
                value: `${attendeesPassed} attendees passed (+${attendeesBonus} bonus points)`,
                inline: true
            });
        }

        embed.addFields({
            name: '📝 Description', 
            value: description, 
            inline: false 
        });

        // Add quota completion message
        if (user.quotaCompleted && user.weeklyPoints - totalPoints < user.weeklyQuota) {
            embed.setDescription(embed.data.description + '\n\n🎉 **Congratulations! You\'ve completed your weekly quota!**');
        }

        embed.setFooter({ 
            text: `Total Events: ${user.totalEvents} | Rank Points: +${totalPoints}` 
        });

        return embed;
    }
}

module.exports = EventController;