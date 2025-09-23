#!/usr/bin/env python3
"""
Fix ALICE Florida ZIP Code CSV to have consistent structure
Adds a proper ZIP column for geographic joining
"""

import csv

# Read the original ZIP CSV
input_file = '/Users/jefffranzen/Desktop/Alice Florida Data/ALICE - Florida Data Zip.csv'
output_file = '/Users/jefffranzen/Desktop/Alice Florida Data/ALICE - Florida ZIP Fixed.csv'

with open(input_file, 'r', encoding='utf-8-sig') as infile:
    reader = csv.DictReader(infile)
    fieldnames = ['ZIP'] + reader.fieldnames  # Add ZIP as first column
    
    rows = []
    for row in reader:
        # Extract ZIP code from GEO display_label
        zip_code = row['GEO display_label']
        new_row = {'ZIP': zip_code}
        new_row.update(row)
        rows.append(new_row)

# Write the fixed CSV
with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Created fixed ZIP file: {output_file}")
print(f"Added ZIP column with {len(rows)} ZIP codes")