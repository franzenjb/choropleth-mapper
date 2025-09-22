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

## 🐛 Known Issues & Workarounds
- **Map shows ocean instead of data**: Click the green "Zoom to Features" button
- **Some features don't match**: Ensure your GEOID/ZIP codes are formatted correctly

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