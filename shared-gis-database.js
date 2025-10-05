/**
 * Shared GIS Database Service
 * Provides unified access to the comprehensive 3.2GB geospatial database
 * for both Choropleth Mapper and Universal Choropleth Tool
 */

class SharedGISDatabase {
    constructor(basePath = '/Users/jefffranzen/choropleth-mapper/data/') {
        this.basePath = basePath;
        this.inventory = null;
        this.cache = new Map();
        
        // Dataset definitions with your actual files
        this.datasets = {
            counties: {
                file: 'us_counties.json',
                records: 3221,
                size: '2.95MB',
                joinFields: ['FIPS', 'GEOID', 'NAME', 'COUNTY'],
                description: 'Complete US Counties',
                coverage: 'National'
            },
            zips: {
                file: 'us_zips_full.json', 
                records: 33092,
                size: '27.03MB',
                joinFields: ['ZIP', 'GEOID', 'ZCTA5CE10'],
                description: 'ZIP Code Tabulation Areas',
                coverage: 'National'
            },
            places: {
                file: 'us_places.json',
                records: 30000,
                size: '314.46MB', 
                joinFields: ['GEOID', 'NAME', 'NAMELSAD'],
                description: 'Incorporated Places and Cities',
                coverage: 'Sample (Alabama)'
            },
            tracts: {
                file: 'us_census_tracts.json',
                records: 70000,
                size: '696.49MB',
                joinFields: ['GEOID', 'TRACTCE', 'NAME'],
                description: 'Census Tracts',
                coverage: 'Sample (Alaska)'
            },
            blockgroups: {
                file: 'us_block_groups.json',
                records: 220000,
                size: '1779.64MB',
                joinFields: ['GEOID', 'BLKGRPCE', 'NAMELSAD'],
                description: 'Census Block Groups',
                coverage: 'Sample (Alabama)'
            },
            states: {
                file: 'us_states.json',
                records: 52,
                size: '0.09MB',
                joinFields: ['NAME', 'id'],
                description: 'US States and Territories',
                coverage: 'Complete'
            },
            // Emergency Infrastructure
            fire_stations: {
                file: 'us_fire_stations.json',
                records: 50000,
                size: '15MB',
                joinFields: ['NAME', 'STATE'],
                description: 'Fire Stations (HIFLD)',
                coverage: 'National'
            },
            flood_zones: {
                file: 'us_fema_flood_zones.json',
                records: 1000000,
                size: '500MB',
                joinFields: ['ZONE', 'STATE', 'COUNTY'],
                description: 'FEMA Flood Risk Areas',
                coverage: 'National'
            },
            evacuation_routes: {
                file: 'us_evacuation_routes.json',
                records: 5000,
                size: '25MB',
                joinFields: ['ROUTE_NAME', 'STATE'],
                description: 'Emergency Evacuation Routes',
                coverage: 'Regional'
            },
            major_roads: {
                file: 'us_major_roads.json',
                records: 100000,
                size: '95.35MB',
                joinFields: ['FULLNAME'],
                description: 'Major Transportation Networks',
                coverage: 'Multi-regional'
            }
        };
    }

    /**
     * Initialize the database service
     */
    async init() {
        try {
            await this.loadInventory();
            console.log('✅ Shared GIS Database initialized successfully');
            console.log(`📊 ${Object.keys(this.datasets).length} datasets available`);
            console.log(`💾 Total size: 3.2GB`);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize database:', error);
            return false;
        }
    }

    /**
     * Load inventory from CSV file
     */
    async loadInventory() {
        try {
            const inventoryPath = this.basePath.replace('/data/', '/gis_inventory.csv');
            // In browser environment, we'll use the predefined datasets
            // In Node.js environment, we could read the actual CSV
            this.inventory = this.datasets;
            return this.inventory;
        } catch (error) {
            console.warn('⚠️ Could not load inventory, using default dataset definitions');
            this.inventory = this.datasets;
            return this.inventory;
        }
    }

    /**
     * Get available datasets
     */
    getAvailableDatasets() {
        return Object.entries(this.datasets).map(([key, info]) => ({
            id: key,
            name: info.description,
            records: info.records,
            size: info.size,
            coverage: info.coverage,
            joinFields: info.joinFields
        }));
    }

