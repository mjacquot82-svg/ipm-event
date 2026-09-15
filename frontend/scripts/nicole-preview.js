/* global __dirname */
const { readFileSync } = require('node:fs');
const path = require('node:path');

// The content patch is not yet applied to shared staging data. Expose it only
// in this feature branch's Netlify Deploy Preview for content review.
function nicolePreviewContent(env) {
  if (env.CONTEXT !== 'deploy-preview' || env.HEAD !== 'content/nicole-schneider-lifestyles-20260915') return '';
  const origin = new URL(env.DEPLOY_PRIME_URL).origin;
  if (!/^https:\/\/deploy-preview-\d+--ipm-web-staging\.netlify\.app$/.test(origin)) throw new Error('Unexpected Nicole preview origin');
  const content = JSON.parse(readFileSync(path.join(__dirname, '../../backend/import_manifests/nicole_schneider_20260915.json'), 'utf8'));
  return JSON.stringify({ origin, id: content.schedule_item_id, before: content.before,
    patch: { ...content.patch, event_image: { ...content.patch.event_image,
      url: `${origin}/event-media/${path.basename(content.asset)}` } } });
}
module.exports = { nicolePreviewContent };
