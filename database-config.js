/**
 * UNIFIED DATABASE CONFIGURATION
 * Connects all 5 repositories to the 3.1GB local database via API
 */

const DATABASE_CONFIG = {
    // Local API server (started with START_DATABASE.command)
    apiUrl: 'http://localhost:5001',
    
    // Geographic data endpoints
    endpoints: {
        counties: '/api/counties',
        states: '/api/states', 
        zips: '/api/zips',
        status: '/'
    },
    
    // Repository-specific configurations
    repositories: {
        'alice-choropleth-tool': {
            dataTypes: ['counties', 'zips', 'states'],
            priority: 'alice-data',
            localPath: '/Users/jefffranzen/alice-choropleth-tool/docs/boundaries/'
        },
        'choropleth-mapper': {
            dataTypes: ['counties', 'states', 'zips'],
            priority: 'comprehensive',
            localPath: '/Users/jefffranzen/choropleth-mapper/data/'
        },
        'universal-choropleth-tool': {
            dataTypes: ['counties', 'states', 'zips'],
            priority: 'universal',
            localPath: null // Uses API only
        },
        'bivariate-choropleth-tool': {
            dataTypes: ['counties', 'tracts', 'bg'],
            priority: 'statistical',
            localPath: null // Uses API only  
        },
        'alice-data-mapper': {
            dataTypes: ['counties', 'zips', 'tracts'],
            priority: 'processing',
            localPath: null // Uses API only
        }
    }
};

/**
 * Universal Database Service
 * Works with both local files and API server
 */
class UnifiedGISDatabase {
    constructor(repositoryName = 'unknown') {
        this.config = DATABASE_CONFIG;
        this.repository = repositoryName;
        this.cache = new Map();
        this.repoConfig = this.config.repositories[repositoryName] || {};
    }
    
    async getStatus() {
        try {
            const response = await fetch(`${this.config.apiUrl}${this.config.endpoints.status}`);
            return await response.json();
        } catch (error) {
            console.warn('API server not available, using local fallback');
            return { status: 'local-fallback', database_healthy: false };
        }
    }
    
    async getGeography(type) {
        const cacheKey = `geography_${type}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            // Try API first
            const endpoint = this.config.endpoints[type];
            if (endpoint) {
                const response = await fetch(`${this.config.apiUrl}${endpoint}`);
                if (response.ok) {
                    const data = await response.json();
                    this.cache.set(cacheKey, data);
                    return data;
                }
            }
            
            // Fallback to local files if API fails
            if (this.repoConfig.localPath) {
                return await this.loadLocalFile(type);
            }
            
            throw new Error(`No data source available for ${type}`);
            
        } catch (error) {
            console.error(`Failed to load ${type}:`, error);
            throw error;
        }
    }
    
    async loadLocalFile(type) {
        const localMappings = {
            counties: 'us_counties.json',
            states: 'us_states.json', 
            zips: 'us_zips_full.json'
        };
        
        const filename = localMappings[type];
        if (!filename || !this.repoConfig.localPath) {
            throw new Error(`No local file mapping for ${type}`);
        }
        
        const response = await fetch(`${this.repoConfig.localPath}${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load local file: ${filename}`);
        }
        
        return await response.json();
    }
}

// Export for use in repositories
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DATABASE_CONFIG, UnifiedGISDatabase };
}