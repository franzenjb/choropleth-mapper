#!/usr/bin/env python3
"""
Download and prepare geographic boundary data for local use
This creates optimized GeoJSON files for ZIP codes, counties, and states
"""

import json
import requests
import os

def download_and_save(url, filename, property_mappings=None, id_field=None):
    """Download GeoJSON and save with standardized properties"""
    print(f"Downloading {filename}...")
    
    response = requests.get(url)
    response.raise_for_status()
    
    data = response.json()
    
    # For counties dataset, the 'id' is at the feature level, not in properties
    if id_field == 'feature_id':
        for feature in data['features']:
            if 'id' in feature:
                feature['properties']['id'] = feature['id']
                feature['properties']['GEOID'] = feature['id']
                feature['properties']['FIPS'] = feature['id']
    
    # Standardize property names if mapping provided
    if property_mappings:
        for feature in data['features']:
            # Create standardized properties
            std_props = {}
            for std_name, source_names in property_mappings.items():
                for source_name in source_names:
                    if source_name in feature['properties']:
                        std_props[std_name] = feature['properties'][source_name]
                        break
            
            # Preserve original properties and add standardized ones
            feature['properties'].update(std_props)
    
    # Save to file
    filepath = f"data/{filename}"
    os.makedirs("data", exist_ok=True)
    
    with open(filepath, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    
    print(f"  ✓ Saved {len(data['features'])} features to {filepath}")
    file_size = os.path.getsize(filepath) / (1024 * 1024)
    print(f"  ✓ File size: {file_size:.1f} MB")
    
    return data

def create_simplified_zips():
    """Create a simplified ZIP code dataset focused on New England and commonly used states"""
    print("\nCreating simplified ZIP code datasets...")
    
    # Download full US ZIP codes
    url = "https://raw.githubusercontent.com/ndrezn/zip-code-geojson/main/usa_zip_codes_geo_26m.json"
    
    print("Downloading full US ZIP codes...")
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()
    
    # Standardize properties
    for feature in data['features']:
        props = feature['properties']
        # Add standardized fields
        props['GEOID'] = props.get('ZCTA5CE10', '')
        props['NAME'] = props.get('ZCTA5CE10', '')
        props['ZIP'] = props.get('ZCTA5CE10', '')
    
    # Save full dataset
    os.makedirs("data", exist_ok=True)
    with open("data/us_zips_full.json", 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    
    size_mb = os.path.getsize("data/us_zips_full.json") / (1024 * 1024)
    print(f"  ✓ Saved full US ZIP codes: {len(data['features'])} features, {size_mb:.1f} MB")
    
    # Create New England subset
    ne_states = ['ME', 'NH', 'VT', 'MA', 'CT', 'RI']
    ne_features = [f for f in data['features'] 
                   if any(f['properties'].get('STATEFP10', '').startswith(code) 
                         for code in ['23', '33', '50', '25', '09', '44'])]
    
    ne_data = {
        'type': 'FeatureCollection',
        'features': ne_features
    }
    
    with open("data/ne_zips.json", 'w') as f:
        json.dump(ne_data, f, separators=(',', ':'))
    
    size_mb = os.path.getsize("data/ne_zips.json") / (1024 * 1024)
    print(f"  ✓ Saved New England ZIP codes: {len(ne_features)} features, {size_mb:.1f} MB")

def main():
    print("="*60)
    print("PREPARING GEOGRAPHIC DATA FOR LOCAL USE")
    print("="*60)
    
    # Create data directory
    os.makedirs("data", exist_ok=True)
    
    # 1. US States
    print("\n1. US STATES")
    states_url = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
    download_and_save(states_url, "us_states.json", {
        'GEOID': ['id'],
        'NAME': ['name'],
        'STUSPS': ['id']  # State abbreviation
    })
    
    # 2. US Counties  
    print("\n2. US COUNTIES")
    counties_url = "https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json"
    # Note: This dataset has 'id' at the feature level, not in properties
    download_and_save(counties_url, "us_counties.json", {
        'GEOID': ['id', 'GEOID'],
        'NAME': ['NAME'],
        'STATE': ['STATE'],
        'COUNTY': ['COUNTY'],
        'FIPS': ['id']  # Ensure FIPS is set from id
    }, id_field='feature_id')
    
    # 3. ZIP Codes
    print("\n3. ZIP CODES")
    create_simplified_zips()
    
    print("\n" + "="*60)
    print("✅ GEOGRAPHIC DATA PREPARATION COMPLETE!")
    print("="*60)
    print("\nData files created in 'data/' directory:")
    print("  - us_states.json      (50 states + DC + territories)")
    print("  - us_counties.json    (3,000+ counties)")
    print("  - us_zips_full.json   (33,000+ ZIP codes)")
    print("  - ne_zips.json        (New England ZIP codes only)")
    print("\nThese files can now be served locally for instant access!")

if __name__ == "__main__":
    main()