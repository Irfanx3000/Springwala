/**
 * bulk-upload.js
 * Logic for 3-step CSV + ZIP import: Upload -> Validate -> Import
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!Auth.requireAdminAuth()) return;
    initAdminHeader();

    // CSV Elements
    const csvDropzone = document.getElementById('csv-dropzone');
    const csvInput = document.getElementById('csv-input');
    const csvSelected = document.getElementById('csv-selected');
    const csvFilename = document.getElementById('csv-filename');
    const removeCsvBtn = document.getElementById('remove-csv');

    // ZIP Elements
    const zipDropzone = document.getElementById('zip-dropzone');
    const zipInput = document.getElementById('zip-input');
    const zipSelected = document.getElementById('zip-selected');
    const zipFilename = document.getElementById('zip-filename');
    const removeZipBtn = document.getElementById('remove-zip');

    // Status UI
    const statusMsg = document.getElementById('upload-status-msg');
    const statusTitle = document.getElementById('status-title');
    const statusDesc = document.getElementById('status-desc');
    const statusIconContainer = document.getElementById('status-icon-container');

    const goToPreviewBtn = document.getElementById('go-to-preview');
    const mainImportBtn = document.getElementById('main-import-btn');

    const steps = [
        document.getElementById('step-1-content'),
        document.getElementById('step-2-content'),
        document.getElementById('step-3-content')
    ];

    let selectedCsv = null;
    let selectedZip = null;
    let csvData = [];

    // --- FILE SELECTION HANDLERS ---

    const handleFile = (file, type) => {
        if (!file) return;
        if (type === 'csv') {
            if (!file.name.endsWith('.csv')) return showToast('Please upload a .csv file', 'error');
            selectedCsv = file;
            csvFilename.textContent = file.name;
            csvSelected.classList.remove('hidden');
        } else {
            if (!file.name.endsWith('.zip')) return showToast('Please upload a .zip file', 'error');
            selectedZip = file;
            zipFilename.textContent = file.name;
            zipSelected.classList.remove('hidden');
        }
        updateStatusUI();
    };

    // CSV Events
    csvDropzone.addEventListener('click', () => csvInput.click());
    csvInput.addEventListener('change', (e) => handleFile(e.target.files[0], 'csv'));
    csvDropzone.addEventListener('dragover', (e) => { e.preventDefault(); csvDropzone.classList.add('dragging'); });
    csvDropzone.addEventListener('dragleave', () => csvDropzone.classList.remove('dragging'));
    csvDropzone.addEventListener('drop', (e) => { e.preventDefault(); csvDropzone.classList.remove('dragging'); handleFile(e.dataTransfer.files[0], 'csv'); });
    removeCsvBtn.addEventListener('click', (e) => { e.stopPropagation(); selectedCsv = null; csvSelected.classList.add('hidden'); updateStatusUI(); });

    // ZIP Events
    zipDropzone.addEventListener('click', () => zipInput.click());
    zipInput.addEventListener('change', (e) => handleFile(e.target.files[0], 'zip'));
    zipDropzone.addEventListener('dragover', (e) => { e.preventDefault(); zipDropzone.classList.add('dragging'); });
    zipDropzone.addEventListener('dragleave', () => zipDropzone.classList.remove('dragging'));
    zipDropzone.addEventListener('drop', (e) => { e.preventDefault(); zipDropzone.classList.remove('dragging'); handleFile(e.dataTransfer.files[0], 'zip'); });
    removeZipBtn.addEventListener('click', (e) => { e.stopPropagation(); selectedZip = null; zipSelected.classList.add('hidden'); updateStatusUI(); });

    function updateStatusUI() {
        statusMsg.classList.remove('opacity-0');
        
        if (selectedCsv && selectedZip) {
            statusTitle.textContent = "CSV + ZIP Selected";
            statusDesc.textContent = "Images will be mapped automatically using file names.";
            statusIconContainer.innerHTML = `<div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path></svg></div>`;
            enableContinue(true);
        } else if (selectedCsv) {
            statusTitle.textContent = "CSV Selected";
            statusDesc.textContent = "You can continue with CSV only. Images will not be included.";
            statusIconContainer.innerHTML = `<div class="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></div>`;
            enableContinue(true);
        } else if (selectedZip) {
            statusTitle.textContent = "Missing CSV File";
            statusDesc.textContent = "CSV file is required to proceed. Please upload it to continue.";
            statusIconContainer.innerHTML = `<div class="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg></div>`;
            enableContinue(false);
        } else {
            statusMsg.classList.add('opacity-0');
            enableContinue(false);
        }
    }

    function enableContinue(enable) {
        if (enable) {
            goToPreviewBtn.classList.remove('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
            goToPreviewBtn.classList.add('bg-[#BE2229]', 'text-white', 'hover:bg-red-800', 'shadow-md');
            goToPreviewBtn.disabled = false;
        } else {
            goToPreviewBtn.classList.add('bg-slate-100', 'text-slate-400', 'cursor-not-allowed');
            goToPreviewBtn.classList.remove('bg-[#BE2229]', 'text-white', 'hover:bg-red-800', 'shadow-md');
            goToPreviewBtn.disabled = true;
        }
    }

    // --- STEP TRANSITIONS ---

    goToPreviewBtn.addEventListener('click', async () => {
        if (!selectedCsv) return;
        setStep(2);
        const text = await selectedCsv.text();
        csvData = parseCSV(text);
        renderPreview(csvData);
        mainImportBtn.classList.remove('hidden');
    });

    mainImportBtn.addEventListener('click', async () => {
        setStep(3);
        mainImportBtn.classList.add('hidden');
        await performImport();
    });

    // --- CORE LOGIC ---

    // --- CORE LOGIC ---
    async function performImport() {
        const statusText = document.getElementById('import-status-text');
        const processedText = document.getElementById('import-processed-text');
        const progressBar = document.getElementById('progress-bar');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressCircle = document.getElementById('progress-circle');
        const progressFraction = document.getElementById('progress-fraction');

        const updateProgress = (percent, status, desc, processed, total) => {
            progressBar.style.width = `${percent}%`;
            progressPercentage.textContent = `${Math.round(percent)}%`;
            statusText.textContent = status;
            processedText.textContent = desc;
            if (total > 0) progressFraction.textContent = `${processed} / ${total}`;
            const offset = 283 - (283 * percent) / 100;
            progressCircle.style.strokeDashoffset = offset;
        };

        try {
            // Phase 1: Uploading
            updateProgress(10, 'Uploading files...', 'Sending data to server...', 0, csvData.length);
            
            const formData = new FormData();
            formData.append('file', selectedCsv);
            if (selectedZip) formData.append('images', selectedZip);

            // Phase 2: Processing (Artificial delay for better UX if it's too fast)
            await new Promise(r => setTimeout(r, 800));
            updateProgress(45, 'Processing data...', 'Mapping products and images...', Math.floor(csvData.length * 0.4), csvData.length);
            
            const res = await api.post('/products/bulk-upload', formData);

            // Phase 3: Finalizing
            updateProgress(90, 'Finalizing...', 'Updating database records...', csvData.length, csvData.length);
            await new Promise(r => setTimeout(r, 600));

            if (res.success) {
                updateProgress(100, 'Import Complete!', 'Ready to view results', csvData.length, csvData.length);
                showResultModal(res);
            } else {
                throw new Error(res.message || 'Import failed');
            }
        } catch (err) {
            console.error('Import Error:', err);
            showResultModal({
                success: false,
                total: csvData.length,
                successCount: 0,
                failed: csvData.length,
                errors: err.errors || [{ row: 'System', message: err.message || 'Unknown network error' }]
            });
        }
    }

    function showResultModal(data) {
        const modal = document.getElementById('result-modal');
        const container = document.getElementById('modal-container');
        const iconContainer = document.getElementById('modal-icon');
        const title = document.getElementById('modal-title');
        const subtitle = document.getElementById('modal-subtitle');
        const errorBox = document.getElementById('modal-error-box');
        const errorList = document.getElementById('error-preview-list');

        // Populate Stats
        document.getElementById('sum-total').textContent = data.total || 0;
        document.getElementById('sum-added').textContent = data.addedCount || 0;
        document.getElementById('sum-updated').textContent = data.updatedCount || 0;
        document.getElementById('sum-failed').textContent = data.failed || 0;

        const hasErrors = data.errors && data.errors.length > 0;
        
        if (data.success && !hasErrors) {
            iconContainer.className = "w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6";
            iconContainer.innerHTML = `<svg class="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`;
            title.textContent = "Import Completed Successfully";
            subtitle.textContent = `Successfully processed ${data.total} products without any errors.`;
            errorBox.classList.add('hidden');
        } else if (data.success && hasErrors) {
            iconContainer.className = "w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-6";
            iconContainer.innerHTML = `<svg class="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
            title.textContent = "Partial Import Completed";
            subtitle.textContent = "Some records failed during import. See details below.";
            errorBox.classList.remove('hidden');
            renderErrors(data.errors);
        } else {
            iconContainer.className = "w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6";
            iconContainer.innerHTML = `<svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
            title.textContent = "Import Failed";
            subtitle.textContent = "Critical errors prevented the import from completing.";
            errorBox.classList.remove('hidden');
            renderErrors(data.errors);
        }

        // Show Modal with Animation
        modal.classList.remove('hidden');
        setTimeout(() => {
            container.classList.remove('scale-95', 'opacity-0');
            container.classList.add('scale-100', 'opacity-100');
        }, 10);

        // Bind Download Error Button
        const downloadBtn = document.getElementById('download-error-btn');
        if (downloadBtn) {
            downloadBtn.onclick = () => downloadErrorReport(data.errors);
        }
    }

    function renderErrors(errors) {
        const list = document.getElementById('error-preview-list');
        list.innerHTML = errors.map(err => `
            <div class="mb-2 last:mb-0">
                <span class="text-red-900 font-bold">[Row ${err.row}]</span> ${err.message}
            </div>
        `).join('');
    }

    function downloadErrorReport(errors) {
        if (!errors || !errors.length) return;
        const headers = ['Row', 'Error Message'];
        const rows = errors.map(e => [e.row, `"${e.message.replace(/"/g, '""')}"`]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `import_errors_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- RENDERERS & PARSERS ---

    function renderPreview(data) {
        const headerRow = document.getElementById('preview-header');
        const bodyRow = document.getElementById('preview-body');
        const rowCountEl = document.getElementById('preview-row-count');
        const validationBadge = document.getElementById('validation-badge');

        if (!data.length) return;
        rowCountEl.textContent = data.length;
        const headers = Object.keys(data[0]);
        const required = ['sku', 'name', 'unitPrice', 'batch1_qty', 'batch1_price'];
        let hasErrors = false;

        headerRow.innerHTML = headers.map(h => `<th class="px-6 py-4">${h}${required.includes(h) ? '<span class="text-red-500 ml-1">*</span>' : ''}</th>`).join('');
        bodyRow.innerHTML = data.slice(0, 10).map(row => {
            return `<tr>${headers.map(h => {
                const val = row[h];
                const isMissing = required.includes(h) && (!val || val.trim() === '');
                if (isMissing) hasErrors = true;
                return `<td class="px-6 py-4 font-medium"><span class="${isMissing ? 'text-red-500 font-bold' : 'text-slate-600'}">${val || 'MISSING'}</span></td>`;
            }).join('')}</tr>`;
        }).join('');

        if (hasErrors) {
            validationBadge.className = "flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-100 text-xs font-bold";
            validationBadge.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg> Invalid Data Found`;
            mainImportBtn.disabled = true;
            mainImportBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            validationBadge.className = "flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-100 text-xs font-bold";
            validationBadge.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg> Ready to Import`;
            mainImportBtn.disabled = false;
            mainImportBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    function setStep(num) {
        steps.forEach((s, i) => s.classList.toggle('hidden', i !== num - 1));
        for (let i = 1; i <= 3; i++) {
            const circle = document.getElementById(`step-${i}-circle`);
            const line = document.getElementById(`step-${i}-line`);
            if (i < num) {
                circle.className = "step-circle completed";
                circle.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>`;
                if (line) line.classList.add('active');
            } else if (i === num) {
                circle.className = "step-circle active";
                circle.textContent = i;
                if (line) line.classList.remove('active');
            } else {
                circle.className = "step-circle";
                circle.textContent = i;
                if (line) line.classList.remove('active');
            }
        }
    }

    function parseCSV(text) {
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (!lines.length) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj = {};
            headers.forEach((h, i) => obj[h] = values[i] || '');
            return obj;
        });
    }
});

function initAdminHeader() {
    const adminName = document.querySelector('.admin-name');
    const user = Auth.getAdmin();
    if (adminName && user) adminName.textContent = user.name || 'Admin';
}
