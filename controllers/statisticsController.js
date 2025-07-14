// controllers/statisticsController.js
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');

class StatisticsController {
    // Calculate enhanced statistics for leaderboard
    static async getEnhancedStatistics() {
        try {
            // Get all users
            const allUsers = await SWATUser.find({});
            
            if (allUsers.length === 0) {
                return {
                    totalOperators: 0,
                    quotaCompleted: 0,
                    averagePoints: 0,
                    mostActive: null,
                    biggestGainer: null,
                    quotaRate: 0,
                    averageEvents: 0
                };
            }

            // Basic stats
            const totalOperators = allUsers.length;
            const quotaCompleted = allUsers.filter(u => u.quotaCompleted).length;
            const totalWeeklyPoints = allUsers.reduce((sum, u) => sum + u.weeklyPoints, 0);
            const averagePoints = (totalWeeklyPoints / totalOperators).toFixed(1);
            const quotaRate = Math.floor((quotaCompleted / totalOperators) * 100);

            // Most active (most events this week)
            const mostActive = allUsers.reduce((max, user) => 
                user.weeklyEvents > (max?.weeklyEvents || 0) ? user : max, null);

            // Biggest gainer (most points gained today)
            const biggestGainer = allUsers.reduce((max, user) => 
                user.dailyPointsToday > (max?.dailyPointsToday || 0) ? user : max, null);

            // Average events per operator
            const totalWeeklyEvents = allUsers.reduce((sum, u) => sum + u.weeklyEvents, 0);
            const averageEvents = (totalWeeklyEvents / totalOperators).toFixed(1);

            return {
                totalOperators,
                quotaCompleted,
                averagePoints,
                mostActive,
                biggestGainer,
                quotaRate,
                averageEvents
            };

        } catch (error) {
            console.error('Enhanced statistics error:', error);
            return null;
        }
    }

    // Calculate trend for a specific user
    static async calculateUserTrend(userId) {
        try {
            const user = await SWATUser.findOne({ discordId: userId });
            if (!user) return { direction: '', change: 0 };

            // Calculate rank change
            const currentRank = await SWATUser.countDocuments({ 
                weeklyPoints: { $gt: user.weeklyPoints } 
            }) + 1;

            const rankChange = user.previousRank - currentRank; // Positive = rank improved
            
            let direction = '';
            if (rankChange > 0) direction = '⬆️';
            else if (rankChange < 0) direction = '⬇️';
            else direction = '➡️';

            return {
                direction,
                rankChange: Math.abs(rankChange),
                pointsToday: user.dailyPointsToday || 0
            };

        } catch (error) {
            console.error('User trend calculation error:', error);
            return { direction: '', change: 0 };
        }
    }

    // Reset daily statistics (call this daily)
    static async resetDailyStats() {
        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Reset daily points for users who haven't been reset today
            await SWATUser.updateMany(
                { lastDailyReset: { $lt: startOfDay } },
                { 
                    $set: { 
                        dailyPointsToday: 0,
                        lastDailyReset: now 
                    }
                }
            );

            console.log('✅ Daily statistics reset completed');
        } catch (error) {
            console.error('❌ Daily stats reset error:', error);
        }
    }
}

module.exports = StatisticsController;