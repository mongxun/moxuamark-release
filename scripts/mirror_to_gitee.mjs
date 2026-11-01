import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://gitee.com/api/v5';
const TOKEN = process.env.GITEE_TOKEN;
const OWNER = process.env.GITEE_OWNER;
const REPO = process.env.GITEE_REPO;
const TAG = process.env.RELEASE_TAG;
const RELEASE_NAME = process.env.RELEASE_NAME || TAG;
const RELEASE_BODY = process.env.RELEASE_BODY || '';
const ASSET_DIR = 'mirror';

for (const [name, value] of Object.entries({ GITEE_TOKEN: TOKEN, GITEE_OWNER: OWNER, GITEE_REPO: REPO, RELEASE_TAG: TAG })) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

async function api(method, apiPath, { fields = {}, filePath } = {}) {
  const url = new URL(`${BASE_URL}${apiPath}`);
  const headers = {};
  let body;

  if (filePath) {
    const boundary = `----MoxuaMark${Math.random().toString(16).slice(2)}`;
    const chunks = [];
    for (const [name, value] of Object.entries({ ...fields, access_token: TOKEN })) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    }
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    chunks.push(fs.readFileSync(filePath));
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    body = Buffer.concat(chunks);
    headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    headers['Content-Length'] = String(body.length);
  } else if (method === 'GET' || method === 'DELETE') {
    url.search = new URLSearchParams({ ...fields, access_token: TOKEN }).toString();
  } else {
    body = new URLSearchParams({ ...fields, access_token: TOKEN });
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(240000) });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Gitee API returned HTTP ${response.status}: ${text.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return text.trim() ? JSON.parse(text) : {};
}

const releasePath = () => `/repos/${OWNER}/${REPO}/releases`;
const releaseTag = encodeURIComponent(TAG);

let release;
try {
  release = await api('GET', `${releasePath()}/tags/${releaseTag}`);
  if (!release?.id) release = null;
} catch (error) {
  if (error.status !== 404) throw error;
  release = null;
}
if (!release) {
  release = await api('POST', releasePath(), {
    fields: {
      tag_name: TAG,
      name: RELEASE_NAME,
      body: RELEASE_BODY,
      target_commitish: 'main'
    }
  });
  console.log(`Created Gitee release ${TAG}`);
} else {
  console.log(`Using existing Gitee release ${TAG}`);
}

const releaseID = release.id;
const attachmentResponse = await api('GET', `${releasePath()}/${releaseID}/attach_files`);
const attachments = Array.isArray(attachmentResponse) ? attachmentResponse : (attachmentResponse?.attachments || []);
const existing = new Map();
for (const attachment of attachments) {
  const name = attachment.name || attachment.file_name || attachment.filename;
  if (name) existing.set(name, attachment);
}

for (const name of fs.readdirSync(ASSET_DIR).sort()) {
  const filePath = path.join(ASSET_DIR, name);
  if (!fs.statSync(filePath).isFile()) continue;
  const size = fs.statSync(filePath).size;
  const current = existing.get(name);
  if (current) {
    const remoteSize = current.size || current.file_size;
    if (Number(remoteSize) === size) {
      console.log(`Skipping unchanged asset ${name}`);
      continue;
    }
    const attachmentID = current.id || current.attachment_id;
    await api('DELETE', `${releasePath()}/${releaseID}/attach_files/${attachmentID}`);
    console.log(`Replacing asset ${name}`);
  }
  await api('POST', `${releasePath()}/${releaseID}/attach_files`, { filePath });
  console.log(`Uploaded ${name} (${size} bytes)`);
}

console.log(`Gitee release: https://gitee.com/${OWNER}/${REPO}/releases/tag/${TAG}`);
