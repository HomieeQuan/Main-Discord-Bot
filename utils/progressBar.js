// utils/progressBar.js
class ProgressBarGenerator {
    // Creates a visual progress bar
    static createProgressBar(current, target, length = 20) {
        const percentage = Math.min(current / target, 1); // Cap at 100%
        const filledLength = Math.floor(percentage * length);
        const emptyLength = length - filledLength;
        
        const filledBar = '█'.repeat(filledLength);
        const emptyBar = '░'.repeat(emptyLength);
        const bar = filledBar + emptyBar;
        
        const percentageText = Math.floor((current / target) * 100);
        
        return {
            bar: `[${bar}]`,
            percentage: `${percentageText}%`,
            status: current >= target ? '✅' : '⏳',
            overflow: current > target ? `(+${current - target} bonus)` : ''
        };
    }

    // Creates quota-specific progress bar
    static createQuotaProgressBar(current, target = 10) {
        const progress = this.createProgressBar(current, target);
        return `${progress.bar} ${progress.percentage} (${current}/${target} points) ${progress.status} ${progress.overflow}`.trim();
    }

    // Creates a mini progress bar for leaderboards
    static createMiniProgressBar(current, target = 10, length = 10) {
        const progress = this.createProgressBar(current, target, length);
        return `${progress.bar} ${progress.status}`;
    }
}

module.exports = ProgressBarGenerator;