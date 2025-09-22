class ChoroplethMapper {
    constructor() {
        this.csvData = null;
        this.geoData = null;
        this.mergedData = null;
        this.map = null;
        this.currentLayer = null;
        
        this.initEventListeners();
        this.loadStates();
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
        
        document.getElementById('geoLevel').addEventListener('change', (e) => {
            this.updateJoinColumnSuggestions(e.target.value);
        });
    }

    handleFile(file) {
        if (!file.name.endsWith('.csv')) {
            this.showError('Please upload a CSV file');
            return;
        }
        
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
        const stateFilter = document.getElementById('stateFilter').value;
        
        if (!geoLevel || !joinColumn || !dataColumn) {
            this.showError('Please select all required fields');
            return;
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
        
        const baseUrl = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services';
        
        const endpoints = {
            'county': `/USA_Counties_Generalized_Boundaries/FeatureServer/0`,
            'zip': `/USA_ZIP_Code_Tabulation_Areas_ZCTA5_2020/FeatureServer/0`,
            'tract': `/USA_Census_Tracts/FeatureServer/0`,
            'place': `/USA_Census_Populated_Places/FeatureServer/0`,
            'state': `/USA_States_Generalized/FeatureServer/0`
        };
        
        url = baseUrl + endpoints[geoLevel] + '/query';
        
        let where = '1=1';
        if (stateFilter && geoLevel !== 'state') {
            where = `STATE_NAME = '${this.getStateName(stateFilter)}' OR STUSPS = '${stateFilter}'`;
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
            const response = await fetch(`${url}?${params}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch geographic data: ${response.statusText}`);
            }
            this.geoData = await response.json();
            
            if (!this.geoData.features || this.geoData.features.length === 0) {
                const tigerUrl = this.getTigerUrl(geoLevel, year, stateFilter);
                const tigerResponse = await fetch(tigerUrl);
                if (!tigerResponse.ok) {
                    throw new Error('Failed to fetch from Census TIGER service');
                }
                this.geoData = await tigerResponse.json();
            }
        } catch (error) {
            console.error('Primary fetch failed, trying Census TIGER:', error);
            const tigerUrl = this.getTigerUrl(geoLevel, year, stateFilter);
            const response = await fetch(tigerUrl);
            this.geoData = await response.json();
        }
    }

    getTigerUrl(geoLevel, year, stateFilter) {
        const tigerBase = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb`;
        
        const tigerEndpoints = {
            'county': `/State_County/MapServer/1`,
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
        
        const csvMap = new Map();
        this.csvData.forEach(row => {
            const key = String(row[joinColumn]).trim();
            csvMap.set(key, row);
        });
        
        const geoIdFields = {
            'county': ['GEOID', 'FIPS', 'COUNTYFP'],
            'zip': ['ZCTA5CE20', 'ZCTA5CE10', 'GEOID20', 'GEOID10'],
            'tract': ['GEOID', 'TRACTCE', 'FIPS'],
            'place': ['GEOID', 'PLACEFP', 'PLACE_FIPS'],
            'state': ['STUSPS', 'STATE_NAME', 'STATE_ABBR']
        };
        
        const possibleFields = geoIdFields[geoLevel] || ['GEOID', 'FIPS'];
        
        this.mergedData = {
            type: 'FeatureCollection',
            features: []
        };
        
        let matchCount = 0;
        let noMatchCount = 0;
        
        this.geoData.features.forEach(feature => {
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
            }
        });
        
        console.log(`Matched: ${matchCount}, No match: ${noMatchCount}`);
        
        if (matchCount === 0) {
            throw new Error('No matches found. Please check that your join column contains valid geography identifiers.');
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
        
        this.map.fitBounds(this.currentLayer.getBounds());
        
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