    /**
     * Get geography data with caching
     */
    async getGeography(type, options = {}) {
        const cacheKey = `${type}_${JSON.stringify(options)}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.log(`📋 Loading ${type} from cache`);
            return this.cache.get(cacheKey);
        }

        try {
            const dataset = this.datasets[type];
            if (!dataset) {
                throw new Error(`Dataset '${type}' not found`);
            }

            console.log(`📥 Loading ${type} (${dataset.size}) - ${dataset.description}`);
            
            const data = await this.loadDataset(dataset.file, options);
            
            // Cache the result
            this.cache.set(cacheKey, data);
            
            console.log(`✅ Loaded ${data.features?.length || 'unknown'} features for ${type}`);
            return data;

        } catch (error) {
            console.error(`❌ Failed to load ${type}:`, error);
            throw error;
        }
    }

    /**
     * Load dataset from file with filtering options
     */
    async loadDataset(filename, options = {}) {
        const filePath = `${this.basePath}${filename}`;
        
        try {
            // For browser environment - fetch the file
            if (typeof fetch !== 'undefined') {
                const response = await fetch(filePath);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                
                // Apply filtering if specified
                if (options.state && data.features) {
                    data.features = data.features.filter(feature => 
                        this.matchesState(feature, options.state)
                    );
                }
                
                return data;
            } 
            // For Node.js environment
            else if (typeof require !== 'undefined') {
                const fs = require('fs');
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                if (options.state && data.features) {
                    data.features = data.features.filter(feature => 
                        this.matchesState(feature, options.state)
                    );
                }
                
                return data;
            }
            else {
                throw new Error('No file loading method available');
            }
        } catch (error) {
            console.error(`Failed to load ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Check if feature matches state filter
     */
    matchesState(feature, stateFilter) {
        const props = feature.properties;
        const stateFips = stateFilter.length === 2 ? stateFilter : null;
        const stateName = stateFilter.length > 2 ? stateFilter.toLowerCase() : null;
        
        // Check various state field formats
        const stateFields = ['STATEFP', 'STATEFP10', 'STATEFP20', 'STATE', 'state'];
        const nameFields = ['STATE_NAME', 'state_name', 'State', 'NAME'];
        
        for (let field of stateFields) {
            if (props[field] && stateFips && props[field] === stateFips) {
                return true;
            }
        }
        
        for (let field of nameFields) {
            if (props[field] && stateName && 
                props[field].toLowerCase().includes(stateName)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Analyze CSV for geographic field detection
     */
    analyzeCSV(csvData) {
        if (!csvData || csvData.length === 0) {
            return { suggestions: [], analysis: {} };
        }

        const headers = Object.keys(csvData[0]);
        const suggestions = [];
        const analysis = {
            totalRows: csvData.length,
            detectedFields: {},
            recommendations: []
        };

        // Geographic field detection patterns
        const patterns = {
            fips: /^(fips|geoid|county_fips|cnty_fips|fips_code)$/i,
            zip: /^(zip|zipcode|zip_code|postal|zcta|zcta5)$/i,
            state_fips: /^(state_fips|statefp|state_id)$/i,
            state_name: /^(state|state_name|st|state_abbr)$/i,
            county_name: /^(county|county_name|cnty|cnty_name)$/i,
            place_name: /^(place|city|place_name|city_name|municipality)$/i,
            tract: /^(tract|tractce|census_tract|tract_id)$/i
        };

        headers.forEach(header => {
            for (let [type, pattern] of Object.entries(patterns)) {
                if (pattern.test(header)) {
                    analysis.detectedFields[type] = header;
                    
                    // Generate suggestions based on detected fields
                    if (type === 'fips' || type === 'county_name') {
                        suggestions.push({
                            geography: 'counties',
                            confidence: 0.9,
                            field: header,
                            dataset: this.datasets.counties
                        });
                    } else if (type === 'zip') {
                        suggestions.push({
                            geography: 'zips',
                            confidence: 0.95,
                            field: header,
                            dataset: this.datasets.zips
                        });
                    } else if (type === 'tract') {
                        suggestions.push({
                            geography: 'tracts',
                            confidence: 0.85,
                            field: header,
                            dataset: this.datasets.tracts
                        });
                    }
                }
            }
        });

        // Additional analysis
        if (suggestions.length === 0) {
            analysis.recommendations.push(
                'No geographic identifiers detected. Please ensure your CSV has columns like FIPS, ZIP, or GEOID.'
            );
        } else {
            analysis.recommendations.push(
                `Found ${suggestions.length} potential geographic join(s). Best match: ${suggestions[0]?.geography}`
            );
        }

        return { suggestions, analysis };
    }

    /**
     * Get database statistics
     */
    getStats() {
        const stats = {
            totalDatasets: Object.keys(this.datasets).length,
            totalSize: '3.2GB',
            cacheSize: this.cache.size,
            datasets: {}
        };

        Object.entries(this.datasets).forEach(([key, info]) => {
            stats.datasets[key] = {
                records: info.records,
                size: info.size,
                coverage: info.coverage,
                cached: this.cache.has(key)
            };
        });

        return stats;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache cleared');
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.SharedGISDatabase = SharedGISDatabase;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedGISDatabase;
}

console.log('📚 Shared GIS Database Service loaded');