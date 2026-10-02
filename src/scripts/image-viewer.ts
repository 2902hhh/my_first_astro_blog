const viewer = document.querySelector<HTMLDialogElement>('.image-viewer');

if (viewer && typeof viewer.showModal === 'function') {
  const preview = viewer.querySelector('img')!;
  const caption = viewer.querySelector('figcaption')!;
  const sizeToggle = viewer.querySelector<HTMLButtonElement>('.image-size-toggle')!;
  const closeButton = viewer.querySelector<HTMLButtonElement>('.image-viewer-close')!;
  const errorMessage = viewer.querySelector<HTMLElement>('.image-viewer-error')!;
  const canvas = viewer.querySelector<HTMLElement>('.image-viewer-canvas')!;
  let trigger: HTMLButtonElement | undefined;
  let previousOverflow = '';

  const resetSize = () => {
    viewer.classList.remove('is-original-size');
    sizeToggle.textContent = '查看原尺寸';
    sizeToggle.setAttribute('aria-pressed', 'false');
    canvas.scrollTop = 0;
    canvas.scrollLeft = 0;
  };

  for (const image of document.querySelectorAll<HTMLImageElement>('.article-body img, .article-cover')) {
    if (image.closest('a, button')) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `image-zoom${image.classList.contains('article-cover') ? ' image-zoom-cover' : ''}`;
    button.setAttribute('aria-label', `放大图片：${image.alt || '文章图片'}`);
    button.setAttribute('aria-haspopup', 'dialog');
    const hint = document.createElement('span');
    hint.className = 'image-zoom-hint';
    hint.textContent = '点击放大 ↗';
    hint.setAttribute('aria-hidden', 'true');
    image.before(button);
    button.append(image, hint);
    button.addEventListener('click', () => {
      trigger = button;
      resetSize();
      errorMessage.hidden = true;
      preview.hidden = false;
      preview.alt = image.alt;
      preview.src = image.currentSrc || image.src;
      caption.textContent = image.alt || '文章图片';
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      viewer.showModal();
    });
  }

  closeButton.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => {
    if (event.target !== viewer) return;
    const rect = viewer.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) viewer.close();
  });
  viewer.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    trigger?.focus({ preventScroll: true });
  });
  sizeToggle.addEventListener('click', () => {
    const original = viewer.classList.toggle('is-original-size');
    sizeToggle.textContent = original ? '适应窗口' : '查看原尺寸';
    sizeToggle.setAttribute('aria-pressed', String(original));
    canvas.scrollTop = 0;
    canvas.scrollLeft = 0;
  });
  preview.addEventListener('error', () => {
    preview.hidden = true;
    errorMessage.hidden = false;
  });
}

export {};
