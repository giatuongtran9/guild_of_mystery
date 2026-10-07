// Async GitHub Pages bootstrap. The manifest is the source of truth for Pathway files.
(() => {
  const app = document.getElementById('app');
  const scripts = ['js/paths.js','js/v15.js','js/generate.js','js/engine.js','js/state.js','js/campaign.js','js/ui.js'];

  function loading(title, message, progress=0, error='') {
    app.innerHTML = `<div class="loading-screen"><div class="loading-card">
      <div class="brand-mark">XXII</div><div class="eyebrow">GUILD OF MYSTERY</div>
      <h1>${title}</h1><p>${message}</p><div class="loading-progress"><i style="width:${progress}%"></i></div>
      ${error ? `<p class="loading-error">${error}</p>` : ''}
    </div></div>`;
  }
  const loadScript = src => new Promise((resolve,reject) => {
    const s=document.createElement('script');
    s.src=new URL(src,document.baseURI).href;
    s.onload=resolve;s.onerror=()=>reject(new Error(`Could not load ${src}`));
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
    return scripts.reduce((p,src,i)=>p.then(()=>{
      loading('Preparing the guild',`Loading engine module ${i+1} of ${scripts.length}…`,90+Math.round((i+1)/scripts.length*10));
      return loadScript(src);
    }),Promise.resolve());
  }).catch(err => {
    console.error(err);
    loading('The ledger could not be opened','The game could not load its JSON data or engine files.',100,String(err.message||err));
  });
})();
