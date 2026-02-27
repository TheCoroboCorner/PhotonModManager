import icons from './icons.js';

export class MultiSelectDropdown
{
    constructor(options)
    {
        this.options = options.options || [];
        this.selected = new Set(options.selected || []);
        this.onChange = options.onChange || (() => {});
        this.label = options.label || '';
        this.container = this.create();
    }

    create()
    {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';
        
        if (this.label) 
        {
            const label = document.createElement('label');
            label.style.cssText = 'display: block; font-weight: 600; color: var(--text-white); font-size: 0.9rem;';
            label.textContent = this.label;
            wrapper.appendChild(label);
        }
        
        const container = document.createElement('div');
        container.className = 'multi-select-container';
        container.style.cssText = 'position: relative; width: 100%;';
        
        const display = document.createElement('div');
        display.className = 'multi-select-display';
        display.style.cssText = `
            min-height: 42px;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
            border: 1px solid rgba(102, 126, 234, 0.3);
            color: var(--text-white);
            padding: 0.5rem;
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
        
        const selectedTags = document.createElement('div');
        selectedTags.className = 'selected-tags';
        selectedTags.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.25rem; flex: 1;';
        this.updateSelectedDisplay(selectedTags);
        
        const arrow = document.createElement('span');
        arrow.textContent = '▼';
        arrow.style.cssText = `
            font-size: 0.625rem;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            flex-shrink: 0;
        `;
        
        display.appendChild(selectedTags);
        display.appendChild(arrow);
        
        const dropdown = document.createElement('div');
        dropdown.className = 'multi-select-menu';
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
            if (opt.value === '') 
                return;
            
            const option = document.createElement('label');
            option.className = 'multi-select-option';
            option.style.cssText = `
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                cursor: pointer;
                transition: all 0.2s;
                color: var(--text-light);
                border-bottom: ${index < this.options.length - 1 ? '1px solid rgba(102, 126, 234, 0.05)' : 'none'};
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = opt.value;
            checkbox.checked = this.selected.has(opt.value);
            checkbox.style.cssText = `
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: var(--accent-blue);
            `;
            
            const labelText = document.createElement('span');
            labelText.textContent = opt.label;
            labelText.style.cssText = 'flex: 1;';
            
            option.appendChild(checkbox);
            option.appendChild(labelText);
            
            option.addEventListener('mouseenter', () => {
                option.style.background = 'rgba(102, 126, 234, 0.2)';
                option.style.color = 'var(--text-white)';
            });
            
            option.addEventListener('mouseleave', () => {
                option.style.background = 'transparent';
                option.style.color = 'var(--text-light)';
            });
            
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked)
                    this.selected.add(opt.value);
                else
                    this.selected.delete(opt.value);

                this.updateSelectedDisplay(selectedTags);
                this.onChange(Array.from(this.selected));
            });
            
            dropdown.appendChild(option);
        });
        
        if (this.options.length > 1) 
        {
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.textContent = 'Clear All';
            clearBtn.style.cssText = `
                width: 100%;
                padding: 0.75rem;
                background: rgba(254, 95, 85, 0.2);
                border: none;
                color: #FE5F55;
                cursor: pointer;
                font-size: 0.875rem;
                font-weight: 600;
                transition: background 0.2s;
                border-top: 1px solid rgba(102, 126, 234, 0.1);
            `;
            
            clearBtn.addEventListener('mouseenter', () => clearBtn.style.background = 'rgba(254, 95, 85, 0.3)');
            
            clearBtn.addEventListener('mouseleave', () => clearBtn.style.background = 'rgba(254, 95, 85, 0.2)');
            
            clearBtn.addEventListener('click', () => {
                this.selected.clear();
                dropdown.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                this.updateSelectedDisplay(selectedTags);
                this.onChange(Array.from(this.selected));
            });
            
            dropdown.appendChild(clearBtn);
        }
        
        let isOpen = false;
        
        this.open = () => {
            isOpen = true;
            dropdown.style.opacity = '1';
            dropdown.style.transform = 'translateY(0) scale(1)';
            dropdown.style.pointerEvents = 'auto';
            arrow.style.transform = 'rotate(180deg)';
            display.style.borderColor = 'rgba(102, 126, 234, 0.8)';
            display.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)';
        };
        
        this.close = () => {
            isOpen = false;
            dropdown.style.opacity = '0';
            dropdown.style.transform = 'translateY(-10px) scale(0.95)';
            dropdown.style.pointerEvents = 'none';
            arrow.style.transform = 'rotate(0deg)';
            display.style.borderColor = 'rgba(102, 126, 234, 0.3)';
            display.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
        };
        
        display.addEventListener('click', (e) => {
            e.stopPropagation();

            if (isOpen) 
                this.close();
            else 
                this.open();
        });
        
        display.addEventListener('mouseenter', () => {
            if (!isOpen) 
            {
                display.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)';
                display.style.borderColor = 'rgba(102, 126, 234, 0.5)';
            }
        });
        
        display.addEventListener('mouseleave', () => {
            if (!isOpen)
            {
                display.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
                display.style.borderColor = 'rgba(102, 126, 234, 0.3)';
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && isOpen)
                this.close();
        });
        
        container.appendChild(display);
        container.appendChild(dropdown);
        wrapper.appendChild(container);
        
        return wrapper;
    }

    updateSelectedDisplay(container) 
    {
        container.innerHTML = '';
        
        if (this.selected.size === 0) 
        {
            const placeholder = document.createElement('span');
            placeholder.textContent = 'All Tags';
            placeholder.style.color = 'var(--text-secondary)';
            container.appendChild(placeholder);
            return;
        }
        
        this.selected.forEach(value => {
            const option = this.options.find(o => o.value === value);
            if (!option) 
                return;
            
            const chip = document.createElement('span');
            chip.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                padding: 0.25rem 0.5rem;
                background: rgba(102, 126, 234, 0.3);
                border-radius: 4px;
                font-size: 0.75rem;
                color: var(--text-white);
            `;
            chip.textContent = option.label;
            
            container.appendChild(chip);
        });
    }
    
    getSelected() 
    {
        return Array.from(this.selected);
    }
    
    setSelected(values) {
        this.selected = new Set(values);
        const selectedTags = this.container.querySelector('.selected-tags');
        if (selectedTags)
            this.updateSelectedDisplay(selectedTags);

        this.container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = this.selected.has(cb.value));
    }
    
    getElement() 
    {
        return this.container;
    }
}