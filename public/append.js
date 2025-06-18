document.getElementById('gh-form').addEventListener('submit', async e => {
  e.preventDefault();
  const { repoUrl, jsonPath } = Object.fromEntries(new FormData(e.target));
  try {
    const resp = await fetch('https://photonmodmanager.onrender.com/append', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ repoUrl, jsonPath })
    });
    const json = await resp.json();
    if (json.error) throw new Error(json.error);
    alert('✅ Successfully imported under key ' + `${jsonPath}@${repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/).slice(1).join('@')}`);
  } catch (err) {
    alert('❌ ' + err.message);
    console.error(err);
  }
});