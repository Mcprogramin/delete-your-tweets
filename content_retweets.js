if (!window.tweetRemoverRunning) {
  window.tweetRemoverRunning = true;

  const timer = (ms) => new Promise((res) => setTimeout(res, ms));

  let totalUnretweeted = 0;
  let isRunning = true;

  // Stop the script by running: window.stopUnretweet() in console
  window.stopUnretweet = () => {
    isRunning = false;
    window.tweetRemoverRunning = false;
    console.log("// Stopping script... //");
  };

  const unretweetBatch = async () => {
    const retweetedTweetList = document.querySelectorAll(
      'span[data-testid="socialContext"]',
    );

    if (retweetedTweetList.length === 0) {
      console.log("// No retweets found, scrolling... //");
      return 0;
    }

    let batchCount = 0;

    for (const retweet of retweetedTweetList) {
      if (!isRunning) break;

      const tweetWrapper = retweet.closest('[data-testid="tweet"]');
      if (!tweetWrapper) continue;

      tweetWrapper.scrollIntoView({ behavior: "smooth", block: "center" });
      await timer(800);

      const unretweetButton = tweetWrapper.querySelector(
        'button[data-testid="unretweet"]',
      );

      if (unretweetButton) {
        try {
          unretweetButton.click();
          await timer(500);
          const confirmButton = document.querySelector(
            'div[data-testid="unretweetConfirm"]',
          );
          if (confirmButton) {
            confirmButton.click();
            batchCount++;
            totalUnretweeted++;
            console.log(`✓ Unretweeted #${totalUnretweeted}`);
          }
        } catch (error) {
          console.error("Error:", error);
        }
      }

      await timer(3000); // 3 second delay between unretweets
    }

    return batchCount;
  };

  const autoUnretweet = async () => {
    console.log("🚀 Starting autonomous unretweet script...");
    console.log("⚠️ To stop at any time, type: window.stopUnretweet() in console");
    console.log(" ");

    while (isRunning) {
      const processed = await unretweetBatch();

      if (!isRunning) break;

      // Scroll down to load more
      console.log("📜 Scrolling to load more tweets...");
      let prevHeight = document.body.scrollHeight;
      window.scrollBy(0, window.innerHeight * 2);

      // Wait for new tweets to load
      await timer(3000);

      // If no tweets were processed, scroll a bit more
      if (processed === 0) {
        console.log(
          "⏸️  No retweets found. Scrolling further...",
        );
        window.scrollBy(0, window.innerHeight * 2);
        await timer(2000); // Total wait: 5 seconds
        
        if (document.body.scrollHeight <= prevHeight) {
          alert(`✅ Success! Reached the bottom. Total unretweeted: ${totalUnretweeted}`);
          break;
        }
      }
    }

    console.log(" ");
    console.log(`✅ Script stopped. Total unretweeted: ${totalUnretweeted}`);
    window.tweetRemoverRunning = false;
  };

  autoUnretweet();

} else {
  console.log("Tweet remover already running. Type window.stopUnretweet() in console to stop it.");
}
