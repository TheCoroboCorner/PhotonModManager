console.log('[ImageUpload] Module loading...');

class ImageUploadManager
{
    constructor()
    {
        this.uploadedImages = [];
        this.thumbnailIndex = null;
        this.elements = {};
    }

    init()
    {
        console.log('[ImageUpload] Initializing...');

        this.elements = {
            imageUpload: document.getElementById('image-upload'),
            uploadTrigger: document.getElementById('upload-trigger'),
            uploadText: document.getElementById('upload-text'),
            previewContainer: document.getElementById('image-preview-container')
        };

        const missing = Object.entries(this.elements).filter(([key, el]) => !el).map(([key]) => key);
        if (missing.length > 0)
        {
            console.error('[ImageUpload] Missing elements:', missing);
            return false;
        }

        console.log('[ImageUpload] All elements found');

        this.setupEventListeners();

        console.log('[ImageUpload] Initialization complete');
        return true;
    }

    setupEventListeners()
    {
        const { imageUpload, uploadTrigger } = this.elements;

        uploadTrigger.addEventListener('click', () => {
            console.log('[ImageUpload] Upload button clicked');
            imageUpload.click();
        });

        uploadTrigger.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadTrigger.style.borderColor = 'var(--accent-blue)';
            uploadTrigger.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
        });

        uploadTrigger.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.resetUploadTriggerStyle();
        });

        uploadTrigger.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.resetUploadTriggerStyle();
            
            console.log('[ImageUpload] Files dropped');
            const files = Array.from(e.dataTransfer.files).filter(f => {
                const isImage = f.type.startsWith('image/');
                console.log('[ImageUpload] File:', f.name, 'Type:', f.type, 'Is image:', isImage);
                return isImage;
            });
            
            if (files.length > 0) 
            {
                console.log('[ImageUpload] Processing', files.length, 'image files');
                this.addImages(files);
            } 
            else
                console.warn('[ImageUpload] No valid image files in drop');
        });

        imageUpload.addEventListener('change', (e) => {
            console.log('[ImageUpload] File input changed');
            const files = Array.from(e.target.files);
            console.log('[ImageUpload] Selected', files.length, 'files');
            
            if (files.length > 0)
                this.addImages(files);
            
            e.target.value = '';
        });
    }

    resetUploadTriggerStyle()
    {
        const { uploadTrigger } = this.elements;
        uploadTrigger.style.borderColor = 'rgba(102, 126, 234, 0.5)';
        uploadTrigger.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)';
    }

    addImages(files)
    {
        console.log('[ImageUpload] addImages() called with', files.length, 'files');
        
        if (this.uploadedImages.length + files.length > 10) 
        {
            alert(`You can only upload up to 10 images. Currently have ${this.uploadedImages.length}.`);
            return;
        }

        files.forEach((file, fileIndex) => {
            console.log(`[ImageUpload] Processing file ${fileIndex + 1}/${files.length}: ${file.name}`);
            
            if (file.size > 5 * 1024 * 1024) 
            {
                console.error(`[ImageUpload] File ${file.name} is too large: ${file.size} bytes`);
                alert(`File ${file.name} is too large (max 5MB)`);
                return;
            }

            if (!file.type.startsWith('image/')) 
            {
                console.error(`[ImageUpload] File ${file.name} is not an image: ${file.type}`);
                alert(`File ${file.name} is not a valid image`);
                return;
            }

            this.readImageFile(file);
        });
    }

    readImageFile(file)
    {
        const reader = new FileReader();
        
        reader.onloadstart = () => {
            console.log(`[ImageUpload] FileReader started for ${file.name}`);
        };
        
        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = (e.loaded / e.total * 100).toFixed(0);
                console.log(`[ImageUpload] Loading ${file.name}: ${percent}%`);
            }
        };
        
        reader.onload = (e) => {
            console.log(`[ImageUpload] FileReader completed for ${file.name}`);
            console.log(`[ImageUpload] Data URL length: ${e.target.result.length} bytes`);
            
            const imageData = {
                file: file,
                dataUrl: e.target.result,
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
            };
            
            this.uploadedImages.push(imageData);
            console.log(`[ImageUpload] Added to array. Total images: ${this.uploadedImages.length}`);
            
            this.renderImages();
        };
        
        reader.onerror = (e) => {
            console.error(`[ImageUpload] FileReader error for ${file.name}:`, e);
            console.error('[ImageUpload] Error details:', reader.error);
            alert(`Failed to read file ${file.name}: ${reader.error.message}`);
        };
        
        try 
        {
            console.log(`[ImageUpload] Starting FileReader for ${file.name}`);
            reader.readAsDataURL(file);
        } 
        catch (err) 
        {
            console.error(`[ImageUpload] Exception when starting FileReader:`, err);
            alert(`Error reading ${file.name}: ${err.message}`);
        }
    }

    removeImage(id)
    {
        console.log('[ImageUpload] Removing image:', id);
        const index = this.uploadedImages.findIndex(img => img.id === id);
        
        if (index === -1) 
        {
            console.warn('[ImageUpload] Image not found:', id);
            return;
        }

        if (this.thumbnailIndex === index) 
        {
            console.log('[ImageUpload] Removed image was thumbnail, clearing');
            this.thumbnailIndex = null;
        } 
        else if (this.thumbnailIndex !== null && index < this.thumbnailIndex) 
        {
            console.log('[ImageUpload] Adjusting thumbnail index');
            this.thumbnailIndex--;
        }

        this.uploadedImages.splice(index, 1);
        console.log('[ImageUpload] Image removed. Remaining:', this.uploadedImages.length);
        this.renderImages();
    }

    toggleThumbnail(index) 
    {
        console.log('[ImageUpload] Toggling thumbnail at index:', index);
        
        if (this.thumbnailIndex === index) 
        {
            console.log('[ImageUpload] Deselecting thumbnail');
            this.thumbnailIndex = null;
        } 
        else 
        {
            console.log('[ImageUpload] Setting thumbnail to index:', index);
            this.thumbnailIndex = index;
        }
        
        this.renderImages();
    }

    renderImages() 
    {
        console.log('[ImageUpload] renderImages() called. Count:', this.uploadedImages.length);
        
        const { previewContainer, uploadText } = this.elements;
        previewContainer.innerHTML = '';

        if (this.uploadedImages.length === 0) 
        {
            uploadText.textContent = 'Click to add images or drag & drop';
            console.log('[ImageUpload] No images to render');
            return;
        }

        uploadText.textContent = `Add more images (${this.uploadedImages.length}/10)`;

        this.uploadedImages.forEach((imageData, index) => {
            console.log(`[ImageUpload] Rendering image ${index + 1}/${this.uploadedImages.length}: ${imageData.file.name}`);
            
            const itemDiv = this.createImagePreviewItem(imageData, index);
            previewContainer.appendChild(itemDiv);
        });

        console.log('[ImageUpload] Render complete');
    }

    createImagePreviewItem(imageData, index) 
    {
        const isThumbnail = this.thumbnailIndex === index;
        
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        div.style.cssText = `
            position: relative;
            border-radius: 8px;
            overflow: hidden;
            border: 3px solid ${isThumbnail ? 'var(--accent-blue)' : 'transparent'};
            transition: all 0.3s;
            animation: fadeIn 0.3s ease;
        `;
        
        const img = document.createElement('img');
        img.style.cssText = 'width: 100%; height: 150px; object-fit: cover; display: block;';
        
        img.onload = () => console.log(`[ImageUpload] Image element loaded: ${imageData.file.name}`);
        
        img.onerror = (e) => {
            console.error(`[ImageUpload] Failed to display image: ${imageData.file.name}`, e);
            div.style.display = 'none';
        };
        
        img.src = imageData.dataUrl;
        div.appendChild(img);

        const removeBtn = this.createRemoveButton(imageData.id);
        div.appendChild(removeBtn);

        const thumbBtn = this.createThumbnailButton(index, isThumbnail);
        div.appendChild(thumbBtn);

        const nameDiv = this.createNameOverlay(imageData.file.name);
        div.appendChild(nameDiv);

        return div;
    }

    createRemoveButton(imageId) 
    {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = '×';
        btn.style.cssText = `
            position: absolute;
            top: 0.5rem;
            left: 0.5rem;
            background: rgba(255, 59, 48, 0.9);
            border: none;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.4rem;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.2s;
            z-index: 10;
        `;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            this.removeImage(imageId);
        };

        btn.onmouseenter = () => btn.style.transform = 'scale(1.1)';

        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        
        return btn;
    }

    createThumbnailButton(index, isThumbnail) 
    {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = isThumbnail ? '⭐ Thumbnail' : '☆ Set thumbnail';
        btn.style.cssText = `
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background: ${isThumbnail ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(0, 0, 0, 0.7)'};
            border: none;
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.75rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            transition: all 0.2s;
            z-index: 10;
        `;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            this.toggleThumbnail(index);
        };

        btn.onmouseenter = () => btn.style.transform = 'scale(1.05)';

        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        
        return btn;
    }

    createNameOverlay(fileName) 
    {
        const div = document.createElement('div');
        div.textContent = fileName.length > 20 ? 
            fileName.substring(0, 20) + '...' : 
            fileName;
        div.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
            padding: 0.5rem;
            font-size: 0.75rem;
            color: white;
        `;
        return div;
    }

    // Public API for form submission
    getUploadedImages() 
    {
        console.log('[ImageUpload] getUploadedImages() called, returning', this.uploadedImages.length, 'images');
        return this.uploadedImages;
    }

    getThumbnailIndex() 
    {
        console.log('[ImageUpload] getThumbnailIndex() called, returning', this.thumbnailIndex);
        return this.thumbnailIndex;
    }

    reset() 
    {
        console.log('[ImageUpload] Resetting...');
        this.uploadedImages = [];
        this.thumbnailIndex = null;
        this.renderImages();
    }
}

const imageUploadManager = new ImageUploadManager();

if (document.readyState === 'loading') 
    document.addEventListener('DOMContentLoaded', () => imageUploadManager.init());
else 
    imageUploadManager.init();

export { imageUploadManager };