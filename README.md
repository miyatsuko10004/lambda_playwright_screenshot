# AWS Lambda + Playwright スクリーンショット保存

このリポジトリでは、AWS Lambda 上で **Playwright** を使用して **ウェブページのスクリーンショットを取得し、S3 に保存** する方法を提供します。

## 1. 必要な AWS リソース
### ✅ 必須
- **AWS Lambda 関数**（Node.js 18.x）
- **S3 バケット**（スクリーンショットの保存用）
- **Lambda 用の IAM ロール**（S3 書き込み権限付き）

---

## 2. Lambda の準備

### ✅ 1. WSL / Linux / Mac のセットアップ
```sh
# Node.js 18 をインストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs

# 必要なパッケージをインストール
mkdir lambda_playwright && cd lambda_playwright
npm init -y
npm install playwright-core @sparticuz/chromium aws-sdk

# このリポジトリのindex.jsをlambda_playwrightに格納

# Lambda 用の ZIP を作成
zip -r screenshot_lambda.zip index.js node_modules/
```

### 3. zipをLambdaにアップ、デプロイ
 aws s3 cp screenshot_lambda.zip s3://YOUR_BUCKET/

 aws lambda update-function-code --function-name test-playwright-screenshot --s3-bucket YOUR_BUCKET --s3-key screenshot_lambda.zip

### 4. Lambda設定
・メモリ：2048MB
・タイムアウト：30秒

S3バケットポリシー
```sh
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-s3-bucke-name/screenshots/*"
        }
    ]
}
```

### 5. テスト
```sh
{
    "queryStringParameters": {
        "url": "https://example.com"
    }
}

```
