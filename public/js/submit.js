import { postJson } from './utils.js';

class SubmitForm
{
    constructor(formId = 'gh-form')
    {
        this.form = document.getElementById(formId);
        this.isSubmitting = false;
    }

    init()
    {
        if (!this.form)
        {
            console.error(`Cannot find form #${formId}`);
            return;
        }

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    collectFormData()
    {
        const formData = new FormData(this.form);

        return {
            repoUrl: formData.get('repoUrl'),
            jsonPath: formData.get('jsonPath'),
            tags: formData.getAll('tags')
        }
    }

    async handleSubmit(event)
    {
        event.preventDefault();

        if (this.isSubmitting)
        {
            console.warn('Already submitting, please wait...');
            return;
        }

        this.isSubmitting = true;
        console.log('Submit clicked -- collecting form data...');

        try
        {
            const payload = this.collectFormData();
            console.log('Submitting:', payload);

            const result = await postJson('/submit', payload);
            console.log('Server response:', result);

            alert('Submitted Successfully! Come see your creation!');
            window.location.href = '/browse';
        }
        catch (err)
        {
            console.error('Submit error:', err);
            alert(`Error submitting: ${err.message}`);
            this.isSubmitting = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const submitForm = new SubmitForm();
    submitForm.init();
});