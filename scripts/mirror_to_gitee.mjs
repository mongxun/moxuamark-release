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
    body = new FormData();
    for (const [name, value] of Object.entries(fields)) body.append(name, String(value));
    body.append('access_token', TOKEN);
    body.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/octet-stream' }), path.basename(filePath));
  } else if (method === 'GET' || method === 'DELETE') {
    url.search = new URLSearchParams({ ...fields, access_token: TOKEN }).toString();
  } else {
    body = new URLSearchParams({ ...fields, access_token: TOKEN });
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(url, { method, headers, body });
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
  console.log(`Using existing Gitee release ${TAG}`);
} catch (error) {
  if (error.status !== 404) throw error;
  release = await api('POST', releasePath(), {
    fields: {
      tag_name: TAG,
      name: RELEASE_NAME,
      body: RELEASE_BODY,
      target_commitish: 'main'
    }
  });
  console.log(`Created Gitee release ${TAG}`);
}

const releaseID = release.id;
const attachmentResponse = await api('GET', `${releasePath()}/${releaseID}/attachments`);
const attachments = Array.isArray(attachmentResponse) ? attachmentResponse : (attachmentResponse.attachments || []);
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
    await api('DELETE', `${releasePath()}/${releaseID}/attachments/${attachmentID}`);
    console.log(`Replacing asset ${name}`);
  }
  await api('POST', `${releasePath()}/${releaseID}/attachments`, { filePath });
  console.log(`Uploaded ${name} (${size} bytes)`);
}

console.log(`Gitee release: https://gitee.com/${OWNER}/${REPO}/releases/tag/${TAG}`);
