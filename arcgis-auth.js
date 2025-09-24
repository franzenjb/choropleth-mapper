// ArcGIS OAuth2 Authentication and Feature Layer Creation
class ArcGISIntegration {
    constructor() {
        // ArcGIS Online OAuth2 settings
        this.clientId = null; // Will be set from config
        this.redirectUri = window.location.origin + window.location.pathname;
        this.portal = 'https://www.arcgis.com';
        this.token = null;
        this.username = null;
        
        // Check for token in URL (OAuth callback)
        this.checkForToken();
    }
    
    // Initialize with client ID (store in separate config file for security)
    init(clientId) {
        this.clientId = clientId;
        
        // Add login button handler
        const arcgisBtn = document.getElementById('exportArcGIS');
        if (arcgisBtn) {
            arcgisBtn.addEventListener('click', () => this.handleArcGISExport());
        }
    }
    
    // Check if we're returning from OAuth login
    checkForToken() {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            // Parse the token from URL
            const params = new URLSearchParams(hash.substring(1));
            this.token = params.get('access_token');
            this.username = params.get('username');
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Store token temporarily (expires in 30 mins by default)
            sessionStorage.setItem('arcgis_token', this.token);
            sessionStorage.setItem('arcgis_username', this.username);
            
            console.log('ArcGIS authentication successful for:', this.username);
            
            // Check if we have pending data to upload
            const pendingData = sessionStorage.getItem('pending_arcgis_data');
            if (pendingData) {
                this.uploadToArcGIS(JSON.parse(pendingData));
                sessionStorage.removeItem('pending_arcgis_data');
            }
        } else {
            // Check for stored token
            this.token = sessionStorage.getItem('arcgis_token');
            this.username = sessionStorage.getItem('arcgis_username');
        }
    }
    
    // Handle ArcGIS export button click
    handleArcGISExport() {
        // Check if we have a choropleth mapper instance with data
        if (!window.choroplethMapper || !window.choroplethMapper.mergedData) {
            this.showMessage('No data to export. Please generate a map first.', 'error');
            return;
        }
        
        // If no client ID configured, show setup instructions
        if (!this.clientId) {
            this.showSetupInstructions();
            return;
        }
        
        // If not authenticated, start OAuth flow
        if (!this.token) {
            // Store data for after authentication
            sessionStorage.setItem('pending_arcgis_data', JSON.stringify(window.choroplethMapper.mergedData));
            this.startOAuthFlow();
        } else {
            // Already authenticated, upload directly
            this.uploadToArcGIS(window.choroplethMapper.mergedData);
        }
    }
    
    // Start OAuth2 authentication flow
    startOAuthFlow() {
        const authUrl = `${this.portal}/sharing/rest/oauth2/authorize?` +
            `client_id=${this.clientId}&` +
            `response_type=token&` +
            `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
            `expiration=30`;
        
        // Redirect to ArcGIS login (will show 2FA if enabled)
        window.location.href = authUrl;
    }
    
    // Upload GeoJSON to ArcGIS as feature layer
    async uploadToArcGIS(geojsonData) {
        try {
            this.showMessage('Uploading to ArcGIS Online...', 'info');
            
            // Step 1: Add item to ArcGIS Online
            const addItemUrl = `${this.portal}/sharing/rest/content/users/${this.username}/addItem`;
            
            // Prepare the feature collection
            const featureCollection = {
                layers: [{
                    layerDefinition: {
                        name: 'Choropleth Data',
                        geometryType: this.getGeometryType(geojsonData),
                        objectIdField: 'OBJECTID',
                        fields: this.generateFields(geojsonData),
                        drawingInfo: this.generateRenderer(geojsonData)
                    },
                    featureSet: {
                        features: this.convertToEsriFeatures(geojsonData),
                        geometryType: this.getGeometryType(geojsonData)
                    }
                }]
            };
            
            const formData = new FormData();
            formData.append('f', 'json');
            formData.append('token', this.token);
            formData.append('title', `Choropleth Map ${new Date().toLocaleDateString()}`);
            formData.append('type', 'Feature Collection');
            formData.append('text', JSON.stringify(featureCollection));
            formData.append('tags', 'choropleth,redcross,mapping');
            
            const response = await fetch(addItemUrl, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                const itemUrl = `${this.portal}/home/item.html?id=${result.id}`;
                this.showMessage(
                    `Success! Feature layer created. <a href="${itemUrl}" target="_blank">Open in ArcGIS Online</a>`,
                    'success'
                );
                
                // Open in new tab
                window.open(itemUrl, '_blank');
            } else {
                throw new Error(result.error?.message || 'Failed to create feature layer');
            }
            
        } catch (error) {
            console.error('ArcGIS upload error:', error);
            this.showMessage(`Error uploading to ArcGIS: ${error.message}`, 'error');
        }
    }
    
    // Convert GeoJSON to Esri features
    convertToEsriFeatures(geojsonData) {
        return geojsonData.features.map((feature, index) => ({
            attributes: {
                OBJECTID: index + 1,
                ...feature.properties
            },
            geometry: this.convertGeometry(feature.geometry)
        }));
    }
    
    // Convert GeoJSON geometry to Esri format
    convertGeometry(geometry) {
        if (geometry.type === 'Polygon') {
            return {
                rings: geometry.coordinates
            };
        } else if (geometry.type === 'MultiPolygon') {
            return {
                rings: geometry.coordinates.flat(1)
            };
        }
        return geometry;
    }
    
    // Get Esri geometry type
    getGeometryType(geojsonData) {
        const firstGeom = geojsonData.features[0]?.geometry;
        if (!firstGeom) return 'esriGeometryPolygon';
        
        const typeMap = {
            'Point': 'esriGeometryPoint',
            'MultiPoint': 'esriGeometryMultipoint',
            'LineString': 'esriGeometryPolyline',
            'MultiLineString': 'esriGeometryPolyline',
            'Polygon': 'esriGeometryPolygon',
            'MultiPolygon': 'esriGeometryPolygon'
        };
        
        return typeMap[firstGeom.type] || 'esriGeometryPolygon';
    }
    
    // Generate field definitions
    generateFields(geojsonData) {
        const fields = [
            {
                name: 'OBJECTID',
                type: 'esriFieldTypeOID',
                alias: 'OBJECTID'
            }
        ];
        
        // Add fields from first feature
        const sampleProps = geojsonData.features[0]?.properties || {};
        for (const [key, value] of Object.entries(sampleProps)) {
            fields.push({
                name: key,
                type: typeof value === 'number' ? 'esriFieldTypeDouble' : 'esriFieldTypeString',
                alias: key,
                length: typeof value === 'string' ? 255 : undefined
            });
        }
        
        return fields;
    }
    
    // Generate renderer for choropleth
    generateRenderer(geojsonData) {
        // Get choropleth values
        const values = geojsonData.features
            .map(f => f.properties.choropleth_value)
            .filter(v => v != null && !isNaN(v));
        
        if (values.length === 0) {
            return null;
        }
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        return {
            renderer: {
                type: 'classBreaks',
                field: 'choropleth_value',
                minValue: min,
                classBreakInfos: this.generateClassBreaks(min, max)
            }
        };
    }
    
    // Generate class breaks for renderer
    generateClassBreaks(min, max) {
        const colors = [
            [255, 245, 240],
            [254, 224, 210],
            [252, 187, 161],
            [252, 146, 114],
            [239, 59, 44]
        ];
        
        const breaks = [];
        const range = max - min;
        const step = range / 5;
        
        for (let i = 0; i < 5; i++) {
            breaks.push({
                minValue: min + (step * i),
                maxValue: min + (step * (i + 1)),
                symbol: {
                    type: 'esriSFS',
                    style: 'esriSFSSolid',
                    color: colors[i],
                    outline: {
                        color: [110, 110, 110],
                        width: 0.5
                    }
                },
                label: `${(min + (step * i)).toFixed(0)} - ${(min + (step * (i + 1))).toFixed(0)}`
            });
        }
        
        return breaks;
    }
    
    // Show setup instructions
    showSetupInstructions() {
        const message = `
            <strong>ArcGIS OAuth Setup Required:</strong><br><br>
            To enable direct upload to ArcGIS Online:<br><br>
            1. Register an app at <a href="https://developers.arcgis.com" target="_blank">developers.arcgis.com</a><br>
            2. Add redirect URL: <code>${this.redirectUri}</code><br>
            3. Create file <code>arcgis-config.js</code> with:<br>
            <pre style="background:#f5f5f5;padding:10px;margin:10px 0;">
// arcgis-config.js
const ARCGIS_CLIENT_ID = 'your-client-id-here';
if (window.arcgisIntegration) {
    window.arcgisIntegration.init(ARCGIS_CLIENT_ID);
}</pre>
            4. Add to index.html before closing body tag:<br>
            <code>&lt;script src="arcgis-config.js"&gt;&lt;/script&gt;</code><br><br>
            <em>For now, use "Export GeoJSON" and upload manually.</em>
        `;
        
        this.showMessage(message, 'info', 20000);
    }
    
    // Show message to user
    showMessage(message, type = 'info', duration = 10000) {
        const errorDiv = document.getElementById('error');
        if (!errorDiv) return;
        
        errorDiv.innerHTML = message;
        
        // Style based on type
        const styles = {
            'info': {
                background: '#d1ecf1',
                color: '#004085',
                border: '1px solid #bee5eb'
            },
            'success': {
                background: '#d4edda',
                color: '#155724',
                border: '1px solid #c3e6cb'
            },
            'error': {
                background: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb'
            }
        };
        
        const style = styles[type] || styles['info'];
        errorDiv.style.background = style.background;
        errorDiv.style.color = style.color;
        errorDiv.style.border = style.border;
        errorDiv.classList.remove('hidden');
        
        if (duration > 0) {
            setTimeout(() => {
                errorDiv.classList.add('hidden');
            }, duration);
        }
    }
}

// Initialize ArcGIS integration
window.arcgisIntegration = new ArcGISIntegration();

// Make it available to choropleth mapper
if (window.choroplethMapper) {
    window.choroplethMapper.arcgisIntegration = window.arcgisIntegration;
}