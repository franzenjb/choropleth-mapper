// FILE UPLOAD FIX - Simplified click to browse fix

console.log('🔧 Upload Fix: Loading...');

// Prevent multiple file choosers by debouncing
let fileChooserOpen = false;

document.addEventListener('DOMContentLoaded', function() {
    // Wait for all scripts to load
    setTimeout(() => {
        console.log('🔧 Upload Fix: Applying...');
        
        const uploadArea = document.getElementById('uploadArea');
        const csvInput = document.getElementById('csvInput');
        
        if (!uploadArea || !csvInput) {
            console.error('❌ Upload elements missing!');
            return;
        }
        
        // Clear all existing event listeners
        const cleanUploadArea = uploadArea.cloneNode(true);
        uploadArea.parentNode.replaceChild(cleanUploadArea, uploadArea);
        
        // Add single debounced click handler
        cleanUploadArea.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (fileChooserOpen) {
                console.log('🔧 File chooser already open, ignoring click');
                return;
            }
            
            fileChooserOpen = true;
            console.log('🔧 Opening file browser...');
            
            csvInput.click();
            
            // Reset flag after a moment
            setTimeout(() => {
                fileChooserOpen = false;
            }, 1000);
        });
        
        // File selection handler
        csvInput.addEventListener('change', function(e) {
            fileChooserOpen = false;
            
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                console.log('🔧 File selected:', file.name);
                
                // Ensure mapper is available
                if (window.choroplethMapper && window.choroplethMapper.handleFile) {
                    window.choroplethMapper.handleFile(file);
                } else {
                    console.error('❌ Choropleth mapper not available');
                }
            }
        });
        
        console.log('✅ Upload fix complete');
        
    }, 1000); // Wait 1 second for full initialization
});