# ChloraPleth GIS Database & Join Tool

A comprehensive Python toolkit for joining CSV data to geospatial layers with automated field detection, fuzzy matching, and multiple export formats.

## 🎯 Features

- **Automated Inventory**: Scan and catalog all geospatial assets in your repository
- **Smart Join Detection**: Automatically identify potential join fields in your CSV data
- **Fuzzy Matching**: Handle location name variations with intelligent string matching
- **Multiple Formats**: Export to GeoJSON, Shapefile, CSV, and GeoPackage
- **Interactive Interface**: User-friendly Streamlit web application
- **Command Line Tools**: Scriptable tools for batch processing
- **Comprehensive Coverage**: Support for Counties, ZIP codes, States, and Census data

## 📊 Your Current Geospatial Assets

Based on the inventory scan, you have:

- **Counties**: 3,222 records (~100% US coverage)
- **ZIP Codes**: 34,925 records (~100% US coverage) 
- **States**: 52 records (all US states + DC + territories)
- **Regional Data**: New England subcounties and ZIP codes

### Available Layers:
- `us_counties.json` - All US counties (3,221 features, 2.95 MB)
- `us_zips_full.json` - All US ZIP codes (33,092 features, 27.03 MB)
- `us_states.json` - All US states (52 features, 0.09 MB)
- `ne_zips.json` - New England ZIP codes (1,833 features, 1.11 MB)
- `ne_subcounties.json` - New England subcounties (1 feature, 0.03 MB)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install geopandas pandas streamlit streamlit-folium folium fuzzywuzzy python-levenshtein
```

### 2. Run Inventory Scan

```bash
python gis_inventory.py
```

This generates:
- `gis_inventory.csv` - Detailed inventory spreadsheet
- `gis_metadata.db` - SQLite database with searchable metadata

### 3. Launch Web Interface

```bash
streamlit run streamlit_app.py
```

### 4. Command Line Usage

```bash
# List available layers
python csv_shapefile_joiner.py --list-layers

# Analyze a CSV file
python csv_shapefile_joiner.py --analyze-csv your_data.csv

# Get join suggestions
python csv_shapefile_joiner.py --suggest-joins your_data.csv

# Perform a join
python csv_shapefile_joiner.py --join your_data.csv us_counties.json FIPS GEOID output_name --format geojson
```

## 🔧 Tools Overview

### 1. `gis_inventory.py`
**Purpose**: Scan and catalog all geospatial assets

**Features**:
- Recursive directory scanning
- Metadata extraction (CRS, bounds, record counts)
- Join field identification
- Coverage area detection
- SQLite database creation

**Output**: 
```
================================================================================
CHLORAPLETH GIS DATABASE INVENTORY REPORT
================================================================================
Generated: 2025-10-04 17:43:39
Files analyzed: 5
Total size: 31.2 MB

COVERAGE BY GEOGRAPHY LEVEL:
----------------------------------------
ZIP Code       :  2 files, 34,925 total records
County         :  2 files, 3,222 total records
State          :  1 files, 52 total records
```

### 2. `csv_shapefile_joiner.py`
**Purpose**: Core joining engine with automated field detection

**Key Features**:
- Smart field detection (FIPS codes, ZIP codes, location names)
- Fuzzy string matching for location names
- Multiple join strategies
- Comprehensive join statistics
- Export to multiple formats

**Join Field Detection**:
- **FIPS Codes**: Automatically detects 2-digit (state) and 5-digit (county) FIPS
- **ZIP Codes**: Identifies 5-digit postal codes
- **Location Names**: Finds city, county, and place name fields
- **State Fields**: Detects state names and abbreviations

### 3. `streamlit_app.py`
**Purpose**: Interactive web interface for non-technical users

**Interface Sections**:
- **📊 Data Inventory**: Browse available geospatial layers
- **📁 CSV Upload & Analysis**: Drag-and-drop CSV analysis with join suggestions
- **🔗 Perform Join**: Interactive field mapping and join execution
- **📈 View Results**: Map preview and data exploration
- **💾 Export Data**: Download results in multiple formats

## 💡 Use Cases

### 1. American Red Cross Chapter Data
```python
# Join ARC chapter data to counties
python csv_shapefile_joiner.py --join \\
    chapters.csv us_counties.json \\
    COUNTY_FIPS GEOID chapters_mapped \\
    --format geojson
