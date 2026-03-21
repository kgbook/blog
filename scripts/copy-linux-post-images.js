const fs = require('fs');
const path = require('path');

hexo.extend.filter.register('after_generate', () => {
  const sourceDir = path.join(hexo.source_dir, '_posts', 'Linux', 'images');
  const targetDir = path.join(hexo.public_dir, 'images');

  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.cpSync(sourceDir, targetDir, { recursive: true });
});
