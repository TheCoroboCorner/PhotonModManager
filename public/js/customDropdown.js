import icons from './icons.js';

export class CustomDropdown
{
    constructor(options)
    {
        this.options = options.options || [];
        this.selected = options.selected || this.options[0]?.value || '';
        this.onChange = options.onChange || (() => {});
        this.label = options.label || '';
        this.container = this.create();
    }

    create()
    {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';
        
        if (this.label) {
            const label = document.createElement('label');
            label.style.cssText = 'display: block; font-weight: 600; color: var(--text-white); font-size: 0.9rem;';
            label.textContent = this.label;
            wrapper.appendChild(label);
        }
        
        const container = document.createElement('div');
        container.className = 'custom-dropdown-container';
        container.style.cssText = 'position: relative; width: 100%;';
        
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'custom-dropdown-button';
        button.style.cssText = `
            width: 100%;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
            border: 1px solid rgba(102, 126, 234, 0.3);
            color: var(--text-white);
            padding: 0.625rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
            font-family: inherit;
        `;
        
        const selectedText = document.createElement('span');
        const selectedOption = this.options.find(opt => opt.value === this.selected);
        selectedText.textContent = selectedOption?.label || this.options[0]?.label || '';
        
        const arrow = document.createElement('span');
        arrow.textContent = '▼';
        arrow.style.cssText = `
            font-size: 0.625rem;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        button.appendChild(selectedText);
        button.appendChild(arrow);
        
        const dropdown = document.createElement('div');
        dropdown.className = 'custom-dropdown-menu';
        dropdown.style.cssText = `
            position: absolute;
            top: calc(100% + 0.5rem);
            left: 0;
            right: 0;
            background: linear-gradient(135deg, rgba(30, 18, 82, 0.98) 0%, rgba(20, 12, 60, 0.98) 100%);
            border: 1px solid rgba(102, 126, 234, 0.4);
            border-radius: 8px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
        `;
        
        this.options.forEach((opt, index) => {
            const option = document.createElement('div');
            option.className = 'dropdown-option';
            option.dataset.value = opt.value;
            option.style.cssText = `
                padding: 0.75rem 1rem;
                cursor: pointer;
                transition: all 0.2s;
                color: ${opt.value === this.selected ? 'var(--text-white)' : 'var(--text-light)'};
                background: ${opt.value === this.selected ? 'rgba(102, 126, 234, 0.2)' : 'transparent'};
                border-bottom: ${index < this.options.length - 1 ? '1px solid rgba(102, 126, 234, 0.05)' : 'none'};
            `;
            option.textContent = opt.label;
            
            if (opt.value === this.selected)
                option.classList.add('selected');
            
            option.addEventListener('mouseenter', () => {
                option.style.background = 'rgba(102, 126, 234, 0.3)';
                option.style.color = 'var(--text-white)';
                option.style.transform = 'translateX(4px)';
            });
            
            option.addEventListener('mouseleave', () => {
                if (!option.classList.contains('selected')) 
                {
                    option.style.background = 'transparent';
                    option.style.color = 'var(--text-light)';
                    option.style.transform = 'translateX(0)';
                }
            });
            
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                
                dropdown.querySelectorAll('.dropdown-option').forEach(o => {
                    o.classList.remove('selected');
                    o.style.background = 'transparent';
                    o.style.color = 'var(--text-light)';
                });
                option.classList.add('selected');
                option.style.background = 'rgba(102, 126, 234, 0.2)';
                option.style.color = 'var(--text-white)';
                
                this.selected = opt.value;
                selectedText.textContent = opt.label;
                
                this.close();
                this.onChange(opt.value);
            });
            
            dropdown.appendChild(option);
        });
        
        let isOpen = false;
        
        this.open = () => {
            isOpen = true;
            dropdown.style.opacity = '1';
            dropdown.style.transform = 'translateY(0) scale(1)';
            dropdown.style.pointerEvents = 'auto';
            arrow.style.transform = 'rotate(180deg)';
            button.style.borderColor = 'rgba(102, 126, 234, 0.8)';
            button.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)';
        };
        
        this.close = () => {
            isOpen = false;
            dropdown.style.opacity = '0';
            dropdown.style.transform = 'translateY(-10px) scale(0.95)';
            dropdown.style.pointerEvents = 'none';
            arrow.style.transform = 'rotate(0deg)';
            button.style.borderColor = 'rgba(102, 126, 234, 0.3)';
            button.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
        };
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();

            if (isOpen) 
                this.close();
            else 
                this.open();
        });
        
        button.addEventListener('mouseenter', () => {
            if (!isOpen) 
            {
                button.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)';
                button.style.borderColor = 'rgba(102, 126, 234, 0.5)';
                button.style.transform = 'scale(1.02)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!isOpen) 
            {
                button.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
                button.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                button.style.transform = 'scale(1)';
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && isOpen)
                this.close();
        });
        
        container.appendChild(button);
        container.appendChild(dropdown);
        wrapper.appendChild(container);
        
        return wrapper;
    }

    getValue()
    {
        return this.selected;
    }

    setValue(value)
    {
        this.selected = value;
        const button = this.container.querySelector('.custom-dropdown-button span');
        const option = this.options.find(opt => opt.value === value);

        if (button && option)
            button.textContent = option.label;
    }

    getElement()
    {
        return this.container;
    }
}