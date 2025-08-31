// utils/cloudinaryStorage.js - Permanent screenshot storage using Cloudinary
const cloudinary = require('cloudinary').v2;
// const fetch = require('node-fetch');

class CloudinaryStorage {
    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });
        
        console.log('Cloudinary configured for permanent screenshot storage');
    }

    async uploadScreenshot(discordUrl, filename) {
        try {
            console.log(`Uploading screenshot to Cloudinary: ${filename}`);
            
            // Upload directly from Discord URL to Cloudinary
            const result = await cloudinary.uploader.upload(discordUrl, {
                public_id: filename,
                folder: 'swat-screenshots',
                resource_type: 'image',
                quality: 'auto', // Optimize file size
                fetch_format: 'auto' // Use best format for delivery
            });
            
            console.log(`Screenshot uploaded successfully: ${result.secure_url}`);
            return result.secure_url; // Permanent HTTPS URL
            
        } catch (error) {
            console.error(`Cloudinary upload failed for ${filename}:`, error);
            throw error;
        }
    }

    generateFilename(userId, eventType, index, timestamp) {
        // Create unique filename with timestamp and user info
        return `${timestamp}_${userId}_${eventType}_${index}`;
    }

    async uploadMultipleScreenshots(screenshots, userId, eventType) {
        const permanentUrls = [];
        const timestamp = Date.now();

        console.log(`Processing ${screenshots.length} screenshots for permanent storage...`);

        for (let i = 0; i < screenshots.length; i++) {
            const screenshot = screenshots[i];
            const filename = this.generateFilename(userId, eventType, i, timestamp);
            
            try {
                const permanentUrl = await this.uploadScreenshot(screenshot.url, filename);
                permanentUrls.push(permanentUrl);
                console.log(`Screenshot ${i + 1}/${screenshots.length} stored permanently`);
            } catch (uploadError) {
                console.error(`Failed to upload screenshot ${i + 1}:`, uploadError);
                // Fallback: use original Discord URL (will expire in 24-48 hours)
                permanentUrls.push(screenshot.url);
                console.log(`Fallback: Using Discord URL for screenshot ${i + 1} (will expire)`);
            }
        }

        return permanentUrls;
    }

    // Test connection to Cloudinary
    static async testConnection() {
        try {
            const result = await cloudinary.api.ping();
            console.log('Cloudinary connection test successful:', result);
            return true;
        } catch (error) {
            console.error('Cloudinary connection test failed:', error);
            return false;
        }
    }
}

module.exports = CloudinaryStorage;