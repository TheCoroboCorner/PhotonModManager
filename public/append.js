document.addEventListener('DOMContentLoaded', () =>
{
  const form = document.getElementById('gh-form');
  if (!form)
  {
    console.error('Cannot find #gh-form on the page.');
    return;
  }

  form.addEventListener('submit', async(e) =>
  {
    e.preventDefault();
    console.log('Submit clicked -- collecting form data...');

    try
    {
      const formData = new FormData(form);
      const repoUrl  = formData.get('repoUrl');
      const jsonPath = formData.get('jsonPath');
      const tags     = formData.getAll('tags');

      const payload = { repoUrl, jsonPath, tags };
      console.log(payload);

      const resp = await fetch('/submit', 
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await resp.json();
      if (!resp.ok)
        throw new Error(result.error || JSON.stringify(result));

      console.log('Server response:', result);
      alert('Submitted successfully! Come see your creation!');
      window.location.href = '/browse';
    }
    catch (err)
    {
      console.error('Submit error:', err);
      alert('Error submitting:', err.message);
    }
  });
});