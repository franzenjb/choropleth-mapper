#!/usr/bin/env python3
"""
Simple GIS Database API Server
Serves your 3.2GB geospatial database to both Choropleth Mapper and Universal Tool
Super simple to start - just run: python3 gis-api-server.py
"""

import os
import json
import sys
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd

# Simple Flask app
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

# Configuration
DATA_DIR = Path(__file__).parent / 'data'
PORT = 5000

# Your database datasets
DATASETS = {
    'counties': {
        'file': 'us_counties.json',
        'description': 'US Counties (3,221 features)',
        'size': '2.95MB',
        'join_fields': ['FIPS', 'GEOID', 'NAME', 'COUNTY']
    },
    'zips': {
        'file': 'us_zips_full.json',
        'description': 'ZIP Codes (33,092 features)',
        'size': '27.03MB',
        'join_fields': ['ZIP', 'GEOID', 'ZCTA5CE10']
    },
    'places': {
        'file': 'us_places.json',
        'description': 'Places/Cities (Sample)',
        'size': '314.46MB',
        'join_fields': ['GEOID', 'NAME', 'NAMELSAD']
    },
    'tracts': {
        'file': 'us_census_tracts.json',
        'description': 'Census Tracts (Sample)',
        'size': '696.49MB',
        'join_fields': ['GEOID', 'TRACTCE', 'NAME']
    },
    'blockgroups': {
        'file': 'us_block_groups.json',
        'description': 'Block Groups (Sample)',
        'size': '1779.64MB',
        'join_fields': ['GEOID', 'BLKGRPCE', 'NAMELSAD']
    },
    'states': {
        'file': 'us_states.json',
        'description': 'US States (52 features)',
        'size': '0.09MB',
        'join_fields': ['NAME', 'id']
    }
}

@app.route('/')
def home():
    """API Status and Documentation"""
    return jsonify({
        'name': 'GIS Database API',
        'status': 'running',
        'version': '1.0.0',
        'description': 'Serves 3.2GB geospatial database to choropleth tools',
        'endpoints': {
            '/api/datasets': 'List available datasets',
            '/api/geography/{type}': 'Get geography data',
            '/api/inventory': 'Database inventory',
            '/api/analyze-csv': 'Analyze CSV for joins'
        },
        'datasets': len(DATASETS),
        'data_size': '3.2GB'
    })

@app.route('/api/datasets')
def list_datasets():
    """List all available datasets"""
    return jsonify({
        'datasets': DATASETS,
        'count': len(DATASETS),
        'total_size': '3.2GB'
    })

@app.route('/api/geography/<geo_type>')
def get_geography(geo_type):
    """Get geography data by type"""
    if geo_type not in DATASETS:
        return jsonify({
            'error': f'Dataset "{geo_type}" not found',
            'available': list(DATASETS.keys())
        }), 404
    
    try:
        file_path = DATA_DIR / DATASETS[geo_type]['file']
        
        if not file_path.exists():
            return jsonify({
                'error': f'Data file not found: {file_path}',
                'dataset': DATASETS[geo_type]
            }), 404
        
        # Load the data
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        # Filter by state if requested
        state_filter = request.args.get('state')
        if state_filter and 'features' in data:
            original_count = len(data['features'])
            data['features'] = [
                feature for feature in data['features']
                if matches_state(feature, state_filter)
            ]
            filtered_count = len(data['features'])
            
            # Add metadata about filtering
            if 'metadata' not in data:
                data['metadata'] = {}
            data['metadata']['filtered'] = True
            data['metadata']['state_filter'] = state_filter
            data['metadata']['original_count'] = original_count
            data['metadata']['filtered_count'] = filtered_count
        
        # Add dataset info
        if 'metadata' not in data:
            data['metadata'] = {}
        data['metadata']['dataset_info'] = DATASETS[geo_type]
        data['metadata']['geography_type'] = geo_type
        
        return jsonify(data)
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to load dataset: {str(e)}',
            'dataset': geo_type
        }), 500

def matches_state(feature, state_filter):
    """Check if feature matches state filter"""
    props = feature.get('properties', {})
    
    # Try different state field names
    state_fields = ['STATEFP', 'STATEFP10', 'STATEFP20', 'STATE', 'state']
    name_fields = ['STATE_NAME', 'state_name', 'State', 'NAME']
    
    # FIPS code matching (2 digits)
    if len(state_filter) == 2 and state_filter.isdigit():
        for field in state_fields:
            if props.get(field) == state_filter:
                return True
    
    # Name matching
    state_lower = state_filter.lower()
    for field in name_fields:
        if props.get(field) and state_lower in props[field].lower():
            return True
    
    return False

