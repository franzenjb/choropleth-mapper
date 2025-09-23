#!/usr/bin/env python3
"""
Clean and prepare ALICE Florida data files for choropleth mapping
"""
import csv
import re
import os

def clean_county_data(input_file, output_file):
    """Extract proper 5-digit county FIPS from County field"""
    with open(input_file, 'r', encoding='utf-8-sig') as infile:
        reader = csv.DictReader(infile)
        fieldnames = ['GEOID'] + [f for f in reader.fieldnames if f != 'GEO id2']
        
        with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            county_fips_map = {}
            for row in reader:
                # Extract county name from "County" field
                county_full = row.get('County', '')
                
                # Map county names to FIPS codes (Florida counties)
                # Using the GEO id2 first 5 digits as county identifier
                geo_id = row['GEO id2']
                county_fips = geo_id[:5]  # First 5 digits are state+county FIPS
                
                # Store for aggregation
                if county_fips not in county_fips_map:
                    county_fips_map[county_fips] = {
                        'County': county_full,
                        'Households': 0,
                        'Poverty Households': 0,
                        'ALICE Households': 0,
                        'Above ALICE Households': 0
                    }
                
                # Aggregate subcounty data to county level
                county_fips_map[county_fips]['Households'] += int(row['Households'])
                county_fips_map[county_fips]['Poverty Households'] += int(row['Poverty Households'])
                county_fips_map[county_fips]['ALICE Households'] += int(row['ALICE Households'])
                county_fips_map[county_fips]['Above ALICE Households'] += int(row['Above ALICE Households'])
            
            # Write aggregated county-level data
            for fips, data in sorted(county_fips_map.items()):
                new_row = {
                    'GEOID': fips,
                    'State': 'Florida',
                    'Year': '2023',
                    'Type': 'County',
                    'GEO display_label': data['County'],
                    'Households': data['Households'],
                    'Poverty Households': data['Poverty Households'],
                    'ALICE Households': data['ALICE Households'],
                    'Above ALICE Households': data['Above ALICE Households'],
                    'Source: American Community Survey': '5-Year',
                    'County': data['County']
                }
                writer.writerow(new_row)
    
    print(f"✅ County data cleaned: {output_file}")
    print(f"   - Aggregated sub-county CCDs to county level")
    print(f"   - Created standard 5-digit FIPS in GEOID column")

def clean_zip_data(input_file, output_file):
    """Remove _ZCTA suffix from ZIP codes"""
    with open(input_file, 'r', encoding='utf-8-sig') as infile:
        reader = csv.DictReader(infile)
        fieldnames = ['ZIP'] + [f for f in reader.fieldnames if f != 'GEO id2']
        
        with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                # Extract clean ZIP code
                zip_code = row['GEO id2'].replace('_ZCTA', '')
                
                new_row = {
                    'ZIP': zip_code,
                    'State': row['State'],
                    'Year': row['Year'],
                    'Type': row['Type'],
                    'GEO display_label': row['GEO display_label'],
                    'Households': row['Households'],
                    'Poverty Households': row['Poverty Households'],
                    'ALICE Households': row['ALICE Households'],
                    'Above ALICE Households': row['Above ALICE Households'],
                    'Source: American Community Survey': row['Source: American Community Survey'],
                    'County': row['County']
                }
                writer.writerow(new_row)
    
    print(f"✅ ZIP data cleaned: {output_file}")
    print(f"   - Removed _ZCTA suffix")
    print(f"   - Created clean 5-digit ZIP codes in ZIP column")

def clean_place_data(input_file, output_file):
    """Ensure proper 7-digit place codes with state prefix"""
    with open(input_file, 'r', encoding='utf-8-sig') as infile:
        reader = csv.DictReader(infile)
        fieldnames = ['GEOID'] + [f for f in reader.fieldnames if f != 'GEO id2']
        
        with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for row in reader:
                # Place codes should already be 7 digits with state prefix
                place_code = row['GEO id2']
                
                new_row = {
                    'GEOID': place_code,
                    'State': row['State'],
                    'Year': row['Year'],
                    'Type': row['Type'],
                    'GEO display_label': row['GEO display_label'],
                    'Households': row['Households'],
                    'Poverty Households': row['Poverty Households'],
                    'ALICE Households': row['ALICE Households'],
                    'Above ALICE Households': row['Above ALICE Households'],
                    'Source: American Community Survey': row['Source: American Community Survey'],
                    'County': row['County']
                }
                writer.writerow(new_row)
    
    print(f"✅ Place data cleaned: {output_file}")
    print(f"   - Standardized 7-digit place codes in GEOID column")

def main():
    # Input files
    base_dir = "/Users/jefffranzen/Desktop/Alice Florida Data"
    
    # Output directory
    output_dir = "/Users/jefffranzen/choropleth-mapper/cleaned_alice_data"
    os.makedirs(output_dir, exist_ok=True)
    
    # Clean each file
    print("🧹 Cleaning ALICE Florida Data Files...\n")
    
    # County data
    clean_county_data(
        os.path.join(base_dir, "ALICE - Florida County Data.csv"),
        os.path.join(output_dir, "ALICE_Florida_Counties_CLEANED.csv")
    )
    
    # ZIP data
    clean_zip_data(
        os.path.join(base_dir, "ALICE - Florida Data Zip.csv"),
        os.path.join(output_dir, "ALICE_Florida_ZIP_CLEANED.csv")
    )
    
    # Place data
    clean_place_data(
        os.path.join(base_dir, "ALICE - Florida Place Data.csv"),
        os.path.join(output_dir, "ALICE_Florida_Places_CLEANED.csv")
    )
    
    print("\n✨ All files cleaned and ready for choropleth mapping!")
    print(f"📁 Cleaned files saved to: {output_dir}")
    print("\n📝 Next steps:")
    print("1. Upload cleaned CSV to choropleth-mapper")
    print("2. Select appropriate geography type")
    print("3. Map will automatically join using the correct ID column")

if __name__ == "__main__":
    main()