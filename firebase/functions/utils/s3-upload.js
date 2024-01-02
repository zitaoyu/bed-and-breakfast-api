const fs = require("fs");
const AWSS3 = require("@aws-sdk/client-s3");
require("dotenv").config();

const bucket = process.env.BUCKET;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_ID;

async function uploadImageToS3(path, newFilename, mimetype) {
  const client = new AWSS3.S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new AWSS3.PutObjectCommand({
    Bucket: bucket,
    Body: fs.readFileSync(path),
    Key: newFilename,
    ContentType: mimetype,
  });
  await client.send(command);
  return `https://${bucket}.s3.amazonaws.com/${newFilename}`;
}

module.exports = { uploadImageToS3 };