@app.route('/api/inventory')
def get_inventory():
    """Get database inventory"""
    try:
        inventory_path = Path(__file__).parent / 'gis_inventory.csv'
        
        if inventory_path.exists():
            df = pd.read_csv(inventory_path)
            return jsonify({
                'inventory': df.to_dict('records'),
                'count': len(df),
                'source': 'gis_inventory.csv'
            })
        else:
            # Return dataset definitions if inventory file not found
            return jsonify({
                'inventory': DATASETS,
                'count': len(DATASETS),
                'source': 'internal_definitions'
            })
    
    except Exception as e:
        return jsonify({
            'error': f'Failed to load inventory: {str(e)}',
            'fallback': DATASETS
        }), 500

@app.route('/api/analyze-csv', methods=['POST'])
def analyze_csv():
    """Analyze uploaded CSV for geographic field detection"""
    try:
        # Get CSV data from request
        csv_data = request.get_json()
        
        if not csv_data or 'data' not in csv_data:
            return jsonify({'error': 'No CSV data provided'}), 400
        
        rows = csv_data['data']
        if not rows:
            return jsonify({'error': 'Empty CSV data'}), 400
        
        headers = list(rows[0].keys())
        suggestions = []
        detected_fields = {}
        
        # Geographic field detection patterns
        patterns = {
            'fips': r'(?i)^(fips|geoid|county_fips|cnty_fips|fips_code)$',
            'zip': r'(?i)^(zip|zipcode|zip_code|postal|zcta|zcta5)$',
            'state_fips': r'(?i)^(state_fips|statefp|state_id)$',
            'state_name': r'(?i)^(state|state_name|st|state_abbr)$',
            'county_name': r'(?i)^(county|county_name|cnty|cnty_name)$',
            'place_name': r'(?i)^(place|city|place_name|city_name|municipality)$',
            'tract': r'(?i)^(tract|tractce|census_tract|tract_id)$'
        }
        
        import re
        
        for header in headers:
            for field_type, pattern in patterns.items():
                if re.match(pattern, header):
                    detected_fields[field_type] = header
                    
                    # Generate suggestions
                    if field_type in ['fips', 'county_name']:
                        suggestions.append({
                            'geography': 'counties',
                            'confidence': 0.9,
                            'field': header,
                            'dataset': DATASETS['counties']
                        })
                    elif field_type == 'zip':
                        suggestions.append({
                            'geography': 'zips',
                            'confidence': 0.95,
                            'field': header,
                            'dataset': DATASETS['zips']
                        })
                    elif field_type == 'tract':
                        suggestions.append({
                            'geography': 'tracts',
                            'confidence': 0.85,
                            'field': header,
                            'dataset': DATASETS['tracts']
                        })
        
        return jsonify({
            'suggestions': suggestions,
            'detected_fields': detected_fields,
            'total_rows': len(rows),
            'headers': headers,
            'recommendations': [
                f"Found {len(suggestions)} potential geographic join(s)" if suggestions
                else "No geographic identifiers detected"
            ]
        })
        
    except Exception as e:
        return jsonify({
            'error': f'Failed to analyze CSV: {str(e)}'
        }), 500

@app.route('/data/<path:filename>')
def serve_data_file(filename):
    """Serve data files directly"""
    return send_from_directory(DATA_DIR, filename)

def check_data_directory():
    """Check if data directory exists and has files"""
    if not DATA_DIR.exists():
        print(f"❌ Data directory not found: {DATA_DIR}")
        print(f"   Please ensure data directory exists at: {DATA_DIR}")
        return False
    
    missing_files = []
    for dataset_id, info in DATASETS.items():
        file_path = DATA_DIR / info['file']
        if not file_path.exists():
            missing_files.append(info['file'])
    
    if missing_files:
        print(f"⚠️  Some data files are missing:")
        for file in missing_files:
            print(f"   - {file}")
        print(f"   API will still work, but these datasets won't be available")
    
    return True

if __name__ == '__main__':
    print("🚀 Starting GIS Database API Server...")
    print(f"📁 Data directory: {DATA_DIR}")
    print(f"🌐 Server will run on: http://localhost:{PORT}")
    print("=" * 50)
    
    # Check data directory
    if not check_data_directory():
        sys.exit(1)
    
    print("✅ Data directory check complete")
    print(f"📊 Serving {len(DATASETS)} datasets")
    print("=" * 50)
    print("🎯 USAGE:")
    print("   Open browser to: http://localhost:5000")
    print("   API endpoints available at /api/*")
    print("   Press Ctrl+C to stop")
    print("=" * 50)
    
    try:
        app.run(
            host='0.0.0.0',  # Allow connections from other tools
            port=PORT,
            debug=False,     # Set to True for development
            threaded=True    # Handle multiple requests
        )
    except KeyboardInterrupt:
        print("\n👋 GIS API Server stopped")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)