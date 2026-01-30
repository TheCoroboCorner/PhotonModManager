import { toast } from './toast.js';
import { confetti } from './confetti.js';
import { imageUploadManager } from './imageUpload.js';

console.log('[SubmitHandler] Module loading...');

class SubmitHandler
{
    constructor()
    {
        this.isSubmitting = false;
        this.form = null;
        this.submitBtn = null;
    }

    init()
    {
        console.log('[SubmitHandler] Initializing...');

        this.form = document.getElementById('gh-form');
        if (!this.form)
        {
            console.error('[SubmitHandler] Form not found!');
            return false;
        }

        this.submitBtn = this.form.querySelector('button[type="submit"]');
        if (!this.submitBtn)
        {
            console.error('[SubmitHandler] Submit button not found!');
            return false;
        }

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        console.log('[SubmitHandler] Initialization complete');
        return true;
    }

    async handleSubmit(e) 
    {
        e.preventDefault();
        
        if (this.isSubmitting) 
        {
            toast.warning('Please wait, submission in progress...');
            return;
        }
        
        this.isSubmitting = true;
        this.setButtonLoading(true);
        
        try 
        {
            console.log('[SubmitHandler] Step 1: Submitting mod metadata');
            const modKey = await this.submitModMetadata();
            console.log('[SubmitHandler] Step 1 complete: Mod key =', modKey);
            
            const uploadedImages = imageUploadManager.getUploadedImages();
            const thumbnailIndex = imageUploadManager.getThumbnailIndex();
            
            if (uploadedImages.length > 0) 
            {
                console.log('[SubmitHandler] Step 2: Uploading', uploadedImages.length, 'images');
                await this.uploadImages(modKey, uploadedImages, thumbnailIndex);
                console.log('[SubmitHandler] Step 2 complete');
            } 
            else
                console.log('[SubmitHandler] No images to upload');
            
            console.log('[SubmitHandler] All done! Redirecting to mod page...');
            confetti.celebrate(3000, 200);
            toast.success('Mod submitted successfully!');
            
            setTimeout(() => window.location.href = `/mod.html?key=${encodeURIComponent(modKey)}`, 2000);
            
        } 
        catch (error) 
        {
            console.error('[SubmitHandler] Error:', error);
            toast.error(error.message || 'Failed to submit mod');
            this.isSubmitting = false;
            this.setButtonLoading(false);
        }
    }

    async submitModMetadata() 
    {
        const formData = {
            repoUrl: document.querySelector('[name="repoUrl"]').value,
            jsonPath: document.querySelector('[name="jsonPath"]')?.value || '',
            tags: Array.from(document.querySelectorAll('[name="tags"]:checked')).map(cb => cb.value)
        };
        
        console.log('[SubmitHandler] Submitting mod data:', { repoUrl: formData.repoUrl, jsonPath: formData.jsonPath || '(auto-detect)', tags: formData.tags });
        
        const response = await fetch('/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        
        if (!response.ok) 
        {
            const error = await response.json();
            throw new Error(error.error || 'Failed to submit mod');
        }
        
        const result = await response.json();
        return result.key;
    }

    async uploadImages(modKey, uploadedImages, thumbnailIndex) 
    {
        console.log('[SubmitHandler] Preparing image upload for', modKey);
        console.log('[SubmitHandler] Images:', uploadedImages.length);
        console.log('[SubmitHandler] Thumbnail index:', thumbnailIndex);
        
        const formData = new FormData();
        formData.append('modKey', modKey);
        
        uploadedImages.forEach((imageData, index) => {
            formData.append('images', imageData.file);
            console.log(`[SubmitHandler] Added image ${index + 1}: ${imageData.file.name} (${imageData.file.size} bytes)`);
        });
        
        formData.append('thumbnailIndex', thumbnailIndex !== null ? thumbnailIndex : '-1');
        
        console.log('[SubmitHandler] Sending image upload request...');
        
        const response = await fetch('/upload-images', { method: 'POST', body: formData });
        
        if (!response.ok) 
        {
            const errorText = await response.text();
            console.error('[SubmitHandler] Image upload failed:', errorText);
            toast.warning('Mod submitted but images failed to upload');
            throw new Error('Image upload failed: ' + errorText);
        }
        
        const result = await response.json();
        console.log('[SubmitHandler] Images uploaded successfully:', result);
        
        if (result.images && result.images.length > 0)
            toast.success(`Uploaded ${result.images.length} images!`);
        
        return result;
    }

    setButtonLoading(loading) 
    {
        if (!this.submitBtn) 
            return;
        
        if (loading) 
        {
            this.originalButtonHTML = this.submitBtn.innerHTML;
            this.submitBtn.disabled = true;
            this.submitBtn.innerHTML = `
                <div class="loading-spinner" style="width: 20px; height: 20px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: white; border-radius: 50%; display: inline-block; vertical-align: middle; margin-right: 0.5rem; animation: spin 0.8s linear infinite;"></div>
                Submitting...
            `;
        } 
        else 
        {
            this.submitBtn.disabled = false;
            this.submitBtn.innerHTML = this.originalButtonHTML || 'Submit Mod';
        }
    }
}

const submitHandler = new SubmitHandler();

if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => submitHandler.init());
else
    submitHandler.init();

export { submitHandler };