#!/usr/bin/env python3
"""Debug data matching issues"""

import json
import csv

# Check ZIP data
print("="*60)
print("CHECKING ZIP CODE DATA")
print("="*60)

with open('data/us_zips_full.json', 'r') as f:
    zip_data = json.load(f)
    print(f"Total ZIP features: {len(zip_data['features'])}")
    
    # Check first few features
    print("\nFirst 3 ZIP code properties:")
    for i, feature in enumerate(zip_data['features'][:3]):
        print(f"  Feature {i}: {feature['properties']}")

# Check test CSV
print("\nTest CSV ZIP codes:")
with open('test_zip.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(f"  {row}")

print("\n" + "="*60)
print("CHECKING COUNTY DATA")
print("="*60)

with open('data/us_counties.json', 'r') as f:
    county_data = json.load(f)
    print(f"Total County features: {len(county_data['features'])}")
    
    # Find Maine counties (FIPS starts with 23)
    maine_counties = [f for f in county_data['features'] 
                      if f['properties'].get('id', '').startswith('23')]
    
    print(f"\nMaine counties found: {len(maine_counties)}")
    print("First 3 Maine county properties:")
    for i, feature in enumerate(maine_counties[:3]):
        print(f"  {feature['properties'].get('id')}: {feature['properties'].get('NAME')}")

print("\nTest CSV County FIPS:")
with open('test_county.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        print(f"  {row['County_FIPS']}: {row['County_Name']}")

print("\n" + "="*60)
print("CHECKING STATE DATA")  
print("="*60)

with open('data/us_states.json', 'r') as f:
    state_data = json.load(f)
    print(f"Total State features: {len(state_data['features'])}")
    
    # Check New England states
    ne_states = ['Maine', 'New Hampshire', 'Vermont', 'Massachusetts', 'Connecticut', 'Rhode Island']
    for state_name in ne_states:
        found = any(state_name.lower() in str(f['properties']).lower() 
                   for f in state_data['features'])
        print(f"  {state_name}: {'✓ Found' if found else '✗ Not found'}")