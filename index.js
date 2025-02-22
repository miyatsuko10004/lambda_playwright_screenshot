const playwright = require("playwright-core");
const chromium = require("@sparticuz/chromium");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();
const BUCKET_NAME = "your-s3-bucket-name";

exports.handler = async (event) => {
    const queryParams = event.queryStringParameters || {};
    const url = queryParams.url;

    if (!url) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "URL is required" }),
        };
    }

    let browser;
    try {
        browser = await playwright.chromium.launch({
            args: chromium.args,
            headless: chromium.headless === "true" || chromium.headless === true,
            executablePath: await chromium.executablePath()
        });

        const page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 1000 });
        await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

        await page.evaluate(() => {
            document.body.style.height = "1000px";
            document.documentElement.style.height = "1000px";
            document.body.style.overflow = "hidden";
        });

        const screenshotBuffer = await page.screenshot({
            fullPage: false,
        });

        // URL からドメイン名を取得
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/\./g, "-");
        const timestamp = Date.now();
        const fileName = `screenshots/${domain}_${timestamp}.png`;

        // S3 に保存
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: screenshotBuffer,
            ContentType: "image/png",
            Metadata: { "x-amz-acl": "BucketOwnerFullControl" }
        }).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({ screenshotUrl: `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}` }),
        };
    } catch (error) {
        console.error("Error capturing screenshot:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
