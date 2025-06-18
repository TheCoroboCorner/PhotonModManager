document.getElementById('gh-form').addEventListener('submit', async e => {
  e.preventDefault();
  const { repoUrl, jsonPath } = Object.fromEntries(new FormData(e.target));
  const resp = await fetch('/submit', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ repoUrl, jsonPath })
  });
  const j = await resp.json();
  if (j.error) alert('❌ ' + j.error);
  else          alert('✅ Saved under key ' + j.key);
});