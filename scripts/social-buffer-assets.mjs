const gqlString = value => JSON.stringify(value);

export function buildBufferAssetsInput(assets) {
  if (!Array.isArray(assets) || !assets.length) throw new Error('Buffer media assets are required');
  return assets.map(asset => {
    if (!['image', 'video'].includes(asset.type) || !asset.url) throw new Error('Invalid Buffer media asset');
    return `{${asset.type}:{url:${gqlString(asset.url)}}}`;
  }).join(',');
}
