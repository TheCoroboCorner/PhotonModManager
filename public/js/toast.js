class ToastManager
{
    constructor()
    {
        this.container = null;
        this.init();
    }

    init()
    {
        if (!document.querySelector('.toast-container'))
        {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
        else
        {
            this.container = document.querySelector('.toast-container');
        }
    }

    remove(toast)
    {
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentNode)
                toast.parentNode.removeChild(toast);
        }, 300);
    }

    createToast(message, type)
    {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Info'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type] || titles.info}</div>
                <p class="toast-message">${message}</p>
            </div>
            <button class="toast-close" aria-label="Close">&times;</button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.remove(toast));

        return toast;
    }

    show(message, type = 'info', duration = 4000)
    {
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);

        if (duration > 0)
            setTimeout(() => this.remove(toast), duration);

        return toast;
    }

    // Convenience methods

    success(message, duration)
    {
        return this.show(message, 'success', duration);
    }

    error(message, duration)
    {
        return this.show(message, 'error', duration);
    }

    warning(message, duration)
    {
        return this.show(message, 'warning', duration);
    }

    info(message, duration)
    {
        return this.show(message, 'info', duration);
    }
}

const toast = new ToastManager();

export { ToastManager, toast };

window.toast = toast;