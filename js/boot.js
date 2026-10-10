// Preload together, then execute in order so a failed module stops startup.
(() => {
  const app = document.getElementById('app');
  const scripts = ['js/paths.js','js/v15.js','js/generate.js','js/signatures.js','js/mythical.js','js/engine.js','js/state.js','js/campaign.js','js/ui.js'];
  const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function loading(title, message, progress=0, error='') {
    app.innerHTML = `<div class="loading-screen"><div class="loading-card">
      <div class="brand-mark">XXII</div><div class="eyebrow">GUILD OF MYSTERY</div>
      <h1>${escapeText(title)}</h1><p>${escapeText(message)}</p><div class="loading-progress"><i style="width:${progress}%"></i></div>
      ${error ? `<p class="loading-error">${escapeText(error)}</p>` : ''}
    </div></div>`;
  }
  const loadScript = (src, version) => new Promise((resolve,reject) => {
    const s=document.createElement('script');
    s.async=false;
    s.src=new URL(`${src}?v=${version}`,document.baseURI).href;
    const finish = error => {
      window.removeEventListener('error', executionError);
      error ? reject(error) : resolve();
    };
    const executionError = event => {
      if (event.filename === s.src) finish(new Error(event.message || `Could not execute ${src}`));
    };
    window.addEventListener('error', executionError);
    s.onload=()=>finish();s.onerror=()=>finish(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });

  loading('Opening the guild ledger','Reading the pathway manifest…',2);
  G9DataLoader.load(progress => {
    if (progress.phase === 'pathways') {
      loading('Opening the guild ledger', progress.label, 5 + Math.round(progress.current / progress.total * 65));
    } else if (progress.phase === 'data') {
      loading('Opening the guild ledger', progress.label, 70 + Math.round(progress.current / progress.total * 20));
    } else {
      loading('Opening the guild ledger', progress.label, 4);
    }
  }).then(data => {
    window.G9_DATA=data;
    loading('Preparing the guild','Loading the game engine…',90);
    const version = data.runtimeManifest;
    if (version.serviceWorkerVersion && window.navigator?.serviceWorker) {
      Promise.resolve().then(() => window.navigator.serviceWorker.register(
        new URL(`sw.js?v=${version.serviceWorkerVersion}`, document.baseURI).href,
        { scope: new URL('./', document.baseURI).pathname, updateViaCache: 'none' }
      )).catch(() => {});
    }
    for (const src of scripts) {
      const link = document.createElement('link');
      link.rel = 'preload';link.as = 'script';
      link.href = new URL(`${src}?v=${version.scriptVersions[src]}`, document.baseURI).href;
      document.head.appendChild(link);
    }
    return scripts.reduce((pending, src) => pending.then(() => loadScript(src, version.scriptVersions[src])), Promise.resolve());
  }).catch(err => {
    console.error(err);
    loading('The ledger could not be opened','The game could not load its JSON data or engine files.',100,String(err.message||err));
  });
})();
