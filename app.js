class ChoroplethMapper {
    constructor() {
        this.csvData = null;
        this.geoData = null;
        this.mergedData = null;
        this.map = null;
        this.currentLayer = null;
        
        this.initEventListeners();
        this.loadStates();
        this.showVersion();
    }
    
    showVersion() {
        // This will be updated automatically on each build
        const buildTime = 'Sep 23, 2025 01:26 PM ET';
        const versionDiv = document.getElementById('versionInfo');
        if (versionDiv) {
            if (buildTime === 'BUILD_TIMESTAMP') {
                // Development mode
                versionDiv.innerHTML = `Dev Mode | ${new Date().toLocaleString('en-US', {timeZone: 'America/New_York'})}`;
            } else {
                // Production - show when last built
                versionDiv.innerHTML = `Updated: ${buildTime}`;
            }
        }
    }

    initEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const csvInput = document.getElementById('csvInput');
        
        uploadArea.addEventListener('click', () => csvInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
        
        csvInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });
        
        document.getElementById('processBtn').addEventListener('click', () => this.processData());
        document.getElementById('exportGeoJSON').addEventListener('click', () => this.exportGeoJSON());
        document.getElementById('exportShapefile').addEventListener('click', () => this.exportShapefile());
        document.getElementById('exportArcGIS').addEventListener('click', () => this.exportToArcGIS());
        
        // Add zoom to features button
        const zoomBtn = document.getElementById('zoomToFeatures');
        if (zoomBtn) {
            zoomBtn.addEventListener('click', () => {
                if (this.currentLayer && this.map) {
                    const bounds = this.currentLayer.getBounds();
                    if (bounds.isValid()) {
                        this.map.invalidateSize();
                        this.map.fitBounds(bounds, {
                            padding: [50, 50],
                            maxZoom: 10
                        });
                        console.log('Zoomed to features');
                    }
                }
            });
        }
        
        // Add update base map button
        const updateBaseMapBtn = document.getElementById('updateBaseMap');
        if (updateBaseMapBtn) {
            updateBaseMapBtn.addEventListener('click', () => {
                if (this.mergedData) {
                    // Store current view
                    const center = this.map.getCenter();
                    const zoom = this.map.getZoom();
                    
                    // Recreate map with new base layer
                    this.createMap();
                    
                    // Restore view
                    this.map.setView(center, zoom);
                    
                    this.showSuccess('Base map updated successfully');
                }
            });
        }
        
        // Add listener for custom labels checkbox
        const customLabelsCheckbox = document.getElementById('useCustomLabels');
        if (customLabelsCheckbox) {
            customLabelsCheckbox.addEventListener('change', () => {
                // If map exists, refresh popups with new label preference
                if (this.currentLayer && this.map) {
                    // Re-create the layer with updated popup content
                    this.map.removeLayer(this.currentLayer);
                    this.createMap();
                    this.showSuccess('Label display updated');
                }
            });
        }
        
        document.getElementById('geoLevel').addEventListener('change', (e) => {
            this.updateJoinColumnSuggestions(e.target.value);
        });
    }

    handleFile(file) {
        if (!file.name.endsWith('.csv')) {
            this.showError('Please upload a CSV file');
            return;
        }
        
        // Clear any existing map when new file is uploaded
        if (this.currentLayer && this.map) {
            this.map.removeLayer(this.currentLayer);
            this.currentLayer = null;
        }
        
        // Hide preview panel when new file is loaded
        document.getElementById('previewPanel').classList.add('hidden');
        
        const fileInfo = document.getElementById('fileInfo');
        fileInfo.innerHTML = `
            <strong>File:</strong> ${file.name}<br>
            <strong>Size:</strong> ${(file.size / 1024).toFixed(2)} KB
        `;
        fileInfo.classList.remove('hidden');
        
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                this.csvData = results.data;
                this.populateColumnSelects();
                document.getElementById('configPanel').classList.remove('hidden');
                this.showSuccess(`Loaded ${results.data.length} rows`);
            },
            error: (error) => {
                this.showError('Error parsing CSV: ' + error.message);
            }
        });
    }

    populateColumnSelects() {
        if (!this.csvData || this.csvData.length === 0) return;
        
        const columns = Object.keys(this.csvData[0]);
        const joinSelect = document.getElementById('joinColumn');
        const dataSelect = document.getElementById('dataColumn');
        
        joinSelect.innerHTML = '<option value="">Select column...</option>';
        dataSelect.innerHTML = '<option value="">Select column...</option>';
        
        columns.forEach(col => {
            joinSelect.innerHTML += `<option value="${col}">${col}</option>`;
            dataSelect.innerHTML += `<option value="${col}">${col}</option>`;
        });
    }

    updateJoinColumnSuggestions(geoLevel) {
        const joinSelect = document.getElementById('joinColumn');
        if (!this.csvData || this.csvData.length === 0) return;
        
        const columns = Object.keys(this.csvData[0]);
        const suggestions = {
            'county': ['FIPS', 'fips', 'county_fips', 'GEOID', 'geoid'],
            'subcounty': ['GEOID', 'geoid', 'GEO id2', 'CCD', 'ccd_fips'],
            'zip': ['ZIP', 'zip', 'zipcode', 'ZIP_CODE', 'ZCTA', 'zcta'],
            'tract': ['FIPS', 'fips', 'tract', 'GEOID', 'geoid'],
            'place': ['place', 'city', 'town', 'GEOID', 'geoid'],
            'state': ['state', 'STATE', 'state_name', 'state_code', 'STUSPS']
        };
        
        const suggested = suggestions[geoLevel] || [];
        const match = columns.find(col => 
            suggested.some(sug => col.toLowerCase().includes(sug.toLowerCase()))
        );
        
        if (match) {
            joinSelect.value = match;
        }
    }

    checkIfStateRequired() {
        const geoLevel = document.getElementById('geoLevel').value;
        const joinColumn = document.getElementById('joinColumn').value;
        const stateRequiredSpan = document.getElementById('stateRequired');
        
        if (geoLevel === 'county' && joinColumn && this.csvData && this.csvData.length > 0) {
            const firstValue = String(this.csvData[0][joinColumn]).trim();
            const isUsingNames = isNaN(firstValue) && firstValue.length > 5;
            
            if (isUsingNames && stateRequiredSpan) {
                stateRequiredSpan.style.display = 'inline';
            } else if (stateRequiredSpan) {
                stateRequiredSpan.style.display = 'none';
            }
        } else if (stateRequiredSpan) {
            stateRequiredSpan.style.display = 'none';
        }
    }
    
    loadStates() {
        const stateFilter = document.getElementById('stateFilter');
        const states = [
            {code: 'AL', name: 'Alabama'}, {code: 'AK', name: 'Alaska'},
            {code: 'AZ', name: 'Arizona'}, {code: 'AR', name: 'Arkansas'},
            {code: 'CA', name: 'California'}, {code: 'CO', name: 'Colorado'},
            {code: 'CT', name: 'Connecticut'}, {code: 'DE', name: 'Delaware'},
            {code: 'FL', name: 'Florida'}, {code: 'GA', name: 'Georgia'},
            {code: 'HI', name: 'Hawaii'}, {code: 'ID', name: 'Idaho'},
            {code: 'IL', name: 'Illinois'}, {code: 'IN', name: 'Indiana'},
            {code: 'IA', name: 'Iowa'}, {code: 'KS', name: 'Kansas'},
            {code: 'KY', name: 'Kentucky'}, {code: 'LA', name: 'Louisiana'},
            {code: 'ME', name: 'Maine'}, {code: 'MD', name: 'Maryland'},
            {code: 'MA', name: 'Massachusetts'}, {code: 'MI', name: 'Michigan'},
            {code: 'MN', name: 'Minnesota'}, {code: 'MS', name: 'Mississippi'},
            {code: 'MO', name: 'Missouri'}, {code: 'MT', name: 'Montana'},
            {code: 'NE', name: 'Nebraska'}, {code: 'NV', name: 'Nevada'},
            {code: 'NH', name: 'New Hampshire'}, {code: 'NJ', name: 'New Jersey'},
            {code: 'NM', name: 'New Mexico'}, {code: 'NY', name: 'New York'},
            {code: 'NC', name: 'North Carolina'}, {code: 'ND', name: 'North Dakota'},
            {code: 'OH', name: 'Ohio'}, {code: 'OK', name: 'Oklahoma'},
            {code: 'OR', name: 'Oregon'}, {code: 'PA', name: 'Pennsylvania'},
            {code: 'RI', name: 'Rhode Island'}, {code: 'SC', name: 'South Carolina'},
            {code: 'SD', name: 'South Dakota'}, {code: 'TN', name: 'Tennessee'},
            {code: 'TX', name: 'Texas'}, {code: 'UT', name: 'Utah'},
            {code: 'VT', name: 'Vermont'}, {code: 'VA', name: 'Virginia'},
            {code: 'WA', name: 'Washington'}, {code: 'WV', name: 'West Virginia'},
            {code: 'WI', name: 'Wisconsin'}, {code: 'WY', name: 'Wyoming'}
        ];
        
        states.forEach(state => {
            stateFilter.innerHTML += `<option value="${state.code}">${state.name}</option>`;
        });
    }

    async processData() {
        const geoLevel = document.getElementById('geoLevel').value;
        const joinColumn = document.getElementById('joinColumn').value;
        const dataColumn = document.getElementById('dataColumn').value;
        let stateFilter = document.getElementById('stateFilter').value;
        
        if (!geoLevel || !joinColumn || !dataColumn) {
            this.showError('Please select all required fields');
            return;
        }
        
        // Check if using county names - if so, state is REQUIRED
        if (geoLevel === 'county' && this.csvData && this.csvData.length > 0) {
            const firstValue = String(this.csvData[0][joinColumn]).trim();
            const isUsingNames = isNaN(firstValue) && firstValue.length > 5; // Not a FIPS code
            
            if (isUsingNames && !stateFilter) {
                this.showError('State selection is REQUIRED when using county names to avoid ambiguity (e.g., multiple Washington Counties exist)');
                return;
            }
        }
        
        // ZIP codes don't support state filtering well
        if (geoLevel === 'zip' && stateFilter) {
            this.showError('Note: State filtering is not available for ZIP codes. Please filter your CSV data by state before uploading, or select "All states" to continue.');
            stateFilter = ''; // Clear state filter for ZIP codes
            document.getElementById('stateFilter').value = '';
        }
        
        this.showLoading(true);
        
        try {
            await this.fetchGeographicData(geoLevel, stateFilter);
            this.mergeData(joinColumn, dataColumn);
            
            // Show the preview panel BEFORE creating the map
            document.getElementById('previewPanel').classList.remove('hidden');
            
            // Small delay to ensure the container is rendered
            setTimeout(() => {
                this.createMap();
                this.displayStats();
                this.showSuccess('Data processed successfully!');
            }, 100);
        } catch (error) {
            this.showError('Error processing data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    detectStatesFromData() {
        const states = new Set();
        const joinColumn = document.getElementById('joinColumn').value;
        const geoLevel = document.getElementById('geoLevel').value;
        
        console.log('detectStatesFromData: joinColumn =', joinColumn);
        console.log('detectStatesFromData: geoLevel =', geoLevel);
        console.log('detectStatesFromData: csvData exists?', !!this.csvData);
        console.log('detectStatesFromData: csvData length?', this.csvData?.length);
        
        if (this.csvData && joinColumn) {
            this.csvData.forEach(row => {
                const value = row[joinColumn];
                // Extract state FIPS from various FIPS formats
                if (value && value.length >= 2) {
                    const fipsStr = value.toString().trim();
                    let stateFips = null;
                    
                    if (fipsStr.match(/^\d{4,5}$/)) {
                        // County FIPS (4-5 digits)
                        stateFips = fipsStr.padStart(5, '0').substring(0, 2);
                    } else if (fipsStr.match(/^\d{7}$/)) {
                        // Place FIPS (7 digits) - first 2 digits are state
                        stateFips = fipsStr.substring(0, 2);
                    } else if (fipsStr.match(/^\d{10,11}$/)) {
                        // Census tract or CCD - first 2 digits are state
                        stateFips = fipsStr.substring(0, 2);
                    }
                    
                    if (stateFips && stateFips >= '01' && stateFips <= '72') {
                        console.log(`Found state FIPS ${stateFips} from value ${value}`);
                        states.add(stateFips);
                    }
                }
            });
        }
        
        console.log('detectStatesFromData: final states =', Array.from(states));
        return states;
    }
    
    getStateAbbrevFromFips(fipsCode) {
        const stateMap = {
            '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
            '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
            '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
            '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
            '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
            '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
            '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
            '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
            '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
            '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
            '56': 'WY', '72': 'PR'
        };
        return stateMap[fipsCode];
    }

    async fetchGeographicData(geoLevel, stateFilter) {
        console.log('fetchGeographicData called with:', { geoLevel, stateFilter });
        
        // If no state filter selected, detect states from FIPS codes and fetch each
        if (!stateFilter && (geoLevel === 'county' || geoLevel === 'place')) {
            console.log('No state filter, attempting to detect states from data...');
            const detectedStates = this.detectStatesFromData();
            console.log('Detected states:', detectedStates);
            
            if (detectedStates.size > 0 && detectedStates.size <= 10) {
                console.log(`Detected ${detectedStates.size} states from FIPS codes:`, Array.from(detectedStates));
                const allFeatures = [];
                
                for (const stateFips of detectedStates) {
                    const stateAbbr = this.getStateAbbrevFromFips(stateFips);
                    if (stateAbbr) {
                        console.log(`Fetching boundaries for ${stateAbbr} (FIPS: ${stateFips})...`);
                        try {
                            await this.fetchSingleStateData(geoLevel, stateAbbr);
                            if (this.geoData && this.geoData.features) {
                                allFeatures.push(...this.geoData.features);
                                console.log(`  Added ${this.geoData.features.length} features from ${stateAbbr}`);
                            }
                        } catch (error) {
                            console.error(`  Failed to fetch ${stateAbbr}:`, error.message);
                        }
                    }
                }
                
                if (allFeatures.length > 0) {
                    this.geoData = {
                        type: 'FeatureCollection',
                        features: allFeatures
                    };
                    console.log(`Total features loaded: ${allFeatures.length} counties from ${detectedStates.size} states`);
                    return;
                }
            }
        }
        
        // Single state or default fetch
        await this.fetchSingleStateData(geoLevel, stateFilter);
    }
    
    async fetchSingleStateData(geoLevel, stateFilter) {
        const year = '2023';
        let url = '';
        
        // Check if we need batch fetching for large states
        const needsBatchFetch = this.needsBatchFetching(geoLevel, stateFilter);
        if (needsBatchFetch) {
            console.log(`Large dataset detected for ${stateFilter} ${geoLevel}. Using batch fetching...`);
            return await this.fetchInBatches(geoLevel, stateFilter);
        }
        
        // For ZIP codes, use a different service that works better
        if (geoLevel === 'zip') {
            // Use a public GeoJSON file for ZIP codes (Florida only for now)
            if (!stateFilter || stateFilter === 'FL') {
                url = 'https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/fl_florida_zip_codes_geo.min.json';
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        this.geoData = await response.json();
                        console.log(`Loaded ${this.geoData.features?.length || 0} ZIP codes from GitHub`);
                        return;
                    }
                } catch (error) {
                    console.log('GitHub ZIP source failed, trying ArcGIS');
                }
            }
        }
        
        const baseUrl = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services';
        
        const endpoints = {
            'county': `/USA_Counties_Generalized_Boundaries/FeatureServer/0`,
            'subcounty': `/USA_County_Subdivisions/FeatureServer/0`,
            'zip': `/USA_ZIP_Code_Tabulation_Areas_ZCTA5_2020/FeatureServer/0`,
            'tract': `/USA_Census_Tracts/FeatureServer/0`,
            'place': `/USA_Census_Populated_Places/FeatureServer/0`,
            'state': `/USA_States_Generalized/FeatureServer/0`
        };
        
        url = baseUrl + endpoints[geoLevel] + '/query';
        
        let where = '1=1';
        if (stateFilter && geoLevel !== 'state') {
            // Different geography types use different field names for state
            if (geoLevel === 'zip') {
                // ZIP codes - no state filter, handled in processData
                where = '1=1';
            } else if (geoLevel === 'tract' || geoLevel === 'subcounty') {
                // Census tracts and sub-counties use different field names
                const stateFips = this.getStateFips(stateFilter);
                where = `STATE = '${stateFips}' OR STATEFP = '${stateFips}'`;
            } else if (geoLevel === 'place') {
                // Places use STATE field for state abbreviation
                where = `STATE = '${stateFilter}' OR ST = '${stateFilter}'`;
            } else {
                // Counties use STATE_NAME or STUSPS
                where = `STATE_NAME = '${this.getStateName(stateFilter)}' OR STUSPS = '${stateFilter}' OR STATE_ABBR = '${stateFilter}'`;
            }
        }
        
        const params = new URLSearchParams({
            where: where,
            outFields: '*',
            f: 'geojson',
            outSR: '4326',
            returnGeometry: 'true',
            geometryPrecision: '4'
        });
        
        try {
            console.log(`Fetching from: ${url}?${params.toString()}`);
            const response = await fetch(`${url}?${params}`);
            
            if (!response.ok) {
                console.error(`ArcGIS API failed with status: ${response.status} ${response.statusText}`);
                throw new Error(`Failed to fetch geographic data: ${response.statusText}`);
            }
            
            const responseText = await response.text();
            try {
                this.geoData = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse ArcGIS response:', parseError);
                console.error('Response text:', responseText.substring(0, 500));
                throw new Error('Invalid JSON response from ArcGIS service');
            }
            
            if (!this.geoData || !this.geoData.features || this.geoData.features.length === 0) {
                console.log('No features from ArcGIS, trying Census TIGER...');
                const tigerUrl = this.getTigerUrl(geoLevel, year, stateFilter);
                console.log(`Fetching from TIGER: ${tigerUrl}`);
                
                const tigerResponse = await fetch(tigerUrl);
                if (!tigerResponse.ok) {
                    console.error(`TIGER API failed with status: ${tigerResponse.status}`);
                    throw new Error('Failed to fetch from Census TIGER service');
                }
                
                const tigerText = await tigerResponse.text();
                try {
                    this.geoData = JSON.parse(tigerText);
                } catch (parseError) {
                    console.error('Failed to parse TIGER response:', parseError);
                    console.error('Response text:', tigerText.substring(0, 500));
                    throw new Error('Invalid JSON response from TIGER service');
                }
                
                if (!this.geoData || !this.geoData.features) {
                    console.error('TIGER response has no features:', this.geoData);
                    throw new Error('Invalid geographic data received from service');
                }
            }
        } catch (error) {
            console.error('Primary fetch failed, error details:', error);
            
            // Try fallback to TIGER
            try {
                const tigerUrl = this.getTigerUrl(geoLevel, year, stateFilter);
                console.log(`Fallback to TIGER: ${tigerUrl}`);
                
                const response = await fetch(tigerUrl);
                if (!response.ok) {
                    console.error(`TIGER fallback failed with status: ${response.status}`);
                    throw new Error('Failed to fetch geographic boundaries from both services');
                }
                
                const responseText = await response.text();
                this.geoData = JSON.parse(responseText);
                
                if (!this.geoData || !this.geoData.features) {
                    console.error('TIGER fallback has no features:', this.geoData);
                    throw new Error('Unable to fetch valid geographic boundaries. Please try again or select a different geography level.');
                }
            } catch (fallbackError) {
                console.error('Both services failed:', fallbackError);
                throw new Error('Unable to fetch geographic boundaries. Please check your internet connection and try again.');
            }
        }
    }

    needsBatchFetching(geoLevel, stateFilter) {
        // Define which states need batch fetching for specific geography types
        const largeDatasetsNeedingBatch = {
            'zip': ['CA', 'TX', 'NY', 'FL', 'PA', 'IL', 'OH'],
            'tract': ['CA', 'TX', 'NY', 'FL', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI'],
            'place': ['CA', 'TX'] // California has ~1,800 places
        };
        
        return largeDatasetsNeedingBatch[geoLevel]?.includes(stateFilter);
    }
    
    async fetchInBatches(geoLevel, stateFilter) {
        const baseUrl = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services';
        const endpoints = {
            'county': `/USA_Counties_Generalized_Boundaries/FeatureServer/0`,
            'subcounty': `/USA_County_Subdivisions/FeatureServer/0`,
            'zip': `/USA_ZIP_Code_Tabulation_Areas_ZCTA5_2020/FeatureServer/0`,
            'tract': `/USA_Census_Tracts/FeatureServer/0`,
            'place': `/USA_Census_Populated_Places/FeatureServer/0`,
            'state': `/USA_States_Generalized/FeatureServer/0`
        };
        
        const url = baseUrl + endpoints[geoLevel] + '/query';
        let where = '1=1';
        
        if (stateFilter) {
            if (geoLevel === 'place') {
                where = `STATE = '${stateFilter}' OR ST = '${stateFilter}'`;
            } else if (geoLevel === 'zip') {
                // For ZIP, we'll need to filter after fetching
                where = '1=1';
            } else {
                const stateFips = this.getStateFips(stateFilter);
                where = `STATE = '${stateFips}' OR STATEFP = '${stateFips}'`;
            }
        }
        
        const allFeatures = [];
        let offset = 0;
        const limit = 2000;
        let hasMore = true;
        
        this.showLoading(true);
        const loadingText = document.querySelector('.loading-text');
        
        while (hasMore) {
            const params = new URLSearchParams({
                where: where,
                outFields: '*',
                f: 'geojson',
                outSR: '4326',
                returnGeometry: 'true',
                geometryPrecision: '4',
                resultOffset: offset,
                resultRecordCount: limit
            });
            
            try {
                if (loadingText) {
                    loadingText.textContent = `Fetching batch ${Math.floor(offset/limit) + 1}... (${allFeatures.length} features loaded)`;
                }
                
                console.log(`Fetching batch at offset ${offset}...`);
                const response = await fetch(`${url}?${params}`);
                
                if (!response.ok) {
                    throw new Error(`Batch fetch failed: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.features && data.features.length > 0) {
                    allFeatures.push(...data.features);
                    console.log(`  Fetched ${data.features.length} features (total: ${allFeatures.length})`);
                    
                    if (data.features.length < limit) {
                        hasMore = false; // Got less than limit, no more data
                    } else {
                        offset += limit;
                    }
                } else {
                    hasMore = false; // No more features
                }
                
                // Safety check to prevent infinite loops
                if (offset > 10000) {
                    console.warn('Batch fetch stopped at 10,000 features to prevent infinite loop');
                    hasMore = false;
                }
                
            } catch (error) {
                console.error(`Batch fetch error at offset ${offset}:`, error);
                hasMore = false;
            }
        }
        
        if (loadingText) {
            loadingText.textContent = 'Processing your data...';
        }
        
        this.geoData = {
            type: 'FeatureCollection',
            features: allFeatures
        };
        
        console.log(`Batch fetch complete: ${allFeatures.length} total features`);
        
        // For ZIP codes, filter by state after fetching
        if (geoLevel === 'zip' && stateFilter) {
            const stateFips = this.getStateFips(stateFilter);
            this.geoData.features = this.geoData.features.filter(f => {
                const geoid = f.properties.GEOID || f.properties.ZCTA5CE20 || '';
                return geoid.startsWith(stateFips);
            });
            console.log(`Filtered to ${this.geoData.features.length} ${stateFilter} ZIP codes`);
        }
    }
    
    getTigerUrl(geoLevel, year, stateFilter) {
        const tigerBase = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb`;
        
        const tigerEndpoints = {
            'county': `/State_County/MapServer/1`,
            'subcounty': `/Places_CouSub_ConCity_SubMCD/MapServer/1`,
            'zip': `/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/2`,
            'tract': `/Tracts_Blocks/MapServer/0`,
            'place': `/Places_CouSub_ConCity_SubMCD/MapServer/0`,
            'state': `/State_County/MapServer/0`
        };
        
        let where = '1=1';
        if (stateFilter && geoLevel !== 'state') {
            const stateFips = this.getStateFips(stateFilter);
            where = `STATE = '${stateFips}'`;
        }
        
        const params = new URLSearchParams({
            where: where,
            outFields: '*',
            f: 'geojson',
            outSR: '4326',
            returnGeometry: 'true'
        });
        
        return `${tigerBase}${tigerEndpoints[geoLevel]}/query?${params}`;
    }

    getStateName(stateCode) {
        const stateNames = {
            'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
            'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
            'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
            'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
            'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
            'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
            'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
            'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
            'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
            'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
            'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
            'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
            'WI': 'Wisconsin', 'WY': 'Wyoming'
        };
        return stateNames[stateCode] || stateCode;
    }

    getStateFips(stateCode) {
        const stateFips = {
            'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08',
            'CT': '09', 'DE': '10', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16',
            'IL': '17', 'IN': '18', 'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22',
            'ME': '23', 'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
            'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34',
            'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39', 'OK': '40',
            'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47',
            'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
            'WI': '55', 'WY': '56'
        };
        return stateFips[stateCode] || stateCode;
    }

    mergeData(joinColumn, dataColumn) {
        const geoLevel = document.getElementById('geoLevel').value;
        
        if (!this.geoData || !this.geoData.features) {
            throw new Error('No geographic data available. Please try processing again.');
        }
        
        console.log(`Starting merge: ${this.geoData.features.length} geographic features`);
        console.log('Sample feature properties:', this.geoData.features[0]?.properties);
        
        const csvMap = new Map();
        const countyNameMap = new Map(); // For county name matching
        
        this.csvData.forEach(row => {
            const key = String(row[joinColumn]).trim();
            csvMap.set(key, row);
            
            // For county-level data, also create name-based lookups
            if (geoLevel === 'county' && isNaN(key)) {
                // It's a county name, not a FIPS code
                const cleanName = key.toUpperCase()
                    .replace(/\bCOUNTY\b/g, '')
                    .replace(/\bPARISH\b/g, '')
                    .replace(/\bBOROUGH\b/g, '')
                    .trim();
                countyNameMap.set(cleanName, row);
                
                // Also store with "COUNTY" suffix for matching
                countyNameMap.set(cleanName + ' COUNTY', row);
            }
        });
        
        console.log(`CSV data: ${csvMap.size} rows, sample keys:`, Array.from(csvMap.keys()).slice(0, 5));
        
        const geoIdFields = {
            'county': ['GEOID', 'FIPS', 'COUNTYFP', 'COUNTYNS', 'COUNTY'],
            'subcounty': ['GEOID', 'COUSUBFP', 'COUSUBNS', 'COUSUB', 'CCD'],
            'zip': ['GEOID', 'ZCTA5CE20', 'ZCTA5CE10', 'GEOID20', 'GEOID10', 'ZCTA5CE', 'ZCTA5', 'ZIP', 'ZIPCODE', 'ZCTA'],
            'tract': ['GEOID', 'TRACTCE', 'FIPS', 'TRACT'],
            'place': ['PLACEFIPS', 'GEOID', 'PLACEFP', 'PLACE_FIPS', 'PLACENS'],
            'state': ['STUSPS', 'STATE_NAME', 'STATE_ABBR', 'STATE', 'STATEFP']
        };
        
        const possibleFields = geoIdFields[geoLevel] || ['GEOID', 'FIPS'];
        console.log(`Looking for fields: ${possibleFields.join(', ')}`);
        
        // For debugging places
        if (geoLevel === 'place' && this.geoData.features.length > 0) {
            const samplePlace = this.geoData.features[0].properties;
            console.log('Sample place feature has these identifier fields:');
            possibleFields.forEach(field => {
                if (samplePlace[field]) {
                    console.log(`  ${field}: ${samplePlace[field]}`);
                }
            });
            console.log('All available fields:', Object.keys(samplePlace));
        }
        
        this.mergedData = {
            type: 'FeatureCollection',
            features: []
        };
        
        let matchCount = 0;
        let noMatchCount = 0;
        let sampleUnmatched = [];
        
        this.geoData.features.forEach((feature, index) => {
            let matched = false;
            let csvRecord = null;
            
            for (const field of possibleFields) {
                if (feature.properties[field]) {
                    const geoId = String(feature.properties[field]).trim();
                    
                    if (csvMap.has(geoId)) {
                        csvRecord = csvMap.get(geoId);
                        matched = true;
                        break;
                    }
                    
                    const paddedId = geoId.padStart(5, '0');
                    if (csvMap.has(paddedId)) {
                        csvRecord = csvMap.get(paddedId);
                        matched = true;
                        break;
                    }
                    
                    const unpaddedId = geoId.replace(/^0+/, '');
                    if (csvMap.has(unpaddedId)) {
                        csvRecord = csvMap.get(unpaddedId);
                        matched = true;
                        break;
                    }
                }
            }
            
            // For counties, also try name matching if FIPS didn't match
            if (!matched && geoLevel === 'county' && countyNameMap.size > 0) {
                const nameFields = ['NAME', 'COUNTY', 'COUNTYNAME', 'COUNTY_NAME', 'NAMELSAD'];
                for (const field of nameFields) {
                    if (feature.properties[field]) {
                        const countyName = String(feature.properties[field]).toUpperCase()
                            .replace(/\bCOUNTY\b/g, '')
                            .replace(/\bPARISH\b/g, '')
                            .replace(/\bBOROUGH\b/g, '')
                            .trim();
                        
                        if (countyNameMap.has(countyName)) {
                            csvRecord = countyNameMap.get(countyName);
                            matched = true;
                            console.log(`Matched by name: ${countyName}`);
                            break;
                        }
                        
                        // Try with "COUNTY" suffix
                        if (countyNameMap.has(countyName + ' COUNTY')) {
                            csvRecord = countyNameMap.get(countyName + ' COUNTY');
                            matched = true;
                            console.log(`Matched by name with suffix: ${countyName} COUNTY`);
                            break;
                        }
                    }
                }
            }
            
            if (matched && csvRecord) {
                // Only merge specific fields to avoid overwriting geographic identifiers
                const mergedFeature = {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        // Only add Display_label if it exists, and the data value
                        Display_label: csvRecord.Display_label || csvRecord.Display_Label || undefined,
                        choropleth_value: parseFloat(csvRecord[dataColumn]) || 0
                    }
                };
                this.mergedData.features.push(mergedFeature);
                matchCount++;
            } else {
                noMatchCount++;
                if (sampleUnmatched.length < 5 && feature.properties) {
                    const sampleIds = {};
                    possibleFields.forEach(field => {
                        if (feature.properties[field]) {
                            sampleIds[field] = feature.properties[field];
                        }
                    });
                    sampleUnmatched.push(sampleIds);
                }
            }
        });
        
        console.log(`Matched: ${matchCount}, No match: ${noMatchCount}`);
        if (sampleUnmatched.length > 0) {
            console.log('Sample unmatched geographic IDs:', sampleUnmatched);
        }
        
        if (matchCount === 0) {
            console.error('No matches found!');
            console.error('Available geographic fields in first feature:', Object.keys(this.geoData.features[0]?.properties || {}));
            console.error('Sample values from your CSV column:', Array.from(csvMap.keys()).slice(0, 10));
            console.error('Sample geographic IDs from map data:', sampleUnmatched.slice(0, 10));
            console.error('Geography type:', geoLevel);
            console.error('Join column:', joinColumn);
            
            let helpMessage = `No matches found between your CSV and the ${geoLevel} boundaries.\n\n`;
            helpMessage += `Your CSV column "${joinColumn}" contains values like: ${Array.from(csvMap.keys()).slice(0, 3).join(', ')}\n`;
            helpMessage += `Expected format for ${geoLevel}:\n`;
            
            if (geoLevel === 'zip') {
                helpMessage += '• 5-digit ZIP codes (e.g., 33701, 02134)\n';
            } else if (geoLevel === 'county') {
                helpMessage += '• 5-digit FIPS codes (e.g., 12103) OR county names (e.g., "Pinellas County" or "Pinellas")\n';
                helpMessage += '• If using county names, select a state filter\n';
            } else if (geoLevel === 'place') {
                helpMessage += '• 7-digit place FIPS codes (e.g., 1245000)\n';
            } else if (geoLevel === 'tract') {
                helpMessage += '• 11-digit census tract codes (e.g., 12103123456)\n';
            } else if (geoLevel === 'subcounty') {
                helpMessage += '• 10-digit CCD codes (e.g., 1210312345)\n';
            }
            
            throw new Error(helpMessage);
        }
    }

    createMap() {
        if (this.map) {
            this.map.remove();
        }
        
        this.map = L.map('map').setView([39.8283, -98.5795], 4);
        
        // Get selected base map
        const baseMapType = document.getElementById('baseMap')?.value || 'light';
        
        // Base map options
        const baseMaps = {
            'light': {
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '© OpenStreetMap contributors'
            },
            'dark': {
                url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                attribution: '© OpenStreetMap contributors © CARTO'
            },
            'satellite': {
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                attribution: '© Esri'
            },
            'terrain': {
                url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
                attribution: '© OpenStreetMap contributors, © OpenTopoMap'
            },
            'none': null
        };
        
        // Remove existing base layer if it exists
        if (this.baseLayer) {
            this.map.removeLayer(this.baseLayer);
            this.baseLayer = null;
        }
        
        // Add selected base map
        if (baseMapType !== 'none' && baseMaps[baseMapType]) {
            this.baseLayer = L.tileLayer(baseMaps[baseMapType].url, {
                attribution: baseMaps[baseMapType].attribution
            });
            this.baseLayer.addTo(this.map);
        }
        
        const values = this.mergedData.features
            .map(f => f.properties.choropleth_value)
            .filter(v => v != null && !isNaN(v));
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        // Get user selections for legend
        const classCount = parseInt(document.getElementById('classCount')?.value || '5');
        const colorScheme = document.getElementById('colorScheme')?.value || 'reds';
        const classMethod = document.getElementById('classMethod')?.value || 'quantile';
        
        // Color schemes
        const colorSchemes = {
            'reds': ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
            'blues': ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
            'greens': ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
            'purples': ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
            'oranges': ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
            'diverging': ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061']
        };
        
        const selectedColors = colorSchemes[colorScheme] || colorSchemes['reds'];
        
        // Create class breaks based on method
        let breaks = [];
        if (classMethod === 'quantile') {
            // Equal count in each class
            const sortedValues = [...values].sort((a, b) => a - b);
            for (let i = 0; i <= classCount; i++) {
                const idx = Math.floor(i * (sortedValues.length - 1) / classCount);
                breaks.push(sortedValues[idx]);
            }
        } else if (classMethod === 'equal') {
            // Equal intervals
            const interval = (max - min) / classCount;
            for (let i = 0; i <= classCount; i++) {
                breaks.push(min + (interval * i));
            }
        } else {
            // Default to equal for now (Jenks would need more complex algorithm)
            const interval = (max - min) / classCount;
            for (let i = 0; i <= classCount; i++) {
                breaks.push(min + (interval * i));
            }
        }
        
        // Store breaks for legend
        this.classBreaks = breaks;
        this.classColors = selectedColors.slice(0, classCount);
        
        const getColor = (value) => {
            if (value == null || isNaN(value)) return '#cccccc';
            
            // Find which class this value belongs to
            for (let i = 0; i < breaks.length - 1; i++) {
                if (value >= breaks[i] && value <= breaks[i + 1]) {
                    return this.classColors[i] || '#cccccc';
                }
            }
            return this.classColors[this.classColors.length - 1] || '#cccccc';
        };
        
        // Remove old layer if it exists
        if (this.currentLayer) {
            this.map.removeLayer(this.currentLayer);
            this.currentLayer = null;
        }
        
        this.currentLayer = L.geoJSON(this.mergedData, {
            style: (feature) => ({
                fillColor: getColor(feature.properties.choropleth_value),
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.7
            }),
            onEachFeature: (feature, layer) => {
                const dataColumn = document.getElementById('dataColumn').value;
                const geoLevel = document.getElementById('geoLevel').value;
                const useCustomLabels = document.getElementById('useCustomLabels')?.checked || false;
                const value = feature.properties.choropleth_value;
                
                // Get the appropriate display name
                let displayName = 'Unknown';
                
                // Check if user wants custom labels from CSV
                if (useCustomLabels) {
                    // ONLY use Display_label field when custom labels is checked
                    displayName = feature.properties.Display_label || null;
                }
                
                // If no custom label or checkbox unchecked, use geography identifier
                if (!displayName) {
                    if (geoLevel === 'zip') {
                        // For ZIP codes, show the ZIP code itself
                        const zipCode = feature.properties.ZCTA5CE20 || feature.properties.ZCTA5CE10 || feature.properties.ZIP || feature.properties.GEOID || feature.properties.ZCTA || 'Unknown';
                        displayName = `ZIP ${zipCode}`;
                    } else if (geoLevel === 'county') {
                        // For counties, show county name
                        displayName = feature.properties.NAME || feature.properties.NAMELSAD || feature.properties.name || 'Unknown County';
                    } else if (geoLevel === 'place') {
                        // For places/cities, show place name
                        displayName = feature.properties.NAME || feature.properties.PLACENAME || feature.properties.name || 'Unknown Place';
                    } else if (geoLevel === 'tract') {
                        // For census tracts, show tract number
                        displayName = `Tract ${feature.properties.NAME || feature.properties.TRACTCE || feature.properties.GEOID || 'Unknown'}`;
                    } else if (geoLevel === 'subcounty') {
                        // For sub-counties, show sub-county name
                        displayName = feature.properties.NAME || feature.properties.NAMELSAD || 'Unknown Sub-County';
                    } else if (geoLevel === 'state') {
                        // For states, show state name
                        displayName = feature.properties.NAME || feature.properties.STATE_NAME || 'Unknown State';
                    }
                }
                
                layer.bindPopup(`
                    <strong>${displayName}</strong><br>
                    ${dataColumn}: ${value != null ? value.toLocaleString() : 'No data'}
                `);
            }
        }).addTo(this.map);
        
        // Zoom to fit the loaded features with proper padding
        const bounds = this.currentLayer.getBounds();
        console.log('Layer bounds:', bounds);
        console.log('Bounds valid?', bounds.isValid());
        
        if (bounds.isValid()) {
            console.log('Fitting to bounds:', bounds.toBBoxString());
            // Force the map to fit bounds after a short delay to ensure rendering is complete
            setTimeout(() => {
                this.map.invalidateSize();
                this.map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 10
                });
                console.log('Map center after fitBounds:', this.map.getCenter());
                console.log('Map zoom after fitBounds:', this.map.getZoom());
            }, 500);  // Increased delay to ensure map is fully rendered
        } else {
            console.warn('Invalid bounds for layer, using default view');
            // For Florida counties, use a reasonable default
            if (this.mergedData.features.length > 0) {
                const firstFeature = this.mergedData.features[0];
                if (firstFeature.properties.STATE === '12' || firstFeature.properties.STATEFP === '12') {
                    // Florida bounds
                    this.map.fitBounds([[24.396308, -87.634938], [31.000968, -79.974306]]);
                }
            }
        }
        
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend');
            let legendHtml = '<h4>Legend</h4>';
            
            // Create a legend item for each class
            for (let i = 0; i < this.classColors.length; i++) {
                const rangeStart = this.classBreaks[i];
                const rangeEnd = this.classBreaks[i + 1];
                
                // Format the range text
                let rangeText = '';
                if (rangeEnd !== undefined) {
                    rangeText = `${rangeStart.toFixed(0)} - ${rangeEnd.toFixed(0)}`;
                } else {
                    rangeText = `${rangeStart.toFixed(0)}+`;
                }
                
                legendHtml += `
                    <div class="legend-item">
                        <span class="legend-color" style="background: ${this.classColors[i]}"></span>
                        <span>${rangeText}</span>
                    </div>
                `;
            }
            
            div.innerHTML = legendHtml;
            return div;
        };
        legend.addTo(this.map);
    }

    displayStats() {
        const stats = document.getElementById('stats');
        const totalFeatures = this.mergedData.features.length;
        const values = this.mergedData.features
            .map(f => f.properties.choropleth_value)
            .filter(v => v != null && !isNaN(v));
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        
        stats.innerHTML = `
            <strong>Statistics:</strong><br>
            Features: ${totalFeatures}<br>
            Min: ${min.toFixed(2)}<br>
            Max: ${max.toFixed(2)}<br>
            Average: ${avg.toFixed(2)}
        `;
    }

    exportGeoJSON() {
        const dataStr = JSON.stringify(this.mergedData, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'choropleth_data.geojson';
        link.click();
        URL.revokeObjectURL(url);
        this.showSuccess('GeoJSON exported successfully!');
    }

    exportShapefile() {
        try {
            const options = {
                folder: 'choropleth_shapefile',
                types: {
                    polygon: 'choropleth_data',
                    line: null,
                    point: null
                }
            };
            
            shpwrite.download(this.mergedData, options);
            this.showSuccess('Shapefile exported successfully!');
        } catch (error) {
            this.showError('Error exporting shapefile: ' + error.message);
        }
    }

    async exportToArcGIS() {
        this.showError('ArcGIS Online integration requires authentication. Please export as GeoJSON and upload manually to ArcGIS Online.');
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => errorDiv.classList.add('hidden'), 5000);
    }

    showSuccess(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.background = '#d4edda';
        errorDiv.style.color = '#155724';
        errorDiv.style.border = '1px solid #c3e6cb';
        errorDiv.classList.remove('hidden');
        setTimeout(() => {
            errorDiv.classList.add('hidden');
            errorDiv.style.background = '#fee';
            errorDiv.style.color = '#c00';
            errorDiv.style.border = '1px solid #fcc';
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChoroplethMapper();
});