const copyStatus = document.querySelector<HTMLElement>('.reader-status');

for (const pre of document.querySelectorAll<HTMLPreElement>('.article-body pre')) {
  const code = pre.querySelector('code');
  if (!code) continue;
  const wrapper = document.createElement('div');
  wrapper.className = 'code-block';
  const toolbar = document.createElement('div');
  toolbar.className = 'code-toolbar';
  const language = document.createElement('span');
  language.textContent = pre.dataset.language || code.className.match(/language-([\w-]+)/)?.[1] || '代码';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy';
  button.textContent = '复制代码';
  toolbar.append(language, button);
  pre.before(wrapper);
  wrapper.append(toolbar, pre);
  let resetTimer: ReturnType<typeof setTimeout>;

  button.addEventListener('click', async () => {
    clearTimeout(resetTimer);
    if (copyStatus) copyStatus.textContent = '';
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(code.textContent || '');
      button.textContent = '已复制';
      if (copyStatus) copyStatus.textContent = '代码已复制到剪贴板。';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      button.textContent = '请手动复制';
      if (copyStatus) copyStatus.textContent = '自动复制不可用，已选中代码，请使用复制快捷键或长按复制。';
    } finally {
      button.disabled = false;
      resetTimer = setTimeout(() => { button.textContent = '复制代码'; }, 2400);
    }
  });
}

export {};
