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
            this.createMap();
            this.displayStats();
            
            document.getElementById('previewPanel').classList.remove('hidden');
            this.showSuccess('Data processed successfully!');
        } catch (error) {
            this.showError('Error processing data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    async fetchGeographicData(geoLevel, stateFilter) {
        const year = '2023';
        let url = '';
        
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
                // Places use ST field for state abbreviation
                where = `ST = '${stateFilter}'`;
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
            'zip': ['ZCTA5CE20', 'ZCTA5CE10', 'GEOID20', 'GEOID10', 'ZCTA5CE', 'GEOID', 'ZCTA5', 'ZIP', 'ZIPCODE'],
            'tract': ['GEOID', 'TRACTCE', 'FIPS', 'TRACT'],
            'place': ['PLACEFIPS', 'GEOID', 'PLACEFP', 'PLACE_FIPS', 'PLACENS'],
            'state': ['STUSPS', 'STATE_NAME', 'STATE_ABBR', 'STATE', 'STATEFP']
        };
        
        const possibleFields = geoIdFields[geoLevel] || ['GEOID', 'FIPS'];
        console.log(`Looking for fields: ${possibleFields.join(', ')}`);
        
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
                const mergedFeature = {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        ...csvRecord,
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
            throw new Error('No matches found. Please check that your join column contains valid geography identifiers. Check the browser console for details.');
        }
    }

    createMap() {
        if (this.map) {
            this.map.remove();
        }
        
        this.map = L.map('map').setView([39.8283, -98.5795], 4);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        const values = this.mergedData.features
            .map(f => f.properties.choropleth_value)
            .filter(v => v != null && !isNaN(v));
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        const getColor = (value) => {
            if (value == null || isNaN(value)) return '#cccccc';
            const normalized = (value - min) / (max - min);
            const colors = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026'];
            const index = Math.floor(normalized * (colors.length - 1));
            return colors[index];
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
                const value = feature.properties.choropleth_value;
                layer.bindPopup(`
                    <strong>${feature.properties.NAME || feature.properties.name || 'Unknown'}</strong><br>
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
            div.innerHTML = `
                <h4>Legend</h4>
                <div class="legend-item">
                    <span class="legend-color" style="background: ${getColor(min)}"></span>
                    <span>${min.toFixed(2)}</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: ${getColor((min + max) / 2)}"></span>
                    <span>${((min + max) / 2).toFixed(2)}</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: ${getColor(max)}"></span>
                    <span>${max.toFixed(2)}</span>
                </div>
            `;
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