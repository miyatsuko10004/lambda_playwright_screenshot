const playwright = require("playwright-core");
const chromium = require("@sparticuz/chromium");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();
const BUCKET_NAME = "your-s3-bucket";

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
        // サムネイル画像ファイル名を URL のパスに基づいて作成
        const urlObj = new URL(url);
        let path = urlObj.pathname.replace(/^\/|\/$/g, "").replace(/\//g, "_");
        path = path || "index"; // ルートURLなら `index`
        const fileName = `screenshots/${urlObj.hostname}/${path}.jpg`;

        // 既に S3 に同じファイルがあるかチェック
        const fileExists = await checkS3FileExists(BUCKET_NAME, fileName);
        if (fileExists) {
            console.log(`File exists: ${fileName}. Returning existing screenshot.`);
            return {
                statusCode: 200,
                body: JSON.stringify({ screenshotUrl: getPresignedUrl(BUCKET_NAME, fileName) }),
            };
        }

        // ファイルがない場合のみキャプチャ処理を実行
        browser = await playwright.chromium.launch({
            args: [...chromium.args, "--disable-gpu", "--disable-dev-shm-usage"],
            headless: chromium.headless === "true" || chromium.headless === true,
            executablePath: await chromium.executablePath(),
        });

        const page = await browser.newPage();
        await page.setViewportSize({ width: 1280, height: 1000 });

        await safeGoto(page, url, 3);

        const screenshotBuffer = await page.screenshot({
            fullPage: false,
            type: "jpeg",
            quality: 30,
        });

        // S3 にアップロード（公開しない）
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: screenshotBuffer,
            ContentType: "image/jpeg",
            ACL: "private"
        }).promise();

        return {
            statusCode: 200,
            body: JSON.stringify({ screenshotUrl: getPresignedUrl(BUCKET_NAME, fileName) }),
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

/**
 * S3 にファイルが存在するかチェック
 */
async function checkS3FileExists(bucket, key) {
    try {
        await s3.headObject({ Bucket: bucket, Key: key }).promise();
        return true;
    } catch (error) {
        if (error.code === "NotFound") {
            return false;
        }
        console.error("Error checking S3 file:", error);
        throw error;
    }
}

/**
 * `page.goto()` のリトライ処理
 */
async function safeGoto(page, url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
            return;
        } catch (error) {
            console.warn(`Retry ${i + 1}/${retries} for ${url}: ${error.message}`);
        }
    }
    throw new Error(`Failed to load ${url} after ${retries} attempts`);
}

/**
 * Presigned URL を発行（1時間有効）
 */
function getPresignedUrl(bucket, key) {
    return s3.getSignedUrl("getObject", {
        Bucket: bucket,
        Key: key,
        Expires: 3600 // 1時間 (3600秒)
    });
}
