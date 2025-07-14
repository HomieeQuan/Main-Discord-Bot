// controllers/eventController.js
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PointCalculator = require('../utils/pointCalculator');
const PermissionChecker = require('../utils/permissionChecker');
const SWATEmbeds = require('../views/embedBuilder');

class EventController {
    // Updated to handle quantity and daily points tracking
    static async submitEvent(interaction, eventType, description, screenshot, quantity = 1) {
        try {
            // Step 1: Check permissions (same as before)
            if (!PermissionChecker.canSubmitLogs(interaction.member)) {
                const errorEmbed = SWATEmbeds.createPermissionErrorEmbed();
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Step 2: Validate screenshot (same as before)
            if (!screenshot.contentType?.startsWith('image/')) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Please provide a valid image screenshot!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Step 3: Validate quantity
            if (quantity < 1 || quantity > 20) {
                const errorEmbed = SWATEmbeds.createErrorEmbed('Quantity must be between 1 and 20!');
                return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            await interaction.deferReply();

            // Step 4: Get or create user (same as before)
            let user = await SWATUser.findOne({ discordId: interaction.user.id });
            if (!user) {
                user = new SWATUser({
                    discordId: interaction.user.id,
                    username: interaction.user.username,
                    isBooster: PermissionChecker.isBooster(interaction.member)
                });
            } else {
                user.username = interaction.user.username;
                user.isBooster = PermissionChecker.isBooster(interaction.member);
            }

            // Step 5: Calculate points (now with quantity)
            const isBooster = PermissionChecker.isBooster(interaction.member);
            const basePointsPerEvent = PointCalculator.calculatePoints(eventType, false);
            const actualPointsPerEvent = isBooster ? basePointsPerEvent * 2 : basePointsPerEvent;
            const totalPoints = actualPointsPerEvent * quantity;

            // Step 6: Update user stats (ENHANCED with daily tracking)
            user.weeklyPoints += totalPoints;
            user.allTimePoints += totalPoints;
            user.totalEvents += quantity;
            user.weeklyEvents += quantity;
            user.quotaCompleted = user.weeklyPoints >= user.weeklyQuota;

            // NEW: Daily points tracking for Phase 1 features
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Reset daily points if it's a new day
            if (!user.lastDailyReset || user.lastDailyReset < startOfDay) {
                user.dailyPointsToday = totalPoints;
                user.lastDailyReset = now;
                console.log(`🔄 Reset daily points for ${user.username} - new day detected`);
            } else {
                user.dailyPointsToday = (user.dailyPointsToday || 0) + totalPoints;
                console.log(`➕ Added ${totalPoints} to daily total for ${user.username}`);
            }

            // NEW: Update previous rank for trend calculation
            const currentRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints - totalPoints } // Calculate rank before this submission
            }) + 1;
            
            // Only update previous rank if it's not set or if it's been a while
            if (!user.previousRank || user.previousRank === 0) {
                user.previousRank = currentRank;
            }

            // NEW: Update quota streak tracking
            if (user.quotaCompleted && !user.lastQuotaCompletion) {
                // First time completing quota this week
                user.lastQuotaCompletion = now;
                user.quotaStreak = (user.quotaStreak || 0) + 1;
                console.log(`🎯 ${user.username} completed quota! Streak: ${user.quotaStreak}`);
            }

            await user.save();

            // Step 7: Create event log (same as before)
            const eventLog = new EventLog({
                userId: interaction.user.id,
                username: interaction.user.username,
                eventType,
                description: quantity > 1 ? `${description} (x${quantity})` : description,
                pointsAwarded: totalPoints,
                boostedPoints: isBooster,
                screenshotUrl: screenshot.url,
                quantity: quantity
            });

            await eventLog.save();

            // Step 8: Create response embed (check if method exists)
            let embed;
            if (typeof SWATEmbeds.createEventSubmissionEmbedWithQuantity === 'function') {
                embed = SWATEmbeds.createEventSubmissionEmbedWithQuantity(
                    user, eventType, description, totalPoints, basePointsPerEvent, 
                    isBooster, screenshot, quantity
                );
            } else {
                // Fallback to original embed if new method doesn't exist yet
                embed = SWATEmbeds.createEventSubmissionEmbed(
                    user, eventType, description, totalPoints, basePointsPerEvent, 
                    isBooster, screenshot
                );
            }

            await interaction.editReply({ embeds: [embed] });

            // NEW: Log daily statistics for debugging
            console.log(`📊 Event submitted by ${user.username}:`);
            console.log(`   - Points today: ${user.dailyPointsToday}`);
            console.log(`   - Weekly total: ${user.weeklyPoints}`);
            console.log(`   - Quota completed: ${user.quotaCompleted}`);

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
}

module.exports = EventController;