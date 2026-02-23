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
        const select = document.createElement('select');
        select.className = 'version-select';
        select.dataset.modKey = modKey;
        select.style.cssText = `
            background: rgba(102, 126, 234, 0.2);
            border: 1px solid rgba(102, 126, 234, 0.3);
            color: var(--text-white);
            padding: 0.375rem 0.75rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
            min-width: 120px;
        `;
        
        const latestOption = document.createElement('option');
        latestOption.value = 'latest';
        latestOption.textContent = 'Latest';
        latestOption.selected = true;
        select.appendChild(latestOption);
        
        this.fetchModVersions(modKey).then(versions => {
            if (versions && versions.length > 0)
            {
                versions.forEach(release => {
                    const option = document.createElement('option');
                    option.value = release.tag_name;
                    option.textContent = `${release.tag_name}${release.prerelease ? ' (pre)' : ''}`;
                    select.appendChild(option);
                });
            }
        });
        
        select.addEventListener('click', (e) => e.stopPropagation());
        
        return select;
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

    getSelectedVersion(modKey)
    {
        const select = document.querySelector(`.version-select[data-mod-key="${modKey}"]`);
        return select ? select.value : 'latest';
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
            conflictHtml += `<strong>Conflicts detected (${this.conflicts.length}):</strong>`;

            if (missingConflicts.length > 0) {
                conflictHtml += '<div style="margin-top: 1rem;"><strong>Missing Dependencies:</strong><ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">';
                missingConflicts.forEach(conflict => {
                    conflictHtml += `
                        <li>
                            <strong>${conflict.dependency}</strong> 
                            <span style="color: var(--text-secondary);">(${conflict.requiredVersion})</span><br>
                            <small style="color: var(--text-secondary);">Required by: ${conflict.modName}</small>
                        </li>
                    `;
                });
                conflictHtml += '</ul></div>';
            }

            if (versionConflicts.length > 0) {
                conflictHtml += '<div style="margin-top: 1rem;"><strong>Version Conflicts:</strong><ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">';
                versionConflicts.forEach(conflict => {
                    conflictHtml += `
                        <li>
                            <strong>${conflict.dependencyName || conflict.dependency}</strong><br>
                            <span style="color: var(--text-secondary);">
                                Has version: <code style="background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 4px;">${conflict.existing}</code><br>
                                Needs version: <code style="background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 4px;">${conflict.required}</code><br>
                                Required by: ${conflict.modName}
                            </span>
                        </li>
                    `;
                });
                conflictHtml += '</ul></div>';
            }

            conflictHtml += '<details style="margin-top: 1rem;"><summary style="cursor: pointer; color: var(--text-white);">💡 How to resolve</summary>';
            conflictHtml += '<ul style="margin: 0.5rem 0; padding-left: 1.5rem; color: var(--text-secondary);">';
            conflictHtml += '<li>For missing dependencies: Find and add the required mod to Photon</li>';
            conflictHtml += '<li>For version conflicts: Try removing mods with conflicting requirements, or manually select a compatible version</li>';
            conflictHtml += '<li>You can still download the modpack - users will see which mods are incompatible</li>';
            conflictHtml += '</ul></details>';

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

        // Get all mods (selected + resolved deps)
        const allModKeys = new Set([...Array.from(this.selectedMods), ...this.resolvedDeps.map(d => d.key)]);

        const modsArray = Array.from(allModKeys).map(key => ({ key, version: this.allMods[key]?.version || 'latest' }));

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
            fileInput.addEventListener('change', (e) => this.importModpack(e.target.files[0]));

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