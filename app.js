import dotenv from "dotenv";
import express from "express";
import { TwitterApi } from "twitter-api-v2";
import { createNodeMiddleware, Webhooks } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";

// Load environment variables from .env file
dotenv.config();

// Set up Express server
const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const host = 'localhost';
const webhookPath = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${webhookPath}`;

// Set up Twitter client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Set up Octokit for GitHub API requests
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

// Set up GitHub Webhooks
const webhooks = new Webhooks({
    secret: process.env.WEBHOOK_SECRET
});

// Handle "issues" events from GitHub
webhooks.on("issues.labeled", async ({ payload }) => {
    const issue = payload.issue;
    const label = payload.label;
    const repo = payload.repository;

    if (label.name.toLowerCase() === "good first issue") {
        console.log(`New "good first issue" labeled in ${repo.full_name} - Issue #${issue.number}`);

        try {
            // Fetch repository details to get the primary language
            const { data: repoDetails } = await octokit.repos.get({
                owner: repo.owner.login,
                repo: repo.name,
            });

            let primaryLanguage = repoDetails.language || 'unknown';
            let languageHashtag = '';

            // Check if the repo is not "codinasion/program" and the language is available
            if (repo.full_name !== "codinasion/program" && primaryLanguage !== 'unknown') {
                languageHashtag = ` #${primaryLanguage.replace(/ /g, '')}`;
            }

            // Construct the tweet text including the repository's primary language as a hashtag
            const tweetText = `🔔 New Good First Issue in ${repo.full_name}!\n\n"${issue.title}"\n\nCheck it out: ${issue.html_url}${languageHashtag}`;

            // Post tweet
            const response = await twitterClient.v2.tweet(tweetText);
            console.log('Tweeted:', response.data);
        } catch (error) {
            console.error('Error tweeting:', error);
        }
    }
});

// Error handling for webhooks
webhooks.onError((error) => {
    if (error.name === "AggregateError") {
        console.error(`Error processing request: ${error.event}`);
    } else {
        console.error(error);
    }
});

// Use the middleware to handle webhook requests
app.use(webhookPath, createNodeMiddleware(webhooks));

// Start the server
app.listen(port, () => {
    console.log(`Server is listening for events at: ${localWebhookUrl}`);
    console.log('Press Ctrl + C to quit.');
});