```

### 2. Emergency Response Analysis
```python
# Join disaster response data to ZIP codes
python csv_shapefile_joiner.py --join \\
    disaster_response.csv us_zips_full.json \\
    ZIP_CODE GEOID10 response_analysis \\
    --format gpkg
```

### 3. Demographic Analysis
```python
# Join census data with fuzzy name matching
python csv_shapefile_joiner.py --join \\
    demographics.csv us_counties.json \\
    COUNTY_NAME NAME demographics_mapped \\
    --fuzzy --format shapefile
```

## 🔍 Join Field Examples

The tool automatically detects these common patterns:

| Field Type | Example CSV Columns | Maps To | Description |
|------------|-------------------|---------|-------------|
| County FIPS | `FIPS`, `GEOID`, `COUNTY_CODE` | `GEOID` | 5-digit county codes |
| State FIPS | `STATE_FIPS`, `STATEFP` | `STATEFP` | 2-digit state codes |
| ZIP Codes | `ZIP`, `ZIPCODE`, `POSTAL` | `GEOID10` | 5-digit postal codes |
| County Names | `COUNTY`, `COUNTY_NAME` | `NAME` | County names (with fuzzy matching) |
| State Names | `STATE`, `STATE_NAME` | `NAME` | State names/abbreviations |

## 📈 Join Statistics

Every join operation provides detailed statistics:

```json
{
  "total_geographic_features": 3221,
  "total_csv_records": 1500,
  "successful_joins": 1487,
  "join_rate": "92.1%",
  "unmatched_geographic": 1734,
  "unmatched_csv": 13
}
```

## 🗺️ Supported Output Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| **GeoJSON** | `.geojson` | Web mapping, Leaflet, Mapbox |
| **Shapefile** | `.shp` | ArcGIS, QGIS, desktop GIS |
| **GeoPackage** | `.gpkg` | Modern GIS standard, SQLite-based |
| **CSV** | `.csv` | Data analysis (geometry removed) |

## 🔧 Advanced Features

### Fuzzy Matching
For location names that don't match exactly:
```python
# Handles variations like:
# "St. Johns County" ↔ "Saint Johns County"
# "NYC" ↔ "New York City"
# "Miami-Dade" ↔ "Miami Dade County"
```

### Batch Processing
```bash
# Process multiple files
for file in *.csv; do
    python csv_shapefile_joiner.py --suggest-joins "$file"
done
```

### Custom Scripts
```python
from csv_shapefile_joiner import CSVShapefileJoiner

joiner = CSVShapefileJoiner()
analysis = joiner.analyze_csv('data.csv')
suggestions = joiner.suggest_best_join(analysis)
result = joiner.perform_join('data.csv', 'us_counties.json', 'FIPS', 'GEOID')
```

## 📝 File Structure

```
choropleth-mapper/
├── data/                      # Geospatial data files
│   ├── us_counties.json       # US counties (100% coverage)
│   ├── us_zips_full.json      # US ZIP codes (100% coverage)
│   ├── us_states.json         # US states (complete)
│   ├── ne_zips.json          # New England ZIPs
│   └── ne_subcounties.json   # New England subcounties
├── gis_inventory.py          # Asset inventory tool
├── csv_shapefile_joiner.py   # Core joining engine
├── streamlit_app.py          # Web interface
├── gis_inventory.csv         # Generated inventory
├── gis_metadata.db          # SQLite metadata database
└── README_GIS_TOOL.md       # This documentation
```

## 🚀 Next Steps

1. **Test with your data**: Upload a CSV file through the Streamlit interface
2. **Explore join options**: Use the analysis tools to find the best join strategy
3. **Automate workflows**: Create scripts for regular data processing
4. **Extend coverage**: Add additional geospatial layers as needed

## 🔗 Integration with Existing Tools

This tool integrates with your existing choropleth mapper:
- Export joined data as GeoJSON for direct use in web maps
- Generate CSV files for the existing app's data input
- Create comprehensive datasets for Red Cross emergency response mapping

## 📞 Support

For questions or issues:
1. Check the join statistics for troubleshooting
2. Use fuzzy matching for name-based joins
3. Verify your CSV field formats match expected patterns
4. Review the inventory report for available geographic coverage

The tool provides comprehensive logging and error messages to help diagnose any issues with your data joins.