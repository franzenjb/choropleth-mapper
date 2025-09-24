class ChoroplethMapper {
    constructor() {
        this.csvData = null;
        this.geoData = null;
        this.mergedData = null;
        this.map = null;
        this.currentLayer = null;
        this.classBreaks = [];
        this.classColors = [];
        this.baseLayer = null;
        
        // Wait for DOM to be ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initEventListeners();
                this.loadStates();
                this.showVersion();
            });
        } else {
            this.initEventListeners();
            this.loadStates();
            this.showVersion();
        }
    }
    
    // ======================
    // INITIALIZATION METHODS
    // ======================
    
    showVersion() {
        const now = new Date();
        const buildTime = now.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(',', ',').replace(' at', '');
        
        const versionDiv = document.getElementById('versionInfo');
        if (versionDiv) {
            versionDiv.innerHTML = `Updated: ${buildTime} ET`;
        }
    }

    initEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const csvInput = document.getElementById('csvInput');
        
        if (!uploadArea || !csvInput) {
            console.error('Required DOM elements not found');
            return;
        }
        
        // File upload handlers
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
        
        // Button handlers
        document.getElementById('processBtn').addEventListener('click', () => this.processData());
        document.getElementById('exportGeoJSON').addEventListener('click', () => this.exportGeoJSON());
        document.getElementById('exportShapefile').addEventListener('click', () => this.exportShapefile());
        document.getElementById('exportArcGIS').addEventListener('click', () => this.exportToArcGIS());
        
        // Map control handlers
        const zoomBtn = document.getElementById('zoomToFeatures');
        if (zoomBtn) {
            zoomBtn.addEventListener('click', () => this.zoomToFeatures());
        }
        
        const updateBaseMapBtn = document.getElementById('updateBaseMap');
        if (updateBaseMapBtn) {
            updateBaseMapBtn.addEventListener('click', () => this.updateBaseMap());
        }
        
        const customLabelsCheckbox = document.getElementById('useCustomLabels');
        if (customLabelsCheckbox) {
            customLabelsCheckbox.addEventListener('change', () => this.refreshLabels());
        }
        
        document.getElementById('geoLevel').addEventListener('change', (e) => {
            this.updateJoinColumnSuggestions(e.target.value);
        });
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

    // ======================
    // FILE HANDLING METHODS
    // ======================

    handleFile(file) {
        if (!file.name.endsWith('.csv')) {
            this.showError('Please upload a CSV file');
            return;
        }
        
        this.clearExistingMap();
        
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
            'county': [
                'fips', 'county_fips', 'countyfips', 'county fips',
                'geoid', 'geo_id', 'geo id', 'geo', 
                'geo display_label', 'geo_display_label', 'display_label',
                'county', 'countycode', 'county_code', 'county code'
            ],
            'subcounty': [
                'geoid', 'geo_id', 'geo id', 'geo',
                'geo display_label', 'geo_display_label', 'display_label',
                'ccd', 'subcounty', 'sub_county', 'sub county'
            ],
            'zip': [
                'zip', 'zipcode', 'zip_code', 'zip code',
                'zcta', 'zcta5', 'postal', 'postalcode', 'postal_code',
                'geoid', 'geo_id', 'geo id', 'geo',
                'geo display_label', 'geo_display_label', 'display_label'
            ],
            'tract': [
                'tract', 'census_tract', 'census tract', 'tractcode',
                'fips', 'geoid', 'geo_id', 'geo id', 'geo',
                'geo display_label', 'geo_display_label', 'display_label'
            ],
            'place': [
                'place', 'city', 'town', 'municipality',
                'placefips', 'place_fips', 'place fips',
                'geoid', 'geo_id', 'geo id', 'geo',
                'geo display_label', 'geo_display_label', 'display_label'
            ],
            'state': [
                'state', 'state_name', 'state name', 'statename',
                'state_code', 'statecode', 'state code',
                'stusps', 'state_abbr', 'state abbr', 'abbreviation'
            ]
        };
        
        const suggested = suggestions[geoLevel] || [];
        
        // Find best match - exact first, then partial
        let match = columns.find(col => 
            suggested.some(sug => col.toLowerCase() === sug.toLowerCase())
        );
        
        if (!match) {
            match = columns.find(col => 
                suggested.some(sug => col.toLowerCase().includes(sug.toLowerCase()) || 
                                     sug.toLowerCase().includes(col.toLowerCase()))
            );
        }
        
        if (match) {
            joinSelect.value = match;
            console.log(`Auto-selected column '${match}' for ${geoLevel} geography`);
        }
    }

    // ======================
    // MAIN PROCESSING METHOD
    // ======================

    async processData() {
        const geoLevel = document.getElementById('geoLevel').value;
        const joinColumn = document.getElementById('joinColumn').value;
        const dataColumn = document.getElementById('dataColumn').value;
        let stateFilter = document.getElementById('stateFilter').value;
        
        if (!geoLevel || !joinColumn || !dataColumn) {
            this.showError('Please select all required fields');
            return;
        }
        
        // Validate county name requirements
        if (!this.validateCountyNameRequirements(geoLevel, joinColumn, stateFilter)) {
            return;
        }
        
        // Handle ZIP code state filtering limitation
        if (geoLevel === 'zip' && stateFilter) {
            this.showError('Note: State filtering is not available for ZIP codes. Please filter your CSV data by state before uploading, or select "All states" to continue.');
            stateFilter = '';
            document.getElementById('stateFilter').value = '';
        }
        
        this.showLoading(true);
        
        try {
            await this.fetchGeographicBoundaries(geoLevel, stateFilter);
            this.mergeDataSets(joinColumn, dataColumn);
            
            document.getElementById('previewPanel').classList.remove('hidden');
            
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

    validateCountyNameRequirements(geoLevel, joinColumn, stateFilter) {
        if (geoLevel === 'county' && this.csvData && this.csvData.length > 0) {
            const firstValue = String(this.csvData[0][joinColumn]).trim();
            const isUsingNames = isNaN(firstValue) && firstValue.length > 5;
            
            if (isUsingNames && !stateFilter) {
                this.showError('State selection is REQUIRED when using county names to avoid ambiguity (e.g., multiple Washington Counties exist)');
                return false;
            }
        }
        return true;
    }

    // ======================
    // GEOGRAPHIC DATA FETCHING
    // ======================

    async fetchGeographicBoundaries(geoLevel, stateFilter) {
        console.log('fetchGeographicBoundaries called with:', { geoLevel, stateFilter });
        
        // Handle ZIP codes without state filter
        if (!stateFilter && geoLevel === 'zip') {
            await this.fetchMultiStateZipCodes();
            return;
        }
        
        // Handle multi-state FIPS detection
        if (!stateFilter && (geoLevel === 'county' || geoLevel === 'place')) {
            const detectedStates = this.detectStatesFromFipsData();
            if (detectedStates.size > 0 && detectedStates.size <= 10) {
                await this.fetchMultiStateData(geoLevel, detectedStates);
                return;
            }
        }
        
        // Single state or default fetch
        await this.fetchSingleStateData(geoLevel, stateFilter);
    }

    async fetchMultiStateZipCodes() {
        console.log('Fetching all US ZIP codes (no state filtering needed)...');
        
        // Since we now have a complete US ZIP codes dataset, 
        // we can fetch all ZIP codes at once and filter later
        await this.fetchZipCodes();
        
        if (!this.geoData || !this.geoData.features || this.geoData.features.length === 0) {
            throw new Error('Unable to fetch US ZIP code boundaries from GitHub source');
        }
        
        console.log(`Loaded ${this.geoData.features.length} US ZIP codes`);
    }

    async fetchMultiStateData(geoLevel, detectedStates) {
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
        }
    }

    async fetchSingleStateData(geoLevel, stateFilter) {
        // Special handling for ZIP codes
        if (geoLevel === 'zip') {
            await this.fetchZipCodes(stateFilter);
            return;
        }
        
        const tigerUrl = this.buildTigerUrl(geoLevel, stateFilter);
        console.log(`Fetching from TIGER: ${tigerUrl}`);
        
        try {
            const response = await fetch(tigerUrl);
            if (!response.ok) {
                throw new Error(`TIGER API returned ${response.status}: ${response.statusText}`);
            }
            
            const responseText = await response.text();
            this.geoData = JSON.parse(responseText);
            
            if (!this.geoData || !this.geoData.features || this.geoData.features.length === 0) {
                throw new Error('No geographic features returned from TIGER service');
            }
            
            console.log(`Loaded ${this.geoData.features.length} ${geoLevel} features from TIGER`);
            
        } catch (error) {
            console.error('TIGER API error:', error);
            throw new Error(`Failed to fetch geographic boundaries from Census TIGER service: ${error.message}`);
        }
    }
    
    async fetchZipCodes(stateFilter) {
        console.log(`Fetching ZIP codes${stateFilter ? ' for ' + stateFilter : ''}...`);
        
        try {
            // Use reliable GitHub-hosted US ZIP codes GeoJSON
            // This is a free, complete dataset that covers all US ZIP codes
            const url = 'https://raw.githubusercontent.com/ndrezn/zip-code-geojson/main/usa_zip_codes_geo_26m.json';
            console.log('Fetching ZIP codes from GitHub:', url);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ZIP codes: ${response.status} ${response.statusText}`);
            }
            
            this.geoData = await response.json();
            console.log(`Loaded ${this.geoData.features?.length || 0} ZIP codes from GitHub`);
            
            // Apply state filtering if needed
            if (stateFilter) {
                this.filterZipCodesByState(stateFilter);
            }
            
        } catch (error) {
            console.error('ZIP code fetch error:', error);
            throw new Error(`Failed to fetch ZIP code boundaries: ${error.message}`);
        }
    }

    buildTigerUrl(geoLevel, stateFilter) {
        // ZIP codes are handled by fetchZipCodes() method directly
        if (geoLevel === 'zip') {
            throw new Error('ZIP codes should be handled by fetchZipCodes() method');
        }
        
        const tigerBase = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb';
        
        const tigerEndpoints = {
            'county': '/State_County/MapServer/1',
            'subcounty': '/Places_CouSub_ConCity_SubMCD/MapServer/1',
            'tract': '/Tracts_Blocks/MapServer/0',
            'place': '/Places_CouSub_ConCity_SubMCD/MapServer/0',
            'state': '/State_County/MapServer/0'
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

    filterZipCodesByState(stateFilter) {
        const zipRanges = this.getZipRangesForState(stateFilter);
        if (zipRanges && zipRanges.length > 0) {
            const originalCount = this.geoData.features.length;
            this.geoData.features = this.geoData.features.filter(f => {
                const zip = f.properties.ZCTA5 || f.properties.BASENAME || '';
                if (!zip) return false;
                
                const zipPrefix = parseInt(zip.substring(0, 3));
                return zipRanges.some(range => 
                    zipPrefix >= range.start && zipPrefix <= range.end
                );
            });
            console.log(`Filtered ${originalCount} to ${this.geoData.features.length} ZIP codes for ${stateFilter}`);
        }
    }

    // ======================
    // STATE DETECTION METHODS
    // ======================

    detectStatesFromZipCodes() {
        const states = new Set();
        const joinColumn = document.getElementById('joinColumn').value;
        
        if (this.csvData && joinColumn) {
            this.csvData.forEach(row => {
                let zip = String(row[joinColumn]).trim();
                
                if (zip.match(/^\d+$/)) {
                    if (zip.length === 3) {
                        zip = '00' + zip;
                    } else if (zip.length === 4) {
                        zip = '0' + zip;
                    }
                    
                    const zipPrefix = parseInt(zip.substring(0, 3));
                    const state = this.getStateFromZipPrefix(zipPrefix);
                    if (state) states.add(state);
                }
            });
        }
        
        return states;
    }

    detectStatesFromFipsData() {
        const states = new Set();
        const joinColumn = document.getElementById('joinColumn').value;
        
        if (this.csvData && joinColumn) {
            this.csvData.forEach(row => {
                const value = row[joinColumn];
                if (value && value.length >= 2) {
                    const fipsStr = value.toString().trim();
                    let stateFips = null;
                    
                    if (fipsStr.match(/^\d{4,5}$/)) {
                        // County FIPS (4-5 digits)
                        stateFips = fipsStr.padStart(5, '0').substring(0, 2);
                    } else if (fipsStr.match(/^\d{7}$/)) {
                        // Place FIPS (7 digits)
                        stateFips = fipsStr.substring(0, 2);
                    } else if (fipsStr.match(/^\d{10,11}$/)) {
                        // Census tract or CCD
                        stateFips = fipsStr.substring(0, 2);
                    }
                    
                    if (stateFips && stateFips >= '01' && stateFips <= '72') {
                        states.add(stateFips);
                    }
                }
            });
        }
        
        return states;
    }

    getStateFromZipPrefix(zipPrefix) {
        // Comprehensive ZIP prefix to state mapping
        if ((zipPrefix >= 10 && zipPrefix <= 27) || (zipPrefix >= 55 && zipPrefix <= 59)) return 'MA';
        else if (zipPrefix >= 28 && zipPrefix <= 29) return 'RI';
        else if (zipPrefix >= 30 && zipPrefix <= 38) return 'NH';
        else if (zipPrefix >= 39 && zipPrefix <= 49) return 'ME';
        else if (zipPrefix >= 50 && zipPrefix <= 54) return 'VT';
        else if (zipPrefix >= 60 && zipPrefix <= 69) return 'CT';
        else if (zipPrefix >= 70 && zipPrefix <= 89) return 'NJ';
        else if (zipPrefix >= 100 && zipPrefix <= 149) return 'NY';
        else if (zipPrefix >= 150 && zipPrefix <= 196) return 'PA';
        else if (zipPrefix >= 197 && zipPrefix <= 199) return 'DE';
        else if (zipPrefix >= 200 && zipPrefix <= 205) return 'DC';
        else if (zipPrefix >= 206 && zipPrefix <= 219) return 'MD';
        else if (zipPrefix >= 220 && zipPrefix <= 246) return 'VA';
        else if (zipPrefix >= 247 && zipPrefix <= 268) return 'WV';
        else if (zipPrefix >= 270 && zipPrefix <= 289) return 'NC';
        else if (zipPrefix >= 290 && zipPrefix <= 299) return 'SC';
        else if ((zipPrefix >= 300 && zipPrefix <= 319) || (zipPrefix >= 398 && zipPrefix <= 399)) return 'GA';
        else if (zipPrefix >= 320 && zipPrefix <= 349) return 'FL';
        else if (zipPrefix >= 350 && zipPrefix <= 369) return 'AL';
        else if (zipPrefix >= 370 && zipPrefix <= 385) return 'TN';
        else if (zipPrefix >= 386 && zipPrefix <= 397) return 'MS';
        else if (zipPrefix >= 400 && zipPrefix <= 427) return 'KY';
        else if (zipPrefix >= 430 && zipPrefix <= 459) return 'OH';
        else if (zipPrefix >= 460 && zipPrefix <= 479) return 'IN';
        else if (zipPrefix >= 480 && zipPrefix <= 499) return 'MI';
        else if (zipPrefix >= 500 && zipPrefix <= 528) return 'IA';
        else if (zipPrefix >= 530 && zipPrefix <= 549) return 'WI';
        else if (zipPrefix >= 550 && zipPrefix <= 567) return 'MN';
        else if (zipPrefix >= 570 && zipPrefix <= 577) return 'SD';
        else if (zipPrefix >= 580 && zipPrefix <= 588) return 'ND';
        else if (zipPrefix >= 590 && zipPrefix <= 599) return 'MT';
        else if (zipPrefix >= 600 && zipPrefix <= 629) return 'IL';
        else if (zipPrefix >= 630 && zipPrefix <= 658) return 'MO';
        else if (zipPrefix >= 660 && zipPrefix <= 679) return 'KS';
        else if (zipPrefix >= 680 && zipPrefix <= 693) return 'NE';
        else if (zipPrefix >= 700 && zipPrefix <= 714) return 'LA';
        else if (zipPrefix >= 716 && zipPrefix <= 729) return 'AR';
        else if (zipPrefix >= 730 && zipPrefix <= 749) return 'OK';
        else if ((zipPrefix >= 750 && zipPrefix <= 799) || zipPrefix === 885) return 'TX';
        else if (zipPrefix >= 800 && zipPrefix <= 816) return 'CO';
        else if (zipPrefix >= 820 && zipPrefix <= 831) return 'WY';
        else if (zipPrefix >= 832 && zipPrefix <= 838) return 'ID';
        else if (zipPrefix >= 840 && zipPrefix <= 847) return 'UT';
        else if (zipPrefix >= 850 && zipPrefix <= 865) return 'AZ';
        else if (zipPrefix >= 870 && zipPrefix <= 884) return 'NM';
        else if (zipPrefix >= 889 && zipPrefix <= 898) return 'NV';
        else if (zipPrefix >= 900 && zipPrefix <= 961) return 'CA';
        else if (zipPrefix === 967 || zipPrefix === 968) return 'HI';
        else if (zipPrefix >= 970 && zipPrefix <= 979) return 'OR';
        else if (zipPrefix >= 980 && zipPrefix <= 994) return 'WA';
        else if (zipPrefix >= 995 && zipPrefix <= 999) return 'AK';
        else if (zipPrefix >= 6 && zipPrefix <= 9) return 'PR';
        else if (zipPrefix === 969) return 'GU';
        
        return null;
    }

    getZipRangesForState(stateAbbr) {
        const stateZipRanges = {
            'MA': [{start: 10, end: 27}, {start: 55, end: 59}],
            'RI': [{start: 28, end: 29}],
            'NH': [{start: 30, end: 38}],
            'ME': [{start: 39, end: 49}],
            'VT': [{start: 50, end: 54}],
            'CT': [{start: 60, end: 69}],
            'NJ': [{start: 70, end: 89}],
            'NY': [{start: 100, end: 149}],
            'PA': [{start: 150, end: 196}],
            'DE': [{start: 197, end: 199}],
            'DC': [{start: 200, end: 205}],
            'MD': [{start: 206, end: 219}],
            'VA': [{start: 220, end: 246}],
            'WV': [{start: 247, end: 268}],
            'NC': [{start: 270, end: 289}],
            'SC': [{start: 290, end: 299}],
            'GA': [{start: 300, end: 319}, {start: 398, end: 399}],
            'FL': [{start: 320, end: 349}],
            'AL': [{start: 350, end: 369}],
            'TN': [{start: 370, end: 385}],
            'MS': [{start: 386, end: 397}],
            'KY': [{start: 400, end: 427}],
            'OH': [{start: 430, end: 459}],
            'IN': [{start: 460, end: 479}],
            'MI': [{start: 480, end: 499}],
            'IA': [{start: 500, end: 528}],
            'WI': [{start: 530, end: 549}],
            'MN': [{start: 550, end: 567}],
            'SD': [{start: 570, end: 577}],
            'ND': [{start: 580, end: 588}],
            'MT': [{start: 590, end: 599}],
            'IL': [{start: 600, end: 629}],
            'MO': [{start: 630, end: 658}],
            'KS': [{start: 660, end: 679}],
            'NE': [{start: 680, end: 693}],
            'LA': [{start: 700, end: 714}],
            'AR': [{start: 716, end: 729}],
            'OK': [{start: 730, end: 749}],
            'TX': [{start: 750, end: 799}, {start: 885, end: 885}],
            'CO': [{start: 800, end: 816}],
            'WY': [{start: 820, end: 831}],
            'ID': [{start: 832, end: 838}],
            'UT': [{start: 840, end: 847}],
            'AZ': [{start: 850, end: 865}],
            'NM': [{start: 870, end: 884}],
            'NV': [{start: 889, end: 898}],
            'CA': [{start: 900, end: 961}],
            'HI': [{start: 967, end: 968}],
            'OR': [{start: 970, end: 979}],
            'WA': [{start: 980, end: 994}],
            'AK': [{start: 995, end: 999}],
            'PR': [{start: 6, end: 9}],
            'VI': [{start: 8, end: 8}],
            'GU': [{start: 969, end: 969}]
        };
        
        return stateZipRanges[stateAbbr] || null;
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

    // ======================
    // DATA PROCESSING METHODS
    // ======================

    mergeDataSets(joinColumn, dataColumn) {
        const geoLevel = document.getElementById('geoLevel').value;
        
        if (!this.geoData || !this.geoData.features) {
            throw new Error('No geographic data available. Please try processing again.');
        }
        
        console.log(`Starting merge: ${this.geoData.features.length} geographic features`);
        
        // Normalize data and handle aggregation
        const normalizedData = this.normalizeAndAggregateData(joinColumn, dataColumn, geoLevel);
        
        // Create merged dataset
        this.mergedData = this.joinDataWithGeography(normalizedData, geoLevel, joinColumn, dataColumn);
        
        const matchCount = this.mergedData.features.length;
        const noMatchCount = this.geoData.features.length - matchCount;
        
        console.log(`Matched: ${matchCount}, No match: ${noMatchCount}`);
        
        if (matchCount === 0) {
            this.throwMatchingError(geoLevel, joinColumn, normalizedData);
        }
    }

    normalizeAndAggregateData(joinColumn, dataColumn, geoLevel) {
        // First, normalize ZIP codes if needed
        if (geoLevel === 'zip') {
            this.csvData = this.csvData.map(row => {
                const key = String(row[joinColumn]).trim();
                if (key.match(/^\d+$/)) {
                    if (key.length === 3) {
                        row[joinColumn] = '00' + key;
                    } else if (key.length === 4) {
                        row[joinColumn] = '0' + key;
                    }
                }
                return row;
            });
        }
        
        // Check if we need aggregation
        const needsAggregation = this.checkIfAggregationNeeded(joinColumn);
        
        if (needsAggregation.required) {
            return this.aggregateData(joinColumn, dataColumn, needsAggregation.isNumeric);
        } else {
            return this.createDataMap(joinColumn, geoLevel);
        }
    }

    checkIfAggregationNeeded(joinColumn) {
        const geoIdCounts = new Map();
        this.csvData.forEach(row => {
            const key = String(row[joinColumn]).trim();
            geoIdCounts.set(key, (geoIdCounts.get(key) || 0) + 1);
        });
        
        const hasMultipleRecordsPerGeo = Array.from(geoIdCounts.values()).some(count => count > 1);
        const isNumericDataColumn = this.csvData.every(row => !isNaN(parseFloat(row[dataColumn])));
        
        return {
            required: hasMultipleRecordsPerGeo,
            isNumeric: isNumericDataColumn
        };
    }

    aggregateData(joinColumn, dataColumn, isNumeric) {
        const aggregatedData = new Map();
        
        if (isNumeric) {
            console.log('Auto-summing numeric values per geography...');
            this.csvData.forEach(row => {
                const key = String(row[joinColumn]).trim();
                const value = parseFloat(row[dataColumn]) || 0;
                
                if (!aggregatedData.has(key)) {
                    aggregatedData.set(key, { ...row });
                    aggregatedData.get(key)[dataColumn] = value;
                } else {
                    aggregatedData.get(key)[dataColumn] = 
                        parseFloat(aggregatedData.get(key)[dataColumn]) + value;
                }
            });
            this.showSuccess(`Auto-aggregated ${this.csvData.length} records by summing values into ${aggregatedData.size} geographic units`);
        } else {
            console.log('Auto-aggregating by counting occurrences...');
            this.csvData.forEach(row => {
                const key = String(row[joinColumn]).trim();
                if (!aggregatedData.has(key)) {
                    aggregatedData.set(key, { ...row, _aggregated_count: 1 });
                } else {
                    aggregatedData.get(key)._aggregated_count++;
                }
            });
            
            // Replace data column with count
            aggregatedData.forEach((row, key) => {
                row[dataColumn] = row._aggregated_count;
            });
            this.showSuccess(`Auto-aggregated ${this.csvData.length} records into ${aggregatedData.size} geographic units`);
        }
        
        return aggregatedData;
    }

    createDataMap(joinColumn, geoLevel) {
        const csvMap = new Map();
        const countyNameMap = new Map();
        
        this.csvData.forEach(row => {
            let key = String(row[joinColumn]).trim();
            csvMap.set(key, row);
            
            // Create flexible ZIP code lookups
            if (geoLevel === 'zip' && key.match(/^\d+$/)) {
                this.createZipCodeLookups(key, row, csvMap);
            }
            
            // Create county name lookups
            if (geoLevel === 'county' && isNaN(key)) {
                this.createCountyNameLookups(key, row, countyNameMap);
            }
        });
        
        return { csvMap, countyNameMap };
    }

    createZipCodeLookups(key, row, csvMap) {
        // Store multiple versions for flexible matching
        const numericZip = parseInt(key).toString();
        csvMap.set(numericZip, row);
        
        if (key.length === 5 && key.startsWith('0')) {
            const fourDigit = key.substring(1);
            csvMap.set(fourDigit, row);
            
            if (key.startsWith('00')) {
                const threeDigit = key.substring(2);
                csvMap.set(threeDigit, row);
            }
        }
    }

    createCountyNameLookups(key, row, countyNameMap) {
        const cleanName = key.toUpperCase()
            .replace(/\bCOUNTY\b/g, '')
            .replace(/\bPARISH\b/g, '')
            .replace(/\bBOROUGH\b/g, '')
            .trim();
        countyNameMap.set(cleanName, row);
        countyNameMap.set(cleanName + ' COUNTY', row);
    }

    joinDataWithGeography(normalizedData, geoLevel, joinColumn, dataColumn) {
        const geoIdFields = {
            'county': ['GEOID', 'FIPS', 'COUNTYFP', 'COUNTYNS', 'COUNTY'],
            'subcounty': ['GEOID', 'COUSUBFP', 'COUSUBNS', 'COUSUB', 'CCD'],
            'zip': ['ZCTA5CE10', 'ZCTA5CE20', 'GEOID10', 'GEOID20', 'GEOID', 'ZCTA5CE', 'ZCTA5', 'ZIP', 'ZIPCODE', 'ZCTA'],
            'tract': ['GEOID', 'TRACTCE', 'FIPS', 'TRACT'],
            'place': ['PLACEFIPS', 'GEOID', 'PLACEFP', 'PLACE_FIPS', 'PLACENS'],
            'state': ['STUSPS', 'STATE_NAME', 'STATE_ABBR', 'STATE', 'STATEFP']
        };
        
        const possibleFields = geoIdFields[geoLevel] || ['GEOID', 'FIPS'];
        const csvMap = normalizedData.csvMap || normalizedData;
        const countyNameMap = normalizedData.countyNameMap || new Map();
        
        const mergedFeatures = [];
        
        this.geoData.features.forEach((feature, index) => {
            const csvRecord = this.findMatchingRecord(feature, possibleFields, csvMap, countyNameMap, geoLevel);
            
            if (csvRecord) {
                const mergedFeature = this.createMergedFeature(feature, csvRecord, dataColumn);
                mergedFeatures.push(mergedFeature);
            }
        });
        
        return {
            type: 'FeatureCollection',
            features: mergedFeatures
        };
    }

    findMatchingRecord(feature, possibleFields, csvMap, countyNameMap, geoLevel) {
        // Try FIPS/ID matching first
        for (const field of possibleFields) {
            if (feature.properties[field]) {
                const geoId = String(feature.properties[field]).trim();
                
                // Try direct match
                if (csvMap.has(geoId)) return csvMap.get(geoId);
                
                // Try padded
                const paddedId = geoId.padStart(5, '0');
                if (csvMap.has(paddedId)) return csvMap.get(paddedId);
                
                // Try unpadded
                const unpaddedId = geoId.replace(/^0+/, '');
                if (csvMap.has(unpaddedId)) return csvMap.get(unpaddedId);
                
                // Try ZIP code variations  
                if (geoLevel === 'zip') {
                    // Handle GitHub data format (GEOID10 like "0906810" -> extract "06810")
                    if (geoId.match(/^\d{7}$/) && geoId.length === 7) {
                        const zipFromGeoId = geoId.substring(2); // Remove state FIPS prefix
                        if (csvMap.has(zipFromGeoId)) return csvMap.get(zipFromGeoId);
                    }
                    // Handle padded ZIP codes
                    if (geoId.match(/^0\d{4}$/)) {
                        const fourDigit = geoId.substring(1);
                        if (csvMap.has(fourDigit)) return csvMap.get(fourDigit);
                    }
                }
            }
        }
        
        // Try county name matching
        if (geoLevel === 'county' && countyNameMap.size > 0) {
            return this.matchByCountyName(feature, countyNameMap);
        }
        
        return null;
    }

    matchByCountyName(feature, countyNameMap) {
        const nameFields = ['NAME', 'COUNTY', 'COUNTYNAME', 'COUNTY_NAME', 'NAMELSAD'];
        
        for (const field of nameFields) {
            if (feature.properties[field]) {
                const countyName = String(feature.properties[field]).toUpperCase()
                    .replace(/\bCOUNTY\b/g, '')
                    .replace(/\bPARISH\b/g, '')
                    .replace(/\bBOROUGH\b/g, '')
                    .trim();
                
                if (countyNameMap.has(countyName)) {
                    console.log(`Matched by name: ${countyName}`);
                    return countyNameMap.get(countyName);
                }
                
                if (countyNameMap.has(countyName + ' COUNTY')) {
                    console.log(`Matched by name with suffix: ${countyName} COUNTY`);
                    return countyNameMap.get(countyName + ' COUNTY');
                }
            }
        }
        
        return null;
    }

    createMergedFeature(feature, csvRecord, dataColumn) {
        const processedCsvRecord = {};
        
        // Convert numeric strings to numbers
        for (const [key, value] of Object.entries(csvRecord)) {
            if (value !== null && value !== undefined && value !== '') {
                const trimmedValue = String(value).trim();
                if (/^-?\d*\.?\d+$/.test(trimmedValue)) {
                    processedCsvRecord[key] = parseFloat(trimmedValue);
                } else {
                    processedCsvRecord[key] = value;
                }
            } else {
                processedCsvRecord[key] = value;
            }
        }
        
        return {
            ...feature,
            properties: {
                ...feature.properties,
                ...processedCsvRecord,
                choropleth_value: parseFloat(csvRecord[dataColumn]) || 0
            }
        };
    }

    throwMatchingError(geoLevel, joinColumn, normalizedData) {
        const csvMap = normalizedData.csvMap || normalizedData;
        
        let helpMessage = `No matches found between your CSV and the ${geoLevel} boundaries.\n\n`;
        helpMessage += `Your CSV column "${joinColumn}" contains values like: ${Array.from(csvMap.keys()).slice(0, 3).join(', ')}\n`;
        helpMessage += `Expected format for ${geoLevel}:\n`;
        
        if (geoLevel === 'zip') {
            helpMessage += '• 3-5 digit ZIP codes (automatically padded)\n';
            helpMessage += '• 3 digits: PR/VI (e.g., 601 → 00601)\n';
            helpMessage += '• 4 digits: New England (e.g., 2134 → 02134)\n';
            helpMessage += '• 5 digits: Standard (e.g., 33701)\n';
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

    // ======================
    // MAP CREATION METHODS
    // ======================

    createMap() {
        if (this.map) {
            this.map.remove();
        }
        
        this.map = L.map('map').setView([39.8283, -98.5795], 4);
        
        this.setupBaseLayer();
        this.calculateClassification();
        this.addChoroplethLayer();
        this.fitMapToBounds();
        this.addLegend();
    }

    setupBaseLayer() {
        const baseMapType = document.getElementById('baseMap')?.value || 'light';
        
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
        
        if (this.baseLayer) {
            this.map.removeLayer(this.baseLayer);
            this.baseLayer = null;
        }
        
        if (baseMapType !== 'none' && baseMaps[baseMapType]) {
            this.baseLayer = L.tileLayer(baseMaps[baseMapType].url, {
                attribution: baseMaps[baseMapType].attribution
            });
            this.baseLayer.addTo(this.map);
        }
    }

    calculateClassification() {
        const values = this.mergedData.features
            .map(f => f.properties.choropleth_value)
            .filter(v => v != null && !isNaN(v));
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        const classCount = parseInt(document.getElementById('classCount')?.value || '5');
        const colorScheme = document.getElementById('colorScheme')?.value || 'reds';
        const classMethod = document.getElementById('classMethod')?.value || 'quantile';
        
        const colorSchemes = {
            'reds': ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
            'blues': ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
            'greens': ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
            'purples': ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
            'oranges': ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
            'diverging': ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061']
        };
        
        const selectedColors = colorSchemes[colorScheme] || colorSchemes['reds'];
        
        // Create class breaks
        let breaks = [];
        if (classMethod === 'quantile') {
            const sortedValues = [...values].sort((a, b) => a - b);
            for (let i = 0; i <= classCount; i++) {
                const idx = Math.floor(i * (sortedValues.length - 1) / classCount);
                breaks.push(sortedValues[idx]);
            }
        } else {
            // Equal intervals
            const interval = (max - min) / classCount;
            for (let i = 0; i <= classCount; i++) {
                breaks.push(min + (interval * i));
            }
        }
        
        this.classBreaks = breaks;
        this.classColors = selectedColors.slice(0, classCount);
    }

    addChoroplethLayer() {
        const getColor = (value) => {
            if (value == null || isNaN(value)) return '#cccccc';
            
            for (let i = 0; i < this.classBreaks.length - 1; i++) {
                if (value >= this.classBreaks[i] && value <= this.classBreaks[i + 1]) {
                    return this.classColors[i] || '#cccccc';
                }
            }
            return this.classColors[this.classColors.length - 1] || '#cccccc';
        };
        
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
                const popupContent = this.createPopupContent(feature);
                layer.bindPopup(popupContent);
            }
        }).addTo(this.map);
    }

    createPopupContent(feature) {
        const dataColumn = document.getElementById('dataColumn').value;
        const geoLevel = document.getElementById('geoLevel').value;
        const useCustomLabels = document.getElementById('useCustomLabels')?.checked || false;
        const value = feature.properties.choropleth_value;
        
        let displayName = this.getDisplayName(feature, geoLevel, useCustomLabels);
        
        return `
            <strong>${displayName}</strong><br>
            ${dataColumn}: ${value != null ? value.toLocaleString() : 'No data'}
        `;
    }

    getDisplayName(feature, geoLevel, useCustomLabels) {
        let displayName = 'Unknown';
        
        if (useCustomLabels) {
            displayName = feature.properties.Display_label || null;
        }
        
        if (!displayName) {
            if (geoLevel === 'zip') {
                const zipCode = feature.properties.ZCTA5CE10 || 
                               feature.properties.ZCTA5CE20 || 
                               feature.properties.GEOID10?.substring(2) ||
                               feature.properties.GEOID20?.substring(2) ||
                               feature.properties.ZIP || 
                               feature.properties.GEOID || 
                               feature.properties.ZCTA || 
                               feature.properties.ZCTA5 || 
                               feature.properties.ZIPCODE || 
                               'Unknown';
                displayName = `ZIP ${zipCode}`;
            } else if (geoLevel === 'county') {
                displayName = feature.properties.NAME || feature.properties.NAMELSAD || feature.properties.name || 'Unknown County';
            } else if (geoLevel === 'place') {
                displayName = feature.properties.NAME || feature.properties.PLACENAME || feature.properties.name || 'Unknown Place';
            } else if (geoLevel === 'tract') {
                displayName = `Tract ${feature.properties.NAME || feature.properties.TRACTCE || feature.properties.GEOID || 'Unknown'}`;
            } else if (geoLevel === 'subcounty') {
                displayName = feature.properties.NAME || feature.properties.NAMELSAD || 'Unknown Sub-County';
            } else if (geoLevel === 'state') {
                displayName = feature.properties.NAME || feature.properties.STATE_NAME || 'Unknown State';
            }
        }
        
        return displayName;
    }

    fitMapToBounds() {
        const bounds = this.currentLayer.getBounds();
        
        if (bounds.isValid()) {
            setTimeout(() => {
                this.map.invalidateSize();
                this.map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 10
                });
            }, 500);
        }
    }

    addLegend() {
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend');
            let legendHtml = '<h4>Legend</h4>';
            
            for (let i = 0; i < this.classColors.length; i++) {
                const rangeStart = this.classBreaks[i];
                const rangeEnd = this.classBreaks[i + 1];
                
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

    // ======================
    // MAP CONTROL METHODS
    // ======================

    zoomToFeatures() {
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
    }

    updateBaseMap() {
        if (this.mergedData) {
            const center = this.map.getCenter();
            const zoom = this.map.getZoom();
            
            this.createMap();
            
            this.map.setView(center, zoom);
            this.showSuccess('Base map updated successfully');
        }
    }

    refreshLabels() {
        if (this.currentLayer && this.map) {
            this.map.removeLayer(this.currentLayer);
            this.createMap();
            this.showSuccess('Label display updated');
        }
    }

    clearExistingMap() {
        if (this.currentLayer && this.map) {
            this.map.removeLayer(this.currentLayer);
            this.currentLayer = null;
        }
        document.getElementById('previewPanel').classList.add('hidden');
    }

    // ======================
    // STATISTICS AND EXPORT
    // ======================

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
            if (typeof shpwrite === 'undefined') {
                this.showError('Shapefile library not loaded. Please refresh the page and try again.');
                return;
            }
            
            if (!this.mergedData || !this.mergedData.features || this.mergedData.features.length === 0) {
                this.showError('No data to export. Please generate a map first.');
                return;
            }
            
            console.log('Exporting shapefile with', this.mergedData.features.length, 'features');
            
            const shapefileData = {
                type: 'FeatureCollection',
                features: this.mergedData.features.map(f => {
                    const truncatedProps = {};
                    
                    for (const [key, value] of Object.entries(f.properties)) {
                        if (key === 'geometry' || key === 'Shape__Area' || key === 'Shape__Length') {
                            continue;
                        }
                        
                        let fieldName = key.substring(0, 10);
                        
                        let counter = 1;
                        let originalFieldName = fieldName;
                        while (truncatedProps.hasOwnProperty(fieldName) && counter < 10) {
                            fieldName = originalFieldName.substring(0, 9) + counter;
                            counter++;
                        }
                        
                        let fieldValue = value;
                        if (typeof fieldValue === 'string' && fieldValue.length > 254) {
                            fieldValue = fieldValue.substring(0, 254);
                        }
                        
                        truncatedProps[fieldName] = fieldValue;
                    }
                    
                    return {
                        type: 'Feature',
                        geometry: f.geometry,
                        properties: truncatedProps
                    };
                })
            };
            
            const options = {
                folder: 'choropleth_shapefile',
                types: {
                    polygon: 'choropleth_data',
                    line: null,
                    point: null
                }
            };
            
            shpwrite.download(shapefileData, options);
            this.showSuccess('Shapefile exported successfully!');
        } catch (error) {
            console.error('Shapefile export error:', error);
            this.showError('Error exporting shapefile: ' + error.message);
        }
    }

    async exportToArcGIS() {
        const message = `
            <strong>To upload to ArcGIS Online:</strong><br><br>
            1. Click "Export GeoJSON" to download your data<br>
            2. Go to <a href="https://www.arcgis.com/home/content.html" target="_blank">ArcGIS Online</a><br>
            3. Click "Add Item" → "From your computer"<br>
            4. Select the GeoJSON file<br>
            5. Choose "Add and create a hosted feature layer"<br><br>
            <em>Direct upload requires API authentication which would expose your credentials.</em>
        `;
        
        const errorDiv = document.getElementById('error');
        errorDiv.innerHTML = message;
        errorDiv.style.background = '#d1ecf1';
        errorDiv.style.color = '#004085';
        errorDiv.style.border = '1px solid #bee5eb';
        errorDiv.classList.remove('hidden');
        
        setTimeout(() => {
            errorDiv.classList.add('hidden');
            errorDiv.style.background = '#fee';
            errorDiv.style.color = '#c00';
            errorDiv.style.border = '1px solid #fcc';
        }, 15000);
    }

    // ======================
    // UTILITY METHODS
    // ======================

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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ChoroplethMapper();
});