# Choropleth Mapper - CSV to ArcGIS

## 🎯 Problem Solved - Save Time & Money!

### 💰 Cost & Complexity Eliminated:

#### ❌ **What You NO LONGER Need:**

**ArcGIS Pro License**
- Cost: ~$700/year
- Learning curve: Weeks to months
- Manual table joins required
- Complex projection management
- Time per map: 1-2 hours

**ArcGIS Online Credits**
- Geocoding credits consumed
- Spatial analysis credits
- Data enrichment credits  
- Monthly subscription fees
- Storage costs

#### ✅ **What This FREE Tool Does Instead:**

- **Automatic Joins** - Upload CSV → Select geography → Done!
- **Free Boundary Data** - Fetches from Census TIGER & ArcGIS REST APIs (no credits!)
- **Instant Preview** - See your choropleth map immediately
- **Direct Export** - Download GeoJSON/Shapefile ready for ArcGIS
- **Time per map: 2 minutes**

### 📊 **Cost Comparison:**

| Task | ArcGIS Pro/Online | This Tool |
|------|------------------|-----------|
| Software License | $700/year | **FREE** |
| Table Joins | Manual setup + training | **Automatic** |
| Base Layer Data | Find/download/import | **Auto-fetched** |
| Credits for Processing | 100-500 credits | **ZERO** |
| Learning Curve | Weeks/months | **5 minutes** |
| Time per Map | 1-2 hours | **2 minutes** |

## 🚀 What It Does
1. **Upload** your CSV with data (population, percentages, etc.)
2. **Automatically fetches** the correct map boundaries from Census/ArcGIS APIs
3. **Joins** your data to those boundaries (no manual work!)
4. **Creates** an interactive choropleth map for preview
5. **Exports** to GeoJSON/Shapefile for direct import into ArcGIS Online or ArcGIS Pro

## ⚠️ API Limits & Large Datasets

### Current Limits by Geography Type:
| Geography | Typical Count | API Limit | States Affected |
|-----------|--------------|-----------|-----------------|
| **Counties** | 50-250 per state | 2,000 | ✅ All states work |
| **Places** | 200-1,800 per state | 2,000 | ⚠️ California (1,800) close to limit |
| **ZIP Codes** | 200-2,600 per state | 2,000 | ❌ California (2,600), Texas (2,000+) exceed limit |
| **Census Tracts** | 1,000-8,000 per state | 2,000 | ❌ Most large states exceed limit |
| **Sub-counties** | 100-500 per state | 2,000 | ✅ All states work |

### Automatic Handling:
- **Auto-detects states** from FIPS codes and fetches only needed boundaries
- **Multi-state support** works for up to 10 states combined (if under 2,000 total features)
- **Batch processing** for large datasets (California ZIPs, census tracts) - automatically splits requests

### Manual Solutions if Limits Exceeded:
1. **Use state filter** - Select specific state to reduce data
2. **Split your CSV** - Process by regions or counties
3. **Use county-level** instead of tract-level for large area analysis

## 📊 Data Format Requirements

### For County Data:
- Column name: `GEOID`
- Format: 5-digit FIPS codes (e.g., 12001 for Alachua County, FL)

### For ZIP Code Data:
- Column name: `ZIP`, `Zip`, `zip`, `zipcode`, `zip_code` (any case works!)
- Format: 5-digit ZIP codes (e.g., 32003)
- **Handles Excel issues automatically:**
  - New England ZIPs that lost leading zeros: 2134 → 02134
  - Puerto Rico/VI ZIPs: 601 → 00601
  - Maine examples: 4011 → 04011, 3903 → 03903

### For Place/City Data:
- Column name: `GEOID`
- Format: 7-digit place codes (e.g., 1200950 for Jacksonville)

## 💡 Key Features & Benefits

### 🚀 Speed & Simplicity:
- **2-minute process** vs 2 hours in ArcGIS Pro
- **No training required** - intuitive interface
- **Automatic data joins** - no manual matching
- **Instant preview** - see results immediately

### 💸 Zero Cost:
- **100% FREE** - no licenses, no subscriptions
- **No credits consumed** - unlimited maps
- **No hidden fees** - completely open source
- **Saves $700+/year** in software costs

### 🎯 Professional Results:
- **ArcGIS-compatible exports** (GeoJSON/Shapefile)
- **Publication-ready maps** with proper projections
- **Accurate boundaries** from official Census/ArcGIS sources
- **Works with existing GIS workflows**

### 🌎 Comprehensive Coverage:
- **All US geographies** - states, counties, ZIPs, places, tracts
- **Any numeric data** - demographics, economics, health, etc.
- **Any CSV format** - just need proper ID column
- **Handles large datasets** - thousands of features

## 🛠️ Technical Details
- Uses Census TIGER and ArcGIS REST APIs for geographic boundaries
- Leaflet.js for interactive map preview
- Supports county, ZIP code, census tract, and place geographies
- Exports to multiple formats (GeoJSON, Shapefile)

## 📈 Universal Use Cases - Works with ANY CSV Data!

This tool works with **any CSV data** for **any US geography**, not just ALICE data:

### Geographic Coverage:
- **All 50 US States** + territories
- **Counties** - 3,000+ US counties
- **ZIP Codes** - 40,000+ ZCTAs
- **Places/Cities** - 30,000+ incorporated places
- **Census Tracts** - 70,000+ tracts
- **States** - State-level data

### Data Types You Can Map:
- Population demographics
- Economic indicators (unemployment, income, poverty)
- Health metrics (disease rates, healthcare access)
- Education data (graduation rates, test scores)
- Housing statistics (prices, vacancy rates)
- Environmental data (pollution, climate)
- Crime statistics
- Business/retail data
- Election results
- **Any numeric data you have!**

### Example Use Cases:
- **Idaho Business Analysis**: Map business licenses by city
- **Iowa Agriculture**: Show crop yields by sub-county
- **Texas Healthcare**: Display hospital beds by ZIP code
- **California Housing**: Visualize home prices by census tract
- **Florida ALICE Data**: Show households in poverty by county

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