import { postJson } from './utils.js';
import { toast } from './toast.js';
import { confetti } from './confetti.js';

class SubmitForm
{
    constructor(formId = 'gh-form')
    {
        this.form = document.getElementById(formId);
        this.isSubmitting = false;
        this.submitButton = null;
    }

    init()
    {
        if (!this.form)
        {
            console.error(`Cannot find form #${formId}`);
            return;
        }

        this.submitButton = this.form.querySelector('button[type="submit"]');
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    setButtonLoading(isLoading)
    {
        if (!this.submitButton)
            return;

        if (isLoading)
        {
            this.submitButton.disabled = true;
            this.submitButton.innerHTML = `
                <span class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px; margin-right: 0.5rem;"></span>
                Submitting...
            `;
        }
        else
        {
            this.submitButton.disabled = false;
            this.submitButton.innerHTML = 'Submit Mod'
        }
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
            toast.warning('Please wait, submission in progress...');
            return;
        }

        this.isSubmitting = true;
        this.setButtonLoading(true);

        console.log('Submit clicked -- collecting form data...');

        try
        {
            const payload = this.collectFormData();
            console.log('Submitting:', payload);

            const result = await postJson('/submit', payload);
            console.log('Server response:', result);

            confetti.celebrate(3000, 200);
            toast.success('Your mod submitted successfully! Come see your creation!')

            setTimeout(() => { window.location.href = '/browse'; }, 2000);
        }
        catch (err)
        {
            console.error('Submit error:', err);
            toast.error(err.message || 'Failed to submit mod. Please try again.');

            this.isSubmitting = false;
            this.setButtonLoading(false);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const submitForm = new SubmitForm();
    submitForm.init();
});