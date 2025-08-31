// controllers
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PointCalculator = require('../utils/pointCalculator');
const PermissionChecker = require('../utils/permissionChecker');
const SWATEmbeds = require('../views/embedBuilder');
const RankSystem = require('../utils/rankSystem');
const QuotaSystem = require('../utils/quotaSystem');
const CloudinaryStorage = require('../utils/cloudinaryStorage');
const { EmbedBuilder } = require('discord.js');

class EventController {
    // FIXED: Add submission tracking to prevent race conditions
    static activeSubmissions = new Map(); // Track users currently submitting

    // FIXED: Enhanced submitEvent method with concurrency protection and timezone fixes
    static async submitEvent(interaction, eventType, description, screenshots, quantity = 1, attendeesPassed = 0) {
        try {
            console.log(`🔍 DEBUG: Event submission started for ${interaction.user.username}`);
            
            // FIXED: Check for concurrent submissions
            const userId = interaction.user.id;
            if (this.activeSubmissions.has(userId)) {
                console.log(`⚠️ CONCURRENT SUBMISSION BLOCKED: ${interaction.user.username} already submitting`);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff6600')
                    .setTitle('⏳ Submission In Progress')
                    .setDescription('You already have an event submission being processed. Please wait for it to complete before submitting another event.')
                    .addFields({
                        name: '💡 Tip',
                        value: 'This prevents duplicate submissions and point calculation errors.',
                        inline: false
                    })
                    .setTimestamp();
                
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // FIXED: Mark user as actively submitting
            this.activeSubmissions.set(userId, {
                startTime: new Date(),
                eventType: eventType,
                interaction: interaction.id
            });

            console.log(`🔒 SUBMISSION LOCK: ${interaction.user.username} submission started`);

            // Step 1: Check permissions
            if (!PermissionChecker.canSubmitLogs(interaction.member)) {
                this.activeSubmissions.delete(userId); // FIXED: Clean up on early exit
                const errorEmbed = SWATEmbeds.createPermissionErrorEmbed();
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Step 2: Validate screenshots with proper null checking
            if (!screenshots || screenshots.length === 0) {
                this.activeSubmissions.delete(userId); // FIXED: Clean up on early exit
                const errorEmbed = SWATEmbeds.createErrorEmbed('At least one screenshot is required!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (screenshots.length > 3) {
                this.activeSubmissions.delete(userId); // FIXED: Clean up on early exit
                const errorEmbed = SWATEmbeds.createErrorEmbed('Maximum 3 screenshots allowed!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Validate each screenshot with null checking
            for (let i = 0; i < screenshots.length; i++) {
                const screenshot = screenshots[i];
                
                if (!screenshot) {
                    this.activeSubmissions.delete(userId); // FIXED: Clean up on early exit
                    const errorEmbed = SWATEmbeds.createErrorEmbed(`Screenshot ${i + 1} is missing or invalid!`);
                    return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
                
                if (!screenshot.contentType || !screenshot.contentType.startsWith('image/')) {
                    this.activeSubmissions.delete(userId); // FIXED: Clean up on early exit
                    const errorEmbed = SWATEmbeds.createErrorEmbed(`Screenshot ${i + 1} must be a valid image file!`);
                    return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }
                
                console.log(`✅ Screenshot ${i + 1} validated: ${screenshot.name} (${screenshot.contentType})`);
            }

            console.log(`📸 All ${screenshots.length} screenshots validated successfully`);

            // Step 3: Validate inputs
            if (quantity < 1 || quantity > 20) {
                this.activeSubmissions.delete(userId); // FIXED: Clean up on early exit
                const errorEmbed = SWATEmbeds.createErrorEmbed('Quantity must be between 1 and 20!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            if (attendeesPassed < 0 || attendeesPassed > 50) {
                this.activeSubmissions.delete(userId); // FIXED: Clean up on early exit
                const errorEmbed = SWATEmbeds.createErrorEmbed('Attendees passed must be between 0 and 50!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            await interaction.deferReply();

            // FIXED: Use database transaction for atomic operations
            const mongoose = require('mongoose');
            const session = await mongoose.startSession();
            
            try {
                session.startTransaction();
                console.log(`📄 TRANSACTION: Started for ${interaction.user.username}`);

                // Step 4: Get or create user with PROPER rank points initialization
                let user = await SWATUser.findOne({ discordId: interaction.user.id }).session(session);
                if (!user) {
                    // FIXED: Properly initialize ALL fields for new users
                    user = new SWATUser({
                        discordId: interaction.user.id,
                        username: interaction.member.displayName || interaction.user.username,
                        isBooster: PermissionChecker.isBooster(interaction.member),
                        rankName: 'Probationary Operator',
                        rankLevel: 1,
                        rankPoints: 0,
                        weeklyPoints: 0,
                        allTimePoints: 0,
                        totalEvents: 0,
                        weeklyEvents: 0,
                        weeklyQuota: 10,
                        quotaCompleted: false,
                        promotionEligible: false
                    });
                    console.log(`✅ Created new user ${user.username} with rank points initialized to 0`);
                } else {
                    // FIXED: Update user info and ensure field initialization
                    user.username = interaction.member.displayName || interaction.user.username;
                    user.isBooster = PermissionChecker.isBooster(interaction.member);
                    
                    // ENSURE ALL REQUIRED FIELDS EXIST
                    if (user.rankPoints === undefined || user.rankPoints === null) {
                        user.rankPoints = 0;
                        console.log(`🔧 FIXED: Initialized rank points for existing user ${user.username}`);
                    }
                    if (user.weeklyPoints === undefined || user.weeklyPoints === null) user.weeklyPoints = 0;
                    if (user.allTimePoints === undefined || user.allTimePoints === null) user.allTimePoints = 0;
                    if (user.totalEvents === undefined || user.totalEvents === null) user.totalEvents = 0;
                    if (user.weeklyEvents === undefined || user.weeklyEvents === null) user.weeklyEvents = 0;
                    if (user.rankName === undefined || user.rankName === null) user.rankName = 'Probationary Operator';
                    if (user.rankLevel === undefined || user.rankLevel === null) user.rankLevel = 1;
                }

                // Step 5: Calculate points
                const isBooster = PermissionChecker.isBooster(interaction.member);
                const basePointsPerEvent = PointCalculator.calculateBasePoints(eventType);
                
                const isTryoutEvent = eventType === 'tet_private' || eventType === 'tet_public';
                const attendeesBonus = isTryoutEvent ? attendeesPassed : 0;
                
                const pointsPerEventWithBonus = basePointsPerEvent + attendeesBonus;
                const actualPointsPerEvent = isBooster ? pointsPerEventWithBonus * 2 : pointsPerEventWithBonus;
                const totalPoints = actualPointsPerEvent * quantity;

                // Step 6: Check promotion status BEFORE awarding points
                console.log(`🔍 DEBUG: About to check promotion eligibility - user rankPoints: ${user.rankPoints}, rankLevel: ${user.rankLevel}`);
                
                const pointsBefore = RankSystem.checkPointRequirements(user);
                const pointsWereMetBefore = pointsBefore.pointsMet;
                
                console.log(`📊 BEFORE points: User ${user.username} pointsMet: ${pointsWereMetBefore}, rankPoints: ${user.rankPoints || 0}`);

                // Step 7: FIXED - Atomic point updates
                const oldWeeklyPoints = user.weeklyPoints || 0;
                const oldAllTimePoints = user.allTimePoints || 0;
                const oldRankPoints = user.rankPoints || 0;

                // Update rank points (only for non-Executive ranks)
                if (!RankSystem.isExecutiveOrHigher(user.rankLevel)) {
                    user.rankPoints = (user.rankPoints || 0) + totalPoints;
                    console.log(`📈 Rank progression: ${user.username} gained ${totalPoints} rank points (${oldRankPoints} → ${user.rankPoints})`);
                }

                // FIXED: Atomic point updates
                user.weeklyPoints = (user.weeklyPoints || 0) + totalPoints;
                user.allTimePoints = (user.allTimePoints || 0) + totalPoints;
                user.totalEvents = (user.totalEvents || 0) + quantity;
                user.weeklyEvents = (user.weeklyEvents || 0) + quantity;

                // Update quota status
                const currentQuota = QuotaSystem.getUserQuota(user);
                user.weeklyQuota = currentQuota;
                user.quotaCompleted = QuotaSystem.isQuotaCompleted(user);

                // Check promotion status AFTER awarding points
                const pointsAfter = RankSystem.checkPointRequirements(user);
                const pointsAreMetAfter = pointsAfter.pointsMet;
                const eligibilityAfter = RankSystem.checkPromotionEligibility(user);
                
                // Update promotion eligibility flag (for HR dashboard)
                user.promotionEligible = eligibilityAfter.eligible;
                
                console.log(`📊 AFTER points: User ${user.username} pointsMet: ${pointsAreMetAfter}, rankPoints: ${user.rankPoints}, eligible: ${eligibilityAfter.eligible}`);

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

                // FIXED: Save user within transaction
                await user.save({ session });
                console.log(`✅ User saved with rank points: ${user.rankPoints} (in transaction)`);

                // Step 8: Upload screenshots to Cloudinary for permanent storage
                const cloudStorage = new CloudinaryStorage();
                const permanentScreenshotUrls = await cloudStorage.uploadMultipleScreenshots(
                    screenshots, 
                    interaction.user.id, 
                    eventType
                );

                // Step 9: Create event log with permanent screenshot URLs
                const enhancedDescription = isTryoutEvent && attendeesPassed > 0 
                    ? `${description} (${attendeesPassed} attendees passed)`
                    : description;
                    
                const finalDescription = quantity > 1 
                    ? `${enhancedDescription} (x${quantity})` 
                    : enhancedDescription;

                console.log(`💾 Saving event with ${permanentScreenshotUrls.length} permanent screenshot URLs`);

                const eventLog = new EventLog({
                    userId: interaction.user.id,
                    username: interaction.member.displayName || interaction.user.username,
                    eventType,
                    description: finalDescription,
                    pointsAwarded: totalPoints,
                    boostedPoints: isBooster,
                    screenshotUrls: permanentScreenshotUrls, // NOW PERMANENT CLOUDINARY URLS!
                    screenshotUrl: permanentScreenshotUrls[0], // Backward compatibility
                    quantity: quantity
                });

                if (isTryoutEvent) {
                    eventLog.attendeesPassed = attendeesPassed;
                }

                // FIXED: Save event log within transaction
                await eventLog.save({ session });
                console.log(`✅ Event saved successfully with ${permanentScreenshotUrls.length} permanent screenshots (in transaction)`);

                // FIXED: Commit transaction before sending responses
                await session.commitTransaction();
                console.log(`📄 TRANSACTION: Committed for ${user.username}`);

                // Step 10: Create response embed using the freshly saved user data
                const embed = this.createEnhancedSubmissionEmbed(
                    user, eventType, description, totalPoints, basePointsPerEvent, 
                    isBooster, screenshots, quantity, attendeesPassed, attendeesBonus
                );

                await interaction.editReply({ embeds: [embed] });

                // Step 11: Handle promotion notifications (outside transaction)
                const pointsNewlyMet = !pointsWereMetBefore && pointsAreMetAfter;

                if (pointsNewlyMet && pointsAfter.nextRank) {
                    console.log(`🎯 POINT REQUIREMENTS MET: ${user.username} now has enough points for promotion to ${pointsAfter.nextRank.name}!`);
                    
                    try {
                        // Check if user is rank locked with enhanced timezone info
                        const lockStatus = RankSystem.checkRankLockExpiry(user);
                        const isCurrentlyLocked = !lockStatus.expired && lockStatus.daysRemaining;
                        
                        let notificationTitle, notificationDescription, notificationFields;
                        
                        if (isCurrentlyLocked) {
                            // User has enough points but is rank locked
                            notificationTitle = '🎯 Point Requirements Met!';
                            notificationDescription = `Great progress! You now have enough rank points for promotion to **${RankSystem.getRankEmoji(pointsAfter.nextRank.level)} ${pointsAfter.nextRank.name}**!`;
                            notificationFields = [
                                {
                                    name: '✅ Requirements Met',
                                    value: `Rank Points: ${pointsAfter.rankPoints}/${pointsAfter.pointsRequired} ✅`,
                                    inline: false
                                },
                                {
                                    name: '🔒 Rank Lock Status',
                                    value: `You are rank locked until ${lockStatus.lockExpiryFormatted || `${lockStatus.daysRemaining} more days`}. Once your rank lock expires, you'll be eligible for promotion!`,
                                    inline: false
                                },
                                {
                                    name: '💡 What\'s Next?',
                                    value: 'Keep earning points to improve your rank progress! When your rank lock expires, contact HR for your promotion review.',
                                    inline: false
                                }
                            ];
                        } else {
                            // User has enough points and is NOT rank locked - fully eligible!
                            notificationTitle = '🎉 Promotion Eligible!';
                            notificationDescription = `Congratulations! You're now **fully eligible** for promotion from **${RankSystem.formatRank(user)}** to **${RankSystem.getRankEmoji(pointsAfter.nextRank.level)} ${pointsAfter.nextRank.name}**!`;
                            notificationFields = [
                                {
                                    name: '✅ Requirements Met',
                                    value: `Rank Points: ${pointsAfter.rankPoints}/${pointsAfter.pointsRequired} ✅`,
                                    inline: false
                                },
                                {
                                    name: '🔓 Rank Lock Status',
                                    value: 'No rank lock - Ready for promotion!',
                                    inline: false
                                },
                                {
                                    name: '📋 Next Steps',
                                    value: 'Contact HR when you\'re ready for your promotion review. You can continue earning points while you wait!',
                                    inline: false
                                }
                            ];
                        }
                        
                        const promoNotification = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle(notificationTitle)
                            .setDescription(notificationDescription)
                            .addFields(notificationFields)
                            .setFooter({ 
                                text: isCurrentlyLocked ? 
                                    'You\'ll get another notification when your rank lock expires!' : 
                                    'Congratulations on reaching this milestone!' 
                            })
                            .setTimestamp();

                        await interaction.user.send({ embeds: [promoNotification] });
                        console.log(`📱 PROMOTION NOTIFICATION SENT: ${user.username} notified about meeting point requirements (rank locked: ${isCurrentlyLocked})`);

                        // Also send channel notification
                        const channelNotification = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle(isCurrentlyLocked ? '🎯 Point Requirements Met!' : '🎉 Promotion Eligible!')
                            .setDescription(isCurrentlyLocked ? 
                                `You now have enough points for promotion to **${RankSystem.getRankEmoji(pointsAfter.nextRank.level)} ${pointsAfter.nextRank.name}**! Check your DMs for details.` :
                                `You're now eligible for promotion to **${RankSystem.getRankEmoji(pointsAfter.nextRank.level)} ${pointsAfter.nextRank.name}**! Check your DMs for details.`)
                            .setFooter({ 
                                text: isCurrentlyLocked ? 
                                    'Currently rank locked - promotion available when lock expires' : 
                                    'Contact HR when ready for promotion review' 
                            });

                        await interaction.followUp({ 
                            embeds: [channelNotification], 
                            ephemeral: true 
                        });

                    } catch (dmError) {
                        console.log(`📱 Could not DM ${user.username} (DMs disabled) - promotion notification failed`);
                        
                        const fallbackNotification = new EmbedBuilder()
                            .setColor('#00ff00')
                            .setTitle('🎯 Point Requirements Met!')
                            .setDescription(`**${user.username}** now has enough points for promotion to **${RankSystem.getRankEmoji(pointsAfter.nextRank.level)} ${pointsAfter.nextRank.name}**!`)
                            .addFields({
                                name: '📋 Note',
                                value: 'Please enable DMs to receive future promotion notifications directly.',
                                inline: false
                            });

                        await interaction.followUp({ 
                            embeds: [fallbackNotification], 
                            ephemeral: true 
                        });
                    }
                }

                // Enhanced logging
                console.log(`📊 Event submitted by ${user.username}:`);
                console.log(`   - Event: ${eventType} x${quantity}`);
                console.log(`   - Points awarded: ${totalPoints}`);
                console.log(`   - Screenshots: ${screenshots.length} attached (${permanentScreenshotUrls.length} permanently stored)`);
                console.log(`   - Weekly points: ${oldWeeklyPoints} → ${user.weeklyPoints}`);
                console.log(`   - All-time points: ${oldAllTimePoints} → ${user.allTimePoints}`);
                console.log(`   - Rank points: ${oldRankPoints} → ${user.rankPoints}`);
                console.log(`   - Current rank: ${RankSystem.formatRank(user)}`);
                console.log(`   - Point requirements met: ${pointsWereMetBefore} → ${pointsAreMetAfter} (newly met: ${pointsNewlyMet})`);
                if (isTryoutEvent && attendeesPassed > 0) {
                    console.log(`   - Attendees bonus: +${attendeesPassed} points`);
                }
                console.log(`   - Weekly quota: ${user.weeklyPoints}/${user.weeklyQuota} (${user.quotaCompleted ? 'COMPLETED' : 'IN PROGRESS'})`);

            } catch (transactionError) {
                // FIXED: Rollback transaction on error
                await session.abortTransaction();
                console.error(`📄 TRANSACTION ABORTED for ${interaction.user.username}:`, transactionError);
                throw transactionError;
            } finally {
                await session.endSession();
                // FIXED: Always clean up submission lock
                this.activeSubmissions.delete(userId);
                console.log(`🔓 SUBMISSION LOCK: Released for ${interaction.user.username}`);
            }

        } catch (error) {
            // FIXED: Ensure cleanup on any error
            this.activeSubmissions.delete(interaction.user.id);
            console.error('❌ Event submission error:', error);
            const errorEmbed = SWATEmbeds.createErrorEmbed('Failed to submit event. Please try again later.');
            
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        }
    }

    // FIXED: Add cleanup utility for stuck submissions
    static cleanupStuckSubmissions() {
        const now = new Date();
        const stuckThreshold = 5 * 60 * 1000; // 5 minutes
        
        for (const [userId, submission] of this.activeSubmissions.entries()) {
            if (now.getTime() - submission.startTime.getTime() > stuckThreshold) {
                console.log(`🧹 CLEANUP: Removing stuck submission for user ${userId}`);
                this.activeSubmissions.delete(userId);
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
                value: `${screenshots.length} image${screenshots.length > 1 ? 's' : ''} permanently stored`,
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
            } else if (eligibility.nextRank && eligibility.requirements) {
                const pointsNeeded = eligibility.requirements.pointsRemaining;
                embed.addFields({
                    name: '📈 Next Promotion',
                    value: `${pointsNeeded} more rank points needed for ${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}`,
                    inline: false
                });
            } else if (eligibility.rankLocked) {
                embed.addFields({
                    name: '🔒 Promotion Status',
                    value: `Rank locked - ${eligibility.reason}`,
                    inline: false
                });
            } else if (eligibility.nextRank) {
                embed.addFields({
                    name: '📈 Next Promotion',
                    value: `Work toward ${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}`,
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
        if (!lockStatus.expired && lockStatus.daysRemaining && user.rankLockUntil) {
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
            text: `Total Events: ${user.totalEvents || 0} | Rank Points: ${user.rankPoints || 0} | All-Time: ${user.allTimePoints || 0} | Screenshots permanently stored` 
        });

        return embed;
    }
}

module.exports = EventController;