import { fetchJson, postJson } from './utils.js';
import { toast } from './toast.js';
import { confetti } from './confetti.js';
import { ModpackParser } from './modpackParser.js';
import { DependencyResolver } from './dependencyResolver.js';
import icons from './icons.js';

class ModpackBuilder
{
    constructor()
    {
        this.allMods = {};
        this.selectedMods = new Set();
        this.resolvedDeps = [];
        this.conflicts = [];
        this.importedModpack = null;
    }

    async init()
    {
        await this.loadMods();
        this.renderModList();
        this.setupEventListeners();
    }

    async loadMods()
    {
        try
        {
            this.allMods = await fetchJson('/data');
            this.allMods = Object.fromEntries(Object.entries(this.allMods).filter(([_, mod]) => mod.type === 'Mod'));
        }
        catch (err)
        {
            console.error('Failed to load mods:', err);
            toast.error('We ran into an issue loading the mods.');
        }
    }

    createVersionSelector(modKey, mod)
    {
        const container = document.createElement('div');
        container.className = 'version-selector-container';
        container.style.cssText = `
            position: relative;
            min-width: 120px;
            margin-left: auto;
        `;
        
        const selected = document.createElement('button');
        selected.type = 'button';
        selected.className = 'version-selector-button';
        selected.dataset.modKey = modKey;
        selected.style.cssText = `
            width: 100%;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
            border: 1px solid rgba(102, 126, 234, 0.3);
            color: var(--text-white);
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem;
        `;
        
        const selectedText = document.createElement('span');
        selectedText.textContent = 'Latest';
        selectedText.className = 'version-selector-text';
        
        const arrow = document.createElement('span');
        arrow.textContent = '▼';
        arrow.className = 'version-selector-arrow';
        arrow.style.cssText = `
            font-size: 0.625rem;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        selected.appendChild(selectedText);
        selected.appendChild(arrow);
        
        const dropdown = document.createElement('div');
        dropdown.className = 'version-dropdown';
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
        
        const latestOption = document.createElement('div');
        latestOption.className = 'version-option selected';
        latestOption.dataset.value = 'latest';
        latestOption.textContent = 'Latest';
        latestOption.style.cssText = `
            padding: 0.75rem 1rem;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--text-white);
            border-bottom: 1px solid rgba(102, 126, 234, 0.1);
            background: rgba(102, 126, 234, 0.2);
        `;
        dropdown.appendChild(latestOption);
        
        this.fetchModVersions(modKey).then(versions => {
            if (versions && versions.length > 0) 
            {
                versions.forEach(release => {
                    const option = document.createElement('div');
                    option.className = 'version-option';
                    option.dataset.value = release.tag || release.tag_name || 'unknown';
                    option.style.cssText = `
                        padding: 0.75rem 1rem;
                        cursor: pointer;
                        transition: all 0.2s;
                        color: var(--text-light);
                        border-bottom: 1px solid rgba(102, 126, 234, 0.05);
                    `;
                    
                    const versionText = document.createElement('span');
                    versionText.textContent = release.tag || release.tag_name || 'Unknown';
                    
                    if (release.prerelease) 
                    {
                        versionText.textContent += ' ';
                        const badge = document.createElement('span');
                        badge.textContent = 'pre';
                        badge.style.cssText = `
                            font-size: 0.65rem;
                            background: rgba(255, 152, 0, 0.3);
                            padding: 0.125rem 0.375rem;
                            border-radius: 3px;
                            color: rgba(255, 152, 0, 1);
                            margin-left: 0.25rem;
                        `;
                        option.appendChild(versionText);
                        option.appendChild(badge);
                    } 
                    else option.textContent = versionText.textContent;
                    
                    option.addEventListener('mouseenter', () => {
                        option.style.background = 'rgba(102, 126, 234, 0.3)';
                        option.style.color = 'var(--text-white)';
                        option.style.transform = 'translateX(4px)';
                    });
                    
                    option.addEventListener('mouseleave', () => {
                        if (!option.classList.contains('selected')) {
                            option.style.background = 'transparent';
                            option.style.color = 'var(--text-light)';
                            option.style.transform = 'translateX(0)';
                        }
                    });
                    
                    option.addEventListener('click', (e) => {
                        e.stopPropagation();
                        
                        dropdown.querySelectorAll('.version-option').forEach(opt => {
                            opt.classList.remove('selected');
                            opt.style.background = 'transparent';
                        });
                        option.classList.add('selected');
                        option.style.background = 'rgba(102, 126, 234, 0.2)';
                        
                        selectedText.textContent = option.dataset.value;
                        
                        closeDropdown();
                    });
                    
                    dropdown.appendChild(option);
                });
            }
        });
        
        latestOption.addEventListener('click', (e) => {
            e.stopPropagation();
            
            dropdown.querySelectorAll('.version-option').forEach(opt => {
                opt.classList.remove('selected');
                opt.style.background = 'transparent';
            });
            latestOption.classList.add('selected');
            latestOption.style.background = 'rgba(102, 126, 234, 0.2)';
            
            selectedText.textContent = 'Latest';
            closeDropdown();
        });
        
        latestOption.addEventListener('mouseenter', () => {
            if (!latestOption.classList.contains('selected'))
                latestOption.style.background = 'rgba(102, 126, 234, 0.3)';
        });
        
        latestOption.addEventListener('mouseleave', () => {
            if (!latestOption.classList.contains('selected'))
                latestOption.style.background = 'transparent';
        });
        
        let isOpen = false;
        
        function openDropdown() 
        {
            isOpen = true;
            dropdown.style.opacity = '1';
            dropdown.style.transform = 'translateY(0) scale(1)';
            dropdown.style.pointerEvents = 'auto';
            arrow.style.transform = 'rotate(180deg)';
            selected.style.borderColor = 'rgba(102, 126, 234, 0.8)';
            selected.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)';
        }
        
        function closeDropdown() 
        {
            isOpen = false;
            dropdown.style.opacity = '0';
            dropdown.style.transform = 'translateY(-10px) scale(0.95)';
            dropdown.style.pointerEvents = 'none';
            arrow.style.transform = 'rotate(0deg)';
            selected.style.borderColor = 'rgba(102, 126, 234, 0.3)';
            selected.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
        }
        
        selected.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isOpen)
                closeDropdown();
            else
                openDropdown();
        });
        
        selected.addEventListener('mouseenter', () => {
            if (!isOpen) 
            {
                selected.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)';
                selected.style.borderColor = 'rgba(102, 126, 234, 0.5)';
                selected.style.transform = 'scale(1.02)';
            }
        });
        
        selected.addEventListener('mouseleave', () => {
            if (!isOpen) 
            {
                selected.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)';
                selected.style.borderColor = 'rgba(102, 126, 234, 0.3)';
                selected.style.transform = 'scale(1)';
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && isOpen)
                closeDropdown();
        });
        
        dropdown.style.setProperty('scrollbar-width', 'thin');
        const style = document.createElement('style');
        style.textContent = `
            .version-dropdown::-webkit-scrollbar {
                width: 8px;
            }
            .version-dropdown::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 4px;
            }
            .version-dropdown::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.6), rgba(118, 75, 162, 0.6));
                border-radius: 4px;
            }
            .version-dropdown::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.8), rgba(118, 75, 162, 0.8));
            }
        `;
        document.head.appendChild(style);
        
        container.appendChild(selected);
        container.appendChild(dropdown);
        
        return container;
    }

    getSelectedVersion(modKey)
    {
        const button = document.querySelector(`.version-selector-button[data-mod-key="${modKey}"]`);
        if (!button) 
            return 'latest';
        
        const selectedText = button.querySelector('.version-selector-text');
        return selectedText ? selectedText.textContent : 'latest';
    }

    async fetchModVersions(modKey)
    {
        try
        {
            const response = await fetch(`/api/version-history/${encodeURIComponent(modKey)}`);
            
            if (!response.ok)
                return [];
            
            const data = await response.json();
            return data.releases || data.versionHistory || [];
        }
        catch (err)
        {
            console.error('[Modpack] Failed to fetch versions:', err);
            return [];
        }
    }

    renderModList(filter = '')
    {
        const container = document.getElementById('mod-list');
        if (!container)
            return;

        container.innerHTML = '';

        const mods = Object.entries(this.allMods).filter(([key, mod]) => {
            if (!filter)
                return true;

            const searchLower = filter.toLowerCase();
            return mod.name?.toLowerCase().includes(searchLower) || mod.description?.toLowerCase().includes(searchLower);
        });

        if (mods.length === 0)
        {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No mods found</p>';
            return;
        }

        mods.forEach(([key, mod]) => {
            const item = document.createElement('label');
            item.className = 'checkbox-container mod-item';
            item.style.cssText = `
                display: flex;
                align-items: center;
                padding: 0.75rem 1rem;
                background: rgba(30, 18, 82, 0.4);
                border: 1px solid rgba(102, 126, 234, 0.2);
                border-radius: 8px;
                margin-bottom: 0.5rem;
                cursor: pointer;
                transition: all 0.2s;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'mod-checkbox';
            checkbox.dataset.modKey = key;
            checkbox.checked = this.selectedMods.has(key);
            
            const customCheckbox = document.createElement('span');
            customCheckbox.className = 'custom-checkbox';
            
            const info = document.createElement('div');
            info.style.cssText = 'flex: 1; margin-left: 0.75rem;';
            info.innerHTML = `
                <div style="color: var(--text-white); font-weight: 500;">${mod.name}</div>
                <div style="color: var(--text-secondary); font-size: 0.875rem;">${mod.description || 'No description'}</div>
            `;
            
            const versionSelect = this.createVersionSelector(key, mod);
            versionSelect.style.marginLeft = 'auto';
            
            item.appendChild(checkbox);
            item.appendChild(customCheckbox);
            item.appendChild(info);
            item.appendChild(versionSelect);
            
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked)
                    this.selectedMods.add(key);
                else
                    this.selectedMods.delete(key);
                this.updatePreview();
            });

            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(30, 18, 82, 0.6)';
                item.style.borderColor = 'rgba(102, 126, 234, 0.4)';
            });

            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(30, 18, 82, 0.4)';
                item.style.borderColor = 'rgba(102, 126, 234, 0.2)';
            });

            container.appendChild(item);
        });
    }

    resolveDependencies()
    {
        const selectedArray = Array.from(this.selectedMods).map(key => ({ key, version: this.getSelectedVersion(key) }));

        const resolver = new DependencyResolver(this.allMods);
        const result = resolver.resolve(selectedArray);

        const foundDeps = result.resolved.filter(dep => !this.selectedMods.has(dep.key));
        
        foundDeps.forEach(dep => {
            this.selectedMods.add(dep.key);
            
            const checkbox = document.querySelector(`input.mod-checkbox[data-mod-key="${dep.key}"]`);
            if (checkbox && !checkbox.checked)
            {
                checkbox.checked = true;
                console.log(`[Modpack] Auto-added: ${this.allMods[dep.key]?.name}`);
            }
        });

        this.resolvedDeps = result.resolved;
        this.conflicts = result.conflicts;

        this.renderDependencyResult();
        
        if (foundDeps.length > 0)
            document.getElementById('dependency-result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    renderDependencyResult()
    {
        const resultContainer = document.getElementById('dependency-result');
        const resolvedContainer = document.getElementById('resolved-deps');
        const conflictsContainer = document.getElementById('conflicts-list');

        if (!resultContainer) 
            return;

        resultContainer.style.display = 'block';

        const additionalDeps = this.resolvedDeps.filter(dep => !this.selectedMods.has(dep.key));
        
        if (additionalDeps.length > 0) 
        {
            resolvedContainer.innerHTML = `
                <div style="background: rgba(75, 194, 146, 0.1); border-left: 3px solid #4BC292; padding: 1rem; border-radius: 8px;">
                    <strong>✅ Additional dependencies found (${additionalDeps.length}):</strong>
                    <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
                        ${additionalDeps.map(dep => `
                            <li>${this.allMods[dep.key]?.name || dep.key} (${dep.version})</li>
                        `).join('')}
                    </ul>
                    <small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">These will be automatically included in your modpack.</small>
                </div>
            `;
        } 
        else 
        {
            resolvedContainer.innerHTML = `
                <div style="background: rgba(102, 126, 234, 0.1); border-left: 3px solid var(--accent-blue); padding: 1rem; border-radius: 8px;">
                    <strong>✅ No additional dependencies needed</strong>
                </div>
            `;
        }

        if (this.conflicts.length > 0) 
        {
            const missingConflicts = this.conflicts.filter(c => c.type === 'missing');
            const versionConflicts = this.conflicts.filter(c => c.type === 'version_conflict');

            let conflictHtml = '<div style="background: rgba(254, 95, 85, 0.1); border-left: 3px solid #FE5F55; padding: 1rem; border-radius: 8px;">';
            conflictHtml += `<strong>⚠️ Conflicts detected:</strong>`;

            if (missingConflicts.length > 0) 
            {
                const grouped = {};
                missingConflicts.forEach(conflict => {
                    const depName = conflict.dependency;
                    if (!grouped[depName])
                        grouped[depName] = [];

                    grouped[depName].push({
                        version: conflict.requiredVersion,
                        requiredBy: conflict.modName
                    });
                });

                conflictHtml += '<div style="margin-top: 1rem;"><strong>Missing Dependencies (not found on Photon):</strong><ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">';
                
                Object.entries(grouped).forEach(([depName, requirements]) => {
                    conflictHtml += `
                        <li style="margin-bottom: 1rem;">
                            <strong>${depName}</strong>
                            <div style="margin-left: 1rem; margin-top: 0.25rem;">
                    `;
                    
                    requirements.forEach(req => {
                        conflictHtml += `
                            <div style="color: var(--text-secondary); font-size: 0.875rem;">
                                • Version <code style="background: rgba(0,0,0,0.3); padding: 0.125rem 0.375rem; border-radius: 3px;">${req.version}</code> required by <strong>${req.requiredBy}</strong>
                            </div>
                        `;
                    });
                    
                    conflictHtml += `
                            </div>
                        </li>
                    `;
                });
                
                conflictHtml += '</ul>';
                conflictHtml += '<small style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">💡 These mods are not available in Photon\'s database. You may need to add them manually.</small>';
                conflictHtml += '</div>';
            }

            if (versionConflicts.length > 0) 
            {
                const grouped = {};
                versionConflicts.forEach(conflict => {
                    const depName = conflict.dependencyName || conflict.dependency;
                    if (!grouped[depName])
                        grouped[depName] = { existing: conflict.existing, requirements: [] };

                    grouped[depName].requirements.push({
                        version: conflict.required,
                        requiredBy: conflict.modName
                    });
                });

                conflictHtml += '<div style="margin-top: 1rem;"><strong>Version Conflicts:</strong><ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">';
                
                Object.entries(grouped).forEach(([depName, data]) => {
                    conflictHtml += `
                        <li style="margin-bottom: 1rem;">
                            <strong>${depName}</strong>
                            <div style="margin-left: 1rem; margin-top: 0.25rem;">
                                <div style="color: var(--text-secondary); font-size: 0.875rem;">
                                    Current: <code style="background: rgba(0,0,0,0.3); padding: 0.125rem 0.375rem; border-radius: 3px;">${data.existing}</code>
                                </div>
                    `;
                    
                    data.requirements.forEach(req => {
                        conflictHtml += `
                            <div style="color: var(--text-secondary); font-size: 0.875rem;">
                                • Needs <code style="background: rgba(0,0,0,0.3); padding: 0.125rem 0.375rem; border-radius: 3px;">${req.version}</code> for <strong>${req.requiredBy}</strong>
                            </div>
                        `;
                    });
                    
                    conflictHtml += `
                            </div>
                        </li>
                    `;
                });
                
                conflictHtml += '</ul></div>';
            }

            conflictHtml += '</div>';
            conflictsContainer.innerHTML = conflictHtml;
        } 
        else conflictsContainer.innerHTML = '';

        this.updatePreview();
        toast.success('Dependencies resolved!');
    }

    updatePreview() 
    {
        const previewSection = document.getElementById('preview-section');
        const previewText = document.getElementById('preview-text');

        if (!previewSection || !previewText) 
            return;

        if (this.selectedMods.size === 0) 
            {
            previewSection.style.display = 'none';
            return;
        }

        previewSection.style.display = 'block';

        const allModKeys = new Set([...Array.from(this.selectedMods), ...this.resolvedDeps.map(d => d.key)]);

        const modsArray = Array.from(allModKeys).map(key => ({ key, version: this.getSelectedVersion(key) }));

        const metadata = {
            name: document.getElementById('pack-name')?.value || 'Untitled Modpack',
            author: document.getElementById('pack-author')?.value || 'Unknown',
            description: document.getElementById('pack-description')?.value || 'No description',
            tags: Array.from(document.querySelectorAll('input[name="pack-tags"]:checked')).map(cb => cb.value)
        };

        const fileContent = ModpackParser.createModpackFile(metadata, modsArray);
        previewText.textContent = fileContent;
    }

    downloadModpack() 
    {
        const name = document.getElementById('pack-name')?.value;
        if (!name) 
        {
            toast.error('Please enter a modpack name!');
            return;
        }

        if (this.selectedMods.size === 0) 
        {
            toast.error('Please select at least one mod!');
            return;
        }

        const allModKeys = new Set([...Array.from(this.selectedMods), ...this.resolvedDeps.map(d => d.key)]);

        const modsArray = Array.from(allModKeys).map(key => ({ key, version: this.getSelectedVersion(key) }));

        const metadata = {
            name: document.getElementById('pack-name')?.value || 'Untitled Modpack',
            author: document.getElementById('pack-author')?.value || 'Unknown',
            description: document.getElementById('pack-description')?.value || '',
            tags: Array.from(document.querySelectorAll('input[name="pack-tags"]:checked')).map(cb => cb.value)
        };

        const fileContent = ModpackParser.createModpackFile(metadata, modsArray);

        const blob = new Blob([fileContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.modpack`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('Modpack downloaded!');
        confetti.celebrate(2000, 100);
    }

    async uploadModpack() 
    {
        const name = document.getElementById('pack-name')?.value;
        const author = document.getElementById('pack-author')?.value;
        const description = document.getElementById('pack-description')?.value;

        if (!name) 
        {
            toast.error('Please enter a modpack name!');
            return;
        }

        if (this.selectedMods.size === 0) 
        {
            toast.error('Please select at least one mod!');
            return;
        }

        const allModKeys = new Set([...Array.from(this.selectedMods), ...this.resolvedDeps.map(d => d.key)]);

        const modsArray = Array.from(allModKeys).map(key => ({ key, version: this.getSelectedVersion(key) }));

        const tags = Array.from(document.querySelectorAll('input[name="pack-tags"]:checked')).map(cb => cb.value);

        try 
        {
            const result = await postJson('/modpack/upload', { name, author, description, tags, mods: modsArray });

            confetti.celebrate(3000, 200);
            toast.success('Modpack uploaded successfully!');

            setTimeout(() => window.location.href = `/mod.html?key=${encodeURIComponent(result.key)}`, 2000);
        } 
        catch (err) 
        {
            console.error('Upload error:', err);
            toast.error(err.message || 'Failed to upload modpack');
        }
    }

    async importModpack(file)
    {
        if (!file)
            return;

        const resultContainer = document.getElementById('import-result');
        if (!resultContainer)
            return;

        try
        {
            const text = await file.text();
            const validation = ModpackParser.validate(text);

            if (!validation.valid)
            {
                toast.error(`Invalid modpack: ${validation.error}`);

                resultContainer.innerHTML = `
                    <div style="background: rgba(254, 95, 85, 0.1); border-left: 3px solid #FE5F55; padding: 1rem; border-radius: 8px;">
                        <strong>Invalid Modpack</strong>
                        <p>${validation.error}</p>
                    </div>
                `;
                resultContainer.style.display = 'block';

                return;
            }

            const { metadata, mods } = validation;
            this.importedModpack = { metadata, mods };

            document.getElementById('pack-name').value = metadata.name;
            document.getElementById('pack-author').value = metadata.author;
            document.getElementById('pack-description').value = metadata.description;

            document.querySelectorAll('input[name="pack-tags"]').forEach(cb => cb.checked = metadata.tags.includes(cb.value));

            this.selectedMods.clear();
            mods.forEach(mod => {
                if (this.allMods[mod.key])
                    this.selectedMods.add(mod.key);
            });

            const preview = ModpackParser.getPreview(text, this.allMods);
            const modsNotFound = mods.filter(mod => !this.allMods[mod.key]);

            resultContainer.innerHTML = `
                <div style="background: rgba(75, 194, 146, 0.1); border-left: 3px solid #4BC292; padding: 1rem; border-radius: 8px;">
                    <strong>Modpack Loaded Successfully</strong>
                    <p>Found ${mods.length} mods${modsNotFound.length > 0 ? `, ${modsNotFound.length} not available on Photon` : ''}</p>
                    ${modsNotFound.length > 0 ? `
                        <details style="margin-top: 0.5rem;">
                            <summary style="cursor: pointer; color: var(--text-secondary);">Show unavailable mods</summary>
                            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                                ${modsNotFound.map(mod => `<li>${mod.key} (${mod.version})</li>`).join('')}
                            </ul>
                        </details>
                    ` : ''}
                    <button class="click-me" style="margin-top: 1rem; padding: 0.5rem 1rem; height: auto; font-size: 0.875rem;" onclick="document.getElementById('mod-list').scrollIntoView({behavior: 'smooth'})">
                        View Selected Mods
                    </button>
                </div>
            `;
            resultContainer.style.display = 'block';

            this.renderModList();
            this.updatePreview();

            toast.success('Modpack imported! Review and adjust the details as needed.');
        }
        catch (err)
        {
            console.error('Import error:', err);
            toast.error('A problem occurred when we were importing your modpack.');

            resultContainer.innerHTML = `
                <div style="background: rgba(254, 95, 85, 0.1); border-left: 3px solid #FE5F55; padding: 1rem; border-radius: 8px;">
                    <strong>❌ Import Failed</strong>
                    <p>${err.message}</p>
                </div>
            `;
            resultContainer.style.display = 'block';
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('mod-search');
        if (searchInput) 
        {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.renderModList(e.target.value), 300);
            });
        }

        const resolveBtn = document.getElementById('resolve-btn');
        if (resolveBtn)
            resolveBtn.addEventListener('click', () => this.resolveDependencies());

        const downloadBtn = document.getElementById('download-btn');
        if (downloadBtn)
            downloadBtn.addEventListener('click', () => this.downloadModpack());

        const uploadBtn = document.getElementById('upload-btn');
        if (uploadBtn)
            uploadBtn.addEventListener('click', () => this.uploadModpack());

        const fileInput = document.getElementById('modpack-file');
        if (fileInput) 
        {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) 
                {
                    const filenameDisplay = document.getElementById('file-upload-filename');
                    if (filenameDisplay) 
                    {
                        filenameDisplay.textContent = file.name;
                        filenameDisplay.style.display = 'flex';
                    }
                }
                this.importModpack(e.target.files[0]);
            });

            const label = document.querySelector('.file-upload-label');
            if (label) 
            {
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    label.addEventListener(eventName, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    });
                });

                ['dragenter', 'dragover'].forEach(eventName => {
                    label.addEventListener(eventName, () => {
                        label.classList.add('dragging');
                    });
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    label.addEventListener(eventName, () => {
                        label.classList.remove('dragging');
                    });
                });

                label.addEventListener('drop', (e) => {
                    const files = e.dataTransfer.files;
                    if (files.length > 0) 
                    {
                        fileInput.files = files;
                        
                        const filenameDisplay = document.getElementById('file-upload-filename');
                        if (filenameDisplay) 
                        {
                            filenameDisplay.textContent = files[0].name;
                            filenameDisplay.style.display = 'flex';
                        }
                        
                        this.importModpack(files[0]);
                    }
                });
            }
        }

        ['pack-name', 'pack-author', 'pack-description'].forEach(id => {
            const el = document.getElementById(id);
            if (el)
                el.addEventListener('input', () => this.updatePreview());
        });

        document.querySelectorAll('input[name="pack-tags"]').forEach(cb => cb.addEventListener('change', () => this.updatePreview()));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const builder = new ModpackBuilder();
    builder.init();
});