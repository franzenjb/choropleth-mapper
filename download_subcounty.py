#!/usr/bin/env python3
"""
Download Census County Subdivisions (CCDs/MCDs) data
These are sub-county geographic units used in many states
"""

import json
import requests
import os

def download_subcounties():
    """Download subcounty/CCD boundaries"""
    print("Downloading US County Subdivisions (CCDs/MCDs)...")
    
    # Use Census TIGER API for county subdivisions
    # Note: This may need to be done state-by-state for manageable size
    
    # For now, let's get New England states as an example
    ne_states = {
        'ME': '23',  # Maine
        'NH': '33',  # New Hampshire
        'VT': '50',  # Vermont
        'MA': '25',  # Massachusetts
        'CT': '09',  # Connecticut
        'RI': '44'   # Rhode Island
    }
    
    all_features = []
    
    for state_abbr, state_fips in ne_states.items():
        print(f"  Fetching {state_abbr} county subdivisions...")
        
        # TIGER API endpoint for county subdivisions
        url = f"https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/17/query"
        
        params = {
            'where': f"STATE = '{state_fips}'",
            'outFields': '*',
            'f': 'geojson',
            'outSR': '4326',
            'returnGeometry': 'true'
        }
        
        try:
            response = requests.get(url, params=params)
            if response.ok:
                data = response.json()
                if 'features' in data:
                    # Standardize properties
                    for feature in data['features']:
                        props = feature.get('properties', {})
                        # Add standardized GEOID
                        if 'GEOID' not in props and 'COUSUBFP' in props and 'STATEFP' in props and 'COUNTYFP' in props:
                            props['GEOID'] = props['STATEFP'] + props['COUNTYFP'] + props['COUSUBFP']
                        # Add state for reference
                        props['STATE_ABBR'] = state_abbr
                    
                    all_features.extend(data['features'])
                    print(f"    Added {len(data['features'])} features")
            else:
                print(f"    Failed to fetch: {response.status_code}")
        except Exception as e:
            print(f"    Error: {e}")
    
    # Save to file
    if all_features:
        geojson = {
            'type': 'FeatureCollection',
            'features': all_features
        }
        
        os.makedirs('data', exist_ok=True)
        with open('data/ne_subcounties.json', 'w') as f:
            json.dump(geojson, f, separators=(',', ':'))
        
        file_size = os.path.getsize('data/ne_subcounties.json') / (1024 * 1024)
        print(f"\n✓ Saved {len(all_features)} subcounty features")
        print(f"✓ File size: {file_size:.1f} MB")
        print(f"✓ Saved to: data/ne_subcounties.json")
    else:
        print("\n✗ No subcounty data retrieved")

if __name__ == "__main__":
    download_subcounties()