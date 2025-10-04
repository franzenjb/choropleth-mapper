# 🗺️ GIS Data Directory

## **Quick Start (10 minutes to full platform):**

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Download complete US census data (2.8 GB)
python download_census_data.py --recommended

# 3. Download emergency management data (400 MB)  
python download_emergency_data.py

# 4. Launch the platform
streamlit run streamlit_app.py
```

## **What You'll Get:**

### **📊 Complete Coverage (3.3 GB):**
- **States**: 52 features (100% US)
- **Counties**: 3,221 features (100% US)  
- **Census Tracts**: 84,000+ features (100% US)
- **Block Groups**: 247,000+ features (100% US)
- **Places/Cities**: 30,000+ features (100% US)
- **ZIP Codes**: 33,000+ features (100% US)
- **Census Blocks**: 250,000+ features (Priority states)
- **Major Roads**: 17,500+ segments (Interstate/Primary)

### **🚨 Emergency Management:**
- Hospital locations (National)
- Fire station templates  
- FEMA flood zone framework
- Evacuation route samples
- ACS demographic structure

### **🛠️ Professional Tools:**
- Automated CSV-to-shapefile joining
- Smart field detection (FIPS, ZIP, names)
- Fuzzy string matching
- Multiple export formats
- Interactive web interface

## **📁 Sample Data Included:**

- `samples/us_states.json` - All US states (92 KB)
- `samples/acs_demographics_template.json` - ACS data structure

## **🎯 Data Sources:**

- **US Census Bureau**: TIGER/Line Shapefiles 2024 (official)
- **HIFLD**: Homeland Infrastructure Foundation (hospitals, emergency)
- **FEMA**: Federal Emergency Management Agency (flood zones)

## **💡 Why Download Instead of Store in Git:**

1. **Always Current**: Get latest 2024 data
2. **No Size Limits**: GitHub has 100MB file limits
3. **User Choice**: Download only what you need
4. **Official Sources**: Direct from authoritative sources
5. **Storage Efficient**: No duplicate large files in version control

## **🚀 Professional Deployment:**

This system is designed for enterprise use:
- Red Cross emergency management
- Government agency analysis  
- Academic research
- Non-profit community mapping

## **📞 Support:**

All tools include comprehensive help:
```bash
python csv_shapefile_joiner.py --help
python gis_inventory.py --help
```

**Total Setup Time**: ~10 minutes for complete professional GIS platform