# X Tweet Manager (Extension)

## Description
X Tweet Manager is a browser extension designed to automate the process of managing posts on your X (formerly Twitter) profile. This extension allows you to undo retweets, unlike tweets, and delete posts, comments, and replies, all without interacting with the X interface manually.

The extension works by automatically navigating through the different sections of your profile (posts, replies, and likes) and performing the appropriate actions. It is designed to be used in debug mode for testing purposes, and it will soon be released as a complete extension on the browser stores.

## Features
- **Undo Retweets**: Automatically undoes retweets in the posts section of your profile.
- **Remove Posts**: Removes your posts (tweets) from your profile in the posts section.
- **Unlike Tweets**: In the likes section, it will automatically unlike tweets that you have liked, one by one.
- **Remove Comments**: If you are in the replies section, it will remove comments on tweets and unlike them if they are liked.
  
### Current Limitations
- **Rate Limit**: The process may be slow due to X’s rate limits. After a tweet or like is processed, a delay will occur to avoid hitting the rate limit.
- **Debug Mode**: Currently, the extension is running in debug mode and requires a manual setup.

## Setup Instructions

### 1. **Loading the Extension**
To load the extension in Firefox in debug mode:

1. Open Firefox and go to the URL `about:debugging#/runtime/this-firefox`.
2. Click the "This Firefox" tab and then click on "Load Temporary Add-on".
3. Select the extension’s `manifest.json` file from your project directory.
   
### 2. **Login to X**
1. Open a new tab in your browser.
2. Navigate to the [X login page](https://x.com) and log in to your account.

### 3. **Go to Your Profile**
Once logged in, go to your X profile page:
- **Posts Section**: You can see your posts (tweets).
- **Replies Section**: You can see your replies (comments).
- **Likes Section**: You can see the tweets you have liked.

### 4. **Activate the Extension**
- **In the Posts Section**: The extension will automatically undo your retweets and remove your tweets.
- **In the Replies Section**: It will unlike any tweets you have liked and remove your comments.
- **In the Likes Section**: It will go through all your liked tweets and unlike them one by one.

### 5. **Reload the Extension if Something Goes Wrong**
- If the extension doesn’t work as expected while navigating between pages, go back to the `about:debugging#/runtime/this-firefox` page in your browser and click on the "Reload" button next to the extension.
- After reloading, ensure you're on your profile page again before proceeding.

### 6. **Rate Limit Handling**
- Due to rate limiting, the extension may perform operations slowly. Be patient while it processes each action.
  
### 7. **Removing the Extension**
After the tweets have been removed, you can remove the extension by going to `about:debugging#/runtime/this-firefox` and clicking "Remove" next to the extension.

## Upcoming Features
- **Full Extension**: The final version of this extension will be published on the browser extension stores soon.
- **Improved Speed**: Future updates will focus on reducing the rate-limiting delays and improving performance.
- **Complete Automation**: More features, including additional tweet management functionalities, will be added.

## Disclaimer
- This extension is currently in its debug phase and is not yet available for general distribution. The code may contain bugs, and the behavior might change in future releases.
- Use this extension responsibly as it automatically interacts with your X account, and ensure you are not violating any of X's terms of service.
