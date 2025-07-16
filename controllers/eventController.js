// controllers/eventController.js - FIXED null screenshot validation
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PointCalculator = require('../utils/pointCalculator');
const PermissionChecker = require('../utils/permissionChecker');
const SWATEmbeds = require('../views/embedBuilder');
const RankSystem = require('../utils/rankSystem');
const PromotionChecker = require('../utils/promotionChecker');
const QuotaSystem = require('../utils/quotaSystem');
const { EmbedBuilder } = require('discord.js');

class EventController {
    // FIXED: Handle multiple screenshots with proper null checking
    static async submitEvent(interaction, eventType, description, screenshots, quantity = 1, attendeesPassed = 0) {
        try {
            // Step 1: Check permissions
            if (!PermissionChecker.canSubmitLogs(interaction.member)) {
                const errorEmbed = SWATEmbeds.createPermissionErrorEmbed();
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Step 2: FIXED - Validate screenshots with proper null checking
            if (!screenshots || screenshots.length === 0) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('At least one screenshot is required!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (screenshots.length > 3) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Maximum 3 screenshots allowed!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // FIXED: Validate each screenshot with null checking
            for (let i = 0; i < screenshots.length; i++) {
                const screenshot = screenshots[i];
                
                // Check if screenshot exists and is not null
                if (!screenshot) {
                    const errorEmbed = SWATEmbeds.createErrorEmbed(`Screenshot ${i + 1} is missing or invalid!`);
                    return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
                
                // Check if screenshot has contentType and is an image
                if (!screenshot.contentType || !screenshot.contentType.startsWith('image/')) {
                    const errorEmbed = SWATEmbeds.createErrorEmbed(`Screenshot ${i + 1} must be a valid image file!`);
                    return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
                
                console.log(`✅ Screenshot ${i + 1} validated: ${screenshot.name} (${screenshot.contentType})`);
            }

            console.log(`📸 All ${screenshots.length} screenshots validated successfully`);

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
                    username: interaction.member.displayName || interaction.user.username,
                    isBooster: PermissionChecker.isBooster(interaction.member),
                    rankName: 'Probationary Operator',
                    rankLevel: 1,
                    rankPoints: 0
                });
            } else {
                user.username = interaction.member.displayName || interaction.user.username;
                user.isBooster = PermissionChecker.isBooster(interaction.member);
            }

            // Step 5: Calculate points
            const isBooster = PermissionChecker.isBooster(interaction.member);
            const basePointsPerEvent = PointCalculator.calculateBasePoints(eventType);
            
            const isTryoutEvent = eventType === 'tet_private' || eventType === 'tet_public';
            const attendeesBonus = isTryoutEvent ? attendeesPassed : 0;
            
            const pointsPerEventWithBonus = basePointsPerEvent + attendeesBonus;
            const actualPointsPerEvent = isBooster ? pointsPerEventWithBonus * 2 : pointsPerEventWithBonus;
            const totalPoints = actualPointsPerEvent * quantity;

            // Step 6: Update user points and stats
            const oldWeeklyPoints = user.weeklyPoints;
            const oldAllTimePoints = user.allTimePoints;
            const oldRankPoints = user.rankPoints;
            
            user.weeklyPoints += totalPoints;
            user.allTimePoints += totalPoints;
            user.totalEvents += quantity;
            user.weeklyEvents += quantity;

            // Update rank points (only for non-Executive ranks)
            if (!RankSystem.isExecutiveOrHigher(user.rankLevel)) {
                user.rankPoints += totalPoints;
                console.log(`📈 Rank progression: ${user.username} gained ${totalPoints} rank points (${oldRankPoints} → ${user.rankPoints})`);
            }

            // Update quota status
            const currentQuota = QuotaSystem.getUserQuota(user);
            user.weeklyQuota = currentQuota;
            user.quotaCompleted = QuotaSystem.isQuotaCompleted(user);

            // Check promotion eligibility
            const eligibilityBefore = user.promotionEligible;
            const eligibilityCheck = RankSystem.checkPromotionEligibility(user);
            user.promotionEligible = eligibilityCheck.eligible;

            if (!eligibilityBefore && eligibilityCheck.eligible) {
                console.log(`🎯 PROMOTION ELIGIBLE: ${user.username} is now eligible for promotion to ${eligibilityCheck.nextRank?.name}`);
            }

            // Daily points tracking
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (!user.lastDailyReset || user.lastDailyReset < startOfDay) {
                user.dailyPointsToday = totalPoints;
                user.lastDailyReset = now;
            } else {
                user.dailyPointsToday = (user.dailyPointsToday || 0) + totalPoints;
            }

            // Update rank tracking for trends
            if (!user.previousRank || user.previousRank === 0) {
                const currentRank = await SWATUser.countDocuments({ 
                    weeklyPoints: { $gt: oldWeeklyPoints }
                }) + 1;
                user.previousRank = currentRank;
            }

            // Update quota streak tracking
            if (user.quotaCompleted && !user.lastQuotaCompletion) {
                user.lastQuotaCompletion = now;
                user.quotaStreak = (user.quotaStreak || 0) + 1;
            }

            await user.save();

            // Step 7: Create event log with multiple screenshots
            const enhancedDescription = isTryoutEvent && attendeesPassed > 0 
                ? `${description} (${attendeesPassed} attendees passed)`
                : description;
                
            const finalDescription = quantity > 1 
                ? `${enhancedDescription} (x${quantity})` 
                : enhancedDescription;

            // FIXED: Extract screenshot URLs safely
            const screenshotUrls = screenshots.map(screenshot => screenshot.url);
            
            console.log(`💾 Saving event with ${screenshotUrls.length} screenshot URLs:`, screenshotUrls);

            const eventLog = new EventLog({
                userId: interaction.user.id,
                username: interaction.member.displayName || interaction.user.username,
                eventType,
                description: finalDescription,
                pointsAwarded: totalPoints,
                boostedPoints: isBooster,
                // NEW: Store multiple screenshot URLs
                screenshotUrls: screenshotUrls,
                // BACKWARD COMPATIBILITY: Also store first screenshot in old field
                screenshotUrl: screenshotUrls[0],
                quantity: quantity
            });

            if (isTryoutEvent) {
                eventLog.attendeesPassed = attendeesPassed;
            }

            await eventLog.save();
            console.log(`✅ Event saved successfully with ${screenshotUrls.length} screenshots`);

            // Step 8: Create response embed with multiple screenshots info
            const embed = this.createEnhancedSubmissionEmbed(
                user, eventType, description, totalPoints, basePointsPerEvent, 
                isBooster, screenshots, quantity, attendeesPassed, attendeesBonus
            );

            await interaction.editReply({ embeds: [embed] });

            // Step 9: Send promotion notification if user became eligible
            let promotionResult = null;
            try {
                if (eligibilityCheck.eligible && !eligibilityBefore) {
                    promotionResult = {
                        newlyEligible: true,
                        user: user,
                        currentRank: RankSystem.getRankByLevel(user.rankLevel),
                        nextRank: eligibilityCheck.nextRank,
                        requirements: eligibilityCheck.requirements
                    };
                }
            } catch (error) {
                console.error('❌ Promotion eligibility check error:', error);
            }

            if (promotionResult && promotionResult.newlyEligible) {
                try {
                    const promoNotification = PromotionChecker.createEligibilityNotification(promotionResult);
                    if (promoNotification) {
                        const promoEmbed = new EmbedBuilder()
                            .setColor(promoNotification.color)
                            .setTitle(promoNotification.title)
                            .setDescription(promoNotification.description)
                            .addFields(promoNotification.fields)
                            .setTimestamp();

                        await interaction.followUp({ 
                            embeds: [promoEmbed], 
                            ephemeral: true 
                        });

                        console.log(`🎯 PROMOTION NOTIFICATION SENT: ${user.username} eligible for ${promotionResult.nextRank.name}`);
                    }
                } catch (notificationError) {
                    console.error('❌ Promotion notification error:', notificationError);
                }
            }

            // Enhanced logging with screenshot count
            console.log(`📊 Event submitted by ${user.username}:`);
            console.log(`   - Event: ${eventType} x${quantity}`);
            console.log(`   - Points awarded: ${totalPoints}`);
            console.log(`   - Screenshots: ${screenshots.length} attached`);
            console.log(`   - Weekly points: ${oldWeeklyPoints} → ${user.weeklyPoints}`);
            console.log(`   - All-time points: ${oldAllTimePoints} → ${user.allTimePoints}`);
            console.log(`   - Rank points: ${oldRankPoints} → ${user.rankPoints}`);
            console.log(`   - Current rank: ${RankSystem.formatRank(user)}`);
            console.log(`   - Promotion eligible: ${user.promotionEligible}`);
            if (isTryoutEvent && attendeesPassed > 0) {
                console.log(`   - Attendees bonus: +${attendeesPassed} points`);
            }
            console.log(`   - Weekly quota: ${user.weeklyPoints}/${user.weeklyQuota} (${user.quotaCompleted ? 'COMPLETED' : 'IN PROGRESS'})`);

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

    // Create enhanced submission embed with multiple screenshots info
    static createEnhancedSubmissionEmbed(user, eventType, description, totalPoints, basePoints, isBooster, screenshots, quantity, attendeesPassed, attendeesBonus) {
        const isTryoutEvent = attendeesPassed > 0;
        
        const embed = new EmbedBuilder()
            .setColor(user.quotaCompleted ? '#00ff00' : '#ffa500')
            .setTitle('✅ Event(s) Submitted Successfully!')
            .setDescription(`**${PointCalculator.getEventName(eventType)}** ${quantity > 1 ? `(x${quantity})` : ''}`)
            // Use first screenshot as thumbnail
            .setThumbnail(screenshots[0].url)
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
        const eligibility = RankSystem.checkPromotionEligibility(user);
        
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
            },
            // Add screenshot count info
            {
                name: '📸 Screenshots',
                value: `${screenshots.length} image${screenshots.length > 1 ? 's' : ''} attached`,
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
            
            // Add promotion status
            if (eligibility.eligible) {
                embed.addFields({
                    name: '🎯 Promotion Status',
                    value: `✅ **ELIGIBLE** for promotion to ${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}!`,
                    inline: false
                });
            } else if (eligibility.nextRank) {
                const pointsNeeded = eligibility.requirements.pointsRemaining;
                embed.addFields({
                    name: '📈 Next Promotion',
                    value: `${pointsNeeded} more rank points needed for ${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}`,
                    inline: false
                });
            }
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

        // Add promotion notification
        if (eligibility.eligible && !user.promotionEligible) {
            embed.setDescription(embed.data.description + '\n\n🎯 **You\'re now eligible for promotion! HR has been notified.**');
        }

        embed.setFooter({ 
            text: `Total Events: ${user.totalEvents} | Rank Points: ${user.rankPoints} | All-Time: ${user.allTimePoints}` 
        });

        return embed;
    }
}

module.exports = EventController;