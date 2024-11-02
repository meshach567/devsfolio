const fs = require("fs");
const https = require("https");
const process = require("process");
require("dotenv").config();

// Environment variables validation
const config = {
  GITHUB_TOKEN: process.env.REACT_APP_GITHUB_TOKEN,
  GITHUB_USERNAME: process.env.GITHUB_USERNAME,
  USE_GITHUB_DATA: process.env.USE_GITHUB_DATA,
  // MEDIUM_USERNAME: process.env.MEDIUM_USERNAME
};

// Enhanced error messages
const ERR = {
  noUserName: "GitHub Username is undefined. Please check your .env file and ensure GITHUB_USERNAME is set.",
  noToken: "GitHub Token is undefined. Please check your .env file and ensure REACT_APP_GITHUB_TOKEN is set.",
  requestFailed: (statusCode) => 
    `GitHub API request failed with status ${statusCode}. Please verify your token has the necessary permissions.`,
  requestFailedMedium: (statusCode) =>
    `Medium API request failed with status ${statusCode}. Please verify your Medium username is correct.`
};

// Validate environment variables
function validateConfig() {
  if (config.USE_GITHUB_DATA === "true") {
    if (!config.GITHUB_USERNAME) throw new Error(ERR.noUserName);
    if (!config.GITHUB_TOKEN) throw new Error(ERR.noToken);
  }
}

// GitHub GraphQL query
function createGitHubQuery(username) {
  return JSON.stringify({
    query: `
      {
        user(login:"${username}") { 
          name
          bio
          avatarUrl
          location
          pinnedItems(first: 6, types: [REPOSITORY]) {
            totalCount
            edges {
              node {
                ... on Repository {
                  name
                  description
                  forkCount
                  stargazers {
                    totalCount
                  }
                  url
                  id
                  diskUsage
                  primaryLanguage {
                    name
                    color
                  }
                }
              }
            }
          }
        }
      }
    `
  });
}

// Save data to file
function saveToFile(filepath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filepath, data, (err) => {
      if (err) reject(err);
      console.log(`Saved file to ${filepath}`);
      resolve();
    });
  });
}

// Fetch GitHub profile data
async function fetchGitHubProfile() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: "/graphql",
      port: 443,
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.GITHUB_TOKEN}`,
        "User-Agent": "Node",
        "Content-Type": "application/json",
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      
      if (res.statusCode !== 200) {
        reject(new Error(ERR.requestFailed(res.statusCode)));
        return;
      }

      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.write(createGitHubQuery(config.GITHUB_USERNAME));
    req.end();
  });
}

// Fetch Medium blogs data
async function fetchMediumBlogs() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.rss2json.com",
      path: `/v1/api.json?rss_url=https://medium.com/feed/@${config.MEDIUM_USERNAME}`,
      port: 443,
      method: "GET"
    };

    const req = https.request(options, (res) => {
      let data = "";
      
      if (res.statusCode !== 200) {
        reject(new Error(ERR.requestFailedMedium(res.statusCode)));
        return;
      }

      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    });

    req.on("error", reject);
    req.end();
  });
}

// Main execution
async function main() {
  try {
    validateConfig();

    if (config.USE_GITHUB_DATA === "true") {
      console.log(`Fetching profile data for ${config.GITHUB_USERNAME}`);
      const githubData = await fetchGitHubProfile();
      await saveToFile("./public/profile.json", githubData);
    }

    if (config.MEDIUM_USERNAME) {
      console.log(`Fetching Medium blogs data for ${config.MEDIUM_USERNAME}`);
      const mediumData = await fetchMediumBlogs();
      await saveToFile("./public/blogs.json", mediumData);
    }
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();