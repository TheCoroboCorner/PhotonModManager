document.getElementById('gh-form').addEventListener('submit', async e =>
{
  e.preventDefault();

  const form = e.target;
  const formData = new formData(form);

  const repoUrl = formData.get('repoUrl');
  const jsonPath = formData.get('jsonPath');
  const tags = formData.getAll('tags');

  const payload = { repoUrl, jsonPath, tags };

  const resp = await fetch('/submit',
  {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  
  const result = await resp.json();
  if (result.success)
  {
    alert('Submitted successfully!');
    window.location.href = '/browse';
  } 
  else alert('Error:', (result.error || result.message));
});