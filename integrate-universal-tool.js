/**
 * Universal Choropleth Tool Integration Script
 * Modifies the Universal Tool to use your comprehensive 3.2GB database
 * Run this after setting up the API server
 */

// Enhanced data loader for Universal Tool
class EnhancedUniversalDataLoader {
    constructor() {
        this.apiBase = 'http://localhost:5000';
        this.localFallback = true;
        this.cache = new Map();
        
        // Load shared configuration
        this.loadConfig();
    }

    async loadConfig() {
        try {
            const response = await fetch('/gis-config.json');
            this.config = await response.json();
            console.log('✅ Loaded unified GIS configuration');
        } catch (error) {
            console.warn('⚠️ Could not load config, using defaults');
            this.config = { datasets: {} };
        }
    }

    /**
     * Enhanced geography loading with your database
     */
    async loadGeographyData(type, options = {}) {
        const cacheKey = `${type}_${JSON.stringify(options)}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.log(`📋 Loading ${type} from cache`);
            return this.cache.get(cacheKey);
        }

        try {
            // Try API server first (your database)
            const data = await this.loadFromAPI(type, options);
            this.cache.set(cacheKey, data);
            return data;
            
        } catch (error) {
            console.warn(`⚠️ API failed, trying fallback: ${error.message}`);
            
            if (this.localFallback) {
                return await this.loadFromFallback(type, options);
            }
            throw error;
        }
    }

    /**
     * Load from your local API server
     */
    async loadFromAPI(type, options = {}) {
        let url = `${this.apiBase}/api/geography/${type}`;
        
        // Add state filter if specified
        if (options.state) {
            url += `?state=${encodeURIComponent(options.state)}`;
        }

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log(`✅ Loaded ${type} from your 3.2GB database`);
        console.log(`📊 Features: ${data.features?.length || 'unknown'}`);
        
        if (data.metadata) {
            console.log(`📋 Dataset: ${data.metadata.dataset_info?.description || type}`);
            if (data.metadata.filtered) {
                console.log(`🔍 Filtered by state: ${data.metadata.state_filter}`);
            }
        }

        return data;
    }

    /**
     * Fallback to original Universal Tool data loading
     */
    async loadFromFallback(type, options = {}) {
        console.log(`🔄 Using fallback data loading for ${type}`);
        
        // Call original Universal Tool data loading logic
        if (window.originalLoadGeographyData) {
            return await window.originalLoadGeographyData(type, options);
        }
        
        throw new Error('No fallback data loader available');
    }

    /**
     * Enhanced CSV analysis using your database patterns
     */
    async analyzeCSVWithDatabase(csvData) {
        try {
            const response = await fetch(`${this.apiBase}/api/analyze-csv`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: csvData })
            });

            if (response.ok) {
                const analysis = await response.json();
                console.log('✅ CSV analyzed with your database patterns');
                return analysis;
            }
        } catch (error) {
            console.warn('⚠️ Database analysis failed, using fallback');
        }

        // Fallback to original analysis
        return this.fallbackCSVAnalysis(csvData);
    }

    /**
     * Get available datasets from your database
     */
    async getAvailableDatasets() {
        try {
            const response = await fetch(`${this.apiBase}/api/datasets`);
            if (response.ok) {
                const data = await response.json();
                return data.datasets;
            }
        } catch (error) {
            console.warn('Could not load datasets from API');
        }

        return {};
    }

    /**
     * Check if API server is running
     */
    async checkAPIHealth() {
        try {
            const response = await fetch(`${this.apiBase}/`);
            if (response.ok) {
                const info = await response.json();
                console.log(`✅ GIS API Server running: ${info.name} v${info.version}`);
                console.log(`📊 Database: ${info.datasets} datasets, ${info.data_size}`);
                return true;
            }
        } catch (error) {
            console.warn('❌ GIS API Server not available');
            return false;
        }
        return false;
    }

    /**
     * Fallback CSV analysis (original Universal Tool logic)
     */
    fallbackCSVAnalysis(csvData) {
        // Simplified version - in real implementation, 
        // this would call the original Universal Tool analysis
        const headers = Object.keys(csvData[0] || {});
        
        return {
            suggestions: [],
            detected_fields: {},
            total_rows: csvData.length,
            headers: headers,
            recommendations: ['Using fallback analysis']
        };
    }
}

/**
 * Integration function to enhance Universal Choropleth Tool
 */
function enhanceUniversalTool() {
    console.log('🔧 Enhancing Universal Choropleth Tool with your database...');
    
    // Create enhanced data loader
    const enhancedLoader = new EnhancedUniversalDataLoader();
    
    // Check if API server is available
    enhancedLoader.checkAPIHealth().then(isAvailable => {
        if (isAvailable) {
            console.log('🎉 Successfully connected to your 3.2GB GIS database!');
            
            // Replace Universal Tool's data loading functions
            if (window.loadGeographyData) {
                window.originalLoadGeographyData = window.loadGeographyData;
                window.loadGeographyData = (type, options) => 
                    enhancedLoader.loadGeographyData(type, options);
            }
            
            // Replace CSV analysis
            if (window.analyzeCSV) {
                window.originalAnalyzeCSV = window.analyzeCSV;
                window.analyzeCSV = (csvData) => 
                    enhancedLoader.analyzeCSVWithDatabase(csvData);
            }
            
            // Add database info to UI
            addDatabaseInfoToUI(enhancedLoader);
            
        } else {
            console.log('⚠️ API server not available, Universal Tool will use original data sources');
            console.log('💡 To use your database, run: ./start-gis-server.sh');
        }
    });
}

/**
 * Add database information to Universal Tool UI
 */
function addDatabaseInfoToUI(loader) {
    // Add a banner showing database connection
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        padding: 10px 15px;
        border-radius: 25px;
        font-size: 12px;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.5s ease;
    `;
    banner.innerHTML = '🗺️ Connected to 3.2GB Database';
    
    document.body.appendChild(banner);
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    // Add dataset info to any existing dropdowns
    loader.getAvailableDatasets().then(datasets => {
        if (Object.keys(datasets).length > 0) {
            console.log('📊 Available datasets from your database:');
            Object.entries(datasets).forEach(([key, info]) => {
                console.log(`   ${key}: ${info.description} (${info.records} features)`);
            });
        }
    });
}

/**
 * Initialize when page loads
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceUniversalTool);
} else {
    enhanceUniversalTool();
}

// Make available globally
window.EnhancedUniversalDataLoader = EnhancedUniversalDataLoader;
window.enhanceUniversalTool = enhanceUniversalTool;

console.log('🔧 Universal Tool integration script loaded');