# Choropleth Mapper - CSV to ArcGIS

## 🎯 Problem Solved
Eliminates the tedious process of manually creating choropleth maps in ArcGIS Pro by:
- Automatically fetching geographic boundaries (counties, ZIP codes, places)
- Performing table joins between your data and geography
- Exporting ArcGIS-ready files (GeoJSON/Shapefile)

## 🚀 What It Does
1. **Upload** your CSV with data (population, percentages, etc.)
2. **Automatically fetches** the correct map boundaries from Census/ArcGIS APIs
3. **Joins** your data to those boundaries (no manual work!)
4. **Creates** an interactive choropleth map for preview
5. **Exports** to GeoJSON/Shapefile for direct import into ArcGIS Online or ArcGIS Pro

## 📊 Data Format Requirements

### For County Data:
- Column name: `GEOID`
- Format: 5-digit FIPS codes (e.g., 12001 for Alachua County, FL)

### For ZIP Code Data:
- Column name: `ZIP`
- Format: 5-digit ZIP codes (e.g., 32003)

### For Place/City Data:
- Column name: `GEOID`
- Format: 7-digit place codes (e.g., 1200950 for Jacksonville)

## 💡 Key Features
- **No more manual table joins** in ArcGIS Pro
- **No more searching** for base map layers
- **Automatic geographic boundary fetching** from official sources
- **Interactive preview** before export
- **Direct ArcGIS compatibility** - outputs work immediately in ArcGIS

## 🛠️ Technical Details
- Uses Census TIGER and ArcGIS REST APIs for geographic boundaries
- Leaflet.js for interactive map preview
- Supports county, ZIP code, census tract, and place geographies
- Exports to multiple formats (GeoJSON, Shapefile)

## 📈 Use Cases
- ALICE data visualization (Asset Limited, Income Constrained, Employed)
- Demographic analysis and mapping
- Economic indicators by geography
- Any data that needs to be mapped to US geographic boundaries

## 🧹 Data Preparation Guide for ALICE Data

### Common Issues with Raw ALICE Data Files

When working with ALICE data from United for ALICE, you'll encounter these common formatting issues that need to be fixed BEFORE uploading:

#### County Data Issues:
- **Problem**: Raw data contains 10-digit Census County Division codes (sub-county level)
- **Example**: `1200191248` (Gainesville CCD, Alachua County)
- **Solution**: Aggregate to county level using first 5 digits as county FIPS

#### ZIP Code Data Issues:
- **Problem**: ZIP codes have `_ZCTA` suffix
- **Example**: `32003_ZCTA`
- **Solution**: Remove the `_ZCTA` suffix to get clean 5-digit ZIP codes

#### Place Data Issues:
- **Problem**: Place codes may need standardization
- **Example**: `1207300` (Boca Raton city)
- **Solution**: Ensure 7-digit format with state FIPS prefix

### Using the Data Cleaning Script

A Python script `clean_alice_data.py` is included to automatically fix these issues:

```bash
python3 clean_alice_data.py
```

This script will:
1. **County Data**: Aggregate sub-county CCDs to county level with proper 5-digit FIPS
2. **ZIP Data**: Remove `_ZCTA` suffix for clean ZIP codes
3. **Place Data**: Standardize 7-digit place codes

#### Input Files Expected:
```
/Users/jefffranzen/Desktop/Alice Florida Data/
├── ALICE - Florida County Data.csv
├── ALICE - Florida Data Zip.csv
└── ALICE - Florida Place Data.csv
```

#### Output Files Created:
```
/Users/jefffranzen/choropleth-mapper/cleaned_alice_data/
├── ALICE_Florida_Counties_CLEANED.csv  (GEOID column with 5-digit FIPS)
├── ALICE_Florida_ZIP_CLEANED.csv       (ZIP column with 5-digit ZIPs)
└── ALICE_Florida_Places_CLEANED.csv    (GEOID column with 7-digit codes)
```

### After Cleaning:
1. Upload the cleaned CSV file to the choropleth mapper
2. Select the appropriate geography type
3. The mapper will automatically detect the correct ID column
4. Generate your choropleth map!

## 🐛 Known Issues & Workarounds
- **Map shows ocean instead of data**: Click the green "Zoom to Features" button
- **Some features don't match**: Ensure your GEOID/ZIP codes are formatted correctly
- **Raw ALICE data won't join**: Use the `clean_alice_data.py` script first

## 🎓 Why This Matters
Previously, creating a choropleth map required:
1. Finding the right base layer in ArcGIS Pro
2. Importing your CSV
3. Manually setting up table joins
4. Configuring symbology
5. Dealing with projection issues

Now it's just: Upload CSV → Process → Export to ArcGIS ✅

---
Created by Jeff Franzen | Powered by Census TIGER & ArcGIS APIs