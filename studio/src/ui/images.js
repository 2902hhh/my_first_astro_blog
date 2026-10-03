const decode = value => value.replace(/&(?:amp|quot|lt|gt|apos|#\d+|#x[\da-f]+);/gi, entity => {
  const named = { '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&apos;': "'" };
  if (named[entity]) return named[entity];
  const number = entity.toLowerCase().startsWith('&#x') ? Number.parseInt(entity.slice(3, -1), 16) : Number.parseInt(entity.slice(2, -1), 10);
  return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
});
// Keep offsets in the original Markdown, so changing an image never rewrites prose.
export function extractImages(markdown) {
  const excluded = [...markdown.matchAll(/^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]{0,3}\1[`~]*[ \t]*\r?$|$(?![\s\S]))|<!--[\s\S]*?-->|(`+)[^\n]*?\2/gm)].map(match => [match.index, match.index + match[0].length]);
  const images = [];
  const pattern = /<img\b[^>]*>|!\[([^\]\n]*)\]\(([^\s)]+)(?:\s+["'][^\n]*?["'])?\)/gi;
  for (const match of markdown.matchAll(pattern)) {
    if (excluded.some(([start, end]) => match.index >= start && match.index < end)) continue;
    const html = match[0].startsWith('<');
    const attribute = name => match[0].match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2];
    const url = html ? decode(attribute('src') || '') : match[2];
    if (!url || !/^(?:https?:\/\/|\/?(?:\.\.\/)*images\/)/.test(url)) continue;
    const width = (attribute('style') || '').match(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)%/i)?.[1];
    images.push({ start: match.index, end: match.index + match[0].length, raw: match[0], url, alt: html ? decode(attribute('alt') || '') : match[1], width: width ? Number(width) : 100 });
  }
  return images;
}

export function visualMarkdown(markdown) {
  for (const image of extractImages(markdown).reverse()) {
    if (!image.raw.startsWith('<')) continue;
    const alt = image.alt.replace(/[\\\[\]]/g, '\\$&');
    markdown = replaceImage(markdown, image, `![${alt}](${image.url})`);
  }
  return markdown;
}

export function restoreVisualImages(rendered, original) {
  const identity = url => new URL(url, 'http://studio.local/').href;
  const previous = extractImages(original);
  const counts = new Map();
  const replacements = [];
  for (const image of extractImages(rendered)) {
    const key = identity(image.url), occurrence = counts.get(key) || 0;
    counts.set(key, occurrence + 1);
    const old = previous.filter(item => identity(item.url) === key)[occurrence];
    if (old?.raw.startsWith('<')) replacements.push({ image, value: image.alt === old.alt ? old.raw : imageMarkup(old, { alt: image.alt }) });
  }
  for (const { image, value } of replacements.reverse()) rendered = replaceImage(rendered, image, value);
  return rendered;
}

export function replaceImage(markdown, image, markup) {
  if (markdown.slice(image.start, image.end) !== image.raw) throw new Error('图片位置已变化，请重新选中图片。');
  return markdown.slice(0, image.start) + markup + markdown.slice(image.end);
}

export function imageMarkup(image, { url = image.url, width = image.width, alt = image.alt } = {}) {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const style = `width: ${Math.max(10, Math.min(100, Number(width) || 100))}%; height: auto;`;
  if (image.raw.startsWith('<')) {
    let tag = image.raw;
    for (const [key, value] of Object.entries({ src: url, alt, style })) {
      const pattern = new RegExp(`\\b${key}\\s*=\\s*(["']).*?\\1`, 'i');
      let next = value;
      if (key === 'style') {
        const old = tag.match(pattern)?.[0].replace(/^style\s*=\s*(["'])|["']$/gi, '') || '';
        const declarations = old.split(';').map(value => value.trim()).filter(value => value && !/^(?:width|height)\s*:/i.test(value));
        next = (declarations.length ? declarations.join('; ') + '; ' : '') + style;
      }
      if (pattern.test(tag)) tag = tag.replace(pattern, () => `${key}="${escape(next)}"`);
      else tag = tag.replace(/\s*\/?\s*>$/, ` ${key}="${escape(next)}">`);
    }
    return tag;
  }
  return `<img src="${escape(url)}" alt="${escape(alt)}" style="${style}">`;
}
