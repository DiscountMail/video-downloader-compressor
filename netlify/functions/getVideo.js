import { ApifyClient } from 'apify-client';
import fetch from 'node-fetch'; // We need to use a server-side fetch library

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { instaUrl } = JSON.parse(event.body);
        const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

        // 1. Get the direct video URL from Apify
        const client = new ApifyClient({ token: APIFY_API_TOKEN });
        const run = await client.actor("apify/instagram-scraper").call({ directUrls: [instaUrl], resultsLimit: 1 });
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0 || !items[0].videoUrl) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Apify did not find a video URL.' }) };
        }
        const videoUrl = items[0].videoUrl;

        // 2. Fetch the actual video file from Instagram's server
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            throw new Error('Failed to fetch the video file from Instagram CDN.');
        }
        const videoBuffer = await videoResponse.buffer();

        // 3. Send the video file back to the browser, encoded in Base64
        return {
            statusCode: 200,
            body: JSON.stringify({
                // Base64 is a way to represent binary data (like a video) as text
                videoData: videoBuffer.toString('base64'),
                fileName: items[0].shortCode || 'instagram-video'
            }),
        };

    } catch (error) {
        console.error('Function Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};